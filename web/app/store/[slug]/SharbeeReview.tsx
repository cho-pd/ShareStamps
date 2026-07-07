'use client';

import { useEffect, useRef, useState } from 'react';
import { getDb, getStorageBucket } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { postReviewToSns } from '@/lib/snsApi';
import { speakGemini, stopSpeak, primeAudio } from '@/lib/tts';

// 옛 CustomerPWA 'openSharbeeReview' 전 과정 복원:
// 샤비와 대화(Q&A) → AI 리뷰 초안 → ⭐별점 + 📷사진 + 🎥동영상(≤15초) → Storage 업로드 → 등록 + SNS(공개 URL로 인스타까지).
const MAX_VIDEO_SECONDS = 15;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 15초 영상 상한(대략)
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
  // 미디어(사진·동영상 ≤15초) — 옛 CustomerPWA 샤비 리뷰에서 이식
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  // 음성 레이어 (러브레터 시뮬레이션): 브라우저 Web Speech API로 STT(말→텍스트) + TTS(샤비가 말하기).
  // 텍스트 입력은 그대로 남겨 폴백 — 미흡하면 텍스트로, 보완 후 다시 음성으로.
  const [voiceOn, setVoiceOn] = useState(false); // 샤비 답변을 음성으로 읽어줄지
  const [listening, setListening] = useState(false);
  const [sttLang, setSttLang] = useState<'ko-KR' | 'en-US'>('ko-KR');
  const [voiceSupported, setVoiceSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setVoiceSupported(typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);
  const speak = (text: string) => {
    if (!voiceOn) return;
    void speakGemini(text); // 제미나이 자연 음성(폴백: 브라우저 내장 음성)
  };

  const start = () => {
    setStep('chat'); setDraft(''); setRating(5); setSnsMsg(null);
    setPhotoUrl(''); setPhotoBlob(null); setVideoUrl(''); setVideoFile(null); setMediaError('');
    setMsgs([{ who: 'bee', text: `안녕하세요, 샤비예요 🐝\n오늘 ${storeName}에서 뭘 드셨어요? 맛이나 분위기, 편하게 말해주세요!` }]);
    setOpen(true);
  };

  // 📷 사진: 캔버스로 1080px 다운스케일 → JPEG blob(용량·인스타 종횡비 안전 방향). (옛 CustomerPWA 이식)
  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setMediaError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const maxSize = 1080;
        let width = img.width, height = img.height;
        if (width > height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => { if (!blob) return; setPhotoBlob(blob); setPhotoUrl(URL.createObjectURL(blob)); }, 'image/jpeg', 0.72);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 🎥 동영상: 15초 초과 거부(onloadedmetadata로 길이 검증). (옛 CustomerPWA 이식)
  const onPickVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) { setMediaError('동영상 파일이 너무 커요. 15초 이내 짧은 영상으로 다시 선택해 주세요.'); e.target.value = ''; return; }
    const objectUrl = URL.createObjectURL(file);
    const v = document.createElement('video'); v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const dur = Number.isFinite(v.duration) ? v.duration : 0;
      if (dur > MAX_VIDEO_SECONDS + 0.3) {
        URL.revokeObjectURL(objectUrl); setMediaError('15초 이내 동영상만 올릴 수 있어요.'); setVideoUrl(''); setVideoFile(null);
      } else {
        if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
        setMediaError(''); setVideoUrl(objectUrl); setVideoFile(file);
      }
      e.target.value = '';
    };
    v.onerror = () => { URL.revokeObjectURL(objectUrl); setMediaError('동영상을 읽을 수 없어요. 다른 파일로 시도해 주세요.'); e.target.value = ''; };
    v.src = objectUrl;
  };

  const clearPhoto = () => { if (photoUrl.startsWith('blob:')) URL.revokeObjectURL(photoUrl); setPhotoUrl(''); setPhotoBlob(null); };
  const clearVideo = () => { if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl); setVideoUrl(''); setVideoFile(null); };

  // Firebase Storage 업로드 → 공개 URL. blob/data 는 SNS(Outstand)가 못 읽으니 반드시 이 공개 URL로 게시(CLAUDE.md §5).
  const uploadMedia = async (media: Blob | File | null, type: 'photo' | 'video', ext: string): Promise<string> => {
    if (!media) return '';
    try {
      const storage = getStorageBucket();
      const path = `reviews/${storeId}/${getDeviceId()}/${type}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const up = await uploadBytes(storageRef(storage, path), media, {
        contentType: type === 'photo' ? 'image/jpeg' : (media as File).type || 'video/mp4',
        customMetadata: { storeId, source: 'sharbee-review' },
      });
      return await getDownloadURL(up.ref);
    } catch { return ''; }
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
    const beeText = reply ?? '좋아요! 더 남기고 싶은 말 있으면 적어주세요 🐝';
    setMsgs((m) => [...m, { who: 'bee', text: beeText }]);
    speak(beeText);
    setBusy(false);
  };

  // STT: 마이크로 말하면 텍스트로 받아 그대로 send. (한 번에 한 발화)
  const startListening = () => {
    primeAudio(); // 사용자 제스처 순간 오디오 잠금해제
    if (busy || listening) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = sttLang;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      recogRef.current = rec;
      setListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => { const t = String(e?.results?.[0]?.[0]?.transcript ?? '').trim(); setListening(false); if (t) send(t); };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
    } catch { setListening(false); }
  };
  const stopListening = () => { try { recogRef.current?.stop?.(); } catch { /* noop */ } setListening(false); };

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
      // 칸별 가치·날짜 기록 — 획득 시점의 보상÷9로 고정
      const reward = st.pointRewardPer7Stamps ?? 5;
      const prevVals = (cardSnap.exists() ? (cardSnap.data().stampValues as number[] | undefined) : undefined) ?? Array.from({ length: cur }).map(() => reward / 9);
      const prevDates = (cardSnap.exists() ? (cardSnap.data().stampDates as string[] | undefined) : undefined) ?? Array.from({ length: cur }).map(() => now);
      const stampValues = [...prevVals.slice(0, cur), reward / 9];
      const stampDates = [...prevDates.slice(0, cur), now];
      await setDoc(cardRef, { storeId, storeName: st.name || storeName, slug: st.slug || '', currentStamps: next, reward, currency: st.currency || 'USD', interval: st.earningIntervalMinutes ?? 60, stampValues, stampDates, updatedAt: now }, { merge: true });
      await setDoc(mirrorRef, { deviceId: idv, currentStamps: next, updatedAt: now }, { merge: true });
      await setDoc(doc(collection(db, 'stores', storeId, 'stampLog')), { deviceId: idv, amount: null, source: 'review', count: 1, value: reward / 9, createdAt: now });
    } catch { /* 스탬프 지급 실패해도 리뷰 등록 자체는 유지 */ }
  };

  const submit = async () => {
    if (draft.trim().length < 5) return;
    setBusy(true);
    try {
      const db = getDb();
      const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const reviewRef = doc(collection(db, 'stores', storeId, 'reviews'), id);
      // 리뷰는 즉시 저장(손님 대기 X). 미디어 업로드·SNS 게시는 done 화면 뒤 백그라운드로.
      await setDoc(reviewRef, { author: name, rating, comment: draft.trim(), createdAt: new Date().toISOString() });
      try { window.dispatchEvent(new CustomEvent('ss-review-added')); } catch {} // AI 미니홈 리뷰 목록 즉시 갱신
      await grantReviewStamp();
      setStep('done');

      const content = `${draft.trim()}\n\n📍 ${storeName}`;
      if (photoBlob || videoFile) {
        setSnsMsg('사진·영상 올리는 중이에요… 🐝');
        const ext = (videoFile?.name.split('.').pop() || 'mp4').toLowerCase();
        const [pUrl, vUrl] = await Promise.all([uploadMedia(photoBlob, 'photo', 'jpg'), uploadMedia(videoFile, 'video', ext)]);
        if (pUrl || vUrl) { try { await setDoc(reviewRef, { ...(pUrl ? { photoUrl: pUrl } : {}), ...(vUrl ? { videoUrl: vUrl } : {}) }, { merge: true }); } catch {} }
        // 공개 URL로 게시(사진 우선). 인스타는 이미지 필수라 이 경로가 있어야 게시됨.
        const mediaUrls = [pUrl || vUrl].filter(Boolean) as string[];
        const sns = await postReviewToSns({ storeId, content, mediaUrls, networks: [] });
        setSnsMsg(sns.success && sns.postedNetworks.length ? `매장 SNS(${sns.postedNetworks.join(', ')})에도 게시됐어요.` : null);
      } else {
        const sns = await postReviewToSns({ storeId, content, networks: [] });
        setSnsMsg(sns.success && sns.postedNetworks.length ? `매장 SNS(${sns.postedNetworks.join(', ')})에도 게시됐어요.` : null);
      }
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

            {/* 📷 사진 + 🎥 동영상(≤15초) — 있으면 리뷰·매장 SNS(인스타 포함)에 함께 올라가요 */}
            <div className="mt-3 flex gap-2">
              {photoUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  <button onClick={clearPhoto} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[11px] text-white">✕</button>
                </div>
              ) : (
                <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-honey/70 text-[11px] font-bold text-honey-ink">
                  📷<span>사진</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
                </label>
              )}
              {videoUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                  <video src={videoUrl} className="h-full w-full object-cover" muted playsInline />
                  <button onClick={clearVideo} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[11px] text-white">✕</button>
                </div>
              ) : (
                <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-honey/70 text-[11px] font-bold text-honey-ink">
                  🎥<span>15초</span>
                  <input type="file" accept="video/*" capture="environment" className="hidden" onChange={onPickVideo} />
                </label>
              )}
            </div>
            {mediaError && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{mediaError}</p>}
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
            <div className="mb-2 flex items-center gap-1.5 text-[11px]">
              <button type="button" onClick={() => { primeAudio(); setVoiceOn((v) => { if (v) stopSpeak(); return !v; }); }} className={`rounded-full px-2.5 py-1 font-bold ${voiceOn ? 'bg-brand-50 text-brand-700' : 'bg-zinc-100 text-zinc-500'}`}>{voiceOn ? '🔊 샤비 음성 켜짐' : '🔇 샤비 음성'}</button>
              <button type="button" onClick={() => setSttLang((l) => (l === 'ko-KR' ? 'en-US' : 'ko-KR'))} className="rounded-full bg-zinc-100 px-2.5 py-1 font-bold text-zinc-600">{sttLang === 'ko-KR' ? '🇰🇷 한국어' : '🇺🇸 English'}</button>
              {!voiceSupported && <span className="text-zinc-400">이 브라우저는 음성 미지원</span>}
            </div>
            <div className="flex gap-2">
              {voiceSupported && (
                <button type="button" onClick={listening ? stopListening : startListening} disabled={busy} className={`shrink-0 rounded-xl px-3 text-base font-bold transition active:scale-95 ${listening ? 'animate-pulse bg-red-500 text-white' : 'bg-brand-600 text-white'}`} title="말로 답하기">{listening ? '● 듣는 중' : '🎤'}</button>
              )}
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(input); }} placeholder={listening ? '듣고 있어요…' : '샤비에게 답하기'} className="ss-input flex-1" />
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
