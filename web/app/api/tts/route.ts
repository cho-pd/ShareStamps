// 샤비 음성 합성 프록시 — Gemini 신경망 TTS(제미나이급 자연 음성). 키는 서버 env GEMINI_API_KEY.
// Gemini TTS는 PCM(16bit mono, 기본 24kHz)을 base64로 돌려준다 → 서버에서 WAV로 감싸 재생 가능하게 반환.
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE = 'Leda'; // 밝고 젊은 여성 톤 — 귀여운 꿀벌 '샤비'에 어울림

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const blockAlign = (channels * bits) / 8;
  const byteRate = sampleRate * blockAlign;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bits, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  let text = '';
  let voice = DEFAULT_VOICE;
  try {
    const b = await req.json();
    text = (b?.text || '').toString().slice(0, 800);
    if (b?.voice) voice = String(b.voice);
  } catch {}
  if (!text.trim()) return Response.json({ error: 'text required' }, { status: 400 });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      }
    );
    const data = await r.json();
    const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!part?.data) return Response.json({ error: 'no audio', detail: data?.error?.message ?? null }, { status: 502 });

    // mimeType 예: "audio/L16;codec=pcm;rate=24000" → 샘플레이트 추출
    const rate = Number(/rate=(\d+)/.exec(part.mimeType || '')?.[1]) || 24000;
    const pcm = Buffer.from(part.data, 'base64');
    const wav = pcmToWav(pcm, rate);
    return new Response(new Uint8Array(wav), {
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'tts request failed' }, { status: 502 });
  }
}
