// 매장 외부 채널 링크 메타(플랫폼키 ↔ 라벨/아이콘). 손님 미니홈 "링크 허브"와 점주 입력이 공유하는 단일 목록.
// 값(URL)은 Store.socialLinks 에 저장되고, schema.org `sameAs`(web/lib/schema.ts)도 이 값을 그대로 쓴다.
// ⚠️ 아이콘 이모지는 임시 — 출시 전 브랜드 모노 SVG로 교체 권장(OS별 렌더 편차).
export interface LinkPlatform {
  key: string;
  label: string;
  icon: string;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: LinkPlatform[] = [
  { key: 'instagram', label: 'Instagram', icon: '📸', placeholder: 'instagram.com/mystore' },
  { key: 'facebook', label: 'Facebook', icon: '🔵', placeholder: 'facebook.com/mystore' },
  { key: 'threads', label: 'Threads', icon: '💬', placeholder: 'threads.net/@mystore' },
  { key: 'tiktok', label: 'TikTok', icon: '🎵', placeholder: 'tiktok.com/@mystore' },
  { key: 'youtube', label: 'YouTube', icon: '🔴', placeholder: 'youtube.com/@mystore' },
  { key: 'snapchat', label: 'Snapchat', icon: '👻', placeholder: 'snapchat.com/add/mystore' },
  { key: 'kakao', label: '카카오톡', icon: '💛', placeholder: 'pf.kakao.com/_xxxxx' },
  { key: 'naver', label: '네이버', icon: '🟢', placeholder: 'naver.me/xxxx' },
  { key: 'yelp', label: 'Yelp', icon: '⭐', placeholder: 'yelp.com/biz/mystore' },
  { key: 'google', label: 'Google', icon: '🏢', placeholder: 'g.page/mystore' },
  { key: 'website', label: '홈페이지', icon: '🌐', placeholder: 'mystore.com' },
];

// 스킴 없는 입력도 클릭 가능한 절대 URL로. (schema.ts 의 sameAs 정규화와 동일 규칙)
export const toHref = (v: string): string => (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`);
