# AEO/GEO 전략 + 채널 허브 + 구글 어시스트 (AI 검색에 걸리게)

> 작성 2026-07-06. 조박사님 방향("먼저 만들기보다 AI 검색에 걸리는 큰 그림"). 헌터·알프레드·비너스 종합.
> SNS 자동배포([SNS-REBUILD.md](SNS-REBUILD.md))의 **상위 전략** — 팬아웃은 이 AEO 플라이휠의 한 부품.
> 제품 논리: [VISION.md](VISION.md) §B(AEO)·§D2(플라이휠).

## 0. 핵심 결론 (먼저)

- **AI 로컬 검색은 이미 현실.** 미국 소비자 **45%가 AI(ChatGPT·Gemini·Perplexity)로 로컬 매장을 찾는다**(1년 만에 6%→45%, 7.5배). 그런데 **리뷰 1,000+ 식당도 70.9%가 AI 추천에서 누락** — 리뷰 수가 아니라 **구조·인용가능성(citability)**이 관건. [Bloom Intelligence, ecommercetimes]
- **엔진마다 소스가 다르다 → 삼각 공략.** Gemini/AI Overviews=**GBP**, Perplexity=**Reddit·Yelp**, ChatGPT=**구조화 웹(스키마)**. 셋을 한 번에 채우는 게 판매 서사. [Search Engine Land, Medium/B.Charles]
- **Yelp = 로컬 AI 인용 절대강자**(식당 인용에서 경쟁사 총합보다 많음). 한인 매장도 확보 필수. [ppc.land, Foundation]
- **근거 수치:** 스키마 마크업이 AI 인용 페이지의 **61%**(자연검색 상위는 25%), **30일 내 갱신 3.2배 인용**(=우리 플라이휠이 태생적 강점), AI 인용 링크 **82%가 earned(제3자)**. [SEO Sherpa]
- **우리 구조가 AEO에 태생적으로 유리하다.** 리뷰가 계속 쌓임(신선도) + 미니홈 스키마 + 멀티채널 = VISION §D2가 이미 정조준. "마크업 없는 화면은 미완성"(VISION §I)이 정확한 원칙.

## 1. AEO/GEO 실행 체크리스트 (헌터)

### A. 미니홈 구조화 마크업 (schema.org JSON-LD) — 대부분 이미 구현됨(`web/lib/schema.ts`)
- [x] **Restaurant/LocalBusiness**: NAP·좌표·가격대·`hasMenu`·`review`·`aggregateRating`·`speakable` 존재. **✅ 2026-07-06 추가: 카테고리 기반 타입 분기(비식당=LocalBusiness, servesCuisine/hasMenu 제외) + `sameAs`(socialLinks→절대URL) 배선.**
- [x] **Review / AggregateRating**: 구현됨(실제 리뷰만).
- [x] **FAQPage**: 구현됨(점주 FAQ 우선, 없으면 자동생성 4문).
- [x] **MenuItem + Offer + image**: dish 단위 마크업 구현됨.
- [ ] **남은 것**: `sameAs`가 실제 값을 가지려면 **`Store.socialLinks`를 점주가 채워야** 함(§4 링크 허브 owner 입력 UI 필요). 필드·seed 샘플은 추가 완료. `openingHoursSpecification`(현재 `openingHours` 문자열)·`VideoObject`는 후순위.

### B. 엔티티 일관성 (NAP)
- [ ] 미니홈·GBP·Yelp·네이버·페북에서 상호·주소·전화 **문자열 완전 일치**.
- [ ] 모든 프로필 링크가 **미니홈을 가리키고**, 미니홈이 다시 전부를 가리킴(양방향 = 엔티티 신뢰 그래프).

### C. GBP 신호 (AI 로컬의 1번 소스)
- [ ] **주 2회 이상 점주 Update/사진 게시** ← **구글 어시스트(§3)로 습관화**. (S1 준수 — 리뷰 자동 재게시 아님)
- [ ] 모든 리뷰에 응답 · Q&A 셀프 시딩 · 카테고리/속성 완전 채우기 · 주문 링크=미니홈.

### D. 콘텐츠 구조 (AEO 문법)
- [ ] 미니홈 섹션 = **질문형 H2 + 직후 직답(40~60단어)**.
- [ ] 신선도 30일 내 갱신(플라이휠 자동 충족). 리뷰의 다양한 표현 = 롱테일 서브쿼리 커버.

### E. 어드미디어(earned, owned 밖 82%)
- [ ] **Yelp 프로필 클레임+최적화**(로컬 AI 인용 1위) · **TripAdvisor**(관광 상권) · 지역 **Reddit** 유기적 참여(Perplexity 대비, 자동 스팸 금물).

