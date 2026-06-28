// SNS 자동게시 클라이언트 래퍼. 실제 Outstand 호출/키는 서버 함수(netlify/functions/sns-post)가 처리.
// 실패해도 throw 안 함(리뷰 등록을 막지 않는다).
// TODO(멀티테넌트): Outstand가 tenant_id 필터를 무시해 org 전 계정에 게시될 수 있음(기존 이슈). 단일 매장 단계라 보류.

export interface SnsPostResult {
  success: boolean;
  postedNetworks: string[];
}

export async function postReviewToSns(params: {
  storeId: string;
  content: string;
  mediaUrls?: string[];
  networks?: string[]; // 비우면 연결된 모든 채널
}): Promise<SnsPostResult> {
  try {
    const res = await fetch('/.netlify/functions/sns-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) return { success: false, postedNetworks: [] };
    return { success: true, postedNetworks: Array.isArray(data.postedNetworks) ? data.postedNetworks : [] };
  } catch {
    return { success: false, postedNetworks: [] };
  }
}
