# ShareStamps 재구축 — Next.js + AEO 토대 (진행 중)

> **왜:** VISION.md의 핵심(A2~B3, J)대로 **매장주가 계약하는 이유 = AEO/GEO 마케팅 엔진**.
> 기존 Vite SPA는 **해시 라우팅 + 클라이언트 렌더 + 제네릭 메타** 라 AI/크롤러에 매장별 콘텐츠가
> 전혀 안 잡힘 → 세일즈 약속(=AI가 매장을 인용)을 구조적으로 못 지킴. 그래서 **갈아엎는다.**

## 핵심 결정 (확정)
1. **프레임워크: Next.js (App Router).** 공개 SEO 페이지(SSR/ISR) + 무거운 인터랙티브 앱을 한 스택으로.
2. **호스트 중립으로 짓는다.** 당장은 Netlify, 나중에 Vercel 이전 — 그래서:
   - 서버 로직은 **Next API Route / Route Handler** 로 (Netlify functions 형식 금지).
   - 설정은 Next 규칙으로 (netlify.toml에 로직 박지 않기).
   - 환경변수는 Next 규칙(`NEXT_PUBLIC_*` = 클라 노출분만).
3. **데이터 모델 갈아엎기 (단일 Firestore 문서 폐기).** 가입 매장이 아직 없어 데이터 전부 폐기 가능.
   - `stores/{storeId}` — 프로필(이름·slug·카테고리·시간·주소·전화·설명·통화·보상·snsSettings·persona·sellingPoints)
   - `stores/{storeId}/menuItems/{id}` — 이름·가격·설명·signature·options(맵기/양 등 모디파이어)
   - `stores/{storeId}/reviews/{id}` — 별점·코멘트·photoUrl·createdAt
   - `stores/{storeId}/stampCards/{userId}`, `users/{userId}` 등 per-store/전역 분리
   - → SSR 친화적 + 멀티테넌트 + 기존 단일문서 동기화 버그 근절.
4. **URL 스킴 고정(링크 안 깨지게): `/store/{slug}`** (해시❌). QR이 이 path를 담는다. 이후 불변.
5. **렌더링: 매장 공개 페이지 = SSR/ISR.** `generateMetadata`로 매장별 메타/OG, 서버 HTML에 JSON-LD
   (`Restaurant`/`LocalBusiness` + `Menu` + `AggregateRating` + `Review` + `FAQPage`). `sitemap.ts` + `robots.ts`(AI봇 허용).

## 작업 순서 (phase)
- **P1 (진행 중): 공개 매장 페이지 AEO 토대** — `web/` Next 앱, 데이터 타입+접근층(현재 seed),
  `/store/[slug]` SSR/ISR + 스키마 + sitemap/robots. ← **매장주에게 파는 상품이라 1순위.**
- **P2: Firestore 실연결** — per-store 문서 읽기(서버), 점주 온보딩으로 메뉴/프로필 채우기.
- **P3: 인터랙티브 앱 이식** — 고객 PWA·점주 대시보드·키오스크·샤비(Gemini)·스탬프 로직을 Next로.
- **P4: SNS 함수 이식** — `netlify/functions/sns-*` → Next API Route(Outstand). 호스트 중립.
- **P5: 배포 전환 검토** — Netlify→Vercel(도메인·env·테스트). **배포는 매번 승인 후.**

## 안전장치
- 라이브(main)는 안 건드린다. 모든 작업은 `aeo-next-rebuild` 브랜치. 새 앱은 `web/` 서브디렉터리에서
  성장 → 완성 시 루트로 승격. **배포는 사용자 승인 전까지 안 함.**
- 기존 Vite 앱 로직(샤비·스탬프·SNS)은 **버리지 말고 이식**(재사용)한다.
