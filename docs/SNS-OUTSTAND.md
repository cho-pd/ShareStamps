# SNS 자동배포(D3) — Outstand 연동 메모

매장 공식 SNS 채널 자동 게시(D3)를 **Outstand**(unified social API)로 구현하기로 결정.
이 문서는 **실제 테스트로 검증한 API 사용법 + 현재 진행상태 + 다음 작업**을 기록한다.
(작성 2026-06-25 — 새 세션/다른 도구가 이어받을 수 있게)

## 결정 요약
- 파일럿/초기: **Outstand** (월 $19, 3,000건 포함, 초과 건당 $0.005~0.007). 멀티테넌트·화이트라벨 지원.
- 확장 시: **BYOK**(우리 Meta 앱 키 꽂아 ShareStamps 브랜드로) → 더 커지면 자체구축.
- Ayrshare는 멀티유저 **$499/월**이라 우리 규모엔 과함.

## ✅ 실제 테스트로 검증된 것 (ShareStamps 계정으로)
- 페북 페이지 + 인스타 비즈니스 **연결** OK
- **텍스트 게시** OK / **이미지 게시 OK (인스타 포함)** / **한글** OK(UTF-8)
- **외부 공개 URL 직접 사용 가능 → 업로드 단계 불필요** (우리 리뷰 사진 Firebase URL 그대로)
- **멀티테넌트: `tenant_id`가 연결 계정에 실제로 붙음** (우리 tenant URL로 연결 시)
- ⚠️ **인스타 이미지 종횡비 제한**: 약 **4:5 ~ 1.91:1** 만 허용. 와이드 배너(og-image, ~4:1 등)는 실패(Meta code 36003). **리뷰 사진(보통 비율)은 OK.**
- 게시는 **비동기**: 생성 직후 `publishedAt:null`, 7~18초 후 발행. `status` 가 `published`/`failed`.

## 검증된 API 사용법 (베이스 `https://api.outstand.so/v1`, 인증 `Authorization: Bearer $OUTSTAND_API_KEY`)
**연결 URL 생성** (점주 OAuth):
```
POST /v1/social-networks/{network}/auth-url
body: { "tenant_id": "<storeId>", "redirect_uri": "<optional>" }
→ { "data": { "auth_url": "https://www.outstand.so/app/api/socials/..." } }
```
network enum: `instagram facebook threads x linkedin youtube tiktok pinterest google_business bluesky vimeo`
(주의: 구글은 `google_business` 언더스코어. 대시보드 "Connect Account"로 연결하면 tenant_id가 null이 됨 → 반드시 이 tenant URL로 연결시킬 것.)

**연결 상태 / 계정 목록**:
```
GET /v1/social-accounts?tenant_id=<storeId>
→ data:[{ id, network, username, accountType, tenant_id, ... }]   // id 가 게시용 계정 식별자
```

**게시** (끝 슬래시 필수 `/posts/`):
```
POST /v1/posts/
body: {
  "accounts": ["<accountId 또는 username>", ...],   // 여러 계정 동시 가능(FB+IG)
  "containers": [{
    "content": "<글>",
    "media": [{ "filename": "x.jpg", "url": "<공개 이미지/영상 URL>", "content_type": "image/jpeg" }]
  }]
}
→ { success, post:{ id, socialAccounts:[...], containers:[...] } }
```
- ⚠️ `mediaIds` / `socialAccountIds` 는 **틀림**. 미디어는 위처럼 `media:[{filename,url,content_type}]` 인라인.
- 게시 후 상태 확인: `GET /v1/posts/{id}` → 각 socialAccount의 `status`/`error` 확인.
- (선택) 파일 업로드가 필요하면: `POST /v1/media/upload {filename,contentType}` → `upload_url`에 PUT → `POST /v1/media/{id}/confirm`. **단 우리는 공개 URL 직접 사용이라 불필요.**

## 현재까지 만든 것 (working tree, 아직 커밋·배포 안 함)
- `netlify.toml` — functions 디렉터리 설정
- `netlify/functions/_outstand.mjs` — 어댑터(키는 `process.env.OUTSTAND_API_KEY`)
- `netlify/functions/sns-connect-url.mjs` — 연결 URL 생성
- `netlify/functions/sns-status.mjs` — 매장별 연결상태
- `netlify/functions/sns-post.mjs` — 게시(검증된 형식). 응답에 `postedNetworks`(시도된 네트워크) 추가.
- `src/lib/snsApi.ts` — **프런트 클라이언트 래퍼**. 함수 호출 + `SNS_PLATFORMS` 매핑(settingKey↔network↔shareKey),
  `enabledNetworks()`, `requestSnsConnectUrl()`, `fetchSnsStatus()`, `postReviewToSns()`.
- `OwnerDashboard.tsx` — ① 완료. 가짜 연동 패널 제거 → **실제 채널 연결 패널**(연동하기→authUrl 새 창,
  새로고침→`fetchSnsStatus`로 실제 연결상태 표시). 위쪽 on/off 토글(`snsSettings`)은 자동게시 대상 선택용으로 유지.
- `CustomerPWA.tsx` + `DatabaseContext.tsx` — ② 완료. 샤비 리뷰 등록 시 **Firebase 업로드 완료(공개 URL) 후**
  `postReviewToSns` 호출. 결과를 새 DB 메서드 `updateReviewSnsShared(reviewId, snsShared)`로 리뷰에 기록
  (실제 게시된 네트워크만 true). 미디어 없으면 텍스트로 바로 게시. blob 미리보기 URL은 Outstand가 못 읽으니 주의.
- **`OUTSTAND_API_KEY` 는 Netlify 환경변수에 설정됨** (깃·번들엔 없음). ⚠️ **노출된 키라 나중에 재발급 교체 필요.**

## 다음 작업 (남은 것)
1. ~~점주 대시보드 진짜 연동 UI~~ ✅ 완료 (위 참조).
2. ~~리뷰 등록 시 자동 게시 배선~~ ✅ 완료 (위 참조). (개선여지: 현재 `postedNetworks`로 "시도됨"만 기록.
   실제 published/failed는 비동기라, 필요하면 `GET /posts/{id}` 폴링으로 확정 상태 갱신.)
3. **배포**: functions 포함해 `netlify deploy --prod` (⚠️ 사용자 승인 후에만). 미배포 상태에선 `/.netlify/functions/*`가
   없어 대시보드 상태조회/게시가 조용히 실패(에러 표시)하는 게 정상 — 로컬 `npm run dev`만으론 검증 불가.
4. **정리**: ShareStamps 페북/인스타에 올라간 테스트 글 삭제. 노출된 OUTSTAND_API_KEY 재발급.

## 클라이언트 호출 경로
프런트는 `src/lib/snsApi.ts`를 통해 `/.netlify/functions/{sns-connect-url,sns-status,sns-post}`를 호출한다
(별도 `/functions/*` 리다이렉트는 두지 않음). 실패해도 throw 안 하고 success:false 로 처리해 리뷰 등록을 막지 않는다.

## 함정
- 게시 함수가 `/posts/`(끝슬래시) + `accounts` + `media:[{filename,url,content_type}]` 형식이어야 함.
- 인스타 와이드 이미지 실패(종횡비). 리뷰 사진은 보통 OK.
- 대시보드 직접연결(Connect Account)은 tenant_id=null → 매장 구분 안 됨. 꼭 tenant URL로.
- 배포는 매번 승인받고. (see [deploy-requires-permission])
