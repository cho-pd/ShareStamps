// 샤비 Gemini 프록시 (Next API Route, 호스트 중립). 키는 서버 env GEMINI_API_KEY 에서만.
// Netlify Function(netlify/functions/sharbee.mjs)을 대체 — Vercel SSR에서 동작.
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  let prompt = '';
  try {
    prompt = (await req.json())?.prompt || '';
  } catch {}
  if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 160 },
          contents: [{ parts: [{ text: prompt }] }],
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
