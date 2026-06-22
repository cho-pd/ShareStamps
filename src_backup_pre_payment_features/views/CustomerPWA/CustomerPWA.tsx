import React, { useState, useEffect } from 'react';

const formatInterval = (minutes: number) => {
  const minsNum = typeof minutes === 'number' && !isNaN(minutes) ? minutes : 60;
  if (minsNum < 60) return `${minsNum}분`;
  const hours = Math.floor(minsNum / 60);
  const mins = minsNum % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};

const formatUSPhoneNumber = (value: string) => {
  const cleaned = value.replace(/\D/g, '').slice(0, 10);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};
import { useDatabase } from '../../context/DatabaseContext';
import type { User } from '../../context/DatabaseContext';
import { playVoiceGuidance } from '../../utils/voice';
import { 
  QrCode, Gift, Heart, User as UserIcon, LogOut, CheckCircle2, 
  History, Globe, Star, Loader2, XCircle, Smartphone,
  ChevronDown, ChevronUp
} from 'lucide-react';


export const CustomerPWA: React.FC = () => {
  const { 
    currentUser, currentDeviceToken, loginByPhoneNumber, logout, registerUser, 
    stores, stampCards, storePoints, nonProfits, donations,
    searchFriend, giftStamps, donateStamps, donatePointsDirect, claimQRStamps, receiptScans,
    language, setLanguage,
    paymentRequests, requestPayment, cancelPaymentRequest,
    adBanners, stampTransactions,
    users, gifts, acceptGift, declineGift, convertStampsToCash
  } = useDatabase();


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
    title: language === 'ko' ? 'ShareStamp' : 'ShareStamp',
    subtitle: language === 'ko' ? '앱 설치 없는 PWA 로컬 나눔 멤버십' : 'No-install PWA local sharing loyalty platform',
    phoneLogin: language === 'ko' ? '휴대폰 번호 로그인' : 'Phone Number Login',
    phonePlaceholder: language === 'ko' ? '휴대폰 번호 입력 (예: 123-456-7890)' : 'Enter phone number (e.g., 123-456-7890)',
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
    smsSimContent: language === 'ko' ? '[ShareStamp] 본인확인 인증번호는' : '[ShareStamp] Your verification code is',
    
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

    // Home
    welcome: language === 'ko' ? '반갑습니다!' : 'Welcome!',
    logoutBtn: language === 'ko' ? '로그아웃' : 'Logout',
    scanQROverlayBtn: language === 'ko' ? '영수증 QR 스캔하기 (스탬프 적립)' : 'Scan Receipt QR (Earn Stamps)',
    selectStoreLabel: language === 'ko' ? '방문하신 매장 선택' : 'Select Visited Store',
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
    const lastNum = localStorage.getItem('sharestamp_last_phone_number') || '';
    return formatUSPhoneNumber(lastNum);
  });
  
  // 스캔 선입력 상태 확인용 임시 상태 (배너용)
  const [hasPendingQR, setHasPendingQR] = useState<boolean>(() => !!localStorage.getItem('sharestamp_pending_qr_token'));
  
  // URL 또는 로컬스토리지 대기 중인 적립 매장명 계산
  const pendingScanStoreName = (() => {
    const token = localStorage.getItem('sharestamp_pending_qr_token');
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

  // QR 코드 스캔 선입력 처리 (Kiosk에서 넘어온 스캔 토큰 자동 처리)
  useEffect(() => {
    const checkPendingQR = () => {
      const pendingToken = localStorage.getItem('sharestamp_pending_qr_token');
      setHasPendingQR(!!pendingToken);
      
      if (currentUser && currentDeviceToken && pendingToken) {
        // 해당 토큰의 매장 정보를 조회하여 활성 매장을 자동으로 전환
        const scan = receiptScans.find(s => s.qrToken === pendingToken);
        if (scan) {
          setSelectedStoreId(scan.storeId);
        }
        
        const res = claimQRStamps(pendingToken, currentDeviceToken);
        if (res.success) {
          setClaimMessage({ success: true, text: res.message });
          setTimeout(() => setClaimMessage(null), 3000);
        } else {
          setClaimMessage({ success: false, text: res.message });
          setTimeout(() => setClaimMessage(null), 3000);
        }
        localStorage.removeItem('sharestamp_pending_qr_token');
        setHasPendingQR(false);
      }
    };

    checkPendingQR();

    window.addEventListener('check-pending-qr', checkPendingQR);
    return () => window.removeEventListener('check-pending-qr', checkPendingQR);
  }, [currentUser, currentDeviceToken, receiptScans, claimQRStamps]);

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
    const last4 = registerForm.phoneNumber.slice(-4) || '0000';
    const generatedName = `회원_${last4}`;
    const generatedNickname = `user_${last4}`;

    registerUser(
      registerForm.phoneNumber,
      generatedNickname,
      generatedName
    );
    
    // 상태 리셋 및 대시보드로 진입
    setIsVerifyingSMS(false);
    setIsRegistering(false);
  };


  const [claimMessage, setClaimMessage] = useState<{ success: boolean; text: string } | null>(null);

  // 상점 선택
  const [selectedStoreId, setSelectedStoreId] = useState<string>('store_id_1'); // 기본: 커피하우스
  
  // 클릭된 스탬프 슬롯 정보
  const [clickedStampIndex, setClickedStampIndex] = useState<number | null>(null);
  const [clickedStampDate, setClickedStampDate] = useState<string | null>(null);
  
  // 선택된 타임라인 기프트 상세 보기
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState<boolean>(false);

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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

  // 내 어카운트 정보 모달 내의 스탬프 클릭 상태
  const [clickedModalStoreId, setClickedModalStoreId] = useState<string | null>(null);
  const [clickedModalStampIdx, setClickedModalStampIdx] = useState<number | null>(null);
  const [clickedModalStampDate, setClickedModalStampDate] = useState<string | null>(null);


 
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
  const [giftingNpoId, setGiftingNpoId] = useState<string>('npo_1');
  const [giftingMessage, setGiftingMessage] = useState<string>('');
  const [giftingSuccessMessage, setGiftingSuccessMessage] = useState<string | null>(null);
  
  // 수신자 선물 감사 멘트 입력용 맵 (giftId -> thanksMessage)
  const [giftThanksMessages, setGiftThanksMessages] = useState<Record<string, string>>({});
  const pendingGifts = currentUser ? gifts.filter(g => g.recipientId === currentUser.id && g.status === 'pending') : [];

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


  // 매장 및 사용자 스탬프 정보 추출
  const selectedStore = stores.find(s => s.id === selectedStoreId) || stores[0] || { id: 'store_id_1', name: 'ShareStamp 매장', category: 'cafe', pointRewardPer7Stamps: 5, currency: 'USD', earningIntervalMinutes: 60, ownerId: 'none' };
  
  const userCard = currentUser ? stampCards.find(c => c.userId === currentUser.id && c.storeId === selectedStoreId) : null;
  const currentStamps = userCard ? userCard.currentStamps : 0;
  
  const pointsBalance = currentUser 
    ? storePoints.filter(p => p.userId === currentUser.id).reduce((sum, p) => sum + p.pointsBalance, 0)
    : 0.00;

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
    const user = loginByPhoneNumber(phoneNumberInput);
    if (!user) {
      // 회원 정보 없으므로 아임인 스타일 온보딩 가입창 오픈
      setRegisterForm(prev => ({ ...prev, phoneNumber: phoneNumberInput }));
      setIsRegistering(true);
    }
  };

  // 가입 및 로그인 완료 (SMS 코드 발송 요청으로 위임)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAgreed) return;
    handleSendSMSCode();
  };



  // 친구 검색
  const searchedFriends = friendQuery.trim() ? searchFriend(friendQuery) : [];

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
            <div style={{ textAlign: 'center' }}>
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
                  onChange={(e) => setPhoneNumberInput(formatUSPhoneNumber(e.target.value))}
                  placeholder={t.phonePlaceholder} 
                  className="imin-input"
                  required
                />
                {localStorage.getItem('sharestamp_last_phone_number') && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {t.recentNum} <strong 
                      onClick={() => setPhoneNumberInput(formatUSPhoneNumber(localStorage.getItem('sharestamp_last_phone_number') || ''))}
                      style={{ color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {formatUSPhoneNumber(localStorage.getItem('sharestamp_last_phone_number') || '')}
                    </strong> ({t.autoFillClick})
                  </div>
                )}
              </div>

              <button type="submit" className="imin-btn imin-btn-primary">
                {t.start}
              </button>
            </form>

            <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--background-color)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
               <strong>{t.demoTip}</strong><br/>
               {t.demoTip1}<br/>
               {t.demoTip2}
            </div>
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



  // 로그인 완료된 메인 PWA 화면
  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto', minHeight: '100%', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', boxShadow: '0 0 10px rgba(0,0,0,0.05)', position: 'relative' }}>
      
      {/* PWA 상단 바 (더 작고 조밀하게 축소) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 16px 10px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 100 }}>
        <div 
          onClick={() => {
            if (showAccountModal) {
              setShowAccountModal(false);
              setShowDirectDonateForm(false);
              setDirectDonateResult(null);
              setClickedModalStoreId(null);
              setClickedModalStampIdx(null);
              setClickedModalStampDate(null);
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '9px', color: '#c7c7cc', fontFamily: 'monospace', fontWeight: 'bold' }}>v1.2.0</span>
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

          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <LogOut size={14} />
            {t.logoutBtn}
          </button>
        </div>
      </div>

      {/* 광고 배너 (이미지 전용, 16:5 비율 고정, 15초 자동 교체) */}
      {activeAd && activeAd.imageUrl ? (
        <div
          onClick={() => {
            if (activeAd.linkUrl) {
              window.open(activeAd.linkUrl, '_blank');
            }
          }}
          style={{
            width: '100%',
            aspectRatio: '16 / 5',
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
                value={selectedStoreId} 
                onChange={(e) => { setSelectedStoreId(e.target.value); setClaimMessage(null); }}
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
                {stores.filter(s => s.id.startsWith('store_id_')).slice(0, 5).map(s => (
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
                  {t.earnRateLimitLabel} {formatInterval(selectedStore.earningIntervalMinutes)}
                </span>
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#1c1c1e', lineHeight: '1.2', paddingRight: '85px' }}>{selectedStore.name}</h4>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block', lineHeight: '1.3' }}>
                {t.rewardLabel} <strong style={{ fontSize: '15px', fontWeight: 800, color: '#FF073A' }}>${selectedStore.pointRewardPer7Stamps.toFixed(2)}</strong>
              </span>
            </div>

            {/* 박스 2 (스탬프 카드) */}
            <div className="imin-card" onClick={() => setIsTimelineModalOpen(true)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}>
              {/* 7개 도장 보드 판 (박스 처리 및 스탬프 디자인 대폭 시인성 개선 - 박스 오버플로우 방지) */}
              <div style={{
                backgroundColor: '#F8F9FF', // 연보라/연블루 톤이 살짝 도는 깔끔한 배경
                border: '1px solid rgba(95, 92, 230, 0.15)', // 연보라색 보더 테두리
                borderRadius: '12px',
                padding: '8px 10px', // 좌우 패딩을 줄여 공간 확보
                margin: '0',
                boxShadow: '0 4px 12px rgba(95, 92, 230, 0.04), inset 0 1px 3px rgba(0,0,0,0.01)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                textAlign: 'left',
                boxSizing: 'border-box'
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

                      return (
                        <div 
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStampClick(idx);
                          }}
                          style={{ 
                            width: '100%',
                            minWidth: 0,
                            aspectRatio: '1',
                            borderRadius: '50%', // 완벽한 원형
                            backgroundColor: isChecked ? 'var(--accent-blue)' : '#FFFFFF',
                            border: `2px ${isChecked ? 'solid var(--accent-blue)' : 'dashed #C7C7CC'}`, // 미적립은 점선 처리하여 직관성 부여
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isChecked ? '#FFFFFF' : '#8E8E93', // 미적립 번호 가독성 향상
                            fontWeight: 800,
                            fontSize: '13px', // 시인성이 유지되는 한도 내 최적화
                            boxShadow: isChecked ? '0 3px 8px rgba(10, 132, 255, 0.4)' : 'none',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            cursor: 'pointer',
                            position: 'relative',
                            boxSizing: 'border-box'
                          }}
                        >
                          {isChecked ? <Star size={16} fill="currentColor" strokeWidth={0} /> : stampNum}
                          
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
                  const timelineGifts = [...gifts]
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
                    if (isRecipientOwner) {
                      recipientName = language === 'ko' ? `${storeName} 사장님` : `${storeName} Owner`;
                      recipientHandle = '@owner';
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                    {searchedFriends.map(f => (
                      <div 
                        key={f.id} 
                        onClick={() => setSelectedFriend(f)}
                        style={{ 
                          padding: '10px', 
                          borderRadius: 'var(--border-radius-sm)', 
                          backgroundColor: selectedFriend?.id === f.id ? 'var(--primary-light)' : 'var(--background-color)', 
                          border: `1px solid ${selectedFriend?.id === f.id ? 'var(--primary-color)' : 'transparent'}`, 
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '13px'
                        }}
                      >
                        <strong>{f.name.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')} ({f.nickname})</strong>
                        <span>{language === 'ko' ? '선택' : 'Select'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedFriend && (
                  <div style={{ border: '1px solid var(--accent-blue)', borderRadius: 'var(--border-radius-md)', padding: '12px', backgroundColor: 'rgba(10, 132, 255, 0.04)', fontSize: '13px' }}>
                    {t.giftSelectedFriend} <strong>{selectedFriend.name.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')} ({selectedFriend.nickname})</strong>
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

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '받을 친구 선택' : 'Select Friend'}
                      </label>
                      <select
                        value={giftingRecipientId}
                        onChange={(e) => setGiftingRecipientId(e.target.value)}
                        style={{ width: '100%', padding: '10px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }}
                      >
                        <option value="">{language === 'ko' ? '-- 친구 선택 --' : '-- Select Friend --'}</option>
                        {users
                          .filter(u => u.role === 'customer' && u.id !== currentUser?.id)
                          .map(u => (
                            <option key={u.id} value={u.id}>{u.nickname} ({u.name.replace('회원_', '')})</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        {language === 'ko' ? '선물 메시지' : 'Message'}
                      </label>
                      <input
                        type="text"
                        value={giftingMessage}
                        onChange={(e) => setGiftingMessage(e.target.value)}
                        placeholder={language === 'ko' ? '메시지를 입력하세요 (옵션)' : 'Enter message (optional)'}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                      />
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
 
        // 2. 가본 매장 목록 (이 사용자의 스탬프 카드가 생성된 매장)
        const myCards = stampCards.filter(c => c.userId === currentUser.id);

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
              setClickedModalStoreId(null);
              setClickedModalStampIdx(null);
              setClickedModalStampDate(null);
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


              {/* 가본 매장 리스트 */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {language === 'ko' ? '🏪 방문 매장 리스트' : '🏪 Visited Stores'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {myCards.length > 0 ? (
                    myCards.map(card => {
                      const store = stores.find(s => s.id === card.storeId);
                      const storeName = store ? store.name : card.storeId;
                      const cash = storePoints.filter(p => p.userId === currentUser.id).reduce((sum, p) => sum + p.pointsBalance, 0);
                      return (
                        <div 
                          key={card.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 14px',
                            backgroundColor: 'var(--background-color)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                              {storeName}
                            </span>
                            
                            {/* 매장이름 아래 스탬프 보드 형식 별표/원 7개 렌더링 */}
                             <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
                              {(() => {
                                const stampDetails = getStampDetailsForStore(card.storeId);
                                return Array.from({ length: 7 }).map((_, idx) => {
                                  const hasStamp = idx < card.currentStamps;
                                  const detail = stampDetails[idx];

                                  const handleStampClick = () => {
                                    if (!hasStamp) {
                                      if (clickedModalStoreId === card.storeId && clickedModalStampIdx === idx) {
                                        setClickedModalStoreId(null);
                                        setClickedModalStampIdx(null);
                                        setClickedModalStampDate(null);
                                      } else {
                                        setClickedModalStoreId(card.storeId);
                                        setClickedModalStampIdx(idx);
                                        setClickedModalStampDate('not_earned');
                                      }
                                      return;
                                    }
                                    
                                    const earnDateVal = detail ? detail.createdAt : new Date().toISOString();
                                    const formattedEarnDate = formatAcquisitionDate(earnDateVal);
                                    
                                    let dateStr = formattedEarnDate;
                                    if (detail && detail.isGift) {
                                      const senderDisplayName = detail.senderName.replace('회원_', '') + `(${detail.senderNickname})`;
                                      dateStr = language === 'ko'
                                        ? `🎁 ${senderDisplayName}님이 보냄\n${formattedEarnDate}`
                                        : `🎁 Sent by ${senderDisplayName}\n${formattedEarnDate}`;
                                    }
                                    
                                    if (clickedModalStoreId === card.storeId && clickedModalStampIdx === idx) {
                                      setClickedModalStoreId(null);
                                      setClickedModalStampIdx(null);
                                      setClickedModalStampDate(null);
                                    } else {
                                      setClickedModalStoreId(card.storeId);
                                      setClickedModalStampIdx(idx);
                                      setClickedModalStampDate(dateStr);
                                    }
                                  };

                                  return (
                                    <div 
                                      key={idx}
                                      onClick={handleStampClick}
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        backgroundColor: hasStamp ? 'var(--accent-blue)' : '#FFFFFF',
                                        border: `1.5px solid ${hasStamp ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '9px',
                                        color: hasStamp ? '#FFFFFF' : 'var(--border-color)',
                                        fontWeight: 700,
                                        boxShadow: hasStamp ? '0 1px 4px rgba(10, 132, 255, 0.3)' : 'none',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title={hasStamp ? (language === 'ko' ? '적립 일시 보기' : 'View Earn Date') : (language === 'ko' ? '미적립' : 'Not Earned')}
                                    >
                                      {hasStamp ? <Star size={11} fill="currentColor" strokeWidth={0} /> : (idx + 1)}

                                      {/* 말풍선 툴팁 */}
                                      {(() => {
                                        const isLeftEdge = idx <= 1;
                                        const isRightEdge = idx >= 5;
                                        const modalTooltipStyle: React.CSSProperties = {
                                          position: 'absolute',
                                          bottom: '135%',
                                          backgroundColor: '#1c1c1e',
                                          color: '#ffffff',
                                          padding: '5px 8px',
                                          borderRadius: '6px',
                                          fontSize: '9px',
                                          fontWeight: 600,
                                          whiteSpace: 'pre-line',
                                          wordBreak: 'break-all',
                                          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                          zIndex: 10,
                                          pointerEvents: 'none',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          fontFamily: 'inherit',
                                          width: 'max-content',
                                          maxWidth: '160px',
                                          lineHeight: '1.2',
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

                                        const modalArrowStyle: React.CSSProperties = {
                                          position: 'absolute',
                                          top: '100%',
                                          width: '0',
                                          height: '0',
                                          borderLeft: '4px solid transparent',
                                          borderRight: '4px solid transparent',
                                          borderTop: '4px solid #1c1c1e',
                                          ...(isLeftEdge ? {
                                            left: '8px',
                                            transform: 'none',
                                          } : isRightEdge ? {
                                            right: '8px',
                                            transform: 'none',
                                          } : {
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                          })
                                        };

                                        return clickedModalStoreId === card.storeId && clickedModalStampIdx === idx && (
                                          <div style={modalTooltipStyle}>
                                            <span>
                                              {clickedModalStampDate === 'not_earned' 
                                                ? (language === 'ko' ? '미적립' : 'Not Earned') 
                                                : clickedModalStampDate}
                                            </span>
                                            <div style={modalArrowStyle} />
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '14px', color: 'var(--primary-color)', display: 'block' }}>
                              ${cash.toFixed(2)}
                            </strong>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                              {language === 'ko' ? '보유 캐시' : 'Available Cash'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12.5px', backgroundColor: 'var(--background-color)', borderRadius: '8px' }}>
                      {language === 'ko' ? '아직 방문한 매장이 없습니다.' : 'No visited stores yet.'}
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
                  const timelineGifts = [...gifts]
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

    </div>
  );
};