### F. 하지 말 것 (리소스 낭비/리스크)
- [ ] ❌ **`llms.txt`** — 2026 효과 무측정, 구글 공식 "불필요". **⚠️ 우리 web에 이미 `/llms.txt` 라우트 존재** — 유지는 무해하나 여기 확장 투자 금지. schema+신선도+GBP로 전환. [Limy.ai, Flowtivity]
- [ ] ❌ GBP 리뷰 UGC 자동 재게시(S1) · ❌ "평점 관리/좋은 리뷰만"(진정성·GBP 정책 위반).

## 2. 링크 가능한 "모든" 채널 지도 (헌터)

### (a) 자동게시 가능 — Outstand 11종 (온보딩 문제, 코드 아님)
Instagram(이미지필수·JPEG·4:5~1.91:1) · Facebook Page(가장 관대) · Threads(500자) · X(280자, API 변동성) · LinkedIn(B2B, 로컬 후순위) · YouTube(영상필수) · TikTok(영상필수) · Pinterest(이미지필수, 비주얼 F&B 유효) · **Google Business(⚠️ 자동 금지, 포스트 전용 — §3으로)** · Bluesky(후순위) · Vimeo(영상전용).
**팬아웃 실전 우선순위:** Instagram > Facebook > Threads > Pinterest > (GBP는 어시스트) > X.

### (b) 자동 불가, "링크/수동"은 가능 — 미니홈이 허브
| 우선 | 채널 | 왜 (한인·미국) |
|---|---|---|
| ★★★ | **Google Business** | AI 로컬 1번 소스(Gemini·AI Overviews) |
| ★★★ | **Yelp** | 로컬 AI 인용 절대강자 |
| ★★★ | **KakaoTalk 채널** | 1세 한인 85% 일사용·오픈율 70%+, unified API 밖 = 차별화 |
| ★★ | **네이버(플레이스·블로그)** | 관광·유학·주재원 타겟 |
| ★★ | **TripAdvisor** | 관광 상권, Yelp 다음 식당 인용 |
| ★★ | **Reddit** | Perplexity가 강하게 인용(유기적 참여만) |
| ★ | Snapchat(영상중심, 링크 노드만) · WhatsApp Business · Telegram/LINE | 상권별 선택 |

## 3. 구글 어시스트 (알프레드 전략 + 비너스 UX)

**개념:** 구글은 자동 게시 안 함(S1). 대신 **AI(샤비)가 '오늘의 GBP 포스트' 초안을 써주고 점주가 하루 1번 원클릭/복붙 게시.** GBP 신선도(§1-C)를 자동화 리스크 없이 매일 갱신 = AEO 급소. 점주는 **창작자가 아니라 결재자.**

### 3.1 콘텐츠 전략 (알프레드)
- **하루치 포스트 템플릿 7종**(소스 필드 명시): ①오늘의 메뉴 ②최신 리뷰 인용(S1 안전) ③프로모(Offer) ④시즌/이벤트 ⑤시그니처 스포트라이트 ⑥사장님 한마디(정서) ⑦비식당 서비스업. +백로그 2종(Q&A형·기부 스토리).
- **습관화 훅:** 🔥스트릭(연속 게시일=신선도 손실회피) · "3분이면 끝(초안이 이미 써져 있음, 빈칸 공포 제거)" · 아침 넛지+전날 노출 증거(GBP Insights 실측만).
- **AEO 카피 원칙:** 지역명+카테고리 자연스럽게 · 질문형 심기 · 구체 명사/숫자(AI 발췌 용이) · **최상급은 손님 후기로만 인용**("풀러튼 최고" 자칭 ❌ → "최고라고들 하세요" ⭕) · 한 포스트=한 메시지.
- **가치제안:** *"구글이 우리 가게를 잊지 않게, 하루 3분. 샤비가 글은 다 써뒀어요."*

### 3.2 UX (비너스)
- **위치:** owner `minihome` 탭, 자동배포 패널 **바로 위**("매일 손 가는 것"을 먼저). honey 톤+샤비 얼굴로 자동배포와 **시각 구분**.
- **카드:** 스트릭 배지 🔥 → "오늘 아직 안 올렸어요" amber 리마인드 → AI 초안 textarea(편집) + 사진 첨부 + "🔄 다른 초안"(`/api/sharbee` 재사용) → **[📋 복사] + [구글에서 올리기 →](딥링크)**. 게시는 **자기신고**(GBP API 미사용)로 스트릭 +1.
- **데이터 계약:** store 문서에 `gbpStreak?: number`, `gbpLastPostedAt?: string`, `gbpTodayDraft?: string`. 딥링크 `https://business.google.com/posts`.

