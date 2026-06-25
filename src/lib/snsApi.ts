// Outstand SNS 연동 클라이언트. 실제 Outstand API 키/호출은 Netlify 함수(netlify/functions/sns-*.mjs)가
// 서버에서 다루고, 프런트는 이 얇은 래퍼로 그 함수들만 부른다. (키는 절대 번들에 들어오지 않음)
// 업체를 갈아타도 함수 + 이 파일만 바꾸면 되도록 한 곳에 모은다.

const FN_BASE = '/.netlify/functions';

// 매장 SNS 설정 토글 키 ↔ Outstand network enum ↔ review.snsShared 키 매핑(한 곳에서 관리).
// 주의: 구글은 Outstand에서 `google_business` (언더스코어).
export interface SnsPlatformMeta {
  network: string;      // Outstand network enum (게시/연결 식별)
  settingKey: string;   // store.snsSettings 의 토글 키
  shareKey: string;     // review.snsShared 의 키
  label: string;
  icon: string;
}

export const SNS_PLATFORMS: SnsPlatformMeta[] = [
  { network: 'facebook', settingKey: 'facebookEnabled', shareKey: 'facebook', label: 'Facebook', icon: '🔵' },
  { network: 'instagram', settingKey: 'instagramEnabled', shareKey: 'instagram', label: 'Instagram', icon: '📸' },
  { network: 'threads', settingKey: 'threadsEnabled', shareKey: 'threads', label: 'Threads', icon: '💬' },
  { network: 'linkedin', settingKey: 'linkedinEnabled', shareKey: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { network: 'youtube', settingKey: 'youtubeEnabled', shareKey: 'youtube', label: 'YouTube', icon: '🔴' },
  { network: 'tiktok', settingKey: 'tiktokEnabled', shareKey: 'tiktok', label: 'TikTok', icon: '🎵' },
  { network: 'google_business', settingKey: 'googleEnabled', shareKey: 'google', label: 'Google Business', icon: '🏢' },
];

const networkToShareKey = (network: string): string =>
  SNS_PLATFORMS.find((p) => p.network === network)?.shareKey || network;

// ──────────────────────────────────────────────────────────────────────────
// 로컬 개발 전용 목(mock). `npm run dev`(import.meta.env.DEV)에서만 동작하며
// 프로덕션 빌드에선 DEV=false 라 아래 분기가 전부 죽은 코드로 제거된다.
// → 운영 Outstand/키를 전혀 건드리지 않고 대시보드 연동·게시 흐름을 로컬에서 클릭해볼 수 있게 한다.
// 연결 상태는 localStorage 에 매장별로 흉내낸다.
// ──────────────────────────────────────────────────────────────────────────
const DEV = import.meta.env.DEV;
const MOCK_KEY = (storeId: string) => `sns_mock_connected_${storeId}`;
const readMockConnected = (storeId: string): string[] => {
  try { return JSON.parse(localStorage.getItem(MOCK_KEY(storeId)) || '[]'); } catch { return []; }
};
const writeMockConnected = (storeId: string, networks: string[]) => {
  localStorage.setItem(MOCK_KEY(storeId), JSON.stringify([...new Set(networks)]));
};

// 매장 설정에서 "켜진" 네트워크의 Outstand enum 목록 (자동게시 대상 후보)
export const enabledNetworks = (snsSettings?: Record<string, boolean>): string[] => {
  if (!snsSettings) return [];
  return SNS_PLATFORMS.filter((p) => snsSettings[p.settingKey]).map((p) => p.network);
};

// 점주 OAuth 연결 URL 생성 → 호출부에서 새 창으로 열기
export async function requestSnsConnectUrl(storeId: string, network: string): Promise<string> {
  if (DEV) {
    // 데모: 실제 OAuth 대신 해당 채널을 "연결됨"으로 표시하고, 안내 페이지 URL을 돌려준다.
    writeMockConnected(storeId, [...readMockConnected(storeId), network]);
    const label = SNS_PLATFORMS.find((p) => p.network === network)?.label || network;
    const html = `<body style="font-family:sans-serif;padding:40px;text-align:center"><h2>✅ ${label} 데모 연결 완료</h2><p>로컬 개발 모드입니다. 이 창을 닫고 대시보드에서 <b>↻ 새로고침</b>을 누르면 "연동됨"으로 표시됩니다.</p></body>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  }
  const res = await fetch(`${FN_BASE}/sns-connect-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId, network }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.authUrl) {
    throw new Error(data?.error || '연결 URL 생성 실패');
  }
  return data.authUrl as string;
}

export interface SnsStatus {
  count: number;
  connectedNetworks: string[];
  accounts: { id: string; network: string; name: string }[];
}

// 매장(tenant_id)에 실제로 연결된 SNS 계정 상태
export async function fetchSnsStatus(storeId: string): Promise<SnsStatus> {
  if (DEV) {
    const nets = readMockConnected(storeId);
    return {
      count: nets.length,
      connectedNetworks: nets,
      accounts: nets.map((n) => ({ id: `mock_${n}`, network: n, name: '데모 계정' })),
    };
  }
  const res = await fetch(`${FN_BASE}/sns-status?storeId=${encodeURIComponent(storeId)}`);
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
  postId?: string;
  // 실제로 게시 시도된 네트워크 → review.snsShared 형태로 변환해 저장
  snsShared: Record<string, boolean>;
}

// 리뷰를 매장의 연결된 채널에 자동 게시. 실패해도 throw 하지 않고 success:false 로 돌려준다
// (리뷰 등록 자체를 막으면 안 됨 / 로컬·미배포 환경에선 함수가 없어 그냥 실패).
export async function postReviewToSns(params: {
  storeId: string;
  content: string;
  mediaUrls?: string[];
  networks?: string[];
}): Promise<SnsPostResult> {
  if (DEV) {
    // 데모: 연결된(목) 채널 ∩ 요청 네트워크에 게시한 것으로 처리.
    const connected = readMockConnected(params.storeId);
    const targeted = (params.networks && params.networks.length ? params.networks : connected)
      .filter((n) => connected.includes(n));
    const snsShared: Record<string, boolean> = {};
    targeted.forEach((n) => { snsShared[networkToShareKey(n)] = true; });
    return { success: targeted.length > 0, postId: `mock_${Date.now()}`, snsShared };
  }
  try {
    const res = await fetch(`${FN_BASE}/sns-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      return { success: false, snsShared: {} };
    }
    const posted: string[] = Array.isArray(data.postedNetworks) ? data.postedNetworks : [];
    const snsShared: Record<string, boolean> = {};
    posted.forEach((n) => { snsShared[networkToShareKey(n)] = true; });
    return { success: true, postId: data.postId, snsShared };
  } catch {
    return { success: false, snsShared: {} };
  }
}
