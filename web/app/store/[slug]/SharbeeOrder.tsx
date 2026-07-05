'use client';

// 대화형 주문 PoC: 샤비와 대화(텍스트+음성)하며 사진 메뉴를 담고 주문한다.
// - 음성: 🎤 한 번 켜면 핸즈프리(말하면 자동 인식, 멈추면 처리, 계속 청취). 텍스트 폴백 상시.
// - ?order=1 로 자동 오픈. ?table=N 있으면 테이블 주문(번호 기록).
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { MENU_CATEGORIES, type MenuItem } from '@/lib/stores';
import { menuSampleImage } from '@/lib/menuImages';
import { speakGemini, stopSpeak, primeAudio } from '@/lib/tts';

type Msg = { who: 'bee' | 'me'; text: string };
type Line = { key: string; item: MenuItem; label?: string; price: number; qty: number };

function systemPrompt(storeName: string, menu: MenuItem[], guidance?: string): string {
  const lines = menu.filter((m) => !m.hidden).map((m) => {
    const price = m.variants?.length ? m.variants.map((v) => `${v.label} $${v.price}`).join(' / ') : `$${m.price}`;
    return `- ${m.name}${m.signature ? ' [대표]' : ''}${m.spicy ? ' [매운맛]' : ''} (${price})${m.description ? ` — ${m.description}` : ''}${m.soldOut ? ' (품절)' : ''}`;
  }).join('\n');
  const g = guidance?.trim() ? `\n[매장 맞춤 안내 — 우선]\n${guidance.trim()}` : '';
  return `너는 "${storeName}"의 AI 점원 "샤비"(귀여운 꿀벌 🐝)야. 손님이 말/글로 주문하도록 돕는다.
규칙: 한국어(손님이 영어면 영어)로 1~2문장 짧고 다정하게. 아래 메뉴 안에서만 추천, 없는 메뉴·가격 지어내기 금지.
대표는 고구마피자·한국식 치킨. 매운 메뉴는 매운맛 미리 확인. 피자는 R/L, 치킨은 Half/Whole 사이즈 물어보기.
손님이 정하면 "오른쪽/아래 '담기'를 눌러 담아주세요" 또는 자연스럽게 안내. 업셀(소주·음료)은 딱 1회, 강요 없이.${g}
[메뉴]
${lines}`;
}

