// 광고 배너 — 옛 CustomerPWA 상단 배너(16:4, 15초 자동순환) 복원.
export type AdBanner = {
  id: string;
  imageUrl: string;
  linkUrl?: string;
  status: 'active' | 'inactive';
  protected?: boolean; // 기본 보호 배너(조PD만 숨김/삭제)
  title?: string;
};

// 디폴트 보호 배너 — 코드 정의라 항상 존재. 조PD가 고치기 전엔 삭제되지 않음.
export const DEFAULT_ADS: AdBanner[] = [
  { id: 'ad_default_donation', imageUrl: '/ads/banner-donation.png', linkUrl: '/me', status: 'active', protected: true, title: '버리는 스탬프도 돈이 된다 — 기부왕이 되세요' },
  { id: 'ad_default_aeo', imageUrl: '/ads/banner-aeo.png', linkUrl: '/', status: 'active', protected: true, title: '검색마케팅은 죽었다 — AEO+GEO 마케팅' },
];
