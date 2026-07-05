// 샤비 음성 재생 — Gemini 자연 음성(/api/tts)을 받아 재생. 실패 시 브라우저 내장 음성으로 폴백.
// 모바일 자동재생 정책: 사용자 제스처(마이크/주문 시작 탭) 때 primeAudio()로 오디오 요소를 미리 잠금해제한다.

let audioEl: HTMLAudioElement | null = null;
let curUrl: string | null = null;
let seq = 0; // 재생 세션 토큰 — 새 발화/중단이 들어오면 진행 중인 청크 재생을 무효화

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
  seq++; // 진행 중인 청크 재생 루프 무효화
  try { if (audioEl) { audioEl.pause(); audioEl.removeAttribute('src'); } } catch {}
  try { if (curUrl) { URL.revokeObjectURL(curUrl); curUrl = null; } } catch {}
  try { if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); } catch {}
}

// 첫 문장 경계로 분리. 소수점(17.99)은 뒤에 공백이 없어 안 잘린다. 종결부호+공백/따옴표만 문장 경계로 본다.
function splitFirst(text: string): [string, string] {
  const t = text.trim();
  const m = /[.!?。！？…]["'”’)]?\s/.exec(t);
  if (!m) return [t, ''];
  const idx = m.index + m[0].length;
  const first = t.slice(0, idx).trim();
  const rest = t.slice(idx).trim();
  if (first.length < 2 || !rest) return [t, ''];
  return [first, rest];
}

// 텍스트 한 조각을 Gemini TTS로 합성해 재생용 blob URL 반환(실패 시 null)
async function synth(text: string, voice?: string): Promise<string | null> {
  try {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 100) return null;
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  } catch { return null; }
}

// blob URL 하나를 재생하고 끝날 때까지 대기(오류/중단도 resolve)
function playUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const el = ensureEl();
    if (!el) { resolve(); return; }
    curUrl = url;
    el.src = url;
    const done = () => resolve();
    el.onended = done;
    el.onerror = done;
    el.play().catch(done);
  });
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

const revoke = (u: string | null) => { if (u) { try { URL.revokeObjectURL(u); } catch {} } };

/**
 * 샤비가 말하기 — Gemini 자연 음성. 첫 문장을 먼저 합성해 즉시 재생하고,
 * 나머지는 병렬로 미리 합성해 이어붙인다(첫 소리까지의 지연을 문장 1개 분량으로 단축).
 * 합성 실패 시 내장 음성으로 폴백.
 */
export async function speakGemini(text: string, opts?: { voice?: string }) {
  if (typeof window === 'undefined') return;
  const clean = stripEmoji(text);
  if (!clean) return;
  stopSpeak();
  const my = ++seq;
  const [first, rest] = splitFirst(clean);

  // 첫 문장과 나머지를 동시에 합성 시작 → 짧은 첫 문장이 먼저 도착해 바로 재생
  const restP = rest ? synth(rest, opts?.voice) : Promise.resolve<string | null>(null);
  const firstUrl = await synth(first, opts?.voice);
  if (my !== seq) { revoke(firstUrl); revoke(await restP); return; }

  if (!firstUrl) { revoke(await restP); fallbackSpeak(clean); return; } // 최후엔 구형 음성이라도

  await playUrl(firstUrl);
  revoke(firstUrl); if (curUrl === firstUrl) curUrl = null;
  if (my !== seq) { revoke(await restP); return; }

  const restUrl = await restP;
  if (!restUrl) return;
  if (my !== seq) { revoke(restUrl); return; }
  await playUrl(restUrl);
  revoke(restUrl); if (curUrl === restUrl) curUrl = null;
}
