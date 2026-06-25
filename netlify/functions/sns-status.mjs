// 특정 매장(tenant_id)에 연결된 SNS 계정 목록 → 대시보드 "진짜 연동 상태" 표시용.
import { outstand, json } from './_outstand.mjs';

export const handler = async (event) => {
  const storeId = event.queryStringParameters?.storeId;
  if (!storeId) return json(400, { error: 'storeId 필요' });

  const r = await outstand(`/social-accounts?tenant_id=${encodeURIComponent(storeId)}`);
  if (!r.ok) return json(r.status || 502, { error: '상태 조회 실패', details: r.data });

  // Outstand 계정 객체의 정확한 필드는 실제 연결 후 확정 (network/이름 후보를 방어적으로 매핑)
  const raw = Array.isArray(r.data?.data) ? r.data.data : [];
  const accounts = raw.map((a) => ({
    id: a.id,
    network: a.network || a.social_network || a.type,
    name: a.name || a.username || a.display_name || '',
  }));
  const connectedNetworks = [...new Set(accounts.map((a) => a.network).filter(Boolean))];
  return json(200, { count: accounts.length, connectedNetworks, accounts });
};
