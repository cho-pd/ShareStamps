// 샤비 Gemini 프록시 (Next API Route, 호스트 중립). 키는 서버 env GEMINI_API_KEY 에서만.
// Netlify Function(netlify/functions/sharbee.mjs)을 대체 — Vercel SSR에서 동작.
const GEMINI_MODEL = 'gemini-2.0-flash';

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  let prompt = '';
  let system = '';
  let model = GEMINI_MODEL;
  try {
    const b = await req.json();
    prompt = b?.prompt || '';
    system = b?.system || '';
    if (b?.model) model = String(b.model); // 테스트용 모델 override
  } catch {}
  if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 220 },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    return Response.json({ text });
  } catch {
    return Response.json({ error: 'gemini request failed' }, { status: 502 });
  }
}
