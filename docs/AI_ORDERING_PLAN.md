# ShareStamps(sss) AI 스마트 오더 시스템(Sharbee) 고도화 개발 계획서

본 계획서는 구글 클라우드의 생성형 AI(Gemini)를 활용하여, ShareStamps(sss)에 **'초개인화된 대화형/음성 AI 주문 및 리뷰 연동 시스템'**을 도입하기 위한 아키텍처 및 구현 스펙을 정의합니다. 코드를 수정하기 전, 기획의 타당성과 구체적인 실행 방안을 검토하기 위한 문서입니다.

## 🎯 [목표 Description]

단순히 터치로 주문하는 기존의 키오스크/앱 방식을 넘어, **AI 마스코트 '샤비(Sharbee)'가 손님의 취향, 과거 주문 내역, 농담 코드까지 기억하고 음성/텍스트로 응대하는 초개인화 주문 경험(Multimodal UX)**을 구축합니다. 또한 주문 당시의 대화 맥락을 리뷰 작성 시점으로 넘겨, 고품질의 스토리텔링 리뷰가 자동 완성되도록 유도합니다.

---

## ⚠️ User Review Required (검토 요망 사항)

> [!IMPORTANT]
> **API 비용 및 모델 선택 — 결정됨 (2026-07-04 팀 조사, `docs/GOOGLE_ORDERING_RESEARCH.md`)**
> - **Dialogflow CX 이원화는 폐기.** 비용(요청당 과금)·락인(플로우가 CX에 갇힘)·"관계형 기억 대화"와 결 불일치.
> - **PoC = 기존 Gemini API(텍스트)로 신속 구축.** 단, 호출은 **반드시 서버 함수 경유 프록시**(클라 키 노출 금지, CLAUDE.md §4).
> - **음성 확장 = Gemini `Live API`(네이티브 오디오).** 한/영 자동전환, 프리뷰 모델명 하드코딩 금지·안정판 고정, 15분 세션 재개 처리.

> [!WARNING]
> **개인정보 및 대화 내역 저장 (Privacy)**
> 농담이나 개인 취향을 기억하려면 대화(Transcript) 내역을 DB에 영구 저장해야 합니다. 앱 약관에 "맞춤형 서비스 제공을 위한 대화 내역 수집 및 AI 학습 동의" 항목이 추가되어야 합니다.

---

## ❓ Open Questions (오픈 퀘스천)

1. **메뉴판 동기화:** 점주가 메뉴를 바꿀 때마다 AI의 단어장(Speech Adaptation/Prompt)을 업데이트해야 합니다. 이 동기화를 하루 1번(배치)으로 할까요, 아니면 점주가 수정할 때마다 즉시 반영(Real-time)되게 할까요?
2. ~~**음성 인식(STT) 라이브러리:** Web Speech API vs 구글 Cloud STT~~ → **해소됨(2026-07-04).** Gemini **Live API가 네이티브 오디오**라 별도 STT 벤더가 필요 없다. 음성 확장 시 Live API로 일원화. (추후 오디오 비용이 부담되면 Deepgram 분리를 헤지 카드로만 남겨둠.)

---

## 🛠️ Proposed Changes (구현 계획 상세)

시스템 구현은 크게 4단계(Phase) 컴포넌트로 나뉘어 진행됩니다.

### 1. Database & Schema Layer (기억력 저장소 구축)

AI가 손님을 기억하게 하기 위해, 기존 `DatabaseContext.tsx`의 스키마를 확장합니다.

#### [MODIFY] `src/context/DatabaseContext.tsx`
*   `User` 인터페이스 확장:
    *   `preferences?: { favoriteMenuIds: string[], specialRequests: string[] }` (예: "얼음 많이", "덜 짜게")
    *   `aiPersonaFlags?: { likesJokes: boolean, lastJokeTopic?: string }` (AI 농담 코드 기억용)
