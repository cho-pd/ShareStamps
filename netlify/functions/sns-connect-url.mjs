// 점주가 자기 SNS를 연결할 OAuth URL 생성. tenant_id = 매장ID 로 멀티테넌트 분리.
import { outstand, json, parseBody, VALID_NETWORKS } from './_outstand.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  const { storeId, network } = parseBody(event);
  if (!storeId || !network) return json(400, { error: 'storeId, network 필요' });
  if (!VALID_NETWORKS.includes(network)) return json(400, { error: `지원하지 않는 네트워크: ${network}` });

  const r = await outstand(`/social-networks/${network}/auth-url`, {
    method: 'POST',
    body: { tenant_id: storeId },
  });
  if (!r.ok || !r.data?.success) {
    return json(r.status || 502, { error: r.data?.error || 'auth-url 생성 실패', details: r.data });
  }
  return json(200, { authUrl: r.data.data.auth_url });
};