## 4. 링크 허브 (비너스 — 손님 미니홈)

- **위치:** 손님 `store/[slug]/page.tsx` "Hours & Contact"(라인 115) 아래. Linktree식 풀폭 버튼 ❌ → **절제된 4열 아이콘 그리드**(우리는 매장 미니홈, 링크는 보조).
- **단일 액센트:** 중립 흰 타일 + zinc 텍스트(브랜드색 8개 튀는 것 금지, 아이콘만 색). 퍼플 안 씀(발견용).
- **플랫폼:** IG·FB·Threads·TikTok·YouTube·Snapchat·**카카오·네이버**·Yelp·Google·홈페이지. (한인 채널 필수)
- **점주 입력:** owner minihome에 별도 "링크 허브" 카드(URL 입력). **자동배포 패널과 통합 금지**(연결계정 vs 표시URL 성질 다름).
- **🔴 데이터 계약(선행 필수):** `web/lib/stores.ts`의 `Store`에 **SNS 링크 URL 필드가 하나도 없음.** `snsChannels`(플래그)는 재사용 불가 → **`socialLinks?: Partial<Record<PlatformKey, string>>` 신규 필드** 추가해야 링크 허브가 성립.

## 5. 🔧 P0 코드 정합성 교정 (비너스 지적)

방금 착수한 P0 자동배포 패널([snsApi.ts](../web/lib/snsApi.ts) `SNS_PLATFORMS`, [dashboard](../web/app/owner/dashboard/page.tsx))에 **`google_business`가 자동배포 연결 채널로 들어가 있음.** 이번 결정(구글=어시스트 전용, 자동 금지)과 충돌 → **자동 팬아웃 리스트에서 `google_business` 제거** 필요. 두면 "구글도 자동으로 나간다"는 거짓 UX(B3 함정 재발). 구글은 §3 어시스트 카드로만.

## 6. 실행 우선순위 (업데이트)

이번 방향은 **"AI 검색 노출"이 목적, 팬아웃·어시스트·링크허브·스키마가 수단.** 순서 제안:
1. ✅ **P0 정합성 교정** — 자동배포 세트(`SNS_PLATFORMS`)에서 `google_business` 제거 완료(2026-07-06).
2. ✅ **schema.org 강화**(§1-A) — 타입 분기 + `sameAs` 배선 완료. `Store.socialLinks` 필드 추가. (실제 sameAs 값은 4번 대기)
3. ✅ **구글 어시스트 MVP**(§3) — 완료(2026-07-06): owner minihome 최상단 "오늘의 구글 포스트" 카드. `/api/sharbee`(Gemini)로 초안 생성 + 편집 + [복사]/[구글에서 올리기 딥링크] + 자기신고 🔥스트릭. store 문서에 `gbpStreak/gbpLastPostedAt/gbpTodayDraft`. tsc/build 통과, 런타임은 인증·prod쓰기라 미검증(배포/스테이징서). **후속:** 자동 초안 생성(오픈 시), 이미지 첨부, 아침 넛지, overview 미러 넛지.
4. ✅ **링크 허브**(§4) — 완료(2026-07-06): `web/lib/socialLinks.ts`(공유 메타) + 손님 미니홈 아이콘 그리드(`store/[slug]/page.tsx`) + 점주 입력 카드(owner minihome). **socialLinks 입력 시 §1-A schema `sameAs`도 자동 활성화.** 값은 점주 입력 대기.
5. **NAP 일관성 + Yelp/GBP 온보딩**(§1-B/E) — 점주 온보딩 플로우에 내장("깜짝 놀라게").
6. SNS 자동배포 P1(fire-and-forget·S4·S2)은 [SNS-REBUILD.md](SNS-REBUILD.md) §7 그대로 병행.

## 남은 팀 후속 (착수 전 확정 가능)
- **헌터+알프레드:** 구글 어시스트 초안 생성 프롬프트 사양(요일·시그니처·시즌 반영) / 미니홈 schema JSON-LD 템플릿 확정.
- **비너스:** 링크 허브 브랜드 모노 SVG 아이콘 세트.

## 출처
Bloom Intelligence · ecommercetimes · ppc.land · Foundation · Search Engine Land · SEO Sherpa · Medium(B.Charles) · rocketdriver · AgencyJet · Limy.ai · Flowtivity · WitsCode · Snap Public Profile API. (헌터 브리핑 원문 링크 참조)
