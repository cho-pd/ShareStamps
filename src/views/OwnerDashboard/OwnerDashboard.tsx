import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { Users, Award, Heart, Printer, ArrowRight, Clock, LogOut, Search, CreditCard, Tablet, Globe, Star, Upload, ImageIcon, X, Loader2 } from 'lucide-react';
import { storage as firebaseStorage } from '../../firebase';
import { getDownloadURL, ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';


const formatInterval = (minutes: number, lang: string = 'ko') => {
  const minsNum = typeof minutes === 'number' && !isNaN(minutes) ? minutes : 60;
  if (minsNum < 60) return lang === 'ko' ? `${minsNum}분` : `${minsNum} min`;
  const hours = Math.floor(minsNum / 60);
  const mins = minsNum % 60;
  return mins > 0 
    ? (lang === 'ko' ? `${hours}시간 ${mins}분` : `${hours} hr ${mins} min`)
    : (lang === 'ko' ? `${hours}시간` : `${hours} hr`);
};

export const OwnerDashboard: React.FC = () => {
  const { 
    stores, 
    donations, 
    pointTransactions, 
    stampTransactions, 
    users, 
    updateStoreInterval,
    updateStoreRewardAmount,
    paymentRequests,
    approvePayment,
    rejectPayment,
    settleDonations,
    language,
    setLanguage,
    stampCards,
    storePoints,
    nonProfits,
    gifts,
    ownerSelectedStoreId: selectedStoreId,
    setOwnerSelectedStoreId: setSelectedStoreId,
    ownerPassword,
    currentOwner,
    setCurrentOwner,
    registerOwner,
    resetDatabase,
    deductStampsByOwner,
    giveStampsByOwner,
    giftCards,
    giftCardTransactions,
    processSplitPayment,
    processRefund,
    registerStripeConnect,
    reviews,
    updateStoreMiniHome
  } = useDatabase();
  
  // 상태 관리
  const [approveCustomMessage, setApproveCustomMessage] = useState<string>('');

  const pendingRequests = paymentRequests.filter(
    r => r.storeId === selectedStoreId && r.status === 'pending'
  );
  const activeRequest = pendingRequests[0];

  useEffect(() => {
    if (activeRequest) {
      const defaultMsg = activeRequest.type === 'donation'
        ? (language === 'ko' 
            ? `${activeRequest.nonProfitName || 'NPO'} 기부가 승인되었습니다. 따뜻한 후원에 감사드립니다.` 
            : `Donation to ${activeRequest.nonProfitName || 'NPO'} has been approved. Thank you for your support.`)
        : (language === 'ko'
            ? `스탬프 캐시 ${activeRequest.amount}달러 결제가 승인되었습니다. 이용해 주셔서 감사합니다!`
            : `Stamp cash payment of ${activeRequest.amount} dollars has been approved. Thank you!`);
      setApproveCustomMessage(defaultMsg);
    } else {
      setApproveCustomMessage('');
    }
  }, [activeRequest, language]);
  
  // 인쇄용 모드 활성화 (A4 프리뷰 보기용)
  const [printMode, setPrintMode] = useState<boolean>(false);

  // 실시간 결제 승인요청 팝업 관련 상태

  // 고객 정보 조회 관련 상태
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'home' | 'customers' | 'analytics' | 'minihome'>(() => {
    const saved = localStorage.getItem('ownerActiveSubTab');
    if (saved === 'home' || saved === 'customers' || saved === 'analytics' || saved === 'minihome') {
      return saved;
    }
    return 'home';
  });

  useEffect(() => {
    localStorage.setItem('ownerActiveSubTab', activeSubTab);
  }, [activeSubTab]);

  // 스탬프 직접 관리 관련 상태
  const [ownerStampQty, setOwnerStampQty] = useState<number>(1);
  const [ownerStampReason, setOwnerStampReason] = useState<string>('');
  const [ownerStampManageTab, setOwnerStampManageTab] = useState<'give' | 'deduct'>('give');

  // 계산대 결제 시뮬레이션 상태 추가
  const [posCustomerPhone, setPosCustomerPhone] = useState<string>('01055556666'); // 디폴트: 박지민
  const [posBillAmount, setPosBillAmount] = useState<string>('12.50');
  const [posUseStamps, setPosUseStamps] = useState<boolean>(true);
  const [posUseGift, setPosUseGift] = useState<boolean>(true);
  const [posCheckoutResult, setPosCheckoutResult] = useState<{ summary: string; remaining: number } | null>(null);

  // 3단계 환불 모달 상태 추가
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [selectedTxToRefund, setSelectedTxToRefund] = useState<any | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [refundPinInput, setRefundPinInput] = useState<string>('');
  const [refundError, setRefundError] = useState<string | null>(null);

  // 승인 직후 포스기 할인 지시 알림 상태
  const [showPosDiscountModal, setShowPosDiscountModal] = useState<any | null>(null);

  // 통계 관련 추가 상태
  const [statsPeriod, setStatsPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 7개 보상 금액 임시 설정 및 비밀번호 재확인 모달 상태
  const [tempRewardAmount, setTempRewardAmount] = useState<string>('');
  const [showRewardConfirmModal, setShowRewardConfirmModal] = useState<boolean>(false);
  const [rewardConfirmPassword, setRewardConfirmPassword] = useState<string>('');
  const [rewardConfirmError, setRewardConfirmError] = useState<string | null>(null);

  // 보안 영역 탭 잠금 해제 상태 및 비밀번호 입력용 상태
  const [isTabsUnlocked, setIsTabsUnlocked] = useState<boolean>(false);
  const [dashboardPasswordInput, setDashboardPasswordInput] = useState<string>('');
  const [dashboardPasswordError, setDashboardPasswordError] = useState<string | null>(null);

  // 사장님 로그인/회원가입 관련 상태
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginIdInput, setLoginIdInput] = useState<string>('');
  const [loginPwInput, setLoginPwInput] = useState<string>('');
  const [signUpNameInput, setSignUpNameInput] = useState<string>('');
  const [signUpIdInput, setSignUpIdInput] = useState<string>('');
  const [signUpPwInput, setSignUpPwInput] = useState<string>('');
  const [ownerAuthError, setOwnerAuthError] = useState<string | null>(null);
  const [selectedSignUpStore, setSelectedSignUpStore] = useState<any | null>(null);
  const [signUpStoreSearchQuery, setSignUpStoreSearchQuery] = useState<string>('');

  // 시뮬레이터 설정 모달 오픈을 위한 트리플 클릭 카운터
  const [clickCount, setClickCount] = useState<number>(0);

  useEffect(() => {
    if (clickCount === 0) return;
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, [clickCount]);


  // 다국어 번역 사전 정의
  const t = {
    headerTitle: language === 'ko' ? '👨‍🍳 사장님 관리 대시보드 (Computer POS)' : '👨‍🍳 Owner POS Dashboard',
    headerDesc: language === 'ko' ? '매장 컴퓨터나 포스 기기에서 사용하는 점주용 통계 관리 화면입니다.' : 'Store statistics and management dashboard for terminal/POS devices.',
    printPoster: language === 'ko' ? '착한가게 포스터 인쇄' : 'Print Store Poster',
    logout: language === 'ko' ? '로그아웃' : 'Logout',
    tabOverview: language === 'ko' ? '📊 오버뷰' : '📊 Overview',
    tabCustomer: language === 'ko' ? '🔍 고객' : '🔍 Customer',
    tabSettlement: language === 'ko' ? '📈 정산' : '📈 Settlement',
    tabMiniHome: language === 'ko' ? '🏠 미니홈피 관리' : '🏠 Mini-Home Settings',
    lockNow: language === 'ko' ? '🔒 즉시 잠금' : '🔒 Lock Now',
    
    // Overview metrics
    metricWeeklyDonation: language === 'ko' ? '이번 주 총 기부금 (스탬프)' : 'Weekly Donations (Stamps)',
    metricDonationCount: (count: number) => language === 'ko' ? `기부 참여 건수: ${count}회` : `Donation Count: ${count}`,
    metricLucky7: language === 'ko' ? 'Lucky 7 보상 발행 수' : 'Lucky 7 Rewards Issued',
    metricLucky7Redeemed: language === 'ko' ? '환전 완료' : 'Redeems Completed',
    metricLucky7Payout: (payout: number) => language === 'ko' ? `총 지급액: $${payout.toFixed(2)}` : `Total Paid: $${payout.toFixed(2)}`,
    metricViralNew: language === 'ko' ? '공유 유입 신규 회원' : 'Viral Sign-ups',
    metricViralCount: (count: number) => language === 'ko' ? `${count}명 가입` : `${count} Members`,
    metricViralDesc: language === 'ko' ? '스탬프 선물 바이럴을 통한 신규 가입자 수' : 'Number of sign-ups driven by stamp gift virality',
    
    // Live requests queue
    queueTitle: language === 'ko' ? '💰 실시간 캐시 승인 & 포스 할인 관리' : '💰 Live Cash Approval & POS Discount Queue',
    queueDesc: language === 'ko' ? '고객이 스마트폰 PWA에서 스탬프 캐시 결제 사용 승인을 요청하면 실시간으로 여기에 뜹니다. 승인 시 고객 캐시가 차감되며, 점주는 포스기(POS)에서 직접 실물 할인을 진행해야 합니다.' : 'When customers request cash usage from their phone PWA, it appears here in real-time. Approving deducts their cash balance; the clerk must apply the actual discount on the physical POS.',
    queuePending: (count: number) => language === 'ko' ? `⏳ 승인 대기 중인 요청 (${count}건)` : `⏳ Pending Requests (${count})`,
    reject: language === 'ko' ? '거절' : 'Reject',
    approve: language === 'ko' ? '승인' : 'Approve',
    queueEmpty: language === 'ko' ? '현재 대기 중인 캐시 결제 요청이 없습니다.' : 'No pending cash payment requests.',
    queueRecent: language === 'ko' ? '✅ 최근 처리 결과 (최근 5건)' : '✅ Recent Approval History (Last 5)',
    approvedStatus: language === 'ko' ? '승인 완료' : 'Approved',
    rejectedStatus: language === 'ko' ? '거절됨' : 'Rejected',
    discountGuide: language === 'ko' ? '포스 할인 안내' : 'POS Discount Guide',
    recentEmpty: language === 'ko' ? '최근에 처리된 결제 요청이 없습니다.' : 'No recently processed requests.',
    
    // Interval Settings
    intervalTitle: language === 'ko' ? '재적립 대기 시간 설정' : 'Re-earning Limit Interval Settings',
    intervalDesc: language === 'ko' ? '동일한 회원이 의도치 않은 중복 적립이나 부적절한 다회 스캔을 하는 것을 방지하기 위해, 이전 적립 후 재적립이 금지되는 시간 간격을 지정합니다.' : 'Sets the minimum time required between stamp earnings to prevent accidental double-stamps or duplicate scans.',
    intervalSelect: language === 'ko' ? '재적립 제한 시간 선택' : 'Select Re-earning Interval',
    intervalCurrent: (current: string) => language === 'ko' ? `현재 설정: ${current} 이내 재적립 제한` : `Current limit: No re-earning within ${current}`,
    
    // Settlement Guide
    settleGuideTitle: language === 'ko' ? '💡 매장 스탬프 기부 정산 시스템 안내' : '💡 Stamp Donation Settlement System Guide',
    settleGuideP1: language === 'ko' ? '회원들이 7개를 다 채우기 전에 기부한 스탬프는, 매장 카운터 결제에서 바로 차감되지 않고 플랫폼 전체 정산 시스템에 등록됩니다.' : 'Stamps donated by members before completion are not directly deducted at the register, but registered in the platform donation ledger.',
    settleGuideP2: (reward: number, val: number) => language === 'ko' ? `사장님이 설정하신 스탬프 카드 7개 보상금액(예: $${reward.toFixed(2)})에 따라, 스탬프 1개당 가치는 $${val.toFixed(2)}로 자동 결정됩니다.` : `Based on your 7-stamp completion reward ($${reward.toFixed(2)}), each stamp is valued at $${val.toFixed(2)}.`,
    settleGuideP3: language === 'ko' ? '회원이 기부한 기부금은 월말에 종합 플랫폼 정산 대장을 통해 각 NPO 단체별로 수량 합산 후 청구되며, 사장님은 회원들과 약속한 이 기부금액을 정기 송금(정산)해주시게 됩니다.' : 'Donated stamp values are consolidated by NPO at the end of the month. The store owner will settle this amount to NPOs via the platform billings.',
    settleGuideP4: language === 'ko' ? '정산 내역 확인은 종합 관리자(Super Admin) 메뉴에서 모의 가능합니다.' : 'Settlement details can be simulated in the Super Admin panel.',
    
    // Customer Directory
    custTitle: language === 'ko' ? '🔍 고객 정보 통합 조회 (Customer Directory)' : '🔍 Customer Directory',
    custPlaceholder: language === 'ko' ? '이름, 닉네임, 연락처 뒷자리 검색...' : 'Search name, nickname, phone...',
    custNoResults: language === 'ko' ? '검색 결과와 일치하는 고객이 없습니다.' : 'No customer matches found.',
    custStamps: (count: number) => language === 'ko' ? `스탬프 ${count}개` : `${count} Stamps`,
    custSuffix: language === 'ko' ? ' 님' : '',
    custInfo: (nickname: string, phone: string) => language === 'ko' ? `닉네임: @${nickname} | 연락처: ${phone}` : `Nickname: @${nickname} | Phone: ${phone}`,
    custCashBalance: language === 'ko' ? '스탬프 캐시 잔액' : 'Stamp Cash Balance',
    custSelectPrompt: language === 'ko' ? '좌측 목록에서 고객을 선택해 주세요.' : 'Please select a customer from the list.',
    custCardTitle: language === 'ko' ? '🎫 단골 스탬프 카드 현황' : '🎫 Customer Stamp Cards',
    custCardStatus: language === 'ko' ? '현재 매장 스탬프 카드 현황' : 'Current Stamp Card Status',
    custCardRemaining: (rem: number) => language === 'ko' ? `개 (보상 달성까지 ${rem}개 남음)` : ` (${rem} more to go for Lucky 7 reward)`,
    custManualTitle: language === 'ko' ? '스탬프 직접 지급 (단골 관리)' : 'Direct Stamp Issuance',
    custManualDesc: language === 'ko' ? '사장님이 단골 고객 서비스 또는 영수증 오류 등의 사유로 직접 스탬프를 적립해 줄 수 있습니다. (플랫폼 시스템에 기록됨)' : 'Issue stamps manually for customer care, receipt errors, etc. (Recorded in system).',
    custManualQty: language === 'ko' ? '지급할 스탬프 수량' : 'Stamps to Issue',
    custManualBtn: (count: number) => language === 'ko' ? `${count}개 지급` : `Issue ${count} Stamps`,
    custManualSuccess: language === 'ko' ? '⚡ 즉시 지급 완료' : '⚡ Issued Successfully',
    
    // History & Donations
    historyTitle: language === 'ko' ? '🕒 최근 스탬프 적립/사용 전체 이력' : '🕒 Recent Transaction History',
    historyEarn: language === 'ko' ? '스탬프 적립' : 'Stamp Earned',
    historyGiftSend: language === 'ko' ? '스탬프 선물 보냄' : 'Stamp Gift Sent',
    historyGiftRecv: language === 'ko' ? '스탬프 선물 받음' : 'Stamp Gift Received',
    historyDonate: language === 'ko' ? '스탬프 기부' : 'Stamp Donated',
    historyConvert: language === 'ko' ? '스탬프 포인트 전환' : 'Point Conversion',
    historyQty: (count: number | string) => language === 'ko' ? `${count}개` : `${count} Stamps`,
    historyEmpty: language === 'ko' ? '거래 이력이 없습니다.' : 'No transactions found.',
    donationHistTitle: language === 'ko' ? '🧡 NPO 단체 기부 참여 이력' : '🧡 NPO Charity Donation History',
    donationHistText: (npoName: string, _count?: number, _val?: number) => language === 'ko' ? `${npoName} 기부` : `Donated to ${npoName}`,
    donationHistSubText: (count: number, val: number) => language === 'ko' ? `스탬프 ${count}개 ($${val.toFixed(2)}당) 기부 완료` : `${count} stamps ($ ${val.toFixed(2)} value) donated`,
    donationHistEmpty: language === 'ko' ? '기부 참여 이력이 없습니다.' : 'No donation history.',
    
    // Analytics
    analTitle: language === 'ko' ? '📊 정산 및 통계 대장 (Analytics & Settlement)' : '📊 Analytics & Settlement Ledger',
    analDesc: language === 'ko' ? '스탬프 발행, 캐시 지급, 기부 정산 내역을 일간/주간/월간 단위 대장으로 통합 보고합니다.' : 'Consolidated daily, weekly, and monthly reports of stamp issues, reward pay-outs, and donation settlements.',
    analExport: language === 'ko' ? '📥 Excel 내보내기' : '📥 Export Excel',
    analExporting: language === 'ko' ? '내보내는 중...' : 'Exporting...',
    analMetricActive: language === 'ko' ? '총 잔여 스탬프 개수' : 'Total Active Stamps',
    analMetricActiveDesc: language === 'ko' ? '고객 스탬프 카드에 활성화된 수량' : 'Total stamps currently on customer cards',
    analMetricCash: language === 'ko' ? '총 고객 보유 캐시 잔액' : 'Total Customer Cash Balance',
    analMetricCashDesc: language === 'ko' ? '고객들이 보유하고 있는 미사용 포인트' : 'Total unused cash point balances',
    analMetricMonthlyDon: language === 'ko' ? '이번 달 누적 기부량' : 'Monthly Donated Stamps',
    analMetricMonthlyDonDesc: language === 'ko' ? '월간 NPO 환원 완료된 스탬프' : 'Total stamps redeemed to NPOs this month',
    
    analGridTitle: (period: string) => language === 'ko' ? `📊 ${period === 'daily' ? '일별 정산 현황' : period === 'weekly' ? '주별 정산 현황' : '월별 정산 현황'} (Excel Sheets)` : `📊 ${period === 'daily' ? 'Daily Settlement' : period === 'weekly' ? 'Weekly Settlement' : 'Monthly Settlement'} (Excel Sheets)`,
    analGridDesc: language === 'ko' ? '매장 내 스탬프 적립, 캐시 충전(전환), 캐시 결제(포스 할인), 기부 내역이 실시간 격자 정보로 요약 보고됩니다.' : 'Real-time grid reports summarizing store stamps, cash conversions, cash redemptions, and donation settlements.',
    
    analColDate: (period: string) => language === 'ko' ? (period === 'daily' ? '정산 일자' : period === 'weekly' ? '정산 주차' : '정산 연월') : (period === 'daily' ? 'Settlement Date' : period === 'weekly' ? 'Settlement Week' : 'Settlement Month'),
    analColIssued: language === 'ko' ? '스탬프 발행 (개)' : 'Stamps Issued',
    analColCash: language === 'ko' ? '보상 캐시 지급액' : 'Reward Cash Paid',
    analColRedeem: language === 'ko' ? '포스기 할인 적용액 (실사용)' : 'POS Discounts Redeemed',
    analColDonQty: language === 'ko' ? '기부 스탬프 (개)' : 'Donated Stamps',
    analColDonCash: language === 'ko' ? '기부 환산 송금액' : 'Donation Payout Due',
    
    analPeriodDaily: language === 'ko' ? '일별 대장 (Daily)' : 'Daily Ledger',
    analPeriodWeekly: language === 'ko' ? '주별 대장 (Weekly)' : 'Weekly Ledger',
    analPeriodMonthly: language === 'ko' ? '월별 대장 (Monthly)' : 'Monthly Ledger',
    
    analManualTitle: language === 'ko' ? '💡 정산 및 환원 매뉴얼 안내:' : '💡 Settlement & Payout Instructions:',
    analManualItem1: language === 'ko' ? '보상 캐시 지급액은 고객이 스탬프 7개를 완성할 때 플랫폼 정책에 의해 스탬프 캐시로 자동 적립된 합계입니다.' : 'Reward cash represents the total cash issued when members completed 7 stamps.',
    analManualItem2: (reward: number) => language === 'ko' ? `기부 환산 송금액은 고객이 NPO에 기부한 스탬프 가치를 사장님이 정산일에 송금해주셔야 하는 실물 기부 누적금입니다 (1 스탬프 = $ ${reward.toFixed(2)} 환산).` : `Donation payout due is the cash amount to settle to NPOs based on member donations (1 Stamp = $ ${reward.toFixed(2)} conversion).`,
    analManualItem3: language === 'ko' ? 'LIVE 행은 실시간 매장 동작이 즉각 합산되어 반영 중인 현재 시간대 통계입니다.' : 'The LIVE row consolidates and displays real-time store transactions for the current period.',
    exportExcelSuccess: (filename: string) => language === 'ko' ? `📥 엑셀 내보내기 완료: ${filename} 파일이 다운로드 폴더에 저장되었습니다.` : `📥 Export Complete: ${filename} has been saved to your Downloads folder.`,
    
    // Auth & Protected prompt
    authPromptTitle: (menu: string) => language === 'ko' ? `${menu} 접근 권한 확인` : `${menu} Access Verification`,
    authPromptDesc: language === 'ko' ? '이 메뉴는 보안 영역입니다. 사장님 설정 비밀번호를 입력해 주세요.' : 'This section is secure. Please enter the Owner Settings Password.',
    password: language === 'ko' ? '비밀번호' : 'Password',
    passwordPlaceholder: language === 'ko' ? '비밀번호 입력' : 'Enter password',
    verifyUnlock: language === 'ko' ? '확인 및 잠금 해제' : 'Verify & Unlock',
    
    // Giant live request popup overlays
    overlayDonTitle: language === 'ko' ? '기부 단체 기부 요청' : 'Charity Donation Request',
    overlayCashTitle: language === 'ko' ? '스탬프 캐시 사용 요청' : 'Stamp Cash Usage Request',
    overlayDonDesc: language === 'ko' ? '고객이 기부 단체로의 캐시 기부를 요청했습니다.' : 'A customer requested a donation to charity.',
    overlayCashDesc: language === 'ko' ? '고객이 스탬프 캐시 할인을 요청했습니다.' : 'A customer requested stamp cash discount.',
    overlayCustomer: language === 'ko' ? '요청 고객' : 'Customer',
    overlayStore: language === 'ko' ? '요청 매장' : 'Store',
    overlayCharity: language === 'ko' ? '기부 수신처' : 'Charity',
    overlayDonAmt: language === 'ko' ? '기부 신청 금액' : 'Donation Amount',
    overlayCashAmt: language === 'ko' ? '결제 할인 금액' : 'Discount Amount',
    
    // POS Discount Notification Modal
    posModalTitle: language === 'ko' ? '💰 포스기 할인 적용 지시' : '💰 POS Discount Application Instruction',
    posModalDesc: language === 'ko' ? '승인이 완료되었습니다! 계산대 포스기(POS)에서 다음 할인을 직접 입력해 주세요:' : 'Approved successfully! Please apply the following discount directly on the register POS:',
    posModalCustomer: language === 'ko' ? '대상 고객' : 'Customer',
    posModalAmtLabel: language === 'ko' ? '포스기 할인 금액' : 'POS Discount Amount',
    posModalBtn: language === 'ko' ? '포스기 할인 적용 완료' : 'Confirm POS Discount Applied',

    // Extra translations for poster and dashboard return
    backToDashboard: language === 'ko' ? '대시보드로 돌아가기' : 'Back to Dashboard',
    openPrintDialog: language === 'ko' ? '인쇄 대화상자 열기' : 'Open Print Dialog',
    posterTitle: language === 'ko' ? '착한 매장 인증서' : 'Certified Kind Store',
    posterStoreLabel1: language === 'ko' ? '위 매장' : 'This store',
    posterStoreLabel2: language === 'ko' ? '은(는)' : '',
    posterDesc1: language === 'ko' ? '방문해주신 소중한 회원들과 따뜻한 힘을 모아' : 'has gathered warm hearts with our precious visiting members,',
    posterDesc2: language === 'ko' ? '버려질 수 있었던 스탬프 가치를 기부로 환원하였습니다.' : 'converting stamp values that could have been discarded into donations.',
    posterStampsLabel: language === 'ko' ? '이번 주 나눔 스탬프 수량:' : 'Donated Stamps This Week:',
    posterCashLabel: language === 'ko' ? 'NPO 기부 환산금액:' : 'NPO Donation Value:',
    posterFootnote1: language === 'ko' ? '기부된 스탬프 가치는 고객들이 직접 선택하신 NPO 단체들을 통해' : 'The donated stamp values will be distributed through NPOs chosen by customers,',
    posterFootnote2: language === 'ko' ? '결식 아동 급식, 환경 복원, 유기동물 구조 등에 소중히 사용됩니다.' : 'supporting meals for undernourished children, environmental restoration, animal rescues, etc.',
    posterIssuer: language === 'ko' ? '발행기관: 로컬 상점 기부 로열티 플랫폼 ShareStamps' : 'Issued by: Local Store Donation Loyalty Platform ShareStamps',
    posterDate: (dateStr: string) => language === 'ko' ? `인증일자: ${dateStr}` : `Certified Date: ${dateStr}`,
    
    // 사장님 로그인/회원가입 관련 번역
    ownerLoginTitle: language === 'ko' ? '🔑 사장님 로그인' : '🔑 Owner Sign In',
    ownerSignUpTitle: language === 'ko' ? '가맹점 신규 등록' : 'Register New Store',
    ownerLoginBtn: language === 'ko' ? '로그인' : 'Sign In',
    ownerSignUpBtn: language === 'ko' ? '가입 및 매장 등록' : 'Register & Create Store',
    switchToSignUp: language === 'ko' ? '가맹점 신규 등록 (회원가입)' : 'Register a new store (Sign Up)',
    switchToLogin: language === 'ko' ? '이미 가입된 가맹점 로그인' : 'Already registered? Sign In',
    ownerNameLabel: language === 'ko' ? '사장님 이름' : 'Owner Name',
    storeNameLabel: language === 'ko' ? '매장 이름' : 'Store Name',
    loginIdLabel: language === 'ko' ? '아이디' : 'ID / Username',
    ownerNamePlaceholder: language === 'ko' ? '이름 입력' : 'Enter your name',
    storeNamePlaceholder: language === 'ko' ? '매장 이름 입력' : 'Enter store name',
    loginIdPlaceholder: language === 'ko' ? '아이디 입력' : 'Enter ID'
  };

  const handleOwnerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerAuthError(null);
    const user = users.find(u => u.role === 'owner' && u.loginId?.toLowerCase() === loginIdInput.trim().toLowerCase());
    if (user && user.password === loginPwInput) {
      if (user.status === 'suspended') {
        setOwnerAuthError(language === 'ko' ? '활동이 정지된 계정입니다. 본사에 문의하세요.' : 'This account has been suspended. Please contact HQ.');
        return;
      }
      setCurrentOwner(user);
      const ownerStore = stores.find(s => s.ownerId === user.id);
      if (ownerStore) {
        setSelectedStoreId(ownerStore.id);
      }
      setLoginIdInput('');
      setLoginPwInput('');
    } else {
      setOwnerAuthError(language === 'ko' ? '아이디 또는 비밀번호가 일치하지 않습니다.' : 'Invalid ID or password.');
    }
  };

  const handleOwnerSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerAuthError(null);
    if (!signUpNameInput.trim() || !selectedSignUpStore || !signUpIdInput.trim() || !signUpPwInput.trim()) {
      setOwnerAuthError(
        !selectedSignUpStore 
          ? (language === 'ko' ? '검색을 통해 매장을 선택해 주세요.' : 'Please search and select a store.')
          : (language === 'ko' ? '모든 필드를 입력해 주세요.' : 'Please fill in all fields.')
      );
      return;
    }
    const res = registerOwner(
      signUpNameInput.trim(),
      selectedSignUpStore.id,
      signUpIdInput.trim(),
      signUpPwInput.trim()
    );
    if (res.success) {
      setSignUpNameInput('');
      setSelectedSignUpStore(null);
      setSignUpStoreSearchQuery('');
      setSignUpIdInput('');
      setSignUpPwInput('');
      setOwnerAuthError(null);
    } else {
      setOwnerAuthError(res.message);
    }
  };

  // 탭 클릭 제어 및 자동 잠금 로직
  const handleTabClick = (tab: 'home' | 'customers' | 'analytics' | 'minihome') => {
    if (tab === 'home' || tab === 'minihome') {
      setIsTabsUnlocked(false);
      setDashboardPasswordInput('');
      setDashboardPasswordError(null);
    }
    setActiveSubTab(tab);
  };

  // 잠금해제 인증 폼 핸들러
  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dashboardPasswordInput === ownerPassword) {
      setIsTabsUnlocked(true);
      setDashboardPasswordError(null);
      setDashboardPasswordInput('');
    } else {
      setDashboardPasswordError(language === 'ko' ? "비밀번호가 일치하지 않습니다." : "Password does not match.");
    }
  };

  // 보안 영역 비밀번호 입력창 컴포넌트 렌더러
  const renderPasswordPrompt = (menuName: string) => {
    return (
      <div 
        className="imin-card" 
        style={{ 
          maxWidth: '460px', 
          margin: '40px auto', 
          padding: '40px 32px', 
          borderRadius: 'var(--border-radius-lg)', 
          textAlign: 'center', 
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          border: '1px solid var(--border-color)',
          backgroundColor: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            color: 'var(--primary-color)'
          }}>
            🔒
          </div>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {t.authPromptTitle(menuName)}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '6px', lineHeight: 1.5 }}>
              {t.authPromptDesc}
            </p>
          </div>
        </div>

        <form onSubmit={handleUnlockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.password}</label>
            <input 
              type="password"
              value={dashboardPasswordInput}
              onChange={(e) => setDashboardPasswordInput(e.target.value)}
              placeholder={t.passwordPlaceholder}
              className="imin-input"
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}
              required
              autoFocus
            />
          </div>

          {dashboardPasswordError && (
            <span style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600, textAlign: 'left' }}>
              ⚠️ {dashboardPasswordError}
            </span>
          )}

          <button type="submit" className="imin-btn imin-btn-primary" style={{ padding: '12px', fontSize: '14px', fontWeight: 700 }}>
            {t.verifyUnlock}
          </button>
        </form>
      </div>
    );
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const selectedStore = (currentOwner && (stores.find(s => s.id === selectedStoreId && s.ownerId === currentOwner.id) || stores.find(s => s.ownerId === currentOwner.id))) || stores[0] || { id: 'store_id_1', name: 'ShareStamps 매장', category: 'cafe', pointRewardPer7Stamps: 5, currency: 'USD', earningIntervalMinutes: 60, ownerId: 'none' };

  // 매장 보상 금액 임시 변경 동기화
  useEffect(() => {
    if (selectedStore) {
      setTempRewardAmount(selectedStore.pointRewardPer7Stamps.toFixed(2));
    }
  }, [selectedStoreId, selectedStore?.pointRewardPer7Stamps]);

  // 매장 이미지 파일 업로드 상태
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState<boolean>(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 매장 이미지 URL 동기화
  useEffect(() => {
    if (selectedStore) {
      setThumbnailUrl(selectedStore.thumbnailUrl || '');
      setBannerUrl(selectedStore.bannerUrl || '');
    }
  }, [selectedStoreId, selectedStore?.thumbnailUrl, selectedStore?.bannerUrl]);

  // Base64 문자열을 Blob 객체로 변환하는 유틸리티 함수 (fetch가 차단된 환경 대응)
  const base64ToBlob = (base64: string, contentType: string) => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  };

  // 이미지 업로드 및 Canvas 압축 핸들러
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'thumbnail' | 'banner'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'thumbnail') {
      setIsUploadingThumbnail(true);
    } else {
      setIsUploadingBanner(true);
    }
    setUploadError(null);

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError(language === 'ko' ? '파일을 읽는 도중 오류가 발생했습니다.' : 'Error reading file.');
      if (type === 'thumbnail') {
        setIsUploadingThumbnail(false);
      } else {
        setIsUploadingBanner(false);
      }
    };
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        setUploadError(language === 'ko' ? '이미지를 불러오는데 실패했습니다.' : 'Failed to load image.');
        if (type === 'thumbnail') {
          setIsUploadingThumbnail(false);
        } else {
          setIsUploadingBanner(false);
        }
      };
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 압축 리사이징 제한 (썸네일: 최대 400px, 배너: 최대 1200px)
          const maxDimension = type === 'thumbnail' ? 400 : 1200;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }

          // 압축률 0.8 수준의 JPEG 데이터 추출
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

          // Firebase Storage 설정된 경우 업로드 진행
          if (firebaseStorage) {
            try {
              const timestamp = Date.now();
              const extension = 'jpg';
              const safeStoreId = selectedStoreId || 'store_unknown';
              const storagePath = `stores/${safeStoreId}/${type}_${timestamp}.${extension}`;
              
              // Base64를 Blob으로 역변환
              const blob = base64ToBlob(compressedBase64, 'image/jpeg');
              
              // 3.5초 타임아웃 제한으로 클라우드 업로드 대기 (실패 시 즉시 로컬 데이터베이스 저장으로 자동 전환)
              const uploadPromise = (async () => {
                const uploaded = await uploadBytes(storageRef(firebaseStorage, storagePath), blob, {
                  contentType: 'image/jpeg',
                  customMetadata: {
                    storeId: safeStoreId,
                    imageType: type,
                    source: 'owner-dashboard'
                  }
                });
                return await getDownloadURL(uploaded.ref);
              })();

              const downloadUrl = await Promise.race([
                uploadPromise,
                new Promise<string>((_, reject) => 
                  setTimeout(() => reject(new Error('Firebase Storage Upload Timeout')), 3500)
                )
              ]);
              
              if (type === 'thumbnail') {
                setThumbnailUrl(downloadUrl);
              } else {
                setBannerUrl(downloadUrl);
              }
            } catch (storageErr) {
              console.warn("Firebase Storage upload failed, falling back to Base64 database embedding:", storageErr);
              // Storage 업로드 실패 시 데이터베이스 임베딩으로 자동 전환
              if (type === 'thumbnail') {
                setThumbnailUrl(compressedBase64);
              } else {
                setBannerUrl(compressedBase64);
              }
            }
          } else {
            // 로컬 시뮬레이터 모드인 경우 Base64 데이터 직접 임베딩
            if (type === 'thumbnail') {
              setThumbnailUrl(compressedBase64);
            } else {
              setBannerUrl(compressedBase64);
            }
          }
        } catch (error: any) {
          console.error(`Image upload failed for ${type}:`, error);
          setUploadError(language === 'ko' ? '이미지 업로드에 실패했습니다. 다시 시도해주세요.' : 'Failed to upload image. Please try again.');
        } finally {
          if (type === 'thumbnail') {
            setIsUploadingThumbnail(false);
          } else {
            setIsUploadingBanner(false);
          }
          // 파일 인풋 초기화
          e.target.value = '';
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Firebase Storage에서 이전 이미지 파일을 정리/삭제하는 유틸리티
  const deleteImageFromStorage = async (url: string) => {
    if (!firebaseStorage || !url) return;
    if (url.startsWith('data:')) return; // Base64 이미지는 스토리지에 파일이 없음
    if (!url.includes('firebasestorage.googleapis.com')) return; // 외부 주소 무시

    try {
      // URL 주소로부터 Storage Reference 자동 획득하여 삭제
      const fileRef = storageRef(firebaseStorage, url);
      await deleteObject(fileRef);
      console.log("Successfully cleaned up old storage image file:", url);
    } catch (err) {
      console.warn("Storage cleanup warning (ignored):", err);
    }
  };

  // 보상 금액 변경 비밀번호 최종 검증 제출
  const handleRewardConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rewardConfirmPassword === ownerPassword) {
      const val = parseFloat(parseFloat(tempRewardAmount).toFixed(2)) || 0;
      if (val > 0) {
        updateStoreRewardAmount(selectedStoreId, val);
        setShowRewardConfirmModal(false);
        setRewardConfirmPassword('');
        setRewardConfirmError(null);
        setToastMessage(language === 'ko' ? '보상 금액이 성공적으로 변경되었습니다.' : 'Reward amount changed successfully.');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setRewardConfirmError(language === 'ko' ? '올바른 금액을 입력해 주세요.' : 'Please enter a valid amount.');
      }
    } else {
      setRewardConfirmError(language === 'ko' ? '비밀번호가 올바르지 않습니다.' : 'Incorrect password.');
    }
  };

  // --- 통계 및 정산 데이터 집계 함수 ---
  const isSameDay = (dateStr: string, daysAgo: number) => {
    const txDate = new Date(dateStr);
    const targetDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return (
      txDate.getFullYear() === targetDate.getFullYear() &&
      txDate.getMonth() === targetDate.getMonth() &&
      txDate.getDate() === targetDate.getDate()
    );
  };

  const isSameWeek = (dateStr: string, weeksAgo: number) => {
    const txDate = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - txDate.getTime();
    const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
    const weekStart = weeksAgo * 7;
    const weekEnd = (weeksAgo + 1) * 7;
    return diffDays >= weekStart && diffDays < weekEnd;
  };

  const isSameMonth = (dateStr: string, monthsAgo: number) => {
    const txDate = new Date(dateStr);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - monthsAgo);
    return (
      txDate.getFullYear() === targetDate.getFullYear() &&
      txDate.getMonth() === targetDate.getMonth()
    );
  };

  const getStoreStatsForFilter = (dateFilter: (dateStr: string) => boolean) => {
    const storeStampTxs = stampTransactions.filter(
      t => t.storeId === selectedStoreId && t.type === 'earn' && dateFilter(t.createdAt)
    );
    const stampsIssued = storeStampTxs.reduce((sum, t) => sum + t.amount, 0);

    const storePointConvertTxs = pointTransactions.filter(
      t => t.storeId === selectedStoreId && t.type === 'earn_from_stamps' && dateFilter(t.createdAt)
    );
    const cashConverted = storePointConvertTxs.reduce((sum, t) => sum + t.amount, 0);

    const storePointUseTxs = pointTransactions.filter(
      t => t.storeId === selectedStoreId && t.type === 'use_payment' && dateFilter(t.createdAt)
    );
    const posDiscountApplied = storePointUseTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const storeDonations = donations.filter(
      d => d.storeId === selectedStoreId && dateFilter(d.createdAt)
    );
    const stampsDonated = storeDonations.reduce((sum, d) => sum + d.stampCount, 0);
    const donationCashValue = storeDonations.reduce((sum, d) => sum + d.monetaryValue, 0);

    return {
      stampsIssued,
      cashConverted,
      posDiscountApplied,
      stampsDonated,
      donationCashValue
    };
  };

  const getDayLabel = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const days = language === 'ko'
      ? ['일', '월', '화', '수', '목', '금', '토']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[d.getDay()];
    return `${year}-${month}-${date} (${dayName})`;
  };

  const getWeekLabel = (weeksAgo: number) => {
    const d = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
    const month = d.getMonth() + 1;
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const weekNum = Math.ceil((d.getDate() + firstDay.getDay()) / 7);
    return language === 'ko' ? `${month}월 ${weekNum}주차` : `Week ${weekNum} of ${d.toLocaleString('en-US', { month: 'short' })}`;
  };

  const getMonthLabel = (monthsAgo: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    return language === 'ko' ? `${year}년 ${month}월` : `${d.toLocaleString('en-US', { month: 'short' })} ${year}`;
  };


  const getAggregatedStats = (type: 'daily' | 'weekly' | 'monthly') => {
    const limit = type === 'daily' ? 7 : type === 'weekly' ? 5 : 6;
    const results = [];
    
    for (let i = 0; i < limit; i++) {
      let label = '';
      let dateFilter = (_dateStr: string) => false;
      
      if (type === 'daily') {
        label = getDayLabel(i);
        dateFilter = (dateStr) => isSameDay(dateStr, i);
      } else if (type === 'weekly') {
        label = getWeekLabel(i);
        dateFilter = (dateStr) => isSameWeek(dateStr, i);
      } else {
        label = getMonthLabel(i);
        dateFilter = (dateStr) => isSameMonth(dateStr, i);
      }
      
      const realStats = getStoreStatsForFilter(dateFilter);
      
      results.push({
        period: label,
        stampsIssued: realStats.stampsIssued,
        cashConverted: realStats.cashConverted,
        posDiscountApplied: realStats.posDiscountApplied,
        stampsDonated: realStats.stampsDonated,
        donationCashValue: realStats.donationCashValue
      });
    }
    return results;
  };

  const handleExportExcel = () => {
    setExportLoading(true);
    setTimeout(() => {
      setExportLoading(false);
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      setToastMessage(t.exportExcelSuccess(`ShareStamps_Settlement_${selectedStoreId}_${todayStr}.xlsx`));
    }, 1200);
  };

  const maskPhoneNumber = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length >= 10) {
      return `${clean.substring(0, 3)}-****-${clean.substring(clean.length - 4)}`;
    }
    return `***-****-${clean.slice(-4)}`;
  };


  const getNpoName = (npoId: string) => {
    const npo = nonProfits.find(n => n.id === npoId);
    return npo ? npo.name : npoId;
  };

  const filteredCustomers = users.filter(u => {
    if (u.role !== 'customer' || u.status === 'deleted') return false;
    const q = customerSearchQuery.toLowerCase();
    const cleanPhone = u.phoneNumber.replace(/\D/g, '');
    return (
      u.name.toLowerCase().includes(q) ||
      u.nickname.toLowerCase().includes(q) ||
      cleanPhone.includes(q)
    );
  });

  const activeCustomer = users.find(u => u.id === selectedCustomerId) || filteredCustomers[0];

  // 현재 매장의 대기중인 결제 승인요청 조회 (컴포넌트 상단 정의 사용)

  // 현재 매장의 처리 완료된 결제 승인요청 조회 (최근 5건, 최신순)
  const resolvedRequests = [...paymentRequests]
    .filter(r => r.storeId === selectedStoreId && (r.status === 'approved' || r.status === 'rejected'))
    .reverse()
    .slice(0, 5);

  // --- 지표 계산 로직 (이번 주 기준, 프로토타입 편의상 전체 누적으로 시연) ---
  const storeDonations = donations.filter(d => d.storeId === selectedStoreId);
  const totalDonationCount = storeDonations.length;
  const totalDonatedStamps = storeDonations.reduce((sum, d) => sum + d.stampCount, 0);
  const totalDonatedValue = storeDonations.reduce((sum, d) => sum + d.monetaryValue, 0);

  const totalLucky7Achieved = pointTransactions.filter(
    pt => pt.storeId === selectedStoreId && pt.type === 'earn_from_stamps'
  ).length;

  const totalGiftCardSales = (giftCardTransactions || [])
    .filter(tx => {
      const card = giftCards.find(c => c.id === tx.giftCardId);
      return card && card.storeId === selectedStoreId && tx.type === 'purchase';
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  // 바이럴 공유 가입수 계산 (첫 거래가 gift_receive이고 해당 매장인 회원)
  const calculateNewCustomers = () => {
    let count = 0;
    // 모든 customer에 대해
    const customers = users.filter(u => u.role === 'customer' && u.status !== 'deleted');
    customers.forEach(user => {
      // 해당 유저의 이 매장 트랜잭션 필터
      const userTxs = stampTransactions
        .filter(t => t.userId === user.id && t.storeId === selectedStoreId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      if (userTxs.length > 0 && userTxs[0].type === 'gift_receive') {
        count++;
      }
    });
    return count;
  };
  
  const newCustomersCount = calculateNewCustomers();

  // 바코드 차감 로직 제거됨 (실시간 승인 흐름으로 단일화)

  const handlePrint = () => {
    window.print();
  };

  if (!currentOwner) {
    return (
      <div style={{
        maxWidth: '440px',
        margin: '80px auto',
        padding: '36px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-color)',
        fontFamily: 'var(--font-family)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary-color)' }}>ShareStamps</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            {authMode === 'login' ? t.ownerLoginTitle : t.ownerSignUpTitle}
          </p>
        </div>

        {ownerAuthError && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(255, 69, 58, 0.08)',
            border: '1px solid var(--accent-red)',
            borderRadius: '12px',
            color: 'var(--accent-red)',
            fontSize: '13px',
            fontWeight: 600
          }}>
            ⚠️ {ownerAuthError}
          </div>
        )}

        {authMode === 'login' ? (
          <form onSubmit={handleOwnerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.loginIdLabel}</label>
              <input 
                type="text" 
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={loginIdInput}
                onChange={(e) => setLoginIdInput(e.target.value)}
                placeholder={t.loginIdPlaceholder}
                className="imin-input"
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.password}</label>
              <input 
                type="password" 
                name="password"
                autoComplete="current-password"
                value={loginPwInput}
                onChange={(e) => setLoginPwInput(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="imin-input"
                required
              />
            </div>
            <button type="submit" className="imin-btn imin-btn-primary" style={{ padding: '12px', fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>
              {t.ownerLoginBtn}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOwnerSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.ownerNameLabel}</label>
              <input 
                type="text" 
                name="name"
                autoComplete="name"
                value={signUpNameInput}
                onChange={(e) => setSignUpNameInput(e.target.value)}
                placeholder={t.ownerNamePlaceholder}
                className="imin-input"
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {language === 'ko' ? '매장 검색 및 선택 (관리자 사전 등록된 매장)' : 'Search & Select Store (Pre-registered by Admin)'}
              </label>

              {selectedSignUpStore ? (
                /* 매장이 선택된 상태 */
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 14px', 
                  backgroundColor: 'var(--primary-light)', 
                  border: '1.5px solid var(--primary-color)', 
                  borderRadius: '10px' 
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-color)' }}>
                    🏢 {selectedSignUpStore.name} ({selectedSignUpStore.category.toUpperCase()})
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSignUpStore(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-red)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {language === 'ko' ? '다시 검색' : 'Deselect'}
                  </button>
                </div>
              ) : (
                /* 매장을 검색하는 상태 */
                <>
                  <input 
                    type="text" 
                    value={signUpStoreSearchQuery}
                    onChange={(e) => setSignUpStoreSearchQuery(e.target.value)}
                    placeholder={language === 'ko' ? '가입할 매장 이름을 검색해 주세요...' : 'Search for your store name...'}
                    className="imin-input"
                    style={{ width: '100%', padding: '10px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block', paddingLeft: '2px' }}>
                    {language === 'ko' 
                      ? '💡 검색 예시: 커피하우스, 백종원, 성수동, 이태원, 홍대, 혹은 매장 호점'
                      : '💡 Search examples: Coffee, Baek, Seongsu, Itaewon, Hongdae, or Store'}
                  </span>

                  {/* 검색어 입력 시 매칭 결과 표시 */}
                  {signUpStoreSearchQuery.trim().length > 0 && (() => {
                    const query = signUpStoreSearchQuery.toLowerCase().trim();
                    const matches = stores.filter(s => {
                      // 1. 기본 표시명 매칭
                      let isMatch = s.name.toLowerCase().includes(query);
                      
                      // 2. 한/영 교차 및 부분 문자 매칭 지원 (데모 매장 5종 특화)
                      const crossMap: Record<string, string[]> = {
                        'store_id_1': ['커피하우스 강남점', 'coffee house gangnam', '커피', '강남'],
                        'store_id_2': ['백종원 쌈밥집', "baek's rice & ssambap", '백', '백종원', '쌈밥'],
                        'store_id_3': ['헤어살롱 압구정', 'apgujeong hair salon', '헤어', '압구정'],
                        'store_id_4': ['빠리바게트 서초점', 'paris baguette seocho', '빠리', '서초', '바게트'],
                        'store_id_5': ['올리브영 신사점', 'olive young sinsa', '올리브', '신사']
                      };
                      
                      if (crossMap[s.id]) {
                        isMatch = isMatch || crossMap[s.id].some(term => term.toLowerCase().includes(query));
                      }

                      // 3. 백종원 관련 브랜드 및 '백' 검색에 대한 일반화된 교차 매칭 지원 (새로운 가상/등록 매장 대응)
                      const isBaekStore = s.name.toLowerCase().includes('백') || 
                                          s.name.toLowerCase().includes('baek') || 
                                          s.name.toLowerCase().includes('paik') || 
                                          s.name.toLowerCase().includes('백종원');
                                          
                      const isBaekQuery = query.includes('백') || 
                                          query.includes('baek') || 
                                          query.includes('paik') || 
                                          query.includes('백종원');
                                          
                      if (isBaekStore && isBaekQuery) {
                        isMatch = true;
                      }
                      const hasRegisteredOwner = s.ownerId && s.ownerId !== 'none' && s.ownerId !== '' && users.some(u => u.id === s.ownerId && u.role === 'owner');
                      return isMatch && !hasRegisteredOwner;
                    });

                    return (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                        zIndex: 100,
                        maxHeight: '180px',
                        overflowY: 'auto',
                        marginTop: '4px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        {matches.length > 0 ? (
                          matches.map(store => (
                            <button
                              key={store.id}
                              type="button"
                              onClick={() => {
                                setSelectedSignUpStore(store);
                                setSignUpStoreSearchQuery('');
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 14px',
                                border: 'none',
                                background: 'none',
                                borderBottom: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--background-color)'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <strong style={{ color: 'var(--text-primary)' }}>{store.name}</strong> 
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>({store.category.toUpperCase()})</span>
                            </button>
                          ))
                        ) : (
                          <div style={{ padding: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {language === 'ko' ? '미배정된 매장 중 일치하는 이름이 없습니다.' : 'No matching unassigned stores found.'}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.loginIdLabel}</label>
              <input 
                type="text" 
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={signUpIdInput}
                onChange={(e) => setSignUpIdInput(e.target.value)}
                placeholder={t.loginIdPlaceholder}
                className="imin-input"
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.password}</label>
              <input 
                type="password" 
                name="password"
                autoComplete="new-password"
                value={signUpPwInput}
                onChange={(e) => setSignUpPwInput(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="imin-input"
                required
              />
            </div>
            <button type="submit" className="imin-btn imin-btn-primary" style={{ padding: '12px', fontSize: '14px', fontWeight: 700, marginTop: '8px' }}>
              {t.ownerSignUpBtn}
            </button>
          </form>
        )}

        <button 
          onClick={() => {
            setAuthMode(authMode === 'login' ? 'signup' : 'login');
            setOwnerAuthError(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary-color)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
            marginTop: '4px'
          }}
        >
          {authMode === 'login' ? t.switchToSignUp : t.switchToLogin}
        </button>

        <button 
          onClick={async () => await resetDatabase()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            textDecoration: 'underline',
            cursor: 'pointer',
            textAlign: 'center',
            marginTop: '12px'
          }}
        >
          {language === 'ko' ? '⚙️ 테스트용 DB 완전 초기화 (전체 매장 미배정 상태로 리셋)' : '⚙️ Reset Test DB (All stores unassigned)'}
        </button>
      </div>
    );
  }

  if (currentOwner && currentOwner.status === 'pending_approval') {
    return (
      <div style={{
        maxWidth: '440px',
        margin: '120px auto',
        padding: '36px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        border: '1px solid var(--border-color)',
        fontFamily: 'var(--font-family)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 149, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px'
        }}>
          <Clock size={32} style={{ color: '#FF9500' }} />
        </div>

        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>
            {language === 'ko' ? '가입 승인 대기 중' : 'Pending Approval'}
          </h2>
          <div style={{ 
            marginTop: '12px', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            backgroundColor: 'var(--primary-light)', 
            color: 'var(--primary-color)',
            fontSize: '13px',
            fontWeight: 700,
            display: 'inline-block'
          }}>
            🏪 {selectedStore.name}
          </div>
        </div>

        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0' }}>
          {language === 'ko' 
            ? '가맹점 가입 신청이 완료되었습니다. 관리자(Super Admin)가 승인하면 자동으로 대시보드로 이동합니다.' 
            : 'Store registration request complete. Once the Super Admin approves, this dashboard will load automatically.'}
        </p>

        <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '8px' }}>
          <button 
            onClick={() => {
              setCurrentOwner(null);
            }} 
            className="imin-btn imin-btn-secondary"
            style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 700 }}
          >
            {language === 'ko' ? '로그아웃' : 'Logout'}
          </button>
        </div>
      </div>
    );
  }

  if (printMode) {
    return (
      <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="no-print" style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
          <button onClick={() => setPrintMode(false)} className="imin-btn imin-btn-secondary" style={{ width: 'auto', padding: '10px 20px' }}>
            {t.backToDashboard}
          </button>
          <button onClick={handlePrint} className="imin-btn imin-btn-primary" style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Printer size={18} />
            {t.openPrintDialog}
          </button>
        </div>

        {/* 인쇄용 포스터 컨테이너 */}
        <div style={{
          width: '210mm',
          height: '297mm',
          padding: '25mm',
          border: '12px double var(--primary-color)',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 0 20px rgba(0,0,0,0.1)',
          color: '#1F1F24'
        }}>
          <div>
            <h1 style={{ fontSize: '42px', fontWeight: 900, color: 'var(--primary-color)', marginTop: '20px', letterSpacing: '-1px' }}>ShareStamps</h1>
            <h2 style={{ fontSize: '32px', fontWeight: 700, marginTop: '10px', color: '#333' }}>{t.posterTitle}</h2>
          </div>

          <div style={{ fontSize: '20px', lineHeight: 2.0, margin: '40px 0', fontWeight: 500 }}>
            {t.posterStoreLabel1} <strong style={{ fontSize: '24px', color: 'var(--primary-color)', borderBottom: '2px solid var(--primary-color)', paddingBottom: '2px' }}>{selectedStore.name}</strong>{t.posterStoreLabel2}<br/>
            {t.posterDesc1}<br/>
            {t.posterDesc2}
            
            <div style={{ margin: '50px 0', padding: '24px', backgroundColor: '#F8F9FA', borderRadius: 'var(--border-radius-lg)', border: '1px solid #E5E5EA' }}>
              <p style={{ fontSize: '22px', margin: '10px 0' }}>
                {t.posterStampsLabel} <strong style={{ color: 'var(--accent-green)', fontSize: '28px' }}>{t.historyQty(totalDonatedStamps)}</strong>
              </p>
              <p style={{ fontSize: '22px', margin: '10px 0' }}>
                {t.posterCashLabel} <strong style={{ color: 'var(--accent-green)', fontSize: '28px' }}>${totalDonatedValue.toFixed(2)}</strong>
              </p>
            </div>

            {t.posterFootnote1}<br/>
            {t.posterFootnote2}
          </div>

          <div style={{ marginBottom: '30px' }}>
            <p style={{ fontSize: '16px', color: '#8E8E93' }}>
              {t.posterIssuer}
            </p>
            <p style={{ fontSize: '15px', color: '#AEAEB2', marginTop: '4px' }}>
              {t.posterDate(new Date().toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 현재 선택된 매장 정보 카드 (멀티 매장 지원) */}
      <div 
        className="imin-card" 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          gap: '20px',
          padding: '24px 32px',
          background: 'linear-gradient(135deg, #f5f5fa 0%, #ffffff 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block' }}>
            {language === 'ko' ? '현재 관리 매장' : 'Current Active Store'}
          </span>
          <h1 
            onClick={() => {
              setClickCount(prev => {
                const next = prev + 1;
                if (next >= 3) {
                  window.dispatchEvent(new CustomEvent('open-store-settings'));
                  return 0;
                }
                return next;
              });
            }}
            style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary-color)', marginTop: '4px', letterSpacing: '-0.5px', cursor: 'pointer', userSelect: 'none' }}
            title={language === 'ko' ? '비밀번호를 바꾼 후 이곳을 3번 누르면 설정 창이 뜹니다.' : 'Triple click here to open settings.'}
          >
            {selectedStore.name}
          </h1>
          <span style={{ display: 'inline-block', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', fontWeight: 700, marginTop: '6px' }}>
            {selectedStore.category.toUpperCase()}
          </span>
        </div>

        {/* 매장 조작 및 드롭다운 선택 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', minWidth: '240px' }}>
          
          {/* 포스터 인쇄 및 로그아웃 버튼 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button"
              onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
              className="imin-btn imin-btn-secondary"
              style={{ 
                width: 'auto', 
                padding: '8px 16px', 
                fontSize: '13px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '8px'
              }}
            >
              <Globe size={15} />
              {language === 'ko' ? 'English (EN)' : '한국어 (KO)'}
            </button>

            <button 
              onClick={() => {
                window.location.hash = '#/kiosk';
              }} 
              className="imin-btn imin-btn-secondary"
              style={{ 
                width: 'auto', 
                padding: '8px 16px', 
                fontSize: '13px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '8px'
              }}
            >
              <Tablet size={15} />
              {language === 'ko' ? 'QR 스캔 모드 전환' : 'Switch to QR Scan'}
            </button>

            <button 
              onClick={() => {
                setCurrentOwner(null);
              }} 
              className="imin-btn"
              style={{ 
                width: 'auto', 
                padding: '8px 16px', 
                fontSize: '13px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--accent-red)',
                color: 'var(--accent-red)',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: '8px'
              }}
            >
              <LogOut size={15} />
              {t.logout}
            </button>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>
              {language === 'ko' ? '매장 선택 (멀티 매장)' : 'Switch Store (Multi-Store)'}
            </label>
            <select 
              value={selectedStoreId} 
              onChange={(e) => { setSelectedStoreId(e.target.value); }}
              style={{ 
                width: '100%',
                padding: '10px 14px', 
                borderRadius: '8px', 
                border: '2px solid var(--primary-color)', 
                outline: 'none', 
                fontSize: '14px', 
                fontWeight: 700, 
                cursor: 'pointer', 
                backgroundColor: '#ffffff',
                color: 'var(--primary-color)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}
            >
              {stores.filter(s => s.ownerId === currentOwner.id).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="imin-card no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => handleTabClick('home')}
            className={`imin-chip ${activeSubTab === 'home' ? 'active' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {t.tabOverview}
          </button>
          <button 
            onClick={() => handleTabClick('customers')}
            className={`imin-chip ${activeSubTab === 'customers' ? 'active' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {t.tabCustomer}
          </button>
          <button 
            onClick={() => handleTabClick('analytics')}
            className={`imin-chip ${activeSubTab === 'analytics' ? 'active' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {t.tabSettlement}
          </button>
          <button 
            onClick={() => handleTabClick('minihome')}
            className={`imin-chip ${activeSubTab === 'minihome' ? 'active' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            {t.tabMiniHome}
          </button>
        </div>

        {isTabsUnlocked && (activeSubTab === 'customers' || activeSubTab === 'analytics') && (
          <button
            onClick={() => {
              setIsTabsUnlocked(false);
              setDashboardPasswordInput('');
              setDashboardPasswordError(null);
            }}
            className="imin-btn"
            style={{
              width: 'auto',
              padding: '8px 16px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              border: '1.5px solid var(--accent-red)',
              color: 'var(--accent-red)',
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: '8px'
            }}
          >
            {t.lockNow}
          </button>
        )}
      </div>

      {activeSubTab === 'home' && (
        <>
          {/* 지표 대시보드 3대 지표 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
            {/* 기부 횟수 및 액수 */}
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(255, 69, 58, 0.08)', color: 'var(--accent-red)' }}>
                <Heart size={28} />
              </div>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.metricWeeklyDonation}</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--accent-red)' }}>
                  ${totalDonatedValue.toFixed(2)} <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>({t.historyQty(totalDonatedStamps)})</span>
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.metricDonationCount(totalDonationCount)}</span>
              </div>
            </div>

            {/* Lucky 7 달성 고객 */}
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--accent-green)' }}>
                <Award size={28} />
              </div>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.metricLucky7}</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--accent-green)' }}>
                  {totalLucky7Achieved}{language === 'ko' ? '회' : ''} <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>{t.metricLucky7Redeemed}</span>
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.metricLucky7Payout(totalLucky7Achieved * selectedStore.pointRewardPer7Stamps)}</span>
              </div>
            </div>

            {/* 공유로 들어온 고객 */}
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(10, 132, 255, 0.08)', color: 'var(--accent-blue)' }}>
                <Users size={28} />
              </div>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.metricViralNew}</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--accent-blue)' }}>
                  {newCustomersCount}{language === 'ko' ? '명' : ''} <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' }}>{language === 'ko' ? '가입' : 'Joined'}</span>
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.metricViralDesc}</span>
              </div>
            </div>

            {/* 기프트 카드 매출 */}
            {(() => {
              const storeGiftCards = giftCards.filter(gc => gc.storeId === selectedStoreId);
              const totalGiftSales = storeGiftCards.reduce((sum, gc) => sum + gc.initialAmount, 0);
              const isStripeConnected = selectedStore?.stripeConnected || false;

              return (
                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(52, 199, 89, 0.08)', color: 'var(--accent-green)' }}>
                    <CreditCard size={28} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {language === 'ko' ? '기프트 카드 누적 매출' : 'Gift Card Total Sales'}
                    </span>
                    <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--accent-green)' }}>
                      ${totalGiftSales.toFixed(2)}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ 
                        fontSize: '10px', 
                        padding: '2px 6px', 
                        borderRadius: '10px', 
                        fontWeight: 700,
                        backgroundColor: isStripeConnected ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
                        color: isStripeConnected ? 'var(--accent-green)' : 'var(--accent-red)'
                      }}>
                        {isStripeConnected 
                          ? (language === 'ko' ? '스트라이프 연동됨' : 'Stripe Connected')
                          : (language === 'ko' ? '스트라이프 미연동' : 'Stripe Disconnected')}
                      </span>
                      {!isStripeConnected && (
                        <button 
                          onClick={() => registerStripeConnect(selectedStoreId)}
                          style={{
                            fontSize: '10px',
                            backgroundColor: 'var(--accent-red)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          {language === 'ko' ? '연동하기' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>

      {/* 하단 패널: 실시간 캐시 승인 및 포스 할인 대기열, 대기시간 설정 & 기부금 정산 원리 안내 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        
        {/* 실시간 캐시 승인 및 포스 할인 대기열 패널 */}
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Clock size={22} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{t.queueTitle}</h3>
          </div>

          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {t.queueDesc}
          </div>

          {/* 대기 중인 요청 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t.queuePending(pendingRequests.length)}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
              {pendingRequests.length > 0 ? (
                pendingRequests.map(req => (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '12px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{req.userName.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')}</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>({req.userNickname})</span>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary-color)', marginTop: '2px' }}>
                        ${req.amount.toFixed(2)} {req.type === 'donation' ? (language === 'ko' ? '(기부)' : '(Donation)') : (language === 'ko' ? '(할인)' : '(Discount)')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => rejectPayment(req.id)}
                        className="imin-btn"
                        style={{ padding: '6px 10px', fontSize: '11px', backgroundColor: 'transparent', border: '1.5px solid var(--accent-red)', color: 'var(--accent-red)', width: 'auto', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        {t.reject}
                      </button>
                      <button 
                        onClick={() => {
                          const defaultMsg = req.type === 'donation'
                            ? (language === 'ko' 
                                ? `${req.nonProfitName || 'NPO'} 기부가 승인되었습니다. 따뜻한 후원에 감사드립니다.` 
                                : `Donation to ${req.nonProfitName || 'NPO'} has been approved. Thank you for your support.`)
                            : (language === 'ko'
                                ? `스탬프 캐시 ${req.amount}달러 결제가 승인되었습니다. 이용해 주셔서 감사합니다!`
                                : `Stamp cash payment of ${req.amount} dollars has been approved. Thank you!`);

                          const msg = prompt(
                            language === 'ko' ? '고객에게 보낼 감사 메시지를 작성해 주세요:' : 'Enter thank you message to customer:',
                            defaultMsg
                          );
                          if (msg === null) return;
                          approvePayment(req.id, msg);
                          if (req.type === 'payment') {
                            setShowPosDiscountModal(req);
                          }
                        }}
                        className="imin-btn imin-btn-primary"
                        style={{ padding: '6px 12px', fontSize: '11px', width: 'auto', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        {t.approve}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                  {t.queueEmpty}
                </div>
              )}
            </div>
          </div>

          {/* 최근 처리 완료된 요청 (최근 5건) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t.queueRecent}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
              {resolvedRequests.length > 0 ? (
                resolvedRequests.map(req => (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)', opacity: 0.85 }}>
                    <div style={{ fontSize: '12px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{req.userName.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')}</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>({req.userNickname})</span>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: req.status === 'approved' ? 'var(--accent-green)' : 'var(--accent-red)', marginTop: '2px' }}>
                        ${req.amount.toFixed(2)} {req.type === 'donation' ? (language === 'ko' ? '(기부)' : '(Donation)') : (language === 'ko' ? '(할인)' : '(Discount)')} - {req.status === 'approved' ? t.approvedStatus : t.rejectedStatus}
                      </div>
                    </div>
                    {req.status === 'approved' && req.type === 'payment' && (
                      <button
                        onClick={() => setShowPosDiscountModal(req)}
                        className="imin-btn"
                        style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: 'transparent', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', width: 'auto', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        {t.discountGuide}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '8px 0' }}>
                  {t.recentEmpty}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 계산대 결제 시뮬레이션 패널 (POS Split Checkout) */}
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <CreditCard size={22} style={{ color: 'var(--accent-green)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
              {language === 'ko' ? '계산대 결제 시뮬레이터 (원스캔)' : 'POS Split Checkout Simulator'}
            </h3>
          </div>

          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)', textAlign: 'left' }}>
            {language === 'ko' 
              ? '고객의 회원식별 정보(바코드/전화번호)를 바탕으로 스탬프 캐시와 기프트 카드를 조합하여 1회 스캔 분할 결제를 진행합니다.' 
              : 'Performs single-scan split deduction using points and gift card balances.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 고객 선택 */}
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {language === 'ko' ? '결제 고객' : 'Customer'}
              </label>
              <select
                value={posCustomerPhone}
                onChange={e => {
                  setPosCustomerPhone(e.target.value);
                  setPosCheckoutResult(null);
                }}
                className="imin-input"
                style={{ marginTop: '6px', padding: '8px', cursor: 'pointer', fontSize: '13px' }}
              >
                {users.filter(u => u.role === 'customer' && u.status !== 'deleted').map(u => (
                  <option key={u.id} value={u.phoneNumber}>
                    {u.name} - {u.phoneNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* 청구 금액 */}
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {language === 'ko' ? '청구 금액 ($)' : 'Total Bill Amount ($)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={posBillAmount}
                onChange={e => {
                  setPosBillAmount(e.target.value);
                  setPosCheckoutResult(null);
                }}
                className="imin-input"
                style={{ marginTop: '6px', padding: '8px' }}
              />
            </div>

            {/* 체크박스 옵션 */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={posUseStamps}
                  onChange={e => {
                    setPosUseStamps(e.target.checked);
                    setPosCheckoutResult(null);
                  }}
                />
                {language === 'ko' ? '스탬프 캐시 우선 사용' : 'Use Points first'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={posUseGift}
                  onChange={e => {
                    setPosUseGift(e.target.checked);
                    setPosCheckoutResult(null);
                  }}
                />
                {language === 'ko' ? '기프트 카드 사용' : 'Use Gift Cards'}
              </label>
            </div>

            {/* 결제 실행 버튼 */}
            <button
              onClick={() => {
                const targetCustomer = users.find(u => u.phoneNumber === posCustomerPhone);
                if (!targetCustomer) return;
                
                try {
                  const billVal = parseFloat(posBillAmount);
                  if (isNaN(billVal) || billVal <= 0) {
                    alert(language === 'ko' ? '올바른 금액을 입력하세요.' : 'Please enter a valid bill amount.');
                    return;
                  }
                  
                  const res = processSplitPayment(
                    targetCustomer.id,
                    selectedStoreId,
                    billVal,
                    posUseStamps,
                    posUseGift
                  );
                  
                  if (res.success) {
                    setPosCheckoutResult({
                      summary: res.summary,
                      remaining: res.remaining
                    });
                  }
                } catch (err: any) {
                  alert(err.message);
                }
              }}
              className="imin-btn imin-btn-primary"
              style={{ padding: '10px', backgroundColor: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}
            >
              {language === 'ko' ? '⚡ 원스캔 결제 승인' : '⚡ Approve Split Payment'}
            </button>

            {/* 결제 결과 요약 배지 */}
            {posCheckoutResult && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(52, 199, 89, 0.08)',
                border: '1px solid rgba(52, 199, 89, 0.2)',
                textAlign: 'left',
                fontSize: '12.5px',
                lineHeight: 1.4
              }}>
                <strong style={{ color: 'var(--accent-green)', display: 'block', marginBottom: '4px' }}>
                  {language === 'ko' ? '결제 결과' : 'Payment Status'}
                </strong>
                {posCheckoutResult.summary}
                {posCheckoutResult.remaining > 0 && (
                  <div style={{ marginTop: '6px', padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(255, 69, 58, 0.08)', color: 'var(--accent-red)', fontWeight: 700 }}>
                    ⚠️ {language === 'ko' ? `남은 차액 $${posCheckoutResult.remaining.toFixed(2)}를 카드 단말기나 현금으로 결제받으세요.` : `Collect $${posCheckoutResult.remaining.toFixed(2)} externally.`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>



        {/* 7개 완성 시 보상 캐시 설정 카드 */}
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Award size={22} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
              {language === 'ko' ? '7개 완성 시 보상 캐시 설정' : '7-Stamp Reward Settings'}
            </h3>
          </div>

          <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {language === 'ko' 
              ? '고객이 스탬프 7개를 모두 모아 완성판을 달성했을 때 지급되는 스탬프 캐시 보상 금액을 수정합니다.' 
              : 'Modify the stamp cash reward amount credited to customers upon completing all 7 stamps.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {language === 'ko' ? '보상 금액 설정 ($)' : 'Reward Amount ($)'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, backgroundColor: 'var(--background-color)', border: '1.5px solid var(--border-color)', borderRadius: '12px', padding: '10px 14px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-secondary)' }}>$</span>
                <input 
                  type="text"
                  value={tempRewardAmount}
                  onChange={(e) => {
                    setTempRewardAmount(e.target.value);
                  }}
                  className="imin-input"
                  style={{ 
                    flex: 1, 
                    border: 'none',
                    outline: 'none',
                    fontSize: '16px', 
                    fontWeight: 800, 
                    color: 'var(--primary-color)',
                    backgroundColor: 'transparent',
                    padding: 0
                  }}
                  placeholder="5.00"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(tempRewardAmount);
                  if (isNaN(val) || val <= 0) {
                    alert(language === 'ko' ? '올바른 양수 금액을 입력해 주세요.' : 'Please enter a valid positive amount.');
                    return;
                  }
                  setRewardConfirmError(null);
                  setRewardConfirmPassword('');
                  setShowRewardConfirmModal(true);
                }}
                className="imin-btn imin-btn-primary"
                style={{
                  width: 'auto',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
              >
                {language === 'ko' ? '변경' : 'Change'}
              </button>
            </div>
          </div>

          <div style={{ 
            marginTop: '10px', 
            padding: '12px', 
            borderRadius: 'var(--border-radius-md)', 
            backgroundColor: 'var(--primary-light)', 
            color: 'var(--primary-color)', 
            fontSize: '13px', 
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {language === 'ko' 
              ? `현재 설정: 7개 완성 시 $${selectedStore.pointRewardPer7Stamps.toFixed(2)} 지급 (도장 1개당 $${(selectedStore.pointRewardPer7Stamps / 7).toFixed(2)} 환산 가치)`
              : `Current reward: $${selectedStore.pointRewardPer7Stamps.toFixed(2)} per 7 stamps ($${(selectedStore.pointRewardPer7Stamps / 7).toFixed(2)} equivalent per stamp)`}
          </div>
        </div>


        {/* 재적립 대기 시간 설정 카드 */}
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Clock size={22} style={{ color: 'var(--primary-color)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{t.intervalTitle}</h3>
          </div>

          <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {t.intervalDesc}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.intervalSelect}</label>
            <select 
              value={selectedStore.earningIntervalMinutes}
              onChange={(e) => updateStoreInterval(selectedStoreId, parseInt(e.target.value, 10))}
              style={{ width: '100%', padding: '10px 4px', border: 'none', borderBottom: '2px solid var(--border-color)', outline: 'none', fontSize: '15px', fontWeight: 600, backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              {[0, 1, 5, 10, 30, 60, 120, 180, 360, 720, 1440].map((mins) => (
                <option key={mins} value={mins}>
                  {formatInterval(mins, language)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ 
            marginTop: '10px', 
            padding: '12px', 
            borderRadius: 'var(--border-radius-md)', 
            backgroundColor: 'var(--primary-light)', 
            color: 'var(--primary-color)', 
            fontSize: '13px', 
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {t.intervalCurrent(formatInterval(selectedStore.earningIntervalMinutes, language))}
          </div>
        </div>

        {/* 기부금 정산 시스템 원리 가이드 */}
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', color: 'var(--primary-color)' }}>
            {t.settleGuideTitle}
          </h3>
          <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p>
              {t.settleGuideP1}
            </p>
            <p>
              {t.settleGuideP2(selectedStore.pointRewardPer7Stamps, selectedStore.pointRewardPer7Stamps / 7)}
            </p>
            <p>
              {t.settleGuideP3}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <span>{t.settleGuideP4}</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>

      </div>
      </>
      )}

      {activeSubTab === 'minihome' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 4px 40px 4px' }}>
          
          {/* 1. 기본 정보 수정 카드 */}
          <div className="imin-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', color: 'var(--text-primary)', textAlign: 'left' }}>
              🏠 {language === 'ko' ? '미니홈피 기본 정보 설정' : 'Mini-Home General Settings'}
            </h3>
            
            {uploadError && (
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', borderRadius: '8px', color: 'var(--accent-red)', fontSize: '12px', textAlign: 'left', marginBottom: '12px' }}>
                ⚠️ {uploadError}
              </div>
            )}
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              
              // 기존 이미지 주소 백업
              const oldThumbnail = selectedStore.thumbnailUrl;
              const oldBanner = selectedStore.bannerUrl;
              
              const newThumbnail = thumbnailUrl;
              const newBanner = bannerUrl;

              updateStoreMiniHome(selectedStoreId, {
                description: formData.get('description') as string,
                address: formData.get('address') as string,
                phone: formData.get('phone') as string,
                hours: formData.get('hours') as string,
                thumbnailUrl: newThumbnail,
                bannerUrl: newBanner,
              });

              // 기존에 스토리지에 저장되어 있던 이미지가 변경 또는 제거되었다면 파일 삭제 처리
              if (oldThumbnail && oldThumbnail !== newThumbnail) {
                await deleteImageFromStorage(oldThumbnail);
              }
              if (oldBanner && oldBanner !== newBanner) {
                await deleteImageFromStorage(oldBanner);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                  <label className="imin-input-label">{language === 'ko' ? '매장 썸네일 이미지' : 'Store Thumbnail'}</label>
                  
                  {/* Preview & Upload Area */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '12px', 
                    padding: '12px', 
                    border: '1px dashed var(--border-color)', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    minHeight: '146px',
                    boxSizing: 'border-box',
                    flex: 1
                  }}>
                    {thumbnailUrl ? (
                      <div style={{ 
                        width: '100%', 
                        aspectRatio: '16/5', 
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          borderRadius: '50%',
                          border: '1px solid var(--border-color)',
                          overflow: 'hidden',
                          backgroundColor: '#f4f4f5'
                        }}>
                          <img src={thumbnailUrl} alt="Thumbnail Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setThumbnailUrl('')}
                          style={{
                            position: 'absolute',
                            top: '0px',
                            right: '6px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        aspectRatio: '16/5', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          borderRadius: '50%',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#f4f4f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <ImageIcon size={28} style={{ color: '#a1a1aa' }} />
                        </div>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {language === 'ko' ? '권장 크기: 400x400 (1:1 비율)' : 'Recommended: 400x400 (1:1 ratio)'}
                      </span>
                      <label className="imin-btn imin-btn-outline" style={{ 
                        padding: '6px 12px', 
                        fontSize: '12px', 
                        cursor: isUploadingThumbnail ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        margin: 0
                      }}>
                        {isUploadingThumbnail ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>{language === 'ko' ? '업로드 중...' : 'Uploading...'}</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            <span>{language === 'ko' ? '사진 업로드' : 'Upload Photo'}</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={isUploadingThumbnail}
                          onChange={(e) => handleImageUpload(e, 'thumbnail')}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                  <label className="imin-input-label">{language === 'ko' ? '매장 대표 배너 이미지' : 'Store Banner'}</label>
                  
                  {/* Preview & Upload Area */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '12px', 
                    padding: '12px', 
                    border: '1px dashed var(--border-color)', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    minHeight: '146px',
                    boxSizing: 'border-box',
                    flex: 1
                  }}>
                    {bannerUrl ? (
                      <div style={{ 
                        width: '100%', 
                        aspectRatio: '16/5', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)', 
                        overflow: 'hidden', 
                        backgroundColor: '#f4f4f5',
                        position: 'relative'
                      }}>
                        <img src={bannerUrl} alt="Banner Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button 
                          type="button" 
                          onClick={() => setBannerUrl('')}
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        aspectRatio: '16/5', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)', 
                        backgroundColor: '#f4f4f5',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center'
                      }}>
                        <ImageIcon size={28} style={{ color: '#a1a1aa' }} />
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {language === 'ko' ? '권장 비율: 16:5 와이드' : 'Recommended ratio: 16:5 wide'}
                      </span>
                      <label className="imin-btn imin-btn-outline" style={{ 
                        padding: '6px 12px', 
                        fontSize: '12px', 
                        cursor: isUploadingBanner ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        margin: 0
                      }}>
                        {isUploadingBanner ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>{language === 'ko' ? '업로드 중...' : 'Uploading...'}</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} />
                            <span>{language === 'ko' ? '배너 업로드' : 'Upload Banner'}</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={isUploadingBanner}
                          onChange={(e) => handleImageUpload(e, 'banner')}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <label className="imin-input-label">{language === 'ko' ? '매장 한 줄 소개' : 'Store Description'}</label>
                <textarea 
                  name="description"
                  defaultValue={selectedStore.description || ''} 
                  className="imin-input" 
                  rows={2}
                  placeholder={language === 'ko' ? '매장 소개 글을 써주세요.' : 'Enter store description.'}
                  style={{ marginTop: '6px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ textAlign: 'left' }}>
                  <label className="imin-input-label">{language === 'ko' ? '매장 연락처' : 'Phone Number'}</label>
                  <input 
                    name="phone"
                    defaultValue={selectedStore.phone || ''} 
                    className="imin-input" 
                    placeholder="02-123-4567"
                    style={{ marginTop: '6px' }}
                  />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <label className="imin-input-label">{language === 'ko' ? '매장 영업 시간' : 'Business Hours'}</label>
                  <input 
                    name="hours"
                    defaultValue={selectedStore.hours || ''} 
                    className="imin-input" 
                    placeholder="09:00 ~ 21:00"
                    style={{ marginTop: '6px' }}
                  />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <label className="imin-input-label">{language === 'ko' ? '매장 상세 주소' : 'Store Address'}</label>
                  <input 
                    name="address"
                    defaultValue={selectedStore.address || ''} 
                    className="imin-input" 
                    placeholder={language === 'ko' ? '강남구 역삼동...' : 'Store address'}
                    style={{ marginTop: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="imin-btn imin-btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                  {language === 'ko' ? '저장하기' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* 2. 메뉴 편집 카드 */}
          <div className="imin-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', color: 'var(--text-primary)', textAlign: 'left' }}>
              🍽️ {language === 'ko' ? '대표 메뉴 관리' : 'Manage Signature Menu'}
            </h3>
            
            {/* 메뉴 등록 폼 */}
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('menuName') as string;
              const price = parseFloat(formData.get('menuPrice') as string);
              const desc = formData.get('menuDesc') as string;
              
              if (!name || isNaN(price)) return;
              
              const currentMenu = selectedStore.menuItems || [];
              const updatedMenu = [...currentMenu, { name, price, description: desc }];
              
              updateStoreMiniHome(selectedStoreId, { menuItems: updatedMenu });
              e.currentTarget.reset();
            }} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px', backgroundColor: 'var(--background-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ flex: 2, textAlign: 'left' }}>
                <label className="imin-input-label" style={{ fontSize: '11px' }}>{language === 'ko' ? '메뉴 이름' : 'Menu Item Name'}</label>
                <input name="menuName" className="imin-input" placeholder={language === 'ko' ? '예: 아메리카노' : 'e.g. Latte'} style={{ marginTop: '4px', height: '36px' }} required />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <label className="imin-input-label" style={{ fontSize: '11px' }}>{language === 'ko' ? '가격 ($)' : 'Price ($)'}</label>
                <input name="menuPrice" type="number" step="0.01" className="imin-input" placeholder="4.50" style={{ marginTop: '4px', height: '36px' }} required />
              </div>
              <div style={{ flex: 2, textAlign: 'left' }}>
                <label className="imin-input-label" style={{ fontSize: '11px' }}>{language === 'ko' ? '상세 설명 (선택)' : 'Description (Optional)'}</label>
                <input name="menuDesc" className="imin-input" placeholder={language === 'ko' ? '예: 아이스 가능' : 'Details'} style={{ marginTop: '4px', height: '36px' }} />
              </div>
              <button type="submit" className="imin-btn imin-btn-primary" style={{ width: 'auto', padding: '0 20px', height: '36px', fontSize: '13px', fontWeight: 800 }}>
                {language === 'ko' ? '추가' : 'Add'}
              </button>
            </form>

            {/* 메뉴 목록 리스트 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedStore.menuItems && selectedStore.menuItems.length > 0 ? (
                selectedStore.menuItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</span>
                      {item.description && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>{item.description}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--primary-color)' }}>
                        ${item.price.toFixed(2)}
                      </span>
                      <button 
                        onClick={() => {
                          const updatedMenu = (selectedStore.menuItems || []).filter((_, i) => i !== idx);
                          updateStoreMiniHome(selectedStoreId, { menuItems: updatedMenu });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-red)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {language === 'ko' ? '삭제' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '20px 0' }}>
                  {language === 'ko' ? '등록된 대표 메뉴가 없습니다. 위의 폼에서 추가해 주세요.' : 'No signature menu items registered.'}
                </div>
              )}
            </div>
          </div>

          {/* 2.5. SNS 자동 연동 관리 */}
          <div className="imin-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', color: 'var(--text-primary)', textAlign: 'left' }}>
              🔗 {language === 'ko' ? 'SNS 자동 배포 및 크로스 포스팅 관리' : 'SNS Auto-Posting & Cross-Posting'}
            </h3>
            
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'left', lineHeight: 1.45, margin: '0 0 16px 0' }}>
              {language === 'ko' 
                ? '고객이 AI로 작성한 콘텐츠를 매장의 공식 SNS 채널에 자동으로 동시 게시합니다. 활성화할 플랫폼을 선택해 주세요.' 
                : 'Automatically cross-post customer AI reviews to your official social media channels. Select platforms to enable.'}
            </p>

            {/* SNS 채널 연동 토글 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {[
                { key: 'facebookEnabled', label: 'Facebook Feed', icon: '🔵' },
                { key: 'instagramEnabled', label: 'Instagram Reels', icon: '📸' },
                { key: 'threadsEnabled', label: 'Threads Feed', icon: '💬' },
                { key: 'linkedinEnabled', label: 'LinkedIn Post', icon: '💼' },
                { key: 'youtubeEnabled', label: 'YouTube Shorts', icon: '🔴' },
                { key: 'tiktokEnabled', label: 'TikTok Video', icon: '🎵' },
                { key: 'googleEnabled', label: 'Google Business', icon: '🏢' }
              ].map(platform => {
                const isEnabled = selectedStore.snsSettings?.[platform.key as keyof typeof selectedStore.snsSettings] ?? false;
                return (
                  <div 
                    key={platform.key}
                    style={{ 
                      padding: '12px', 
                      borderRadius: '10px', 
                      backgroundColor: isEnabled ? 'rgba(95, 92, 230, 0.05)' : 'var(--background-color)',
                      border: `1.5px solid ${isEnabled ? 'var(--primary-color)' : 'var(--border-color)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => {
                      const currentSettings = selectedStore.snsSettings || {
                        facebookEnabled: true,
                        instagramEnabled: true,
                        threadsEnabled: true,
                        linkedinEnabled: false,
                        youtubeEnabled: false,
                        tiktokEnabled: true,
                        googleEnabled: true
                      };
                      const updatedSettings = {
                        ...currentSettings,
                        [platform.key]: !isEnabled
                      };
                      updateStoreMiniHome(selectedStoreId, { snsSettings: updatedSettings });
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>{platform.icon}</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>{platform.label}</span>
                    </div>
                    <div style={{ 
                      width: '32px', 
                      height: '18px', 
                      borderRadius: '9px', 
                      backgroundColor: isEnabled ? '#34C759' : '#D1D1D6',
                      position: 'relative',
                      transition: 'background-color 0.2s'
                    }}>
                      <div style={{ 
                        width: '14px', 
                        height: '14px', 
                        borderRadius: '50%', 
                        backgroundColor: '#FFFFFF',
                        position: 'absolute',
                        top: '2px',
                        left: isEnabled ? '16px' : '2px',
                        transition: 'left 0.2s'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ⚙️ 자동 배포 채널 상세 설정 */}
            <div style={{ 
              backgroundColor: '#f8fafc', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid var(--border-color)', 
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚙️ {language === 'ko' ? '자동 배포 및 크로스 포스팅 상세 설정' : 'Detailed Auto-Posting & Connection Settings'}
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Google Business Profile 설정 */}
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '14px', 
                  borderRadius: '10px', 
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  opacity: selectedStore.snsSettings?.googleEnabled ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🏢 Google Business Profile
                    </span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      color: selectedStore.snsConfig?.googleConnected ? '#34C759' : '#8e8e93',
                      backgroundColor: selectedStore.snsConfig?.googleConnected ? 'rgba(52,199,89,0.1)' : 'rgba(142,142,147,0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {selectedStore.snsConfig?.googleConnected 
                        ? (language === 'ko' ? '● 연동됨' : '● Connected') 
                        : (language === 'ko' ? '○ 미연동' : '○ Not Connected')}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {language === 'ko' ? '구글 플레이스 ID (Place ID)' : 'Google Place ID'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="ChIJ3Ry... (Place ID)" 
                      value={selectedStore.snsConfig?.googlePlaceId || ''}
                      disabled={!selectedStore.snsSettings?.googleEnabled}
                      onChange={(e) => {
                        const config = selectedStore.snsConfig || {};
                        updateStoreMiniHome(selectedStoreId, {
                          snsConfig: { ...config, googlePlaceId: e.target.value }
                        });
                      }}
                      className="imin-input"
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {language === 'ko' ? '리뷰 작성 다이렉트 링크' : 'Direct Review URL'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="https://g.page/r/..." 
                      value={selectedStore.snsConfig?.googleReviewUrl || ''}
                      disabled={!selectedStore.snsSettings?.googleEnabled}
                      onChange={(e) => {
                        const config = selectedStore.snsConfig || {};
                        updateStoreMiniHome(selectedStoreId, {
                          snsConfig: { ...config, googleReviewUrl: e.target.value }
                        });
                      }}
                      className="imin-input"
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                    />
                  </div>
                  
                  <button
                    type="button"
                    disabled={!selectedStore.snsSettings?.googleEnabled}
                    onClick={() => {
                      const config = selectedStore.snsConfig || {};
                      const isConnected = !config.googleConnected;
                      updateStoreMiniHome(selectedStoreId, {
                        snsConfig: { 
                          ...config, 
                          googleConnected: isConnected,
                          // 임시 연동 정보 채워주기
                          googlePlaceId: isConnected ? (config.googlePlaceId || 'ChIJs8_8M62pfDURP_KqWc516mY') : '',
                          googleReviewUrl: isConnected ? (config.googleReviewUrl || 'https://search.google.com/local/writereview?placeid=ChIJs8_8M62pfDURP_KqWc516mY') : ''
                        }
                      });
                    }}
                    className="imin-btn"
                    style={{ 
                      fontSize: '11px', 
                      padding: '6px 10px', 
                      marginTop: '4px',
                      backgroundColor: selectedStore.snsConfig?.googleConnected ? 'rgba(255, 59, 48, 0.08)' : 'var(--primary-color)',
                      color: selectedStore.snsConfig?.googleConnected ? 'var(--accent-red)' : 'white',
                      border: selectedStore.snsConfig?.googleConnected ? '1px solid rgba(255,59,48,0.2)' : 'none'
                    }}
                  >
                    {selectedStore.snsConfig?.googleConnected 
                      ? (language === 'ko' ? '구글 계정 연동 해제' : 'Disconnect Google Account') 
                      : (language === 'ko' ? '구글 계정 연동하기' : 'Connect Google Account')}
                  </button>
                </div>

                {/* Facebook / Instagram 설정 */}
                <div style={{ 
                  backgroundColor: 'white', 
                  padding: '14px', 
                  borderRadius: '10px', 
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  opacity: (selectedStore.snsSettings?.facebookEnabled || selectedStore.snsSettings?.instagramEnabled) ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      🔵 Meta (Facebook / IG)
                    </span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      color: selectedStore.snsConfig?.facebookConnected ? '#34C759' : '#8e8e93',
                      backgroundColor: selectedStore.snsConfig?.facebookConnected ? 'rgba(52,199,89,0.1)' : 'rgba(142,142,147,0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {selectedStore.snsConfig?.facebookConnected 
                        ? (language === 'ko' ? '● 연동됨' : '● Connected') 
                        : (language === 'ko' ? '○ 미연동' : '○ Not Connected')}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {language === 'ko' ? '연동할 페이스북 페이지 ID' : 'Facebook Page ID'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="102948... (Page ID)" 
                      value={selectedStore.snsConfig?.facebookPageId || ''}
                      disabled={!(selectedStore.snsSettings?.facebookEnabled || selectedStore.snsSettings?.instagramEnabled)}
                      onChange={(e) => {
                        const config = selectedStore.snsConfig || {};
                        updateStoreMiniHome(selectedStoreId, {
                          snsConfig: { ...config, facebookPageId: e.target.value }
                        });
                      }}
                      className="imin-input"
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {language === 'ko' ? '페이스북 페이지 이름' : 'Facebook Page Name'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="My Store Official" 
                      value={selectedStore.snsConfig?.facebookPageName || ''}
                      disabled={!(selectedStore.snsSettings?.facebookEnabled || selectedStore.snsSettings?.instagramEnabled)}
                      onChange={(e) => {
                        const config = selectedStore.snsConfig || {};
                        updateStoreMiniHome(selectedStoreId, {
                          snsConfig: { ...config, facebookPageName: e.target.value }
                        });
                      }}
                      className="imin-input"
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                    />
                  </div>
                  
                  <button
                    type="button"
                    disabled={!(selectedStore.snsSettings?.facebookEnabled || selectedStore.snsSettings?.instagramEnabled)}
                    onClick={() => {
                      const config = selectedStore.snsConfig || {};
                      const isConnected = !config.facebookConnected;
                      updateStoreMiniHome(selectedStoreId, {
                        snsConfig: { 
                          ...config, 
                          facebookConnected: isConnected,
                          // 임시 연동 정보 채워주기
                          facebookPageId: isConnected ? (config.facebookPageId || '1048291058291') : '',
                          facebookPageName: isConnected ? (config.facebookPageName || selectedStore.name) : ''
                        }
                      });
                    }}
                    className="imin-btn"
                    style={{ 
                      fontSize: '11px', 
                      padding: '6px 10px', 
                      marginTop: '4px',
                      backgroundColor: selectedStore.snsConfig?.facebookConnected ? 'rgba(255, 59, 48, 0.08)' : 'var(--primary-color)',
                      color: selectedStore.snsConfig?.facebookConnected ? 'var(--accent-red)' : 'white',
                      border: selectedStore.snsConfig?.facebookConnected ? '1px solid rgba(255,59,48,0.2)' : 'none'
                    }}
                  >
                    {selectedStore.snsConfig?.facebookConnected 
                      ? (language === 'ko' ? '페이스북 연동 해제' : 'Disconnect Facebook') 
                      : (language === 'ko' ? '페이스북 연동하기' : 'Connect Facebook')}
                  </button>
                </div>
              </div>
            </div>

            {/* SNS 배포 로그 모니터 */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', margin: '0 0 12px 0', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🖥️ {language === 'ko' ? '실시간 SNS 배포 상태 모니터' : 'Real-time SNS Delivery Tracker'}
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {reviews.filter(r => r.storeId === selectedStoreId && r.isAIContent).length > 0 ? (
                  reviews.filter(r => r.storeId === selectedStoreId && r.isAIContent).map(review => {
                    return (
                      <div 
                        key={review.id}
                        style={{ 
                          padding: '12px', 
                          borderRadius: '8px', 
                          border: '1px solid var(--border-color)', 
                          backgroundColor: '#F8F9FF',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            👤 {review.userName} (@{review.userNickname})
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            {new Date(review.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '2.5px solid var(--primary-color)', paddingLeft: '8px' }}>
                          "{review.comment.slice(0, 45)}..."
                        </div>
                        
                        {/* 플랫폼별 분배 상태 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                          {[
                            { key: 'facebookEnabled', label: 'Facebook', shareKey: 'facebook' },
                            { key: 'instagramEnabled', label: 'Instagram Reels', shareKey: 'instagram' },
                            { key: 'threadsEnabled', label: 'Threads', shareKey: 'threads' },
                            { key: 'linkedinEnabled', label: 'LinkedIn', shareKey: 'linkedin' },
                            { key: 'youtubeEnabled', label: 'YouTube Shorts', shareKey: 'youtube' },
                            { key: 'tiktokEnabled', label: 'TikTok', shareKey: 'tiktok' },
                            { key: 'googleEnabled', label: 'Google Business', shareKey: 'google' }
                          ].map(platform => {
                            const isConfigured = selectedStore.snsSettings?.[platform.key as keyof typeof selectedStore.snsSettings] ?? false;
                            const isSharedByReview = review.snsShared?.[platform.shareKey as keyof typeof review.snsShared] ?? false;
                            const isActive = isConfigured && isSharedByReview;

                            return (
                              <span 
                                key={platform.key}
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: isActive ? 'rgba(52, 199, 89, 0.08)' : 'rgba(142, 142, 147, 0.08)',
                                  color: isActive ? '#34C759' : '#8E8E93',
                                  border: `1px solid ${isActive ? 'rgba(52, 199, 89, 0.2)' : 'rgba(142, 142, 147, 0.2)'}`
                                }}
                              >
                                {platform.label}: {isActive ? (language === 'ko' ? '🟢 배포 완료' : '🟢 Shared') : (language === 'ko' ? '⚪ 비활성' : '⚪ Disabled')}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: '16px 0', backgroundColor: 'var(--background-color)', borderRadius: '8px' }}>
                    {language === 'ko' ? '아직 배포된 AI 콘텐츠 이력이 없습니다.' : 'No AI content shared yet.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. 최근 고객 리뷰 대장 */}
          <div className="imin-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', color: 'var(--text-primary)', textAlign: 'left' }}>
              💬 {language === 'ko' ? '우리 매장 고객 리뷰 피드' : 'Customer Reviews Feed'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reviews.filter(r => r.storeId === selectedStoreId).length > 0 ? (
                reviews.filter(r => r.storeId === selectedStoreId).map(review => (
                  <div key={review.id} style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {review.userName.charAt(0)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{review.userName}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>@{review.userNickname}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={10} fill={i < review.rating ? '#ffb800' : 'none'} color={i < review.rating ? '#ffb800' : 'var(--border-color)'} />
                        ))}
                      </div>
                    </div>
                    
                    <p style={{ fontSize: '12.5px', color: 'var(--text-primary)', margin: 0, textAlign: 'left', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                      {review.comment}
                    </p>

                    {review.photoUrl && (
                      <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--border-color)', alignSelf: 'flex-start' }}>
                        <img src={review.photoUrl} alt="Review attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <span>{new Date(review.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '20px 0' }}>
                  {language === 'ko' ? '아직 매장에 작성된 고객 리뷰가 없습니다.' : 'No customer reviews recorded yet.'}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {activeSubTab === 'customers' && (
        !isTabsUnlocked ? (
          renderPasswordPrompt(t.tabCustomer)
        ) : (
          /* 🔍 고객 정보 통합 조회 패널 */
          <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <Users size={22} style={{ color: 'var(--primary-color)' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{t.custTitle}</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '28px', minHeight: '380px' }}>
          
          {/* 좌측: 검색 및 고객 리스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--border-color)', paddingRight: '24px' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder={t.custPlaceholder} 
                className="imin-input"
                style={{ paddingLeft: '36px', width: '100%' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-secondary)' }} />
            </div>

            <div style={{ 
              overflowY: 'auto', 
              maxHeight: '320px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px',
              paddingRight: '4px' 
            }}>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map(customer => {
                  const isSelected = activeCustomer && activeCustomer.id === customer.id;
                  const cCard = stampCards.find(c => c.userId === customer.id && c.storeId === selectedStoreId);
                  const cStamps = cCard ? cCard.currentStamps : 0;
                  return (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        border: 'none',
                        borderRadius: 'var(--border-radius-md)',
                        backgroundColor: isSelected ? 'var(--primary-light)' : 'transparent',
                        borderLeft: isSelected ? '4px solid var(--primary-color)' : '4px solid transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--background-color)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                        <strong style={{ fontSize: '14px', color: isSelected ? 'var(--primary-color)' : 'var(--text-primary)', display: 'block' }}>
                          {customer.name.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                          @{customer.nickname} | {maskPhoneNumber(customer.phoneNumber)}
                        </span>
                      </div>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: 600, 
                        color: 'var(--primary-color)',
                        backgroundColor: 'rgba(95, 92, 230, 0.08)',
                        padding: '4px 8px',
                        borderRadius: 'var(--border-radius-pill)',
                        flexShrink: 0
                      }}>
                        {t.custStamps(cStamps)}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '40px 0' }}>
                  {t.custNoResults}
                </div>
              )}
            </div>
          </div>

          {/* 우측: 선택된 고객 상세 */}
          {activeCustomer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 상단 회원 정보 헤더 카드 */}
              <div style={{ 
                backgroundColor: 'var(--background-color)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--border-radius-lg)', 
                padding: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <>{activeCustomer.name.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')}{t.custSuffix}</>
                  </h4>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    <>{language === 'ko' ? <>닉네임: <strong>@{activeCustomer.nickname}</strong> | 연락처: <strong>{maskPhoneNumber(activeCustomer.phoneNumber)}</strong></> : <>Nickname: <strong>@{activeCustomer.nickname}</strong> | Phone: <strong>{maskPhoneNumber(activeCustomer.phoneNumber)}</strong></>}</>
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.custCashBalance}</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary-color)', marginTop: '2px' }}>
                    ${(storePoints.filter(p => p.userId === activeCustomer.id).reduce((sum, p) => sum + p.pointsBalance, 0)).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 스탬프 현황 */}
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  {t.custCardStatus}
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {Array.from({ length: 7 }).map((_, idx) => {
                    const cCard = stampCards.find(c => c.userId === activeCustomer.id && c.storeId === selectedStoreId);
                    const cStamps = cCard ? cCard.currentStamps : 0;
                    const isActive = idx < cStamps;
                    return (
                      <div
                        key={idx}
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: isActive ? 'var(--primary-color)' : '#E5E5EA',
                          color: isActive ? '#ffffff' : '#8E8E93',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 700,
                          boxShadow: isActive ? '0 4px 10px rgba(95, 92, 230, 0.25)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {idx === 6 ? '🎁' : idx + 1}
                      </div>
                    );
                  })}
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-color)', marginLeft: '8px' }}>
                    ({stampCards.find(c => c.userId === activeCustomer.id && c.storeId === selectedStoreId)?.currentStamps || 0} / 7)
                  </span>
                </div>
              </div>

              {/* 스탬프 서비스 조작 (Manage Stamps) */}
              <div 
                style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-lg)', 
                  padding: '20px',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎫</span>
                    {language === 'ko' ? '스탬프 직접 지급 / 차감 서비스' : 'Manage Stamps Service'}
                  </h4>
                </div>

                {/* 지급/차감 토글 탭 */}
                <div style={{ display: 'flex', backgroundColor: 'var(--background-color)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => {
                      setOwnerStampManageTab('give');
                      setOwnerStampQty(1);
                      setOwnerStampReason('');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: ownerStampManageTab === 'give' ? '#ffffff' : 'transparent',
                      color: ownerStampManageTab === 'give' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: ownerStampManageTab === 'give' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {language === 'ko' ? '🎁 스탬프 주기 (선물 대기)' : '🎁 Give Stamps (Pending)'}
                  </button>
                  <button
                    onClick={() => {
                      setOwnerStampManageTab('deduct');
                      setOwnerStampQty(1);
                      setOwnerStampReason('');
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: ownerStampManageTab === 'deduct' ? '#ffffff' : 'transparent',
                      color: ownerStampManageTab === 'deduct' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: ownerStampManageTab === 'deduct' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {language === 'ko' ? '✂️ 스탬프 빼기 (즉시 차감)' : '✂️ Deduct Stamps (Direct)'}
                  </button>
                </div>

                {/* 탭 본문 폼 */}
                {(() => {
                  const cCard = stampCards.find(c => c.userId === activeCustomer.id && c.storeId === selectedStoreId);
                  const cStamps = cCard ? cCard.currentStamps : 0;
                  
                  if (ownerStampManageTab === 'give') {
                    const maxCanGive = 7 - cStamps;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {maxCanGive <= 0 ? (
                          <div style={{ padding: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', backgroundColor: '#F8F9FA', borderRadius: '8px', textAlign: 'center' }}>
                            {language === 'ko' ? '💡 이미 스탬프가 7개 가득 차서 지급할 수 없습니다.' : '💡 Customer stamp card is already full (7 stamps).'}
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {language === 'ko' ? '지급할 개수' : 'Quantity to Give'}
                              </label>
                              <span style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 700 }}>
                                {language === 'ko' ? `(최대 ${maxCanGive}개 지급 가능)` : `(Max ${maxCanGive} stamps)`}
                              </span>
                            </div>
                            
                            <select
                              value={ownerStampQty}
                              onChange={(e) => setOwnerStampQty(parseInt(e.target.value))}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13.5px', fontWeight: 600, backgroundColor: '#ffffff' }}
                            >
                              {Array.from({ length: maxCanGive }).map((_, i) => (
                                <option key={i} value={i + 1}>{i + 1}{language === 'ko' ? '개' : ' Stamps'}</option>
                              ))}
                            </select>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {language === 'ko' ? '지급 사유 / 메시지' : 'Reason / Gift Message'}
                              </label>
                              <input
                                type="text"
                                value={ownerStampReason}
                                onChange={(e) => setOwnerStampReason(e.target.value)}
                                placeholder={language === 'ko' ? '예: 좋은 일 하셔서 보너스!, 서비스 스탬프 등' : 'e.g., Thank you for the good deed!, Customer service'}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                              />
                            </div>

                            <button
                              onClick={() => {
                                if (ownerStampQty <= 0 || ownerStampQty > maxCanGive) return;
                                const res = giveStampsByOwner(activeCustomer.id, selectedStoreId, ownerStampQty, ownerStampReason || (language === 'ko' ? '사장님 보너스 스탬프' : 'Owner bonus stamp'));
                                if (res.success) {
                                  setToastMessage(language === 'ko' ? `🎁 스탬프 ${ownerStampQty}개 전송 대기 완료!` : `🎁 Queued ${ownerStampQty} stamps successfully!`);
                                  setOwnerStampQty(1);
                                  setOwnerStampReason('');
                                } else {
                                  alert(res.message);
                                }
                              }}
                              className="imin-btn imin-btn-primary"
                              style={{ padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}
                            >
                              {language === 'ko' ? '🎁 스탬프 지급 보내기 (고객 승인 대기)' : '🎁 Send Stamp Gift (Wait Customer Approval)'}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {cStamps <= 0 ? (
                          <div style={{ padding: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', backgroundColor: '#F8F9FA', borderRadius: '8px', textAlign: 'center' }}>
                            {language === 'ko' ? '💡 차감할 수 있는 스탬프가 없습니다.' : '💡 Customer has no stamps to deduct.'}
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                {language === 'ko' ? '차감할 개수' : 'Quantity to Deduct'}
                              </label>
                              <span style={{ fontSize: '11px', color: 'var(--accent-red)', fontWeight: 700 }}>
                                {language === 'ko' ? `(최대 ${cStamps}개 차감 가능)` : `(Max ${cStamps} stamps)`}
                              </span>
                            </div>

                            <select
                              value={ownerStampQty}
                              onChange={(e) => setOwnerStampQty(parseInt(e.target.value))}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13.5px', fontWeight: 600, backgroundColor: '#ffffff' }}
                            >
                              {Array.from({ length: cStamps }).map((_, i) => (
                                <option key={i} value={i + 1}>{i + 1}{language === 'ko' ? '개' : ' Stamps'}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => {
                                if (ownerStampQty <= 0 || ownerStampQty > cStamps) return;
                                if (!window.confirm(language === 'ko' ? `정말로 스탬프 ${ownerStampQty}개를 즉시 차감하시겠습니까?` : `Are you sure you want to deduct ${ownerStampQty} stamps?`)) return;
                                const res = deductStampsByOwner(activeCustomer.id, selectedStoreId, ownerStampQty);
                                if (res.success) {
                                  setToastMessage(language === 'ko' ? `✂️ 스탬프 ${ownerStampQty}개 즉시 차감 완료!` : `✂️ Deducted ${ownerStampQty} stamps successfully!`);
                                  setOwnerStampQty(1);
                                } else {
                                  alert(res.message);
                                }
                              }}
                              className="imin-btn"
                              style={{ padding: '10px', fontSize: '13px', fontWeight: 700, backgroundColor: 'transparent', border: '1.5px solid var(--accent-red)', color: 'var(--accent-red)', cursor: 'pointer', marginTop: '4px' }}
                            >
                              {language === 'ko' ? '✂️ 스탬프 즉시 차감 실행' : '✂️ Deduct Stamps Immediately'}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  }
                })()}
              </div>

              {/* 내역 섹션 2분할 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
                
                {/* 스탬프 나눔 타임라인 */}
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-lg)', 
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: 'var(--card-background-color, #ffffff)'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    💬 {language === 'ko' ? '스탬프 나눔 타임라인' : 'Stamp Timeline'}
                  </span>
                  <div style={{ 
                    overflowY: 'auto', 
                    maxHeight: '220px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    paddingRight: '4px'
                  }}>
                    {(() => {
                      const timelineGifts = [...gifts]
                        .filter(g => g.storeId === selectedStoreId && (g.senderId === activeCustomer.id || g.recipientId === activeCustomer.id))
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                      if (timelineGifts.length === 0) {
                        return (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', textAlign: 'center', padding: '32px 0' }}>
                            {language === 'ko' ? '나눔 메시지 내역이 없습니다.' : 'No stamp conversation history.'}
                          </div>
                        );
                      }

                      return timelineGifts.map(gift => {
                        const senderUser = users.find(u => u.id === gift.senderId);
                        const recipientUser = users.find(u => u.id === gift.recipientId);
                        const isSenderOwner = senderUser?.role === 'owner';
                        const isRecipientOwner = recipientUser?.role === 'owner';

                        // Sender details
                        let senderName = '';
                        let senderHandle = '';
                        if (isSenderOwner) {
                          const ownerStore = stores.find(s => s.ownerId === gift.senderId || s.id === gift.storeId);
                          senderName = ownerStore ? (language === 'ko' ? `${ownerStore.name} 사장님` : `${ownerStore.name} Owner`) : (language === 'ko' ? '매장 사장님' : 'Store Owner');
                          senderHandle = '@owner';
                        } else {
                          senderName = senderUser ? senderUser.name.replace('회원_', '') : (language === 'ko' ? '알수없음' : 'Unknown');
                          senderHandle = senderUser ? `@${senderUser.nickname}` : '';
                        }
                        const senderInitials = senderName ? senderName.trim().charAt(0) : '?';

                        // Recipient details
                        let recipientName = '';
                        let recipientHandle = '';
                        if (isRecipientOwner) {
                          const ownerStore = stores.find(s => s.ownerId === gift.recipientId || s.id === gift.storeId);
                          recipientName = ownerStore ? (language === 'ko' ? `${ownerStore.name} 사장님` : `${ownerStore.name} Owner`) : (language === 'ko' ? '매장 사장님' : 'Store Owner');
                          recipientHandle = '@owner';
                        } else {
                          recipientName = recipientUser ? recipientUser.name.replace('회원_', '') : (language === 'ko' ? '알수없음' : 'Unknown');
                          recipientHandle = recipientUser ? `@${recipientUser.nickname}` : '';
                        }
                        const recipientInitials = recipientName ? recipientName.trim().charAt(0) : '?';

                        const dateStr = new Date(gift.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div 
                            key={gift.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              borderBottom: '1px solid rgba(0,0,0,0.06)',
                              paddingBottom: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: isSenderOwner ? '#5856D6' : (gift.senderId === activeCustomer.id ? 'var(--primary-color)' : '#30B0C7'),
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
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{senderHandle}</span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>·</span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{dateStr}</span>
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
                                      backgroundColor: gift.senderId === activeCustomer.id ? 'rgba(255, 59, 48, 0.08)' : 'rgba(52, 199, 89, 0.08)',
                                      color: gift.senderId === activeCustomer.id ? '#FF3B30' : '#34C759'
                                    }}>
                                      {gift.senderId === activeCustomer.id ? '-' : '+'}{gift.stampsTransferred} {language === 'ko' ? '스탬프' : 'Stamps'}
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: '11.5px', color: 'var(--text-primary)', marginTop: '2px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
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
                                    backgroundColor: isRecipientOwner ? '#5856D6' : (gift.recipientId === activeCustomer.id ? 'var(--primary-color)' : '#30B0C7'),
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

                {/* 기부 참여 이력 */}
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-lg)', 
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t.donationHistTitle}
                  </span>
                  <div style={{ 
                    overflowY: 'auto', 
                    maxHeight: '220px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px' 
                  }}>
                    {donations.filter(d => d.donorId === activeCustomer.id && d.storeId === selectedStoreId).length > 0 ? (
                      donations.filter(d => d.donorId === activeCustomer.id && d.storeId === selectedStoreId).map(donation => (
                        <div 
                          key={donation.id} 
                          style={{ 
                            fontSize: '12px', 
                            lineHeight: 1.5, 
                            padding: '8px', 
                            backgroundColor: 'var(--background-color)', 
                            borderRadius: 'var(--border-radius-sm)',
                            borderLeft: '3px solid var(--accent-red)'
                          }}
                        >
                          <div>
                            <strong>{getNpoName(donation.nonProfitId)}</strong> {language === 'ko' ? '기부' : 'Donation'}
                          </div>
                          <div style={{ color: 'var(--accent-red)', fontWeight: 600, marginTop: '2px' }}>
                            {t.donationHistSubText(donation.stampCount, donation.monetaryValue)}
                          </div>
                          <div style={{ color: '#AEAEB2', fontSize: '10px', marginTop: '4px' }}>
                            {new Date(donation.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', padding: '24px 0' }}>
                        {t.donationHistEmpty}
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              {t.custSelectPrompt}
            </div>
          )}

        </div>
      </div>
        )
      )}

      {activeSubTab === 'analytics' && (
        !isTabsUnlocked ? (
          renderPasswordPrompt(t.tabSettlement)
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 통계 요약 지표 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            {/* 총 잔여 스탬프 개수 */}
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#ffffff' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(95, 92, 230, 0.08)', color: 'var(--primary-color)', fontSize: '24px' }}>
                🎫
              </div>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.analMetricActive}</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--primary-color)' }}>
                  {t.historyQty(stampCards.filter(c => c.storeId === selectedStoreId).reduce((sum, c) => sum + c.currentStamps, 0))}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.analMetricActiveDesc}</span>
              </div>
            </div>

            {/* 총 고객 보유 캐시 잔액 */}
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#ffffff' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(52, 199, 89, 0.08)', color: 'var(--accent-green)', fontSize: '24px' }}>
                💵
              </div>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.analMetricCash}</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--accent-green)' }}>
                  ${storePoints.filter(p => p.storeId === selectedStoreId).reduce((sum, p) => sum + p.pointsBalance, 0).toFixed(2)}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.analMetricCashDesc}</span>
              </div>
            </div>

            {/* 이번 달 누적 기부량 */}
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#ffffff' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(255, 69, 58, 0.08)', color: 'var(--accent-red)', fontSize: '24px' }}>
                🧡
              </div>
              <div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.analMetricMonthlyDon}</span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--accent-red)' }}>
                  ${donations.filter(d => d.storeId === selectedStoreId && isSameMonth(d.createdAt, 0)).reduce((sum, d) => sum + d.monetaryValue, 0).toFixed(2)}
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>
                    ({t.historyQty(donations.filter(d => d.storeId === selectedStoreId && isSameMonth(d.createdAt, 0)).reduce((sum, d) => sum + d.stampCount, 0))})
                  </span>
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t.analMetricMonthlyDonDesc}</span>
              </div>
            </div>

            {/* 기프트 카드 매출 및 스트라이프 연동 */}
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', backgroundColor: '#ffffff' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(95, 92, 230, 0.08)', color: 'var(--primary-color)', fontSize: '24px' }}>
                💳
              </div>
              <div style={{ width: '100%' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {language === 'ko' ? '누적 기프트 카드 판매 (Stripe)' : 'Cumulative Gift Cards (Stripe)'}
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  ${totalGiftCardSales.toFixed(2)}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: selectedStore?.stripeConnected ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
                    color: selectedStore?.stripeConnected ? 'var(--accent-green)' : 'var(--accent-red)'
                  }}>
                    {selectedStore?.stripeConnected 
                      ? (language === 'ko' ? 'Stripe 연동완료' : 'Connected')
                      : (language === 'ko' ? 'Stripe 미연동' : 'Disconnected')}
                  </span>
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                  {language === 'ko' ? '기프트 카드 판매 총 누적액' : 'Total accumulated gift card sales'}
                </span>
              </div>
            </div>

          </div>

          {/* 엑셀 스타일 격자 테이블 */}
          <div className="imin-card" style={{ padding: '24px', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.analGridTitle(statsPeriod)}
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  {t.analGridDesc}
                </span>
              </div>
              
              <button 
                onClick={handleExportExcel}
                disabled={exportLoading}
                className="imin-btn"
                style={{
                  width: 'auto',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 700,
                  backgroundColor: exportLoading ? '#e5e5ea' : 'var(--accent-green)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: exportLoading ? 'not-allowed' : 'pointer',
                  boxShadow: exportLoading ? 'none' : '0 4px 12px rgba(52, 199, 89, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                {exportLoading ? (
                  <>
                    <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <style>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}</style>
                    {t.analExporting}
                  </>
                ) : (
                  <>
                    {t.analExport}
                  </>
                )}
              </button>
            </div>

            {/* 필터 탭 바 */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #F2F2F7', paddingBottom: '12px' }}>
              <button 
                onClick={() => setStatsPeriod('daily')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: statsPeriod === 'daily' ? 'var(--primary-light)' : 'transparent',
                  color: statsPeriod === 'daily' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {t.analPeriodDaily}
              </button>
              <button 
                onClick={() => setStatsPeriod('weekly')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: statsPeriod === 'weekly' ? 'var(--primary-light)' : 'transparent',
                  color: statsPeriod === 'weekly' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {t.analPeriodWeekly}
              </button>
              <button 
                onClick={() => setStatsPeriod('monthly')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: statsPeriod === 'monthly' ? 'var(--primary-light)' : 'transparent',
                  color: statsPeriod === 'monthly' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {t.analPeriodMonthly}
              </button>
            </div>

            {/* 격자형 테이블 */}
            <div style={{ overflowX: 'auto', border: '1px solid #E5E5EA', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '2px solid #E5E5EA' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)', borderRight: '1px solid #E5E5EA' }}>
                      {t.analColDate(statsPeriod)}
                    </th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', borderRight: '1px solid #E5E5EA' }}>
                      {t.analColIssued}
                    </th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', borderRight: '1px solid #E5E5EA' }}>
                      {t.analColCash}
                    </th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', borderRight: '1px solid #E5E5EA' }}>
                      {t.analColRedeem}
                    </th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', borderRight: '1px solid #E5E5EA' }}>
                      {t.analColDonQty}
                    </th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
                      {t.analColDonCash}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getAggregatedStats(statsPeriod).map((row, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid #E5E5EA',
                        backgroundColor: idx === 0 ? '#F9F9FF' : '#ffffff',
                        fontWeight: idx === 0 ? '700' : 'normal',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F5F5FA';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = idx === 0 ? '#F9F9FF' : '#ffffff';
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--text-primary)', borderRight: '1px solid #E5E5EA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {row.period}
                        {idx === 0 && (
                          <span style={{ fontSize: '10px', color: 'var(--primary-color)', backgroundColor: 'var(--primary-light)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                            LIVE
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-primary)', borderRight: '1px solid #E5E5EA' }}>
                        <>{t.historyQty(row.stampsIssued.toLocaleString())}</>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-primary)', borderRight: '1px solid #E5E5EA' }}>
                        ${row.cashConverted.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--accent-green)', fontWeight: idx === 0 ? '800' : '600', borderRight: '1px solid #E5E5EA' }}>
                        ${row.posDiscountApplied.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-primary)', borderRight: '1px solid #E5E5EA' }}>
                        <>{t.historyQty(row.stampsDonated.toLocaleString())}</>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--accent-red)', fontWeight: idx === 0 ? '800' : '600' }}>
                        ${row.donationCashValue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* NPO 기부 스탬프 정산 현황 및 처리 (NPO Donation Settlement) */}
            <div className="imin-card" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E5EA', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--primary-color)' }}>
                    {language === 'ko' ? '🤝 NPO 기부 스탬프 정산 대장' : '🤝 NPO Donation Settlement Ledger'}
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {language === 'ko' ? '고객들이 기부한 스탬프에 대해 기부 단체(NPO)별로 정산할 금액을 조회하고 완료 처리합니다.' : 'View stamp donation values by NPO and mark as settled.'}
                  </p>
                </div>
              </div>

              {/* 정산 요약 및 테이블 */}
              {(() => {
                const storeDonations = donations.filter(d => d.storeId === selectedStoreId);
                const pendingDonations = storeDonations.filter(d => d.settledStatus === 'pending' || !d.settledStatus);

                // 단체별 합산
                const summaryMap: Record<string, { npoName: string; count: number; value: number; ids: string[] }> = {};
                pendingDonations.forEach(d => {
                  const npo = nonProfits.find(n => n.id === d.nonProfitId);
                  const name = npo ? npo.name : d.nonProfitId;
                  if (!summaryMap[d.nonProfitId]) {
                    summaryMap[d.nonProfitId] = { npoName: name, count: 0, value: 0, ids: [] };
                  }
                  summaryMap[d.nonProfitId].count += d.stampCount;
                  summaryMap[d.nonProfitId].value += d.monetaryValue;
                  summaryMap[d.nonProfitId].ids.push(d.id);
                });

                const pendingNpos = Object.entries(summaryMap).map(([npoId, data]) => ({ npoId, ...data }));

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* 1. 정산 대기 요약 카드들 */}
                    <div>
                      <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 750 }}>
                        {language === 'ko' ? '⏳ 미정산 대기 현황 (단체별)' : '⏳ Pending Settlements (by NPO)'}
                      </h5>
                      {pendingNpos.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                          {pendingNpos.map(item => (
                            <div 
                              key={item.npoId}
                              style={{
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(95, 92, 230, 0.15)',
                                backgroundColor: 'rgba(95, 92, 230, 0.02)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>{item.npoName}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                                  {language === 'ko' ? `기부 스탬프: ${item.count}개` : `Donated Stamps: ${item.count}`}
                                </span>
                                <strong style={{ fontSize: '18px', color: 'var(--accent-red)', display: 'block', marginTop: '4px' }}>
                                  ${item.value.toFixed(2)}
                                </strong>
                              </div>
                              <button
                                onClick={() => settleDonations(selectedStoreId, item.ids)}
                                className="imin-btn"
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '12px',
                                  backgroundColor: 'var(--primary-color)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {language === 'ko' ? '정산 완료' : 'Settle Now'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: '#F8F9FA', borderRadius: '12px', border: '1px solid #E5E5EA', fontSize: '13px' }}>
                          ✅ {language === 'ko' ? '모든 기부 스탬프가 NPO 단체에 정산 완료되었습니다.' : 'All stamp donations have been settled to NPOs.'}
                        </div>
                      )}
                    </div>

                    {/* 2. 전체 기부 정산 내역 대장 (테이블) */}
                    <div>
                      <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 750 }}>
                        {language === 'ko' ? '📜 상세 기부 및 정산 이력' : '📜 Detailed Donation & Settlement Log'}
                      </h5>
                      <div style={{ overflowX: 'auto', border: '1px solid #E5E5EA', borderRadius: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E5E5EA' }}>
                              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '날짜' : 'Date'}</th>
                              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '기부 단체' : 'Charity'}</th>
                              <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '기부 고객' : 'Donor'}</th>
                              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '스탬프' : 'Stamps'}</th>
                              <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '정산 가치' : 'Cash Value'}</th>
                              <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '상태' : 'Status'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storeDonations.length > 0 ? (
                              storeDonations
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map(d => {
                                  const npo = nonProfits.find(n => n.id === d.nonProfitId);
                                  const npoName = npo ? npo.name : d.nonProfitId;
                                  const donor = users.find(u => u.id === d.donorId);
                                  const donorName = donor ? donor.nickname : d.donorId;
                                  const isSettled = d.settledStatus === 'settled';

                                  return (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #E5E5EA', backgroundColor: isSettled ? '#FFFFFF' : 'rgba(255, 69, 58, 0.02)' }}>
                                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{npoName}</td>
                                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{donorName}</td>
                                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)' }}>{d.stampCount}</td>
                                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>${d.monetaryValue.toFixed(2)}</td>
                                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                        <span style={{
                                          padding: '3px 8px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          backgroundColor: isSettled ? '#EAFAD1' : '#FFE5E5',
                                          color: isSettled ? '#4E9F15' : '#FF3B30'
                                        }}>
                                          {isSettled ? (language === 'ko' ? '정산 완료' : 'Settled') : (language === 'ko' ? '미정산' : 'Pending')}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                            ) : (
                              <tr>
                                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  {language === 'ko' ? '기부 트랜잭션 내역이 존재하지 않습니다.' : 'No donation transactions found.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>

            {/* 기프트 카드 결제 및 환불 이력 (Gift Card Transactions & Refunds) */}
            <div className="imin-card" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E5EA', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--primary-color)' }}>
                    {language === 'ko' ? '💳 기프트 카드 결제 및 환불 이력' : '💳 Gift Card Transactions & Refunds'}
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {language === 'ko' ? '매장에서 결제 및 환불된 기프트 카드 트랜잭션 전체 내역입니다.' : 'View all gift card payments and refunds in this store.'}
                  </p>
                </div>
              </div>

              {/* 테이블 */}
              <div style={{ overflowX: 'auto', border: '1px solid #E5E5EA', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1px solid #E5E5EA' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '날짜' : 'Date'}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '트랜잭션 ID' : 'Tx ID'}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '바코드' : 'Barcode'}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '고객' : 'Customer'}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '유형' : 'Type'}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '금액' : 'Amount'}</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>{language === 'ko' ? '관리' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Filter transactions for this store
                      const txs = (giftCardTransactions || []).filter(tx => {
                        const card = giftCards.find(c => c.id === tx.giftCardId);
                        return card && card.storeId === selectedStoreId;
                      });

                      if (txs.length > 0) {
                        return txs
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map(tx => {
                            const card = giftCards.find(c => c.id === tx.giftCardId);
                            const customer = card ? users.find(u => u.id === card.userId) : null;
                            const customerName = customer ? customer.nickname : (card ? card.userId : '-');
                            const barcode = card ? card.barcode : '-';
                            
                            // Type translation
                            let typeLabel = '';
                            let typeColor = '';
                            let amountSign = '';
                            if (tx.type === 'purchase') {
                              typeLabel = language === 'ko' ? '카드 구매' : 'Purchase';
                              typeColor = 'var(--primary-color)';
                              amountSign = '+';
                            } else if (tx.type === 'use') {
                              typeLabel = language === 'ko' ? '결제 사용' : 'Use';
                              typeColor = 'var(--accent-red)';
                              amountSign = '-';
                            } else if (tx.type === 'refund_add') {
                              typeLabel = language === 'ko' ? '환불 (충전)' : 'Refund (Add)';
                              typeColor = 'var(--accent-green)';
                              amountSign = '+';
                            } else if (tx.type === 'refund_deduct') {
                              typeLabel = language === 'ko' ? '환불 (차감)' : 'Refund (Deduct)';
                              typeColor = 'var(--text-secondary)';
                              amountSign = '-';
                            }

                            const canRefund = tx.type === 'use';

                            return (
                              <tr key={tx.id} style={{ borderBottom: '1px solid #E5E5EA' }}>
                                <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                                <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{tx.id}</td>
                                <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{barcode}</td>
                                <td style={{ padding: '10px 16px', color: 'var(--text-primary)' }}>{customerName}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    color: typeColor
                                  }}>
                                    {typeLabel}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: amountSign === '+' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                  {amountSign}${tx.amount.toFixed(2)}
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                  {canRefund ? (
                                    <button
                                      onClick={() => {
                                        setSelectedTxToRefund(tx);
                                        setRefundAmountInput(tx.amount.toString());
                                        setRefundPinInput('');
                                        setRefundError(null);
                                        setShowRefundModal(true);
                                      }}
                                      className="imin-btn"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        backgroundColor: 'rgba(255, 59, 48, 0.08)',
                                        color: 'var(--accent-red)',
                                        border: '1px solid rgba(255, 59, 48, 0.2)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      {language === 'ko' ? '환불' : 'Refund'}
                                    </button>
                                  ) : (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                      } else {
                        return (
                          <tr>
                            <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              {language === 'ko' ? '기프트 카드 거래 내역이 없습니다.' : 'No gift card transactions found.'}
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 정산 안내 문구 */}
            <div style={{ 
              marginTop: '8px', 
              padding: '16px', 
              borderRadius: '12px', 
              backgroundColor: '#F8F9FA', 
              border: '1px solid #E5E5EA',
              fontSize: '12px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)'
            }}>
              💡 <strong>{t.analManualTitle}</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>{t.analManualItem1}</li>
                <li>{t.analManualItem2(selectedStore.pointRewardPer7Stamps / 7)}</li>
                <li>{t.analManualItem3}</li>
              </ul>
            </div>

          </div>

        </div>
        )
      )}

      {/* --- 스탬프 캐시 사용/기부 승인 요청 초대형 실시간 팝업 --- */}
      {activeRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '24px',
          transition: 'all 0.3s ease-in-out'
        }}>
          <div className="imin-card" style={{
            width: '100%',
            maxWidth: '600px',
            backgroundColor: '#ffffff',
            borderRadius: '32px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4)',
            padding: '48px',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            textAlign: 'center',
            border: '3px solid var(--primary-color)',
            animation: 'fadeInUpScale 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <style>{`
              @keyframes fadeInUpScale {
                from { opacity: 0; transform: translateY(20px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              @keyframes pulseGlow {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(95, 92, 230, 0.4); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(95, 92, 230, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(95, 92, 230, 0); }
              }
              @keyframes pulseHeart {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.4); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(255, 69, 58, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 69, 58, 0); }
              }
              .pulse-icon-payment {
                animation: pulseGlow 2s infinite ease-in-out;
              }
              .pulse-icon-donation {
                animation: pulseHeart 2s infinite ease-in-out;
              }
            `}</style>

            {/* 상단 장식 바 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              backgroundColor: activeRequest.type === 'donation' ? 'var(--accent-red)' : 'var(--primary-color)'
            }} />

            {/* 비주얼 아이콘 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div 
                className={activeRequest.type === 'donation' ? 'pulse-icon-donation' : 'pulse-icon-payment'}
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  backgroundColor: activeRequest.type === 'donation' ? 'rgba(255, 69, 58, 0.1)' : 'rgba(95, 92, 230, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '44px',
                  color: activeRequest.type === 'donation' ? 'var(--accent-red)' : 'var(--primary-color)'
                }}
              >
                {activeRequest.type === 'donation' ? '🧡' : '💰'}
              </div>
              
              <h3 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                {activeRequest.type === 'donation'
                  ? (language === 'ko' ? '기부 단체 기부 요청' : 'Charity Donation Request')
                  : (language === 'ko' ? '스탬프 캐시 결제 승인 요청' : 'Stamp Cash Payment Request')}
              </h3>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.5 }}>
                {activeRequest.type === 'donation'
                  ? (language === 'ko' ? '고객이 아래 기부 단체로의 캐시 기부 승인을 요청했습니다.' : 'A customer requested approval for charity donation.')
                  : (language === 'ko' ? '고객이 스탬프 캐시를 사용한 결제 할인을 요청했습니다.' : 'A customer requested stamp cash discount.')}
              </p>
            </div>

            {/* 상세 명세 카드 */}
            <div style={{
              backgroundColor: '#F8F9FA',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
                  {language === 'ko' ? '요청 고객' : 'Customer'}
                </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: 700 }}>
                  {activeRequest.userName.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')} ({activeRequest.userNickname})
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
                  {language === 'ko' ? '요청 매장' : 'Store'}
                </span>
                <span style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                  {selectedStore.name}
                </span>
              </div>

              {activeRequest.type === 'donation' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
                    {language === 'ko' ? '기부 대상 단체' : 'Charity'}
                  </span>
                  <strong style={{ color: 'var(--accent-purple)', fontSize: '17px', fontWeight: 700 }}>
                    {activeRequest.nonProfitName}
                  </strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 600 }}>
                  {activeRequest.type === 'donation' 
                    ? (language === 'ko' ? '기부 승인 금액' : 'Donation Amount')
                    : (language === 'ko' ? '할인 적용 금액' : 'Discount Amount')}
                </span>
                <strong style={{ fontSize: '38px', fontWeight: 900, color: activeRequest.type === 'donation' ? 'var(--accent-red)' : 'var(--primary-color)' }}>
                  ${activeRequest.amount.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* 감사 메시지 입력 필드 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                💬 {language === 'ko' ? '고객 전송 감사 메시지 (직접 편집 가능)' : 'Thank You Message to Customer'}
              </label>
              <textarea
                value={approveCustomMessage}
                onChange={(e) => setApproveCustomMessage(e.target.value)}
                placeholder={language === 'ko' ? '감사 메시지를 입력하세요...' : 'Enter thank you message...'}
                style={{
                  width: '100%',
                  height: '52px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--border-color)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* 하단 액션 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <button
                onClick={() => rejectPayment(activeRequest.id)}
                className="imin-btn"
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: '2px solid var(--accent-red)',
                  color: 'var(--accent-red)',
                  fontWeight: 800,
                  fontSize: '18px',
                  padding: '16px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 69, 58, 0.05)';
                  e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {language === 'ko' ? '요청 거절 (Reject)' : 'Reject'}
              </button>
              <button
                onClick={() => {
                  approvePayment(activeRequest.id, approveCustomMessage);
                  if (activeRequest.type === 'payment') {
                    setShowPosDiscountModal(activeRequest);
                  }
                }}
                className="imin-btn"
                style={{
                  flex: 1.3,
                  backgroundColor: 'var(--primary-color)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '18px',
                  padding: '16px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(95, 92, 230, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#4A47C5';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {language === 'ko' ? '승인 완료 (Approve)' : 'Approve'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- 포스기 실물 할인 지시 대형 팝업 --- */}
      {showPosDiscountModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 10, 15, 0.9)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: '24px'
        }}>
          <div className="imin-card" style={{
            width: '100%',
            maxWidth: '540px',
            backgroundColor: '#ffffff',
            borderRadius: '28px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            textAlign: 'center',
            border: '4px solid var(--accent-green)',
            animation: 'fadeInUpScale 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(52, 199, 89, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                color: 'var(--accent-green)',
                animation: 'pulseGlow 2s infinite ease-in-out'
              }}>
                💵
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--accent-green)' }}>
                {language === 'ko' ? '스탬프 캐시 승인 완료!' : 'Stamp Cash Approved!'}
              </h3>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, lineHeight: 1.6 }}>
                {language === 'ko' 
                  ? '고객의 스탬프 캐시가 정상적으로 차감되었습니다.' 
                  : 'Customer\'s stamp cash has been successfully deducted.'}
                <br />
                <span style={{ color: 'var(--accent-red)', fontSize: '16px', fontWeight: 800 }}>
                  {language === 'ko'
                    ? '👉 실물 포스(POS)기에서 아래 금액만큼 할인을 적용해 주세요!'
                    : '👉 Please apply the following discount amount on your physical POS!'}
                </span>
              </p>
            </div>

            {/* 할인 상세 정보 */}
            <div style={{
              backgroundColor: '#F8F9FA',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t.posModalCustomer}</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {showPosDiscountModal.userName.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')} (@{showPosDiscountModal.userNickname})
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>
                  {t.posModalAmtLabel}
                </span>
                <strong style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-green)' }}>
                  ${showPosDiscountModal.amount.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* 포스기 할인 확인 완료 버튼 */}
            <button
              onClick={() => setShowPosDiscountModal(null)}
              className="imin-btn"
              style={{
                backgroundColor: 'var(--accent-green)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '18px',
                padding: '16px',
                borderRadius: '16px',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(52, 199, 89, 0.3)',
                transition: 'all 0.2s ease',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2E7D32';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-green)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {t.posModalBtn}
            </button>
          </div>
        </div>
      )}

      {/* --- 3단계 기프트 카드 환불 승인 모달 --- */}
      {showRefundModal && selectedTxToRefund && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: '24px'
        }}>
          <div className="imin-card" style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            textAlign: 'left',
            animation: 'fadeInUpScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            border: '1px solid var(--border-color)',
            boxSizing: 'border-box'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>
                {language === 'ko' ? '💸 기프트 카드 환불 승인' : '💸 Approve Gift Card Refund'}
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {language === 'ko' ? '거래금액 이하의 금액을 기프트 카드로 환불합니다.' : 'Refund up to the original transaction amount to the gift card.'}
              </p>
            </div>

            {/* 거래 상세 */}
            <div style={{
              backgroundColor: '#F8F9FA',
              borderRadius: '16px',
              padding: '16px',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{language === 'ko' ? '거래 ID' : 'Transaction ID'}</span>
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{selectedTxToRefund.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{language === 'ko' ? '거래 날짜' : 'Transaction Date'}</span>
                <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTxToRefund.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{language === 'ko' ? '사용 금액' : 'Original Amount'}</span>
                <strong style={{ color: 'var(--accent-red)' }}>${selectedTxToRefund.amount.toFixed(2)}</strong>
              </div>
            </div>

            {/* 환불 금액 입력 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {language === 'ko' ? '환불 신청 금액 ($)' : 'Refund Amount ($)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedTxToRefund.amount}
                value={refundAmountInput}
                onChange={(e) => {
                  setRefundAmountInput(e.target.value);
                  setRefundPinInput('');
                  setRefundError(null);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  fontSize: '15px',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 권한 레벨 표기 및 검증 */}
            {(() => {
              const amt = parseFloat(refundAmountInput) || 0;
              if (amt <= 0) return null;
              if (amt > selectedTxToRefund.amount) {
                return (
                  <div style={{ color: 'var(--accent-red)', fontSize: '12.5px', fontWeight: 600 }}>
                    ⚠️ {language === 'ko' ? '기본 거래금액을 초과할 수 없습니다.' : 'Cannot exceed original transaction amount.'}
                  </div>
                );
              }

              if (amt <= 10) {
                return (
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(52, 199, 89, 0.08)',
                    border: '1px solid rgba(52, 199, 89, 0.2)',
                    fontSize: '12.5px',
                    color: 'var(--accent-green)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    🛡️ {language === 'ko' ? '즉시 환불 가능 (승인 절차 생략)' : 'Instant Refund (No security PIN required)'}
                  </div>
                );
              }

              const isManager = amt > 10 && amt < 100;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: isManager ? 'rgba(255, 149, 0, 0.08)' : 'rgba(255, 59, 48, 0.08)',
                    border: isManager ? '1px solid rgba(255, 149, 0, 0.2)' : '1px solid rgba(255, 59, 48, 0.2)',
                    fontSize: '12.5px',
                    color: isManager ? '#FF9500' : 'var(--accent-red)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    🔑 {isManager
                      ? (language === 'ko' ? '매니저 승인 대상 (PIN 번호 필요)' : 'Requires Manager Approval (PIN Required)')
                      : (language === 'ko' ? '점주 승인 대상 (비밀번호 필요)' : 'Requires Owner Approval (Password Required)')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {isManager ? (language === 'ko' ? '매니저 PIN 번호' : 'Manager PIN') : (language === 'ko' ? '점주 패스워드' : 'Owner Password')}
                    </label>
                    <input
                      type="password"
                      value={refundPinInput}
                      onChange={(e) => {
                        setRefundPinInput(e.target.value);
                        setRefundError(null);
                      }}
                      placeholder={isManager ? 'e.g. 1234' : 'e.g. owner1234'}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1.5px solid var(--border-color)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {refundError && (
              <div style={{
                color: 'var(--accent-red)',
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '10px 12px',
                backgroundColor: 'rgba(255, 59, 48, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 59, 48, 0.1)'
              }}>
                ❌ {refundError}
              </div>
            )}

            {/* 모달 하단 버튼 */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedTxToRefund(null);
                  setRefundAmountInput('');
                  setRefundPinInput('');
                  setRefundError(null);
                }}
                className="imin-btn"
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: '1.5px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '14.5px',
                  padding: '12px',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                {language === 'ko' ? '취소' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  const amt = parseFloat(refundAmountInput);
                  if (isNaN(amt) || amt <= 0) {
                    setRefundError(language === 'ko' ? '올바른 환불 금액을 입력하세요.' : 'Please enter a valid refund amount.');
                    return;
                  }
                  if (amt > selectedTxToRefund.amount) {
                    setRefundError(language === 'ko' ? '원본 거래 금액을 초과하여 환불할 수 없습니다.' : 'Refund amount cannot exceed original transaction amount.');
                    return;
                  }

                  const res = processRefund(selectedTxToRefund.id, amt, refundPinInput);
                  if (res.success) {
                    setToastMessage(language === 'ko' ? '기프트 카드 환불 처리가 완료되었습니다.' : 'Gift card refund successfully processed.');
                    setTimeout(() => setToastMessage(null), 3000);
                    setShowRefundModal(false);
                    setSelectedTxToRefund(null);
                    setRefundAmountInput('');
                    setRefundPinInput('');
                    setRefundError(null);
                  } else {
                    setRefundError(res.message);
                  }
                }}
                className="imin-btn imin-btn-primary"
                style={{
                  flex: 1.5,
                  backgroundColor: 'var(--accent-red)',
                  borderColor: 'var(--accent-red)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '14.5px',
                  padding: '12px',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                {language === 'ko' ? '환불 승인' : 'Approve Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 7개 보상 변경 비밀번호 재확인 모달 --- */}
      {showRewardConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: '24px'
        }}>
          <div className="imin-card" style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            textAlign: 'left',
            animation: 'fadeInUpScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            border: '1px solid var(--border-color)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>
                {language === 'ko' ? '🔒 보안 확인' : '🔒 Security Verification'}
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {language === 'ko' 
                  ? `7개 완성 보상 캐시를 $${parseFloat(tempRewardAmount).toFixed(2)}로 변경하려 합니다. 계속하려면 사장님 비밀번호를 한 번 더 입력해 주세요.`
                  : `You are changing the 7-stamp reward cash to $${parseFloat(tempRewardAmount).toFixed(2)}. Please enter the owner password to confirm.`}
              </p>
            </div>

            <form onSubmit={handleRewardConfirmSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {language === 'ko' ? '비밀번호' : 'Password'}
                </label>
                <input 
                  type="password"
                  value={rewardConfirmPassword}
                  onChange={(e) => setRewardConfirmPassword(e.target.value)}
                  placeholder={language === 'ko' ? '비밀번호 입력' : 'Enter password'}
                  className="imin-input"
                  style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                  required
                  autoFocus
                />
              </div>

              {rewardConfirmError && (
                <span style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600 }}>
                  ⚠️ {rewardConfirmError}
                </span>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowRewardConfirmModal(false)}
                  className="imin-btn imin-btn-secondary"
                  style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: 700 }}
                >
                  {language === 'ko' ? '취소' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="imin-btn imin-btn-primary"
                  style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: 700 }}
                >
                  {language === 'ko' ? '확인 및 변경' : 'Confirm & Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 토스트 피드백 알림 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1C1C1E',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 9999999,
          fontSize: '14px',
          fontWeight: 600,
          animation: 'fadeInUpToast 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <style>{`
            @keyframes fadeInUpToast {
              from { opacity: 0; transform: translate(-50%, 15px); }
              to { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
