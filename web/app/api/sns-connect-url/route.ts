// 점주가 자기 SNS를 연결할 OAuth URL 생성. tenant_id = 매장ID 로 멀티테넌트 분리.
// (Netlify sns-connect-url.mjs 의 Next API Route 버전)
import { outstand, VALID_NETWORKS } from '@/lib/outstand';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { storeId, network } = body as { storeId?: string; network?: string };
  if (!storeId || !network) return Response.json({ error: 'storeId, network required' }, { status: 400 });
  if (!VALID_NETWORKS.includes(network)) return Response.json({ error: `unsupported network: ${network}` }, { status: 400 });

  const r = await outstand(`/social-networks/${network}/auth-url`, { method: 'POST', body: { tenant_id: storeId } });
  const d = r.data as { success?: boolean; data?: { auth_url?: string }; error?: string };
  if (!r.ok || !d?.success || !d?.data?.auth_url) {
    return Response.json({ error: d?.error || 'auth-url failed', details: r.data }, { status: r.status || 502 });
  }
  return Response.json({ authUrl: d.data.auth_url });
}
