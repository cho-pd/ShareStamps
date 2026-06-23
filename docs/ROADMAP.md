# ShareStamps 구현 로드맵 / 체크포인트

> [docs/VISION.md](VISION.md)의 미구현 항목을 **의존성 순서**로 쪼갠 실행 체크리스트.
> 한 번에 한 Phase씩 구현하고, 끝나면 체크박스를 채우고 커밋한다.
> 작업 원칙·함정은 [CLAUDE.md](../CLAUDE.md) 참고. (생성 2026-06-23)

## 진행 현황 한눈에

| Phase | 항목 | 비전 | 상태 |
|---|---|---|---|
| P0 | 출시 전 공통 선결(보안/규칙) | 인프라 | ⬜ 예정 |
| P1 | SNS 공유 스탬프 지급 경로 | D4 | ⬜ 예정 |
| P2 | AEO/GEO 기반: 브랜드 일원화 + AI FAQ | B1·B2 | ⬜ 예정 |
| P3 | 리뷰 전채널 자동 배포(실연동) | D3 | ⬜ 예정 |
| P4 | 직원(서버) 10% 정산 | I2 | ⬜ 예정 |
| P5 | 게임화 ShareChamp | H | ⬜ 예정 |
| P6 | 기부 세금공제 영수증 + '좋은 가게' 현판 | J3·J4 | ⬜ 예정 |

**추천 순서 근거**: P1은 기존 한도 로직 위에 얹는 소규모 작업(즉시 효과). P2는 백엔드
없이 가능한 고효율 마케팅. P3는 외부 API/서버 프록시가 필요해 P0(보안)에 의존. P4~P6는
정산·집계 성격으로 데이터가 쌓인 뒤가 유리.

---

## P0. 출시 전 공통 선결 (인프라/보안)

> SNS 실연동(P3)과 운영 공개 전에 반드시. 지금은 개발 단계라 미뤄도 되지만 **P3 착수 전 선행**.

- [ ] `VITE_GEMINI_API_KEY` 클라이언트 노출 제거 → **Netlify Functions 서버 프록시**로 이전
  - [ ] `netlify/functions/gemini.ts` 생성, 키는 Netlify 환경변수에 저장
  - [ ] `CustomerPWA.tsx`의 직접 `fetch(generativelanguage...)` 3곳을 프록시 호출로 교체
- [ ] **Firestore 보안 규칙** 작성 (`firestore.rules`) — 단일 공유 문서 쓰기 제한
- [ ] `.env`가 `.gitignore`에 있음 재확인(현재 OK), 운영 키는 도메인 제한 키로
- **완료 기준**: 빌드 번들에서 Gemini 키 grep 시 미검출. 무권한 쓰기 차단 확인.
- **리스크**: 단일 공유 문서 구조라 규칙이 과하면 정상 쓰기까지 막힘 → 단계적 적용.

---

## P1. SNS 공유 스탬프 지급 경로 (D4)

> 손님이 **자기 SNS에 매장 리뷰를 올리고 링크를 제출**하면 하루 1장 지급.
> 한도 로직(`SNS_DAILY_LIMIT`, `getDailyStoreStampCount(... 'sns_share')`)은 이미 존재.
> **MVP = 명예 신고형**(URL 제출 → 지급, 검증은 사후). 단계적으로 UTM 추적 추가.

### 데이터 모델 (`DatabaseContext.tsx`)
- [ ] `SnsShareSubmission` 인터페이스 추가: `{ id, userId, storeId, platform, url, status: 'pending'|'verified'|'rejected', createdAt }`
- [ ] `dbState`에 `snsShareSubmissions: SnsShareSubmission[]` 추가 + `migrateDatabaseState` 기본값 `[]`

### 로직
- [ ] `submitSnsShare(storeId, platform, url)` 함수
  - [ ] URL 형식 검증(빈 값/형식)
  - [ ] `getDailyStoreStampCount(txs, userId, storeId, 'sns_share') >= SNS_DAILY_LIMIT` 면 차단(메시지: `getDailyLimitMessage('sns')`)
  - [ ] 카드 `currentStamps < 7` 일 때만 지급, 스탬프 1장 + `stampTransactions`에 `source:'sns_share'`, `referenceId: submission.id`
  - [ ] 제출 레코드 저장(`status:'pending'`)
  - [ ] 반환 `{ success, stampAwarded, message }`

### UI
- [ ] 고객 PWA(`CustomerPWA.tsx`): "내 SNS에 올렸어요" 버튼 → 플랫폼 선택 + URL 입력 모달 → `submitSnsShare`
- [ ] 점주 대시보드(`OwnerDashboard.tsx`): 제출된 SNS 링크 목록 + 사후 `verified/rejected` 토글

### 완료 기준
- [ ] 같은 매장에서 하루 2번 제출 시 2번째 차단(자정 리셋)
- [ ] 다른 매장은 독립 지급 / 로컬 모드 경계 케이스 통과
- **리스크**: 명예 신고형은 어뷰징 가능 → P1.5에서 UTM/링크 클릭 추적으로 보강(별도).

---

## P2. AEO/GEO 기반 — 브랜드 일원화 + AI FAQ (B1·B2)

> 백엔드 없이 가능한 고효율 마케팅. AI가 매장을 동일 엔티티로 인식하고 답변에 인용하도록.

### B1. 브랜드 일원화 (`Store` 모델)
- [ ] `Store`에 `subtitle?`, `brandKeywords?: string[]`, `canonicalName?` 필드 추가
- [ ] 점주 대시보드에서 입력 UI
- [ ] 미니홈피/리뷰/메타태그에서 **단일 표기** 사용하도록 통일

