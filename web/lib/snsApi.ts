// SNS 자동게시 클라이언트 래퍼. 실제 Outstand 호출/키는 서버 라우트(web/app/api/sns-*)가 처리.
// 프런트는 이 얇은 래퍼로 그 라우트만 부른다(키는 절대 번들에 안 들어옴).
// TODO(멀티테넌트, S4): Outstand가 tenant_id 필터를 무시해 org 전 계정에 게시될 수 있음.
//   게시 직전 tenant 소유 재검증은 2주차 과제. (docs/SNS-REBUILD.md §8.2)

// 매장 SNS 플랫폼 메타(Outstand network enum ↔ 라벨/아이콘). 한 곳에서 관리.
// 이건 "리뷰 자동배포(팬아웃)" 대상 채널 집합이다.
// ⚠️ 구글(google_business)은 여기 넣지 않는다: GBP는 리뷰 UGC 자동 재게시 금지(정책, docs/AEO-STRATEGY.md §5).
//    구글은 자동 팬아웃이 아니라 별도 "구글 어시스트"(점주 하루 1회 직접 게시)로만 다룬다.
export interface SnsPlatformMeta {
  network: string; // Outstand network enum (연결/게시 식별)
  label: string;
  icon: string;
}

export const SNS_PLATFORMS: SnsPlatformMeta[] = [
  { network: 'instagram', label: 'Instagram', icon: '📸' },
  { network: 'facebook', label: 'Facebook', icon: '🔵' },
  { network: 'threads', label: 'Threads', icon: '💬' },
  { network: 'youtube', label: 'YouTube', icon: '🔴' },
  { network: 'tiktok', label: 'TikTok', icon: '🎵' },
  { network: 'linkedin', label: 'LinkedIn', icon: '💼' },
];

export const labelOf = (network: string): string =>
  SNS_PLATFORMS.find((p) => p.network === network)?.label || network;
export const iconOf = (network: string): string =>
  SNS_PLATFORMS.find((p) => p.network === network)?.icon || '🔗';

// 점주 OAuth 연결 URL 생성 → 호출부에서 새 창으로 연다.
export async function requestSnsConnectUrl(storeId: string, network: string): Promise<string> {
  const res = await fetch('/api/sns-connect-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId, network }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.authUrl) throw new Error(data?.error || '연결 URL 생성 실패');
  return data.authUrl as string;
}

export interface SnsStatus {
  count: number;
  connectedNetworks: string[];
  accounts: { id: string; network: string; name: string }[];
}

// 매장(tenant_id)에 실제로 연결된 SNS 계정 상태.
export async function fetchSnsStatus(storeId: string): Promise<SnsStatus> {
  const res = await fetch(`/api/sns-status?storeId=${encodeURIComponent(storeId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '상태 조회 실패');
  return {
    count: data.count || 0,
    connectedNetworks: data.connectedNetworks || [],
    accounts: data.accounts || [],
  };
}

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
    const res = await fetch('/api/sns-post', {
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
