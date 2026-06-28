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

// 키는 서버(Netlify Function)에만. 클라이언트는 비밀 아닌 prompt만 보낸다.
async function askGemini(sys: string, history: Msg[], userText: string): Promise<string | null> {
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
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'bee', text: '안녕하세요, 샤비예요 🐝 메뉴 고르는 거 도와드릴까요?' },
  ]);
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
    const reply = await askGemini(systemPrompt(storeName, menu, useMode), msgs, text);
    push({ who: 'bee', text: reply ?? '앗, 잠시 연결이 흔들렸어요 🐝 다시 한 번 말씀해 주실래요?' });
    setBusy(false);
  };

  const enterWaiting = async () => {
    setMode('waiting');
    setBusy(true);
    const reply = await askGemini(systemPrompt(storeName, menu, 'waiting'), msgs, '주문 마쳤어요, 기다리는 중이에요.');
    push({ who: 'bee', text: reply ?? '주문 잘 들어갔어요! 🐝 기다리는 동안 리뷰 미리 써둘까요?' });
    setBusy(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ marginTop: 16, padding: '12px 18px', border: 'none', borderRadius: 999, background: '#fde68a', color: '#7c2d12', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
      >
        🐝 샤비에게 메뉴 추천받기
      </button>
    );
  }

  return (
    <section style={{ marginTop: 16, border: '1px solid #f1e0a8', borderRadius: 14, overflow: 'hidden', background: '#fffdf5' }}>
      <div style={{ padding: '10px 14px', background: '#fde68a', fontWeight: 800, color: '#7c2d12', display: 'flex', justifyContent: 'space-between' }}>
        <span>🐝 샤비 {mode === 'waiting' ? '· 주문 대기 중' : ''}</span>
        <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 800 }}>✕</button>
      </div>
      <div ref={scrollRef} style={{ maxHeight: 260, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: '8px 12px', borderRadius: 12, fontSize: 14, background: m.who === 'me' ? '#6d28d9' : '#fff', color: m.who === 'me' ? '#fff' : '#333', border: m.who === 'me' ? 'none' : '1px solid #eee' }}>
            {m.text}
          </div>
        ))}
        {busy && <div style={{ alignSelf: 'flex-start', color: '#999', fontSize: 13 }}>샤비가 입력 중… 🐝</div>}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 12px 8px' }}>
        {mode === 'browse' ? (
          <button onClick={enterWaiting} disabled={busy} style={chip}>주문했어요 (기다리는 중)</button>
        ) : (
          <>
            <button onClick={() => send('리뷰 미리 써둘게요')} disabled={busy} style={chip}>리뷰 써둘까요</button>
            <button onClick={() => send('다음에 뭐 먹을지 추천해줘')} disabled={busy} style={chip}>다음 메뉴 추천</button>
          </>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid #f1e0a8' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="샤비에게 물어보세요" style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        <button type="submit" disabled={busy} style={{ padding: '10px 14px', border: 'none', borderRadius: 8, background: '#6d28d9', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>보내기</button>
      </form>
    </section>
  );
}

const chip: React.CSSProperties = { padding: '6px 12px', border: '1px solid #e2c878', borderRadius: 999, background: '#fff', color: '#7c2d12', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
