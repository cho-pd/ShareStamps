# SNS 동시배포 재설계 스펙 (web/ Next.js) — "리뷰 1건 → 연결된 모든 SNS 팬아웃"

> 작성 2026-07-06. 옛 사이트(`src/` Vite)의 완성 구현을 새 사이트(`web/` Next.js)로 **안전하게 복원**하기 위한 실행 스펙.
> 전 팀원(왓슨·헌터·알프레드·비너스) 조사 + 코드 검토 종합. 벤더 API 사용법 원문은 [SNS-OUTSTAND.md](SNS-OUTSTAND.md) 참조.
> 이 문서는 **무엇을·왜·어떤 순서로** 다룬다. 다음 도구가 이걸 스펙으로 착수한다.

## 0. 한 문장 결론

**뇌(Outstand 1-POST 동시배포 엔진)는 `src/`에서 이미 검증됐고, `web/`엔 팔다리(연결·이미지·피드백·기록)만 안 붙어서 지금은 실제로 아무 데도 안 나간다.** 벤더 교체 문제가 아니라 **복원 + 안전장치** 문제다.

## 1. 현황: 옛 `src/`(완성) vs 새 `web/`(반쪽)

| 구성요소 | 옛 `src/` (Vite) | 새 `web/` (Next.js) | 조치 |
|---|---|---|---|
| 게시 API | `netlify/functions/sns-post.mjs` | ✅ `web/app/api/sns-post/route.ts` | 유지 |
| 채널 연결(OAuth) API | `sns-connect-url.mjs` | ❌ 없음 | **이식 (P0)** |
| 연결상태 조회 API | `sns-status.mjs` | ❌ 없음 | **이식 (P0)** |
| 프런트 래퍼 | `src/lib/snsApi.ts` (매핑·연결·상태·게시) | ⚠️ `web/lib/snsApi.ts` 는 `postReviewToSns` 하나뿐 | **확장 (P0)** |
| 점주 연결 UI | `OwnerDashboard.tsx` 실연결 패널 | ❌ 장식 토글뿐 | **교체 (P0)** |
| 게시결과 리뷰 기록 | `updateReviewSnsShared()` | ❌ 없음 | **추가 (P1)** |
| 리뷰 사진 업로드 | Firebase Storage 공개 URL | ❌ 파이프라인 없음 | **추가 (P1)** |

## 2. 반드시 고칠 결함 (취향 아님 · 버그)

### 🐛 B1. 연결 경로가 통째로 없음 → 실제로 아무 데도 안 나감 (최상위 블로커)
- 게시 라우트 `web/app/api/sns-post/route.ts:35` 는 `/social-accounts?tenant_id=storeId` 로 **이미 연결된 계정**만 조회해 게시한다. 연결된 게 없으면 `route.ts:42` 에서 `400 no connected SNS accounts` 로 끝.
- 그런데 `web/` 엔 계정을 **연결시키는** `sns-connect-url`·`sns-status` 라우트도, `web/lib/snsApi.ts` 의 연결/상태 함수도 없다 → 연결 채널 항상 0개.

### 🐛 B2. 손님이 18초 갇히고, 성공 메시지는 영원히 안 뜸
- `web/app/store/[slug]/ReviewForm.tsx:57` 와 `SharbeeReview.tsx:151` 이 `await postReviewToSns(...)` 로 **비동기 게시(7~18초) 완료까지 손님을 블로킹**한다.
- 게다가 연결 0개(B1)라 `postedNetworks` 가 항상 빈 배열 → `snsMsg` 가 영원히 null. 손님은 어디로도 안 갔는데 그 사실조차 모른다.

### 🐛 B3. 거짓 UX — 장식 토글
- owner 대시보드의 SNS 채널 토글(`web/app/owner/dashboard/page.tsx:1086~1094`)은 `snsChannels` 문자열만 store 문서에 저장한다. **Outstand 계정 연결과 무관.** 점주는 "인스타 켰다"고 착각하지만 연결계정은 0개. 실연결 패널로 교체할 때 이 낡은 필드도 정리(진실 소스 이원화 방지).

### 🐛 B4. `mediaUrls` 미전달 → 인스타 구조적 실패
- ReviewForm/SharbeeReview 둘 다 `postReviewToSns` 호출 시 `mediaUrls` 를 안 넘긴다 → 텍스트-only 게시 → 인스타(이미지 필수) 포함 게시 통째 실패. web/ 리뷰엔 사진 첨부 파이프라인 자체가 없음(선행 과제).

