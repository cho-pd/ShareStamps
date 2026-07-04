# 구글 오더링 시스템 도입 검토 — 3팀 통합 조사 (2026-07-04)

> 왓슨(기술 총괄) · 헌터(시장조사) · 알프레드(전략·카피) 3팀 병렬 조사 결과.
> 관련: [VISION.md](VISION.md) §B4·§D2-6, [AI_ORDERING_PLAN.md](AI_ORDERING_PLAN.md).

## TL;DR

- **구글은 엔진으로 채택 — 단 `Gemini Live API`(네이티브 오디오)만.** Dialogflow CX·"Order with Google"은 폐기.
- **"구글 사용" 대외 홍보는 반대.** 샤비가 얼굴, 구글은 엔진룸. (점주 계약용 신뢰 배지로만 절제.)
- **오더링을 통짜로 사지 말고 좋은 부분만 조립:** 엔진=Gemini(Live) · 주문유입=구글 비즈니스 프로필 "주문 링크" 소유 · AEO=별 트랙(멀티엔진 GEO).

---

## 1. 왓슨 — 기술 타당성 (총괄)

"구글 오더링"은 세 층이며 통짜가 아니라 층별로 판정한다:

- **대화 엔진:** PoC·초기는 **raw Gemini(현행) 유지**. Dialogflow CX는 요청당 과금·콘솔 운영부담·락인·"관계형 기억 대화"와 결 불일치로 **보류**.
- **음성 STT:** 구글 **Chirp**(한/영 85+개어)도 후보였으나 → 헌터가 더 날카롭게: **Gemini Live가 네이티브 오디오라 STT 자체가 불필요**. (계획서 Open Q2 소멸.)
- **주문 유입:** **"Order with Google" 직접주문은 2024.7 종료(redirect-only)** → 구글 안에서 주문받지 말고 **비즈니스 프로필 "주문 링크"를 우리 미니홈피로 소유**("Preferred by Business" 뱃지 = 클릭 4배).
- **락인:** Gemini/STT는 GCP 종속이나 이미 Firebase/Gemini로 GCP 안 + `orderPromptBuilder` 추상화 뒤에 두면 교체 가능. CX 깊게 쓰면 그때 진짜 락인 → 보류가 유리.

## 2. 헌터 — "구글이 최고의 선택인가?" (조건부 예)

- **엔진 승자 = 구글 `Gemini Live API`.** 이유는 **"AEO 시너지"가 아니라 기존 스택 통합·한/영 다국어·개발속도·비용**. (계획서가 지목한 Dialogflow CX 아님.)
- **AEO 시너지 착각 정정:** "구글 오더링 = 검색 노출 유리"는 **거짓**. GEO는 이제 ChatGPT·Perplexity·Claude·AI Overviews **멀티엔진** 게임이고, 노출은 schema.org·FAQ·콘텐츠가 좌우.
- **비용(대략):** Gemini $0.30/1M in·$2.50/1M out. OpenAI Realtime는 오디오가 비쌈($32/$64 per 1M). SoundHound/Lex는 대형체인·AWS용 → sss엔 과함, 제외.
- **리스크:** Live 세션 15분 제한(재개 배선), 프리뷰 모델 회전(안정판 고정), **클라 키 노출(서버 프록시 필수)**, Dialogflow CX 락인.

## 3. 알프레드 — 고객 득실 + "구글 홍보" 판정

- **점주 득:** 단골 기억·환대(인건비보다 이게 먼저), 공짜 마케팅 자동화(1세 영어 부담 저격), 피크 응대. **실:** 초기 학습부담(온보딩이 승부처), 한/영 혼용 오인식 신뢰 붕괴, 프라이버시 책임.
- **손님 득:** 개인화 환대(69% 선호), 스탬프 보상. **실:** 음성 어색함(→음성 옵션·텍스트 기본), 감시 정서(2세 예민), 오인식.
- **핵심:** 순이득이지만 원천은 "자동주문"이 아니라 **"기억·환대·공짜 마케팅"**.
- **"구글 사용" 홍보 = 조건부 반대.** ①주인공이 샤비→구글로 잠식 ②"동네편·언더독" 포지션과 충돌 ③종속·프라이버시 역풍 ④경쟁사도 다 "빅테크 기반"이라 차별화 안 됨. → **엔진은 뒤, 샤비는 앞.** 신뢰 배지로만 절제 허용.
- **카피 앵글(한/영):** A "손님 취향, 사장님 대신 샤비가 외웁니다 / Sharbee remembers your regulars" · B "주문 한 번이 홍보 열 번 / One order, ten posts — in perfect English" · C "대기업 앱은 대기업 편, 샤비는 동네 편" · D(점주 신뢰, 구글 각주) "얼굴은 샤비, 엔진은 세계 최고 클라우드" · E "스탬프 하나가 단골이 되고, 홍보가 되고, 기부가 됩니다".