async function askSharbee(sys: string, history: Msg[], userText: string): Promise<string | null> {
  const hist = history.map((m) => `${m.who === 'bee' ? '샤비' : '손님'}: ${m.text}`).join('\n');
  const prompt = `${hist ? `[지금까지 대화]\n${hist}\n` : ''}손님: ${userText}`;
  try {
    // 페르소나·메뉴는 systemInstruction으로 분리해야 모델이 지시를 따른다(안 그러면 일반 챗봇처럼 딴소리함).
    const res = await fetch('/api/sharbee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: sys, prompt }) });
    const data = await res.json();
    return data?.text ? String(data.text).trim() : null;
  } catch { return null; }
}

export default function SharbeeOrder({ storeId, storeName, menu, guidance }: { storeId: string; storeName: string; menu: MenuItem[]; guidance?: string }) {
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [cart, setCart] = useState<Line[]>([]);
  const [cat, setCat] = useState<string>('');
  const [highlightId, setHighlightId] = useState<string>(''); // 말한 메뉴를 화면에 띄우기
  const [done, setDone] = useState<{ orderNo: string } | null>(null);
  // 음성
  const [voiceOn, setVoiceOn] = useState(true); // 샤비 음성 기본 켜기 — 손님이 상호작용하면 샤비가 소리로 답함
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cats = useMemo(() => {
    const present = new Set(menu.filter((m) => !m.hidden).map((m) => m.category || 'STARTERS'));
    return [...MENU_CATEGORIES.filter((c) => present.has(c)), ...[...present].filter((c) => !(MENU_CATEGORIES as readonly string[]).includes(c))];
  }, [menu]);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('order') === '1' || sp.get('table')) startOrder();
      setTable(sp.get('table') || '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVoiceSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setCat((c) => c || cats[0] || ''); }, [cats]);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`mc-${highlightId}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const tmr = window.setTimeout(() => setHighlightId(''), 2600);
    return () => window.clearTimeout(tmr);
  }, [highlightId]);

  const speak = (text: string) => {
    if (!voiceOn) return;
    void speakGemini(text); // 제미나이 자연 음성(폴백: 브라우저 내장 음성)
  };

  // 손님이 말/글로 언급한 메뉴를 찾아 화면에 띄운다 (이름·설명 키워드 가중 매칭). 예: "고구마피자" → Sweet Potato Pizza
  const findMentioned = (text: string): MenuItem | null => {
    const t = text.toLowerCase();
    let best: MenuItem | null = null, bestScore = 0;
    for (const m of menu.filter((x) => !x.hidden)) {
      const kws = new Set((m.name + ' ' + (m.description || '')).toLowerCase().split(/[\s,()/·]+/).filter((w) => w.length >= 2));
      let score = 0;
      kws.forEach((k) => { if (t.includes(k)) score += k.length; });
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return bestScore >= 2 ? best : null;
  };

  const startOrder = () => {
    primeAudio();
    setDone(null); setCart([]);
    setMsgs([{ who: 'bee', text: `안녕하세요, 샤비예요 🐝 ${storeName}에 오신 걸 환영해요! 뭐 드시고 싶으세요? 말로 하셔도 되고, 아래 메뉴에서 골라 담으셔도 돼요.` }]);
    setOpen(true);
  };

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    setInput('');
    const next: Msg[] = [...msgs, { who: 'me', text: t }];
    setMsgs(next); setBusy(true);
    const hit = findMentioned(t); // 말한 메뉴를 화면에 띄운다
    if (hit) { if (hit.category) setCat(hit.category); setHighlightId(hit.id); }
    const reply = await askSharbee(systemPrompt(storeName, menu, guidance), next.slice(0, -1), t);
    const bee = reply ?? '앗, 잠깐 연결이 흔들렸어요 🐝 다시 말씀해 주실래요?';
    setMsgs((m) => [...m, { who: 'bee', text: bee }]); speak(bee); setBusy(false);
  };

  // STT 핸즈프리: 켜면 계속 청취(끝나면 자동 재시작), 인식되면 send
  const toggleListen = () => {
    primeAudio(); // 사용자 제스처 순간 오디오 잠금해제 → 이후 샤비 음성이 모바일에서도 재생됨
    if (listening) { setListening(false); try { recRef.current?.stop?.(); } catch {} return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = false; rec.continuous = false; recRef.current = rec;
    setListening(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => { const s = String(e?.results?.[0]?.[0]?.transcript ?? '').trim(); if (s) send(s); };
    rec.onerror = () => {};
    rec.onend = () => { if (recRef.current === rec && listeningRef.current) { try { rec.start(); } catch {} } };
    try { rec.start(); } catch { setListening(false); }
  };
  useEffect(() => { listeningRef.current = listening; if (!listening) { try { recRef.current?.stop?.(); } catch {} } }, [listening]);

  const addToCart = (item: MenuItem, v?: { label: string; price: number }) => {
    const key = item.id + (v?.label || '');
    setCart((c) => { const i = c.findIndex((x) => x.key === key); if (i > -1) { const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n; } return [...c, { key, item, label: v?.label, price: v?.price ?? item.price, qty: 1 }]; });
  };
  const setQty = (key: string, d: number) => setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: Math.max(0, x.qty + d) } : x)).filter((x) => x.qty > 0));
  const total = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const placeOrder = async () => {
    if (!cart.length || busy) return; setBusy(true);
    try {
      const ref = await addDoc(collection(getDb(), 'stores', storeId, 'orders'), {
        table: table || null,
        items: cart.map((l) => ({ id: l.item.id, name: l.item.name, label: l.label || null, price: l.price, qty: l.qty })),
        total, status: 'new', createdAt: serverTimestamp(),
      });
      setDone({ orderNo: ref.id.slice(-4).toUpperCase() });
      const bee = `주문 들어갔어요! 🐝 주문번호 ${ref.id.slice(-4).toUpperCase()}. 맛있게 준비할게요 🍕`;
      setMsgs((m) => [...m, { who: 'bee', text: bee }]); speak(bee);
    } catch { setMsgs((m) => [...m, { who: 'bee', text: '앗, 주문 전송이 안 됐어요 🐝 잠시 후 다시 눌러주세요.' }]); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={startOrder} className="ss-card mt-3 flex w-full items-center gap-3 bg-zinc-900 p-4 text-left text-white active:scale-[0.99]">
        <span className="text-2xl">🍽️</span>
        <span className="flex-1"><span className="block text-sm font-extrabold">메뉴 보고 주문하기</span><span className="block text-[11px] text-white/70">샤비랑 대화하며 주문하고 스탬프도 쌓으세요 ⭐</span></span>
        <span className="text-white/50">›</span>
      </button>
    );
  }

  const visible = menu.filter((m) => !m.hidden && (m.category || 'STARTERS') === cat);

  return (
    <div className="fixed inset-0 z-[80] mx-auto flex max-w-md flex-col bg-white">
      <div className="flex items-center justify-between bg-honey px-4 py-3">
        <span className="flex items-center gap-2 font-extrabold text-honey-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sharbee/sharbee5.png" alt="샤비" className="h-7 w-7 object-contain" /> 샤비와 주문{table ? ` · ${table}번 테이블` : ''}
        </span>
        <button onClick={() => setOpen(false)} className="font-bold text-honey-ink/70">✕</button>
      </div>

      {/* 대화 */}
      <div ref={scrollRef} className="max-h-[32vh] shrink-0 space-y-2 overflow-y-auto border-b border-zinc-100 p-3">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[82%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${m.who === 'me' ? 'ml-auto bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-800'}`}>{m.text}</div>
        ))}
        {busy && <div className="text-sm text-zinc-400">샤비가 준비 중… 🐝</div>}
      </div>

      {/* 사진 메뉴 */}
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto bg-white/95 px-3 py-2 backdrop-blur">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${cat === c ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{c}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3">
          {visible.map((m) => {
            const img = m.imageUrl || menuSampleImage(m.name, m.category);
            return (
            <div key={m.id} id={`mc-${m.id}`} className={`ss-card overflow-hidden transition ${m.soldOut ? 'opacity-50' : ''} ${highlightId === m.id ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="aspect-square w-full bg-zinc-100">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-zinc-300">🍽️</div>
                )}
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1 text-[13px] font-extrabold text-zinc-800">{m.name}{m.spicy && <span>🌶️</span>}</div>
                {m.description && <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-tight text-zinc-400">{m.description}</div>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.variants?.length ? (
                    m.variants.map((v) => (
                      <button key={v.label} disabled={m.soldOut} onClick={() => addToCart(m, v)} className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700 disabled:opacity-50">{v.label} ${v.price.toFixed(2)} +</button>
                    ))
                  ) : (
                    <button disabled={m.soldOut} onClick={() => addToCart(m)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 disabled:opacity-50">${m.price.toFixed(2)} 담기</button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* 입력 (음성 + 텍스트) */}
      {!done && (
        <div className="border-t border-zinc-100 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px]">
            <button type="button" onClick={() => { primeAudio(); setVoiceOn((v) => { if (v) stopSpeak(); return !v; }); }} className={`rounded-full px-2.5 py-1 font-bold ${voiceOn ? 'bg-brand-50 text-brand-700' : 'bg-zinc-100 text-zinc-500'}`}>{voiceOn ? '🔊 샤비 음성 켜짐' : '🔇 샤비 음성'}</button>
            {listening && <span className="font-bold text-red-500">● 듣는 중… 편하게 말씀하세요</span>}
          </div>
          <div className="flex gap-2">
            {voiceSupported && (
              <button type="button" onClick={toggleListen} disabled={busy} className={`shrink-0 rounded-xl px-3 text-base font-bold transition active:scale-95 ${listening ? 'animate-pulse bg-red-500 text-white' : 'bg-brand-600 text-white'}`} title="말로 주문">{listening ? '■' : '🎤'}</button>
            )}
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(input); }} placeholder={listening ? '듣고 있어요…' : '샤비에게 말하기 (예: 고구마피자 라지)'} className="ss-input flex-1" />
            <button onClick={() => send(input)} disabled={busy} className="ss-btn-soft px-4">보내기</button>
          </div>
        </div>
      )}

      {/* 장바구니 / 주문 */}
      <div className="border-t border-zinc-100 bg-white p-3">
        {done ? (
          <div className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-700">주문 완료! 🎉 주문번호 {done.orderNo}{table ? ` · ${table}번 테이블` : ''} · 스탬프도 쌓였어요 ⭐<button onClick={() => setOpen(false)} className="ss-btn-soft mt-2 w-full">닫기</button></div>
        ) : cart.length === 0 ? (
          <p className="text-center text-xs text-zinc-400">담은 메뉴가 없어요. 말하거나 사진을 눌러 담아보세요 🐝</p>
        ) : (
          <>
            <div className="mb-2 max-h-24 space-y-1 overflow-y-auto">
              {cart.map((l) => (
                <div key={l.key} className="flex items-center justify-between text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-zinc-700">{l.item.name}{l.label ? ` (${l.label})` : ''}</span>
                  <span className="flex items-center gap-2">
                    <button onClick={() => setQty(l.key, -1)} className="h-6 w-6 rounded-full bg-zinc-100 font-bold text-zinc-600">−</button>
                    <span className="w-4 text-center font-bold">{l.qty}</span>
                    <button onClick={() => setQty(l.key, 1)} className="h-6 w-6 rounded-full bg-zinc-100 font-bold text-zinc-600">+</button>
                    <span className="w-14 text-right font-bold text-zinc-800">${(l.price * l.qty).toFixed(2)}</span>
                  </span>
                </div>
              ))}
            </div>
            <button onClick={placeOrder} disabled={busy} className="ss-btn-primary w-full py-3.5">{busy ? '전송 중…' : `이대로 주문하기 · ${count}개 · $${total.toFixed(2)}`}</button>
          </>
        )}
      </div>
    </div>
  );
}
