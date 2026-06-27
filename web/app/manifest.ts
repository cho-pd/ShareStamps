import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

// PWA 매니페스트 (무설치 + 홈화면 추가). 네이티브 앱 아님 — AEO(크롤)와 무설치 동선을 위해 PWA 유지.
// TODO(P3): icon-192/512 PNG 추가 후 icons 채우기 (현재는 설치 프롬프트용 아이콘 미포함).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ShareStamps',
    short_name: 'ShareStamps',
    description: 'Local store loyalty + AI-discoverable store pages.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#6d28d9',
    icons: [],
  };
}