---

## 4. 실행 로드맵

1. **PoC:** Gemini 텍스트 주문(계획서 §1~4) — **서버 함수 경유 프록시**.
2. **음성:** Gemini Live API(별도 STT 불필요), 안정판 고정·세션 재개.
3. **포지셔닝:** 샤비 전면(앵글 A/B/C/E), 구글은 점주용 각주(D).
4. **AEO 별 트랙:** schema.org·FAQ·멀티엔진 배포.

## 5. 선행조건 — D3(SNS 실연동) 현황 점검 (왓슨, 2026-07-04)

오더링을 얹기 전 "주문→콘텐츠→SNS" 뒷단이 실제 도는지 확인함:

- ✅ **배선은 실연동(stub 아님).** 리뷰 등록 → `web/lib/snsApi.ts` `postReviewToSns()` → `POST /api/sns-post` (`web/app/api/sns-post/route.ts`) → **Outstand API**. 호출부: `web/app/store/[slug]/ReviewForm.tsx`, `SharbeeReview.tsx`.
- ⚠️ **텍스트 전용 — 미디어(사진/영상)가 SNS에 안 실림.** 두 호출부 모두 `mediaUrls`를 안 넘김(route는 지원하나 caller가 미전달). **§D2의 "사진 2장·15초 영상"이 아직 SNS로 안 나감 → D2 루프의 핵심 구멍.**
- ⚠️ **환경변수 이관 리스크:** `OUTSTAND_API_KEY`가 서버 env에만 있어야 하는데, 주석은 아직 "Netlify Function" 기준. **Vercel env에 설정됐는지 확인 필요**(없으면 500 "OUTSTAND_API_KEY not set"). 과거 노출 이력으로 **재발급도 필요**(CLAUDE.md §4).
- ⚠️ **멀티테넌트 누수(미해결):** Outstand가 `tenant_id` 필터를 무시해 org 전 계정에 게시 가능. 단일 매장 단계라 보류 중.
- ⚠️ **Firebase Storage 의존:** 미디어 공개 URL이 있어야 SNS(특히 인스타) 게시 성공.

**결론:** D3은 "텍스트는 라이브, 미디어·다매장은 미완". 오더링 전에 **(a) 미디어 URL을 SNS에 싣도록 caller 배선, (b) Vercel OUTSTAND_API_KEY 설정·재발급 확인**이 선행돼야 §D2 서사가 거짓말이 안 됨.

---

## 출처 (주요)
- 구글 주문 축소(redirect-only): https://get.beyondmenu.com/blog/own-your-google-food-ordering/ , https://www.restaurantbusinessonline.com/technology/google-scale-back-its-restaurant-ordering-feature
- Gemini Live API(네이티브 오디오·다국어): https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-live-api
- Gemini 가격: https://ai.google.dev/gemini-api/docs/pricing
- Dialogflow CX/Conversational Agents 가격: https://cloud.google.com/products/conversational-agents/pricing
- Chirp 3 STT: https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3
- OpenAI Realtime 가격: https://openai.com/index/introducing-gpt-realtime/
- 멀티엔진 GEO/AEO: https://www.jasper.ai/blog/geo-aeo
- "Preferred by Business" 4배: https://get.beyondmenu.com/blog/own-your-google-food-ordering/

> 신뢰도: 벤더(Loman·Hostie 등) ROI·업셀 수치는 자체 데이터라 낙관 편향 가능. McD 철수·Presto 붕괴·구글 주문 축소는 CNBC·SEC·업계지로 교차확인된 사실.
