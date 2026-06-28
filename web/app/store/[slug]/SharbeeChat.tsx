'use client';

import { useRef, useState } from 'react';
import type { MenuItem } from '@/lib/stores';

type Msg = { who: 'bee' | 'me'; text: string };
type Mode = 'browse' | 'waiting';

function systemPrompt(storeName: string, menu: MenuItem[], mode: Mode): string {
  const menuLines = menu
    .map((m) => `- ${m.name} (${m.price}) ${m.signature ? '[signature]' : ''}${m.description ? ` — ${m.description}` : ''}`)
    .join('\n');
  const modeRule =
    mode === 'waiting'
      ? `현재 손님은 "주문을 마치고 음식을 기다리는 중"입니다. 기다리는 동안 도움이 될 일을 먼저 "~할까요?" 형태로 다정하게 제안하세요. (예: "리뷰 미리 써둘까요?", "다음에 드실 메뉴 봐둘까요?", "스탬프 적립해 둘까요?") 한 번에 하나만 제안.`
      : `현재 손님은 메뉴를 고르는 중입니다. 취향을 물어 메뉴를 좁혀 추천하세요. 추천은 반드시 아래 메뉴 목록 안에서만, 없는 메뉴/가격은 절대 지어내지 마세요.`;
  return `You are "샤비"(Sharbee), a warm, cute honeybee menu concierge for the store "${storeName}".
다정하고 귀여운 말투(🐝, 꿀 이모지)로, 한국어로, 1~2문장 짧게 답하세요. 절대 캐릭터를 깨지 마세요.
[메뉴 목록 — 이 안에서만 추천]
${menuLines}
[행동 규칙]
${modeRule}`;
}

async function askSharbee(sys: string, history: Msg[], userText: string): Promise<string | null> {
  const hist = history.map((m) => `${m.who === 'bee' ? '샤비' : '손님'}: ${m.text}`).join('\n');
  const prompt = `${sys}\n\n[대화]\n${hist}\n손님: ${userText}\n샤비:`;
  try {
    const res = await fetch('/api/sharbee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return data?.text ?? null;
  } catch {
    return null;
  }
}

export default function SharbeeChat({ storeName, menu }: { storeName: string; menu: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('browse');
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'bee', text: '안녕하세요, 샤비예요 🐝 메뉴 고르는 거 도와드릴까요?' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const push = (m: Msg) => {
    setMsgs((prev) => [...prev, m]);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9 }));
  };

  const send = async (text: string, nextMode?: Mode) => {
    if (!text.trim() || busy) return;
    const useMode = nextMode ?? mode;
    push({ who: 'me', text });
    setInput('');
    setBusy(true);
    const reply = await askSharbee(systemPrompt(storeName, menu, useMode), msgs, text);
    push({ who: 'bee', text: reply ?? '앗, 잠시 연결이 흔들렸어요 🐝 다시 한 번 말씀해 주실래요?' });
    setBusy(false);
  };

  const enterWaiting = async () => {
    setMode('waiting');
    setBusy(true);
    const reply = await askSharbee(systemPrompt(storeName, menu, 'waiting'), msgs, '주문 마쳤어요, 기다리는 중이에요.');
    push({ who: 'bee', text: reply ?? '주문 잘 들어갔어요! 🐝 기다리는 동안 리뷰 미리 써둘까요?' });
    setBusy(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="ss-card flex w-full items-center gap-3 p-4 text-left active:scale-[0.99]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sharbee/sharbee5.png" alt="샤비" className="h-11 w-11 shrink-0 rounded-full bg-honey object-contain p-0.5" />
        <span className="flex-1">
          <span className="block font-extrabold">샤비에게 메뉴 추천받기</span>
          <span className="block text-xs text-zinc-500">뭘 먹을지 같이 골라드려요</span>
        </span>
        <span className="text-zinc-300">›</span>
      </button>
    );
  }

  return (
    <section className="ss-card overflow-hidden">
      <div className="flex items-center justify-between bg-honey px-4 py-3">
        <span className="flex items-center gap-2 font-extrabold text-honey-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sharbee/sharbee5.png" alt="샤비" className="h-7 w-7 object-contain" />
          샤비{mode === 'waiting' ? ' · 주문 대기 중' : ''}
        </span>
        <button onClick={() => setOpen(false)} className="font-bold text-honey-ink/70">✕</button>
      </div>
      <div ref={scrollRef} className="flex max-h-64 flex-col gap-2 overflow-y-auto p-3">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
              m.who === 'me' ? 'self-end bg-brand-600 text-white' : 'self-start bg-zinc-100 text-zinc-800'
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && <div className="self-start text-sm text-zinc-400">샤비가 입력 중… 🐝</div>}
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {mode === 'browse' ? (
          <button onClick={enterWaiting} disabled={busy} className="ss-chip cursor-pointer disabled:opacity-60">주문했어요 (기다리는 중)</button>
        ) : (
          <>
            <button onClick={() => send('리뷰 미리 써둘게요')} disabled={busy} className="ss-chip cursor-pointer disabled:opacity-60">리뷰 써둘까요</button>
            <button onClick={() => send('다음에 뭐 먹을지 추천해줘')} disabled={busy} className="ss-chip cursor-pointer disabled:opacity-60">다음 메뉴 추천</button>
          </>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-zinc-100 p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="샤비에게 물어보세요" className="ss-input flex-1" />
        <button type="submit" disabled={busy} className="ss-btn-primary px-4 py-2.5">보내기</button>
      </form>
    </section>
  );
}