### ✅ 좋은 소식
- `storeId`(=`store.id`) 정합성은 이미 맞음 (`page.tsx:151-152`). tenant 키 체계로 삽질할 일 없음.
- Outstand `accounts:[id...]` **1-POST 다계정 동시게시** 엔진은 `route.ts:52` 에 이미 이식돼 살아있음.

## 3. 벤더 결정 (헌터) — "바꾸지 말고 고쳐라"

우리 프로파일 = **매장 多 · 매장당 프로필 3~7 · 건수 少**. 이 조합에서 결정 변수는 "프로필당 과금이냐, 정액이냐".

- **당장: Outstand 유지** (월 $19 / 3000건). 우리 프로파일에 가성비 최상.
- **회피: Ayrshare** — 프로필당 과금이라 우리 모델엔 가장 비싼 함정(100프로필 시 ~$1,229/월).
- **성장 시 2순위: bundle.social($100~ 정액·무제한 프로필) 또는 SocialAPI.ai($349/200브랜드)** — 매장 늘어도 비용 폭발 없음.
- **자체구축(Meta/Google 직접): 지금 하지 말 것** — 앱리뷰 2~4주 + 초기 $30K~80K + 분기별 breaking change. 손익분기 한참 아래(수백~수천 매장·고건수일 때만 역전).

→ **재설계의 진짜 과제는 벤더 교체가 아니라 멀티테넌트 누수 방어 + 안전장치.**

## 4. 출시 전 안전장치 (헌터 — 이번 연구의 진짜 수확)

| # | 안전장치 | 이유 | 조치 |
|---|---|---|---|
| S1 | **GBP는 리뷰 자동 재게시 금지** | 2026-04 GBP 정책 강화로 리뷰 UGC 자동 재게시는 스팸/조작 회색지대(대량 정지 사례) | 구글은 **점주 발신 포스트·social proof 용도로만**. 리뷰 팬아웃 본진은 **IG·FB** |
| S2 | **인스타 미디어 정규화** | IG는 **JPEG 전용 + 종횡비 4:5~1.91:1** 아니면 컨테이너 발행 통째 실패 | 팬아웃 직전 서버에서 **JPEG 변환 + 크롭**. `sns-post` 의 `guessContentType` 이 png/webp 통과시키는 함정 수정 |
| S3 | **동의 옵트인** | 리뷰어 저작권 + GBP "명시 동의" 요건 동시 충족 | 리뷰 작성 UI에 "SNS 게시 동의" 체크. 알프레드: **부담이 아니라 신뢰 마케팅**으로 프레이밍 |
| S4 | **멀티테넌트 누수 방어** | Outstand가 `tenant_id` 필터를 서버서 무시 → 2호점부터 남의 채널에 새어나감 | 팬아웃 직전 `accountIds` 가 해당 `storeId` 소유인지 **서버에서 재검증**. 2호점 온보딩 전 필수 |
| S5 | **네트워크별 문안 소폭 변주** | 동일 문구 동시 폭사 = 스팸 시그널 | 첫 문장·해시태그를 채널별로 살짝 다르게 |
| S6 | **유출된 OUTSTAND_API_KEY 재발급** | 과거 테스트로 유출됨 | **출시 직전 처리**(조박사님 결정, 2026-07-06). 재발급 → env 교체 |
| S7 | **blob/data URL 게시 차단** | 업로드 실패 시 blob URL이 다른 기기서 깨짐(CLAUDE.md §5) | 리뷰 사진은 `https://firebasestorage...` 공개 URL로만. blob/data 검증 차단 |

### 한인 특화 해자 (헌터)
- **카카오톡 채널** — 1세 한인 85% 일사용, 비즈니스 메시지 오픈율 70%+. unified API 미지원이라 **별도 연동 시 강력한 차별화**. 단 리뷰 팬아웃보다 **점주→단골 브로드캐스트(공지·프로모)** 용도. → 별도 백로그.

## 5. UX 설계 (비너스)