*   새로운 인터페이스 `OrderTranscript` 추가:
    *   특정 주문 트랜잭션(`PointTransaction` 또는 `StampTransaction`)과 1:1로 매칭되는 **대화 기록(JSON 배열 형태)**을 저장. 이 데이터가 나중에 리뷰 작성으로 넘어갑니다.

### 2. Context Injector & Prompt Engineering (초개인화 프롬프트 주입)

앱이 열릴 때, 손님의 과거 데이터를 긁어모아 Gemini API의 System Prompt로 몰래 찔러넣는(Inject) 로직을 개발합니다.

#### [NEW] `src/lib/ai/orderPromptBuilder.ts`
*   `buildSystemPrompt(user, store, orderHistory)` 함수 개발.
*   **프롬프트 예시 구조:**
    ```text
    "너는 sss의 AI 점원 '샤비'야. 현재 손님은 '김단골'이고, 
    최근 3번 연속 '페퍼로니 피자(덜 짜게)'를 먹었어.
    가장 최근에 '치킨 뼈대 개그'를 좋아했으니 이번엔 다른 아재 개그를 섞어서 인사해줘.
    매장 메뉴판 JSON 데이터는 다음과 같아: [메뉴 데이터]"
    ```

### 3. Frontend UI / UX Layer (멀티모달 오더링 화면)

음성 버튼과 화면(메뉴)이 동시에 반응하는 프론트엔드를 구축합니다.

#### [MODIFY] `src/views/CustomerPWA/CustomerPWA.tsx`
*   메인 뷰 상단 또는 하단에 항상 떠 있는 **플로팅 마이크/채팅 버튼 (Sharbee 봇)** 추가.
*   **멀티모달 이벤트 핸들러:** 손님이 "피자 보여줘"라고 말하여 AI가 "피자"라는 의도(Intent)를 뱉어내면, 화면의 React State(카테고리 필터)가 자동으로 `Pizza`로 탭 이동되도록 UI 상태와 AI 응답을 동기화(Sync).

### 4. Review Generation Layer (대화 내역 재활용)

결제 후 리뷰를 남길 때, 방금 나눈 주문 대화를 활용해 초안을 짜줍니다.

#### [MODIFY] `src/views/CustomerPWA/components/ReviewModal.tsx` (또는 관련 리뷰 작성 뷰)
*   리뷰 모달 오픈 시, 해당 주문의 `OrderTranscript` 데이터를 불러옴.
*   기존 `callGeminiAPI` 호출 시 프롬프트 변경:
    *   "고객이 방금 [대화 내역]과 같이 주문했어. '덜 짜게 해달라고 한 부분'이 잘 반영되었는지 친근하게 물어보면서 리뷰 초안을 생성해 줘."

---

## ✅ Verification Plan (검증 및 테스트 계획)

구현 후 아래 시나리오가 완벽히 동작하는지 검증합니다.

### Automated Tests (자동화 테스트)
*   `promptBuilder.test.ts`: 특정 유저의 과거 주문 내역이 주어졌을 때, 프롬프트 문자열에 "페퍼로니", "덜 짜게" 등의 키워드가 정확히 포함되어 반환되는지 단위 테스트(Jest) 진행.

### Manual Verification (수동 통합 시나리오 테스트)
1.  **초기 주문 테스트:** 신규 유저로 접속해 "아이스 아메리카노 연하게 줘"라고 음성/텍스트로 주문 접수가 포스(OwnerDashboard)까지 꽂히는지 확인.
2.  **기억력(Memory) 테스트:** 앱을 껐다가 다시 켜서 샤비에게 인사했을 때, "오늘도 아메리카노 연하게 드릴까요?"라고 먼저 묻는지 확인.
3.  **리뷰 연동 테스트:** 결제 완료 후 리뷰 작성 창을 열었을 때, 샤비가 "연하게 해드린 아메리카노 어떠셨나요?"라고 맞춤형 초안을 띄우는지 확인.
