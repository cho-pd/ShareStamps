import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

const formatInterval = (minutes: number, lang: 'ko' | 'en' = 'ko') => {
  const minsNum = typeof minutes === 'number' && !isNaN(minutes) ? minutes : 60;
  if (lang === 'en') {
    if (minsNum < 60) return `${minsNum} min${minsNum > 1 ? 's' : ''}`;
    const hours = Math.floor(minsNum / 60);
    const mins = minsNum % 60;
    const hourStr = `${hours} hour${hours > 1 ? 's' : ''}`;
    return mins > 0 ? `${hourStr} ${mins} min${mins > 1 ? 's' : ''}` : hourStr;
  }
  if (minsNum < 60) return `${minsNum}분`;
  const hours = Math.floor(minsNum / 60);
  const mins = minsNum % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};

const formatUSPhoneNumber = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  if (cleaned.length === 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};
import { useDatabase } from '../../context/DatabaseContext';
import type { User } from '../../context/DatabaseContext';
import { playVoiceGuidance } from '../../utils/voice';
import { storage as firebaseStorage } from '../../firebase';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { 
  QrCode, Gift, Heart, User as UserIcon, LogOut, CheckCircle2, 
  History, Globe, Loader2, XCircle, Smartphone,
  ChevronDown, ChevronUp, Settings, Sparkles, Send, Camera, Video, Image as ImageIcon
} from 'lucide-react';

const SHARBEE_HELPER_IMAGE = '/sharbee/sharbee5.png';
const GEMINI_REVIEW_MODEL = 'gemini-3.1-flash-lite';
const SHARBEE_MAX_VIDEO_SECONDS = 15;
const SHARBEE_MAX_VIDEO_BYTES = 80 * 1024 * 1024;

const detectReviewLanguage = (texts: string[]): 'ko' | 'en' => {
  const joined = texts.join(' ');
  const koreanMatches = joined.match(/[가-힣]/g)?.length || 0;
  return koreanMatches >= 2 ? 'ko' : 'en';
};