### 5.1 점주 채널 연결 — owner 대시보드 `minihome` 탭
- **위치:** 발견은 `overview` 탭 조건부 넛지 배너, **관리는 `minihome` 탭** (역할 분리).
- **패턴:** 옛 3열 그리드 ❌ → **리스트 row** (당근 Seed, DESIGN-SYSTEM §5). row 하나에 `[아이콘+라벨] · [연결 상태 배지] · [자동배포 토글] · [연결하기/다시연결]` **통합**(옛 구현의 "켜기"와 "연결" 분리 혼란 제거).
- **자동 상태갱신:** 옛 수동 `↻ 새로고침` ❌ → `연결하기` 새 창(OAuth) 후 **부모 창 폴링(3초 간격, 최대 60초) 또는 `postMessage`** 로 배지 자동 전환. ("연결했는데 미연결로 뜬다" 이탈 제거)
- **상태:** 연결중=해당 row만 `여는 중…`+스피너(전체 잠금 금지), 로딩=배지 자리 `…` 스켈레톤, 에러=카드 상단 얇은 `bg-red-50` 한 줄 + `다시 시도`.
- **단일 액센트:** `연결하기`(미연결)만 `.ss-btn-primary` 퍼플, `다시 연결`은 힘 빼기.
- **추가:** "최근 배포 3줄" 요약(리뷰 발췌+채널 아이콘+시각) = 점주가 "정말 나간다"를 확인하는 증거. 연결 계정 이름(`accounts[].name`) 표기.