### B2. AI가 이해하는 FAQ (`StoreMiniHome.tsx`)
- [ ] `Store.faq?: { q: string; a: string }[]` 필드 추가
- [ ] 점주 FAQ 편집 UI(대시보드)
- [ ] 미니홈피에 **구조화 데이터(JSON-LD `FAQPage`)** `<script type="application/ld+json">` 출력
- [ ] 페이지 `<title>`/`meta description`/OG 태그를 매장별로 주입(해시 라우팅이라 동적 주입 필요 — `document.head` 갱신)

### 완료 기준
- [ ] 미니홈피 소스에 유효한 FAQ JSON-LD 존재(리치 결과 테스트 통과)
- [ ] 모든 표기에서 브랜드명/서브타이틀 일관
- **리스크**: SPA(해시 라우팅)는 크롤러가 메타를 못 읽을 수 있음 → 프리렌더/SSR 또는 Netlify prerender 검토(P2 후반 별도 체크).

---

## P3. 리뷰 전채널 자동 배포 — 실연동 (D3)

> 현재 `review.snsShared`는 항상 빈 객체. UI/토글(`Store.snsSettings`)만 존재.
> **P0(서버 프록시) 선행 필수.** 플랫폼별로 난이도 큼 → 쉬운 것부터.

### 공통
- [ ] `netlify/functions/sns-publish.ts` — 서버에서 각 SNS API 호출(토큰 서버 보관)
- [ ] 점주 SNS 계정 **OAuth 연결** 저장 구조(`Store.snsConnections`)
- [ ] 리뷰 등록 시 `snsSettings`에서 켜진 채널로 발행 → 성공분만 `review.snsShared[platform]=true`

### 플랫폼별(쉬운 → 어려운)
- [ ] 구글 비즈니스 프로필 (Business Profile API)
- [ ] 페이스북 페이지 / 인스타그램 (Meta Graph API, 앱 심사 필요)
- [ ] 스레드 (Threads API)
- [ ] 링크드인 (Marketing API)
- [ ] 유튜브 쇼츠 / 틱톡 (영상 업로드 — `review.videoUrl` 활용)

### 완료 기준
- [ ] 켜둔 채널에 실제 게시되고 대시보드 모니터에 `🟢 배포 완료` 정확 반영
- **리스크**: 각 플랫폼 앱 심사·약관·토큰 만료. 1개(구글) 먼저 end-to-end 완성 후 확장.

---

## P4. 직원(서버) 10% 정산 (I2)

> 스탬프 캐시 **발행액의 ~10%를 매장 직원에게**. "찍게 만드는 핵심" 보상.

### 데이터 모델
- [ ] `StoreStaff` 인터페이스: `{ id, storeId, name, payoutAccount?, active }`
- [ ] `StaffPayout` 인터페이스: `{ id, storeId, staffId, amount, periodStart, periodEnd, status, createdAt }`
- [ ] 스탬프→캐시 전환(`convertStampsToCash`) 시 발행액 기록(정산 기준 금액)

### 로직/UI
- [ ] 점주 대시보드: 직원 등록/관리
- [ ] 기간별 발행액 집계 → 10% 분배 미리보기 → 정산 확정(`StaffPayout` 생성)
- [ ] (선택) QR 발급 직원 식별 → 기여 기반 배분

### 완료 기준
- [ ] 임의 기간 발행액 합계 × 10% = 정산 총액 일치, 직원별 분배 검증
- **리스크**: 실제 송금은 외부(미구현). 우선 **정산 장부/리포트**까지만.

---

## P5. 게임화 — ShareChamp (H)

> 게임처럼 챔피언/챔피언 매장 리스트.

### 집계(기존 트랜잭션 활용)
- [ ] 고객 점수 정의(예: 적립·기부·선물·SNS공유 가중 합) → `computeShareChampScores()`
- [ ] 매장 점수 정의(예: 발생 리뷰/배포/재방문 지표)

### UI
- [ ] 고객 PWA: ShareChamp 리더보드(주간/누적), 내 순위
- [ ] 본사(`SuperAdmin.tsx`): 챔피언/챔피언 매장 선정·발표
- [ ] 배지/타이틀 부여

### 완료 기준
- [ ] 리더보드 점수가 거래 데이터와 일치, 동점/리셋 규칙 명확
- **리스크**: 점수식이 어뷰징 유인 안 만들도록 설계.

---

## P6. 기부 세금공제 영수증 + '좋은 가게' 현판 (J3·J4)

> 점주가 기부를 많이 하면 **영수증 발급→세금 공제**, 사회적 인정으로 **현판**.

### J4. 기부 영수증
- [ ] 기부 정산(`settleDonations`) 데이터 기반 기간별 기부 합계 집계
- [ ] 비영리별/기간별 **영수증 생성**(PDF 또는 인쇄용 뷰)
- [ ] 점주 대시보드에서 다운로드

### J3. '좋은 가게' 현판
- [ ] 기준 정의(기부액/리뷰수 임계) → 자격 매장 표시
- [ ] 미니홈피/대시보드에 현판 배지, 본사에서 수여 관리

### 완료 기준
- [ ] 영수증 합계가 기부 원장과 일치, 현판 자격 자동 판정
- **리스크**: 세무 영수증은 법적 양식 요건 확인 필요(국가별).

---

## 작업 루틴 (매 Phase 공통)

1. 해당 Phase 브랜치 의도 없이 **main 직접 작업**(프로젝트 관례) — 단 시작 전 클린 커밋 확보
2. 로컬 격리(`isFirebaseConfigured`→`false`)로 구현·검증 후 **반드시 원복**
3. `npm run build` 통과 게이트
4. 경계 케이스 검증(로컬 모드)
5. 커밋(kebab-case) → `npm run build` → `netlify deploy --prod --dir=dist`
6. 이 문서 체크박스 갱신 + 상태표 갱신