export const CustomerPWA: React.FC = () => {
  const { 
    currentUser, currentDeviceToken, loginByPhoneNumber, logout, registerUser, 
    stores, stampCards, storePoints, nonProfits, donations,
    searchFriend, giftStamps, donateStamps, donatePointsDirect, claimQRStamps, registerQRScan, receiptScans,
    language, setLanguage,
    paymentRequests, requestPayment, cancelPaymentRequest,
    adBanners, stampTransactions, pointTransactions,
    users, gifts, acceptGift, declineGift, convertStampsToCash, addReview, updateReviewMedia,
    submitSnsShare,
    customerSelectedStoreId, setCustomerSelectedStoreId
  } = useDatabase();

  // SNS 공유: 리뷰 완료 후 원탭 네이티브 공유로 +1 스탬프
  const [sharePrompt, setSharePrompt] = useState<{ storeId: string; storeName: string; comment: string; photoUrl?: string } | null>(null);
  const [sharePromptFile, setSharePromptFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState<boolean>(false);

  // 공유 프롬프트가 뜨면 이미지를 미리 File로 받아둔다 (클릭 시점엔 await 없이 바로 공유해야 시트가 뜸)
  useEffect(() => {
    let cancelled = false;
    setSharePromptFile(null);
    if (sharePrompt?.photoUrl) {
      fetch(sharePrompt.photoUrl)
        .then(r => r.blob())
        .then(b => { if (!cancelled) setSharePromptFile(new File([b], 'review.jpg', { type: b.type || 'image/jpeg' })); })
        .catch(() => { /* 이미지 없이도 공유 진행 */ });
    }
    return () => { cancelled = true; };
  }, [sharePrompt]);

  // 고객 자신의 SNS로 원탭 공유. navigator.share는 클릭 직후 동기로(앞에 await 없이) 호출해야 공유 시트가 뜬다.
  const shareReviewToSns = async (opts: { storeId: string; storeName: string; comment: string; photoUrl?: string }, file?: File | null) => {
    const refLink = `${window.location.origin}/#/store-home/${opts.storeId}?ref=${currentUser?.id || ''}`;
    const caption = `${opts.comment}\n\n📍 ${opts.storeName}\n${refLink}`;
    const nav = navigator as any;
    let opened = false;
    if (nav.share) {
      const data: any = { title: opts.storeName, text: caption, url: refLink };
      if (file && nav.canShare && nav.canShare({ files: [file] })) data.files = [file];
      setSharing(true);
      try {
        await nav.share(data); // ← 첫 await여야 함 (앞에 await가 있으면 사용자 제스처가 만료돼 시트가 안 뜸)
        opened = true;
      } catch (e: any) {
        setSharing(false);
        if (e && e.name === 'AbortError') return; // 취소 → 스탬프 미지급
        // 그 외(NotAllowedError 등) → 아래 폴백
      }
      setSharing(false);
    }
    try { navigator.clipboard?.writeText(caption); } catch (e) { /* ignore */ }
    const res = submitSnsShare(opts.storeId, 'other', refLink);
    const okMsg = res.stampAwarded
      ? (language === 'ko' ? 'SNS 공유 완료! 스탬프 1장이 적립되었습니다 🎉' : 'Shared! +1 stamp 🎉')
      : res.message;
    setGiftingSuccessMessage(
      opened
        ? okMsg
        : (language === 'ko'
            ? `이 브라우저는 공유창을 지원하지 않아요(폰/크롬에서 열면 떠요). 캡션을 복사했으니 SNS에 붙여넣어 올려주세요.${res.stampAwarded ? ' (스탬프 1장 적립)' : ''}`
            : `Share sheet isn't supported in this browser (works on phone/Chrome). Caption copied — paste it on your SNS.${res.stampAwarded ? ' (+1 stamp)' : ''}`)
    );
    setTimeout(() => setGiftingSuccessMessage(null), opened ? 2800 : 4500);
  };


  const activeAds = adBanners.filter(ad => ad.status === 'active');
  const [adIndex, setAdIndex] = useState(0);

  // 15초마다 배너 교체 (활성 배너 2개 이상일 때)
  useEffect(() => {
    if (activeAds.length <= 1) return;
    const timer = setInterval(() => {
      setAdIndex(prev => (prev + 1) % activeAds.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [activeAds.length]);

  // 활성 배너 수가 바뀌면 인덱스 리셋
  useEffect(() => {
    setAdIndex(0);
  }, [activeAds.length]);

  const activeAd = activeAds[adIndex] ?? null;


  // 다국어 번역 사전 정의
  const t = {
    title: language === 'ko' ? 'ShareStamps' : 'ShareStamps',
    subtitle: language === 'ko' ? '앱 설치 없는 PWA 로컬 나눔 멤버십' : 'No-install PWA local sharing loyalty platform',
    phoneLogin: language === 'ko' ? '휴대폰 번호 로그인' : 'Phone Number Login',
    phonePlaceholder: language === 'ko' ? '휴대폰 번호 입력 (예: 123-456-7890)' : 'Enter phone number (e.g., 123-456-7890)',
    nicknameLabel: language === 'ko' ? '닉네임 (신규 가입 시)' : 'Nickname (for new sign-up)',
    nicknamePlaceholder: language === 'ko' ? '사용할 닉네임 입력' : 'Choose your nickname',
    nicknameRequired: language === 'ko' ? '처음 가입하는 번호입니다. 닉네임을 입력해 주세요.' : 'This is a new number. Please enter a nickname.',
    newSignup: language === 'ko' ? '신규 회원가입하기' : 'Create a new account',
    newSignupPrompt: language === 'ko' ? '새 휴대폰 번호와 닉네임을 입력해 주세요.' : 'Enter a new phone number and nickname.',
    existingPhoneNumber: language === 'ko' ? '이미 가입된 번호입니다. 시작하기 버튼으로 로그인해 주세요.' : 'This number is already registered. Use Get Started to sign in.',
    recentNum: language === 'ko' ? '최근 사용 번호:' : 'Recent number:',
    autoFillClick: language === 'ko' ? '클릭 시 자동 입력' : 'Click to autofill',
    start: language === 'ko' ? '시작하기' : 'Get Started',
    demoTip: language === 'ko' ? '💡 프로토타입 빠른 로그인:' : '💡 Prototype Quick Login:',
    demoTip1: language === 'ko' ? '* 기존 회원: 01055556666 입력 시 즉시 로그인 완료.' : '* Existing Member: Enter 01055556666 to log in immediately.',
    demoTip2: language === 'ko' ? '* 새로운 휴대폰 번호를 입력하면 바로 아임인 스타일의 둥근 설문 가입 창이 열립니다!' : '* New Member: Enter a new number to open the registration view.',
    otpTitle: language === 'ko' ? '인증번호 입력' : 'Enter Verification Code',
    otpSubtitle: language === 'ko' ? '위 번호로 발송된 4자리 인증번호를 입력해 주세요.' : 'Please enter the 4-digit code sent to the number above.',
    otpPlaceholder: language === 'ko' ? '인증번호 4자리' : '4-digit Code',
    otpVerifyBtn: language === 'ko' ? '인증 완료 및 가입' : 'Verify and Join',
    otpResend: language === 'ko' ? '재발송' : 'Resend',
    otpBack: language === 'ko' ? '이전으로' : 'Back',
    otpTimerExpired: language === 'ko' ? '인증 시간이 만료되었습니다. 재발송해 주세요.' : 'Verification code expired. Please resend.',
    otpIncorrect: language === 'ko' ? '인증번호가 일치하지 않습니다.' : 'Incorrect verification code.',
    smsSim: language === 'ko' ? '[문자 시뮬레이션]' : '[SMS Simulation]',
    smsSimContent: language === 'ko' ? '[ShareStamps] 본인확인 인증번호는' : '[ShareStamps] Your verification code is',
    
    // Signup terms
    joinPhoneTitle: language === 'ko' ? '가입 진행 휴대폰 번호' : 'Signing up with phone number',
    agreeAll: language === 'ko' ? '전체 동의하기' : 'Agree to all terms',
    agreeTerm1: language === 'ko' ? '전화번호 본인 인증 동의 (필수)' : 'Consent to phone verification (Required)',
    agreeTerm1Desc: language === 'ko' ? 'SMS 문자를 통한 본인 인증 발송에 동의합니다.' : 'I consent to receiving SMS verification codes.',
    agreeTerm2: language === 'ko' ? '적립 횟수 및 금액 안내 동의 (필수)' : 'Consent to earning & reward notifications (Required)',
    agreeTerm2Desc: language === 'ko' ? '스탬프 적립 시 적립 횟수와 리워드 환전 금액 안내를 받는 것에 동의합니다.' : 'I consent to receiving stamp count and cashback notifications.',
    agreeTerm3: language === 'ko' ? '기부 관련 정보 안내 동의 (필수)' : 'Consent to donation stats updates (Required)',
    agreeTerm3Desc: language === 'ko' ? '도네이션할 경우 어느 단체에 얼마 기부되었고, 지금까지의 누적 총 기부금이 얼마인지 안내받는 것에 동의합니다.' : 'I consent to receiving updates about my donation details and cumulative impact.',
    agreeTerm4: language === 'ko' ? '매장 마케팅 전화 수신 동의 (필수)' : 'Consent to store marketing calls (Required)',
    agreeTerm4Desc: language === 'ko' ? '매장 이용 관련 홍보 및 서비스 마케팅 목적의 전화를 수신하는 것에 동의합니다.' : 'I consent to receiving promotional calls from the store.',
    joinBtn: language === 'ko' ? '동의하고 가입 완료' : 'Agree and Join',

    // Scanner
    scannerTitle: language === 'ko' ? '📷 QR 코드 스캔' : '📷 Scan QR Code',
    scannerSubtitle: language === 'ko' ? '영수증에서 생성된 10초 QR 코드를 스캔합니다.' : 'Scan the 10-second receipt QR code.',
    scannerPlaceholder: language === 'ko' ? 'QR 토큰 값 입력' : 'Enter QR token value',
    scannerScanBtn: language === 'ko' ? '스캔 확인 (적립 완료)' : 'Verify Scan (Claim Stamps)',
    scannerAutoBtn: language === 'ko' ? '⚡ Kiosk QR 코드 자동 스캔' : '⚡ Auto-Scan Kiosk QR',
    scannerSkipBtn: language === 'ko' ? '건너뛰기' : 'Skip',
    scannerInfo: language === 'ko' ? '태블릿의 QR 토큰 값을 입력하거나 자동 인식을 누르세요.' : 'Enter the QR token or click Auto-Scan.',
    scanCameraTopBtn: language === 'ko' ? '촬영 스캔' : 'Camera Scan',
    scanCameraComingSoon: language === 'ko' ? '카메라 QR 스캔 기능은 다음 단계에서 연결할 예정입니다.' : 'Camera QR scanning will be connected in the next step.',

    // Home
    welcome: language === 'ko' ? '반갑습니다!' : 'Welcome!',
    logoutBtn: language === 'ko' ? '로그아웃' : 'Logout',
    settingsTitle: language === 'ko' ? '설정' : 'Settings',
    settingsComingSoon: language === 'ko' ? '추가 설정 준비 중' : 'More settings coming soon',
    versionLabel: language === 'ko' ? '버전' : 'Version',
    scanQROverlayBtn: language === 'ko' ? '영수증 QR 스캔하기 (스탬프 적립)' : 'Scan Receipt QR (Earn Stamps)',
    selectStoreLabel: language === 'ko' ? '방문하신 매장 선택' : 'Select Visited Store',
    unassignedStoreName: language === 'ko' ? '미지정' : 'Unassigned',
    noStoreIntroTitle: language === 'ko' ? '아직 연결된 매장이 없습니다.' : 'No store connected yet.',
    noStoreIntroDesc: language === 'ko' ? '매장 QR을 스캔해 첫 스탬프를 받아보세요.' : 'Scan a store QR to receive your first stamp.',
    noStoreIntroHint: language === 'ko' ? 'QR로 들어오면 해당 매장 카드가 자동으로 열립니다.' : 'When you enter through a QR, that store card opens automatically.',
    myShareStampsBtn: language === 'ko' ? 'My ShareStamps' : 'My ShareStamps',
    noStoreDashboardTitle: language === 'ko' ? 'My ShareStamps' : 'My ShareStamps',
    noStoreDashboardDesc: language === 'ko' ? '아직 특정 매장에 연결되지 않은 상태입니다.' : 'You are not connected to a specific store yet.',
    noStoreDashboardGuide: language === 'ko' ? '매장에서 영수증 QR을 스캔하면 해당 매장의 스탬프 카드가 자동으로 생성됩니다.' : 'Scan a receipt QR at a store to create that store stamp card automatically.',
    rewardLabel: language === 'ko' ? '7회 완성 스탬프 캐시:' : '7-stamp Stamp Cash:',
    earnRateLimitLabel: language === 'ko' ? '적립간격:' : 'Interval:',

    ptsBalanceLabel: language === 'ko' ? '보유 스탬프 캐시' : 'My Stamp Cash Balance',
    discountBarcodeBtn: language === 'ko' ? '스탬프 캐시 사용 요청' : 'Request Stamp Cash',
    giftStampsBtn: language === 'ko' ? '친구 선물하기' : 'Gift to Friend',
    donateStampsBtn: language === 'ko' ? '단체 기부하기' : 'Donate to Charity',
    giftDonateMinTip: language === 'ko' ? '* 보유한 스탬프 도장이 1개 이상일 때 선물 및 기부가 활성화됩니다.' : '* Gifting and donating are enabled when you have 1 or more stamps.',
    
    // Impact Dashboard
    impactTitle: language === 'ko' ? '내가 나눈 사회적 가치' : 'My Shared Social Value',
    impactDesc: language === 'ko' ? '소멸될 뻔했던 스탬프가 따뜻한 기금으로 탄생했습니다.' : 'Stamps that could have expired became warm donations.',
    impactDescPrefix: language === 'ko' ? '소멸될 뻔했던 스탬프 ' : 'Stamps that could have expired: ',
    impactDescSuffix: language === 'ko' ? '개가 따뜻한 기금으로 탄생했습니다.' : ' stamps converted to social funds.',
    mealsLabel: language === 'ko' ? '결식 아동 급식 배달' : 'Meals for Hungry Kids',
    treesLabel: language === 'ko' ? '지구 사랑 나무 심기' : 'Trees Planted for Earth',
    mealsUnit: language === 'ko' ? '끼니' : ' meals',
    treesUnit: language === 'ko' ? '그루' : ' trees',
    timelineTitle: language === 'ko' ? '나의 따뜻한 나눔 히스토리' : 'My Warm Donation History',
    timelineEmpty: language === 'ko' ? '기부하신 내역이 아직 없습니다. 스탬프를 NPO에 전해 보세요!' : 'No donations yet. Send stamps to an NPO!',
    timelineDonated: language === 'ko' ? '기부' : 'Donated',
    timelineStampsCount: language === 'ko' ? '개 기부' : ' stamps',
    timelineValue: language === 'ko' ? '가치' : 'Value',

    // Gifting Modal
    giftTitle: language === 'ko' ? '스탬프 친구에게 선물' : 'Gift Stamps to Friend',
    giftClose: language === 'ko' ? '닫기' : 'Close',
    giftDesc: language === 'ko' ? 'A 매장의 스탬프는 오직 동일한 A 매장 스탬프로만 선물할 수 있습니다.' : 'Stamps can only be gifted to the same store card.',
    giftAvail: language === 'ko' ? '현재 선물 가능 스탬프:' : 'Available stamps:',
    giftSearchLabel: language === 'ko' ? '수신할 친구 검색 (닉네임 또는 전화번호 뒤 4자리)' : 'Search friend (Nickname or last 4 phone digits)',
    giftSearchPlaceholder: language === 'ko' ? '예: bread_girl 또는 8888' : 'e.g., bread_girl or 8888',
    giftSelectedFriend: language === 'ko' ? '수신자:' : 'Recipient:',
    giftCountLabel: language === 'ko' ? '선물 스탬프 수량' : 'Stamps Count',
    giftMaxSuffix: language === 'ko' ? '개 (최대)' : 'stamps (max)',
    giftMessageLabel: language === 'ko' ? '메시지 한마디' : 'Message',
    giftMessagePlaceholder: language === 'ko' ? '따뜻한 응원 멘트 전송' : 'Send a warm support message',
    giftBtn: language === 'ko' ? '선물 보내기' : 'Send Gift',
    giftSuccessTitle: language === 'ko' ? '선물이 완료되었습니다!' : 'Gift Sent successfully!',
    giftSuccessDesc1: language === 'ko' ? '성공적으로 ' : 'Successfully transferred ',
    giftSuccessDesc2: language === 'ko' ? '개의 스탬프가 친구에게 이전되었습니다.' : ' stamps to your friend.',
    giftSuccessLimitTip: language === 'ko' ? '* 친구의 스탬프 카드 7개 상한 초과분은 본인 카드에 다시 회수/보존되었습니다.' : '* Stamps exceeding your friend\'s 7-stamp limit have been returned to your card.',
    giftSuccessOk: language === 'ko' ? '확인' : 'OK',

    // Donating Modal
    donateTitle: language === 'ko' ? '스탬프 기부하기' : 'Donate Stamps',
    donateClose: language === 'ko' ? '닫기' : 'Close',
    donateDesc: language === 'ko' ? '보유한 스탬프 가치를 기부하여 비영리 단체를 후원하세요.' : 'Donate your stamps to support NPOs.',
    donateAvail: language === 'ko' ? '현재 기부 가능 스탬프:' : 'Available stamps:',
    donateNpoLabel: language === 'ko' ? '기부 단체 선택' : 'Select Charity (NPO)',
    donateCountLabel: language === 'ko' ? '기부 스탬프 수량' : 'Donation Stamps Count',
    donateMaxSuffix: language === 'ko' ? '개 (최대)' : 'stamps (max)',
    donateValLabel: language === 'ko' ? 'NPO 기부 환산금액 가치:' : 'Estimated Donation Value:',
    donateValSuffix: language === 'ko' ? ' 가치' : ' Value',
    donateBtn: language === 'ko' ? '기부 확정하기' : 'Confirm Donation',
    donateSuccessTitle: language === 'ko' ? '따뜻한 나눔이 전달되었습니다!' : 'Donation Received!',
    donateSuccessDesc1: language === 'ko' ? '성공적으로 기부 단체에 ' : 'Successfully donated ',
    donateSuccessDesc2: language === 'ko' ? ' 상당의 기부 가치가 적립되었습니다. (주간 정산 대장에 매칭 완료)' : ' to the charity. (Matched in weekly ledger)',
    donateSuccessOk: language === 'ko' ? '확인' : 'OK',

    // Payment Request Modal
    requestTitle: language === 'ko' ? '스탬프 캐시 사용 요청' : 'Request Stamp Cash',
    requestClose: language === 'ko' ? '닫기' : 'Close',
    requestBalanceLabel: language === 'ko' ? '보유 스탬프 캐시' : 'My Stamp Cash',
    requestAmountLabel: language === 'ko' ? '사용할 캐시 금액 ($)' : 'Amount to use ($)',
    requestBtn: language === 'ko' ? '사용 요청 보내기' : 'Send Usage Request',
    requestPendingTitle: language === 'ko' ? '점장 승인 대기 중...' : 'Waiting for Approval...',
    requestPendingDesc: language === 'ko' ? '점장 태블릿으로 사용 요청을 보냈습니다. 카운터 직원의 승인을 기다려 주세요.' : 'Sent request to store manager tablet. Please wait for store staff to approve.',
    requestCancelBtn: language === 'ko' ? '요청 취소' : 'Cancel Request',
    requestApprovedTitle: language === 'ko' ? '사용 승인 완료!' : 'Usage Approved!',
    requestApprovedDesc: (amt: number) => language === 'ko' ? `$${amt.toFixed(2)} 할인이 정상 적용되었습니다.` : `$${amt.toFixed(2)} discount has been applied successfully.`,
    requestRejectedTitle: language === 'ko' ? '사용 요청 거절됨' : 'Request Rejected',
    requestRejectedDesc: language === 'ko' ? '점장님이 요청을 거절하였습니다. 금액을 확인하거나 매장 직원에게 문의해 주세요.' : 'The store manager rejected your request. Please check the amount or contact staff.',
    
    // Bottom Tabs
    tabHome: language === 'ko' ? '홈 스탬프' : 'Home Stamps',
    tabImpact: language === 'ko' ? '나눔 기부대시보드' : 'Impact Dashboard',

    // Scan Warning Banner
    scanBanner: language === 'ko' ? '스탬프 적립을 위해 로그인 또는 회원가입을 완료해 주세요.' : 'Please login or sign up to claim your stamp reward.'
  };

  // --- 화면 탭 및 모달 상태 ---
  const [pwaTab, setPwaTab] = useState<'home' | 'impact'>('home');
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>(() => {
    const lastNum = localStorage.getItem('sharestamps_last_phone_number') || '';
    return formatUSPhoneNumber(lastNum);
  });
  const [loginFormError, setLoginFormError] = useState<string>('');
  
  // 스캔 선입력 상태 확인용 임시 상태 (배너용)
  const [hasPendingQR, setHasPendingQR] = useState<boolean>(() => !!localStorage.getItem('sharestamps_pending_qr_token'));
  
  // URL 또는 로컬스토리지 대기 중인 적립 매장명 계산
  const pendingScanStoreName = (() => {
    const token = localStorage.getItem('sharestamps_pending_qr_token');
    if (!token) return '';
    const scan = receiptScans.find(s => s.qrToken === token);
    if (!scan) return '';
    const store = stores.find(s => s.id === scan.storeId);
    return store ? store.name : '';
  })();
  
  // 가입 온보딩 상태
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registerForm, setRegisterForm] = useState({
    phoneNumber: '',
    nickname: '',
    name: '',
    job: '직장인',
    hobbies: [] as string[]
  });

  // 동의서 상태 관리
  const [agreements, setAgreements] = useState({
    authPhone: false,
    earnAnnounce: false,
    donationAnnounce: false,
    marketingPhone: false
  });

  const handleToggleAll = (checked: boolean) => {
    setAgreements({
      authPhone: checked,
      earnAnnounce: checked,
      donationAnnounce: checked,
      marketingPhone: checked
    });
  };

  const isAllAgreed = agreements.authPhone && agreements.earnAnnounce && agreements.donationAnnounce && agreements.marketingPhone;

  // SMS 인증 상태 관리
  const [isVerifyingSMS, setIsVerifyingSMS] = useState<boolean>(false);
  const [smsCode, setSmsCode] = useState<string>('');
  const [smsInput, setSmsInput] = useState<string>('');
  const [smsTimer, setSmsTimer] = useState<number>(180);
  const [smsError, setSmsError] = useState<string>('');
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [manualQrToken, setManualQrToken] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chatLogsContainerRef = useRef<HTMLDivElement | null>(null);



  useEffect(() => {
    let interval: any;
    if (isVerifyingSMS && smsTimer > 0) {
      interval = setInterval(() => {
        setSmsTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isVerifyingSMS, smsTimer]);

  // 점주 및 관리자 세션이 회원 PWA 화면에 남아있는 경우 자동 로그아웃 처리
  useEffect(() => {
    if (currentUser && currentUser.role !== 'customer') {
      logout();
    }
  }, [currentUser, logout]);

  // URL 쿼리 파라미터에서 스탬프 적립용 토큰 (?token=...) 검출 및 로컬 저장
  useEffect(() => {
    const parseUrlToken = () => {
      const url = window.location.href;
      let token = '';
      let storeId = '';
      let stampsCount = 1;
      let expiresAt = '';
      
      // 1. token 파라미터 추출
      const tokenMatch = url.match(/[?&]token=([^&/#]+)/);
      if (tokenMatch) {
        token = tokenMatch[1];
      }
      
      // 2. storeId 파라미터 추출
      const storeMatch = url.match(/[?&]storeId=([^&/#]+)/);
      if (storeMatch) {
        storeId = storeMatch[1];
      }
      
      // 3. stamps 파라미터 추출
      const stampsMatch = url.match(/[?&]stamps=([^&/#]+)/);
      if (stampsMatch) {
        stampsCount = parseInt(stampsMatch[1]) || 1;
      }
      
      // 4. expires 파라미터 추출
      const expiresMatch = url.match(/[?&]expires=([^&/#]+)/);
      if (expiresMatch) {
        expiresAt = decodeURIComponent(expiresMatch[1]);
      } else {
        expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 기본 10분
      }
      
      if (token && storeId) {
        localStorage.setItem('sharestamps_pending_qr_token', token);
        localStorage.setItem('sharestamps_pending_qr_store_id', storeId);
        localStorage.setItem('sharestamps_pending_qr_stamps', stampsCount.toString());
        localStorage.setItem('sharestamps_pending_qr_expires', expiresAt);
        setHasPendingQR(true);
        
        // 로그인 상태가 아닐 때만 비동기 등록 수행 (로그인 상태면 claimQRStamps에서 원자적으로 등록 및 적립 처리)
        if (!currentUser) {
          registerQRScan(token, storeId, stampsCount, expiresAt);
        }
        
        // URL에서 관련 파라미터들 깔끔하게 소거
        const cleanUrl = url
          .replace(/[?&]token=[^&/#]+/, '')
          .replace(/[?&]storeId=[^&/#]+/, '')
          .replace(/[?&]stamps=[^&/#]+/, '')
          .replace(/[?&]expires=[^&/#]+/, '');
          
        window.history.replaceState({}, document.title, cleanUrl);
        // Kiosk가 보낸 것과 동일하게 check-pending-qr 이벤트 디스패치
        window.dispatchEvent(new CustomEvent('check-pending-qr'));
      }
    };

    parseUrlToken();
    window.addEventListener('hashchange', parseUrlToken);
    return () => window.removeEventListener('hashchange', parseUrlToken);
  }, [registerQRScan, currentUser]);

  // QR 코드 스캔 선입력 처리 (Kiosk에서 넘어온 스캔 토큰 자동 처리)
  useEffect(() => {
    const checkPendingQR = () => {
      const pendingToken = localStorage.getItem('sharestamps_pending_qr_token');
      setHasPendingQR(!!pendingToken);
      
      if (currentUser && currentDeviceToken && pendingToken) {
        // 해당 토큰의 매장 정보를 조회하여 활성 매장을 자동으로 전환
        let scanStoreId = '';
        const scan = receiptScans.find(s => s.qrToken === pendingToken);
        if (scan) {
          scanStoreId = scan.storeId;
        } else {
          scanStoreId = localStorage.getItem('sharestamps_pending_qr_store_id') || '';
        }
        
        if (scanStoreId) {
          setSelectedStoreId(scanStoreId);
        }
        
        const res = claimQRStamps(pendingToken, currentDeviceToken);
        if (res.success) {
          setClaimMessage({ success: true, text: res.message });
          setTimeout(() => setClaimMessage(null), 3000);
        } else {
          setClaimMessage({ success: false, text: res.message });
          setTimeout(() => setClaimMessage(null), 3000);
        }
        localStorage.removeItem('sharestamps_pending_qr_token');
        localStorage.removeItem('sharestamps_pending_qr_store_id');
        localStorage.removeItem('sharestamps_pending_qr_stamps');
        localStorage.removeItem('sharestamps_pending_qr_expires');
        setHasPendingQR(false);
      }
    };

    checkPendingQR();

    window.addEventListener('check-pending-qr', checkPendingQR);
    return () => window.removeEventListener('check-pending-qr', checkPendingQR);
  }, [currentUser, currentDeviceToken, receiptScans, claimQRStamps]);

  const stopCameraScanner = () => {
    cameraStream?.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    setShowCameraScanner(false);
  };

  const handleScannedQrValue = (rawValue: string) => {
    const raw = rawValue.trim();
    if (!raw) return;

    const getParam = (name: string) => {
      const match = raw.match(new RegExp(`[?&]${name}=([^&/#]+)`));
      return match ? decodeURIComponent(match[1]) : '';
    };

    const token = getParam('token') || raw;
    const storeId = getParam('storeId');
    const stampsCount = parseInt(getParam('stamps'), 10) || 1;
    const expiresAt = getParam('expires') || new Date(Date.now() + 10 * 60 * 1000).toISOString();

    localStorage.setItem('sharestamps_pending_qr_token', token);
    if (storeId) {
      localStorage.setItem('sharestamps_pending_qr_store_id', storeId);
      localStorage.setItem('sharestamps_pending_qr_stamps', stampsCount.toString());
      localStorage.setItem('sharestamps_pending_qr_expires', expiresAt);
      if (!currentUser) {
        registerQRScan(token, storeId, stampsCount, expiresAt);
      }
    }

    setHasPendingQR(true);
    stopCameraScanner();
    window.dispatchEvent(new CustomEvent('check-pending-qr'));
  };

  const openCameraScanner = async () => {
    setCameraError('');
    setManualQrToken('');
    setShowSettingsMenu(false);
    setShowCameraScanner(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      setCameraStream(stream);
    } catch (err) {
      setCameraError(
        language === 'ko'
          ? '카메라를 열 수 없습니다. 브라우저 권한을 확인하거나 QR 토큰을 직접 입력해 주세요.'
          : 'Could not open the camera. Check browser permission or enter the QR token manually.'
      );
    }
  };

  useEffect(() => {
    if (!showCameraScanner || !cameraStream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = cameraStream;
    video.play().catch(() => undefined);
  }, [showCameraScanner, cameraStream]);

  useEffect(() => {
    if (!showCameraScanner || !cameraStream || !videoRef.current) return;

    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    const scanFrame = () => {
      if (cancelled || !videoRef.current) return;
      const video = videoRef.current;
      if (context && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            handleScannedQrValue(code.data);
            return;
          }
        } catch (err) {
          setCameraError(
            language === 'ko'
              ? 'QR? ???? ?? ?????. ???? QR? ??? ??? ??? ?? ??? ???.'
              : 'Could not read the QR automatically. Move closer or enter the token manually.'
          );
        }
      }
      requestAnimationFrame(scanFrame);
    };

    requestAnimationFrame(scanFrame);
    return () => {
      cancelled = true;
    };
  }, [showCameraScanner, cameraStream, language]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach(track => track.stop());
    };
  }, [cameraStream]);

  const handleSendSMSCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setSmsCode(code);
    setSmsInput('');
    setSmsTimer(180);
    setSmsError('');
    setIsVerifyingSMS(true);
    playVoiceGuidance(language === 'ko' ? "인증번호가 발송되었습니다." : "Verification code sent.", language);
  };

  const handleVerifySMS = (e: React.FormEvent) => {
    e.preventDefault();
    if (smsTimer === 0) {
      setSmsError(language === 'ko' ? "인증 시간이 만료되었습니다. 재발송해 주세요." : "Verification code expired. Please resend.");
      return;
    }
    if (smsInput !== smsCode) {
      setSmsError(language === 'ko' ? "인증번호가 일치하지 않습니다." : "Incorrect verification code.");
      playVoiceGuidance(language === 'ko' ? "인증번호가 틀렸습니다." : "Incorrect verification code.", language);
      return;
    }

    // 인증 성공 - 가입 처리 완료
    const userNickname = registerForm.nickname.trim();
    if (!userNickname) {
      setSmsError(language === 'ko' ? "사용할 닉네임이 입력되지 않았습니다." : "Nickname is required.");
      return;
    }

    const deviceTokenToSend = currentDeviceToken || localStorage.getItem('sharestamps_session_token') || `token_${Math.random().toString(36).substring(2)}`;

    try {
      registerUser(
        registerForm.phoneNumber,
        userNickname,
        userNickname, // 이름도 닉네임과 동일하게 설정
        deviceTokenToSend
      );
      
      // 상태 리셋 및 대시보드로 진입
      setIsVerifyingSMS(false);
      setIsRegistering(false);
    } catch (err: any) {
      setSmsError(err.message || '가입 처리 에러');
      alert(err.message || '가입 중 오류가 발생했습니다.');
    }
  };


  const [claimMessage, setClaimMessage] = useState<{ success: boolean; text: string } | null>(null);

  // 상점 선택
  const [selectedStoreId, setSelectedStoreIdState] = useState<string>(() => {
    return customerSelectedStoreId || 'store_id_1';
  });
  const [manualStoreBrowseId, setManualStoreBrowseId] = useState<string>('');
  const [pendingSharbeeOpenStoreId, setPendingSharbeeOpenStoreId] = useState<string>('');

  const setSelectedStoreId = (storeId: string) => {
    setSelectedStoreIdState(storeId);
    setCustomerSelectedStoreId(storeId);
  };
  
  // 클릭된 스탬프 슬롯 정보
  const [clickedStampIndex, setClickedStampIndex] = useState<number | null>(null);
  const [clickedStampDate, setClickedStampDate] = useState<string | null>(null);
  
  // 선택된 타임라인 기프트 상세 보기
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState<boolean>(false);
  const [, setShowStorelessDashboard] = useState<boolean>(false);

  // 로그인 또는 도장판 변동 시, 회원이 스탬프를 1장이라도 적립해 둔 매장을 자동으로 감지하여 활성화
  useEffect(() => {
    if (!currentUser) return;
    
    const userCards = stampCards.filter(c => c.userId === currentUser.id && c.currentStamps > 0);
    if (userCards.length > 0) {
      const currentStoreCard = stampCards.find(c => c.userId === currentUser.id && c.storeId === selectedStoreId);
      const currentStamps = currentStoreCard ? currentStoreCard.currentStamps : 0;
      
      if (selectedStoreId === 'store_id_1' && currentStamps === 0) {
        const sortedCards = [...userCards].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        setSelectedStoreId(sortedCards[0].storeId);
      }
    }
  }, [currentUser, stampCards, selectedStoreId]);

  // 상점 변경 시 클릭된 스탬프 초기화
  useEffect(() => {
    setClickedStampIndex(null);
    setClickedStampDate(null);
  }, [selectedStoreId]);
  
  // 빈 공간(도장판 외부) 클릭 시 툴팁 닫기
  useEffect(() => {
    if (clickedStampIndex === null) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.stamp-board-grid')) {
        setClickedStampIndex(null);
        setClickedStampDate(null);
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [clickedStampIndex]);
  
  // PWA 설치 바로가기 안내 상태
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaGuideModal, setShowPwaGuideModal] = useState<boolean>(false);
  const [showSharbeeReview, setShowSharbeeReview] = useState<boolean>(false);
  const [sharbeeStep, setSharbeeStep] = useState<'chat' | 'draft'>('chat');
  const [sharbeeLogs, setSharbeeLogs] = useState<{ sender: 'ai' | 'user'; text: string }[]>([]);
  const [sharbeeOptions, setSharbeeOptions] = useState<string[]>([]);
  const [sharbeeInput, setSharbeeInput] = useState<string>('');
  const [sharbeeDraft, setSharbeeDraft] = useState<string>('');
  const [sharbeeRating, setSharbeeRating] = useState<number>(0);
  const [sharbeePhotoUrl, setSharbeePhotoUrl] = useState<string>('');
  const [sharbeePhotoBlob, setSharbeePhotoBlob] = useState<Blob | null>(null);
  const [sharbeeVideoUrl, setSharbeeVideoUrl] = useState<string>('');
  const [sharbeeVideoFile, setSharbeeVideoFile] = useState<File | null>(null);
  const [sharbeeVideoName, setSharbeeVideoName] = useState<string>('');
  const [sharbeeMediaError, setSharbeeMediaError] = useState<string>('');
  const [sharbeeSubmitting, setSharbeeSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (chatLogsContainerRef.current) {
      chatLogsContainerRef.current.scrollTop = chatLogsContainerRef.current.scrollHeight;
    }
  }, [sharbeeLogs]);


  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const phoneScreen = document.querySelector('.phone-screen') as HTMLElement;
    if (phoneScreen) {
      if (showSharbeeReview) {
        phoneScreen.style.overflowY = 'hidden';
      } else {
        phoneScreen.style.overflowY = 'auto';
      }
    }
    return () => {
      if (phoneScreen) {
        phoneScreen.style.overflowY = 'auto';
      }
    };
  }, [showSharbeeReview]);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    } else {
      setShowPwaGuideModal(true);
    }
  };
  




  // 선물 모달 바텀 시트
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [friendQuery, setFriendQuery] = useState<string>('');
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [giftStampsCount, setGiftStampsCount] = useState<number>(1);
  const [giftMessage, setGiftMessage] = useState<string>('');
  const [giftResult, setGiftResult] = useState<{ transferred: number; returned: number } | null>(null);

  // 기부 모달 바텀 시트
  const [showDonateModal, setShowDonateModal] = useState<boolean>(false);
  const [selectedNpoId, setSelectedNpoId] = useState<string>('npo_1');
  const [donateStampsCount, setDonateStampsCount] = useState<number>(1);
  const [donateResult, setDonateResult] = useState<number | null>(null);

  // 스탬프 캐시 사용 요청 모달
  const [showPaymentRequestModal, setShowPaymentRequestModal] = useState<boolean>(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [requestAmountInput, setRequestAmountInput] = useState<string>('5.00');
  const [useType, setUseType] = useState<'full' | 'partial'>('full');
  const [paymentTarget, setPaymentTarget] = useState<'self' | 'donation'>('self');
  const [selectedRequestNpoId, setSelectedRequestNpoId] = useState<string>('npo_1');

  // 내 어카운트 정보 모달
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);




 
  // 스탬프 캐시 즉시 기부용 상태 변수
  const [directDonateAmount, setDirectDonateAmount] = useState<string>('5.00');
  const [directDonateNpo, setDirectDonateNpo] = useState<string>('npo_1');
  const [showDirectDonateForm, setShowDirectDonateForm] = useState<boolean>(false);
  const [directDonateResult, setDirectDonateResult] = useState<number | null>(null);

  // 스탬프 선물/기부 통합 패널용 상태 변수
  const [showGiftingPanel, setShowGiftingPanel] = useState<boolean>(false);
  const [giftingActiveTab, setGiftingActiveTab] = useState<'earn' | 'friend' | 'npo'>('friend');
  const [giftingStampCount, setGiftingStampCount] = useState<number>(1);
  const [giftingRecipientId, setGiftingRecipientId] = useState<string>('');
  const [giftingFriendQuery, setGiftingFriendQuery] = useState<string>('');
  const [giftingNpoId, setGiftingNpoId] = useState<string>('npo_1');
  const [giftingMessage, setGiftingMessage] = useState<string>('');
  const [giftingSuccessMessage, setGiftingSuccessMessage] = useState<string | null>(null);
  
  // 수신자 선물 감사 멘트 입력용 맵 (giftId -> thanksMessage)
  const [giftThanksMessages, setGiftThanksMessages] = useState<Record<string, string>>({});
  const pendingGifts = currentUser ? gifts.filter(g => g.recipientId === currentUser.id && g.status === 'pending') : [];

  // 기부 단체 목록이 갱신되면 유효한 기본값으로 자동 재설정
  useEffect(() => {
    const activeNpos = nonProfits.filter(n => n.status === 'active');
    if (activeNpos.length > 0) {
      const activeIds = activeNpos.map(n => n.id);
      if (!activeIds.includes(selectedNpoId)) {
        setSelectedNpoId(activeNpos[0].id);
      }
      if (!activeIds.includes(selectedRequestNpoId)) {
        setSelectedRequestNpoId(activeNpos[0].id);
      }
      if (!activeIds.includes(directDonateNpo)) {
        setDirectDonateNpo(activeNpos[0].id);
      }
      if (!activeIds.includes(giftingNpoId)) {
        setGiftingNpoId(activeNpos[0].id);
      }
    }
  }, [nonProfits, selectedNpoId, selectedRequestNpoId, directDonateNpo, giftingNpoId]);

  // 선물하기 패널 토글 시 입력 필드 및 친구 검색어 리셋
  useEffect(() => {
    if (!showGiftingPanel) {
      setGiftingFriendQuery('');
      setGiftingRecipientId('');
      setGiftingMessage('');
    }
  }, [showGiftingPanel]);

  const handleConvertStampsToCash = () => {
    if (!currentUser) return;
    try {
      const res = convertStampsToCash(currentUser.id, selectedStoreId);
      if (res.success) {
        setGiftingSuccessMessage(res.message);
        playVoiceGuidance(language === 'ko' ? '스탬프 캐시 적립 완료' : 'Redeemed stamp cash successfully');
        setTimeout(() => {
          setShowGiftingPanel(false);
          setGiftingSuccessMessage(null);
        }, 2000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  };

  const handleSendGiftToFriend = () => {
    if (!currentUser) return;
    if (!giftingRecipientId) {
      alert(language === 'ko' ? '선물받을 친구를 선택해 주세요.' : 'Please select a friend.');
      return;
    }
    if (!giftingMessage.trim()) {
      alert(language === 'ko' ? '선물 메시지를 입력해 주세요 (필수).' : 'Please enter a gift message (required).');
      return;
    }
    try {
      const res = giftStamps(currentUser.id, giftingRecipientId, selectedStoreId, giftingStampCount, giftingMessage);
      setGiftingSuccessMessage(
        language === 'ko'
          ? `성공! 스탬프 ${res.transferred}개가 전송 대기되었습니다.`
          : `Success! ${res.transferred} stamps queued.`
      );
      setGiftingMessage('');
      setTimeout(() => {
        setGiftingSuccessMessage(null);
        setShowGiftingPanel(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendGiftToNpo = () => {
    if (!currentUser) return;
    try {
      donateStamps(currentUser.id, selectedStoreId, giftingNpoId, giftingStampCount);
      setGiftingSuccessMessage(
        language === 'ko'
          ? `기부 단체에 스탬프 ${giftingStampCount}개가 전송되었습니다.`
          : `${giftingStampCount} stamps sent to NPO.`
      );
      setTimeout(() => {
        setGiftingSuccessMessage(null);
        setShowGiftingPanel(false);
      }, 2000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentRequest = currentRequestId 
    ? paymentRequests.find(r => r.id === currentRequestId)
    : null;

  // 자동 복구 및 승인/거절 처리 타이머
  useEffect(() => {
    if (currentUser) {
      const pendingReq = paymentRequests.find(r => r.userId === currentUser.id && r.storeId === selectedStoreId && r.status === 'pending');
      if (pendingReq) {
        setCurrentRequestId(pendingReq.id);
        setShowPaymentRequestModal(true);
      }
    }
  }, [currentUser?.id, selectedStoreId, paymentRequests]);

  useEffect(() => {
    if (currentRequest?.status === 'approved') {
      const timer = setTimeout(() => {
        setShowPaymentRequestModal(false);
        setCurrentRequestId(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
    if (currentRequest?.status === 'rejected') {
      const timer = setTimeout(() => {
        setShowPaymentRequestModal(false);
        setCurrentRequestId(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentRequest?.status]);


  const hasStoreActivity = currentUser ? (
    stampCards.some(c => c.userId === currentUser.id && ((c.currentStamps || 0) > 0 || (c.stamps?.length || 0) > 0)) ||
    storePoints.some(p => p.userId === currentUser.id && (p.pointsBalance || 0) > 0) ||
    stampTransactions.some(tx => tx.userId === currentUser.id) ||
    pointTransactions.some(tx => tx.userId === currentUser.id) ||
    paymentRequests.some(req => req.userId === currentUser.id)
  ) : false;
  const hasQrStoreContext = hasPendingQR || !!localStorage.getItem('sharestamps_pending_qr_store_id');
  const isUnassignedStoreView = !!currentUser && !hasStoreActivity && !hasQrStoreContext && !manualStoreBrowseId;
  const shouldShowNoStoreIntro = false;
  const isStorelessDashboard = false;

  // 매장 및 사용자 스탬프 정보 추출
  const selectedStore = isUnassignedStoreView
    ? { id: 'unassigned', name: t.unassignedStoreName, category: 'none', pointRewardPer7Stamps: 0, currency: 'USD', earningIntervalMinutes: 0, ownerId: 'none' }
    : (stores.find(s => s.id === selectedStoreId) || stores[0] || { id: 'store_id_1', name: 'ShareStamps 매장', category: 'cafe', pointRewardPer7Stamps: 5, currency: 'USD', earningIntervalMinutes: 60, ownerId: 'none' });
  
  const userCard = currentUser && !isUnassignedStoreView ? stampCards.find(c => c.userId === currentUser.id && c.storeId === selectedStoreId) : null;
  const currentStamps = userCard ? userCard.currentStamps : 0;
  
  const currentStampsSum = userCard && userCard.stamps
    ? userCard.stamps.slice(0, currentStamps).reduce((sum, s) => sum + s.cashValue, 0)
    : (selectedStore.pointRewardPer7Stamps / 7) * currentStamps;
  
  const pointsBalance = currentUser && !isUnassignedStoreView
    ? (storePoints.find(p => p.userId === currentUser.id && p.storeId === selectedStoreId)?.pointsBalance || 0.00)
    : 0.00;

  const getSharbeeMenuOptions = () => {
    const menuNames = (((selectedStore as any).menuItems || []) as { name?: string }[])
      .map(item => item.name || '')
      .filter(Boolean)
      .slice(0, 4);
    const fallbackMenus = language === 'ko'
      ? ['\uB300\uD45C \uBA54\uB274', '\uC624\uB298\uC758 \uCD94\uCC9C \uBA54\uB274', '\uC778\uAE30 \uBA54\uB274', '\uC0C8\uB85C \uB098\uC628 \uBA54\uB274']
      : ['Signature menu', "Today's recommendation", 'Popular menu', 'New menu'];
    return [...menuNames, ...fallbackMenus].slice(0, 4);
  };

  const getJosa = (word: string, josa1: string, josa2: string) => {
    if (!word) return josa1;
    const lastChar = word.charCodeAt(word.length - 1);
    if (lastChar >= 0xAC00 && lastChar <= 0xD7A3) {
      return (lastChar - 0xAC00) % 28 > 0 ? josa1 : josa2;
    }
    return josa2;
  };

  const getSharbeeFollowup = (userMessageCount: number, lastAnswer: string) => {
    if (userMessageCount === 1) {
      const josa = getJosa(lastAnswer, '을', '를');
      return {
        question: language === 'ko'
          ? `오! ${lastAnswer}${josa} 맛있게 드셨군요! 정말 탁월한 선택이십니다. 😋\n\n오늘 식사하신 ${lastAnswer}의 맛, 식재료의 신선함, 혹은 비주얼(모양) 중 어떤 점이 가장 기억에 남으셨나요?`
          : `Wow, having ${lastAnswer} sounds like a delicious choice! 🐝\n\nWhat stood out to you the most about its flavor, fresh ingredients, or presentation?`,
        options: language === 'ko'
          ? ['맛이 깊고 조화로웠어요', '재료가 신선하게 느껴졌어요', '비주얼/담음새가 예뻤어요', '기대보다 대만족이었어요']
          : ['The flavor was rich & balanced', 'The ingredients felt super fresh', 'The presentation was beautiful', 'Better than I ever expected']
      };
    }
    if (userMessageCount === 2) {
      let reaction = '';
      if (language === 'ko') {
        if (lastAnswer.includes('바삭')) {
          reaction = '우와, 겉은 바삭하고 속은 촉촉한 그 식감! 튀김 요리의 매력을 제대로 살린 맛이었나 보네요. 정말 군침이 도는 묘사입니다! 😋';
        } else if (lastAnswer.includes('맛') || lastAnswer.includes('조화') || lastAnswer.includes('깔끔') || lastAnswer.includes('깊')) {
          reaction = '맛의 밸런스가 깔끔하고 아주 훌륭했나 봐요! 입안 가득 감도는 풍미와 깊이가 고스란히 느껴집니다. 👍';
        } else if (lastAnswer.includes('재료') || lastAnswer.includes('신선')) {
          reaction = '역시 훌륭한 음식은 신선한 재료에서부터 시작되죠! 그 신선한 식감을 눈치채시다니 정말 섬세한 미식가이시네요. 🌿';
        } else if (lastAnswer.includes('모양') || lastAnswer.includes('예뻐') || lastAnswer.includes('비주얼') || lastAnswer.includes('담음새')) {
          reaction = '눈으로 먼저 먹고, 입으로 두 번 즐기셨군요! 사진을 절로 부르는 예쁜 플레이팅 덕분에 식사 자리가 한층 더 특별해졌겠어요. 📸';
        } else if (lastAnswer.includes('기대') || lastAnswer.includes('만족') || lastAnswer.includes('최고')) {
          reaction = '기대하셨던 것보다 훨씬 뛰어난 기쁨을 드렸다니 제가 다 뿌듯합니다. 오늘 완벽한 초이스를 하셨네요! ✨';
        } else {
          reaction = `"${lastAnswer}"(이)라니 정말 멋지네요! 상세하게 기억해주신 정성 가득한 답변이 매장에도 정말 큰 힘이 될 거예요. 🧡`;
        }
      } else {
        const lower = lastAnswer.toLowerCase();
        if (lower.includes('crispy') || lower.includes('crunch')) {
          reaction = 'Wow, that perfect crispy texture! It sounds like the crunch was absolutely spot on. 😋';
        } else if (lower.includes('flavor') || lower.includes('taste') || lower.includes('rich')) {
          reaction = "I'm so glad the flavor was balanced and clean! Sounds like a wonderful taste experience. 👍";
        } else if (lower.includes('fresh') || lower.includes('ingredient')) {
          reaction = 'Fresh ingredients make all the difference! You have a great palate to appreciate that freshness. 🌿';
        } else if (lower.includes('beautiful') || lower.includes('presentation') || lower.includes('look')) {
          reaction = 'Eating with your eyes first is always a delight! A beautiful presentation makes the meal feel special. 📸';
        } else if (lower.includes('expect') || lower.includes('satisfy') || lower.includes('great')) {
          reaction = "Exceeding your expectations is the best feedback! I'm thrilled it brought you so much satisfaction. ✨";
        } else {
          reaction = `"${lastAnswer}" sounds wonderful! Thank you for sharing such a nice detail. 🧡`;
        }
      }

      return {
        question: language === 'ko'
          ? `${reaction}\n\n오늘 식사의 맛과 기분 좋은 기운을 더해, 가격 대비 전체적인 만족감(가성비와 경험)은 어떻게 느끼셨나요?`
          : `${reaction}\n\nWith that great feeling in mind, when considering both the price and the overall experience, how satisfying did it feel?`,
        options: language === 'ko'
          ? ['가격 대비 엄청 만족스러웠어요', '나에게 아깝지 않은 가치 있는 소비였어요', '주변에 자신 있게 권할 만한 가격이에요', '소소한 행복을 주는 힐링 타임이었어요']
          : ['Extremely satisfied for the price', 'It felt worth every penny spent', 'Great quality that is easy to recommend', 'A healing experience that felt like a treat']
      };
    }
    if (userMessageCount === 3) {
      let reaction = '';
      if (language === 'ko') {
        if (lastAnswer.includes('가격') || lastAnswer.includes('대비') || lastAnswer.includes('만족') || lastAnswer.includes('가성비')) {
          reaction = '와! 가격과 퀄리티를 모두 잡은 똑똑하고 만족스러운 소비를 하셨네요. 맛있는 가성비는 언제나 즐겁죠! 💰';
        } else if (lastAnswer.includes('가치') || lastAnswer.includes('소비') || lastAnswer.includes('돈') || lastAnswer.includes('아깝')) {
          reaction = '돈이 아깝지 않은 소중한 가치를 느끼셨다니 정말 다행입니다. 스스로에게 아주 멋진 선물을 주셨어요. 💎';
        } else if (lastAnswer.includes('권할') || lastAnswer.includes('추천')) {
          reaction = '주변에 칭찬하며 공유하고 싶을 만큼 훌륭했다니, 그 마음이 매장 점주님께도 아주 큰 행복으로 전달될 거예요. 💌';
        } else if (lastAnswer.includes('힐링') || lastAnswer.includes('선물') || lastAnswer.includes('행복')) {
          reaction = '식사 한 끼가 바쁜 일상 속 작은 쉼표이자 따뜻한 위로가 되었다니 정말 낭만적입니다. 힐링이 되셨다니 행복하네요. 🎁';
        } else if (lastAnswer.includes('별로') || lastAnswer.includes('아쉽') || lastAnswer.includes('부족')) {
          reaction = '아, 아쉬운 부분이 있으셨군요. 솔직한 의견 덕분에 매장이 더 성장할 수 있는 소중한 밑거름이 될 것입니다. 😢';
        } else {
          reaction = `오, "${lastAnswer}"라고 느껴주셨군요! 이렇게 솔직한 만족도를 표현해주셔서 마음이 든든합니다. 😊`;
        }
      } else {
        const lower = lastAnswer.toLowerCase();
        if (lower.includes('satisfy') || lower.includes('price') || lower.includes('worth')) {
          reaction = 'A wallet-friendly and satisfying meal is always a win! Glad it felt worth it. 💰';
        } else if (lower.includes('value') || lower.includes('spend') || lower.includes('penny')) {
          reaction = "It's wonderful when a meal feels like a truly valuable and meaningful choice. 💎";
        } else if (lower.includes('recommend') || lower.includes('share')) {
          reaction = 'Wanting to recommend us to others is the ultimate compliment! 💌';
        } else if (lower.includes('healing') || lower.includes('treat') || lower.includes('happy')) {
          reaction = 'Hearing that it felt like a little gift in your day warms my heart! 🎁';
        } else if (lower.includes('bad') || lower.includes('poor') || lower.includes('disappoint') || lower.includes('dislike')) {
          reaction = 'Oh, I am sorry to hear that. Your honest feedback is highly valued and will help the store improve. 😢';
        } else {
          reaction = `Oh, you felt "${lastAnswer}"! Thank you for sharing your genuine experience. 😊`;
        }
      }

      return {
        question: language === 'ko'
          ? `${reaction}\n\n이처럼 기분 좋은 만족감을 간직하신 채, 혹시 소중한 사람에게 이 매장을 추천해주거나 조만간 기쁜 마음으로 재방문하고 싶으신가요?`
          : `${reaction}\n\nHolding onto that positive energy, would you want to recommend this store to someone close or visit again soon?`,
        options: language === 'ko'
          ? ['친한 친구에게 얼른 추천하고 싶어요', '소중한 가족들과 꼭 다시 오고 싶어요', '언제든 나만의 힐링 단골집으로 또 올래요', '다음엔 점 찍어둔 다른 메뉴도 먹어볼래요']
          : ['I want to recommend it to a close friend', 'I want to come back with my beloved family', 'I will definitely return as a regular customer', 'I want to try another menu item next time']
      };
    }

    if (userMessageCount === 4) {
      let reaction = '';
      if (language === 'ko') {
        if (lastAnswer.includes('친구') || lastAnswer.includes('지인') || lastAnswer.includes('추천')) {
          reaction = '소중한 친구의 손을 잡고 함께 오신다니 최고의 찬사네요! 맛있는 건 나눠 먹을 때 더 행복해지는 법이죠. 👭';
        } else if (lastAnswer.includes('가족') || lastAnswer.includes('부모') || lastAnswer.includes('아이') || lastAnswer.includes('아내') || lastAnswer.includes('남편')) {
          reaction = '가장 사랑하는 가족을 떠올리며 다시 오고 싶어 하시다니, 듣기만 해도 가슴 한구석이 몽글몽글해지는 기분이에요. 👨‍👩‍👧‍👦';
        } else if (lastAnswer.includes('단골') || lastAnswer.includes('혼자') || lastAnswer.includes('또 올래')) {
          reaction = '언제든 편안하게 들릴 수 있는 나만의 포근한 비밀 아지트가 생긴 셈이네요! 늘 환하게 맞이할 준비를 해둘게요. 🏠';
        } else if (lastAnswer.includes('다른') || lastAnswer.includes('메뉴') || lastAnswer.includes('먹어')) {
          reaction = '다음 도장 깨기 타겟 메뉴는 무엇일지 궁금하네요! 매번 새로움을 발견하는 즐거움이 가득할 겁니다. 🎯';
        } else if (lastAnswer.includes('별로') || lastAnswer.includes('글쎄')) {
          reaction = '조금 조심스러우시군요. 다음 방문 때는 훨씬 더 나은 완벽한 만족을 드릴 수 있도록 꼭 보완하겠습니다. 💪';
        } else {
          reaction = `와, "${lastAnswer}"라는 다정한 답변에 매장 곳곳이 훈훈한 온기로 가득 찰 것 같습니다. 정말 감사합니다! 🐝`;
        }
      } else {
        const lower = lastAnswer.toLowerCase();
        if (lower.includes('friend') || lower.includes('recommend')) {
          reaction = 'Recommending us to a friend is the best gift we could ask for! Sharing is caring. 👭';
        } else if (lower.includes('family') || lower.includes('parent') || lower.includes('kid') || lower.includes('spouse')) {
          reaction = 'Thinking of family for your next visit is so heartwarming. We would love to host your loved ones! 👨‍👩‍👧‍👦';
        } else if (lower.includes('regular') || lower.includes('solo') || lower.includes('return') || lower.includes('myself')) {
          reaction = "It's indeed the perfect spot for a cozy solo retreat. We will always keep a warm table ready. 🏠";
        } else if (lower.includes('other') || lower.includes('menu') || lower.includes('try')) {
          reaction = "I'm already excited to see which menu item will capture your heart next! 🎯";
        } else if (lower.includes('dislike') || lower.includes('not really') || lower.includes('maybe')) {
          reaction = 'I understand. We will work harder to ensure your next visit is absolutely flawless. 💪';
        } else {
          reaction = `Wow, hearing you say "${lastAnswer}" gives us so much energy and warmth! Thank you! 🐝`;
        }
      }

      return {
        question: language === 'ko'
          ? `${reaction}\n\n대화가 깊어져 정말 즐겁네요. 마지막으로 오늘 매장에서 마주했던 친절함이나, 소소한 즐거움 등 기억에 남는 에피소드가 더 있다면 자유롭게 들려주시겠어요?`
          : `${reaction}\n\nIt's been wonderful talking to you! Finally, is there any other small detail, kind staff story, or memorable moment you'd like to share?`,
        options: language === 'ko'
          ? ['매장 분위기가 참 다정하고 좋았어요', '직원분이 상냥하게 응대해주셨어요', '특별히 기억에 남는 순간이 있었어요', '이제 정성스런 리뷰 작성을 완료할게요']
          : ['The shop atmosphere was warm & cozy', 'The staff was incredibly kind & helpful', 'There was a very special moment today', 'I am ready to finalize my review now']
      };
    }

    // userMessageCount >= 5: Infinite dynamic conversation loop
    const rotationQuestionsKo = [
      "정말 흥미로운 이야기네요! 그 순간 매장의 분위기나 배경 음악은 어땠나요?",
      "오, 그런 세부적인 디테일까지 기억하시다니 멋지네요! 혹시 그 메뉴를 즐기실 때 곁들였던 음료나 다른 음식이 있었나요?",
      "듣다 보니 점점 더 궁금해지네요! 만약 다음 방문 때 또 다른 메뉴를 고른다면, 가장 먼저 먹어보고 싶은 후보는 무엇인가요?",
      "그렇군요! 혹시 이 매장의 조명이나 좌석, 혹은 인테리어에서 특별히 편안하다고 느껴진 부분이 있었나요?",
      "소중한 경험을 나누어 주셔서 감사합니다. 혹시 오늘 매장을 나서면서 느꼈던 전반적인 공기나 온도, 혹은 청결 상태는 만족스러우셨나요?",
      "와, 들을수록 매력적인 공간이네요! 혹시 사장님이나 직원분들께 전하고 싶은 응원의 한마디나 바라는 점이 있으실까요?",
      "정말 생생하게 설명해주셔서 감사합니다! 혹시 이 매장만의 가장 독특한 매력을 한 단어(혹은 짧은 문구)로 표현해 보신다면 무엇일까요?"
    ];

    const rotationQuestionsEn = [
      "That sounds fascinating! What was the background music or overall vibe of the store like at that moment?",
      "Wow, you have a great eye for detail! Did you pair your food with any specific drink or side dish?",
      "I'm getting more and more curious! If you were to choose another menu item on your next visit, what would be your top pick?",
      "I see! Did any specific part of the lighting, seating, or interior design make you feel particularly comfortable?",
      "Thank you for sharing. Were you satisfied with the overall cleanliness, temperature, or atmosphere of the shop?",
      "The more I hear, the more charming this place sounds! Is there any message of support or suggestion you'd like to leave for the staff or owner?",
      "Thank you for the vivid description! If you had to describe the unique charm of this place in just one word or phrase, what would it be?"
    ];

    const rotationOptionsKo = [
      ['잔잔하고 조용한 분위기였어요', '밝고 활기찬 음악이 좋았어요', '대화하기 편안한 무드였어요', '음악 소리가 조금 컸지만 괜찮았어요'],
      ['시원한 탄산음료와 찰떡이었어요', '향긋한 커피/차가 잘 어울렸어요', '기본 반찬이 깔끔하고 잘 어울렸어요', '음식 단독으로도 충분히 맛있었어요'],
      ['이 매장의 시그니처 대표 메뉴요', '가장 기본적이고 클래식한 메뉴요', '달콤하거나 든든한 디저트류요', '아직 안 먹어본 새로운 추천 메뉴요'],
      ['의자가 푹신하고 편안해서 좋았어요', '따뜻하고 아늑한 조명이 맘에 들었어요', '공간이 넓고 탁 트여서 쾌적했어요', '아기자기한 소품 구경이 재밌었어요'],
      ['테이블과 바닥이 아주 깨끗했어요', '실내 온도가 쾌적하고 시원했어요', '식기류가 깔끔하게 관리되어 좋았어요', '정돈이 잘 되어 믿음이 갔어요'],
      ['친절하게 미소로 맞아주셔서 감사해요', '변치 말고 오랫동안 번창하세요!', '맛있는 음식 준비해주셔서 고맙습니다', '조만간 또 올게요, 파이팅!'],
      ['일상 속 작은 쉼터', '나만 알고 싶은 아지트', '믿고 먹는 맛집', '친절함 가득한 공간']
    ];

    const rotationOptionsEn = [
      ['It was quiet and peaceful', 'I liked the bright, lively music', 'Comfortable mood for chatting', 'Music was a bit loud but okay'],
      ['Perfect with a cold soda', 'Well paired with coffee/tea', 'The side dishes were clean and fit well', 'The main dish was great on its own'],
      ['The signature menu item', 'The most basic and classic option', 'A sweet or filling dessert', 'A new recommended item'],
      ['Seating was soft and cozy', 'Warm and comforting lighting', 'Spacious and breezy layout', 'Fun looking at cute decors'],
      ['Table and floor were super clean', 'Indoor temperature was cool and pleasant', 'Utensils were hygienic and neat', 'Well organized and trustworthy'],
      ['Thank you for welcoming with a smile', 'Hope you prosper for a long time!', 'Thank you for preparing great food', 'See you soon again, fighting!'],
      ['A small haven in daily life', 'A hideout I want to keep secret', 'A trusty place for great taste', 'A place full of warmth']
    ];

    const qIndex = (userMessageCount - 5) % rotationQuestionsKo.length;
    const questionText = language === 'ko' ? rotationQuestionsKo[qIndex] : rotationQuestionsEn[qIndex];
    const optionsArray = language === 'ko' ? rotationOptionsKo[qIndex] : rotationOptionsEn[qIndex];

    let reaction = '';
    if (language === 'ko') {
      const lowerAnswer = lastAnswer.toLowerCase();
      if (lowerAnswer.includes('분위기') || lowerAnswer.includes('조용') || lowerAnswer.includes('음악') || lowerAnswer.includes('잔잔') || lowerAnswer.includes('활기')) {
        reaction = '공간의 소리와 어우러지는 분위기를 편안하게 만끽하셨군요. 음악과 대화가 머무는 따뜻한 시간이 머릿속에 그려집니다. 🎵';
      } else if (lowerAnswer.includes('음료') || lowerAnswer.includes('커피') || lowerAnswer.includes('탄산') || lowerAnswer.includes('반찬') || lowerAnswer.includes('조합')) {
        reaction = '음식은 곁들이는 조합에 따라 매력이 달라지죠! 꿀조합을 찾아내어 더욱 풍성한 맛을 즐기셨다니 대단하십니다. 🍹';
      } else if (lowerAnswer.includes('대표') || lowerAnswer.includes('시그니처') || lowerAnswer.includes('메뉴') || lowerAnswer.includes('추천') || lowerAnswer.includes('디저트')) {
        reaction = '다음 방문의 기대감까지 품게 만드는 멋진 메뉴 구성이네요! 벌써부터 다음의 새로운 맛이 기대됩니다. 🎯';
      } else if (lowerAnswer.includes('의자') || lowerAnswer.includes('조명') || lowerAnswer.includes('인테리어') || lowerAnswer.includes('소품') || lowerAnswer.includes('아늑')) {
        reaction = '머무는 공간의 편안함은 머무는 시간조차 더 소중하게 만들어 주죠. 작은 인테리어 배려까지 느껴지다니 매력적입니다. 🛋️';
      } else if (lowerAnswer.includes('깨끗') || lowerAnswer.includes('청결') || lowerAnswer.includes('위생') || lowerAnswer.includes('쾌적') || lowerAnswer.includes('식기')) {
        reaction = '역시 믿고 머무를 수 있는 청결함과 쾌적함이 돋보였군요! 깨끗하게 관리된 매장은 늘 안심을 줍니다. ✨';
      } else if (lowerAnswer.includes('친절') || lowerAnswer.includes('미소') || lowerAnswer.includes('감사') || lowerAnswer.includes('응원') || lowerAnswer.includes('파이팅') || lowerAnswer.includes('고맙')) {
        reaction = '따뜻한 응원과 마음이 담긴 한마디네요! 사장님과 직원분들께 이 따뜻한 메시지가 전달되면 정말 행복하실 거예요. 💛';
      } else {
        reaction = `"${lastAnswer}"(이)라는 멋진 이야기군요! 고객님의 대답 하나하나가 이 매장의 깊이를 채워주는 귀중한 보물입니다. 💎`;
      }
    } else {
      const lowerAnswer = lastAnswer.toLowerCase();
      if (lowerAnswer.includes('vibe') || lowerAnswer.includes('music') || lowerAnswer.includes('quiet') || lowerAnswer.includes('atmosphere')) {
        reaction = 'It sounds like you truly absorbed the atmosphere. I can picture a cozy time filled with music and pleasant chat. 🎵';
      } else if (lowerAnswer.includes('drink') || lowerAnswer.includes('coffee') || lowerAnswer.includes('soda') || lowerAnswer.includes('side') || lowerAnswer.includes('pair')) {
        reaction = 'A meal is always elevated by the right pairings! Great job finding the perfect combo to enrich the taste. 🍹';
      } else if (lowerAnswer.includes('signature') || lowerAnswer.includes('menu') || lowerAnswer.includes('recommend') || lowerAnswer.includes('dessert')) {
        reaction = "It's wonderful how a menu keeps you excited for your next visit! I'm already looking forward to your next choice. 🎯";
      } else if (lowerAnswer.includes('chair') || lowerAnswer.includes('seating') || lowerAnswer.includes('light') || lowerAnswer.includes('interior') || lowerAnswer.includes('decor')) {
        reaction = 'A comfortable space makes the time spent there even more precious. It is great you noticed the thoughtful decor. 🛋️';
      } else if (lowerAnswer.includes('clean') || lowerAnswer.includes('hygiene') || lowerAnswer.includes('neat') || lowerAnswer.includes('table') || lowerAnswer.includes('floor')) {
        reaction = 'Cleanliness and comfort are key to a great experience! A well-maintained place always brings peace of mind. ✨';
      } else if (lowerAnswer.includes('kind') || lowerAnswer.includes('smile') || lowerAnswer.includes('thank') || lowerAnswer.includes('support') || lowerAnswer.includes('friendly')) {
        reaction = 'Such a warm message of support! The owner and staff will be absolutely thrilled to receive this kindness from you. 💛';
      } else {
        reaction = `"${lastAnswer}" is such a lovely story! Every detail you share adds depth to this shop's narrative. 💎`;
      }
    }

    return {
      question: `${reaction}\n\n${questionText}`,
      options: optionsArray
    };
  };


  const openSharbeeReview = () => {
    setSharbeeStep('chat');
    setSharbeeInput('');
    setSharbeeDraft('');
    setSharbeeRating(0);
    setSharbeePhotoUrl('');
    setSharbeePhotoBlob(null);
    setSharbeeVideoUrl('');
    setSharbeeVideoFile(null);
    setSharbeeVideoName('');
    setSharbeeMediaError('');
    setSharbeeLogs([{ 
      sender: 'ai', 
      text: language === 'ko' 
        ? `안녕하세요, 저는 샤비예요 🐝\n오늘 ${selectedStore.name}에 와서 무엇을 드셨나요?` 
        : `Hi, I'm Sharbee 🐝\nWhat did you have at ${selectedStore.name} today?` 
    }]);
    setSharbeeOptions(getSharbeeMenuOptions());
    setShowSharbeeReview(true);
  };

  useEffect(() => {
    if (!currentUser) return;

    const pendingStoreId = localStorage.getItem('sharestamps_open_sharbee_review_store_id');
    if (!pendingStoreId) return;
    if (!stores.some(store => store.id === pendingStoreId)) return;

    localStorage.removeItem('sharestamps_open_sharbee_review_store_id');
    setManualStoreBrowseId(pendingStoreId);
    setSelectedStoreId(pendingStoreId);
    setClaimMessage(null);
    setPendingSharbeeOpenStoreId(pendingStoreId);
  }, [currentUser, stores]);

  useEffect(() => {
    if (!pendingSharbeeOpenStoreId || selectedStoreId !== pendingSharbeeOpenStoreId) return;

    const timer = window.setTimeout(() => {
      openSharbeeReview();
      setPendingSharbeeOpenStoreId('');
    }, 80);

    return () => window.clearTimeout(timer);
  }, [pendingSharbeeOpenStoreId, selectedStoreId, selectedStore.name, language]);

  const handleSharbeePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSharbeeMediaError('');

    const reader = new FileReader();
    reader.onload = readerEvent => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 900;
        let { width, height } = image;

        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const context = canvas.getContext('2d');
        context?.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return;
          setSharbeePhotoBlob(blob);
          setSharbeePhotoUrl(URL.createObjectURL(blob));
        }, 'image/jpeg', 0.72);
      };
      image.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSharbeeVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > SHARBEE_MAX_VIDEO_BYTES) {
      setSharbeeMediaError(language === 'ko' ? '\uB3D9\uC601\uC0C1 \uD30C\uC77C\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4. 15\uCD08 \uC774\uB0B4\uC758 \uC9E7\uC740 \uC601\uC0C1\uC73C\uB85C \uB2E4\uC2DC \uC120\uD0DD\uD574\uC8FC\uC138\uC694.' : 'The video file is too large. Please choose a short video under 15 seconds.');
      event.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration > SHARBEE_MAX_VIDEO_SECONDS + 0.3) {
        URL.revokeObjectURL(objectUrl);
        setSharbeeMediaError(language === 'ko' ? '15\uCD08 \uC774\uB0B4 \uB3D9\uC601\uC0C1\uB9CC \uC62C\uB9B4 \uC218 \uC788\uC5B4\uC694.' : 'Only videos up to 15 seconds can be uploaded.');
        setSharbeeVideoUrl('');
        setSharbeeVideoName('');
      } else {
        if (sharbeeVideoUrl.startsWith('blob:')) {
          URL.revokeObjectURL(sharbeeVideoUrl);
        }
        setSharbeeMediaError('');
        setSharbeeVideoUrl(objectUrl);
        setSharbeeVideoFile(file);
        setSharbeeVideoName(file.name || (language === 'ko' ? '\uB9AC\uBDF0 \uB3D9\uC601\uC0C1' : 'Review video'));
      }
      event.target.value = '';
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setSharbeeMediaError(language === 'ko' ? '\uB3D9\uC601\uC0C1\uC744 \uC77D\uC744 \uC218 \uC5C6\uC5B4\uC694. \uB2E4\uB978 \uD30C\uC77C\uB85C \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.' : 'Could not read this video. Please try another file.');
      event.target.value = '';
    };

    video.src = objectUrl;
  };

  const uploadSharbeeMediaToFirebase = async (
    media: Blob | File | null,
    mediaType: 'photo' | 'video',
    extension: string
  ) => {
    if (!media) return '';
    if (!firebaseStorage) {
      throw new Error('Firebase Storage is not configured.');
    }

    const safeUserId = currentUser?.id || 'guest';
    const safeStoreId = selectedStore.id || 'store';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const path = `reviews/${safeStoreId}/${safeUserId}/${mediaType}/${fileName}`;
    const uploaded = await uploadBytes(storageRef(firebaseStorage, path), media, {
      contentType: mediaType === 'photo' ? 'image/jpeg' : (media as File).type || 'video/mp4',
      customMetadata: {
        storeId: safeStoreId,
        userId: safeUserId,
        source: 'sharbee-review'
      }
    });
    return getDownloadURL(uploaded.ref);
  };

  const callGeminiAPI = async (prompt: string, historyText: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("VITE_GEMINI_API_KEY is not defined in .env");
      return null;
    }

    const storeName = selectedStore.name;
    const systemPrompt = `You are "Sharbee" (샤비), a friendly honeybee chatbot review helper for the store "${storeName}".
Your role is to help the customer write a review by chatting with them in a cute and warm tone.
The customer might answer your questions about the food, or they might ask questions about the store, the menu, the store name meaning (e.g. why the store name is "${storeName}"), or other questions.
Always respond in a very kind, polite, and helpful manner using a cute honeybee persona (with emojis like 🐝 and honey).
Keep your response concise (1-3 sentences) so it fits beautifully in a chat bubble.
If the customer asks a question, answer it directly, creatively, and accurately (e.g. if they ask about the store name "LOVELETTER" meaning, you can say it represents warm letters filled with love and stamps sent to the customers).
Do not break character. Do not repeat the same question if the customer asks something else.
Here is the chat history:
${historyText}
Customer: ${prompt}
Sharbee:`;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6500);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_REVIEW_MODEL}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.72,
            topP: 0.9,
            maxOutputTokens: 160
          },
          contents: [
            {
              parts: [
                {
                  text: systemPrompt
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return responseText ? responseText.trim() : null;
    } catch (e) {
      console.error("Error calling Gemini API:", e);
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const submitSharbeeAnswer = async (answerText: string) => {
    const trimmed = answerText.trim();
    if (!trimmed) return;

    // 1. Add user's message immediately
    const nextLogs = [...sharbeeLogs, { sender: 'user' as const, text: trimmed }];
    setSharbeeLogs(nextLogs);
    setSharbeeInput('');

    // 2. Put a placeholder/temporary state or fetch immediately
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const userMessageCount = nextLogs.filter(log => log.sender === 'user').length;
    const fallback = getSharbeeFollowup(userMessageCount, trimmed);

    let aiResponseText = "";
    let nextOptions = fallback.options;

    if (apiKey) {
      // Create dialogue context
      const historyText = nextLogs
        .slice(-4, -1) // keep context short for faster replies
        .map(log => `${log.sender === 'user' ? 'Customer' : 'Sharbee'}: ${log.text}`)
        .join('\n');

      const geminiRes = await callGeminiAPI(trimmed, historyText);
      if (geminiRes) {
        aiResponseText = geminiRes;
      }
    }

    if (!aiResponseText) {
      aiResponseText = fallback.question;
    }

    // 3. Add AI's response to logs
    setSharbeeLogs(prev => [...prev, { sender: 'ai', text: aiResponseText }]);
    setSharbeeOptions(nextOptions);
  };

  const buildSharbeeQaSection = (logs: { sender: 'ai' | 'user'; text: string }[]) => {
    const answers = logs.filter(log => log.sender === 'user').map(log => log.text.trim()).filter(Boolean);
    if (answers.length === 0) return '';

    const menu = answers[0] || (language === 'ko' ? '\uB300\uD45C \uBA54\uB274' : 'the signature menu');
    const taste = answers[1] || '';
    const value = answers[2] || '';
    const recommend = answers[3] || '';
    const reviewLang = detectReviewLanguage(answers);
    const storeCategory = String((selectedStore as any).category || '').toLowerCase();
    const menuLower = menu.toLowerCase();

    const getSearchPlaceTypeKo = () => {
      if (menu.includes('\uD53C\uC790') || menuLower.includes('pizza')) return '\uD53C\uC790\uC9D1';
      if (menu.includes('\uCE58\uD0A8') || menuLower.includes('chicken')) return '\uCE58\uD0A8\uC9D1';
      if (menu.includes('\uCEE4\uD53C') || menu.includes('\uB77C\uB5BC') || menu.includes('\uC544\uBA54\uB9AC\uCE74\uB178') || storeCategory.includes('cafe')) return '\uCE74\uD398';
      if (menu.includes('\uD30C\uC2A4\uD0C0') || menu.includes('\uC2A4\uD30C\uAC8C\uD2F0') || menuLower.includes('pasta') || menuLower.includes('spaghetti')) return '\uC591\uC2DD\uC9D1';
      if (storeCategory.includes('salon') || storeCategory.includes('\uBBF8\uC6A9') || storeCategory.includes('hair')) return '\uBBF8\uC6A9\uC2E4';
      if (storeCategory.includes('restaurant') || storeCategory.includes('\uC2DD\uB2F9')) return '\uC2DD\uB2F9';
      return '\uB9E4\uC7A5';
    };

    const getSearchPlaceTypeEn = () => {
      if (menuLower.includes('pizza')) return 'pizza place';
      if (menuLower.includes('chicken')) return 'chicken restaurant';
      if (menuLower.includes('coffee') || menuLower.includes('latte') || menuLower.includes('americano') || storeCategory.includes('cafe')) return 'cafe';
      if (menuLower.includes('pasta') || menuLower.includes('spaghetti')) return 'Italian restaurant';
      if (storeCategory.includes('salon') || storeCategory.includes('hair')) return 'hair salon';
      if (storeCategory.includes('restaurant')) return 'restaurant';
      return 'store';
    };

    if (reviewLang === 'ko') {
      const placeType = getSearchPlaceTypeKo();
      const menuJosa = getJosa(menu, '\uC744', '\uB97C');
      const storeTopicJosa = getJosa(selectedStore.name, '\uC740', '\uB294');
      const question = `${menu}${menuJosa} \uC815\uB9D0 \uC798\uD558\uB294 ${placeType}\uC740?`;
      const answerParts = [
        `${selectedStore.name}${storeTopicJosa} ${menu}${menuJosa} \uBA3C\uC800 \uCD94\uCC9C\uD560 \uB9CC\uD55C \uACF3\uC774\uC5D0\uC694.`,
        taste ? `\uD2B9\uD788 ${taste}\uB294 \uB290\uB08C\uC774 \uC88B\uC558\uACE0` : '',
        value ? `${value}\uB77C\uB294 \uC810\uB3C4 \uB9CC\uC871\uC2A4\uB7EC\uC6E0\uC5B4\uC694.` : '',
        recommend ? `${recommend}\uB77C\uACE0 \uB9D0\uD560 \uB9CC\uD07C \uAE30\uC5B5\uC5D0 \uB0A8\uB294 \uBC29\uBB38\uC774\uC5C8\uC2B5\uB2C8\uB2E4.` : ''
      ].filter(Boolean).join(' ');

      return `\uAD81\uAE08\uC99D \uD074\uB9AC\uC5B4\nQ. ${question}\nA. ${answerParts}`;
    }

    const placeType = getSearchPlaceTypeEn();
    const question = `Where can I find a ${placeType} that does ${menu} really well?`;
    const answerParts = [
      `${selectedStore.name} is a good ${placeType} to try for ${menu}.`,
      taste ? `The customer especially noted that ${taste}.` : '',
      value ? `They also felt ${value}.` : '',
      recommend ? `It was memorable enough that they said ${recommend}.` : ''
    ].filter(Boolean).join(' ');

    return `Quick Answer\nQ. ${question}\nA. ${answerParts}`;
  };

  const generateHumanReviewDraft = async (logs: { sender: 'ai' | 'user'; text: string }[], fallbackReview: string) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return fallbackReview;

    const conversationText = logs
      .map(log => `${log.sender === 'user' ? 'Customer' : 'Sharbee'}: ${log.text}`)
      .join('\n');
    const answerTexts = logs.filter(log => log.sender === 'user').map(log => log.text);
    const reviewLang = detectReviewLanguage(answerTexts);

    const prompt = reviewLang === 'ko'
      ? `\uB2F9\uC2E0\uC740 \uC9C4\uC9DC \uACE0\uAC1D\uC774 \uC4F4 \uAC83\uCC98\uB7FC \uC790\uC5F0\uC2A4\uB7FD\uACE0 \uAC1C\uC131 \uC788\uB294 \uB9E4\uC7A5 \uB9AC\uBDF0\uB97C \uC4F0\uB294 \uC791\uAC00\uC785\uB2C8\uB2E4.
\uB2E4\uC74C \uB300\uD654\uB97C \uBC14\uD0D5\uC73C\uB85C, AI\uAC00 \uC4F4 \uC694\uC57D\uBB38\uCC98\uB7FC \uBCF4\uC774\uC9C0 \uC54A\uAC8C \uC0AC\uB78C\uC774 \uC9C1\uC811 \uB9D0\uD558\uB294 \uB4EF\uD55C \uB9AC\uBDF0\uB85C \uC5EE\uC5B4\uC8FC\uC138\uC694.
\uC870\uAC74:
- \uB9E4\uC7A5\uBA85\uC740 ${selectedStore.name}\uC785\uB2C8\uB2E4.
- \uBC18\uB4DC\uC2DC \uD55C\uAD6D\uC5B4\uB85C \uC4F0\uC138\uC694.
- 2~4\uBB38\uC7A5 \uC815\uB3C4\uB85C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC4F0\uC138\uC694.
- \uACFC\uC7A5\uB41C \uAD11\uACE0\uBB38, \uC815\uB9AC\uBB38, \uBD84\uC11D\uBB38\uCC98\uB7FC \uC4F0\uC9C0 \uB9C8\uC138\uC694.
- \uACE0\uAC1D\uC758 \uAC1C\uC778\uC801\uC778 \uB290\uB08C, \uB9DB, \uAC00\uCE58, \uCD94\uCC9C/\uC7AC\uBC29\uBB38 \uC758\uD5A5\uC774 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC11E\uC774\uAC8C \uC4F0\uC138\uC694.
- Q&A \uC139\uC158\uC740 \uC4F0\uC9C0 \uB9C8\uC138\uC694. \uB9AC\uBDF0 \uBCF8\uBB38\uB9CC \uCD9C\uB825\uD558\uC138\uC694.

\uB300\uD654:
${conversationText}

\uC0AC\uB78C\uC774 \uC4F4 \uAC83\uAC19\uC740 \uB9AC\uBDF0 \uBCF8\uBB38:`
      : `Write a natural store review that sounds like a real customer wrote it, not like an AI summary.
Store name: ${selectedStore.name}
Use the conversation below. Write 2-4 sentences with a personal voice, including taste/experience, value, and recommendation or revisit intent when available.
Write in English, because the customer's answers are in English.
Do not add a Q&A section. Output only the review body.

Conversation:
${conversationText}

Human-like review body:`;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_REVIEW_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.82,
            topP: 0.92,
            maxOutputTokens: 520
          },
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) throw new Error(`Gemini review draft failed: ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? text.trim() : fallbackReview;
    } catch (e) {
      console.error('Gemini review draft error:', e);
      return fallbackReview;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const finishSharbeeReview = async () => {
    const logsSnapshot = [...sharbeeLogs];
    const answers = logsSnapshot.filter(log => log.sender === 'user').map(log => log.text);
    const reviewLang = detectReviewLanguage(answers);
    const menu = answers[0] || (language === 'ko' ? '\uBA54\uB274' : 'menu');
    const details = answers.slice(1).join(' ');
    const fallbackReview = reviewLang === 'ko'
      ? `\uC624\uB298 ${selectedStore.name}\uC5D0\uC11C ${menu}\uC744/\uB97C \uC990\uACBC\uB294\uB370, ${details || '\uAE30\uBD84 \uC88B\uC740 \uC2DC\uAC04\uC774\uC5C8\uC5B4\uC694'} \uB2E4\uC2DC \uBC29\uBB38\uD558\uACE0 \uC2F6\uC740 \uB9E4\uC7A5\uC785\uB2C8\uB2E4.`
      : `I enjoyed ${menu} at ${selectedStore.name} today. ${details || 'It was a pleasant visit.'} I would like to visit again.`;

    setSharbeeRating(0);
    setSharbeeStep('draft');
    setSharbeeDraft(language === 'ko' ? '\uC0E4\uBE44\uAC00 \uB9AC\uBDF0\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uC5EE\uB294 \uC911\uC785\uB2C8\uB2E4...' : 'Sharbee is weaving your review naturally...');

    const humanReview = await generateHumanReviewDraft(logsSnapshot, fallbackReview);
    const qaSection = buildSharbeeQaSection(logsSnapshot);
    setSharbeeDraft(`${humanReview}\n\n${qaSection}`.trim());
  };

  const submitSharbeeReview = async () => {
    if (!currentUser || !sharbeeRating || !sharbeeDraft.trim()) return;
    setSharbeeSubmitting(true);
    setSharbeeMediaError('');

    try {
      const photoToUpload = sharbeePhotoBlob;
      const videoToUpload = sharbeeVideoFile;
      const videoExtension = ((videoToUpload?.name.split('.').pop() || 'mp4').toLowerCase());
      const result = addReview(
        selectedStore.id,
        sharbeeRating,
        sharbeeDraft.trim(),
        sharbeePhotoUrl || undefined,
        true,
        sharbeeVideoUrl || undefined,
        sharbeeLogs.filter(log => log.sender === 'user').map((log, index) => ({ q: `Sharbee ${index + 1}`, a: log.text })),
        {
          facebook: selectedStore.snsSettings?.facebookEnabled ?? true,
          instagram: selectedStore.snsSettings?.instagramEnabled ?? true,
          threads: selectedStore.snsSettings?.threadsEnabled ?? true,
          linkedin: selectedStore.snsSettings?.linkedinEnabled ?? false,
          youtube: selectedStore.snsSettings?.youtubeEnabled ?? false,
          tiktok: selectedStore.snsSettings?.tiktokEnabled ?? true,
          google: selectedStore.snsSettings?.googleEnabled ?? true
        }
      );

      if (result.reviewId && (photoToUpload || videoToUpload)) {
        Promise.allSettled([
          uploadSharbeeMediaToFirebase(photoToUpload, 'photo', 'jpg'),
          uploadSharbeeMediaToFirebase(videoToUpload, 'video', videoExtension)
        ]).then(([photoUploadResult, videoUploadResult]) => {
          const uploadedPhotoUrl = photoUploadResult.status === 'fulfilled' ? photoUploadResult.value : '';
          const uploadedVideoUrl = videoUploadResult.status === 'fulfilled' ? videoUploadResult.value : '';
          if (uploadedPhotoUrl || uploadedVideoUrl) {
            updateReviewMedia(result.reviewId, {
              photoUrl: uploadedPhotoUrl || undefined,
              videoUrl: uploadedVideoUrl || undefined
            });
          }
          if ((photoToUpload && !uploadedPhotoUrl) || (videoToUpload && !uploadedVideoUrl)) {
            console.warn('Sharbee background media upload failed.', {
              photo: photoUploadResult,
              video: videoUploadResult
            });
          }
        });
      }

      setSharbeeSubmitting(false);
      setShowSharbeeReview(false);
      // \uB9AC\uBDF0 \uB4F1\uB85D \uC9C1\uD6C4 \u2192 "\uB0B4 SNS\uC5D0\uB3C4 \uC62C\uB9AC\uACE0 +1\uC7A5" \uC6D0\uD0ED \uACF5\uC720 \uD504\uB86C\uD504\uD2B8
      setSharePrompt({
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        comment: sharbeeDraft.trim(),
        photoUrl: sharbeePhotoUrl || undefined
      });
    } catch (error) {
      console.error('Sharbee media upload failed:', error);
      setSharbeeSubmitting(false);
      setSharbeeMediaError(language === 'ko' ? '\uBBF8\uB514\uC5B4 \uC5C5\uB85C\uB4DC\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. Firebase Storage \uAD8C\uD55C\uC744 \uD655\uC778\uD558\uAC70\uB098 \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.' : 'Media upload failed. Please check Firebase Storage permissions or try again.');
    }
  };

  // --- 핸들러 함수들 ---
  
  // 스탬프 적립일 포맷 함수 [MM.DD.YYYY.HH:mm]
  const formatAcquisitionDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '';
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${mm}.${dd}.${yyyy}.${hh}:${min}`;
    } catch (e) {
      return '';
    }
  };

  // 특정 매장의 스탬프 개별 정보 (적립 경로, 날짜, 선물 발송인 등) 가져오기
  const getStampDetailsForStore = (storeId: string) => {
    if (!currentUser || !storeId) return [];
    
    const card = stampCards.find(c => c.userId === currentUser.id && c.storeId === storeId);
    const count = card ? card.currentStamps : 0;
    
    const plusTxs = stampTransactions
      .filter(tx => 
        tx.userId === currentUser.id && 
        tx.storeId === storeId && 
        tx.amount > 0
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
    const details: {
      createdAt: string;
      isGift: boolean;
      senderName: string;
      senderNickname: string;
      txType: string;
    }[] = [];
    
    plusTxs.forEach(tx => {
      let isGift = tx.type === 'gift_receive';
      let senderName = '';
      let senderNickname = '';
      
      if (isGift && tx.referenceId) {
        const gift = gifts.find(g => g.id === tx.referenceId);
        if (gift) {
          const sender = users.find(u => u.id === gift.senderId);
          if (sender) {
            senderName = sender.name;
            senderNickname = sender.nickname;
          }
        }
      }
      
      for (let i = 0; i < tx.amount; i++) {
        details.push({
          createdAt: tx.createdAt,
          isGift,
          senderName,
          senderNickname,
          txType: tx.type
        });
      }
    });
    
    if (details.length < count) {
      const needed = count - details.length;
      for (let i = 0; i < needed; i++) {
        const mockDate = new Date();
        mockDate.setDate(mockDate.getDate() - (needed - i) * 2);
        mockDate.setHours(14, 30, 0, 0);
        details.unshift({
          createdAt: mockDate.toISOString(),
          isGift: false,
          senderName: '',
          senderNickname: '',
          txType: 'earn'
        });
      }
    }
    
    return details.slice(-count);
  };

  const handleStampClick = (idx: number) => {
    if (clickedStampIndex === idx) {
      setClickedStampIndex(null);
      setClickedStampDate(null);
      return;
    }
    
    setClickedStampIndex(idx);
    const stampNum = idx + 1;
    const isChecked = currentStamps >= stampNum;
    
    if (isChecked) {
      const stampDetails = getStampDetailsForStore(selectedStoreId);
      const detail = stampDetails[idx];
      const dateVal = detail ? detail.createdAt : (userCard?.updatedAt || new Date().toISOString());
      const formattedDate = formatAcquisitionDate(dateVal);
      
      if (detail && detail.isGift) {
        const senderDisplayName = detail.senderName.replace('회원_', '') + `(${detail.senderNickname})`;
        const text = language === 'ko'
          ? `🎁 ${senderDisplayName}님이 보냄\n${formattedDate}`
          : `🎁 Sent by ${senderDisplayName}\n${formattedDate}`;
        setClickedStampDate(text);
      } else {
        setClickedStampDate(formattedDate);
      }
    } else {
      setClickedStampDate('not_earned');
    }
  };
  
  // 로그인 요청
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberInput.trim()) return;
    
    const deviceTokenToSend = currentDeviceToken || localStorage.getItem('sharestamps_session_token') || '';
    const user = loginByPhoneNumber(phoneNumberInput, deviceTokenToSend);
    if (!user) {
      // 기기 중복 제한 등으로 로그인이 실패한 것이고 계정 자체는 존재하는지 확인
      const cleanInput = phoneNumberInput.replace(/\D/g, '');
      const userExistsInDb = users.some((u: any) => u.phoneNumber.replace(/\D/g, '').replace(/\s/g, '') === cleanInput);
      if (userExistsInDb) {
        return;
      }

      const nickname = registerForm.nickname.trim();
      if (!nickname) {
        setLoginFormError(t.nicknameRequired);
        return;
      }

      // 회원 정보 없으므로 약관 확인 가입창 오픈
      setLoginFormError('');
      setRegisterForm(prev => ({ ...prev, phoneNumber: phoneNumberInput, nickname }));
      setIsRegistering(true);
    }
  };

  const handleNewSignupClick = () => {
    const cleanInput = phoneNumberInput.replace(/\D/g, '');
    const nickname = registerForm.nickname.trim();

    if (!cleanInput || !nickname) {
      setLoginFormError(t.newSignupPrompt);
      return;
    }

    const userExistsInDb = users.some((u: any) => u.phoneNumber.replace(/\D/g, '').replace(/\s/g, '') === cleanInput);
    if (userExistsInDb) {
      setLoginFormError(t.existingPhoneNumber);
      return;
    }

    setLoginFormError('');
    setRegisterForm(prev => ({ ...prev, phoneNumber: phoneNumberInput, nickname }));
    setIsRegistering(true);
  };

  // 가입 및 로그인 완료 (SMS 코드 발송 요청으로 위임)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAgreed) return;
    handleSendSMSCode();
  };



  // 친구 검색 (선택한 매장의 스탬프가 1개 이상인 유저로 필터링)
  const searchedFriends = friendQuery.trim() 
    ? searchFriend(friendQuery).filter(u => {
        const userCard = stampCards.find(c => c.userId === u.id && c.storeId === selectedStoreId);
        return userCard && userCard.currentStamps > 0;
      })
    : [];

  // 선물 보내기
  const handleSendGift = () => {
    if (!currentUser || !selectedFriend) return;
    try {
      const res = giftStamps(currentUser.id, selectedFriend.id, selectedStoreId, giftStampsCount, giftMessage);
      setGiftResult(res);
      
      // 상태 리셋
      setFriendQuery('');
      setSelectedFriend(null);
      setGiftMessage('');
      setGiftStampsCount(1);
    } catch (err: any) {
      alert(err.message || '선물 발송 에러');
    }
  };

  // 기부 완료
  const handleSendDonation = () => {
    if (!currentUser) return;
    try {
      const val = donateStamps(currentUser.id, selectedStoreId, selectedNpoId, donateStampsCount);
      setDonateResult(val);
      setDonateStampsCount(1);
    } catch (err: any) {
      alert(err.message || '기부 에러');
    }
  };

  // 개인 기부 대시보드 지표
  const myDonations = currentUser ? donations.filter(d => d.donorId === currentUser.id) : [];
  const totalMyDonatedStamps = myDonations.reduce((sum, d) => sum + d.stampCount, 0);
  const totalMyDonatedValue = myDonations.reduce((sum, d) => sum + d.monetaryValue, 0);

  // 기부 임팩트 메타포 매칭
  const calculateMetaphor = () => {
    const meals = Math.floor(totalMyDonatedValue / 4.00); // 4달러당 1식 식사
    const trees = Math.floor(totalMyDonatedValue / 8.00); // 8달러당 나무 1그루
    return { meals, trees };
  };
  const metaphor = calculateMetaphor();
   if (!currentUser) {
    return (
      <div style={{ maxWidth: '420px', margin: '0 auto', minHeight: '100%', backgroundColor: '#ffffff', padding: '56px 28px 36px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', fontFamily: 'var(--font-family)' }}>
        
        {/* 언어 선택 토글 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button 
            type="button"
            onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
            style={{ 
              background: 'var(--surface-color)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--primary-color)',
              padding: '6px 12px',
              borderRadius: 'var(--border-radius-pill)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={14} />
            {language === 'ko' ? 'English (EN)' : '한국어 (KO)'}
          </button>
        </div>

        {!isRegistering ? (
          /* 로그인 화면 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '20px' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* App Icon */}
              <img 
                src="/apple-touch-icon.png" 
                alt="ShareStamps Icon" 
                style={{ 
                  width: '96px', 
                  height: '96px', 
                  borderRadius: '22px', 
                  marginBottom: '16px',
                  boxShadow: '0 8px 24px rgba(95, 92, 230, 0.15)',
                  objectFit: 'contain'
                }} 
              />
              <div style={{ fontSize: '46px', fontWeight: 900, color: 'var(--primary-color)', letterSpacing: '-2px', lineHeight: 1.1 }}>{t.title}</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginTop: '10px', fontWeight: 500 }}>{t.subtitle}</p>
            </div>

            {hasPendingQR && (
              <div style={{ 
                padding: '12px 16px', 
                borderRadius: 'var(--border-radius-md)', 
                backgroundColor: 'var(--primary-light)', 
                border: '1px solid var(--primary-color)',
                color: 'var(--primary-color)', 
                fontSize: '13px', 
                fontWeight: 700, 
                lineHeight: 1.4,
                textAlign: 'center'
              }}>
                🎁 {pendingScanStoreName ? `[${pendingScanStoreName}]` : ''} {t.scanBanner}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.phoneLogin}</label>
                <input 
                  type="tel" 
                  value={phoneNumberInput}
                  onChange={(e) => {
                    setPhoneNumberInput(formatUSPhoneNumber(e.target.value));
                    setLoginFormError('');
                  }}
                  placeholder={t.phonePlaceholder} 
                  className="imin-input"
                  required
                />
                {localStorage.getItem('sharestamps_last_phone_number') && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {t.recentNum} <strong 
                      onClick={() => setPhoneNumberInput(formatUSPhoneNumber(localStorage.getItem('sharestamps_last_phone_number') || ''))}
                      style={{ color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {formatUSPhoneNumber(localStorage.getItem('sharestamps_last_phone_number') || '')}
                    </strong> ({t.autoFillClick})
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.nicknameLabel}</label>
                <input 
                  type="text"
                  value={registerForm.nickname}
                  onChange={(e) => {
                    setRegisterForm(prev => ({ ...prev, nickname: e.target.value }));
                    setLoginFormError('');
                  }}
                  placeholder={t.nicknamePlaceholder}
                  className="imin-input"
                  style={{ marginTop: '6px' }}
                />
                {loginFormError && (
                  <div style={{ color: 'var(--accent-red)', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
                    {loginFormError}
                  </div>
                )}
              </div>

              <button type="submit" className="imin-btn imin-btn-primary">
                {t.start}
              </button>

              <button
                type="button"
                onClick={handleNewSignupClick}
                className="imin-btn imin-btn-outline"
                style={{
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-color)',
                  backgroundColor: '#ffffff'
                }}
              >
                {t.newSignup}
              </button>
            </form>
          </div>
        ) : isVerifyingSMS ? (
          /* SMS 인증번호 입력 화면 */
          <form onSubmit={handleVerifySMS} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>{t.otpTitle}</span>
              <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary-color)', marginTop: '6px', letterSpacing: '0.5px' }}>
                {formatUSPhoneNumber(registerForm.phoneNumber)}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{t.otpSubtitle}</p>
            </div>

            {/* 인증번호 입력 필드 */}
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                maxLength={4}
                value={smsInput}
                onChange={(e) => {
                  setSmsInput(e.target.value.replace(/[^0-9]/g, ''));
                  setSmsError('');
                }}
                placeholder={t.otpPlaceholder} 
                className="imin-input"
                style={{ textAlign: 'center', fontSize: '24px', fontWeight: 700, letterSpacing: '8px', paddingBottom: '16px' }}
                required
              />
              <span style={{ 
                position: 'absolute', 
                right: '8px', 
                bottom: '16px', 
                color: smsTimer < 30 ? 'var(--accent-red)' : 'var(--primary-color)',
                fontSize: '14px',
                fontWeight: 700
              }}>
                {Math.floor(smsTimer / 60)}:{(smsTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {smsError && (
              <div style={{ color: 'var(--accent-red)', fontSize: '13px', textAlign: 'center', fontWeight: 600 }}>
                ⚠️ {smsError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                type="submit" 
                className="imin-btn imin-btn-primary"
                disabled={smsInput.length !== 4 || smsTimer === 0}
              >
                {t.otpVerifyBtn}
              </button>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={handleSendSMSCode} 
                  className="imin-btn imin-btn-secondary" 
                  style={{ flex: 1, fontSize: '14px', padding: '10px' }}
                >
                  {t.otpResend}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsVerifyingSMS(false)} 
                  className="imin-btn imin-btn-outline"
                  style={{ flex: 1, fontSize: '14px', padding: '10px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  {t.otpBack}
                </button>
              </div>
            </div>

            {/* 모의 수신 문자 메시지 팝업 가이드 (데모용 시각화) */}
            <div style={{ 
              marginTop: '10px', 
              padding: '14px', 
              borderRadius: 'var(--border-radius-md)', 
              backgroundColor: '#F2F2F7', 
              border: '1px solid var(--border-color)',
              fontSize: '13px', 
              lineHeight: 1.5
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '14px' }}>💬</span>
                <strong>{t.smsSim}</strong>
              </div>
              <div style={{ color: '#3a3a3c', backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e5e5ea' }}>
                <span style={{ fontWeight: 600 }}>{t.smsSimContent}</span> <strong style={{ color: 'var(--primary-color)', fontSize: '15px' }}>{smsCode}</strong>.
              </div>
            </div>

          </form>
        ) : (
          /* 아임인 스타일 회원가입 온보딩 설문 약관 */
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>{t.joinPhoneTitle}</span>
              <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--primary-color)', marginTop: '6px', letterSpacing: '0.5px' }}>
                {formatUSPhoneNumber(registerForm.phoneNumber)}
              </div>
            </div>

            {/* 모두 동의 선택 */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              padding: '4px 0 12px 0',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '10px'
            }}>
              <input 
                type="checkbox"
                checked={Object.values(agreements).every(v => v)}
                onChange={(e) => handleToggleAll(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--primary-color)' }}>{t.agreeAll}</span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* 2. 전화번호 인증 */}
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '14px', lineHeight: 1.4 }}>
                <input 
                  type="checkbox"
                  checked={agreements.authPhone}
                  onChange={(e) => setAgreements(prev => ({ ...prev, authPhone: e.target.checked }))}
                  style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.agreeTerm1}</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.agreeTerm1Desc}</p>
                </div>
              </label>

              {/* 3. 적립횟수 및 금액 안내 */}
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '14px', lineHeight: 1.4 }}>
                <input 
                  type="checkbox"
                  checked={agreements.earnAnnounce}
                  onChange={(e) => setAgreements(prev => ({ ...prev, earnAnnounce: e.target.checked }))}
                  style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.agreeTerm2}</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.agreeTerm2Desc}</p>
                </div>
              </label>

              {/* 4. 기부 안내 */}
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '14px', lineHeight: 1.4 }}>
                <input 
                  type="checkbox"
                  checked={agreements.donationAnnounce}
                  onChange={(e) => setAgreements(prev => ({ ...prev, donationAnnounce: e.target.checked }))}
                  style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.agreeTerm3}</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.agreeTerm3Desc}</p>
                </div>
              </label>

              {/* 5. 매장 마케팅 전화 */}
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '14px', lineHeight: 1.4 }}>
                <input 
                  type="checkbox"
                  checked={agreements.marketingPhone}
                  onChange={(e) => setAgreements(prev => ({ ...prev, marketingPhone: e.target.checked }))}
                  style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.agreeTerm4}</span>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.agreeTerm4Desc}</p>
                </div>
              </label>

            </div>

            <button 
              type="submit" 
              className="imin-btn imin-btn-primary" 
              style={{ marginTop: '12px' }}
              disabled={!isAllAgreed}
            >
              {t.joinBtn}
            </button>
          </form>
        )}

      </div>
    );
  }

  if (shouldShowNoStoreIntro || isStorelessDashboard) {
    return (
      <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', minHeight: '100%', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '0 0 10px rgba(0,0,0,0.05)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 16px 10px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-color)' }}>
            <UserIcon size={14} />
            <span style={{ borderBottom: '1px dashed var(--primary-color)' }}>{currentUser.nickname}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
              style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--primary-color)', padding: '4px 8px', borderRadius: 'var(--border-radius-pill)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Globe size={10} />
              {language === 'ko' ? 'EN' : 'KO'}
            </button>
            <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <LogOut size={14} />
              {t.logoutBtn}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '28px 20px 92px', display: 'flex', flexDirection: 'column', gap: '18px', justifyContent: shouldShowNoStoreIntro ? 'center' : 'flex-start' }}>
          {shouldShowNoStoreIntro ? (
            <div className="imin-card" style={{ padding: '28px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '58px', height: '58px', borderRadius: '18px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '22px', lineHeight: 1.25, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>{t.noStoreIntroTitle}</h2>
                <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--text-secondary)', margin: '10px 0 0' }}>{t.noStoreIntroDesc}</p>
                <p style={{ fontSize: '12px', lineHeight: 1.45, color: 'var(--text-secondary)', margin: '8px 0 0' }}>{t.noStoreIntroHint}</p>
              </div>
              <button type="button" className="imin-btn imin-btn-primary" onClick={() => setShowStorelessDashboard(true)}>
                {t.myShareStampsBtn}
              </button>
            </div>
          ) : (
            <>
              <div className="imin-card" style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserIcon size={22} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '22px', lineHeight: 1.2, fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>{t.noStoreDashboardTitle}</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{t.noStoreDashboardDesc}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                  <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8F9FF', border: '1px solid rgba(95, 92, 230, 0.16)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{language === 'ko' ? '연결 매장' : 'Connected stores'}</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--primary-color)', marginTop: '4px' }}>0</div>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#F8F9FF', border: '1px solid rgba(95, 92, 230, 0.16)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{language === 'ko' ? '스탬프 캐시' : 'Stamp cash'}</div>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--primary-color)', marginTop: '4px' }}>$0.00</div>
                  </div>
                </div>
              </div>

              <div className="imin-card" style={{ padding: '18px', display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: 'var(--primary-light)' }}>
                <QrCode size={22} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>{t.noStoreDashboardGuide}</p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }



  // 로그인 완료된 메인 PWA 화면
  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '420px', 
      margin: '0 auto', 
      height: showSharbeeReview ? '100%' : 'auto',
      minHeight: '100%', 
      backgroundColor: '#ffffff', 
      display: 'flex', 
      flexDirection: 'column', 
      boxShadow: '0 0 10px rgba(0,0,0,0.05)', 
      position: 'relative',
      overflow: showSharbeeReview ? 'hidden' : 'visible'
    }}>
      
      {/* PWA 상단 바 (더 작고 조밀하게 축소) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 16px 10px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 100 }}>
        <div 
          onClick={() => {
            if (showAccountModal) {
              setShowAccountModal(false);
              setShowDirectDonateForm(false);
              setDirectDonateResult(null);
            } else {
              setShowAccountModal(true);
            }
          }}
          style={{ 
            cursor: 'pointer', 
            padding: '4px 8px', 
            borderRadius: '6px', 
            backgroundColor: 'rgba(95, 92, 230, 0.05)',
            transition: 'background-color 0.2s',
            userSelect: 'none'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(95, 92, 230, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(95, 92, 230, 0.05)'}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-color)' }}>
            <UserIcon size={14} />
            <span style={{ borderBottom: '1px dashed var(--primary-color)' }}>
              {currentUser.nickname}
            </span>
          </div>
        </div>
        
        <button
          type="button"
          onClick={openCameraScanner}
          aria-label="QR camera scan"
          style={{
            position: 'absolute',
            left: '50%',
            top: '14px',
            transform: 'translateX(-50%)',
            height: '34px',
            padding: '5px 11px 5px 8px',
            borderRadius: '999px',
            border: '1px solid rgba(95, 92, 230, 0.18)',
            background: 'rgba(255,255,255,0.94)',
            color: '#27234A',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 6px 15px rgba(95, 92, 230, 0.13)',
            backdropFilter: 'blur(8px)',
            zIndex: 1
          }}
        >
          <img
            src="/camera-scan-icon.png"
            alt=""
            aria-hidden="true"
            style={{
              width: '23px',
              height: '23px',
              objectFit: 'contain',
              display: 'block'
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: 0, whiteSpace: 'nowrap' }}>
            QR scan
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', position: 'relative' }}>
          {/* 언어 선택 토글 버튼 */}
          <button 
            type="button"
            onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
            style={{ 
              background: 'var(--surface-color)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--primary-color)',
              padding: '4px 8px',
              borderRadius: 'var(--border-radius-pill)',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <Globe size={10} />
            {language === 'ko' ? 'EN' : 'KO'}
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsMenu(prev => !prev)}
            aria-label={t.settingsTitle}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Settings size={14} />
          </button>

          {showSettingsMenu && (
            <div
              className="imin-card"
              style={{
                position: 'absolute',
                top: '34px',
                right: 0,
                width: '190px',
                padding: '12px',
                zIndex: 300,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.16)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                <Settings size={15} style={{ color: 'var(--primary-color)' }} />
                {t.settingsTitle}
              </div>
              <div style={{ padding: '9px 10px', borderRadius: '8px', backgroundColor: 'var(--background-color)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span>{t.versionLabel}</span>
                <strong style={{ color: 'var(--text-primary)' }}>v1.2.0</strong>
              </div>
              <div style={{ padding: '9px 10px', borderRadius: '8px', backgroundColor: 'var(--background-color)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {t.settingsComingSoon}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSettingsMenu(false);
                  logout();
                }}
                style={{
                  width: '100%',
                  border: '1px solid rgba(255, 59, 48, 0.24)',
                  backgroundColor: 'rgba(255, 59, 48, 0.06)',
                  color: 'var(--accent-red)',
                  borderRadius: '8px',
                  padding: '9px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 800
                }}
              >
                <LogOut size={14} />
                {t.logoutBtn}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 광고 배너 (이미지 전용, 16:4 비율 고정, 15초 자동 교체) */}
      {activeAd && activeAd.imageUrl ? (
        <div
          onClick={() => {
            if (activeAd.linkUrl) {
              window.open(activeAd.linkUrl, '_blank');
            }
          }}
          style={{
            width: '100%',
            aspectRatio: '16 / 4',
            position: 'relative',
            overflow: 'hidden',
            cursor: activeAd.linkUrl ? 'pointer' : 'default',
            flexShrink: 0
          }}
        >
          <img
            key={activeAd.id}
            src={activeAd.imageUrl}
            alt="광고 배너"
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              display: 'block',
              animation: 'adFadeIn 0.5s ease'
            }}
          />
          {/* AD 배지 */}
          <span style={{
            position: 'absolute',
            bottom: '6px', right: '8px',
            fontSize: '8px',
            color: 'rgba(255,255,255,0.85)',
            backgroundColor: 'rgba(0,0,0,0.35)',
            borderRadius: '3px',
            padding: '2px 4px',
            lineHeight: '1',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            backdropFilter: 'blur(2px)'
          }}>
            AD
          </span>
        </div>
      ) : null}

      {/* 탭 내용 및 모달을 감싸는 동적 영역 wrapper */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', paddingBottom: '80px' }}>
        {pwaTab === 'home' ? (
        /* 홈 화면 (적립 카드 중심) */
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {claimMessage && (
            <div style={{ 
              padding: '10px 12px', 
              borderRadius: 'var(--border-radius-md)', 
              backgroundColor: claimMessage.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 69, 58, 0.15)',
              border: `1px solid ${claimMessage.success ? 'var(--accent-green)' : 'var(--accent-red)'}`,
              color: claimMessage.success ? 'var(--accent-green)' : 'var(--accent-red)',
              fontSize: '13px',
              textAlign: 'center',
              fontWeight: 700,
              lineHeight: 1.3,
              boxShadow: 'var(--shadow-sm)'
            }}>
              {claimMessage.success ? '✅ ' : '❌ '} {claimMessage.text}
            </div>
          )}

          {/* 상점 셀렉터 및 카드 보드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center' }}>
              <select 
                value={isUnassignedStoreView ? 'unassigned' : selectedStoreId} 
                onChange={(e) => {
                  const nextStoreId = e.target.value;
                  if (nextStoreId === 'unassigned') {
                    setManualStoreBrowseId('');
                  } else {
                    setManualStoreBrowseId(nextStoreId);
                    setSelectedStoreId(nextStoreId);
                  }
                  setClaimMessage(null);
                }}
                style={{ 
                  width: '100%',
                  maxWidth: '260px',
                  padding: '8px 12px', 
                  borderRadius: 'var(--border-radius-pill)', 
                  border: '1px solid var(--border-color)', 
                  outline: 'none', 
                  fontSize: '13px', 
                  fontWeight: 600,
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'center',
                  textAlignLast: 'center'
                }}
              >
                <option value="unassigned">{t.unassignedStoreName}</option>
                {stores.filter(s => s.id.startsWith('store_id_')).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 박스 1 (가게 정보 카드) */}
            <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 14px', backgroundColor: '#FFFFFF', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '10px', right: '12px' }}>
                <span style={{ 
                  fontSize: '10px', 
                  color: '#FF073A', 
                  fontWeight: 700,
                  backgroundColor: 'rgba(255, 7, 58, 0.08)',
                  border: '1px solid rgba(255, 7, 58, 0.2)',
                  padding: '2.5px 5px',
                  borderRadius: '4px',
                  display: 'inline-block'
                }}>
                  {t.earnRateLimitLabel} {formatInterval(selectedStore.earningIntervalMinutes, language)}
                </span>
              </div>
              <h4 
                onClick={() => {
                  if (selectedStore.id !== 'unassigned') {
                    window.location.hash = `#/store-home/${selectedStore.id}`;
                  }
                }}
                style={{ 
                  fontSize: '18px', 
                  fontWeight: 800, 
                  margin: 0, 
                  color: selectedStore.id !== 'unassigned' ? '#5f5ce6' : '#1c1c1e', 
                  lineHeight: '1.2', 
                  paddingRight: '85px',
                  cursor: selectedStore.id !== 'unassigned' ? 'pointer' : 'default',
                  textDecoration: selectedStore.id !== 'unassigned' ? 'underline' : 'none'
                }}
              >
                {selectedStore.name} {selectedStore.id !== 'unassigned' && <span style={{ fontSize: '11px', fontWeight: 550, textDecoration: 'none', display: 'inline-block', marginLeft: '4px', verticalAlign: 'middle' }}>🔗</span>}
              </h4>
              <span style={{ fontSize: '14.5px', color: 'var(--text-primary)', display: 'block', lineHeight: '1.3' }}>
                {t.rewardLabel} <strong style={{ fontSize: '16.5px', fontWeight: 800, color: '#FF073A' }}>${selectedStore.pointRewardPer7Stamps.toFixed(2)}</strong>
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', display: 'block', lineHeight: '1.3', marginTop: '2.5px' }}>
                {language === 'ko' ? '현재까지 스탬프가치 합산:' : 'Accumulated Stamp Value:'}{' '}
                <strong style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-color)' }}>${currentStampsSum.toFixed(2)}</strong>
              </span>
            </div>

            {/* 박스 2 (스탬프 카드) */}
            <div className="imin-card" onClick={() => setIsTimelineModalOpen(true)} style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              padding: '12px 14px', 
              backgroundColor: '#F8F9FF', 
              border: '1px solid rgba(95, 92, 230, 0.22)',
              boxShadow: '0 4px 12px rgba(95, 92, 230, 0.04), inset 0 1px 3px rgba(0,0,0,0.01)',
              cursor: 'pointer' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary-color)', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>⭐</span>
                  {language === 'ko' ? '현재 적립한 스탬프' : 'Current Stamps'}
                </span>
                
                {/* 스탬프 완성도 표시 금빛 배지 */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '2px 6px', 
                  borderRadius: '20px', 
                  backgroundColor: 'rgba(255, 149, 0, 0.12)', 
                  color: '#D97706', 
                  fontSize: '10px', 
                  fontWeight: 800 
                }}>
                  <span>{currentStamps} / 7</span>
                </div>
              </div>

              <div className="stamp-board-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', width: '100%', boxSizing: 'border-box' }}>
                {(() => {
                  return Array.from({ length: 7 }).map((_, idx) => {
                    const stampNum = idx + 1;
                    const isChecked = currentStamps >= stampNum;

                    // Tooltip style adjustment to prevent horizontal overflow/clipping on edge slots
                    const isLeftEdge = idx <= 1;
                    const isRightEdge = idx >= 5;
                    
                    const tooltipStyle: React.CSSProperties = {
                      position: 'absolute',
                      bottom: '125%',
                      backgroundColor: '#1c1c1e',
                      color: '#ffffff',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      whiteSpace: 'pre-line',
                      wordBreak: 'break-all',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      zIndex: 10,
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      fontFamily: 'inherit',
                      width: 'max-content',
                      maxWidth: '180px',
                      ...(isLeftEdge ? {
                        left: '0%',
                        transform: 'none',
                      } : isRightEdge ? {
                        right: '0%',
                        transform: 'none',
                      } : {
                        left: '50%',
                        transform: 'translateX(-50%)',
                      })
                    };

                    const arrowStyle: React.CSSProperties = {
                      position: 'absolute',
                      top: '100%',
                      width: '0',
                      height: '0',
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '5px solid #1c1c1e',
                      ...(isLeftEdge ? {
                        left: '12px',
                        transform: 'none',
                      } : isRightEdge ? {
                        right: '12px',
                        transform: 'none',
                      } : {
                        left: '50%',
                        transform: 'translateX(-50%)',
                      })
                    };

                    const stampVal = (userCard && userCard.stamps && userCard.stamps[idx]) 
                      ? userCard.stamps[idx].cashValue 
                      : (selectedStore.pointRewardPer7Stamps / 7);

                    return (
                      <div 
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStampClick(idx);
                        }}
                        style={{ 
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                          width: '100%',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                      >
                        {/* 6각형 허니컴 스탬프 영역 */}
                        <div
                          style={{ 
                            width: '100%',
                            aspectRatio: '1',
                            backgroundColor: isChecked ? 'var(--accent-blue)' : '#C7C7CC', // 테두리 색상
                            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                            WebkitClipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px', // 테두리 두께
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: isChecked ? 'var(--accent-blue)' : '#FFFFFF', // 적립 시 파랑, 미적립 시 하양
                              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                              WebkitClipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isChecked ? '#FFFFFF' : '#8E8E93',
                              fontWeight: 800,
                              fontSize: '13px',
                              boxSizing: 'border-box'
                            }}
                          >
                            {isChecked ? <Heart size={28} fill="#FF3B30" color="#FF3B30" strokeWidth={0} /> : stampNum}
                          </div>
                        </div>

                        {/* 별표 아래 가치 표시 */}
                        <span style={{ 
                          fontSize: '8px', 
                          fontWeight: isChecked ? 800 : 600, 
                          color: isChecked ? '#10B981' : 'rgba(16, 185, 129, 0.45)', 
                          letterSpacing: '-0.3px',
                          whiteSpace: 'nowrap'
                        }}>
                          +${stampVal.toFixed(2)}
                        </span>
                        
                        {clickedStampIndex === idx && (
                          <div style={tooltipStyle}>
                            <span>
                              {clickedStampDate === 'not_earned' 
                                ? (language === 'ko' ? '미적립' : 'Not Earned') 
                                : clickedStampDate}
                            </span>
                            <div style={arrowStyle} />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* 스탬프 선물/기부하기 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentStamps === 7) {
                    setGiftingActiveTab('earn');
                  } else {
                    setGiftingActiveTab('friend');
                  }
                  setShowGiftingPanel(true);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--primary-color)',
                  backgroundColor: '#ffffff',
                  color: 'var(--primary-color)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
              >
                {language === 'ko' ? '적립/선물/기부하기' : 'Earn/Gift/Donate'}
              </button>
              {!isUnassignedStoreView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSharbeeReview();
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,184,0,0.45)',
                    backgroundColor: 'rgba(255,184,0,0.08)',
                    color: '#1C1C1E',
                    fontWeight: 900,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <img src={SHARBEE_HELPER_IMAGE} alt="Sharbee" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
                  <span>{language === 'ko' ? '\uC0E4\uBE44\uC640 \uB9AC\uBDF0 \uC4F0\uACE0 \uC2A4\uD0EC\uD504 \uBC1B\uAE30' : 'Write with Sharbee'}</span>
                </button>
              )}
            </div>

            {/* 박스 3 (캐시 사용 카드) */}
            <div className="imin-card" style={{ 
              backgroundColor: 'var(--primary-light)',
              padding: '12px 14px',
              borderRadius: 'var(--border-radius-lg)',
              border: '1px solid rgba(95, 92, 230, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              textAlign: 'center',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 700, display: 'block' }}>
                {t.ptsBalanceLabel}
              </span>
              <strong style={{ fontSize: '28px', fontWeight: 900, color: '#FF073A', display: 'block', lineHeight: '1.1' }}>
                ${pointsBalance.toFixed(2)}
              </strong>

              {/* 스탬프 캐시 사용 요청 CTA (아래로 분리된 전체 너비 버튼 - 스크린샷 디자인 매칭) */}
              <button 
                className="discount-barcode-btn"
                onClick={() => {
                  setUseType(pointsBalance > 0 ? 'full' : 'partial');
                  setPaymentTarget('self'); // 기본값: 자신 사용
                  setSelectedRequestNpoId('npo_1'); // 기본값: npo_1
                  setRequestAmountInput(pointsBalance > 0 ? pointsBalance.toFixed(2) : '5.00');
                  setShowPaymentRequestModal(true);
                }}
                style={{ marginTop: '4px' }}
              >
                <span>{t.discountBarcodeBtn}</span>
              </button>
            </div>



            {/* 스탬프 나눔 타임라인 카드 */}
            <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', backgroundColor: '#FFFFFF' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--primary-color)'
              }}>
                💬 {language === 'ko' ? '스탬프 나눔 타임라인' : 'Stamp Timeline'}
              </div>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px', 
                maxHeight: '220px', 
                overflowY: 'auto', 
                paddingRight: '4px' 
              }}>
                {(() => {
                  const timelineGifts = isUnassignedStoreView ? [] : [...gifts]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                  if (timelineGifts.length === 0) {
                    return (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', backgroundColor: 'var(--background-color)', borderRadius: '8px' }}>
                        {language === 'ko' ? '아직 주고받은 스탬프 나눔 메시지가 없습니다.' : 'No stamp messages yet.'}
                      </div>
                    );
                  }

                  return timelineGifts.map(gift => {
                    const senderUser = users.find(u => u.id === gift.senderId);
                    const recipientUser = users.find(u => u.id === gift.recipientId);
                    const giftStore = stores.find(s => s.id === gift.storeId);
                    const storeName = giftStore ? giftStore.name : gift.storeId;
                    
                    const isSenderOwner = senderUser?.role === 'owner';
                    const isRecipientOwner = recipientUser?.role === 'owner';

                    // Sender details
                    let senderName = '';
                    let senderHandle = '';
                    if (isSenderOwner) {
                      senderName = language === 'ko' ? `${storeName} 사장님` : `${storeName} Owner`;
                      senderHandle = '@owner';
                    } else {
                      senderName = senderUser ? (gift.senderId === currentUser.id ? (language === 'ko' ? '나' : 'Me') : senderUser.name.replace('회원_', '')) : (language === 'ko' ? '알수없음' : 'Unknown');
                      senderHandle = senderUser ? `@${senderUser.nickname}` : '';
                    }
                    const senderInitials = senderName ? senderName.trim().charAt(0) : '?';

                    // Recipient details
                    let recipientName = '';
                    let recipientHandle = '';
                    const npoRecipient = nonProfits.find(n => n.id === gift.recipientId);

                    if (isRecipientOwner) {
                      recipientName = language === 'ko' ? `${storeName} 사장님` : `${storeName} Owner`;
                      recipientHandle = '@owner';
                    } else if (npoRecipient) {
                      recipientName = npoRecipient.name;
                      recipientHandle = '@npo';
                    } else {
                      recipientName = recipientUser ? (gift.recipientId === currentUser.id ? (language === 'ko' ? '나' : 'Me') : recipientUser.name.replace('회원_', '')) : (language === 'ko' ? '알수없음' : 'Unknown');
                      recipientHandle = recipientUser ? `@${recipientUser.nickname}` : '';
                    }
                    const recipientInitials = recipientName ? recipientName.trim().charAt(0) : '?';

                    const dateStr = new Date(gift.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const isReceived = gift.recipientId === currentUser.id;

                    return (
                      <div 
                        key={gift.id}
                        onClick={() => setIsTimelineModalOpen(true)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          borderBottom: '1px solid rgba(0,0,0,0.06)',
                          paddingBottom: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: isSenderOwner ? '#5856D6' : (gift.senderId === currentUser.id ? 'var(--primary-color)' : '#30B0C7'),
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              boxShadow: '0 1.5px 3px rgba(0,0,0,0.1)',
                              flexShrink: 0
                            }}>
                              {senderInitials}
                            </div>
                            {gift.status === 'accepted' && (
                              <div style={{
                                width: '2px',
                                backgroundColor: '#E5E5EA',
                                position: 'absolute',
                                top: '28px',
                                bottom: '-22px',
                                zIndex: 1
                              }} />
                            )}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <strong style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>{senderName}</strong>
                                <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>{senderHandle}</span>
                                <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>·</span>
                                <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>{dateStr}</span>
                              </div>
                              
                              {gift.stampsTransferred === 0 ? (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  backgroundColor: (gift.message.includes('기부') || gift.message.toLowerCase().includes('donation') || gift.message.includes('후원'))
                                    ? 'rgba(52, 199, 89, 0.08)'
                                    : 'rgba(0, 122, 255, 0.08)',
                                  color: (gift.message.includes('기부') || gift.message.toLowerCase().includes('donation') || gift.message.includes('후원'))
                                    ? '#34C759'
                                    : '#007AFF'
                                }}>
                                  {(gift.message.includes('기부') || gift.message.toLowerCase().includes('donation') || gift.message.includes('후원'))
                                    ? (language === 'ko' ? '🤝 기부 승인' : '🤝 Donation Approved')
                                    : (language === 'ko' ? '💳 캐시 승인' : '💳 Cash Approved')}
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  backgroundColor: isReceived ? 'rgba(52, 199, 89, 0.08)' : 'rgba(255, 59, 48, 0.08)',
                                  color: isReceived ? '#34C759' : '#FF3B30'
                                }}>
                                  {isReceived ? '+' : '-'}{gift.stampsTransferred} {language === 'ko' ? '스탬프' : 'Stamps'}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                              🏪 {storeName}
                            </div>

                            <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', marginTop: '3px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                              {gift.message}
                            </div>

                            {gift.status === 'pending' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: '#FF9500', fontWeight: 600, marginTop: '4px', backgroundColor: 'rgba(255, 149, 0, 0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                                ⏳ {language === 'ko' ? '수락 대기 중' : 'Pending'}
                              </span>
                            )}
                            {gift.status === 'declined' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', color: '#FF3B30', fontWeight: 600, marginTop: '4px', backgroundColor: 'rgba(255, 59, 48, 0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                                ❌ {language === 'ko' ? '거절됨' : 'Declined'}
                              </span>
                            )}
                          </div>
                        </div>

                        {gift.status === 'accepted' && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', width: '28px', zIndex: 2 }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: isRecipientOwner ? '#5856D6' : (gift.recipientId === currentUser.id ? 'var(--primary-color)' : '#30B0C7'),
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '8px',
                                fontWeight: 700,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                flexShrink: 0
                              }}>
                                {recipientInitials}
                              </div>
                            </div>

                            <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.015)', padding: '6px 8px', borderRadius: '6px', borderLeft: '2px solid #E5E5EA' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '10.5px', color: 'var(--text-primary)' }}>{recipientName}</strong>
                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{recipientHandle}</span>
                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{language === 'ko' ? '의 답장' : ' replied'}</span>
                              </div>
                              <div style={{ fontSize: '10.5px', color: '#48484a', marginTop: '1px', fontStyle: 'italic' }}>
                                "{gift.thanksMessage || (language === 'ko' ? '스탬프 선물을 수락했습니다.' : 'Accepted stamp gift.')}"
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* 단체 기부하기 카드 */}
            <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', backgroundColor: '#FFFFFF' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--accent-purple)'
              }}>
                <Heart size={16} />
                {t.donateStampsBtn}
              </div>

              {/* 단체 리스트 노출 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {nonProfits.filter(n => n.status === 'active').map(npo => (
                  <div 
                    key={npo.id} 
                    style={{ 
                      border: '1px solid rgba(142, 92, 230, 0.15)', 
                      borderRadius: 'var(--border-radius-md)', 
                      padding: '12px 14px', 
                      backgroundColor: 'rgba(142, 92, 230, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{npo.name}</strong>
                      <button
                        disabled={currentStamps <= 0}
                        onClick={() => {
                          setDonateResult(null);
                          setSelectedNpoId(npo.id);
                          setShowDonateModal(true);
                        }}
                        className="imin-chip"
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderColor: 'var(--accent-purple)',
                          color: 'var(--accent-purple)',
                          cursor: 'pointer',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {language === 'ko' ? '기부하기' : 'Donate'}
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                      {npo.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            {currentStamps <= 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', display: 'block', marginTop: '4px' }}>
                {t.giftDonateMinTip}
              </span>
            )}

            {/* PWA 바로가기 추가 안내 배너 (맨 아래로 이동) */}
            <div 
              onClick={handleInstallClick}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--border-radius-md)',
                background: 'linear-gradient(135deg, #f5f5f7, #e5e5ea)',
                border: '1px solid #d1d1d6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.1s ease',
                marginTop: '8px'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smartphone size={20} style={{ color: 'var(--primary-color)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1c1c1e' }}>
                    📱 홈 화면에 바로가기(앱) 추가
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#636366', marginTop: '2px' }}>
                    로그인 없이 언제든 대시보드를 확인하세요!
                  </span>
                </div>
              </div>
              <span style={{ 
                fontSize: '10px', 
                fontWeight: 700, 
                backgroundColor: 'var(--primary-color)', 
                color: '#ffffff', 
                padding: '4px 8px', 
                borderRadius: '12px'
              }}>
                설치
              </span>
            </div>

          </div>

        </div>
      ) : (
        /* 기부 임팩트 대시보드 탭 */
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 나의 누적 기여 임팩트 카드 */}
          <div className="imin-card" style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--accent-purple) 100%)', color: '#ffffff', border: 'none' }}>
            <span style={{ fontSize: '12px', opacity: 0.8, fontWeight: 600 }}>{t.impactTitle}</span>
            <h2 style={{ fontSize: '32px', fontWeight: 900, marginTop: '4px' }}>
              ${totalMyDonatedValue.toFixed(2)}
            </h2>
            <p style={{ fontSize: '14px', opacity: 0.9, marginTop: '8px' }}>
              {t.impactDescPrefix}<strong>{totalMyDonatedStamps}개</strong>{t.impactDescSuffix}
            </p>
          </div>

          {/* 기부 메타포 시각화 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="imin-card" style={{ textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '32px', marginBottom: '4px' }}>🍱</div>
              <strong style={{ fontSize: '18px', display: 'block', color: 'var(--accent-purple)' }}>{metaphor.meals}{t.mealsUnit}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.mealsLabel}</span>
            </div>
            <div className="imin-card" style={{ textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '32px', marginBottom: '4px' }}>🌳</div>
              <strong style={{ fontSize: '18px', display: 'block', color: 'var(--accent-green)' }}>{metaphor.trees}{t.treesUnit}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.treesLabel}</span>
            </div>
          </div>

          {/* 최근 나눔 타임라인 히스토리 */}
          <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={16} style={{ color: 'var(--primary-color)' }} />
              {t.timelineTitle}
            </h4>

            {myDonations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myDonations.map(don => {
                  const npo = nonProfits.find(n => n.id === don.nonProfitId) || { name: '기부단체' };
                  const store = stores.find(s => s.id === don.storeId) || { name: '매장' };
                  return (
                    <div key={don.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <div>
                        <strong>{npo.name}</strong> {t.timelineDonated}
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {store.name} | {don.stampCount}{t.timelineStampsCount}
                        </span>
                      </div>
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 700 }}>
                        +${don.monetaryValue.toFixed(2)} {t.timelineValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {t.timelineEmpty}
              </div>
            )}
          </div>

          {/* 스탬프 캐시 결제 & 기부 요청 기록 */}
          <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={16} style={{ color: 'var(--primary-color)' }} />
              {language === 'ko' ? '스탬프 캐시 결제 & 기부 요청 기록' : 'Stamp Cash Payment & Donation Request History'}
            </h4>

            {paymentRequests.filter(r => r.userId === currentUser.id).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paymentRequests
                  .filter(r => r.userId === currentUser.id)
                  .map(req => {
                    const store = stores.find(s => s.id === req.storeId) || { name: '알 수 없는 매장' };
                    return (
                      <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                        <div>
                          <strong>
                            {req.type === 'donation' 
                              ? (language === 'ko' ? `🧡 [${req.nonProfitName || ''}] 기부 요청` : `🧡 Donation to [${req.nonProfitName || ''}]`)
                              : (language === 'ko' ? '👤 개인 할인 결제 요청' : '👤 Personal discount request')}
                          </strong>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {store?.name || ''} | {new Date(req.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>
                            ${req.amount.toFixed(2)}
                          </strong>
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontWeight: 700,
                            backgroundColor: req.status === 'approved' 
                              ? '#ECFDF5' 
                              : req.status === 'rejected' 
                                ? '#FEF2F2' 
                                : '#FFFBEB',
                            color: req.status === 'approved' 
                              ? '#065F46' 
                              : req.status === 'rejected' 
                                ? '#991B1B' 
                                : '#B45309'
                          }}>
                            {req.status === 'approved' 
                              ? (language === 'ko' ? '승인 완료' : 'Approved') 
                              : req.status === 'rejected' 
                                ? (language === 'ko' ? '거절됨' : 'Rejected') 
                                : (language === 'ko' ? '대기 중' : 'Pending')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {language === 'ko' ? '요청 이력이 아직 없습니다.' : 'No requests history yet.'}
              </div>
            )}
          </div>

        </div>
      )}

      {/* --- 바텀 모달 시트 (친구 선물) --- */}


      {showCameraScanner && (
        <div
          className="bottom-sheet-overlay"
          onClick={stopCameraScanner}
          style={{
            position: 'fixed',
            inset: 0,
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '72px 18px 18px',
            backgroundColor: 'rgba(0,0,0,0.62)',
            overflowY: 'auto',
            zIndex: 9999
          }}
        >
          <div
            className="bottom-sheet"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '340px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              borderRadius: '18px',
              padding: '16px',
              maxHeight: 'calc(100vh - 96px)',
              overflowY: 'auto',
              boxShadow: '0 18px 45px rgba(0,0,0,0.28)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                <img src="/camera-scan-icon.png" alt="" aria-hidden="true" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                QR scan
              </div>
              <button
                type="button"
                onClick={stopCameraScanner}
                style={{ border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '22px', lineHeight: 1 }}
                aria-label="Close QR scanner"
              >
                ?
              </button>
            </div>

            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                overflow: 'hidden',
                borderRadius: '14px',
                background: '#050505',
                border: '1px solid rgba(255,255,255,0.12)'
              }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '18%',
                  border: '2px solid rgba(255,255,255,0.92)',
                  borderRadius: '16px',
                  boxShadow: '0 0 0 999px rgba(0,0,0,0.22)'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '22%',
                  right: '22%',
                  top: '50%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #6C63FF, transparent)',
                  boxShadow: '0 0 14px rgba(108,99,255,0.9)'
                }}
              />
            </div>

            {cameraError && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', backgroundColor: '#FFF7ED', color: '#9A3412', fontSize: '12px', lineHeight: 1.4, fontWeight: 700 }}>
                {cameraError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={manualQrToken}
                onChange={(e) => setManualQrToken(e.target.value)}
                placeholder={language === 'ko' ? 'QR ?? ?? ??' : 'Enter QR token'}
                className="imin-input"
                style={{ marginTop: 0, fontSize: '13px', padding: '9px 10px' }}
              />
              <button
                type="button"
                onClick={() => handleScannedQrValue(manualQrToken)}
                disabled={!manualQrToken.trim()}
                style={{
                  minWidth: '68px',
                  border: 0,
                  borderRadius: '10px',
                  background: manualQrToken.trim() ? 'var(--primary-color)' : 'var(--border-color)',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: manualQrToken.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                {language === 'ko' ? '??' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGiftModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowGiftModal(false)} style={{ alignItems: 'flex-start', justifyContent: 'center', padding: '64px 16px 16px 16px', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: 'var(--border-radius-lg)', maxWidth: '330px', animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)', maxHeight: 'calc(100% - 80px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{t.giftTitle}</h3>
              <button onClick={() => setShowGiftModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>{t.giftClose}</button>
            </div>

            {!giftResult ? (
              <>
                <div style={{ backgroundColor: 'var(--background-color)', padding: '12px', borderRadius: 'var(--border-radius-md)', fontSize: '13px' }}>
                  {t.giftDesc}<br/>
                  * {t.giftAvail} <strong>{currentStamps}{language === 'ko' ? '개' : ' stamps'}</strong>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.giftSearchLabel}</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <input 
                      type="text" 
                      value={friendQuery}
                      onChange={(e) => { setFriendQuery(e.target.value); setSelectedFriend(null); }}
                      placeholder={t.giftSearchPlaceholder} 
                      className="imin-input"
                      style={{ padding: '8px 4px', fontSize: '14px' }}
                    />
                  </div>
                </div>

                {/* 검색 결과 */}
                {searchedFriends.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', padding: '2px 0' }}>
                    {searchedFriends.map(f => (
                      <div 
                        key={f.id} 
                        onClick={() => setSelectedFriend(f)}
                        style={{ 
                          padding: '10px 12px', 
                          borderRadius: 'var(--border-radius-md)', 
                          backgroundColor: selectedFriend?.id === f.id ? 'var(--primary-light)' : '#F6F6FA', 
                          border: `1.5px solid ${selectedFriend?.id === f.id ? 'var(--primary-color)' : 'var(--border-color)'}`, 
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                            @{f.nickname}
                          </span>
                          <span style={{ 
                            fontSize: '10px', 
                            fontWeight: 700, 
                            color: selectedFriend?.id === f.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                            backgroundColor: selectedFriend?.id === f.id ? 'rgba(95, 92, 230, 0.1)' : 'rgba(0,0,0,0.04)',
                            padding: '2px 6px',
                            borderRadius: '10px'
                          }}>
                            {selectedFriend?.id === f.id ? (language === 'ko' ? '선택됨' : 'Selected') : (language === 'ko' ? '선택' : 'Select')}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          📞 *-{f.phoneNumber.replace(/\D/g, '').slice(-4)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedFriend && (
                  <div style={{ 
                    border: '1px solid var(--primary-color)', 
                    borderRadius: 'var(--border-radius-md)', 
                    padding: '10px 12px', 
                    backgroundColor: 'var(--primary-light)', 
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <span style={{ color: 'var(--primary-color)', fontWeight: 700 }}>
                      ✓ {language === 'ko' ? '선택된 친구 정보' : 'Selected Friend Info'}
                    </span>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      @{selectedFriend.nickname} (*-{selectedFriend.phoneNumber.replace(/\D/g, '').slice(-4)})
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.giftCountLabel}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <input 
                      type="number" 
                      min={1} 
                      max={currentStamps}
                      value={giftStampsCount}
                      onChange={(e) => setGiftStampsCount(Math.min(currentStamps, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="imin-input"
                      style={{ width: '60px', textAlign: 'center', padding: '6px' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.giftMaxSuffix}</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.giftMessageLabel}</label>
                  <input 
                    type="text" 
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder={t.giftMessagePlaceholder}
                    className="imin-input"
                    style={{ padding: '8px 4px', fontSize: '14px' }}
                  />
                </div>

                <button 
                  disabled={!selectedFriend || currentStamps <= 0}
                  onClick={handleSendGift}
                  className="imin-btn imin-btn-primary"
                  style={{ backgroundColor: 'var(--accent-blue)', marginTop: '8px' }}
                >
                  {t.giftBtn}
                </button>
              </>
            ) : (
              /* 선물 완료 리턴 피드백 */
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <div style={{ color: 'var(--accent-blue)' }}>
                  <CheckCircle2 size={56} style={{ margin: '0 auto' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800 }}>{t.giftSuccessTitle}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', lineHeight: 1.5 }}>
                    {t.giftSuccessDesc1}<strong>{giftResult.transferred}{language === 'ko' ? '개' : ' stamps'}</strong>{t.giftSuccessDesc2}
                    {giftResult.returned > 0 && (
                      <span style={{ display: 'block', color: 'var(--accent-red)', fontWeight: 600 }}>
                        {t.giftSuccessLimitTip.replace('{returned}', giftResult.returned.toString())}
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={() => setShowGiftModal(false)} className="imin-btn imin-btn-secondary" style={{ marginTop: '8px' }}>
                  {t.giftSuccessOk}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 바텀 모달 시트 (NPO 기부) --- */}
      {showDonateModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowDonateModal(false)} style={{ alignItems: 'flex-start', justifyContent: 'center', padding: '64px 16px 16px 16px', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: 'var(--border-radius-lg)', maxWidth: '330px', animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)', maxHeight: 'calc(100% - 80px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{t.donateTitle}</h3>
              <button onClick={() => setShowDonateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>{t.donateClose}</button>
            </div>

            {!donateResult ? (
              <>
                <div style={{ backgroundColor: 'var(--background-color)', padding: '12px', borderRadius: 'var(--border-radius-md)', fontSize: '13px' }}>
                  {t.donateDesc}<br/>
                  * {t.donateAvail} <strong>{currentStamps}{language === 'ko' ? '개' : ' stamps'}</strong>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.donateNpoLabel}</label>
                  <select 
                    value={selectedNpoId}
                    onChange={(e) => setSelectedNpoId(e.target.value)}
                    style={{ width: '100%', padding: '10px 4px', border: 'none', borderBottom: '2px solid var(--border-color)', outline: 'none', fontSize: '15px', fontWeight: 600, backgroundColor: 'transparent', marginTop: '6px' }}
                  >
                    {nonProfits.filter(n => n.status === 'active').map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.donateCountLabel}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <input 
                      type="number" 
                      min={1} 
                      max={currentStamps}
                      value={donateStampsCount}
                      onChange={(e) => setDonateStampsCount(Math.min(currentStamps, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="imin-input"
                      style={{ width: '60px', textAlign: 'center', padding: '6px' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.donateMaxSuffix}</span>
                  </div>
                </div>

                {/* 실시간 환산 금액 가이드 */}
                <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--background-color)', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>{t.donateValLabel}</span>
                  <strong style={{ color: 'var(--accent-purple)' }}>
                    ${((selectedStore.pointRewardPer7Stamps / 7) * donateStampsCount).toFixed(2)}{t.donateValSuffix}
                  </strong>
                </div>

                <button 
                  disabled={currentStamps <= 0}
                  onClick={handleSendDonation}
                  className="imin-btn imin-btn-primary"
                  style={{ backgroundColor: 'var(--accent-purple)', marginTop: '8px' }}
                >
                  {t.donateBtn}
                </button>
              </>
            ) : (
              /* 기부 성공 피드백 */
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <div style={{ color: 'var(--accent-purple)' }}>
                  <CheckCircle2 size={56} style={{ margin: '0 auto' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800 }}>{t.donateSuccessTitle}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', lineHeight: 1.5 }}>
                    {t.donateSuccessDesc1}<strong>${donateResult.toFixed(2)}</strong>{t.donateSuccessDesc2}
                  </p>
                </div>
                <button onClick={() => setShowDonateModal(false)} className="imin-btn imin-btn-secondary" style={{ marginTop: '8px' }}>
                  {t.donateSuccessOk}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 리뷰 등록 후 SNS 공유 프롬프트 (원탭 공유로 +1장) --- */}
      {sharePrompt && (
        <div
          className="bottom-sheet-overlay"
          onClick={() => { const sid = sharePrompt.storeId; setSharePrompt(null); window.location.hash = `#/store-home/${sid}`; }}
          style={{ alignItems: 'center' }}
        >
          <div
            className="imin-card"
            onClick={e => e.stopPropagation()}
            style={{ width: '88%', maxWidth: '330px', padding: '24px 22px', borderRadius: 'var(--border-radius-lg)', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', alignItems: 'center' }}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'rgba(52,199,89,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={28} color="#34C759" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#1c1c1e' }}>
              {language === 'ko' ? '리뷰가 등록되었어요!' : 'Review posted!'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {language === 'ko'
                ? '방금 만든 리뷰를 내 SNS(인스타·스레드·페북 등) 한 곳이라도 올리면 스탬프 1장을 더 드려요. 사진은 자동 첨부, 글은 복사돼 붙여넣기만 하면 됩니다.'
                : 'Share this review to any of your SNS (Instagram, Threads, Facebook…) for 1 more stamp. The photo is attached and the caption is copied for you.'}
            </p>
            <button
              disabled={sharing}
              onClick={async () => { const sid = sharePrompt.storeId; await shareReviewToSns(sharePrompt, sharePromptFile); setSharePrompt(null); window.location.hash = `#/store-home/${sid}`; }}
              className="imin-btn imin-btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Send size={16} /> {language === 'ko' ? 'SNS에 공유하고 +1 스탬프' : 'Share & get +1 stamp'}
            </button>
            <button
              onClick={() => { const sid = sharePrompt.storeId; setSharePrompt(null); window.location.hash = `#/store-home/${sid}`; }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              {language === 'ko' ? '나중에 할게요' : 'Maybe later'}
            </button>
          </div>
        </div>
      )}

      {/* --- 스탬프 캐시 사용 요청 모달 --- */}
      {showPaymentRequestModal && (
        <div className="bottom-sheet-overlay" onClick={() => {
          if (!currentRequest || currentRequest.status !== 'pending') {
            setShowPaymentRequestModal(false);
            setCurrentRequestId(null);
          }
        }} style={{ alignItems: 'flex-start', justifyContent: 'center', padding: '64px 16px 16px 16px', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center', borderRadius: 'var(--border-radius-lg)', maxWidth: '330px', animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)', maxHeight: 'calc(100% - 80px)' }}>
            
            {!currentRequest ? (
              /* 1단계: 금액 설정 및 요청 보내기 */
              <>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{t.requestTitle}</h3>
                  <button onClick={() => setShowPaymentRequestModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>{t.requestClose}</button>
                </div>

                {/* 보유 잔액 연보라색 카드 형태 */}
                <div style={{ 
                  width: '100%', 
                  padding: '16px', 
                  borderRadius: 'var(--border-radius-lg)', 
                  backgroundColor: 'var(--primary-light)', 
                  border: '1px solid var(--primary-color)',
                  textAlign: 'left',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    {t.requestBalanceLabel}
                  </span>
                  <strong style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary-color)' }}>
                    ${pointsBalance.toFixed(2)}
                  </strong>
                </div>

                {/* 사용처 선택 탭 */}
                <div style={{ 
                  display: 'flex', 
                  width: '100%', 
                  backgroundColor: 'var(--background-color)', 
                  padding: '4px', 
                  borderRadius: 'var(--border-radius-pill)', 
                  border: '1px solid var(--border-color)',
                  margin: '4px 0'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTarget('self');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      border: 'none',
                      borderRadius: 'var(--border-radius-pill)',
                      backgroundColor: paymentTarget === 'self' ? '#ffffff' : 'transparent',
                      color: paymentTarget === 'self' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: paymentTarget === 'self' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>👤</span>
                    {language === 'ko' ? '자신이 사용' : 'Self Discount'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentTarget('donation');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      border: 'none',
                      borderRadius: 'var(--border-radius-pill)',
                      backgroundColor: paymentTarget === 'donation' ? '#ffffff' : 'transparent',
                      color: paymentTarget === 'donation' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: paymentTarget === 'donation' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🧡</span>
                    {language === 'ko' ? '기부 단체 기부' : 'Charity Donation'}
                  </button>
                </div>

                {/* 기부할 단체 선택 리스트 */}
                {paymentTarget === 'donation' && (
                  <div style={{ width: '100%', textAlign: 'left', marginTop: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {language === 'ko' ? '기부할 단체 선택' : 'Select Charity to Donate'}
                    </label>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      marginTop: '6px', 
                      maxHeight: '140px', 
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {nonProfits.filter(n => n.status === 'active').map(npo => (
                        <div 
                          key={npo.id}
                          onClick={() => setSelectedRequestNpoId(npo.id)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--border-radius-md)',
                            backgroundColor: selectedRequestNpoId === npo.id ? 'rgba(142, 92, 230, 0.08)' : '#f9f9fa',
                            border: `1px solid ${selectedRequestNpoId === npo.id ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            textAlign: 'left',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '13px', color: selectedRequestNpoId === npo.id ? 'var(--accent-purple)' : 'var(--text-primary)' }}>
                              {npo.name}
                            </strong>
                            {selectedRequestNpoId === npo.id && <span style={{ color: 'var(--accent-purple)', fontSize: '12px' }}>✓</span>}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                            {npo.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 전액/일부 선택 탭 */}
                <div style={{ 
                  display: 'flex', 
                  width: '100%', 
                  backgroundColor: 'var(--background-color)', 
                  padding: '4px', 
                  borderRadius: 'var(--border-radius-pill)', 
                  border: '1px solid var(--border-color)',
                  margin: '8px 0'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUseType('full');
                      setRequestAmountInput(pointsBalance.toFixed(2));
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      border: 'none',
                      borderRadius: 'var(--border-radius-pill)',
                      backgroundColor: useType === 'full' ? '#ffffff' : 'transparent',
                      color: useType === 'full' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: useType === 'full' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {language === 'ko' ? '전액 사용' : 'Use Full Amount'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseType('partial');
                      setRequestAmountInput(Math.min(5.00, pointsBalance).toFixed(2));
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      border: 'none',
                      borderRadius: 'var(--border-radius-pill)',
                      backgroundColor: useType === 'partial' ? '#ffffff' : 'transparent',
                      color: useType === 'partial' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: useType === 'partial' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {language === 'ko' ? '일부 사용' : 'Use Partial Amount'}
                  </button>
                </div>

                {/* 금액 입력 영역 */}
                <div style={{ width: '100%', textAlign: 'left' }}>
                  {useType === 'full' ? (
                    <div style={{ 
                      padding: '16px', 
                      borderRadius: 'var(--border-radius-md)', 
                      backgroundColor: '#F8F9FA', 
                      border: '1px solid var(--border-color)',
                      textAlign: 'center',
                      marginTop: '8px'
                    }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '결제 요청 예정 캐시' : 'Cash to Redeem'}
                      </span>
                      <strong style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary-color)' }}>
                        ${pointsBalance.toFixed(2)}
                      </strong>
                    </div>
                  ) : (
                    <>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.requestAmountLabel}</label>
                      <div style={{ position: 'relative', marginTop: '6px' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0.01"
                          max={pointsBalance}
                          value={requestAmountInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^\d*\.?\d{0,2}$/.test(val)) {
                              setRequestAmountInput(val);
                            }
                          }}
                          className="imin-input"
                          style={{ fontSize: '20px', fontWeight: 700, paddingLeft: '28px' }}
                          required
                        />
                      </div>

                      {/* 프리셋 버튼 */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        {pointsBalance >= 5 && (
                          <button 
                            type="button"
                            onClick={() => setRequestAmountInput('5.00')}
                            className="imin-chip"
                            style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            $5.00
                          </button>
                        )}
                        {pointsBalance >= 10 && (
                          <button 
                            type="button"
                            onClick={() => setRequestAmountInput('10.00')}
                            className="imin-chip"
                            style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            $10.00
                          </button>
                        )}
                        {pointsBalance >= 15 && (
                          <button 
                            type="button"
                            onClick={() => setRequestAmountInput('15.00')}
                            className="imin-chip"
                            style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            $15.00
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => setRequestAmountInput(pointsBalance.toFixed(2))}
                          className="imin-chip"
                          style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--primary-color)', color: 'var(--primary-color)', cursor: 'pointer' }}
                        >
                          {language === 'ko' ? '전액 사용' : 'Max Use'}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 전송 버튼 */}
                <button 
                  disabled={!requestAmountInput || parseFloat(requestAmountInput) <= 0 || parseFloat(requestAmountInput) > pointsBalance}
                  onClick={() => {
                    const parsed = parseFloat(requestAmountInput);
                    if (parsed > 0 && parsed <= pointsBalance) {
                      const reqId = requestPayment(
                        currentUser.id, 
                        selectedStoreId, 
                        parsed, 
                        paymentTarget === 'self' ? 'payment' : 'donation', 
                        paymentTarget === 'donation' ? selectedRequestNpoId : undefined
                      );
                      setCurrentRequestId(reqId);
                    }
                  }}
                  className="imin-btn imin-btn-primary"
                  style={{ marginTop: '10px' }}
                >
                  {t.requestBtn}
                </button>
              </>
            ) : currentRequest.status === 'pending' ? (
              /* 2단계: 승인 대기 상태 */
              <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={56} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                    .animate-spin {
                      animation: spin 1.5s linear infinite;
                    }
                  `}</style>
                </div>
                <div>
                  <h4 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-color)' }}>
                    {currentRequest.type === 'donation' 
                      ? (language === 'ko' ? '기부 승인 대기 중...' : 'Waiting for Donation Approval...')
                      : t.requestPendingTitle}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', lineHeight: 1.5 }}>
                    {currentRequest.type === 'donation'
                      ? (language === 'ko' 
                          ? `[${currentRequest.nonProfitName || ''}]으로의 기부 승인을 대기하고 있습니다. 카운터 직원의 승인을 기다려 주세요.` 
                          : `Waiting for store staff to approve the donation of $${currentRequest.amount.toFixed(2)} to [${currentRequest.nonProfitName || ''}].`)
                      : t.requestPendingDesc}
                  </p>
                </div>

                <div style={{ padding: '12px 24px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: '#F8F9FA' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>
                    {currentRequest.type === 'donation' 
                      ? (language === 'ko' ? '기부 신청 금액' : 'Donation Amount')
                      : (language === 'ko' ? '요청 금액' : 'Requested Amount')}
                  </span>
                  <strong style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-color)' }}>
                    ${currentRequest.amount.toFixed(2)}
                  </strong>
                </div>

                <button 
                  onClick={() => {
                    cancelPaymentRequest(currentRequest.id);
                    setCurrentRequestId(null);
                    setShowPaymentRequestModal(false);
                  }}
                  className="imin-btn imin-btn-outline"
                  style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)', maxWidth: '200px' }}
                >
                  {t.requestCancelBtn}
                </button>
              </div>
            ) : currentRequest.status === 'approved' ? (
              /* 3단계: 승인 완료 상태 */
              <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <div style={{ color: 'var(--accent-green)' }}>
                  <CheckCircle2 size={64} fill="rgba(52, 199, 89, 0.15)" strokeWidth={2.5} />
                </div>
                <div>
                  <h4 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-green)' }}>
                    {currentRequest.type === 'donation'
                      ? (language === 'ko' ? '기부 승인 완료!' : 'Donation Approved!')
                      : t.requestApprovedTitle}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', lineHeight: 1.5 }}>
                    {currentRequest.type === 'donation'
                      ? (language === 'ko'
                          ? `[${currentRequest.nonProfitName || ''}]으로의 기부 승인이 완료되었습니다. 따뜻한 후원에 감사드립니다.`
                          : `Donation to [${currentRequest.nonProfitName || ''}] has been approved. Thank you for your support.`)
                      : t.requestApprovedDesc(currentRequest.amount)}
                  </p>
                </div>

                <div style={{ padding: '16px 32px', borderRadius: 'var(--border-radius-lg)', backgroundColor: 'rgba(52, 199, 89, 0.08)', border: '1px solid rgba(52, 199, 89, 0.2)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {currentRequest.type === 'donation' 
                      ? (language === 'ko' ? '기부 완료' : 'DONATED')
                      : (language === 'ko' ? '차감 완료' : 'DEDUCTED')}
                  </span>
                  <strong style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent-green)' }}>
                    -${currentRequest.amount.toFixed(2)}
                  </strong>
                </div>
              </div>
            ) : (
              /* 4단계: 거절됨 상태 */
              <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <div style={{ color: 'var(--accent-red)' }}>
                  <XCircle size={64} fill="rgba(255, 69, 58, 0.15)" strokeWidth={2.5} />
                </div>
                <div>
                  <h4 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-red)' }}>
                    {currentRequest.type === 'donation'
                      ? (language === 'ko' ? '기부 요청 거절됨' : 'Donation Request Rejected')
                      : t.requestRejectedTitle}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', lineHeight: 1.5 }}>
                    {currentRequest.type === 'donation'
                      ? (language === 'ko'
                          ? `기부 요청이 거절되었습니다. 매장 직원에게 문의해 주세요.`
                          : `The charity donation request was rejected. Please contact store staff.`)
                      : t.requestRejectedDesc}
                  </p>
                </div>

                <button 
                  onClick={() => {
                    cancelPaymentRequest(currentRequest.id);
                    setCurrentRequestId(null);
                    setShowPaymentRequestModal(false);
                  }}
                  className="imin-btn imin-btn-secondary"
                  style={{ maxWidth: '200px' }}
                >
                  {language === 'ko' ? '닫기' : 'Close'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}



      {/* --- 스탬프 선물/기부하기 모달 --- */}
      {showGiftingPanel && (
        <div 
          className="bottom-sheet-overlay" 
          onClick={() => {
            setShowGiftingPanel(false);
            setGiftingSuccessMessage(null);
          }} 
          style={{ alignItems: 'flex-start', justifyContent: 'center', padding: '64px 16px 16px 16px', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div 
            className="bottom-sheet" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              borderRadius: 'var(--border-radius-lg)', 
              maxWidth: '330px', 
              animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', 
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)', 
              maxHeight: 'calc(100% - 80px)',
              padding: '24px'
            }}
          >
            {/* 헤더 */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-color)' }}>
                {language === 'ko' ? '적립/선물/기부하기' : 'Earn, Gift & Donate'}
              </h3>
              <button 
                onClick={() => {
                  setShowGiftingPanel(false);
                  setGiftingSuccessMessage(null);
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                {language === 'ko' ? '닫기' : 'Close'}
              </button>
            </div>

            {/* 현재 스탬프 현황 요약 카드 */}
            <div style={{
              width: '100%',
              padding: '12px',
              borderRadius: 'var(--border-radius-md)',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid rgba(95, 92, 230, 0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 700 }}>
                {language === 'ko' ? '보유 스탬프' : 'My Stamps'}
              </span>
              <strong style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary-color)' }}>
                ⭐ {currentStamps}개
              </strong>
            </div>

            {/* 탭 헤더 */}
            <div style={{ display: 'flex', width: '100%', backgroundColor: 'var(--background-color)', padding: '4px', borderRadius: 'var(--border-radius-pill)', border: '1px solid var(--border-color)', margin: '4px 0' }}>
              <button
                onClick={() => {
                  setGiftingActiveTab('earn');
                  setGiftingSuccessMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  borderRadius: 'var(--border-radius-pill)',
                  backgroundColor: giftingActiveTab === 'earn' ? '#ffffff' : 'transparent',
                  color: giftingActiveTab === 'earn' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: giftingActiveTab === 'earn' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {language === 'ko' ? '적립하기' : 'Redeem'}
              </button>
              <button
                onClick={() => {
                  setGiftingActiveTab('friend');
                  setGiftingSuccessMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  borderRadius: 'var(--border-radius-pill)',
                  backgroundColor: giftingActiveTab === 'friend' ? '#ffffff' : 'transparent',
                  color: giftingActiveTab === 'friend' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: giftingActiveTab === 'friend' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {language === 'ko' ? '선물하기' : 'Gift'}
              </button>
              <button
                onClick={() => {
                  setGiftingActiveTab('npo');
                  setGiftingSuccessMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  borderRadius: 'var(--border-radius-pill)',
                  backgroundColor: giftingActiveTab === 'npo' ? '#ffffff' : 'transparent',
                  color: giftingActiveTab === 'npo' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: giftingActiveTab === 'npo' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {language === 'ko' ? '기부하기' : 'Donate'}
              </button>
            </div>

            {/* 본문 폼 영역 */}
            <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {giftingActiveTab === 'earn' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center', width: '100%' }}>
                  {currentStamps === 7 ? (
                    <>
                      <div style={{ 
                        padding: '16px 14px', 
                        backgroundColor: 'rgba(52, 199, 89, 0.05)', 
                        borderRadius: '12px', 
                        border: '1.5px solid rgba(52, 199, 89, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '28px' }}>🎉</span>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1c1c1e' }}>
                          {language === 'ko' ? '스탬프 7개 적립 완성!' : '7 Stamps Completed!'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {language === 'ko' 
                            ? `스탬프 7개를 전환하여 스탬프 캐시 ${selectedStore.pointRewardPer7Stamps.toFixed(2)}를 적립받을 수 있습니다.`
                            : `Convert 7 stamps to get ${selectedStore.pointRewardPer7Stamps.toFixed(2)} stamp cash.`}
                        </p>
                      </div>

                      <button
                        onClick={handleConvertStampsToCash}
                        className="imin-btn"
                        style={{ 
                          padding: '12px', 
                          fontSize: '14px', 
                          marginTop: '8px', 
                          backgroundColor: 'var(--accent-green)', 
                          color: '#ffffff', 
                          border: 'none', 
                          borderRadius: 'var(--border-radius-md)', 
                          fontWeight: 700, 
                          cursor: 'pointer' 
                        }}
                      >
                        {language === 'ko' ? `적립하기 (${selectedStore.pointRewardPer7Stamps.toFixed(2)} 받기)` : `Redeem (Get ${selectedStore.pointRewardPer7Stamps.toFixed(2)})`}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ 
                        padding: '16px 14px', 
                        backgroundColor: 'var(--background-color)', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '24px' }}>💡</span>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#8e8e93' }}>
                          {language === 'ko' ? '스탬프 7개가 필요합니다' : '7 Stamps Required'}
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {language === 'ko' 
                            ? `스탬프 7개를 다 채우면 ${selectedStore.pointRewardPer7Stamps.toFixed(2)} 스탬프 캐시로 전환할 수 있습니다.`
                            : `Collect 7 stamps to convert them to ${selectedStore.pointRewardPer7Stamps.toFixed(2)} stamp cash.`}
                        </p>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-color)', marginTop: '4px' }}>
                          {language === 'ko' 
                            ? `현재 현황: ${currentStamps} / 7개 (${7 - currentStamps}개 부족)`
                            : `Current progress: ${currentStamps} / 7 (${7 - currentStamps} more needed)`}
                        </div>
                      </div>

                      <button
                        disabled
                        className="imin-btn"
                        style={{ 
                          padding: '12px', 
                          fontSize: '14px', 
                          marginTop: '8px', 
                          backgroundColor: '#e5e5ea', 
                          color: '#8e8e93', 
                          border: 'none', 
                          borderRadius: 'var(--border-radius-md)', 
                          fontWeight: 700, 
                          cursor: 'not-allowed' 
                        }}
                      >
                        {language === 'ko' ? '스탬프를 더 모아주세요' : 'Need More Stamps'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {giftingActiveTab === 'friend' ? (
                currentStamps === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '24px' }}>🎁</span>
                    <strong>{language === 'ko' ? '선물할 수 있는 스탬프가 없습니다' : 'No stamps available to gift'}</strong>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.4 }}>
                      {language === 'ko' ? '매장에서 먼저 스탬프를 적립해 주세요!' : 'Please earn stamps at a store first!'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, display: 'block' }}>
                        {language === 'ko' ? '선물 메시지' : 'Message'} <span style={{ color: 'var(--accent-red)', marginLeft: '2px' }}>*</span>
                      </label>
                      <textarea
                        value={giftingMessage}
                        onChange={(e) => setGiftingMessage(e.target.value)}
                        placeholder={language === 'ko' ? '메시지를 반드시 입력하세요 (필수)' : 'Enter message (required)'}
                        style={{ 
                          width: '100%', 
                          height: '75px', 
                          padding: '10px 12px', 
                          borderRadius: '8px', 
                          border: '2px solid var(--primary-color)', 
                          fontSize: '13px', 
                          boxSizing: 'border-box', 
                          outline: 'none',
                          resize: 'none',
                          backgroundColor: '#FAF9FF',
                          color: '#333333',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '보낼 스탬프 개수' : 'Stamps to Send'}
                      </label>
                      <select
                        value={giftingStampCount}
                        onChange={(e) => setGiftingStampCount(parseInt(e.target.value))}
                        style={{ width: '100%', padding: '10px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }}
                      >
                        {Array.from({ length: currentStamps }).map((_, i) => (
                          <option key={i} value={i + 1}>{i + 1} {language === 'ko' ? '개' : 'Stamps'}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
                        {language === 'ko' ? '받을 친구 선택' : 'Select Friend'}
                      </label>
                      
                      {giftingRecipientId ? (
                        /* 친구 선택 완료 상태 카드 */
                        (() => {
                          const selectedFriendObj = users.find(u => u.id === giftingRecipientId);
                          if (!selectedFriendObj) return null;
                          return (
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              padding: '10px 12px', 
                              backgroundColor: 'var(--primary-light)', 
                              border: '1.5px solid var(--primary-color)', 
                              borderRadius: '8px' 
                            }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-color)' }}>
                                👤 {selectedFriendObj.nickname}({selectedFriendObj.phoneNumber.replace(/\D/g, '').slice(-4)})
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setGiftingRecipientId('');
                                  setGiftingFriendQuery('');
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-red)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0
                                }}
                              >
                                {language === 'ko' ? '다시 검색' : 'Deselect'}
                              </button>
                            </div>
                          );
                        })()
                      ) : (
                        /* 친구 검색 입력창 및 실시간 피커 리스트 */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                          <input 
                            type="text"
                            value={giftingFriendQuery}
                            onChange={(e) => setGiftingFriendQuery(e.target.value)}
                            placeholder={language === 'ko' ? '친구 닉네임 또는 번호 검색 (한 글자 이상)' : 'Search friend nickname/number'}
                            className="imin-input"
                            style={{ 
                              padding: '8px 10px', 
                              fontSize: '13px', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border-color)',
                              outline: 'none',
                              boxSizing: 'border-box',
                              width: '100%',
                              backgroundColor: '#ffffff'
                            }}
                          />
                          
                          {/* 실시간 매칭 친구 리스트 */}
                          {giftingFriendQuery.trim().length > 0 && (() => {
                            const q = giftingFriendQuery.toLowerCase().trim();
                            const matches = users.filter(u => {
                              if (u.role !== 'customer' || u.id === currentUser?.id || u.status === 'deleted') return false;
                              
                              // [비즈니스 제약]: 현재 선택된 매장(selectedStoreId)에 스탬프를 1개 이상 가지고 있는 유저만 노출
                              const userCard = stampCards.find(c => c.userId === u.id && c.storeId === selectedStoreId);
                              if (!userCard || userCard.currentStamps <= 0) return false;

                              const nickMatch = u.nickname.toLowerCase().includes(q);
                              const nameMatch = u.name.toLowerCase().includes(q);
                              const phoneClean = u.phoneNumber.replace(/\D/g, '');
                              const phoneMatch = phoneClean.includes(q);
                              return nickMatch || nameMatch || phoneMatch;
                            });

                            if (matches.length === 0) {
                              return (
                                <div style={{ 
                                  padding: '8px 10px', 
                                  fontSize: '12px', 
                                  color: 'var(--text-secondary)',
                                  backgroundColor: '#F6F6FA',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)'
                                }}>
                                  {language === 'ko' ? '검색 결과가 없습니다.' : 'No results found.'}
                                </div>
                              );
                            }

                            return (
                              <div style={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                backgroundColor: '#ffffff',
                                padding: '4px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                zIndex: 10
                              }}>
                                {matches.map(u => (
                                  <div
                                    key={u.id}
                                    onClick={() => {
                                      setGiftingRecipientId(u.id);
                                    }}
                                    style={{
                                      padding: '8px 10px',
                                      fontSize: '13px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      backgroundColor: '#F6F6FA',
                                      transition: 'background-color 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-light)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F6F6FA'; }}
                                  >
                                    👤 {u.nickname}({u.phoneNumber.replace(/\D/g, '').slice(-4)})
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSendGiftToFriend}
                      className="imin-btn imin-btn-primary"
                      style={{ padding: '12px', fontSize: '14px', marginTop: '8px', cursor: 'pointer' }}
                    >
                      {language === 'ko' ? '선물 발송 (친구 승인 대기)' : 'Send Gift (Wait Approval)'}
                    </button>
                  </>
                )
              ) : (
                currentStamps === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '24px' }}>🤝</span>
                    <strong>{language === 'ko' ? '기부할 수 있는 스탬프가 없습니다' : 'No stamps available to donate'}</strong>
                    <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.4 }}>
                      {language === 'ko' ? '매장에서 먼저 스탬프를 적립해 주세요!' : 'Please earn stamps at a store first!'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '기부할 스탬프 개수' : 'Stamps to Donate'}
                      </label>
                      <select
                        value={giftingStampCount}
                        onChange={(e) => setGiftingStampCount(parseInt(e.target.value))}
                        style={{ width: '100%', padding: '10px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }}
                      >
                        {Array.from({ length: currentStamps }).map((_, i) => (
                          <option key={i} value={i + 1}>{i + 1} {language === 'ko' ? '개' : 'Stamps'}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '기부할 단체 선택' : 'Select NPO'}
                      </label>
                      <select
                        value={giftingNpoId}
                        onChange={(e) => setGiftingNpoId(e.target.value)}
                        style={{ width: '100%', padding: '10px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }}
                      >
                        {nonProfits.filter(n => n.status === 'active').map(n => (
                          <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleSendGiftToNpo}
                      className="imin-btn"
                      style={{ padding: '12px', fontSize: '14px', marginTop: '8px', backgroundColor: 'var(--accent-purple)', color: '#ffffff', border: 'none', borderRadius: 'var(--border-radius-md)', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {language === 'ko' ? '기부 단체로 보내기' : 'Send to NPO'}
                    </button>
                  </>
                )
              )}
            </div>

            {giftingSuccessMessage && (
              <div style={{ 
                fontSize: '13px', 
                color: 'var(--accent-green)', 
                fontWeight: 700, 
                textAlign: 'center', 
                marginTop: '8px', 
                padding: '10px', 
                backgroundColor: 'rgba(52, 199, 89, 0.08)', 
                borderRadius: '6px', 
                border: '1px solid rgba(52, 199, 89, 0.15)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {giftingSuccessMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PWA 바로가기 추가 안내 모달 */}
      {showPwaGuideModal && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '64px 20px 20px 20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--border-radius-lg)',
            width: '100%',
            maxWidth: '320px',
            padding: '24px 20px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            animation: 'fadeIn 0.2s ease-out',
            maxHeight: 'calc(100% - 80px)',
            overflowY: 'auto'
          }}>
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#1c1c1e', margin: 0 }}>
                {language === 'ko' ? '홈 화면에 바로가기 추가' : 'Add to Home Screen'}
              </h4>
              <p style={{ fontSize: '12.5px', color: '#636366', marginTop: '6px', lineHeight: 1.4 }}>
                {language === 'ko' 
                  ? '앱 설치 없이 바탕화면에 바로가기 아이콘을 생성하여 언제든 대시보드를 바로 확인하세요.' 
                  : 'Add a shortcut icon to your home screen to check your stamps without opening a browser.'}
              </p>
            </div>

            <div style={{ borderTop: '1px solid #e5e5ea', borderBottom: '1px solid #e5e5ea', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
              <div>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  backgroundColor: 'rgba(95, 92, 230, 0.1)', 
                  color: 'var(--primary-color)', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginBottom: '6px'
                }}>
                  iPhone (Safari)
                </span>
                <div style={{ fontSize: '12px', color: '#3a3a3c', lineHeight: 1.5 }}>
                  1. 브라우저 하단 <strong>공유 버튼(사각형 화살표)</strong> 클릭<br/>
                  2. 메뉴를 올려 <strong>'홈 화면에 추가'</strong> 클릭
                </div>
              </div>

              <div>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  backgroundColor: 'rgba(52, 199, 89, 0.1)', 
                  color: 'var(--accent-green)', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginBottom: '6px'
                }}>
                  Android (Chrome / 삼성 인터넷)
                </span>
                <div style={{ fontSize: '12px', color: '#3a3a3c', lineHeight: 1.5 }}>
                  1. 우측 상단 <strong>메뉴 버튼(세로 점 3개 ⋮)</strong> 클릭<br/>
                  2. <strong>'홈 화면에 추가'</strong> 또는 <strong>'앱 설치'</strong> 클릭
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowPwaGuideModal(false)}
              className="imin-btn imin-btn-primary"
              style={{ padding: '12px', cursor: 'pointer' }}
            >
              {language === 'ko' ? '확인' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* PWA 하단 탭 내비게이션 바 (imin 테마 구조) */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '64px', backgroundColor: '#ffffff', borderTop: '1px solid var(--border-color)', display: 'flex', zIndex: 100, boxShadow: '0 -2px 10px rgba(0,0,0,0.03)' }}>
        <button 
          onClick={() => setPwaTab('home')}
          style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: pwaTab === 'home' ? 'var(--primary-color)' : 'var(--text-secondary)', gap: '4px', cursor: 'pointer' }}
        >
          <QrCode size={20} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>{t.tabHome}</span>
        </button>
        
        <button 
          onClick={() => setPwaTab('impact')}
          style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: pwaTab === 'impact' ? 'var(--primary-color)' : 'var(--text-secondary)', gap: '4px', cursor: 'pointer' }}
        >
          <Globe size={20} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>{t.tabImpact}</span>
        </button>
      </div>
 
      {/* 내 어카운트 정보 모달 */}
      {showAccountModal && (() => {
        // 1. 총 보유 캐시 금액 계산
        const totalCash = storePoints
          .filter(p => p.userId === currentUser.id)
          .reduce((sum, p) => sum + p.pointsBalance, 0);
 


        // 3. 기부한 내역 및 총액 계산
        const myDonations = donations
          .filter(d => d.donorId === currentUser.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const totalMyDonatedValue = myDonations.reduce((sum, d) => sum + d.monetaryValue, 0);

        return (
          <div 
            className="bottom-sheet-overlay" 
            onClick={() => {
              setShowAccountModal(false);
              setShowDirectDonateForm(false);
              setDirectDonateResult(null);
            }} 
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'flex-start', 
              padding: '0px 16px 16px 16px', 
              backgroundColor: '#ffffff', // 배경을 그냥 하얀색으로 변경
              zIndex: 1000,
              boxSizing: 'border-box'
            }}
          >
            <div 
              className="bottom-sheet-content" 
              onClick={(e) => e.stopPropagation()} 
              style={{ 
                width: '100%', 
                maxWidth: '380px', 
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                padding: '8px 24px 24px 24px',
                backgroundColor: '#ffffff',
                boxShadow: 'none',
                border: 'none',
                boxSizing: 'border-box',
                margin: '0 auto'
              }}
            >
 
              {/* 모달 헤더 */}
              <div style={{ textAlign: 'center', marginTop: '0px' }}>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--primary-color)' }}>
                  {language === 'ko' ? '👤 내 어카운트 정보' : '👤 My Account Info'}
                </h3>
              </div>
 
              {/* 총 스탬프 캐시 정보 카드 */}
              <div style={{ 
                backgroundColor: 'var(--primary-light)', 
                padding: '16px', 
                borderRadius: 'var(--border-radius-md)', 
                textAlign: 'center',
                border: '1px solid rgba(95, 92, 230, 0.2)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  {language === 'ko' ? '총 보유 스탬프 캐시' : 'Total Stamp Cash'}
                </span>
                <strong style={{ fontSize: '32px', fontWeight: 900, color: '#FF073A' }}>
                  ${totalCash.toFixed(2)}
                </strong>
 
                {/* 총 보유 스탬프 캐시 아래, 즉시 기부하기 버튼 */}
                <button 
                  onClick={() => {
                    setDirectDonateResult(null);
                    setShowDirectDonateForm(!showDirectDonateForm);
                  }}
                  className="imin-btn imin-btn-primary"
                  style={{ 
                    backgroundColor: 'var(--accent-purple)', 
                    marginTop: '12px', 
                    display: 'block', 
                    width: '100%',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    position: 'relative'
                  }}
                  disabled={totalCash <= 0}
                >
                  {language === 'ko' ? '기부하기' : 'Donate'}
                  <span style={{ 
                    position: 'absolute', 
                    right: '16px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}>
                    {showDirectDonateForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>
 
                {/* 즉시 기부 간이 폼 */}
                {showDirectDonateForm && (
                  <div style={{
                    padding: '14px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1.5px solid var(--accent-purple)',
                    backgroundColor: '#ffffff',
                    marginTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    textAlign: 'left'
                  }}>
                    {/* NPO 선택 */}
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '기부 단체 선택' : 'Select Charity NPO'}
                      </label>
                      <select 
                        value={directDonateNpo}
                        onChange={(e) => setDirectDonateNpo(e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '6px 8px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-color)', 
                          outline: 'none', 
                          fontSize: '12.5px', 
                          fontWeight: 600,
                          backgroundColor: '#ffffff'
                        }}
                      >
                        {nonProfits.filter(n => n.status === 'active').map(n => (
                          <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                      </select>
                    </div>
 
                    {/* 기부 금액 */}
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '기부할 스탬프 캐시 금액 ($)' : 'Donation Cash Amount ($)'}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={totalCash}
                          value={directDonateAmount}
                          onChange={(e) => setDirectDonateAmount(e.target.value)}
                          className="imin-input"
                          style={{ flex: 1, padding: '6px 8px', fontSize: '13px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setDirectDonateAmount(totalCash.toFixed(2))}
                          style={{
                            background: 'none',
                            border: '1px solid var(--accent-purple)',
                            color: 'var(--accent-purple)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {language === 'ko' ? '전액' : 'Max'}
                        </button>
                      </div>
                    </div>
 
                    {/* 기부 처리 결과 및 전송 버튼 */}
                    {directDonateResult ? (
                      <div style={{ color: 'var(--accent-green)', fontSize: '12px', fontWeight: 700, textAlign: 'center', backgroundColor: '#eafaf1', padding: '8px', borderRadius: '6px' }}>
                        🎉 ${directDonateResult.toFixed(2)} {language === 'ko' ? '기부가 즉시 완료되었습니다!' : 'donated successfully!'}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const amt = parseFloat(directDonateAmount);
                            if (isNaN(amt) || amt <= 0 || amt > totalCash) {
                              alert(language === 'ko' ? '기부할 금액을 올바르게 입력해주세요.' : 'Invalid donation amount.');
                              return;
                            }
                            const donated = donatePointsDirect(currentUser.id, directDonateNpo, amt);
                            setDirectDonateResult(donated);
                            setDirectDonateAmount('5.00');
                          } catch (err: any) {
                            alert(err.message || '기부 오류');
                          }
                        }}
                        className="imin-btn"
                        style={{
                          width: '100%',
                          padding: '8px',
                          backgroundColor: 'var(--accent-purple)',
                          color: '#ffffff',
                          borderRadius: '6px',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer'
                        }}
                        disabled={totalCash <= 0 || !directDonateAmount || parseFloat(directDonateAmount) <= 0 || parseFloat(directDonateAmount) > totalCash}
                      >
                        🤝 {language === 'ko' ? '즉시 기부 전송' : 'Send Donation Now'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 받은 스탬프 선물 대기 내역은 메인 화면의 팝업창으로 이동하였습니다. */}

              {/* 지금까지 기부한 내역 및 총액 */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {language === 'ko' ? '❤️ 나의 기부 내역' : '❤️ My Donations'}
                  </h4>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-purple)' }}>
                    {language === 'ko' ? '기부 총액: ' : 'Total: ' }
                    <span style={{ fontSize: '14px', fontWeight: 900 }}>${totalMyDonatedValue.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '130px', overflowY: 'auto', paddingRight: '4px' }}>
                  {myDonations.length > 0 ? (
                    myDonations.map(donation => {
                      const npo = nonProfits.find(n => n.id === donation.nonProfitId);
                      const npoName = npo ? npo.name : donation.nonProfitId;
                      const dateObj = new Date(donation.createdAt);
                      const dateStr = dateObj.toLocaleDateString();
                      
                      return (
                        <div 
                          key={donation.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            backgroundColor: 'rgba(191, 90, 242, 0.04)',
                            borderRadius: '6px',
                            border: '1px solid rgba(191, 90, 242, 0.1)'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                              {npoName}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {dateStr}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--accent-purple)', display: 'block' }}>
                              ${donation.monetaryValue.toFixed(2)}
                            </strong>
                            {donation.stampCount > 0 && (
                              <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                                ({donation.stampCount} {language === 'ko' ? '스탬프' : 'Stamps'})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', backgroundColor: 'var(--background-color)', borderRadius: '8px' }}>
                      {language === 'ko' ? '아직 기부한 내역이 없습니다.' : 'No donations made yet.'}
                    </div>
                  )}
                </div>
              </div>



 
            </div>
          </div>
        );
      })()}
      {/* 받은 스탬프 선물 대기 팝업 창 */}
      {currentUser && pendingGifts.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '80px 20px 20px 20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 'var(--border-radius-lg)',
            width: '100%',
            maxWidth: '340px',
            padding: '24px 20px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'scaleUp 0.2s ease-out',
            maxHeight: '85%',
            overflowY: 'auto',
            boxSizing: 'border-box'
          }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gift size={18} />
              {language === 'ko' ? '🎁 도착한 스탬프 선물!' : '🎁 Stamp Gift Arrived!'}
              <span style={{
                backgroundColor: 'var(--accent-red)',
                color: '#ffffff',
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {pendingGifts.length}
              </span>
            </h4>

            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {language === 'ko' 
                ? '친구나 사장님이 보낸 스탬프 선물이 있습니다. 수락하여 카드를 채워보세요!'
                : 'You have stamp gifts waiting. Accept them to fill your stamp card!'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {pendingGifts.map(gift => {
                const senderUser = users.find(u => u.id === gift.senderId);
                const giftStore = stores.find(s => s.id === gift.storeId);
                const storeName = giftStore ? giftStore.name : gift.storeId;
                let senderName = senderUser ? senderUser.nickname : (language === 'ko' ? '친구' : 'Friend');
                
                const isOwnerGift = senderUser && senderUser.role === 'owner';
                if (isOwnerGift) {
                  senderName = language === 'ko' ? `${storeName} 사장님` : `${storeName} Owner`;
                }

                const thanksInput = giftThanksMessages[gift.id] || '';

                return (
                  <div
                    key={gift.id}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(95, 92, 230, 0.04)',
                      border: '1px solid rgba(95, 92, 230, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {senderName} ➡️ {language === 'ko' ? '나' : 'Me'}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                          {storeName} | <strong style={{ color: 'var(--primary-color)' }}>{gift.stampsTransferred} {language === 'ko' ? '개 스탬프' : 'Stamps'}</strong>
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {new Date(gift.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {gift.message && (
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#ffffff',
                        borderLeft: '3px solid var(--primary-color)',
                        fontSize: '12px',
                        color: '#48484a',
                        fontStyle: 'italic'
                      }}>
                        "{gift.message}"
                      </div>
                    )}

                    {/* 감사 멘트 입력창 */}
                    <div>
                      <input
                        type="text"
                        value={thanksInput}
                        onChange={(e) => setGiftThanksMessages({
                          ...giftThanksMessages,
                          [gift.id]: e.target.value
                        })}
                        placeholder={isOwnerGift 
                          ? (language === 'ko' ? '사장님께 보낼 감사 멘트 (생략 가능)...' : 'Write a thank you note (optional)...')
                          : (language === 'ko' ? '친구에게 보낼 감사 멘트 입력...' : 'Write a thank you note...')}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* 승인 / 거절 액션 버튼 */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <button
                        onClick={async () => {
                          if (!isOwnerGift && !thanksInput.trim()) {
                            alert(language === 'ko' ? '친구에게 보낼 감사 멘트를 입력해주세요!' : 'Please write a thank you note!');
                            return;
                          }
                          const finalThanks = isOwnerGift && !thanksInput.trim() ? (language === 'ko' ? '감사합니다!' : 'Thank you!') : thanksInput;
                          const res = acceptGift(gift.id, finalThanks);
                          if (res.success) {
                            setGiftThanksMessages({
                              ...giftThanksMessages,
                              [gift.id]: ''
                            });
                          }
                        }}
                        className="imin-btn imin-btn-primary"
                        style={{ flex: 2, padding: '8px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ✅ {language === 'ko' ? '수락 및 적립' : 'Accept & Earn'}
                      </button>
                      <button
                        onClick={() => declineGift(gift.id)}
                        className="imin-btn"
                        style={{
                          flex: 1,
                          padding: '8px',
                          fontSize: '11.5px',
                          backgroundColor: '#E5E5EA',
                          color: '#FF3B30',
                          border: 'none',
                          borderRadius: 'var(--border-radius-md)',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ❌ {language === 'ko' ? '거절' : 'Decline'}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 타임라인 상세 팝업 모달 */}
      {isTimelineModalOpen && (
          <div 
            className="bottom-sheet-overlay" 
            onClick={() => setIsTimelineModalOpen(false)} 
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'flex-start', 
              padding: '0px 16px 24px 16px', 
              backgroundColor: '#ffffff', 
              zIndex: 1050,
              boxSizing: 'border-box',
              overflowY: 'auto'
            }}
          >
            <div 
              className="bottom-sheet-content" 
              onClick={(e) => e.stopPropagation()} 
              style={{ 
                width: '100%', 
                maxWidth: '380px', 
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '16px 16px 24px 16px',
                backgroundColor: '#ffffff',
                boxShadow: 'none',
                border: 'none',
                boxSizing: 'border-box',
                margin: '0 auto',
                position: 'relative'
              }}
            >
              {/* 우상단 닫기 X 버튼이 있는 모달 헤더 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                borderBottom: '1px solid #E5E5EA',
                paddingBottom: '12px',
                marginBottom: '4px'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  💬 {language === 'ko' ? '스탬프 나눔 타임라인' : 'Stamp Sharing Timeline'}
                </h3>
                <button 
                  onClick={() => setIsTimelineModalOpen(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#F2F2F7',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#8E8E93',
                    transition: 'all 0.15s ease',
                    margin: 0,
                    padding: 0
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E5E5EA'; e.currentTarget.style.color = '#3A3A3C'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F2F2F7'; e.currentTarget.style.color = '#8E8E93'; }}
                >
                  ✕
                </button>
              </div>

              {/* 스탬프 나눔 타임라인 리스트 전체 노출 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {(() => {
                  const timelineGifts = isUnassignedStoreView ? [] : [...gifts]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                  if (timelineGifts.length === 0) {
                    return (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', backgroundColor: 'var(--background-color)', borderRadius: '8px' }}>
                        {language === 'ko' ? '아직 주고받은 스탬프 나눔 메시지가 없습니다.' : 'No stamp messages yet.'}
                      </div>
                    );
                  }

                  return timelineGifts.map(gift => {
                    const senderUser = users.find(u => u.id === gift.senderId);
                    const recipientUser = users.find(u => u.id === gift.recipientId);
                    const giftStore = stores.find(s => s.id === gift.storeId);
                    const storeName = giftStore ? giftStore.name : gift.storeId;
                    
                    const isSenderOwner = senderUser?.role === 'owner';
                    const isRecipientOwner = recipientUser?.role === 'owner';

                    // Sender details
                    let senderName = '';
                    let senderHandle = '';
                    if (isSenderOwner) {
                      senderName = language === 'ko' ? `${storeName} 사장님` : `${storeName} Owner`;
                      senderHandle = '@owner';
                    } else {
                      senderName = senderUser ? (gift.senderId === currentUser.id ? (language === 'ko' ? '나' : 'Me') : senderUser.name.replace('회원_', '')) : (language === 'ko' ? '알수없음' : 'Unknown');
                      senderHandle = senderUser ? `@${senderUser.nickname}` : '';
                    }
                    const senderInitials = senderName ? senderName.trim().charAt(0) : '?';

                    // Recipient details
                    let recipientName = '';
                    let recipientHandle = '';
                    if (isRecipientOwner) {
                      recipientName = language === 'ko' ? `${storeName} 사장님` : `${storeName} Owner`;
                      recipientHandle = '@owner';
                    } else {
                      recipientName = recipientUser ? (gift.recipientId === currentUser.id ? (language === 'ko' ? '나' : 'Me') : recipientUser.name.replace('회원_', '')) : (language === 'ko' ? '알수없음' : 'Unknown');
                      recipientHandle = recipientUser ? `@${recipientUser.nickname}` : '';
                    }
                    const recipientInitials = recipientName ? recipientName.trim().charAt(0) : '?';

                    const dateStr = new Date(gift.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const isReceived = gift.recipientId === currentUser.id;

                    return (
                      <div 
                        key={gift.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          borderBottom: '1px solid rgba(0,0,0,0.06)',
                          paddingBottom: '16px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          {/* 프로필 이미지 & 스레드 연결선 */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              backgroundColor: isSenderOwner ? '#5856D6' : (gift.senderId === currentUser.id ? 'var(--primary-color)' : '#30B0C7'),
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 800,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              flexShrink: 0
                            }}>
                              {senderInitials}
                            </div>
                            {gift.status === 'accepted' && (
                              <div style={{
                                width: '2px',
                                backgroundColor: '#E5E5EA',
                                position: 'absolute',
                                top: '38px',
                                bottom: '-28px',
                                zIndex: 1
                              }} />
                            )}
                          </div>

                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 800 }}>{senderName}</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{senderHandle}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>·</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{dateStr}</span>
                              </div>
                              
                              {gift.stampsTransferred === 0 ? (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  backgroundColor: (gift.message.includes('기부') || gift.message.toLowerCase().includes('donation') || gift.message.includes('후원'))
                                    ? 'rgba(52, 199, 89, 0.08)'
                                    : 'rgba(0, 122, 255, 0.08)',
                                  color: (gift.message.includes('기부') || gift.message.toLowerCase().includes('donation') || gift.message.includes('후원'))
                                    ? '#34C759'
                                    : '#007AFF'
                                }}>
                                  {(gift.message.includes('기부') || gift.message.toLowerCase().includes('donation') || gift.message.includes('후원'))
                                    ? (language === 'ko' ? '🤝 기부 승인' : '🤝 Donation Approved')
                                    : (language === 'ko' ? '💳 캐시 승인' : '💳 Cash Approved')}
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  backgroundColor: isReceived ? 'rgba(52, 199, 89, 0.08)' : 'rgba(255, 59, 48, 0.08)',
                                  color: isReceived ? '#34C759' : '#FF3B30'
                                }}>
                                  {isReceived ? '+' : '-'}{gift.stampsTransferred} {language === 'ko' ? '스탬프' : 'Stamps'}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                              🏪 {storeName}
                            </div>

                            <div style={{ fontSize: '14.5px', color: 'var(--text-primary)', marginTop: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontWeight: 700 }}>
                              {gift.message}
                            </div>

                            {gift.status === 'pending' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10.5px', color: '#FF9500', fontWeight: 700, marginTop: '6px', backgroundColor: 'rgba(255, 149, 0, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                ⏳ {language === 'ko' ? '수락 대기 중' : 'Pending'}
                              </span>
                            )}
                            {gift.status === 'declined' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10.5px', color: '#FF3B30', fontWeight: 700, marginTop: '6px', backgroundColor: 'rgba(255, 59, 48, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                ❌ {language === 'ko' ? '거절됨' : 'Declined'}
                              </span>
                            )}
                          </div>
                        </div>

                        {gift.status === 'accepted' && (
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '2px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', width: '38px', zIndex: 2 }}>
                              <div style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                backgroundColor: isRecipientOwner ? '#5856D6' : (gift.recipientId === currentUser.id ? 'var(--primary-color)' : '#30B0C7'),
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 800,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                flexShrink: 0
                              }}>
                                {recipientInitials}
                              </div>
                            </div>

                            <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.015)', padding: '8px 10px', borderRadius: '8px', borderLeft: '2.5px solid #E5E5EA', textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 800 }}>{recipientName}</strong>
                                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{recipientHandle}</span>
                                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{language === 'ko' ? '의 답장' : ' replied'}</span>
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#48484a', marginTop: '2px', fontStyle: 'italic', fontWeight: 700 }}>
                                "${gift.thanksMessage || (language === 'ko' ? '스탬프 선물을 수락했습니다.' : 'Accepted stamp gift.')}"
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
              )}
      </div>

      {showSharbeeReview && (
        <div
          onClick={() => {
            setShowSharbeeReview(false);
            setIsTimelineModalOpen(false);
          }}
          style={{ position: 'absolute', inset: 0, zIndex: 9998, backgroundColor: 'rgba(0,0,0,0.62)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', height: '100%', backgroundColor: '#1C1C1E', color: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '34px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={SHARBEE_HELPER_IMAGE} alt="Sharbee" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#FFB800' }}>{language === 'ko' ? '\uC0E4\uBE44 \uB9AC\uBDF0 \uB3C4\uC6B0\uBBF8' : 'Sharbee Review Helper'}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.62)' }}>{selectedStore.name}</div>
                </div>
              </div>
              <button type="button" onClick={() => { setShowSharbeeReview(false); setIsTimelineModalOpen(false); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 0, backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', cursor: 'pointer', fontWeight: 900 }}>x</button>
            </div>

            {sharbeeStep === 'chat' && (
              <>
                <div 
                  ref={chatLogsContainerRef}
                  style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}
                >
                  {sharbeeLogs.map((log, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: log.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '82%', padding: '10px 12px', borderRadius: '15px', backgroundColor: log.sender === 'user' ? 'var(--primary-color)' : 'rgba(255,255,255,0.09)', color: '#FFFFFF', fontSize: '13px', lineHeight: 1.45, whiteSpace: 'pre-line', textAlign: 'left' }}>{log.text}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sharbeeOptions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', justifyContent: 'center' }}>
                      {sharbeeOptions.map((option, index) => (
                        <button key={index} type="button" onClick={() => submitSharbeeAnswer(option)} style={{ padding: '8px 11px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.07)', color: '#FFFFFF', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>{option}</button>
                      ))}
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); submitSharbeeAnswer(sharbeeInput); }} style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      value={sharbeeInput} 
                      onChange={e => setSharbeeInput(e.target.value)} 
                      placeholder={
                        sharbeeLogs.filter(log => log.sender === 'user').length === 0
                          ? (language === 'ko' ? '드신 메뉴명을 직접 입력해주세요 (예: 김치스파게티)' : 'Type the menu you had (e.g. Pizza)')
                          : (language === 'ko' ? '추가로 넣고 싶은 말을 적어주세요' : 'Add anything else')
                      } 
                      style={{ flex: 1, minWidth: 0, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.22)', color: '#FFFFFF', padding: '9px 10px', fontSize: '13px' }} 
                    />
                    <button type="submit" style={{ width: '38px', borderRadius: '8px', border: 0, backgroundColor: 'var(--primary-color)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Send size={15} /></button>
                  </form>
                  {sharbeeLogs.filter(log => log.sender === 'user').length >= 4 && (
                    <button type="button" onClick={finishSharbeeReview} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: 0, backgroundColor: '#FFB800', color: '#1C1C1E', fontWeight: 900, fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Sparkles size={14} />{language === 'ko' ? '\uB9AC\uBDF0 \uCD08\uC548 \uB9CC\uB4E4\uAE30' : 'Make Review Draft'}</button>
                  )}
                </div>
              </>
            )}

            {sharbeeStep === 'draft' && (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                <div style={{ color: '#FFB800', fontSize: '12px', fontWeight: 900 }}>{language === 'ko' ? '\uC0E4\uBE44\uAC00 \uC815\uB9AC\uD55C \uB9AC\uBDF0 \uCD08\uC548' : 'Sharbee Review Draft'}</div>
                <textarea value={sharbeeDraft} onChange={e => setSharbeeDraft(e.target.value)} style={{ width: '100%', height: '240px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.18)', backgroundColor: 'rgba(0,0,0,0.24)', color: '#FFFFFF', padding: '10px', boxSizing: 'border-box', fontSize: '13px', lineHeight: 1.45, resize: 'vertical' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', borderRadius: '9px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {sharbeeVideoUrl ? (
                      <video src={sharbeeVideoUrl} muted playsInline controls style={{ width: '74px', height: '58px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0 }} />
                    ) : sharbeePhotoUrl ? (
                      <img src={sharbeePhotoUrl} alt="review preview" style={{ width: '58px', height: '58px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '58px', height: '58px', borderRadius: '8px', backgroundColor: 'rgba(255,184,0,0.12)', color: '#FFB800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Camera size={24} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 900, marginBottom: '3px' }}>
                        {language === 'ko' ? '\uC0AC\uC9C4 \uB610\uB294 15\uCD08 \uC774\uB0B4 \uB3D9\uC601\uC0C1' : 'Photo or video under 15 sec'}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '11px', lineHeight: 1.35 }}>
                        {sharbeeVideoUrl
                          ? sharbeeVideoName
                          : (language === 'ko' ? '\uD734\uB300\uD3F0\uC73C\uB85C \uCD2C\uC601\uD558\uAC70\uB098 \uC568\uBC94\uC5D0\uC11C \uC120\uD0DD\uD574 \uBBF8\uB2C8\uD648\uD53C \uB9AC\uBDF0\uC5D0 \uC62C\uB9B4 \uC218 \uC788\uC5B4\uC694.' : 'Take one now or choose from your phone album.')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px' }}>
                    <label style={{ padding: '9px 10px', borderRadius: '8px', backgroundColor: '#FFB800', color: '#1C1C1E', fontSize: '11.5px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <Camera size={14} />
                      {language === 'ko' ? '\uC0AC\uC9C4 \uCC0D\uAE30' : 'Take Photo'}
                      <input type="file" accept="image/*" capture="environment" onChange={handleSharbeePhotoChange} style={{ display: 'none' }} />
                    </label>
                    <label style={{ padding: '9px 10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.12)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.16)', fontSize: '11.5px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <Video size={14} />
                      {language === 'ko' ? '\uB3D9\uC601\uC0C1 \uCC0D\uAE30' : 'Record Video'}
                      <input type="file" accept="video/*" capture="environment" onChange={handleSharbeeVideoChange} style={{ display: 'none' }} />
                    </label>
                    <label style={{ padding: '9px 8px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.16)', fontSize: '11.5px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                      <ImageIcon size={14} />
                      {language === 'ko' ? '\uC568\uBC94\uC5D0\uC11C \uCD94\uAC00' : 'From Album'}
                      <input type="file" accept="image/*,video/*" onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.type.startsWith('video/')) {
                          handleSharbeeVideoChange(event);
                        } else {
                          handleSharbeePhotoChange(event);
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {sharbeeMediaError && (
                    <div style={{ color: '#FCA5A5', fontSize: '11px', fontWeight: 800, lineHeight: 1.35 }}>
                      {sharbeeMediaError}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px', borderRadius: '9px', backgroundColor: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.22)', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, marginBottom: '8px' }}>{language === 'ko' ? '\uB9AC\uBDF0\uB97C \uC62C\uB9AC\uAE30 \uC804\uC5D0 \uBCC4\uC810\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694' : 'Tap a star rating before posting'}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map(rating => (
                      <button 
                        key={rating} 
                        type="button" 
                        onClick={() => setSharbeeRating(rating)} 
                        style={{ 
                          width: '34px', 
                          height: '34px', 
                          borderRadius: '50%', 
                          border: sharbeeRating === rating ? '1px solid #FFB800' : '1px solid rgba(255,255,255,0.16)', 
                          backgroundColor: sharbeeRating >= rating ? 'rgba(255,184,0,0.18)' : 'rgba(255,255,255,0.06)', 
                          color: sharbeeRating >= rating ? '#FFB800' : 'rgba(255,255,255,0.5)', 
                          fontSize: sharbeeRating >= rating ? '20px' : '14px', 
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        {sharbeeRating >= rating ? '★' : rating}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={submitSharbeeReview} disabled={!sharbeeRating || sharbeeSubmitting} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 0, backgroundColor: sharbeeRating ? '#FFB800' : 'rgba(255,255,255,0.18)', color: sharbeeRating ? '#1C1C1E' : 'rgba(255,255,255,0.55)', fontWeight: 900, cursor: sharbeeRating ? 'pointer' : 'not-allowed' }}>{sharbeeSubmitting ? (language === 'ko' ? '\uB4F1\uB85D \uC911...' : 'Posting...') : (language === 'ko' ? '\uB4F1\uB85D\uD558\uACE0 \uC2A4\uD0EC\uD504 \uBC1B\uAE30' : 'Post & Earn Stamp')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