### 5.2 손님 게시 피드백 — 리뷰 작성
- **원칙: 리뷰 등록 즉시 완료, 배포는 백그라운드.** `await postReviewToSns` **제거**(B2) → fire-and-forget.
- **흐름:** ① 리뷰 저장 성공 즉시 done 화면(스탬프 +1 축하가 주인공) ② 배포는 백그라운드 ③ done 카드 안 배포 줄 3단계: `📤 올리는 중…(Instagram·Facebook 등 N곳)` → `📣 N개 채널에 공유됐어요`(+채널 아이콘) → 실패.
- **실패 정책:** **손님에겐 조용히**(리뷰·스탬프는 이미 성공 — 빨간 에러로 성공 경험 오염 금지), **점주 대시보드엔 반드시 표시**("최근 배포"에 `⚠ 일부 실패·다시 시도"). 배포는 점주 자산.
- **미연결 매장:** 배포 줄 **아예 미표시**(있지도 않은 걸 "0개 공유"로 보여주지 말 것).

### 5.3 미연결 넛지 — `overview` 탭 상단 조건부 배너
- 연결 채널 0개일 때만: `.ss-card` + honey 좌측 액센트 바. 가치 문장 먼저("리뷰 한 번이면 우리 가게 SNS 전부에") + 퍼플 CTA `채널 연결하기 →`. 한 번 연결하면 배너 사라짐. 모달 아님(스캔 동선 보존).
- **⚠️ S1 정합성 (넛지·done·동의 전 카피 공통):** 사용자 대면 문구에서 **"리뷰가 Google에 자동으로 올라간다"고 약속하지 말 것.** GBP는 리뷰 자동 재게시 금지(S1) → 리뷰 팬아웃 본진은 **Instagram·Facebook**만 명시. 구글은 "매장 소식(점주 발신 포스트)"으로 별도 소구. (비너스 목업 초안의 "Instagram·Facebook·Google" 표기는 이 규칙으로 교정할 것)

## 6. 카피 / 세일즈 (알프레드)

- **전략 좌표:** 독립 상품 아님 → **플라이휠의 "확성기"**. `음성주문/방문 → 샤비 리뷰 → AI 미니홈 → ★팬아웃★ → AI검색 노출 → 재방문` (VISION §D2).
- **각도:** "SNS 자동화 도구"(레드오션) ❌ → **"손님 한 분이 우리 가게 마케팅팀"** ✅. 한인 3대 페인: 영어 부담·시간 0·계정 방치.
- **메인 카피:** *"영어 리뷰, 이제 손님이 알아서. 사장님은 장사만 하세요."*
- **랜딩 헤드라인:** *"손님 한 분이, 우리 가게 마케팅팀이 됩니다."*
- **성공 토스트(도파민):** *"🐝 방금 그 후기, 3곳에 동시에 올라갔어요."*
- **손님 동의(기본 ON, 투명):** *"☑️ 제 후기를 사장님 가게 SNS에도 실어도 좋아요"* + 이름 표기 선택(`김O영·단골손님·익명`).
- **🚨 진정성 가드레일 (제품 원칙으로 새길 값):** 전 카피에 "손님이 **직접** 남긴 **진짜** 후기를 **있는 그대로**" 반복. "좋은 리뷰만/별점 관리/평점 올려드립니다" 뉘앙스 **전면 금지**. 수치는 게시 횟수 팩트만(조회수로 부풀리지 말 것).
- **세대별 동의 카피(알프레드, §8):** 1세(한국어·정서)/1.5세(한·영 혼용)/2세(영어·캐주얼) 각각 옵트인+이름표기+완료문구 확정. 전 버전 공통: ① "인스타·페북"만 명시(S1) ② 진정성 3어("제가 쓴 그대로/word for word") 삽입 ③ "체크 풀어도 리뷰·스탬프는 그대로"로 동의를 보상 인질 삼지 않음.
- **랜딩 영어판:** *"One happy customer becomes your whole marketing team."* / 신뢰 앵커 *"No fakes, no filters — shared word for word."* (done 카피와 동일 어휘로 약속-경험 일치)

## 7. 실행 순서 — "안전한 복원(Safe Port)"

포팅(빠름·지뢰동반)도 재설계(느림)도 아닌 중간: 옛 배선을 되살리되 **§4 안전장치를 복원과 동시에** 심는다.

### 1주차 — P0 "실제로 나가게"
1. `outstand()` 헬퍼 공용 모듈화 → `web/app/api/sns-connect-url/route.ts` · `sns-status/route.ts` 2개 추가 (sns-post 패턴 그대로)
2. `web/lib/snsApi.ts` 확장 — `SNS_PLATFORMS`·`enabledNetworks`·`requestSnsConnectUrl`·`fetchSnsStatus` 이식 (DEV 목 제외)
3. owner 대시보드 장식 토글(B3) → **실연결 리스트 패널**(§5.1, 자동 상태갱신)
4. **게이트:** 페북 1채널로 실제 E2E 게시 눈으로 확인

### 2주차 — P1/P2 "제대로·안전하게"
5. 손님 게시 **fire-and-forget**(B2 제거) + done 카드 배포 진화(§5.2)
6. 리뷰 사진 업로드 → Storage 공개 URL(S7) → **미디어 정규화**(S2, 헌터 설계 §8) → `mediaUrls` 동봉(B4) → 인스타 살리기
7. **동의 옵트인**(S3, 알프레드 세대별 카피 §8) + `snsShared` 리뷰 기록
8. **멀티테넌트 누수 방어**(S4, 헌터 설계 §8 — S2보다 먼저 착수) + GBP 포스트 전용(S1) + 게시 상태 폴링(`GET /posts/{id}`)

> **우선순위 주의(헌터):** 2주차 안에서 **S4(누수 방어) → S2(미디어 정규화)** 순서. 누수는 신뢰·법적 리스크(남의 매장에 게시)라 fail-closed로 먼저 막고, 미디어는 fail-safe(실패한 것만 드롭). 방향이 반대인 이유 = "덜 나가도" 되지만 "잘못 나가면" 안 됨.

### 출시 직전
- OUTSTAND_API_KEY 재발급(S6).

## 8. 확정 설계 (팀 후속 산출물 — ✅ 완료)

### 8.1 비너스 — 픽셀 목업 (코드-레디, Tailwind 확정)
- **§5.1 실연결 패널:** 채널 row 5칸 마크업 + 연결/미연결/연결중/로딩/에러 5개 상태 클래스. "최근 배포 3줄"(리뷰 발췌+아이콘+시각, 게시 팩트만) + 일부실패 `amber` 재시도 줄.
- **§5.3 넛지 배너:** `border-l-4 border-honey` + 퍼플 CTA 1개, `connectedCount === 0`일 때만. → **카피는 위 S1 규칙으로 Google 제외 교정.**
- **§5.2 done 배포 줄:** `snsPhase: posting|done|failed|null`. 미연결 매장이면 `null`→렌더 안 함. posting=honey 스피너+대상채널명, done=🐝 도파민+아이콘, failed=손님에겐 조용히("이미 반영됐어요").
- **단일 액센트 검증:** 미연결 row 존재 시 퍼플=`연결하기` CTA만 / 전 채널 연결 시 퍼플=자동배포 토글만 → 동시 출현 없음.
- **목업→코드 계약:** 착수 도구가 공급할 상태값 명시 — `connectedCount`, 채널별 `isConnected/accountName/autoOn`, `snsError/snsConnecting/snsLoading`, `recentPosts[]/failedPost`(대시보드); `snsPhase/targetLabels/postedCount/postedNetworks[]`(done).

### 8.2 헌터 — 안전장치 구현 설계 (S2·S4)
- **삽입 지점:** `route.ts` 실행 순서에서 **S4는 GET(line 35) 직후·accountIds 산출 전**, **S2는 media 매핑(line 44) 자리**를 `normalizeForInstagram()`으로 교체. 신규 유틸 `web/lib/snsMedia.ts` 권고(라우트 얇게).
- **S2 미디어 정규화:** **sharp**(권고). 라우트 상단 `export const runtime = 'nodejs'` + `next.config`에 `serverExternalPackages:['sharp']`(Vercel 배포 함정 회피). **재업로드 방식**(원본 다운로드→정규화→Storage `-ig.jpg` 재업로드→새 공개 URL) — 온더플라이 금지(Meta 비동기 fetch 창에서 유실). 알고리즘: `.rotate()`(EXIF) → 종횡비 clamp(**안전마진 0.81~1.90**, IG는 반올림 안 함) → 리뷰=`fit:cover/position:attention` 크롭 / 로고=`contain` 패딩 → `jpeg({quality:82,mozjpeg:true})`, 8MB 초과 시 품질 하향. **`content_type`은 이미지=항상 `image/jpeg` 고정**, `guessContentType`은 비디오 판별로만 축소. 실패한 미디어만 드롭(fail-safe).
- **S4 누수 방어:** Outstand 필터 불신 → 계정의 `tenant_id === storeId` **엄격 일치**로 서버 재검증. **`tenant_id=null` 계정은 무조건 배제**(대시보드 Connect로 잘못 연결된 것). **fail-closed**: 검증 후 0개면 게시 막고(400) 점주에게 "연결 필요". 누수 차단 로그 필수(2호점 온보딩 시 실제 누수 관측). 심화(선택, 2호점 직전): store 문서 `connectedSnsAccountIds[]` 화이트리스트 교차검증.

### 8.3 알프레드 — 카피 (동의 세대별 + 랜딩 영어판)
- **세대별 동의 세트**(1세/1.5세/2세): 각 옵트인+이름표기(김O영·단골손님·익명)+완료 기여감. 상세 문구는 알프레드 산출물 원문 참조 → 착수 시 `ReviewForm.tsx` 동의 지점·done 카드에 매핑.
- **랜딩 영어판**: 헤드라인/서브/신뢰앵커 확정(§6 반영). 전부 S1 준수(Instagram·Facebook만).

## 참조 파일
- `web/app/api/sns-post/route.ts` (팬아웃 핵심 — 미디어 정규화·tenant 재검증 삽입 지점)
- `web/lib/snsApi.ts` (현재 28줄, 연결/상태 함수 부재)
- `web/app/owner/dashboard/page.tsx` (장식 토글 1086~1094 / minihome 탭 43 / overview 583)
- `web/app/store/[slug]/ReviewForm.tsx` (57~58), `SharbeeReview.tsx` (151~152) — 블로킹 await + null snsMsg
- 이식 원본: `src/lib/snsApi.ts` (`SNS_PLATFORMS` 17, `requestSnsConnectUrl` 52, `fetchSnsStatus` 79)
- `src/views/OwnerDashboard/OwnerDashboard.tsx` (연결 UI 2570~ / 핸들러 67~91)
- `netlify/functions/sns-connect-url.mjs`, `sns-status.mjs`, `sns-post.mjs`, `_outstand.mjs`
- **신규 예정:** `web/app/api/sns-connect-url/route.ts` · `sns-status/route.ts`(P0), `web/lib/snsMedia.ts`(S2 정규화), `next.config`에 `serverExternalPackages:['sharp']` + 게시 라우트 `runtime='nodejs'`
- 벤더 API 원문: [SNS-OUTSTAND.md](SNS-OUTSTAND.md) · 디자인: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) · 제품 논리: [VISION.md](VISION.md)
