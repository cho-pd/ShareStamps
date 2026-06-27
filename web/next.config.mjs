/** @type {import('next').NextConfig} */
// 호스트 중립(Netlify 지금 / Vercel 나중). Netlify 전용 설정을 여기 박지 않는다.
const nextConfig = {
  reactStrictMode: true,
  // STATIC_EXPORT=1 일 때만 정적 HTML 내보내기(스테이징 데모용). 평소엔 SSR/ISR 유지(P3 서버 기능).
  ...(process.env.STATIC_EXPORT === '1' ? { output: 'export' } : {}),
};

export default nextConfig;
