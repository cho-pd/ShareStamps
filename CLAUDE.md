# CLAUDE.md

ShareStamps 프로젝트 작업 가이드. **Antigravity → Codex → Claude Code** 처럼 여러 AI 도구가
같은 저장소를 순차적으로 다루므로, 각 도구가 이전 작업 의도를 빠르게 이해하도록 핵심만 기록한다.

> 제품의 **목적·비즈니스 로직(왜 이렇게 만드는가)** 은 [docs/VISION.md](docs/VISION.md) 참고.
> 이 문서(CLAUDE.md)는 **어떻게 작업하는가**(빌드/함정/구조)를 다룬다.

## 프로젝트 개요

- **무엇**: 동네 가맹점용 스탬프/적립 로열티 플랫폼 (PWA). 고객이 스탬프를 모아 캐시로
  전환·선물·기부하고, AI(샤비)로 리뷰를 쓰고, 점주는 대시보드로 정산/통계를 본다.
- **스택**: React 19 + TypeScript + Vite. 상태/DB는 단일 Context(`DatabaseContext`)에 집중.
  UI는 대부분 인라인 스타일 + `src/index.css`의 CSS 변수/클래스.
- **언어**: UI는 한국어/영어 토글(`language === 'ko'`). 코드 주석은 한국어가 기본.
- **배포**: Netlify (사이트 `sharestamp-hcho`, 운영 도메인 https://sharestamps.com).

## 빌드 / 실행 / 배포

```bash
npm run dev      # 로컬 개발 서버 (vite, 기본 5173)
npm run build    # tsc -b 타입체크 + vite build → dist/   (배포 전 반드시 통과시킬 게이트)
npm run lint     # eslint

# 배포 (Netlify CLI 설치돼 있음, 사이트는 .netlify/state.json 에 링크됨)
npm run build
netlify deploy --prod --dir=dist
```

푸시는 `origin/main` (https://github.com/cho-pd/ShareStamps.git). 이 프로젝트는 관례적으로
**main에 직접 커밋**하며, 커밋 메시지는 한 줄 kebab-case (예: `fix-banner-ratio-to-16-5`).

## 아키텍처 핵심

- **라우팅**: 라이브러리 없이 URL 해시로 분기 (`src/App.tsx`의 `parseHashRoute`).
  - `#/` 랜딩 · `#/customer` 고객 PWA · `#/store`·`#/owner` 점주 POS · `#/kiosk` 키오스크
  - `#/store-home` 매장 미니홈피 · `#/admin`·`#/hq` 본사 관리자
- **뷰**: `src/views/<Name>/<Name>.tsx`. 파일이 매우 큼(수천 줄). 수정 시 Grep으로 좁혀서 접근.
- **데이터 계층**: `src/context/DatabaseContext.tsx` (약 4400줄)에 모든 엔티티/로직 집중.
  `useDatabase()` 훅으로 어디서든 접근. 인터페이스 정의도 이 파일 상단에 있다.

## ⚠️ 반드시 알아야 할 함정 (이 세션에서 실제로 부딪힌 것들)

### 1. DB는 "단일 Firestore 문서를 전체 클라이언트가 공유"하는 구조
- 모든 상태가 Firestore `sharestamps/database` **문서 하나의 `state` 필드**에 통째로 저장된다.
  (`firebaseConfig.ts`의 실 프로젝트: `sharestamp-hcho-2606`)
- `onSnapshot` 구독 + 클라이언트 측 `mergeStates`/`mergeCollections`로 병합한다. 별도 백엔드 없음.
- **위험**: 로컬에서 테스트 데이터를 주입하면 그게 운영 Firestore에 머지되어 **실사용자 데이터에 섞인다.**
  실제로 이 세션에서 테스트 계정(`DebugUser`)이 운영 DB에 올라가 수동 제거해야 했다.
- **삭제는 머지로 전파되지 않는다**: `mergeCollections`는 id 합집합이라, 한쪽에서 레코드를 지워도
  다른 쪽 데이터와 합쳐지며 되살아난다. 운영 데이터를 지우려면 서버 문서를 직접 `setDoc`으로 덮어써야 한다.

### 2. 앱을 실행/테스트할 때는 로컬 모드로 격리할 것
- `src/firebaseConfig.ts`의 `isFirebaseConfigured()`가 `true`면 곧바로 **운영 Firebase**에 붙는다.
- 디버깅·재현은 이 함수를 임시로 `return false`(로컬 시뮬레이션) 하고 진행한 뒤, **반드시 원복**한다.
- 상태는 `localStorage` 키 `sharestamps_db_v2`, 세션은 `sharestamps_session_user` /
  `sharestamps_session_token` 에 들어있다. 콘솔에서 이 키를 조작해 로그인/스탬프 상태를 재현할 수 있다.

### 3. 동시 편집 금지 (멀티 도구 협업의 제1원칙)
- Antigravity/Codex/Claude Code 중 **한 번에 하나만** 같은 파일을 만진다.
- 도구를 전환하기 전에 **커밋**해 둔다 → 다음 도구가 망쳐도 되돌릴 깨끗한 지점이 생긴다.
- 도구 간 컨텍스트는 공유되지 않으므로, 의도는 커밋 메시지/이 문서에 남긴다.

### 4. 보안 (출시 전 처리 예정 — 알고는 있을 것)
- `.env`의 `VITE_GEMINI_API_KEY`는 Vite가 클라이언트 번들에 그대로 박아 노출시킨다.
  운영 전 서버 측 프록시로 옮기거나 도메인 제한 키로 교체 필요. (`.env`는 `.gitignore`에 등록돼 추적 안 됨)
- `firebaseConfig.ts`의 Firebase 웹 config는 공개돼도 무방한 값이지만, Firestore **보안 규칙**으로
  쓰기를 제한하는 것이 단일 공유 문서 구조에서 특히 중요하다(현재 규칙 파일은 저장소에 없음).

### 5. 미완성/목업 기능 주의
- 점주 대시보드의 "SNS 자동 배포/크로스 포스팅"은 **UI와 상태만 있고 실제 외부 연동은 없다.**
  `review.snsShared`는 현재 항상 빈 객체로 저장된다. 출시 전 실제 API 연동 예정.

## 알려진 이슈 / 히스토리

- **Firestore write-storm (해결됨, 커밋 `fix-firestore-write-storm-infinite-loop`)**:
  `onSnapshot` self-heal 비교에서 `mergeStates`가 매번 `updatedAt`을 새로 찍어 항상 "변경됨"으로
  판정 → 매 스냅샷마다 `setDoc` 되쓰기 → 무한 쓰기 루프 → `resource-exhausted`로 쓰기 큐 고갈 →
  "적립하기"가 반영 안 되던 증상. 비교 시 `updatedAt`을 제외하도록 수정.
