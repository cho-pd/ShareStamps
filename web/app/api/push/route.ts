// 웹푸시 발송 API — 선물·점주지급·마케팅 캠페인 공용. VAPID 키는 서버 env 에서만.
// body: { deviceIds: string[], title, body, url?, tag? }  (대상 회원 deviceId 목록)
// 각 회원 customers/{id}.pushSub(브라우저 구독정보)를 Firestore REST로 읽어 발송.
import webpush from 'web-push';

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const PRIV = process.env.VAPID_PRIVATE_KEY || '';
const SUBJ = process.env.VAPID_SUBJECT || 'mailto:admin@sharestamps.com';
if (PUB && PRIV) webpush.setVapidDetails(SUBJ, PUB, PRIV);

const PROJECT = 'sharestamp-hcho-2606';
type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

async function getSub(deviceId: string): Promise<Sub | null> {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/customers/${deviceId}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    const raw = d?.fields?.pushSub?.mapValue?.fields;
    if (raw?.endpoint?.stringValue && raw?.keys?.mapValue?.fields) {
      return { endpoint: raw.endpoint.stringValue, keys: { p256dh: raw.keys.mapValue.fields.p256dh.stringValue, auth: raw.keys.mapValue.fields.auth.stringValue } };
    }
  } catch { /* skip */ }
  return null;
}

export async function POST(req: Request) {
  if (!PUB || !PRIV) return Response.json({ ok: false, error: 'VAPID keys not set' }, { status: 500 });
  let deviceIds: string[] = []; let title = ''; let body = ''; let url = '/me'; let tag: string | undefined;
  try { const b = await req.json(); deviceIds = b.deviceIds || []; title = b.title || 'ShareStamps 🐝'; body = b.body || ''; url = b.url || '/me'; tag = b.tag; } catch {}
  if (!deviceIds.length) return Response.json({ ok: false, error: 'deviceIds required' }, { status: 400 });

  const payload = JSON.stringify({ title, body, url, tag });
  let sent = 0; let failed = 0; let subscribed = 0;
  await Promise.all(deviceIds.map(async (id) => {
    const sub = await getSub(id);
    if (!sub) return;
    subscribed++;
    try { await webpush.sendNotification(sub as unknown as webpush.PushSubscription, payload); sent++; }
    catch { failed++; }
  }));
  return Response.json({ ok: true, targets: deviceIds.length, subscribed, sent, failed });
}
