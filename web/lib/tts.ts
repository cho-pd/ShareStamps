// 샤비 음성 재생 — Gemini 자연 음성(/api/tts)을 받아 재생. 실패 시 브라우저 내장 음성으로 폴백.
// 모바일 자동재생 정책: 사용자 제스처(마이크/주문 시작 탭) 때 primeAudio()로 오디오 요소를 미리 잠금해제한다.

let audioEl: HTMLAudioElement | null = null;
let curUrl: string | null = null;

// 44바이트 무음 WAV — 사용자 제스처 순간에 재생해 오디오 요소를 잠금해제(모바일 autoplay 우회)
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

function ensureEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

/** 사용자 제스처 핸들러 안에서 호출 — 이후 프로그램적 재생이 막히지 않도록 오디오를 잠금해제 */
export function primeAudio() {
  const el = ensureEl();
  if (!el) return;
  try {
    el.src = SILENT_WAV;
    el.play().catch(() => {});
  } catch {}
}

function stripEmoji(text: string) {
  return text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
}

export function stopSpeak() {
  try { if (audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); } } catch {}
  try { if (curUrl) { URL.revokeObjectURL(curUrl); curUrl = null; } } catch {}
  try { if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
}

function fallbackSpeak(text: string) {
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    window.speechSynthesis.speak(u);
  } catch {}
}

/** 샤비가 말하기 — Gemini 자연 음성. 실패하면 내장 음성으로 폴백. */
export async function speakGemini(text: string, opts?: { voice?: string }) {
  if (typeof window === 'undefined') return;
  const clean = stripEmoji(text);
  if (!clean) return;
  stopSpeak();
  let url: string | null = null;
  try {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, voice: opts?.voice }),
    });
    if (!r.ok) throw new Error('tts http');
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 100) throw new Error('tts empty');
    url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    const el = ensureEl();
    if (!el) throw new Error('no audio el');
    curUrl = url;
    el.src = url;
    const finished = url;
    el.onended = () => { try { URL.revokeObjectURL(finished); } catch {} if (curUrl === finished) curUrl = null; };
    await el.play();
  } catch {
    if (url) { try { URL.revokeObjectURL(url); } catch {} if (curUrl === url) curUrl = null; }
    fallbackSpeak(clean); // 최후엔 구형 음성이라도 나오게
  }
}
