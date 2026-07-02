'use client';

import { useEffect, useRef, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection } from 'firebase/firestore';
import { postReviewToSns } from '@/lib/snsApi';

// 옛 CustomerPWA 'openSharbeeReview' 복원: 샤비와 대화(Q&A) → AI 리뷰 초안 → 별점 → 등록 + SNS.
type Msg = { who: 'bee' | 'me'; text: string };
type MenuItem = { id: string; name: string };

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('ss_device_id');
    if (!id) { id = crypto.randomUUID?.() ?? `dev_${Date.now()}`; localStorage.setItem('ss_device_id', id); }
    return id;
  } catch { return `dev_${Date.now()}`; }
}

async function askSharbee(prompt: string): Promise<string | null> {
  try {
    const res = await fetch('/api/sharbee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    const data = await res.json();
    return data?.text ? String(data.text).trim() : null;
  } catch { return null; }
}

export default function SharbeeReview({ storeId, storeName, menu, guidance }: { storeId: string; storeName: string; menu: MenuItem[]; guidance?: string }) {
  const ownerGuide = guidance?.trim() ? `\n[매장 맞춤 안내 — 점주가 설정, 우선 반영]\n${guidance.trim()}\n` : '';
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'chat' | 'draft' | 'done'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [rating, setRating] = useState(5);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [snsMsg, setSnsMsg] = useState<string | null>(null);
  const [name, setName] = useState('방문자');
  const scrollRef = useRef<HTMLDivElement>(null);

  const start = () => {
    setStep('chat'); setDraft(''); setRating(5); setSnsMsg(null);
    setMsgs([{ who: 'bee', text: `안녕하세요, 샤비예요 🐝\n오늘 ${storeName}에서 뭘 드셨어요? 맛이나 분위기, 편하게 말해주세요!` }]);
    setOpen(true);
  };

  useEffect(() => {
    try { if (new URLSearchParams(window.location.search).get('review') === '1') start(); } catch {}
    (async () => { try { const s = await getDoc(doc(getDb(), 'customers', getDeviceId())); if (s.exists() && s.data().name) setName(s.data().name as string); } catch {} })();
    // eslint-disable-next-line
  }, []);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, step, busy]);

  const userTurns = msgs.filter((m) => m.who === 'me').length;

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    setInput('');
    const next: Msg[] = [...msgs, { who: 'me', text: t }];
    setMsgs(next); setBusy(true);
    const convo = next.map((m) => `${m.who === 'me' ? '손님' : '샤비'}: ${m.text}`).join('\n');
    const reply = await askSharbee(`당신은 "샤비", 손님이 ${storeName} 방문 리뷰를 쓰도록 돕는 다정한 꿀벌이에요. 아래 대화에 이어, 리뷰에 쓸 만한 점(맛·메뉴·분위기·서비스 중 아직 안 나온 것) 1가지만 짧고 따뜻하게 한국어로 물어보세요. 1~2문장, 이모지 1개 이내.${ownerGuide}\n${convo}\n샤비:`);
    setMsgs((m) => [...m, { who: 'bee', text: reply ?? '좋아요! 더 남기고 싶은 말 있으면 적어주세요 🐝' }]);
    setBusy(false);
  };

  const makeDraft = async () => {
    setBusy(true);
    const answers = msgs.filter((m) => m.who === 'me').map((m) => m.text).join(' / ');
    const text = await askSharbee(`당신은 "샤비". 아래 손님 답변으로 ${storeName} 방문 리뷰를 1인칭 한국어 2~3문장으로 써주세요. 구체적 디테일을 살리고 과장은 줄이며, 매장 이름을 한 번 자연스럽게 넣으세요. 리뷰 본문만 출력.${ownerGuide}\n손님 답변: ${answers || '(전반적으로 좋았어요)'}`);
    setDraft(text ?? (answers || `${storeName} 잘 다녀왔어요. 다음에 또 올게요.`));
    setStep('draft'); setBusy(false);
  };

  // 리뷰 등록 → 스탬프 +1 지급(금액 없음 — 영수증 스캔과 구분). 정지된 회원은 지급하지 않음.
  const grantReviewStamp = async () => {
    try {
      const db = getDb(); const idv = getDeviceId(); const now = new Date().toISOString();
      const mirrorRef = doc(db, 'stores', storeId, 'stampCards', idv);
      const mirrorSnap = await getDoc(mirrorRef);
      if (mirrorSnap.exists() && mirrorSnap.data().suspended) return;
      const storeSnap = await getDoc(doc(db, 'stores', storeId));
      const st = storeSnap.exists() ? (storeSnap.data() as { name?: string; slug?: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number; currency?: string }) : {};
      const cardRef = doc(db, 'customers', idv, 'cards', storeId);
      const cardSnap = await getDoc(cardRef);
      const cur = cardSnap.exists() ? ((cardSnap.data().currentStamps as number) || 0) : 0;
      const next = cur + 1;
      // 칸별 가치 기록 — 획득 시점의 보상÷7로 고정
      const reward = st.pointRewardPer7Stamps ?? 5;
      const prevVals = (cardSnap.exists() ? (cardSnap.data().stampValues as number[] | undefined) : undefined) ?? Array.from({ length: cur }).map(() => reward / 7);
      const stampValues = [...prevVals.slice(0, cur), reward / 7];
      await setDoc(cardRef, { storeId, storeName: st.name || storeName, slug: st.slug || '', currentStamps: next, reward, currency: st.currency || 'USD', interval: st.earningIntervalMinutes ?? 60, stampValues, updatedAt: now }, { merge: true });
      await setDoc(mirrorRef, { deviceId: idv, currentStamps: next, updatedAt: now }, { merge: true });
      await setDoc(doc(collection(db, 'stores', storeId, 'stampLog')), { deviceId: idv, amount: null, source: 'review', createdAt: now });
    } catch { /* 스탬프 지급 실패해도 리뷰 등록 자체는 유지 */ }
  };

  const submit = async () => {
    if (draft.trim().length < 5) return;
    setBusy(true);
    try {
      const db = getDb();
      const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(collection(db, 'stores', storeId, 'reviews'), id), { author: name, rating, comment: draft.trim(), createdAt: new Date().toISOString() });
      try { window.dispatchEvent(new CustomEvent('ss-review-added')); } catch {} // 미니홈 리뷰 목록 즉시 갱신
      await grantReviewStamp();
      const sns = await postReviewToSns({ storeId, content: `${draft.trim()}\n\n📍 ${storeName}`, networks: [] });
      if (sns.success && sns.postedNetworks.length) setSnsMsg(`매장 SNS(${sns.postedNetworks.join(', ')})에도 게시됐어요.`);
      setStep('done');
    } catch { setSnsMsg('등록에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={start} className="ss-card mt-3 flex w-full items-center gap-3 border border-honey/60 bg-honey/20 p-4 active:scale-[0.99]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sharbee/sharbee5.png" alt="샤비" className="h-11 w-11 shrink-0 object-contain" />
        <div className="flex-1 text-left">
          <div className="text-sm font-extrabold text-honey-ink">샤비와 리뷰 쓰고 스탬프 받기</div>
          <div className="text-[11px] text-honey-ink/70">대화하듯 리뷰 쓰면 스탬프를 드려요 🐝</div>
        </div>
        <span className="text-honey-ink/50">›</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-md flex-col bg-white">
      <div className="flex items-center justify-between bg-honey px-4 py-3">
        <span className="flex items-center gap-2 font-extrabold text-honey-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sharbee/sharbee5.png" alt="샤비" className="h-7 w-7 object-contain" /> 샤비와 리뷰 쓰기
        </span>
        <button onClick={() => setOpen(false)} className="font-bold text-honey-ink/70">✕</button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${m.who === 'me' ? 'self-end ml-auto bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-800'}`}>{m.text}</div>
        ))}
        {busy && step === 'chat' && <div className="text-sm text-zinc-400">샤비가 입력 중… 🐝</div>}

        {step === 'draft' && (
          <div className="rounded-2xl border border-honey/60 bg-honey/10 p-3">
            <div className="text-xs font-bold text-honey-ink">샤비가 쓴 리뷰 초안 — 고쳐도 돼요</div>
            <div className="mt-1 text-2xl leading-none">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="active:scale-90">{n <= rating ? '⭐' : '☆'}</button>
              ))}
            </div>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="ss-input mt-2 min-h-[88px]" />
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-2xl bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700">
            리뷰가 등록됐어요! 🎉 매장 페이지·AI 검색에 반영됩니다.{snsMsg ? <><br />{snsMsg}</> : null}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-100 p-3">
        {step === 'chat' && (
          <>
            {userTurns === 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {menu.slice(0, 4).map((m) => (
                  <button key={m.id} onClick={() => send(`${m.name} 먹었어요`)} className="ss-chip">{m.name}</button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(input); }} placeholder="샤비에게 답하기" className="ss-input flex-1" />
              <button onClick={() => send(input)} disabled={busy} className="ss-btn-soft px-4">보내기</button>
            </div>
            {userTurns >= 1 && (
              <button onClick={makeDraft} disabled={busy} className="ss-btn-primary mt-2 w-full">{busy ? '샤비가 쓰는 중… 🐝' : '✨ 리뷰 초안 만들기'}</button>
            )}
          </>
        )}
        {step === 'draft' && (
          <button onClick={submit} disabled={busy} className="ss-btn-primary w-full">{busy ? '등록 중…' : '리뷰 등록하고 스탬프 받기'}</button>
        )}
        {step === 'done' && (
          <button onClick={() => setOpen(false)} className="ss-btn-soft w-full">닫기</button>
        )}
      </div>
    </div>
  );
}
