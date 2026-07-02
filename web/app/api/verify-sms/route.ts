// 전화번호 인증 문자 발송 — SMS 게이트웨이(예: Twilio) 연동 전에는 testMode로 응답해
// 클라이언트가 코드를 화면에 표시(테스트 모드 라벨)하고 흐름을 끝까지 검증할 수 있게 한다.
// 게이트웨이 연동 시: 환경변수(TWILIO_SID 등) 설정 → 실제 발송 + testMode 제거.

export async function POST(req: Request) {
  let phone = ''; let code = '';
  try { const b = await req.json(); phone = b?.phone || ''; code = b?.code || ''; } catch {}
  if (!phone || !code) return Response.json({ ok: false, error: 'phone and code required' }, { status: 400 });

  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    // 게이트웨이 미연동 — 테스트 모드 (클라이언트가 코드를 표시)
    return Response.json({ ok: true, testMode: true });
  }

  try {
    const body = new URLSearchParams({ To: `+1${phone.slice(-10)}`, From: from, Body: `[ShareStamps] 인증 코드: ${code}` });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) return Response.json({ ok: false, error: 'sms send failed' }, { status: 502 });
    return Response.json({ ok: true, testMode: false });
  } catch {
    return Response.json({ ok: false, error: 'sms send failed' }, { status: 502 });
  }
}
