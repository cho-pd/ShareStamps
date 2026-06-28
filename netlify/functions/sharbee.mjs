// 샤비 Gemini 프록시 (서버 전용). 키는 process.env.GEMINI_API_KEY 에서만 읽어 클라이언트에 노출 안 됨.
// 클라이언트는 완성된 prompt(메뉴/페르소나 — 비밀 아님)만 보내고, 키 부착은 서버가 한다.
// TODO(SSR/Vercel 전환): Next API Route(app/api/sharbee/route.ts)로 이관(호스트 중립).
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not set' }) };

  let prompt = '';
  try { prompt = JSON.parse(event.body || '{}').prompt || ''; } catch {}
  if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: 'prompt required' }) };

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
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) };
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'gemini request failed' }) };
  }
};
