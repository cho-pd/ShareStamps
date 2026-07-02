// 영수증 금액 자동 추출 — 키오스크가 찍은 영수증 이미지를 Gemini 비전으로 읽어 최종 결제 총액만 반환.
// 고객/직원이 금액을 손으로 입력하지 않도록 스캔에서 자동 인식. 키는 서버 env GEMINI_API_KEY 에서만.
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'GEMINI_API_KEY not set', amount: null }, { status: 500 });

  let image = '';
  try { image = (await req.json())?.image || ''; } catch {}
  if (!image) return Response.json({ error: 'image required', amount: null }, { status: 400 });

  // dataURL(data:image/jpeg;base64,...) → mime + base64 분리
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(image);
  const mimeType = m ? m[1] : 'image/jpeg';
  const b64 = m ? m[2] : image;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0, maxOutputTokens: 16 },
          contents: [{
            parts: [
              { text: '이 영수증 이미지에서 고객이 실제 결제한 최종 총액(grand total)을 찾아 숫자만 출력해. 통화기호·콤마·설명 없이 숫자만(예: 23.50). 총액을 못 찾으면 정확히 null 이라고만 답해.' },
              { inlineData: { mimeType, data: b64 } },
            ],
          }],
        }),
      }
    );
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    const amount = Number.isFinite(num) && num > 0 ? num : null;
    return Response.json({ amount });
  } catch {
    return Response.json({ error: 'gemini request failed', amount: null }, { status: 502 });
  }
}
