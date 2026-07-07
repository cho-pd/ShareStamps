// 특정 매장(tenant_id)에 연결된 SNS 계정 목록 → 대시보드 "진짜 연동 상태" 표시용.
// (Netlify sns-status.mjs 의 Next API Route 버전)
import { outstand } from '@/lib/outstand';

export async function GET(req: Request) {
  const storeId = new URL(req.url).searchParams.get('storeId');
  if (!storeId) return Response.json({ error: 'storeId required' }, { status: 400 });

  const r = await outstand(`/social-accounts?tenant_id=${encodeURIComponent(storeId)}`);
  if (!r.ok) return Response.json({ error: 'status lookup failed', details: r.data }, { status: r.status || 502 });

  // Outstand 계정 객체 필드는 방어적으로 매핑(network/이름 후보).
  // NOTE(S4): 게시 시 tenant 소유 재검증은 2주차 과제(docs/SNS-REBUILD.md §8.2). 여기선 표시용.
  const raw = Array.isArray((r.data as { data?: unknown }).data)
    ? (r.data as { data: Record<string, unknown>[] }).data : [];
  const accounts = raw.map((a) => ({
    id: a.id as string,
    network: (a.network || a.social_network || a.type) as string,
    name: (a.name || a.username || a.display_name || '') as string,
  }));
  const connectedNetworks = [...new Set(accounts.map((a) => a.network).filter(Boolean))];
  return Response.json({ count: accounts.length, connectedNetworks, accounts });
}
