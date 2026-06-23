import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { playVoiceGuidance } from '../utils/voice';
import { db as firestoreDb } from '../firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

let clockOffsetMs = 0;
export const getSkewCorrectedIsoString = () => {
  return new Date(Date.now() + clockOffsetMs).toISOString();
};

const formatInterval = (minutes: number, lang: 'ko' | 'en' = 'ko') => {
  const minsNum = typeof minutes === 'number' && !isNaN(minutes) ? minutes : 60;
  if (minsNum === 0) {
    return lang === 'en' ? 'No Limit' : '제한 없음';
  }
  if (lang === 'en') {
    if (minsNum < 60) return `${minsNum} mins`;
    const hours = Math.floor(minsNum / 60);
    const mins = minsNum % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (minsNum < 60) return `${minsNum}분`;
  const hours = Math.floor(minsNum / 60);
  const mins = minsNum % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};

const translateStore = (store: Store, lang: 'ko' | 'en'): Store => {
  if (lang === 'ko') return store;
  
  const translations: Record<string, string> = {
    'store_id_1': 'Coffee House Gangnam',
    'store_id_2': "Baek's Rice & Ssambap",
    'store_id_3': 'Apgujeong Hair Salon',
    'store_id_4': 'Paris Baguette Seocho',
    'store_id_5': 'Olive Young Sinsa'
  };
  
  const name = translations[store.id] || store.name.replace('매장', 'Store').replace('가맹점', 'Store').replace('호점', '');
  return { ...store, name };
};

const translateNpo = (npo: NonProfit, lang: 'ko' | 'en'): NonProfit => {
  if (lang === 'ko') return npo;
  
  const names: Record<string, string> = {};
  
  const descriptions: Record<string, string> = {};
  
  return {
    ...npo,
    name: names[npo.id] || npo.name,
    description: descriptions[npo.id] || npo.description
  };
};

const translateAd = (ad: AdBanner, lang: 'ko' | 'en'): AdBanner => {
  if (lang === 'ko' || ad.id !== 'ad_default_duracell') return ad;
  return {
    ...ad,
    title: 'Duracell CR2032 Lithium Battery 9 Count (Child Safety Feature)',
    subtitle: 'As an Amazon Associate, I earn from qualifying purchases.'
  };
};

const mergeCollections = <T extends { id: string; updatedAt?: string }>(
  listA: T[],
  listB: T[],
  timeA: number,
  timeB: number
): T[] => {
  const mapA = new Map((listA || []).map(item => [item.id, item]));
  const mapB = new Map((listB || []).map(item => [item.id, item]));
  
  const allIds = new Set([...mapA.keys(), ...mapB.keys()]);
  const merged: T[] = [];
  
  for (const id of allIds) {
    const itemA = mapA.get(id);
    const itemB = mapB.get(id);
    
    if (itemA && itemB) {
      const tA = new Date(itemA.updatedAt || 0).getTime();
      const tB = new Date(itemB.updatedAt || 0).getTime();
      if (tB > tA) {
        merged.push(itemB);
      } else if (tA > tB) {
        merged.push(itemA);
      } else {
        merged.push(timeB > timeA ? itemB : itemA);
      }
    } else if (itemA) {
      merged.push(itemA);
    } else if (itemB) {
      if (timeB > timeA) {
        merged.push(itemB);
      }
    }
  }
  return merged;
};

const mergeStates = (stateA: any, stateB: any): any => {
  if (!stateA) return stateB;
  if (!stateB) return stateA;

  const timeA = new Date(stateA.updatedAt || 0).getTime();
  const timeB = new Date(stateB.updatedAt || 0).getTime();
  const merged = timeA >= timeB ? { ...stateA } : { ...stateB };

  merged.users = mergeCollections(stateA.users, stateB.users, timeA, timeB);
  merged.stores = mergeCollections(stateA.stores, stateB.stores, timeA, timeB);
  merged.stampCards = mergeCollections(stateA.stampCards, stateB.stampCards, timeA, timeB);
  merged.storePoints = mergeCollections(stateA.storePoints, stateB.storePoints, timeA, timeB);
  
  merged.stampTransactions = mergeCollections(stateA.stampTransactions, stateB.stampTransactions, timeA, timeB)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  merged.pointTransactions = mergeCollections(stateA.pointTransactions, stateB.pointTransactions, timeA, timeB)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  merged.userDevices = mergeCollections(stateA.userDevices, stateB.userDevices, timeA, timeB);
  merged.receiptScans = mergeCollections(stateA.receiptScans, stateB.receiptScans, timeA, timeB);

  merged.donations = mergeCollections(stateA.donations, stateB.donations, timeA, timeB)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  merged.gifts = mergeCollections(stateA.gifts, stateB.gifts, timeA, timeB);
  merged.giftCards = mergeCollections(stateA.giftCards, stateB.giftCards, timeA, timeB);
  merged.giftCardTransactions = mergeCollections(stateA.giftCardTransactions, stateB.giftCardTransactions, timeA, timeB);
  merged.nonProfits = mergeCollections(stateA.nonProfits, stateB.nonProfits, timeA, timeB);
  merged.adBanners = mergeCollections(stateA.adBanners, stateB.adBanners, timeA, timeB);
  merged.paymentRequests = mergeCollections(stateA.paymentRequests, stateB.paymentRequests, timeA, timeB);
  merged.reviews = mergeCollections(stateA.reviews || [], stateB.reviews || [], timeA, timeB)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  merged.categories = timeB > timeA ? (stateB.categories || []) : (stateA.categories || []);
  merged.donationsLedger = timeB > timeA ? (stateB.donationsLedger || []) : (stateA.donationsLedger || []);
  merged.donationsAudit = timeB > timeA ? (stateB.donationsAudit || []) : (stateA.donationsAudit || []);
  merged.giftsLedger = timeB > timeA ? (stateB.giftsLedger || []) : (stateA.giftsLedger || []);
  merged.ownerRequests = timeB > timeA ? (stateB.ownerRequests || []) : (stateA.ownerRequests || []);

  merged.updatedAt = getSkewCorrectedIsoString();
  return merged;
};

// --- 인터페이스 정의 ---
export interface User {
  id: string;
  phoneNumber: string;
  nickname: string;
  name: string;
  role: 'customer' | 'owner' | 'admin';
  loginId?: string;
  password?: string;
  status?: 'active' | 'suspended' | 'pending_approval' | 'deleted';
  updatedAt?: string;
}

export interface UserDevice {
  id: string;
  userId: string;
  deviceToken: string;
}

export interface Store {
  id: string;
  name: string;
  ownerId: string;
  category: string;
  pointRewardPer7Stamps: number; // 7개 완성 시 보상 캐시 금액 (예: $5.00, $30.00)
  currency: string;
  earningIntervalMinutes: number; // 동일 고객 재적립 제한 시간 (분)
  stripeConnected?: boolean;
  stripeAccountId?: string;
  status?: 'active' | 'suspended';
  updatedAt?: string;
  description?: string;
  address?: string;
  phone?: string;
  hours?: string;
  menuItems?: { name: string; price: number; description?: string }[];
  thumbnailUrl?: string;
  bannerUrl?: string;
  snsSettings?: {
    facebookEnabled: boolean;
    instagramEnabled: boolean;
    threadsEnabled: boolean;
    linkedinEnabled: boolean;
    youtubeEnabled: boolean;
    tiktokEnabled: boolean;
    googleEnabled: boolean;
  };
  snsConfig?: {
    googlePlaceId?: string;
    googleReviewUrl?: string;
    googleConnected?: boolean;
    facebookPageId?: string;
    facebookPageName?: string;
    facebookConnected?: boolean;
    threadsUsername?: string;
    threadsConnected?: boolean;
    linkedinPageId?: string;
    linkedinConnected?: boolean;
    youtubeChannelId?: string;
    youtubeConnected?: boolean;
    tiktokUsername?: string;
    tiktokConnected?: boolean;
  };
}

export interface StoreReview {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  userNickname: string;
  rating: number; // 1-5
  comment: string;
  photoUrl?: string;
  createdAt: string;
  isAIContent?: boolean;
  videoUrl?: string;
  aiQuestionsAnswers?: { q: string; a: string }[];
  snsShared?: {
    facebook?: boolean;
    instagram?: boolean;
    threads?: boolean;
    linkedin?: boolean;
    youtube?: boolean;
    tiktok?: boolean;
    google?: boolean;
  };
}


export interface StampCard {
  id: string;
  userId: string;
  storeId: string;
  currentStamps: number; // 0 to 6
  updatedAt: string;
  stamps?: {
    id: string;
    acquiredAt: string;
    cashValue: number;
    isGift?: boolean;
    senderName?: string;
    senderNickname?: string;
  }[];
}

export interface StorePoint {
  id: string;
  userId: string;
  storeId: string;
  pointsBalance: number;
  updatedAt: string;
}

export interface GiftCard {
  id: string;
  userId: string;
  storeId: string;
  initialAmount: number;
  currentBalance: number;
  barcode: string;
  status: 'active' | 'exhausted' | 'expired';
  recipientPhoneNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  type: 'purchase' | 'use' | 'refund_add' | 'refund_deduct';
  amount: number;
  createdAt: string;
}

export interface NonProfit {
  id: string;
  code: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
}

export interface Donation {
  id: string;
  donorId: string;
  storeId: string;
  nonProfitId: string;
  stampCount: number;
  monetaryValue: number; // stampCount * (storeReward / 7)
  createdAt: string;
  settledStatus?: 'pending' | 'settled';
  settledAt?: string;
}

export interface Gift {
  id: string;
  senderId: string;
  recipientId: string;
  storeId: string;
  stampsSent: number;
  stampsTransferred: number;
  message: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined';
  thanksMessage?: string;
  stamps?: {
    id: string;
    acquiredAt: string;
    cashValue: number;
    isGift?: boolean;
    senderName?: string;
    senderNickname?: string;
  }[];
}

export interface StampTransaction {
  id: string;
  userId: string;
  storeId: string;
  amount: number;
  type: 'earn' | 'gift_send' | 'gift_receive' | 'donation' | 'point_conversion';
  source?: 'receipt_qr' | 'ai_review' | 'sns_share' | 'manual';
  referenceId?: string;
  createdAt: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  storeId: string;
  amount: number;
  type: 'earn_from_stamps' | 'use_payment' | 'refund';
  createdAt: string;
}

export interface ReceiptScan {
  id: string;
  storeId: string;
  receiptImageUrl: string;
  qrToken: string;
  stampsToAward: number;
  status: 'generated' | 'claimed' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userName: string;
  userNickname: string;
  storeId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  type: 'payment' | 'donation';
  nonProfitId?: string;
  nonProfitName?: string;
}

export interface AdBanner {
  id: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  imageUrl?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

// --- 컨텍스트 상태 구조 ---
interface DatabaseContextProps {
  users: User[];
  userDevices: UserDevice[];
  stores: Store[];
  stampCards: StampCard[];
  storePoints: StorePoint[];
  nonProfits: NonProfit[];
  donations: Donation[];
  gifts: Gift[];
  stampTransactions: StampTransaction[];
  pointTransactions: PointTransaction[];
  receiptScans: ReceiptScan[];
  paymentRequests: PaymentRequest[];
  adBanners: AdBanner[];
  giftCards: GiftCard[];
  giftCardTransactions: GiftCardTransaction[];
  reviews: StoreReview[];
  addReview: (
    storeId: string,
    rating: number,
    comment: string,
    photoUrl?: string,
    isAIContent?: boolean,
    videoUrl?: string,
    aiQuestionsAnswers?: { q: string; a: string }[],
    snsShared?: {
      facebook?: boolean;
      instagram?: boolean;
      threads?: boolean;
      linkedin?: boolean;
      youtube?: boolean;
      tiktok?: boolean;
      google?: boolean;
    }
  ) => { reviewId: string; stampAwarded: boolean; message: string };
  updateReviewMedia: (reviewId: string, media: { photoUrl?: string; videoUrl?: string }) => void;
  updateStoreMiniHome: (storeId: string, updates: Partial<Store>) => void;
  
  // 로그인 상태 및 디바이스
  currentUser: User | null;
  currentDeviceToken: string | null;
  setCurrentUser: (user: User | null) => void;
  loginByDeviceToken: (token: string) => boolean;
  loginByPhoneNumber: (phoneNumber: string, deviceToken: string) => User | null;
  logout: () => void;
  registerUser: (phoneNumber: string, nickname: string, name: string, deviceToken: string, job?: string, hobbies?: string[]) => { user: User; token: string };
  searchFriend: (query: string) => User[];
  
  // 계산대 영수증 스캔 및 10초 QR
  generateQR: (storeId: string, stampsToAward: number, photoUrl: string) => string;
  validateQR: (token: string) => ReceiptScan | null;
  registerQRScan: (token: string, storeId: string, stampsToAward: number, expiresAt: string) => void;
  claimQRStamps: (token: string, deviceToken: string) => { success: boolean; message: string; stampsAwarded: number; newStamps: number; earnedPoints: number };
  
  // 비즈니스 트랜잭션 함수
  earnStampsDirectly: (userId: string, storeId: string, count: number) => void;
  giftStamps: (senderId: string, recipientId: string, storeId: string, count: number, message: string) => { transferred: number; returned: number };
  acceptGift: (giftId: string, thanksMessage: string) => { success: boolean; message: string };
  declineGift: (giftId: string) => { success: boolean; message: string };
  convertStampsToCash: (userId: string, storeId: string) => { success: boolean; message: string; earnedPoints?: number };
  donateStamps: (userId: string, storeId: string, nonProfitId: string, count: number) => number;
  donatePointsDirect: (userId: string, nonProfitId: string, amount: number) => number;
  redeemPoints: (userId: string, storeId: string, amount: number) => { success: boolean; deducted: number };
  settleDonations: (storeId: string, donationIds: string[]) => void;
  updateStoreInterval: (storeId: string, minutes: number) => void;
  updateStoreRewardAmount: (storeId: string, amount: number) => void;
  deductStampsByOwner: (customerId: string, storeId: string, count: number) => { success: boolean; message: string };
  giveStampsByOwner: (customerId: string, storeId: string, count: number, message: string) => { success: boolean; stampsQueued: number; message?: string };

  // 실시간 결제 요청 함수
  requestPayment: (userId: string, storeId: string, amount: number, type?: 'payment' | 'donation', nonProfitId?: string) => string;
  approvePayment: (requestId: string, customThanksMessage?: string) => void;
  rejectPayment: (requestId: string) => void;
  cancelPaymentRequest: (requestId: string) => void;
  
  // 광고 배너 관리 함수
  addAdBanner: (title: string, subtitle: string, linkUrl: string, imageUrl?: string) => void;
  toggleAdBannerStatus: (id: string) => void;
  deleteAdBanner: (id: string) => void;

  // NPO 관리
  addNonProfit: (name: string, description: string) => void;
  updateNonProfit: (id: string, name: string, description: string) => void;
  toggleNonProfitStatus: (id: string) => void;
  deleteNonProfit: (id: string) => void;

  // 관리데이터 리셋
  resetDatabase: (completeEmpty?: boolean) => Promise<void>;
  
  // 다국어 관련 추가
  language: 'ko' | 'en';
  setLanguage: (lang: 'ko' | 'en') => void;
  
  // 매장 관리 동기화 관련 추가
  selectedStoreId: string;
  setSelectedStoreId: (storeId: string) => void;
  customerSelectedStoreId: string;
  setCustomerSelectedStoreId: (storeId: string) => void;
  kioskSelectedStoreId: string;
  setKioskSelectedStoreId: (storeId: string) => void;
  ownerSelectedStoreId: string;
  setOwnerSelectedStoreId: (storeId: string) => void;

  // 매장 비밀번호 관련 추가
  ownerPassword: string;
  setOwnerPassword: (pw: string) => void;

  // 사장님 로그인 세션 및 가입 추가
  currentOwner: User | null;
  setCurrentOwner: (owner: User | null) => void;
  registerOwner: (name: string, storeId: string, loginId: string, password: string) => { success: boolean; message: string; owner?: User; store?: Store };
  registerStore: (name: string, ownerId: string, category: Store['category'], pointRewardPer7Stamps: number) => { success: boolean; store?: Store; message?: string };

  // 회원 활동정지 및 삭제 추가
  suspendUser: (userId: string) => void;
  deleteUser: (userId: string) => void;
  buyGiftCard: (userId: string, storeId: string, amount: number) => { success: boolean; giftCard: GiftCard };
  sendGiftCard: (giftCardId: string, recipientPhoneNumber: string) => { success: boolean; shareLink: string };
  claimGiftCard: (userId: string, phoneNumber: string) => { success: boolean; claimedCount: number };
  processSplitPayment: (userId: string, storeId: string, billAmount: number, useStamps: boolean, useGiftCard: boolean) => { success: boolean; summary: string; remaining: number; deductedPoints: number; deductedGift: number };
  processRefund: (transactionId: string, refundAmount: number, pinCode: string) => { success: boolean; message: string };
  registerStripeConnect: (storeId: string) => void;
  categories: string[];
  addCategory: (name: string) => void;
  deleteCategory: (name: string) => void;
  approveOwnerRequest: (ownerId: string) => void;
  rejectOwnerRequest: (ownerId: string) => void;
  importDatabase: (dbJson: string) => { success: boolean; message: string };
  exportDatabase: () => string;
  toggleStoreStatus: (storeId: string) => void;
  deleteStore: (storeId: string) => void;
  changeOwnerPassword: (ownerId: string, newPassword: string) => { success: boolean; message: string };
}

const DatabaseContext = createContext<DatabaseContextProps | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'sharestamps_db_v2';

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbState, setDbState] = useState<{
    users: User[];
    userDevices: UserDevice[];
    stores: Store[];
    stampCards: StampCard[];
    storePoints: StorePoint[];
    nonProfits: NonProfit[];
    donations: Donation[];
    gifts: Gift[];
    stampTransactions: StampTransaction[];
    pointTransactions: PointTransaction[];
    receiptScans: ReceiptScan[];
    paymentRequests: PaymentRequest[];
    adBanners: AdBanner[];
    giftCards: GiftCard[];
    giftCardTransactions: GiftCardTransaction[];
    reviews: StoreReview[];
    categories: string[];
    updatedAt?: string;
    resetAt?: string;
  } | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentDeviceToken, setCurrentDeviceToken] = useState<string | null>(null);

  const [language, setLanguageState] = useState<'ko' | 'en'>(() => {
    return (localStorage.getItem('sharestamps_language') as 'ko' | 'en') || 'en';
  });

  const setLanguage = (lang: 'ko' | 'en') => {
    setLanguageState(lang);
    localStorage.setItem('sharestamps_language', lang);
  };

  const [selectedStoreId, setSelectedStoreIdState] = useState<string>(() => {
    return localStorage.getItem('sharestamps_selected_store_id') || 'store_id_1';
  });

  const setSelectedStoreId = (storeId: string) => {
    setSelectedStoreIdState(storeId);
    localStorage.setItem('sharestamps_selected_store_id', storeId);
  };

  const [customerSelectedStoreId, setCustomerSelectedStoreIdState] = useState<string>(() => {
    return localStorage.getItem('sharestamps_customer_selected_store_id') || localStorage.getItem('sharestamps_selected_store_id') || 'store_id_1';
  });

  const setCustomerSelectedStoreId = (storeId: string) => {
    setCustomerSelectedStoreIdState(storeId);
    localStorage.setItem('sharestamps_customer_selected_store_id', storeId);
  };

  const [kioskSelectedStoreId, setKioskSelectedStoreIdState] = useState<string>(() => {
    return localStorage.getItem('sharestamps_kiosk_selected_store_id') || localStorage.getItem('sharestamps_selected_store_id') || 'store_id_1';
  });

  const setKioskSelectedStoreId = (storeId: string) => {
    setKioskSelectedStoreIdState(storeId);
    localStorage.setItem('sharestamps_kiosk_selected_store_id', storeId);
  };

  const [ownerSelectedStoreId, setOwnerSelectedStoreIdState] = useState<string>(() => {
    return localStorage.getItem('sharestamps_owner_selected_store_id') || localStorage.getItem('sharestamps_selected_store_id') || 'store_id_1';
  });

  const setOwnerSelectedStoreId = (storeId: string) => {
    setOwnerSelectedStoreIdState(storeId);
    localStorage.setItem('sharestamps_owner_selected_store_id', storeId);
  };

  const updateClockOffset = (serverUpdatedAt?: string) => {
    if (!serverUpdatedAt) return;
    const serverTime = new Date(serverUpdatedAt).getTime();
    const localTime = Date.now();
    if (serverTime > localTime + clockOffsetMs) {
      clockOffsetMs = serverTime - localTime + 1000; // 1 second buffer
      console.log(`[DatabaseContext] Clock skew detected. Server is ahead. Adjusted offset: ${clockOffsetMs}ms`);
    }
  };

  // selectedStoreId 유효성 체크 및 자동 복구 (Reset DB 등으로 로컬스토리지 불일치 방지)
  useEffect(() => {
    if (dbState && dbState.stores.length > 0) {
      const defaultStoreId = dbState.stores[0].id;

      const exists = dbState.stores.some(s => s.id === selectedStoreId);
      if (!exists) {
        setSelectedStoreIdState(defaultStoreId);
        localStorage.setItem('sharestamps_selected_store_id', defaultStoreId);
      }

      const customerExists = dbState.stores.some(s => s.id === customerSelectedStoreId);
      if (!customerExists) {
        setCustomerSelectedStoreIdState(defaultStoreId);
        localStorage.setItem('sharestamps_customer_selected_store_id', defaultStoreId);
      }

      const kioskExists = dbState.stores.some(s => s.id === kioskSelectedStoreId);
      if (!kioskExists) {
        setKioskSelectedStoreIdState(defaultStoreId);
        localStorage.setItem('sharestamps_kiosk_selected_store_id', defaultStoreId);
      }

      const ownerExists = dbState.stores.some(s => s.id === ownerSelectedStoreId);
      if (!ownerExists) {
        setOwnerSelectedStoreIdState(defaultStoreId);
        localStorage.setItem('sharestamps_owner_selected_store_id', defaultStoreId);
      }
    }
  }, [dbState, selectedStoreId, customerSelectedStoreId, kioskSelectedStoreId, ownerSelectedStoreId]);

  const [ownerPassword, setOwnerPasswordState] = useState<string>(() => {
    return localStorage.getItem('sharestamps_owner_password') || '1234';
  });

  const setOwnerPassword = (pw: string) => {
    setOwnerPasswordState(pw);
    localStorage.setItem('sharestamps_owner_password', pw);
  };

  const [currentOwner, setCurrentOwnerState] = useState<User | null>(null);

  const setCurrentOwner = (owner: User | null) => {
    setCurrentOwnerState(owner);
    if (owner) {
      localStorage.setItem('sharestamps_session_owner', JSON.stringify(owner));
    } else {
      localStorage.removeItem('sharestamps_session_owner');
    }
  };

  const migrateDatabaseState = (parsed: any): { state: any; migrated: boolean } => {
    let migrated = false;
    if (!parsed) return { state: parsed, migrated };

    if (parsed.users && Array.isArray(parsed.users)) {
      parsed.users = parsed.users.map((u: any) => {
        if (u.name && u.name.startsWith('손님_')) {
          migrated = true;
          return { ...u, name: u.name.replace('손님_', '회원_') };
        }
        return u;
      });
    }

    if (parsed.stores && Array.isArray(parsed.stores)) {
      parsed.stores = parsed.stores.map((s: any) => {
        let updatedStore = { ...s };
        let storeMigrated = false;
        if (s.earningIntervalMinutes === undefined) {
          updatedStore.earningIntervalMinutes = 60;
          storeMigrated = true;
        }
        if (s.snsSettings === undefined) {
          updatedStore.snsSettings = {
            facebookEnabled: true,
            instagramEnabled: true,
            threadsEnabled: true,
            linkedinEnabled: false,
            youtubeEnabled: false,
            tiktokEnabled: true,
            googleEnabled: true
          };
          updatedStore.snsConfig = {
            googlePlaceId: '',
            googleReviewUrl: '',
            googleConnected: false,
            facebookPageId: '',
            facebookPageName: '',
            facebookConnected: false,
            threadsUsername: '',
            threadsConnected: false,
            linkedinPageId: '',
            linkedinConnected: false,
            youtubeChannelId: '',
            youtubeConnected: false,
            tiktokUsername: '',
            tiktokConnected: false
          };
          storeMigrated = true;
        } else {
          let snsMigrated = false;
          if (s.snsSettings.googleEnabled === undefined) {
            updatedStore.snsSettings = {
              ...s.snsSettings,
              googleEnabled: true
            };
            snsMigrated = true;
          }
          if (s.snsConfig === undefined) {
            updatedStore.snsConfig = {
              googlePlaceId: '',
              googleReviewUrl: '',
              googleConnected: false,
              facebookPageId: '',
              facebookPageName: '',
              facebookConnected: false,
              threadsUsername: '',
              threadsConnected: false,
              linkedinPageId: '',
              linkedinConnected: false,
              youtubeChannelId: '',
              youtubeConnected: false,
              tiktokUsername: '',
              tiktokConnected: false
            };
            snsMigrated = true;
          } else {
            let configMigrated = false;
            const config = s.snsConfig;
            if (config.threadsConnected === undefined) { config.threadsUsername = ''; config.threadsConnected = false; configMigrated = true; }
            if (config.linkedinConnected === undefined) { config.linkedinPageId = ''; config.linkedinConnected = false; configMigrated = true; }
            if (config.youtubeConnected === undefined) { config.youtubeChannelId = ''; config.youtubeConnected = false; configMigrated = true; }
            if (config.tiktokConnected === undefined) { config.tiktokUsername = ''; config.tiktokConnected = false; configMigrated = true; }
            if (configMigrated) {
              updatedStore.snsConfig = {
                ...s.snsConfig,
                threadsUsername: config.threadsUsername || '',
                threadsConnected: config.threadsConnected || false,
                linkedinPageId: config.linkedinPageId || '',
                linkedinConnected: config.linkedinConnected || false,
                youtubeChannelId: config.youtubeChannelId || '',
                youtubeConnected: config.youtubeConnected || false,
                tiktokUsername: config.tiktokUsername || '',
                tiktokConnected: config.tiktokConnected || false
              };
              snsMigrated = true;
            }
          }
          if (snsMigrated) storeMigrated = true;
        }
        if (storeMigrated) migrated = true;
        return updatedStore;
      });
    }

    if (!parsed.paymentRequests) {
      parsed.paymentRequests = [];
      migrated = true;
    } else if (Array.isArray(parsed.paymentRequests)) {
      parsed.paymentRequests = parsed.paymentRequests.map((r: any) => {
        if (r.userName && r.userName.includes('손님_')) {
          migrated = true;
          return { ...r, userName: r.userName.replace('손님_', '회원_') };
        }
        return r;
      });
    }

    if (!parsed.giftCards || parsed.giftCards.length > 0) {
      parsed.giftCards = [];
      migrated = true;
    }
    if (!parsed.giftCardTransactions || parsed.giftCardTransactions.length > 0) {
      parsed.giftCardTransactions = [];
      migrated = true;
    }
    if (!parsed.categories) {
      parsed.categories = [
        'Bakery (베이커리)',
        'Cafe (카페)',
        'Restaurant (식당)',
        'Retail (유통/마트)',
        'Salon (미용/헤어)'
      ];
      migrated = true;
    }

    // NPO 코드명 기입 자동 마이그레이션
    if (parsed.nonProfits && Array.isArray(parsed.nonProfits)) {
      parsed.nonProfits = parsed.nonProfits.map((n: any) => {
        if (!n.code) {
          migrated = true;
          let codeName = 'UNKNOWN';
          if (n.id === 'npo_1') codeName = 'SAVE_THE_CHILDREN';
          if (n.id === 'npo_2') codeName = 'GREENPEACE';
          if (n.id === 'npo_3') codeName = 'KARA';
          return { ...n, code: codeName };
        }
        return n;
      });
    }

    // npo_1 -> 실제 활성 NPO 자동 포워딩 마이그레이션 (공란 초기화 후 npo_1 기본값으로 올라오는 비정상 데이터 구제)
    const activeNpos = parsed.nonProfits ? parsed.nonProfits.filter((n: any) => n.status === 'active') : [];
    if (activeNpos.length > 0 && !parsed.nonProfits.some((n: any) => n.id === 'npo_1')) {
      const realNpoId = activeNpos[0].id;
      if (parsed.donations && Array.isArray(parsed.donations)) {
        parsed.donations = parsed.donations.map((d: any) => {
          if (d.nonProfitId === 'npo_1') {
            migrated = true;
            return { ...d, nonProfitId: realNpoId };
          }
          return d;
        });
      }
      if (parsed.gifts && Array.isArray(parsed.gifts)) {
        parsed.gifts = parsed.gifts.map((g: any) => {
          if (g.recipientId === 'npo_1') {
            migrated = true;
            return { ...g, recipientId: realNpoId };
          }
          return g;
        });
      }
    }

    // 조PD 회원의 기부 내역 정밀 보정 (자가치유 버그 완벽 패치)
    if (parsed.users && Array.isArray(parsed.users)) {
      const joPdUser = parsed.users.find((u: any) => u.name === '조PD' || u.nickname === '조PD' || (u.name && u.name.includes('조PD')));
      if (joPdUser) {
        const joPdId = joPdUser.id;
        const seesawNpo = parsed.nonProfits.find((n: any) => n.name && n.name.includes('시소'));
        const seesawId = seesawNpo ? seesawNpo.id : null;

        // 1) donations 복구 및 매핑 (3개짜리 기부 ➔ npo_4 리셋, 1개짜리 기부 ➔ 시소 복구)
        if (parsed.donations && Array.isArray(parsed.donations)) {
          parsed.donations = parsed.donations.map((d: any) => {
            if (d.donorId === joPdId) {
              // 스탬프 3개짜리 기부만 미주도산안창호기념사업회(npo_4)로 소급 연결 및 금액 0원 리셋
              if (d.stampCount === 3 || d.monetaryValue === 8.57 || (d.nonProfitId === 'npo_4' && d.stampCount === 0 && d.createdAt && d.createdAt < '2026-06-15T01:10:00')) {
                if (d.nonProfitId !== 'npo_4' || d.stampCount !== 0 || d.monetaryValue !== 0) {
                  migrated = true;
                  return { ...d, nonProfitId: 'npo_4', stampCount: 0, monetaryValue: 0 };
                }
              }
              // 스탬프 1개짜리 기부 건들은 원래 수신처인 '시소 스펙트럼장애'로 정상 매핑 및 0.57달러 복구
              else if (seesawId && (d.nonProfitId === 'npo_1' || d.nonProfitId === 'npo_4')) {
                migrated = true;
                return { ...d, nonProfitId: seesawId, stampCount: 1, monetaryValue: 0.57 };
              }
            }
            return d;
          });
        }

        // 2) gifts 복구 및 매핑 (3개짜리 선물 ➔ npo_4 리셋, 1개짜리 선물 ➔ 시소 복구)
        if (parsed.gifts && Array.isArray(parsed.gifts)) {
          parsed.gifts = parsed.gifts.map((g: any) => {
            if (g.senderId === joPdId) {
              // 스탬프 3개짜리 선물만 미주도산안창호기념사업회(npo_4)로 소급 연결 및 수량 0개 리셋
              if (g.stampsTransferred === 3 || g.stampsSent === 3 || (g.recipientId === 'npo_4' && g.stampsTransferred === 0 && g.createdAt && g.createdAt < '2026-06-15T01:10:00')) {
                if (g.recipientId !== 'npo_4' || g.stampsTransferred !== 0 || g.stampsSent !== 0) {
                  migrated = true;
                  return { ...g, recipientId: 'npo_4', stampsTransferred: 0, stampsSent: 0 };
                }
              }
              // 스탬프 1개짜리 선물 건들은 원래 수신처인 '시소 스펙트럼장애'로 정상 매핑 및 수량 1개 복구
              else if (seesawId && (g.recipientId === 'npo_1' || g.recipientId === 'npo_4')) {
                migrated = true;
                return { ...g, recipientId: seesawId, stampsTransferred: 1, stampsSent: 1 };
              }
            }
            return g;
          });
        }
      }
    }

    // 스탬프 카드 개별 가치 이력 자가치유 마이그레이션
    if (parsed.stampCards && Array.isArray(parsed.stampCards)) {
      parsed.stampCards = parsed.stampCards.map((card: any) => {
        if (!card.stamps || !Array.isArray(card.stamps) || card.stamps.length !== card.currentStamps) {
          migrated = true;
          const store = parsed.stores ? parsed.stores.find((s: any) => s.id === card.storeId) : null;
          const valPerStamp = store ? store.pointRewardPer7Stamps / 7 : 5 / 7;
          
          const newStamps = [];
          for (let i = 0; i < card.currentStamps; i++) {
            newStamps.push({
              id: `stamp_mig_${card.id}_${i}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              acquiredAt: card.updatedAt || getSkewCorrectedIsoString(),
              cashValue: parseFloat(valPerStamp.toFixed(2))
            });
          }
          return { ...card, stamps: newStamps };
        }
        return card;
      });
    }

    return { state: parsed, migrated };
  };

  // 데이터베이스 초기 로딩 및 초기 데이터 설정 (Seeding) 및 세션 복원
  useEffect(() => {
    const savedUser = localStorage.getItem('sharestamps_session_user');
    const savedToken = localStorage.getItem('sharestamps_session_token');
    if (savedUser && savedToken) {
      try {
        let user = JSON.parse(savedUser);
        if (user && user.name && user.name.startsWith('손님_')) {
          user.name = user.name.replace('손님_', '회원_');
          localStorage.setItem('sharestamps_session_user', JSON.stringify(user));
        }
        setCurrentUser(user);
        setCurrentDeviceToken(savedToken);
      } catch (e) {
        // ignore
      }
    }

    const savedOwner = localStorage.getItem('sharestamps_session_owner');
    if (savedOwner) {
      try {
        setCurrentOwnerState(JSON.parse(savedOwner));
      } catch (e) {
        // ignore
      }
    }

    const loadFromLocalStorage = () => {
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          const { state: migratedState, migrated } = migrateDatabaseState(parsed);
          if (migrated) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(migratedState));
          }
          setDbState(migratedState);
        } catch (e) {
          initializeDefaultDb();
        }
      } else {
        initializeDefaultDb();
      }
    };

    if (firestoreDb) {
      const docRef = doc(firestoreDb, 'sharestamps', 'database');
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.metadata.hasPendingWrites) {
          return;
        }

        // 리셋 직후에는 merge/migration 일절 하지 않고 서버 데이터를 무조건 수용
        const resetPending = sessionStorage.getItem('sharestamps_reset_pending');
        if (resetPending) {
          sessionStorage.removeItem('sharestamps_reset_pending');
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            if (data && data.state) {
              setDbState(data.state);
              try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.state)); } catch(e) {}
            }
          }
          return;
        }

        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          if (data && data.state) {
            const serverState = data.state;
            updateClockOffset(serverState.updatedAt);
            let mergedState = { ...serverState };
            let hasSelfHealed = false;

            // 서버 데이터가 초기화 상태(빈 배열)인지 판별
            const isServerReset = (
              Array.isArray(serverState.stores) && serverState.stores.length === 0 &&
              Array.isArray(serverState.users) && serverState.users.length === 0
            );

            // 초기화 상태가 아닐 때만 로컬과 병합 시도
            if (!isServerReset) {
              const localDataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
              if (localDataStr) {
                try {
                  const localState = JSON.parse(localDataStr);
                  if (localState) {
                    const serverResetAt = serverState.resetAt || '';
                    const localResetAt = localState.resetAt || '';

                    if (serverResetAt !== localResetAt) {
                      if (serverResetAt > localResetAt) {
                        // 서버의 리셋 시점이 더 최신이므로 로컬 데이터를 파기하고 서버 상태 강제 수용
                        mergedState = { ...serverState };
                      } else {
                        // 로컬의 리셋 시점이 더 최신이므로 캐시/서버의 옛날 데이터 무시
                        mergedState = { ...localState };
                      }
                    } else {
                      mergedState = mergeStates(serverState, localState);
                      const { updatedAt: _serverUpdatedAt, ...serverComparable } = serverState;
                      const { updatedAt: _mergedUpdatedAt, ...mergedComparable } = mergedState;
                      if (JSON.stringify(serverComparable) !== JSON.stringify(mergedComparable)) {
                        hasSelfHealed = true;
                      }
                    }
                  }
                } catch (e) {
                  console.error("Failed to parse localState for smart merge:", e);
                }
              }
            } else {
              // 서버가 빈 상태인 경우, 로컬에 저장된 리셋 내역이 없거나 더 옛날이면 빈 상태를 강제 수용
              const localDataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
              if (localDataStr) {
                try {
                  const localState = JSON.parse(localDataStr);
                  if (localState) {
                    const serverResetAt = serverState.resetAt || '';
                    const localResetAt = localState.resetAt || '';
                    if (localResetAt > serverResetAt) {
                      // 로컬이 더 최신인 리셋이거나 다른 수정사항이 있으면 로컬 유지
                      mergedState = { ...localState };
                    } else {
                      mergedState = { ...serverState };
                    }
                  }
                } catch (e) {}
              }
            }

            const { state: migratedState, migrated } = migrateDatabaseState(mergedState);
            setDbState(migratedState);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(migratedState));
            if (migrated || hasSelfHealed) {
              const stateToSave = {
                ...migratedState,
                updatedAt: getSkewCorrectedIsoString()
              };
              setDoc(docRef, { state: stateToSave }).catch(console.error);
            }
          }
        } else {
          // Firestore에 데이터가 없는 경우 로컬 스토리지에 있는 데이터를 복사하거나 새로 시딩
          const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
          let initialDbToUse;
          if (localData) {
            try {
              initialDbToUse = JSON.parse(localData);
            } catch (e) {}
          }
          if (!initialDbToUse) {
            initialDbToUse = getDefaultDbSeed();
          }
          
          const { state: migratedState } = migrateDatabaseState(initialDbToUse);
          setDbState(migratedState);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(migratedState));
          setDoc(docRef, { state: migratedState }).catch(console.error);
        }
      }, (err) => {
        console.error("Firestore onSnapshot error, falling back to local storage:", err);
        loadFromLocalStorage();
      });
      return () => unsubscribe();
    } else {
      loadFromLocalStorage();
    }
  }, []);

  // 기기/탭 간 실시간 데이터베이스 및 세션 동기화를 위한 storage 이벤트 리스너
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            setDbState(parsed);
          }
        } catch (err) {
          // ignore
        }
      }
      
      if (e.key === 'sharestamps_session_user') {
        if (e.newValue) {
          try {
            setCurrentUser(JSON.parse(e.newValue));
          } catch (err) {
            // ignore
          }
        } else {
          setCurrentUser(null);
        }
      }
      if (e.key === 'sharestamps_session_token') {
        setCurrentDeviceToken(e.newValue);
      }
      if (e.key === 'sharestamps_session_owner') {
        if (e.newValue) {
          try {
            setCurrentOwnerState(JSON.parse(e.newValue));
          } catch (err) {
            // ignore
          }
        } else {
          setCurrentOwnerState(null);
        }
      }
      if (e.key === 'sharestamps_selected_store_id') {
        if (e.newValue) {
          setSelectedStoreIdState(e.newValue);
        }
      }
      if (e.key === 'sharestamps_language') {
        if (e.newValue) {
          setLanguageState(e.newValue as 'ko' | 'en');
        }
      }
      if (e.key === 'sharestamps_owner_password') {
        if (e.newValue) {
          setOwnerPasswordState(e.newValue);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);




  // 활동 정지된 세션 실시간 강제 로그아웃 감시 및 매장 상태에 따른 점주 세션 만료 감시
  useEffect(() => {
    if (!dbState) return;
    if (currentUser && currentUser.role === 'customer') {
      const freshUser = dbState.users.find(u => u.id === currentUser.id);
      if (!freshUser) {
        logout();
      } else if (freshUser.status === 'suspended') {
        logout();
      }
    }
    if (currentOwner) {
      const freshOwner = dbState.users.find(u => u.id === currentOwner.id);
      if (freshOwner && freshOwner.status === 'suspended') {
        setCurrentOwner(null);
      } else {
        // 점주의 매장이 삭제되었거나 정지되었는지 확인
        const ownerStore = dbState.stores.find(s => s.ownerId === currentOwner.id);
        if (!ownerStore) {
          // 점주의 매장이 삭제된 경우 세션 만료
          setCurrentOwner(null);
        } else if (ownerStore.status === 'suspended') {
          // 점주의 매장이 정지된 경우 세션 만료
          setCurrentOwner(null);
        }
      }
    }
  }, [dbState, currentUser, currentOwner]);

  const getDefaultDbSeed = () => {
    const defaultUsers: User[] = [
      { id: 'owner_id_1', phoneNumber: '01011112222', nickname: 'coffee_boss', name: '김사장', role: 'owner', loginId: 'coffee_boss', password: '1234' },
      { id: 'owner_id_2', phoneNumber: '01033334444', nickname: 'hair_master', name: '이원장', role: 'owner', loginId: 'hair_master', password: '1234' },
      { id: 'user_id_jimin', phoneNumber: '01055556666', nickname: 'coffee_lover', name: '박지민', role: 'customer' },
      { id: 'user_id_yujin', phoneNumber: '01077778888', nickname: 'bread_girl', name: '최유진', role: 'customer' },
      { id: 'admin_id_super', phoneNumber: '01099999999', nickname: 'super_admin', name: '운영자', role: 'admin' },
    ];

    const defaultDevices: UserDevice[] = [
      { id: 'dev_1', userId: 'user_id_jimin', deviceToken: 'token_jimin_device' },
      { id: 'dev_2', userId: 'user_id_yujin', deviceToken: 'token_yujin_device' }
    ];

    const defaultStores: Store[] = [
      {
        id: 'store_id_1',
        name: '스타벅스 강남점',
        category: 'Cafe (카페)',
        pointRewardPer7Stamps: 5,
        currency: 'USD',
        earningIntervalMinutes: 60,
        ownerId: 'owner_id_1',
        description: '강남역 2번 출구 앞, 신선한 스페셜티 커피와 맛있는 디저트가 있는 아늑한 공간입니다.',
        address: '서울시 강남구 강남대로 390',
        phone: '02-123-4567',
        hours: '07:00 ~ 22:00',
        thumbnailUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500',
        bannerUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000',
        menuItems: [
          { name: '아메리카노', price: 4.5, description: '에스프레소에 뜨거운 물을 더한 대중적인 커피' },
          { name: '카페라떼', price: 5.0, description: '에스프레소와 부드러운 우유의 조화' },
          { name: '초콜릿 칩 쿠키', price: 3.0 },
          { name: '블루베리 치즈케이크', price: 6.5 }
        ]
      },
      {
        id: 'store_id_2',
        name: '박준뷰티랩 신촌점',
        category: 'Salon (미용/헤어)',
        pointRewardPer7Stamps: 10,
        currency: 'USD',
        earningIntervalMinutes: 30,
        ownerId: 'owner_id_2',
        description: '최신 트렌드 헤어 스타일과 전문 클리닉으로 최상의 아름다움을 선사하는 미용실입니다.',
        address: '서울시 서대문구 신촌로 109',
        phone: '02-765-4321',
        hours: '10:00 ~ 20:00',
        thumbnailUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500',
        bannerUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1000',
        menuItems: [
          { name: '디자인 컷', price: 25.0, description: '고객맞춤형 스타일링 커트' },
          { name: '컬러 염색', price: 80.0, description: '트렌디한 프리미엄 염색' },
          { name: '헤어 클리닉', price: 120.0, description: '손상된 모발에 수분과 단백질 집중 공급' }
        ]
      },
      {
        id: 'store_id_unassigned_1',
        name: '러브레터 디저트카페',
        category: 'Cafe (카페)',
        pointRewardPer7Stamps: 4,
        currency: 'USD',
        earningIntervalMinutes: 10,
        ownerId: 'none',
        description: '달콤한 조각 케이크와 수제 마카롱을 판매하는 분위기 좋은 디저트 전문점입니다.',
        address: '서울시 마포구 와우산로 88',
        phone: '02-333-7777',
        hours: '11:00 ~ 21:00',
        thumbnailUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500',
        bannerUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1000',
        menuItems: [
          { name: '마카롱 세트 (4구)', price: 12.0 },
          { name: '딸기 생크림 케이크', price: 7.5 },
          { name: '밀크티', price: 6.0 }
        ]
      },
      {
        id: 'store_id_unassigned_2',
        name: '본도시락 역삼점',
        category: 'Restaurant (식당)',
        pointRewardPer7Stamps: 6,
        currency: 'USD',
        earningIntervalMinutes: 0,
        ownerId: 'none',
        description: '바쁜 일상 속, 정성 가득한 한식 도시락으로 집밥 같은 따뜻함을 전해드립니다.',
        address: '서울시 강남구 테헤란로 123',
        phone: '02-555-8888',
        hours: '09:00 ~ 21:00',
        thumbnailUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        bannerUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000',
        menuItems: [
          { name: '바싹불고기 도시락', price: 11.5, description: '본도시락 베스트 메뉴' },
          { name: '제육볶음 도시락', price: 10.0 },
          { name: '버섯소불고기 도시락', price: 13.0 }
        ]
      }
    ];

    const defaultReviews: StoreReview[] = [
      {
        id: 'review_1',
        storeId: 'store_id_1',
        userId: 'user_id_jimin',
        userName: '박지민',
        userNickname: 'coffee_lover',
        rating: 5,
        comment: '커피 맛이 정말 깊고 깔끔해서 자주 방문해요! 넓고 쾌적한 매장과 친절한 직원분들 덕분에 항상 기분 좋은 시간을 보내고 가네요.',
        photoUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300',
        createdAt: getSkewCorrectedIsoString()
      },
      {
        id: 'review_2',
        storeId: 'store_id_2',
        userId: 'user_id_yujin',
        userName: '최유진',
        userNickname: 'bread_girl',
        rating: 5,
        comment: '머리 손상이 심해서 걱정했는데 클리닉 받고 나니 모발이 너무 부드러워졌어요! 디자이너님들이 꼼꼼하게 상담해 주시고 제 얼굴형에 어울리는 인생 컷 찾아주셨네요.',
        photoUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300',
        createdAt: getSkewCorrectedIsoString()
      },
      {
        id: 'review_3',
        storeId: 'store_id_unassigned_1',
        userId: 'user_id_jimin',
        userName: '박지민',
        userNickname: 'coffee_lover',
        rating: 4,
        comment: '달콤한 디저트와 마카롱이 정말 일품입니다. 매장 인테리어가 아늑하고 너무 예뻐서 갈 때마다 인스타 감성 샷 잔뜩 찍고 와요.',
        photoUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300',
        createdAt: getSkewCorrectedIsoString()
      }
    ];

    const defaultNPOs: NonProfit[] = [
      { id: 'npo_1', code: 'SAVE_THE_CHILDREN', name: '세이브더칠드런 (어린이 급식 지원)', description: '결식 우려 아동들에게 따뜻한 식사를 지원합니다.', status: 'active' },
      { id: 'npo_2', code: 'GREENPEACE', name: '그린피스 (기후 위기 대응)', description: '지구 온난화 방지 및 환경 보호 활동을 전개합니다.', status: 'active' },
      { id: 'npo_3', code: 'KARA', name: 'KARA (동물권 행동)', description: '위기에 처한 유기동물을 구조하고 지원합니다.', status: 'active' }
    ];

    return {
      users: defaultUsers,
      userDevices: defaultDevices,
      stores: defaultStores,
      stampCards: [],
      storePoints: [],
      nonProfits: defaultNPOs,
      donations: [],
      gifts: [],
      stampTransactions: [],
      pointTransactions: [],
      receiptScans: [],
      paymentRequests: [],
      giftCards: [],
      giftCardTransactions: [],
      reviews: defaultReviews,
      adBanners: [
        {
          id: 'ad_default_duracell',
          title: '듀라셀 CR2032 리튬 코인 건전지 9개입 (어린이 안전 포장)',
          subtitle: '아마존 제휴 프로그램의 일환으로 수수료를 제공받을 수 있습니다.',
          linkUrl: 'https://www.amazon.com/dp/B0855G6FVS',
          status: 'active' as const,
          createdAt: getSkewCorrectedIsoString()
        }
      ],
      categories: [
        'Bakery (베이커리)',
        'Cafe (카페)',
        'Restaurant (식당)',
        'Retail (유통/마트)',
        'Salon (미용/헤어)'
      ]
    };
  };

  // 상태 변경 시 LocalStorage 및 Firestore에 반영
  const updateDbState = async (newState: typeof dbState, forceOverwrite: boolean = false) => {
    if (!newState) return;
    const stateWithTimestamp = {
      ...newState,
      updatedAt: getSkewCorrectedIsoString()
    };
    
    // 로컬 반응성 유지를 위해 즉시 선반영
    setDbState(stateWithTimestamp);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateWithTimestamp));
      
      if (firestoreDb) {
        const docRef = doc(firestoreDb, 'sharestamps', 'database');
        
        // 1. 서버의 최신 문서를 비동기로 1회 조회
        const docSnap = await getDoc(docRef);
        let finalState = { ...stateWithTimestamp };
        
        if (docSnap.exists()) {
          const serverData = docSnap.data() as any;
          if (serverData && serverData.state) {
            const serverState = serverData.state;
            updateClockOffset(serverState.updatedAt);
            
            const serverResetAt = serverState.resetAt || '';
            const localResetAt = stateWithTimestamp.resetAt || '';

            if (serverResetAt !== localResetAt) {
              if (serverResetAt > localResetAt) {
                // 서버의 리셋 정보가 최신이면 수용
                finalState = { ...serverState };
              } else {
                // 로컬의 리셋 정보가 최신이면 로컬 강제 유지
                finalState = { ...stateWithTimestamp };
              }
            } else {
              // 2. 서버 데이터와 로컬 변경 사항 정밀 병합
              if (forceOverwrite) {
                finalState = { ...stateWithTimestamp };
              } else {
                let adjustedLocalState = { ...stateWithTimestamp };
                const serverTime = new Date(serverState.updatedAt || 0).getTime();
                const localTime = new Date(stateWithTimestamp.updatedAt || 0).getTime();
                if (serverTime >= localTime) {
                  const adjustedTime = new Date(serverTime + 1000).toISOString();
                  adjustedLocalState.updatedAt = adjustedTime;
                }
                finalState = mergeStates(serverState, adjustedLocalState);
              }
            }
          }
        }
        
        // 3. 병합된 상태를 최종 업로드
        await setDoc(docRef, { state: finalState });
        
        // 4. 로컬 상태 최신 갱신
        setDbState(finalState);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalState));
      }
    } catch (e) {
      console.error('Failed to save or sync database:', e);
      if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        alert(
          language === 'ko'
            ? '선택한 이미지의 크기가 너무 커서 로컬 저장소 용량 제한을 초과했습니다. 더 작은 용량의 이미지를 사용해 주세요.'
            : 'The selected image is too large and exceeded local storage quota. Please use a smaller image file.'
        );
      }
    }
  };

  const repairedAiReviewIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!dbState) return;

    const aiReviewsMissingStamp = (dbState.reviews || []).filter(review => {
      if (!review.isAIContent || !review.userId || review.userId === 'guest') return false;
      if (repairedAiReviewIdsRef.current.has(review.id)) return false;
      return !(dbState.stampTransactions || []).some(tx => (
        tx.referenceId === review.id &&
        tx.source === 'ai_review' &&
        tx.type === 'earn' &&
        tx.amount > 0
      ));
    });

    if (aiReviewsMissingStamp.length === 0) return;

    const reviewToRepair = [...aiReviewsMissingStamp].sort((a, b) => (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ))[0];

    const cardIdx = dbState.stampCards.findIndex(card => (
      card.userId === reviewToRepair.userId &&
      card.storeId === reviewToRepair.storeId
    ));
    const currentStamps = cardIdx > -1 ? dbState.stampCards[cardIdx].currentStamps : 0;
    if (currentStamps >= 7) {
      repairedAiReviewIdsRef.current.add(reviewToRepair.id);
      return;
    }

    const store = dbState.stores.find(s => s.id === reviewToRepair.storeId);
    const rewardPer7 = store ? store.pointRewardPer7Stamps : 5;
    const valuePerStamp = rewardPer7 / 7;
    const stampToAdd = {
      id: `stamp_${Date.now()}_ai_review_repair`,
      acquiredAt: getSkewCorrectedIsoString(),
      cashValue: parseFloat(valuePerStamp.toFixed(2))
    };

    const updatedCards = [...dbState.stampCards];
    if (cardIdx === -1) {
      updatedCards.push({
        id: `card_${Date.now()}_ai_repair`,
        userId: reviewToRepair.userId,
        storeId: reviewToRepair.storeId,
        currentStamps: 1,
        stamps: [stampToAdd],
        updatedAt: getSkewCorrectedIsoString()
      });
    } else {
      const card = updatedCards[cardIdx];
      updatedCards[cardIdx] = {
        ...card,
        currentStamps: currentStamps + 1,
        stamps: [...(card.stamps || []), stampToAdd],
        updatedAt: getSkewCorrectedIsoString()
      };
    }

    repairedAiReviewIdsRef.current.add(reviewToRepair.id);
    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      stampTransactions: [
        ...(dbState.stampTransactions || []),
        {
          id: `stx_${Date.now()}_ai_review_repair`,
          userId: reviewToRepair.userId,
          storeId: reviewToRepair.storeId,
          amount: 1,
          type: 'earn',
          source: 'ai_review',
          referenceId: reviewToRepair.id,
          createdAt: getSkewCorrectedIsoString()
        }
      ]
    });
  }, [dbState]);

  const initializeDefaultDb = async (completeEmpty?: boolean) => {
    const initialDb = completeEmpty ? {
      users: [],
      userDevices: [],
      stores: [],
      stampCards: [],
      storePoints: [],
      nonProfits: [],
      donations: [],
      gifts: [],
      stampTransactions: [],
      pointTransactions: [],
      receiptScans: [],
      categories: ['Cafe (카페)', 'Restaurant (식당)', 'Retail (유통/마트)', 'Salon (미용/헤어)'],
      donationsLedger: [],
      donationsAudit: [],
      giftsLedger: [],
      giftCards: [],
      giftCardTransactions: [],
      reviews: [],
      adBanners: [],
      paymentRequests: [],
      ownerRequests: []
    } : getDefaultDbSeed();

    const { state: migratedState } = migrateDatabaseState(initialDb);

    const stateWithTimestamp = {
      ...migratedState,
      resetAt: getSkewCorrectedIsoString(),
      updatedAt: getSkewCorrectedIsoString()
    };

    // 로컬 즉시 반영
    setDbState(stateWithTimestamp);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateWithTimestamp));
    } catch (e) { /* ignore */ }

    // Firestore에 mergeStates 우회하여 강제 덮어쓰기
    if (firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'sharestamps', 'database');
        await setDoc(docRef, { state: stateWithTimestamp });
      } catch (e) {
        console.error('Failed to force-write reset state to Firestore:', e);
        throw e;
      }
    }
  };

  const resetDatabase = async (completeEmpty?: boolean) => {
    // 리셋 플래그 설정 - 리로드 후 onSnapshot에서 merge를 완전 차단
    sessionStorage.setItem('sharestamps_reset_pending', 'true');
    // localStorage 완전 삭제
    localStorage.clear();
    try {
      await initializeDefaultDb(completeEmpty);
      setCurrentUser(null);
      setCurrentDeviceToken(null);
      setCurrentOwner(null);
      playVoiceGuidance(
        language === 'ko' ? "데이터베이스 초기화가 완료되었습니다." : "Database initialization complete.",
        language
      );
    } catch (e) {
      alert(language === 'ko' ? `서버 초기화 실패: ${e instanceof Error ? e.message : String(e)}` : `Server reset failed: ${e}`);
      throw e;
    }
  };

  const exportDatabase = (): string => {
    if (!dbState) return '';
    return JSON.stringify(dbState);
  };

  const importDatabase = (dbJson: string): { success: boolean; message: string } => {
    try {
      const parsed = JSON.parse(dbJson);
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.stores)) {
        updateDbState(parsed);
        playVoiceGuidance(
          language === 'ko' ? "데이터베이스를 성공적으로 가져왔습니다." : "Database successfully imported.",
          language
        );
        return { success: true, message: 'Import successful' };
      }
      return { success: false, message: language === 'ko' ? '올바르지 않은 데이터 형식입니다.' : 'Invalid database format.' };
    } catch (e) {
      return { success: false, message: language === 'ko' ? '데이터 구문 분석 실패.' : 'Failed to parse database JSON.' };
    }
  };

  // --- 유저 세션 관리 ---
  const loginByDeviceToken = (token: string): boolean => {
    if (!dbState) return false;
    const device = dbState.userDevices.find(d => d.deviceToken === token);
    if (device) {
      const user = dbState.users.find(u => u.id === device.userId);
      if (user) {
        if (user.status === 'suspended') {
          return false;
        }
        setCurrentUser(user);
        setCurrentDeviceToken(token);
        localStorage.setItem('sharestamps_session_user', JSON.stringify(user));
        localStorage.setItem('sharestamps_session_token', token);
        return true;
      }
    }
    return false;
  };

  const loginByPhoneNumber = (phoneNumber: string, deviceToken: string): User | null => {
    if (!dbState) return null;
    const cleanInput = phoneNumber.replace(/\D/g, '');
    const user = dbState.users.find(u => u.phoneNumber.replace(/\D/g, '') === cleanInput && u.status !== 'deleted');
    if (user) {
      if (user.status === 'suspended') {
        playVoiceGuidance(
          language === 'ko' ? "활동이 정지된 계정입니다. 본사에 문의하세요." : "This account has been suspended. Please contact HQ.",
          language
        );
        return null;
      }

      // 기기당 2개 회원 로그인 방지 (중복 검사)
      const deviceAssigned = dbState.userDevices.find(d => d.deviceToken === deviceToken);
      if (deviceAssigned && deviceAssigned.userId !== user.id) {
        const assignedUser = dbState.users.find(u => u.id === deviceAssigned.userId);
        if (assignedUser && assignedUser.phoneNumber.replace(/\D/g, '') !== cleanInput) {
          playVoiceGuidance(
            language === 'ko' ? "다른 회원의 계정이 이미 연동된 기기입니다." : "This device is already linked to another account.",
            language
          );
          alert(
            language === 'ko'
              ? `본 기기는 이미 다른 회원 계정(@${assignedUser.nickname})에 연동되어 있습니다. 1기기 1계정 정책에 따라 로그인이 차단됩니다.`
              : `This device is already linked to another account (@${assignedUser.nickname}). Multiple logins are restricted.`
          );
          return null;
        }
      }
      setCurrentUser(user);
      localStorage.setItem('sharestamps_session_user', JSON.stringify(user));
      localStorage.setItem('sharestamps_last_phone_number', phoneNumber);
      // 디바이스 토큰 자동 찾기 또는 신규 가발급
      const device = dbState.userDevices.find(d => d.userId === user.id);
      if (device) {
        setCurrentDeviceToken(device.deviceToken);
        localStorage.setItem('sharestamps_session_token', device.deviceToken);
      } else {
        const newToken = `token_${Math.random().toString(36).substring(2)}`;
        const newDevice: UserDevice = {
          id: `dev_${Date.now()}`,
          userId: user.id,
          deviceToken: newToken
        };
        const updatedDevices = [...dbState.userDevices, newDevice];
        updateDbState({ ...dbState, userDevices: updatedDevices });
        setCurrentDeviceToken(newToken);
        localStorage.setItem('sharestamps_session_token', newToken);
      }
      
      const cleanName = user.name.replace('회원_', ''); // 앞에 회원 빼고
      playVoiceGuidance(
        language === 'ko' ? `${cleanName}님, 반갑습니다.` : `Welcome, ${cleanName}.`,
        language
      );
      return user;
    }
    return null;
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentDeviceToken(null);
    localStorage.removeItem('sharestamps_session_user');
    localStorage.removeItem('sharestamps_session_token');
  };

  const registerOwner = (name: string, storeId: string, loginId: string, password: string) => {
    if (!dbState) return { success: false, message: 'Database not loaded.' };
    
    // 중복 아이디 체크
    const exists = dbState.users.find(u => u.loginId?.toLowerCase() === loginId.toLowerCase().trim());
    if (exists) {
      return { success: false, message: language === 'ko' ? '이미 존재하는 아이디입니다.' : 'ID already exists.' };
    }

    // 대상 매장 검색 및 중복 사장 배정 방지 검증
    const storeIdx = dbState.stores.findIndex(s => s.id === storeId);
    if (storeIdx === -1) {
      return { success: false, message: language === 'ko' ? '존재하지 않는 매장입니다.' : 'Store does not exist.' };
    }
    const targetStore = dbState.stores[storeIdx];
    const isOwnerRegistered = targetStore.ownerId && 
                              targetStore.ownerId !== 'none' && 
                              targetStore.ownerId !== '' && 
                              dbState.users.some(u => u.id === targetStore.ownerId && u.role === 'owner');
                              
    if (isOwnerRegistered) {
      return { success: false, message: language === 'ko' ? '이미 다른 사장님이 배정된 매장입니다.' : 'Store is already claimed by another owner.' };
    }
    
    const ownerId = `owner_id_${loginId}`;
    const newOwner: User = {
      id: ownerId,
      phoneNumber: '',
      nickname: loginId,
      name,
      role: 'owner',
      loginId,
      password,
      status: 'pending_approval',
      updatedAt: getSkewCorrectedIsoString()
    };
    
    const updatedStores = [...dbState.stores];
    updatedStores[storeIdx] = {
      ...targetStore,
      ownerId: ownerId,
      updatedAt: getSkewCorrectedIsoString()
    };
    
    const updatedUsers = [...dbState.users, newOwner];
    
    updateDbState({
      ...dbState,
      users: updatedUsers,
      stores: updatedStores
    });
    
    setCurrentOwner(newOwner);
    setSelectedStoreId(storeId);
    
    return { success: true, message: 'Registration complete.', owner: newOwner, store: updatedStores[storeIdx] };
  };

  const registerStore = (name: string, ownerId: string, category: Store['category'], pointRewardPer7Stamps: number) => {
    if (!dbState) return { success: false, message: 'Database not loaded.' };
    const storeId = `store_id_${Date.now()}`;
    const newStore: Store = {
      id: storeId,
      name,
      ownerId,
      category,
      pointRewardPer7Stamps,
      currency: 'USD',
      earningIntervalMinutes: 60,
      updatedAt: getSkewCorrectedIsoString()
    };
    updateDbState({
      ...dbState,
      stores: [...dbState.stores, newStore]
    });
    playVoiceGuidance(
      language === 'ko' ? "새로운 매장이 등록되었습니다." : "New store registered.",
      language
    );
    return { success: true, store: newStore };
  };

  const registerUser = (phoneNumber: string, nickname: string, name: string, deviceToken: string, _job?: string, _hobbies?: string[]) => {
    if (!dbState) throw new Error('DB가 준비되지 않았습니다.');
    
    const cleanInput = phoneNumber.replace(/\D/g, '');

    // 기기당 2개 회원 로그인 방지 (중복 검사)
    const deviceAssigned = dbState.userDevices.find(d => d.deviceToken === deviceToken);
    if (deviceAssigned) {
      const assignedUser = dbState.users.find(u => u.id === deviceAssigned.userId);
      if (assignedUser && assignedUser.phoneNumber.replace(/\D/g, '') !== cleanInput) {
        throw new Error(
          language === 'ko'
            ? `본 기기는 이미 다른 회원 계정(@${assignedUser.nickname})에 연동되어 있습니다. 1기기 1계정 정책에 따라 추가 가입이 제한됩니다.`
            : `This device is already linked to another account (@${assignedUser.nickname}). Multiple registrations are restricted.`
        );
      }
    }
    
    // 중복 체크 (전화번호에서 대시 기호를 빼고 매칭)
    const phoneExists = dbState.users.find(u => 
      u.phoneNumber.replace(/\D/g, '') === cleanInput &&
      u.status !== 'deleted'
    );
    if (phoneExists) {
      if (phoneExists.status === 'suspended') {
        throw new Error(language === 'ko' ? '활동이 정지된 계정입니다. 본사에 문의하세요.' : 'This account has been suspended. Please contact HQ.');
      }
      throw new Error(
        language === 'ko'
          ? '이미 가입된 전화번호입니다. 로그인해 주세요.'
          : 'This phone number is already registered. Please log in.'
      );
    }

    const nicknameExists = dbState.users.find(u => 
      u.nickname.toLowerCase() === nickname.toLowerCase().trim() &&
      u.status !== 'deleted'
    );
    if (nicknameExists) {
      throw new Error(
        language === 'ko'
          ? '이미 사용 중인 닉네임입니다. 다른 닉네임으로 가입해 주세요.'
          : 'This nickname is already registered. Please choose another nickname.'
      );
    }

    const newUserId = `user_${Date.now()}`;
    const newUser: User = {
      id: newUserId,
      phoneNumber,
      nickname,
      name,
      role: 'customer'
    };

    const finalNewToken = deviceToken || `token_${Math.random().toString(36).substring(2)}`;
    const newDevice: UserDevice = {
      id: `dev_${Date.now()}`,
      userId: newUserId,
      deviceToken: finalNewToken
    };

    const updatedUsers = [...dbState.users, newUser];
    const updatedDevices = [...dbState.userDevices, newDevice];

    updateDbState({
      ...dbState,
      users: updatedUsers,
      userDevices: updatedDevices
    });

    setCurrentUser(newUser);
    setCurrentDeviceToken(finalNewToken);
    localStorage.setItem('sharestamps_session_user', JSON.stringify(newUser));
    localStorage.setItem('sharestamps_session_token', finalNewToken);
    localStorage.setItem('sharestamps_last_phone_number', phoneNumber);

    playVoiceGuidance(
      language === 'ko' ? "환영합니다! 회원 가입이 완료되었습니다." : "Welcome! Registration complete.",
      language
    );
    return { user: newUser, token: finalNewToken };
  };

  const searchFriend = (query: string): User[] => {
    if (!dbState) return [];
    const lowerQuery = query.toLowerCase();
    const cleanQuery = query.replace(/\D/g, '');
    return dbState.users.filter(u => 
      u.role === 'customer' && 
      (u.nickname.toLowerCase().includes(lowerQuery) || 
       (cleanQuery.length >= 4 && u.phoneNumber.replace(/\D/g, '').endsWith(cleanQuery)) ||
       u.phoneNumber.replace(/\D/g, '') === cleanQuery)
    );
  };

  // --- 영수증 촬영 및 QR 발급 (태블릿) ---
  const generateQR = (storeId: string, stampsToAward: number, photoUrl: string): string => {
    if (!dbState) return '';
    const token = `qr_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const newScan: ReceiptScan = {
      id: `scan_${Date.now()}`,
      storeId,
      receiptImageUrl: photoUrl,
      qrToken: token,
      stampsToAward,
      status: 'generated',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30분 만료
      createdAt: getSkewCorrectedIsoString()
    };

    updateDbState({
      ...dbState,
      receiptScans: [...dbState.receiptScans, newScan]
    });

    return token;
  };

  const validateQR = (token: string): ReceiptScan | null => {
    if (!dbState) return null;
    const scan = dbState.receiptScans.find(s => s.qrToken === token);
    if (!scan) return null;
    
    // 만료 시간 체크
    const isExpired = new Date(scan.expiresAt).getTime() < Date.now();
    if (isExpired || scan.status !== 'generated') {
      return null;
    }
    return scan;
  };

  const registerQRScan = (token: string, storeId: string, stampsToAward: number, expiresAt: string): void => {
    if (!dbState) return;
    if (dbState.receiptScans.some(s => s.qrToken === token)) return;

    // 기기 간 시간 차이 방지를 위해 폰 시간 기준 30분 만료 적용 (expiresAt 값은 참고용으로 읽음)
    const phoneExpiresAt = expiresAt ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const newScan: ReceiptScan = {
      id: `scan_${Date.now()}`,
      storeId,
      receiptImageUrl: 'receipt_photo_real',
      qrToken: token,
      stampsToAward,
      status: 'generated',
      expiresAt: phoneExpiresAt,
      createdAt: getSkewCorrectedIsoString()
    };

    const updatedStores = [...dbState.stores];
    if (!dbState.stores.some(s => s.id === storeId)) {
      updatedStores.push({
        id: storeId,
        name: language === 'ko' ? 'ShareStamps 가맹점' : 'ShareStamps Store',
        ownerId: 'none',
        category: 'cafe',
        pointRewardPer7Stamps: 5.00,
        currency: 'USD',
        earningIntervalMinutes: 60
      });
    }

    updateDbState({
      ...dbState,
      stores: updatedStores,
      receiptScans: [...dbState.receiptScans, newScan]
    });
  };

  const getDailyRewardUsage = (
    userId: string,
    rewardSource?: NonNullable<StampTransaction['source']>
  ) => {
    if (!dbState) return { total: 0, sourceTotal: 0 };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const txs = dbState.stampTransactions.filter(t => {
      if (t.userId !== userId || t.type !== 'earn' || t.amount <= 0) return false;
      const created = new Date(t.createdAt).getTime();
      return created >= start && created < end;
    });
    return {
      total: txs.reduce((sum, t) => sum + t.amount, 0),
      sourceTotal: rewardSource
        ? txs
            .filter(t => t.source === rewardSource || (!t.source && rewardSource === 'receipt_qr'))
            .reduce((sum, t) => sum + t.amount, 0)
        : 0
    };
  };

  const getDailyRewardLimitMessage = (rewardName: string) => (
    language === 'ko'
      ? `${rewardName} \uC2A4\uD0EC\uD504 \uBCF4\uC0C1\uC740 \uD558\uB8E8 1\uC7A5, \uC804\uCCB4 \uBCF4\uC0C1\uC740 \uD558\uB8E8 3\uC7A5\uAE4C\uC9C0 \uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`
      : `${rewardName} stamp rewards are limited to 1 per day, and all daily rewards are limited to 3 stamps.`
  );

  const claimQRStamps = (token: string, deviceToken: string) => {
    if (!dbState) return { success: false, message: 'DB 상태 에러', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    
    // 디바이스 기반 유저 조회
    const device = dbState.userDevices.find(d => d.deviceToken === deviceToken);
    if (!device) {
      return { success: false, message: '인증되지 않은 기기입니다.', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    }

    const user = dbState.users.find(u => u.id === device.userId);
    if (!user) {
      return { success: false, message: '사용자를 찾을 수 없습니다.', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    }

    if (user.status === 'suspended') {
      return { success: false, message: language === 'ko' ? '활동이 정지된 사용자입니다.' : 'This account has been suspended.', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    }

    let scan = dbState.receiptScans.find(s => s.qrToken === token);
    
    // 이미 처리된(claimed/expired) 스캔인지 체크
    if (scan && scan.status !== 'generated') {
      return { success: false, message: '만료되었거나 이미 적립 완료된 QR 코드입니다.', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    }

    // DB에 없는 경우 localStorage에 대기 중인 임시 스캔 데이터 복구 시도 (비동기 상태 업데이트 지연 대응)
    if (!scan) {
      const pendingToken = localStorage.getItem('sharestamps_pending_qr_token');
      if (pendingToken === token) {
        const pendingStoreId = localStorage.getItem('sharestamps_pending_qr_store_id');
        const pendingStamps = parseInt(localStorage.getItem('sharestamps_pending_qr_stamps') || '1');
        const pendingExpires = localStorage.getItem('sharestamps_pending_qr_expires');
        
        if (pendingStoreId) {
          scan = {
            id: `scan_${Date.now()}`,
            storeId: pendingStoreId,
            receiptImageUrl: 'receipt_photo_real',
            qrToken: token,
            stampsToAward: pendingStamps,
            status: 'generated',
            expiresAt: pendingExpires || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            createdAt: getSkewCorrectedIsoString()
          };
        }
      }
    }

    if (!scan) {
      return { success: false, message: '만료되었거나 이미 적립 완료된 QR 코드입니다.', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    }

    // 만료 시간 체크
    const isExpired = new Date(scan.expiresAt).getTime() < Date.now();
    if (isExpired) {
      return { success: false, message: '만료되었거나 이미 적립 완료된 QR 코드입니다.', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    }

    // --- Lucky 7 적립 프로세스 돌입 ---
    let store = dbState.stores.find(s => s.id === scan.storeId);
    const updatedStores = [...dbState.stores];
    if (!store) {
      store = {
        id: scan.storeId,
        name: language === 'ko' ? 'ShareStamps 가맹점' : 'ShareStamps Store',
        ownerId: 'none',
        category: 'cafe',
        pointRewardPer7Stamps: 5.00,
        currency: 'USD',
        earningIntervalMinutes: 60
      };
      updatedStores.push(store);
    }

    const receiptDailyUsage = getDailyRewardUsage(user.id, 'receipt_qr');
    if (receiptDailyUsage.sourceTotal >= 1 || receiptDailyUsage.total >= 3) {
      return {
        success: false,
        message: getDailyRewardLimitMessage(language === 'ko' ? '\uC601\uC218\uC99D' : 'Receipt'),
        stampsAwarded: 0,
        newStamps: 0,
        earnedPoints: 0
      };
    }

    // 동일 점포 재적립 제한 시간(분) 체크
    const userStoreTxs = dbState.stampTransactions
      .filter(t => t.userId === user.id && t.storeId === store.id && t.amount > 0 && t.type === 'earn' && (t.source === 'receipt_qr' || !t.source))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const intervalMinutes = typeof store.earningIntervalMinutes === 'number' ? store.earningIntervalMinutes : 60;

    if (intervalMinutes > 0 && userStoreTxs.length > 0) {
      const lastTxTime = new Date(userStoreTxs[0].createdAt).getTime();
      const diffMinutes = Math.floor((Date.now() - lastTxTime) / 60000);
      
      if (diffMinutes < intervalMinutes) {
        const remainingMinutes = intervalMinutes - diffMinutes;
        return { 
          success: false, 
          message: `동일 매장 재적립 제한 시간 이내입니다. (제한: ${formatInterval(intervalMinutes)}, 남은시간: ${formatInterval(remainingMinutes)})`, 
          stampsAwarded: 0, 
          newStamps: 0, 
          earnedPoints: 0 
        };
      }
    }
    
    // 기존 스탬프 조회
    let card = dbState.stampCards.find(c => c.userId === user.id && c.storeId === store.id);
    let currentStamps = card ? card.currentStamps : 0;
    
    const stampsToAward = Math.min(scan.stampsToAward, 1, 3 - receiptDailyUsage.total);
    let newStamps = currentStamps + stampsToAward;
    let earnedPoints = 0;

    // 만약 7개 이상 도달 시 포인트 전환
    const updatedCards = [...dbState.stampCards];
    const updatedPoints = [...dbState.storePoints];
    const newStampTxs = [...dbState.stampTransactions];
    const newPointTxs = [...dbState.pointTransactions];

    // 스탬프 적립 히스토리
    newStampTxs.push({
      id: `stx_${Date.now()}_1`,
      userId: user.id,
      storeId: store.id,
      amount: stampsToAward,
      type: 'earn',
      source: 'receipt_qr',
      referenceId: scan.id,
      createdAt: getSkewCorrectedIsoString()
    });

    // auto-conversion disabled, max out at 7 stamps
    newStamps = Math.min(7, newStamps);

    const valuePerStamp = store.pointRewardPer7Stamps / 7;
    const stampsToAdd = [];
    const addedCount = newStamps - currentStamps;
    for (let i = 0; i < addedCount; i++) {
      stampsToAdd.push({
        id: `stamp_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
        acquiredAt: getSkewCorrectedIsoString(),
        cashValue: parseFloat(valuePerStamp.toFixed(2))
      });
    }

    // 카드 업데이트
    const cardIdx = updatedCards.findIndex(c => c.userId === user.id && c.storeId === store.id);
    if (cardIdx > -1) {
      const existingStamps = updatedCards[cardIdx].stamps ? [...(updatedCards[cardIdx].stamps || [])] : [];
      if (existingStamps.length !== currentStamps) {
        existingStamps.length = 0;
        for (let i = 0; i < currentStamps; i++) {
          existingStamps.push({
            id: `stamp_mig_${updatedCards[cardIdx].id}_${i}_${Date.now()}`,
            acquiredAt: updatedCards[cardIdx].updatedAt || getSkewCorrectedIsoString(),
            cashValue: parseFloat(valuePerStamp.toFixed(2))
          });
        }
      }
      updatedCards[cardIdx] = {
        ...updatedCards[cardIdx],
        currentStamps: newStamps,
        stamps: [...existingStamps, ...stampsToAdd],
        updatedAt: getSkewCorrectedIsoString()
      };
    } else {
      updatedCards.push({
        id: `card_${Date.now()}`,
        userId: user.id,
        storeId: store.id,
        currentStamps: newStamps,
        stamps: stampsToAdd,
        updatedAt: getSkewCorrectedIsoString()
      });
    }

    // QR 토큰 완료 처리
    const updatedScans = [...dbState.receiptScans];
    const scanIdx = updatedScans.findIndex(s => s.qrToken === token);
    if (scanIdx > -1) {
      updatedScans[scanIdx] = { ...updatedScans[scanIdx], status: 'claimed' as const };
    } else {
      updatedScans.push({
        ...scan,
        status: 'claimed' as const
      });
    }

    // DB 저장
    updateDbState({
      ...dbState,
      stores: updatedStores,
      stampCards: updatedCards,
      storePoints: updatedPoints,
      stampTransactions: newStampTxs,
      pointTransactions: newPointTxs,
      receiptScans: updatedScans
    });

    // 오디오 TTS 재생
    if (earnedPoints > 0) {
      playVoiceGuidance(
        language === 'ko' 
          ? `축하합니다! 스탬프 7개를 모두 모아 ${earnedPoints}달러의 스탬프 캐시가 자동 환전 적립되었습니다.`
          : `Congratulations! You collected 7 stamps and earned a ${earnedPoints} dollars stamp cash reward.`,
        language
      );
    } else {
      const displayName = language === 'en' ? translateStore(store, 'en').name : store.name;
      playVoiceGuidance(
        language === 'ko'
          ? `${displayName} 스탬프 ${stampsToAward}개가 정상 적립되었습니다.`
          : `${stampsToAward} stamps have been successfully credited to ${displayName}.`,
        language
      );
    }

    return {
      success: true,
      message: '적립이 완료되었습니다!',
      stampsAwarded: stampsToAward,
      newStamps,
      earnedPoints
    };
  };

  // --- 수동 다이렉트 적립 (테스트 보조용) ---
  const earnStampsDirectly = (userId: string, storeId: string, count: number) => {
    if (!dbState) return;
    // const store = dbState.stores.find(s => s.id === storeId)!;
    const card = dbState.stampCards.find(c => c.userId === userId && c.storeId === storeId);
    let current = card ? card.currentStamps : 0;
    let newStamps = current + count;
    let earnedPoints = 0;

    const updatedCards = [...dbState.stampCards];
    const updatedPoints = [...dbState.storePoints];
    const newStampTxs = [...dbState.stampTransactions];
    const newPointTxs = [...dbState.pointTransactions];

    newStampTxs.push({
      id: `stx_${Date.now()}_1`,
      userId,
      storeId,
      amount: count,
      type: 'earn',
      createdAt: getSkewCorrectedIsoString()
    });

    // auto-conversion disabled, max out at 7 stamps
    newStamps = Math.min(7, newStamps);

    const store = dbState.stores.find(s => s.id === storeId);
    const rewardPer7 = store ? store.pointRewardPer7Stamps : 5;
    const valuePerStamp = rewardPer7 / 7;

    const stampsToAdd = [];
    const addedCount = newStamps - current;
    for (let i = 0; i < addedCount; i++) {
      stampsToAdd.push({
        id: `stamp_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
        acquiredAt: getSkewCorrectedIsoString(),
        cashValue: parseFloat(valuePerStamp.toFixed(2))
      });
    }

    const cardIdx = updatedCards.findIndex(c => c.userId === userId && c.storeId === storeId);
    if (cardIdx > -1) {
      const existingStamps = updatedCards[cardIdx].stamps ? [...(updatedCards[cardIdx].stamps || [])] : [];
      if (existingStamps.length !== current) {
        existingStamps.length = 0;
        for (let i = 0; i < current; i++) {
          existingStamps.push({
            id: `stamp_mig_${updatedCards[cardIdx].id}_${i}_${Date.now()}`,
            acquiredAt: updatedCards[cardIdx].updatedAt || getSkewCorrectedIsoString(),
            cashValue: parseFloat(valuePerStamp.toFixed(2))
          });
        }
      }
      updatedCards[cardIdx] = {
        ...updatedCards[cardIdx],
        currentStamps: newStamps,
        stamps: [...existingStamps, ...stampsToAdd],
        updatedAt: getSkewCorrectedIsoString()
      };
    } else {
      updatedCards.push({
        id: `card_${Date.now()}`,
        userId,
        storeId,
        currentStamps: newStamps,
        stamps: stampsToAdd,
        updatedAt: getSkewCorrectedIsoString()
      });
    }

    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      storePoints: updatedPoints,
      stampTransactions: newStampTxs,
      pointTransactions: newPointTxs
    });

    if (earnedPoints > 0) {
      playVoiceGuidance(
        language === 'ko' 
          ? `축하합니다! 스탬프 7개를 모두 모아 ${earnedPoints}달러의 스탬프 캐시가 자동 환전 적립되었습니다.`
          : `Congratulations! You collected 7 stamps and earned a ${earnedPoints} dollars stamp cash reward.`,
        language
      );
    } else {
      playVoiceGuidance(
        language === 'ko'
          ? `스탬프 ${count}개가 직접 적립되었습니다.`
          : `${count} stamps have been directly credited.`,
        language
      );
    }
  };

  // --- 친구 스탬프 선물하기 (Pending 대기 처리 로직) ---
  const giftStamps = (senderId: string, recipientId: string, storeId: string, count: number, message: string) => {
    if (!dbState) return { transferred: 0, returned: count };

    // 송신자 스탬프 조회
    const senderCardIdx = dbState.stampCards.findIndex(c => c.userId === senderId && c.storeId === storeId);
    if (senderCardIdx === -1 || dbState.stampCards[senderCardIdx].currentStamps < count) {
      throw new Error('보유한 스탬프 수량이 부족합니다.');
    }

    // 수신자 기존 스탬프 조회
    const recipientCardIdx = dbState.stampCards.findIndex(c => c.userId === recipientId && c.storeId === storeId);
    const recipientCurrent = recipientCardIdx > -1 ? dbState.stampCards[recipientCardIdx].currentStamps : 0;
    
    // 수신 한도 계산 (최대 7개까지 도달 가능)
    const maxCanReceive = 7 - recipientCurrent;
    
    if (maxCanReceive <= 0) {
      playVoiceGuidance(
        language === 'ko'
          ? "친구가 스탬프 카드를 가득 채워서 보낼 수 없습니다. 스탬프가 반환되었습니다."
          : "Your friend's stamp card is full. Stamps have been returned.",
        language
      );
      return { transferred: 0, returned: count };
    }

    let actualTransferred = count;
    let returned = 0;

    if (count > maxCanReceive) {
      actualTransferred = maxCanReceive;
      returned = count - maxCanReceive;
    }

    // 데이터 세팅
    const updatedCards = [...dbState.stampCards];
    const newStampTxs = [...dbState.stampTransactions];

    // 1. 송신자 스탬프 차감
    const senderCard = updatedCards[senderCardIdx];
    const existingSenderStamps = senderCard.stamps ? [...senderCard.stamps] : [];
    // 자가 치유
    if (existingSenderStamps.length !== senderCard.currentStamps) {
      existingSenderStamps.length = 0;
      const store = dbState.stores.find(s => s.id === storeId);
      const valPerStamp = store ? store.pointRewardPer7Stamps / 7 : 5 / 7;
      for (let i = 0; i < senderCard.currentStamps; i++) {
        existingSenderStamps.push({
          id: `stamp_mig_${senderCard.id}_${i}_${Date.now()}`,
          acquiredAt: senderCard.updatedAt || getSkewCorrectedIsoString(),
          cashValue: parseFloat(valPerStamp.toFixed(2))
        });
      }
    }
    
    // 뒤에서부터 actualTransferred 개만큼의 스탬프 객체를 꺼내 선물에 탑재
    const giftedStamps = existingSenderStamps.splice(-actualTransferred, actualTransferred);

    updatedCards[senderCardIdx] = {
      ...senderCard,
      currentStamps: senderCard.currentStamps - actualTransferred,
      stamps: existingSenderStamps,
      updatedAt: getSkewCorrectedIsoString()
    };

    // 2. 선물 기록 생성 (pending 상태로 대기)
    const giftId = `gift_${Date.now()}`;
    const newGift: Gift = {
      id: giftId,
      senderId,
      recipientId,
      storeId,
      stampsSent: count,
      stampsTransferred: actualTransferred,
      message,
      createdAt: getSkewCorrectedIsoString(),
      status: 'pending',
      stamps: giftedStamps
    };

    newStampTxs.push({
      id: `stx_${Date.now()}_gift1`,
      userId: senderId,
      storeId,
      amount: -actualTransferred,
      type: 'gift_send',
      referenceId: giftId,
      createdAt: getSkewCorrectedIsoString()
    });

    // DB 업데이트
    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      stampTransactions: newStampTxs,
      gifts: [...dbState.gifts, newGift]
    });

    // 오디오 재생
    const recipient = dbState.users.find(u => u.id === recipientId)!;
    const cleanRecipientName = recipient.name.replace('회원_', '');
    if (returned > 0) {
      playVoiceGuidance(
        language === 'ko'
          ? `친구에게 스탬프 ${actualTransferred}개가 전송 대기되었습니다. 한도 초과된 ${returned}개는 돌려받았습니다.`
          : `${actualTransferred} stamps queued for friend. ${returned} stamps returned due to limit.`,
        language
      );
    } else {
      playVoiceGuidance(
        language === 'ko'
          ? `${cleanRecipientName}님에게 스탬프 ${actualTransferred}개가 전송 대기되었습니다. 친구의 승인을 기다립니다.`
          : `${actualTransferred} stamps queued for ${cleanRecipientName}. Waiting for acceptance.`,
        language
      );
    }

    return { transferred: actualTransferred, returned };
  };

  // --- 스탬프 선물 승인 (Accept) ---
  const acceptGift = (giftId: string, thanksMessage: string) => {
    if (!dbState) return { success: false, message: 'DB Error' };
    const giftIdx = dbState.gifts.findIndex(g => g.id === giftId);
    if (giftIdx === -1) return { success: false, message: 'Gift not found' };
    const gift = dbState.gifts[giftIdx];
    if (gift.status !== 'pending') return { success: false, message: 'Already processed' };

    // const store = dbState.stores.find(s => s.id === gift.storeId)!;
    const recipientId = gift.recipientId;
    const senderId = gift.senderId;
    const storeId = gift.storeId;
    const actualTransferred = gift.stampsTransferred;

    // 수신자 기존 스탬프 조회
    const recipientCardIdx = dbState.stampCards.findIndex(c => c.userId === recipientId && c.storeId === storeId);
    const recipientCurrent = recipientCardIdx > -1 ? dbState.stampCards[recipientCardIdx].currentStamps : 0;
    
    // 수신 한도 계산
    const maxCanReceive = 7 - recipientCurrent;
    let finalTransferred = actualTransferred;
    let returnedToSender = 0;

    if (actualTransferred > maxCanReceive) {
      finalTransferred = maxCanReceive;
      returnedToSender = actualTransferred - maxCanReceive;
    }

    const updatedCards = [...dbState.stampCards];
    const updatedPoints = [...dbState.storePoints];
    const newStampTxs = [...dbState.stampTransactions];
    const newPointTxs = [...dbState.pointTransactions];

    // 1. 수신자 스탬프 증산
    let recipientNewStamps = recipientCurrent + finalTransferred;
    recipientNewStamps = Math.min(7, recipientNewStamps);

    const giftStampsArray = gift.stamps || [];
    // 자가 치유
    if (giftStampsArray.length !== actualTransferred) {
      const store = dbState.stores.find(s => s.id === storeId);
      const valPerStamp = store ? store.pointRewardPer7Stamps / 7 : 5 / 7;
      giftStampsArray.length = 0;
      for (let i = 0; i < actualTransferred; i++) {
        giftStampsArray.push({
          id: `stamp_mig_gift_${giftId}_${i}_${Date.now()}`,
          acquiredAt: gift.createdAt || getSkewCorrectedIsoString(),
          cashValue: parseFloat(valPerStamp.toFixed(2))
        });
      }
    }

    const stampsToRecipient = giftStampsArray.slice(0, finalTransferred);
    const stampsToReturn = giftStampsArray.slice(finalTransferred);

    const giftSender = dbState.users.find(u => u.id === senderId);
    const senderName = giftSender ? giftSender.name : '';
    const senderNickname = giftSender ? giftSender.nickname : '';

    const taggedStampsToRecipient = stampsToRecipient.map(s => ({
      ...s,
      isGift: true,
      senderName,
      senderNickname
    }));

    const recipientCard = updatedCards[recipientCardIdx];
    const existingRecipientStamps = recipientCardIdx > -1 && recipientCard ? (recipientCard.stamps ? [...(recipientCard.stamps || [])] : []) : [];
    // 자가 치유
    if (recipientCardIdx > -1 && recipientCard && existingRecipientStamps.length !== recipientCurrent) {
      existingRecipientStamps.length = 0;
      const store = dbState.stores.find(s => s.id === storeId);
      const valPerStamp = store ? store.pointRewardPer7Stamps / 7 : 5 / 7;
      for (let i = 0; i < recipientCurrent; i++) {
        existingRecipientStamps.push({
          id: `stamp_mig_${recipientCard.id}_${i}_${Date.now()}`,
          acquiredAt: recipientCard.updatedAt || getSkewCorrectedIsoString(),
          cashValue: parseFloat(valPerStamp.toFixed(2))
        });
      }
    }

    const finalRecipientStamps = [...existingRecipientStamps, ...taggedStampsToRecipient];

    if (recipientCardIdx > -1) {
      updatedCards[recipientCardIdx] = {
        ...recipientCard,
        currentStamps: recipientNewStamps,
        stamps: finalRecipientStamps,
        updatedAt: getSkewCorrectedIsoString()
      };
    } else {
      updatedCards.push({
        id: `card_${Date.now()}`,
        userId: recipientId,
        storeId,
        currentStamps: recipientNewStamps,
        stamps: finalRecipientStamps,
        updatedAt: getSkewCorrectedIsoString()
      });
    }

    newStampTxs.push({
      id: `stx_${Date.now()}_gift_recv`,
      userId: recipientId,
      storeId,
      amount: finalTransferred,
      type: 'gift_receive',
      referenceId: giftId,
      createdAt: getSkewCorrectedIsoString()
    });

    // 2. 한도 초과분 송신자에게 반환
    if (returnedToSender > 0 && stampsToReturn.length > 0) {
      const senderCardIdx = updatedCards.findIndex(c => c.userId === senderId && c.storeId === storeId);
      if (senderCardIdx > -1) {
        const senderCard = updatedCards[senderCardIdx];
        const existingSenderStamps = senderCard.stamps ? [...(senderCard.stamps || [])] : [];
        updatedCards[senderCardIdx] = {
          ...senderCard,
          currentStamps: Math.min(7, senderCard.currentStamps + returnedToSender),
          stamps: [...existingSenderStamps, ...stampsToReturn].slice(0, 7),
          updatedAt: getSkewCorrectedIsoString()
        };

        newStampTxs.push({
          id: `stx_${Date.now()}_gift_ret`,
          userId: senderId,
          storeId,
          amount: returnedToSender,
          type: 'gift_receive',
          referenceId: giftId,
          createdAt: getSkewCorrectedIsoString()
        });
      }
    }

    const updatedGifts = [...dbState.gifts];
    updatedGifts[giftIdx] = {
      ...gift,
      status: 'accepted',
      thanksMessage,
      stampsTransferred: finalTransferred
    };

    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      storePoints: updatedPoints,
      stampTransactions: newStampTxs,
      pointTransactions: newPointTxs,
      gifts: updatedGifts
    });

    const sender = dbState.users.find(u => u.id === senderId)!;
    playVoiceGuidance(
      language === 'ko'
        ? `선물 수락 완료. ${sender.nickname}님께 감사 메시지를 보냈습니다.`
        : `Gift accepted. Thank you note sent to ${sender.nickname}.`,
      language
    );

    return { success: true, message: 'Accepted successfully' };
  };

  // --- 스탬프 선물 거절 (Decline) ---
  const declineGift = (giftId: string) => {
    if (!dbState) return { success: false, message: 'DB Error' };
    const giftIdx = dbState.gifts.findIndex(g => g.id === giftId);
    if (giftIdx === -1) return { success: false, message: 'Gift not found' };
    const gift = dbState.gifts[giftIdx];
    if (gift.status !== 'pending') return { success: false, message: 'Already processed' };

    // const store = dbState.stores.find(s => s.id === gift.storeId)!;
    const senderId = gift.senderId;
    const storeId = gift.storeId;
    const stampsToReturn = gift.stampsTransferred;

    const updatedCards = [...dbState.stampCards];
    const updatedPoints = [...dbState.storePoints];
    const newStampTxs = [...dbState.stampTransactions];
    const newPointTxs = [...dbState.pointTransactions];

    // 송신자에게 반환
    const giftStampsArray = gift.stamps || [];
    // 자가 치유
    if (giftStampsArray.length !== stampsToReturn) {
      const store = dbState.stores.find(s => s.id === storeId);
      const valPerStamp = store ? store.pointRewardPer7Stamps / 7 : 5 / 7;
      giftStampsArray.length = 0;
      for (let i = 0; i < stampsToReturn; i++) {
        giftStampsArray.push({
          id: `stamp_mig_gift_${giftId}_${i}_${Date.now()}`,
          acquiredAt: gift.createdAt || getSkewCorrectedIsoString(),
          cashValue: parseFloat(valPerStamp.toFixed(2))
        });
      }
    }

    const senderCardIdx = updatedCards.findIndex(c => c.userId === senderId && c.storeId === storeId);
    if (senderCardIdx > -1) {
      const senderCard = updatedCards[senderCardIdx];
      const existingSenderStamps = senderCard.stamps ? [...(senderCard.stamps || [])] : [];
      updatedCards[senderCardIdx] = {
        ...senderCard,
        currentStamps: Math.min(7, senderCard.currentStamps + stampsToReturn),
        stamps: [...existingSenderStamps, ...giftStampsArray].slice(0, 7),
        updatedAt: getSkewCorrectedIsoString()
      };

      newStampTxs.push({
        id: `stx_${Date.now()}_decl_ret`,
        userId: senderId,
        storeId,
        amount: stampsToReturn,
        type: 'gift_receive',
        referenceId: giftId,
        createdAt: getSkewCorrectedIsoString()
      });
    }

    const updatedGifts = [...dbState.gifts];
    updatedGifts[giftIdx] = {
      ...gift,
      status: 'declined'
    };

    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      storePoints: updatedPoints,
      stampTransactions: newStampTxs,
      pointTransactions: newPointTxs,
      gifts: updatedGifts
    });

    playVoiceGuidance(
      language === 'ko'
        ? `선물을 거절했습니다. 스탬프가 친구에게 반환되었습니다.`
        : `Gift declined. Stamps returned to sender.`,
      language
    );

    return { success: true, message: 'Declined successfully' };
  };

  const convertStampsToCash = (userId: string, storeId: string) => {
    if (!dbState) return { success: false, message: 'DB State Error' };
    const cardIdx = dbState.stampCards.findIndex(c => c.userId === userId && c.storeId === storeId);
    if (cardIdx === -1) {
      return { success: false, message: '스탬프 카드가 없습니다.' };
    }
    const card = dbState.stampCards[cardIdx];
    if (card.currentStamps < 7) {
      return { success: false, message: '스탬프가 7개 미만입니다.' };
    }

    const store = dbState.stores.find(s => s.id === storeId);
    if (!store) {
      return { success: false, message: '가맹점을 찾을 수 없습니다.' };
    }

    const updatedCards = [...dbState.stampCards];
    const updatedPoints = [...dbState.storePoints];
    const newStampTxs = [...dbState.stampTransactions];
    const newPointTxs = [...dbState.pointTransactions];

    // Deduct 7 stamps and calculate points based on historical value
    const existingStamps = card.stamps ? [...card.stamps] : [];
    // 자가 치유
    if (existingStamps.length !== card.currentStamps) {
      existingStamps.length = 0;
      const valPerStamp = store.pointRewardPer7Stamps / 7;
      for (let i = 0; i < card.currentStamps; i++) {
        existingStamps.push({
          id: `stamp_mig_${card.id}_${i}_${Date.now()}`,
          acquiredAt: card.updatedAt || getSkewCorrectedIsoString(),
          cashValue: parseFloat(valPerStamp.toFixed(2))
        });
      }
    }

    const stampsToConvert = existingStamps.splice(0, 7);
    const earnedPoints = Math.round(stampsToConvert.reduce((sum, s) => sum + s.cashValue, 0) * 100) / 100;

    updatedCards[cardIdx] = {
      ...card,
      currentStamps: card.currentStamps - 7,
      stamps: existingStamps,
      updatedAt: getSkewCorrectedIsoString()
    };

    // Add cash points
    const ptsIdx = updatedPoints.findIndex(p => p.userId === userId && p.storeId === storeId);
    if (ptsIdx > -1) {
      updatedPoints[ptsIdx] = {
        ...updatedPoints[ptsIdx],
        pointsBalance: Math.round((updatedPoints[ptsIdx].pointsBalance + earnedPoints) * 100) / 100,
        updatedAt: getSkewCorrectedIsoString()
      };
    } else {
      updatedPoints.push({
        id: `pts_${Date.now()}_conv`,
        userId,
        storeId,
        pointsBalance: earnedPoints,
        updatedAt: getSkewCorrectedIsoString()
      });
    }

    // Log stamp tx (negative 7 stamps)
    newStampTxs.push({
      id: `stx_${Date.now()}_conv`,
      userId,
      storeId,
      amount: -7,
      type: 'point_conversion',
      createdAt: getSkewCorrectedIsoString()
    });

    // Log point tx (positive cash)
    newPointTxs.push({
      id: `ptx_${Date.now()}_conv`,
      userId,
      storeId,
      amount: earnedPoints,
      type: 'earn_from_stamps',
      createdAt: getSkewCorrectedIsoString()
    });

    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      storePoints: updatedPoints,
      stampTransactions: newStampTxs,
      pointTransactions: newPointTxs
    });

    return { success: true, message: '적립 보상이 스탬프 캐시로 전환되었습니다!', earnedPoints };
  };

  // --- NPO 기부 스탬프 정산 처리 (Store Owner) ---
  const settleDonations = (storeId: string, donationIds: string[]) => {
    if (!dbState) return;
    const updatedDonations = dbState.donations.map(d => {
      if (donationIds.includes(d.id) && d.storeId === storeId) {
        return {
          ...d,
          settledStatus: 'settled' as const,
          settledAt: getSkewCorrectedIsoString()
        };
      }
      return d;
    });
    
    updateDbState({
      ...dbState,
      donations: updatedDonations
    });

    playVoiceGuidance(
      language === 'ko' ? "기부금 정산 처리가 완료되었습니다." : "Donation settlement completed.",
      language
    );
  };

  // --- NPO 기부금 정밀도 계산 및 적립 ---
  const donateStamps = (userId: string, storeId: string, nonProfitId: string, count: number): number => {
    if (!dbState) return 0;
    
    const store = dbState.stores.find(s => s.id === storeId)!;
    
    // 기부자 스탬프 조회
    const cardIdx = dbState.stampCards.findIndex(c => c.userId === userId && c.storeId === storeId);
    if (cardIdx === -1 || dbState.stampCards[cardIdx].currentStamps < count) {
      throw new Error('기부할 스탬프가 부족합니다.');
    }

    // Deduct count stamps and calculate donation value based on historical value
    const existingStamps = dbState.stampCards[cardIdx].stamps ? [...(dbState.stampCards[cardIdx].stamps || [])] : [];
    // 자가 치유
    if (existingStamps.length !== dbState.stampCards[cardIdx].currentStamps) {
      existingStamps.length = 0;
      const valPerStamp = store.pointRewardPer7Stamps / 7;
      for (let i = 0; i < dbState.stampCards[cardIdx].currentStamps; i++) {
        existingStamps.push({
          id: `stamp_mig_${dbState.stampCards[cardIdx].id}_${i}_${Date.now()}`,
          acquiredAt: dbState.stampCards[cardIdx].updatedAt || getSkewCorrectedIsoString(),
          cashValue: parseFloat(valPerStamp.toFixed(2))
        });
      }
    }

    const stampsToDonate = existingStamps.splice(0, count);
    const donationValue = Math.round(stampsToDonate.reduce((sum, s) => sum + s.cashValue, 0) * 100) / 100;

    // 데이터 업데이트
    const updatedCards = [...dbState.stampCards];
    updatedCards[cardIdx] = {
      ...dbState.stampCards[cardIdx],
      currentStamps: dbState.stampCards[cardIdx].currentStamps - count,
      stamps: existingStamps,
      updatedAt: getSkewCorrectedIsoString()
    };

    const donationId = `don_${Date.now()}`;
    const newDonation: Donation = {
      id: donationId,
      donorId: userId,
      storeId,
      nonProfitId,
      stampCount: count,
      monetaryValue: donationValue,
      createdAt: getSkewCorrectedIsoString()
    };

    const newStampTxs = [
      ...dbState.stampTransactions,
      {
        id: `stx_${Date.now()}`,
        userId,
        storeId,
        amount: -count,
        type: 'donation' as const,
        referenceId: donationId,
        createdAt: getSkewCorrectedIsoString()
      }
    ];

    const giftId = `gift_${Date.now()}`;
    const newGift = {
      id: giftId,
      senderId: userId,
      recipientId: nonProfitId,
      storeId,
      stampsSent: count,
      stampsTransferred: count,
      message: language === 'ko' ? '기부 단체 후원' : 'Donation to Charity',
      status: 'accepted' as const,
      thanksMessage: language === 'ko' ? '따뜻한 나눔에 감사드립니다!' : 'Thank you for your warm donation!',
      createdAt: getSkewCorrectedIsoString()
    };

    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      stampTransactions: newStampTxs,
      donations: [...dbState.donations, newDonation],
      gifts: [...dbState.gifts, newGift]
    });

    const npo = dbState.nonProfits.find(n => n.id === nonProfitId) || {
      id: nonProfitId,
      code: 'UNASSIGNED',
      name: language === 'ko' ? '지정되지 않은 기부단체' : 'Unassigned NPO',
      description: '',
      status: 'active' as const
    };
    const npoName = language === 'en' ? translateNpo(npo, 'en').name : npo.name;
    playVoiceGuidance(
      language === 'ko'
        ? `따뜻한 나눔에 감사드립니다. ${npoName}에 스탬프 ${count}개가 성공적으로 기부되었습니다.`
        : `Thank you for your warm donation. ${count} stamps have been successfully donated to ${npoName}.`,
      language
    );

    // SMS 감사 알림 시뮬레이션
    const smsMsg = '사랑의 기부를 해주셔서 감사합니다. ShareStamps는 나눔을 위해 최선을 다하겠습니다.';
    const donor = dbState.users.find(u => u.id === userId);
    const donorPhone = donor?.phoneNumber || '';
    console.log(`[SMS 발송 시뮬레이션] 수신: ${donorPhone} | 내용: ${smsMsg}`);
    // 화면 토스트 (실제 서비스에서는 Twilio/Cool SMS 등으로 대체)
    setTimeout(() => {
      const toast = document.createElement('div');
      toast.textContent = `📱 SMS 발송: ${smsMsg}`;
      Object.assign(toast.style, {
        position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
        background: '#1c1c1e', color: '#fff', padding: '10px 18px', borderRadius: '10px',
        fontSize: '12px', zIndex: '9999', maxWidth: '320px', textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)', lineHeight: '1.4'
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }, 800);

    return donationValue;
  };
 
  const donatePointsDirect = (userId: string, nonProfitId: string, amount: number): number => {
    if (!dbState) return 0;
    
    // 이 사용자의 총 보유 포인트 캐시 합산 계산
    const userPoints = dbState.storePoints.filter(p => p.userId === userId);
    const totalAvailable = userPoints.reduce((sum, p) => sum + p.pointsBalance, 0);
    
    if (totalAvailable < amount) {
      throw new Error(language === 'ko' ? '기부할 스탬프 캐시가 부족합니다.' : 'Insufficient stamp cash.');
    }
    
    let remainingToDonate = amount;
    const updatedStorePoints = [...dbState.storePoints];
    const newPointTxs = [...dbState.pointTransactions];
    
    const donationId = `don_${Date.now()}`;
    
    // 잔액이 있는 매장들을 순회하며 차감
    for (let i = 0; i < updatedStorePoints.length; i++) {
      const p = updatedStorePoints[i];
      if (p.userId === userId && p.pointsBalance > 0) {
        const deductAmount = Math.min(p.pointsBalance, remainingToDonate);
        
        // 차감 처리
        updatedStorePoints[i] = {
          ...p,
          pointsBalance: Math.round((p.pointsBalance - deductAmount) * 100) / 100
        };
        
        // 포인트 트랜잭션 로그 기록
        newPointTxs.push({
          id: `ptx_${Date.now()}_${i}`,
          userId,
          storeId: p.storeId,
          amount: -deductAmount,
          type: 'use_payment' as const,
          createdAt: getSkewCorrectedIsoString()
        });
        
        remainingToDonate = Math.round((remainingToDonate - deductAmount) * 100) / 100;
        if (remainingToDonate <= 0) break;
      }
    }
    
    // 기부(Donation) 오브젝트 생성
    const newDonation: Donation = {
      id: donationId,
      donorId: userId,
      storeId: 'none', // 특정 매장과 무관한 기부이므로 'none'
      nonProfitId,
      stampCount: 0, // 스탬프 기부가 아닌 캐시 기부이므로 0
      monetaryValue: amount,
      createdAt: getSkewCorrectedIsoString()
    };
    
    updateDbState({
      ...dbState,
      storePoints: updatedStorePoints,
      pointTransactions: newPointTxs,
      donations: [...dbState.donations, newDonation]
    });
    
    const npo = dbState.nonProfits.find(n => n.id === nonProfitId)!;
    const npoName = language === 'en' ? translateNpo(npo, 'en').name : npo.name;
    playVoiceGuidance(
      language === 'en'
        ? `Thank you for your generous donation of ${amount} dollars to ${npoName}.`
        : `${npoName}에 ${amount}달러를 기부해 주셔서 진심으로 감사드립니다.`,
      language
    );

    // SMS 감사 알림 시뮬레이션
    const smsMsg = '사랑의 기부를 해주셔서 감사합니다. ShareStamps는 나눔을 위해 최선을 다하겠습니다.';
    const donor = dbState.users.find(u => u.id === userId);
    const donorPhone = donor?.phoneNumber || '';
    console.log(`[SMS 발송 시뮬레이션] 수신: ${donorPhone} | 내용: ${smsMsg}`);
    setTimeout(() => {
      const toast = document.createElement('div');
      toast.textContent = `📱 SMS 발송: ${smsMsg}`;
      Object.assign(toast.style, {
        position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
        background: '#1c1c1e', color: '#fff', padding: '10px 18px', borderRadius: '10px',
        fontSize: '12px', zIndex: '9999', maxWidth: '320px', textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)', lineHeight: '1.4'
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }, 800);

    return amount;
  };
 
  // --- 캐시 포인트 할인 바코드 스캔 감액 ---
  const redeemPoints = (userId: string, _storeId: string, amount: number) => {
    if (!dbState) return { success: false, deducted: 0 };
    
    const userPoints = dbState.storePoints.filter(p => p.userId === userId);
    const totalAvailable = userPoints.reduce((sum, p) => sum + p.pointsBalance, 0);
    
    if (totalAvailable < amount) {
      return { success: false, deducted: 0 };
    }

    let remainingToRedeem = amount;
    const updatedPoints = [...dbState.storePoints];
    const newPointTxs = [...dbState.pointTransactions];

    for (let i = 0; i < updatedPoints.length; i++) {
      const p = updatedPoints[i];
      if (p.userId === userId && p.pointsBalance > 0) {
        const deductAmount = Math.min(p.pointsBalance, remainingToRedeem);
        updatedPoints[i] = {
          ...p,
          pointsBalance: Math.round((p.pointsBalance - deductAmount) * 100) / 100,
          updatedAt: getSkewCorrectedIsoString()
        };
        newPointTxs.push({
          id: `ptx_${Date.now()}_${i}`,
          userId,
          storeId: p.storeId,
          amount: -deductAmount,
          type: 'use_payment' as const,
          createdAt: getSkewCorrectedIsoString()
        });
        remainingToRedeem = Math.round((remainingToRedeem - deductAmount) * 100) / 100;
        if (remainingToRedeem <= 0) break;
      }
    }

    updateDbState({
      ...dbState,
      storePoints: updatedPoints,
      pointTransactions: newPointTxs
    });

    playVoiceGuidance(
      language === 'ko'
        ? `바코드가 스캔되어 ${amount}달러가 정상 할인 처리되었습니다.`
        : `Barcode scanned. ${amount} dollars discount applied successfully.`,
      language
    );

    return { success: true, deducted: amount };
  };

  const updateStoreInterval = (storeId: string, minutes: number) => {
    if (!dbState) return;
    const updatedStores = dbState.stores.map(s => 
      s.id === storeId ? { ...s, earningIntervalMinutes: minutes } : s
    );
    updateDbState({ ...dbState, stores: updatedStores });
    playVoiceGuidance(
      language === 'ko'
        ? `재적립 제한 대기 시간이 ${formatInterval(minutes, 'ko')}으로 변경되었습니다.`
        : `Earning interval limit has been changed to ${formatInterval(minutes, 'en')}.`,
      language
    );
  };

  const updateStoreRewardAmount = (storeId: string, amount: number) => {
    if (!dbState) return;
    const updatedStores = dbState.stores.map(s => 
      s.id === storeId ? { ...s, pointRewardPer7Stamps: amount, updatedAt: getSkewCorrectedIsoString() } : s
    );
    updateDbState({ ...dbState, stores: updatedStores });
    playVoiceGuidance(
      language === 'ko'
        ? `7개 완성 보상 금액이 ${amount.toFixed(2)}달러로 변경되었습니다.`
        : `7-stamp reward has been changed to ${amount.toFixed(2)} dollars.`,
      language
    );
  };

  const updateStoreMiniHome = (storeId: string, updates: Partial<Store>) => {
    if (!dbState) return;
    const updatedStores = dbState.stores.map(s => 
      s.id === storeId ? { ...s, ...updates, updatedAt: getSkewCorrectedIsoString() } : s
    );
    updateDbState({ ...dbState, stores: updatedStores });
    playVoiceGuidance(
      language === 'ko'
        ? "매장 정보가 업데이트되었습니다."
        : "Store information has been updated.",
      language
    );
  };

  const addReview = (
    storeId: string,
    rating: number,
    comment: string,
    photoUrl?: string,
    isAIContent?: boolean,
    videoUrl?: string,
    aiQuestionsAnswers?: { q: string; a: string }[],
    snsShared?: {
      facebook?: boolean;
      instagram?: boolean;
      threads?: boolean;
      linkedin?: boolean;
      youtube?: boolean;
      tiktok?: boolean;
      google?: boolean;
    }
  ) => {
    if (!dbState) return { reviewId: '', stampAwarded: false, message: 'DB Error' };
    const newReview: StoreReview = {
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      storeId,
      userId: currentUser?.id || 'guest',
      userName: currentUser?.name || (language === 'ko' ? '방문자' : 'Guest'),
      userNickname: currentUser?.nickname || 'guest',
      rating,
      comment,
      photoUrl,
      createdAt: getSkewCorrectedIsoString(),
      isAIContent,
      videoUrl,
      aiQuestionsAnswers,
      snsShared
    };
    const updatedReviews = [newReview, ...(dbState.reviews || [])];

    let updatedCards = [...dbState.stampCards];
    let newStampTxs = [...dbState.stampTransactions];
    let stampAwarded = false;

    if (isAIContent && currentUser) {
      const reviewDailyUsage = getDailyRewardUsage(currentUser.id, 'ai_review');
      const hasAiReviewStampAtStoreToday = newStampTxs.some(tx => {
        if (tx.userId !== currentUser.id || tx.storeId !== storeId || tx.source !== 'ai_review' || tx.type !== 'earn' || tx.amount <= 0) return false;
        const created = new Date(tx.createdAt);
        const now = new Date();
        return created.getFullYear() === now.getFullYear() &&
          created.getMonth() === now.getMonth() &&
          created.getDate() === now.getDate();
      });
      const cardIdx = updatedCards.findIndex(c => c.userId === currentUser.id && c.storeId === storeId);
      const current = cardIdx > -1 ? updatedCards[cardIdx].currentStamps : 0;
      const shouldAwardReviewStamp = current < 7 && !hasAiReviewStampAtStoreToday && (
        reviewDailyUsage.sourceTotal < 1 ||
        current === 0
      );
      if (shouldAwardReviewStamp) {
        const store = dbState.stores.find(s => s.id === storeId);
        const rewardPer7 = store ? store.pointRewardPer7Stamps : 5;
        const valuePerStamp = rewardPer7 / 7;
        const stampToAdd = {
          id: `stamp_${Date.now()}_ai_review`,
          acquiredAt: getSkewCorrectedIsoString(),
          cashValue: parseFloat(valuePerStamp.toFixed(2))
        };

        if (cardIdx === -1) {
          updatedCards.push({
            id: `card_${Date.now()}_ai`,
            userId: currentUser.id,
            storeId,
            currentStamps: 1,
            stamps: [stampToAdd],
            updatedAt: getSkewCorrectedIsoString()
          });
        } else {
          const card = updatedCards[cardIdx];
          const existingStamps = card.stamps ? [...(card.stamps || [])] : [];
          if (existingStamps.length !== current) {
            existingStamps.length = 0;
            for (let i = 0; i < current; i++) {
              existingStamps.push({
                id: `stamp_mig_${card.id}_${i}_${Date.now()}`,
                acquiredAt: card.updatedAt || getSkewCorrectedIsoString(),
                cashValue: parseFloat(valuePerStamp.toFixed(2))
              });
            }
          }
          updatedCards[cardIdx] = {
            ...card,
            currentStamps: current + 1,
            stamps: [...existingStamps, stampToAdd],
            updatedAt: getSkewCorrectedIsoString()
          };
        }

        newStampTxs.push({
          id: `stx_${Date.now()}_ai_earn`,
          userId: currentUser.id,
          storeId,
          amount: 1,
          type: 'earn',
          source: 'ai_review',
          referenceId: newReview.id,
          createdAt: getSkewCorrectedIsoString()
        });
        stampAwarded = true;
      }
    }

    updateDbState({
      ...dbState,
      reviews: updatedReviews,
      stampCards: updatedCards,
      stampTransactions: newStampTxs
    });

    playVoiceGuidance(
      language === 'ko'
        ? (isAIContent && stampAwarded ? "AI \uCF58\uD150\uCE20\uAC00 \uB4F1\uB85D\uB418\uACE0 \uC2A4\uD0EC\uD504 1\uAC1C\uAC00 \uC801\uB9BD\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : "\uB9AC\uBDF0\uAC00 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.")
        : (isAIContent && stampAwarded ? "AI content submitted successfully. 1 stamp earned." : "Review submitted successfully."),
      language
    );
    return {
      reviewId: newReview.id,
      stampAwarded,
      message: stampAwarded
        ? (language === 'ko' ? '\uC2A4\uD0EC\uD504 1\uAC1C\uAC00 \uC801\uB9BD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.' : '1 stamp earned.')
        : getDailyRewardLimitMessage(language === 'ko' ? '\uB9AC\uBDF0' : 'Review')
    };
  };

  const updateReviewMedia = (reviewId: string, media: { photoUrl?: string; videoUrl?: string }) => {
    if (!reviewId || (!media.photoUrl && !media.videoUrl)) return;

    try {
      const latestRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const latestState = latestRaw ? JSON.parse(latestRaw) : dbState;
      if (!latestState?.reviews) return;

      const hasReview = latestState.reviews.some((review: StoreReview) => review.id === reviewId);
      if (!hasReview) return;

      const updatedState = {
        ...latestState,
        reviews: latestState.reviews.map((review: StoreReview) => (
          review.id === reviewId
            ? {
                ...review,
                photoUrl: media.photoUrl || review.photoUrl,
                videoUrl: media.videoUrl || review.videoUrl
              }
            : review
        ))
      };

      updateDbState(updatedState, true);
    } catch (error) {
      console.error('Failed to update review media:', error);
    }
  };

  const deductStampsByOwner = (customerId: string, storeId: string, count: number) => {
    if (!dbState) return { success: false, message: 'DB Error' };
    const customer = dbState.users.find(u => u.id === customerId);
    if (customer && customer.status === 'suspended') {
      return { success: false, message: language === 'ko' ? '활동이 정지된 사용자입니다.' : 'This user is suspended.' };
    }

    const cardIdx = dbState.stampCards.findIndex(c => c.userId === customerId && c.storeId === storeId);
    if (cardIdx === -1) {
      return { success: false, message: language === 'ko' ? '스탬프 카드가 존재하지 않습니다.' : 'Stamp card not found.' };
    }
    const card = dbState.stampCards[cardIdx];
    const current = card.currentStamps;
    if (current <= 0) {
      return { success: false, message: language === 'ko' ? '차감할 스탬프가 없습니다.' : 'No stamps to deduct.' };
    }

    const actualDeducted = Math.min(current, count);
    const updatedCards = [...dbState.stampCards];
    const existingStamps = card.stamps ? [...card.stamps] : [];
    
    // 자가 치유
    if (existingStamps.length !== current) {
      existingStamps.length = 0;
      const store = dbState.stores.find(s => s.id === storeId);
      const valPerStamp = store ? store.pointRewardPer7Stamps / 7 : 5 / 7;
      for (let i = 0; i < current; i++) {
        existingStamps.push({
          id: `stamp_mig_${card.id}_${i}_${Date.now()}`,
          acquiredAt: card.updatedAt || getSkewCorrectedIsoString(),
          cashValue: parseFloat(valPerStamp.toFixed(2))
        });
      }
    }
    
    // 뒤에서부터 차감 개수만큼 제거
    existingStamps.splice(-actualDeducted, actualDeducted);

    updatedCards[cardIdx] = {
      ...card,
      currentStamps: current - actualDeducted,
      stamps: existingStamps,
      updatedAt: getSkewCorrectedIsoString()
    };

    const newStampTxs = [
      ...dbState.stampTransactions,
      {
        id: `stx_${Date.now()}_owner_deduct`,
        userId: customerId,
        storeId,
        amount: -actualDeducted,
        type: 'point_conversion' as const,
        createdAt: getSkewCorrectedIsoString()
      }
    ];

    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      stampTransactions: newStampTxs
    });

    const store = dbState.stores.find(s => s.id === storeId);
    const storeName = store ? store.name : storeId;
    playVoiceGuidance(
      language === 'ko'
        ? `${storeName}에서 스탬프 ${actualDeducted}개가 차감되었습니다.`
        : `${actualDeducted} stamps have been deducted from ${storeName}.`,
      language
    );

    return { success: true, message: 'Deducted successfully' };
  };

  const giveStampsByOwner = (customerId: string, storeId: string, count: number, message: string) => {
    if (!dbState) return { success: false, stampsQueued: 0, message: 'DB Error' };
    if (!currentOwner) return { success: false, stampsQueued: 0, message: 'Owner session not found' };
    const customer = dbState.users.find(u => u.id === customerId);
    if (customer && customer.status === 'suspended') {
      return { success: false, stampsQueued: 0, message: language === 'ko' ? '활동이 정지된 사용자입니다.' : 'This user is suspended.' };
    }

    const stampCardsList = [...dbState.stampCards];
    const cardIdx = stampCardsList.findIndex(c => c.userId === customerId && c.storeId === storeId);
    const current = cardIdx > -1 ? stampCardsList[cardIdx].currentStamps : 0;
    const maxCanGive = 7 - current;

    if (maxCanGive <= 0) {
      return { 
        success: false, 
        stampsQueued: 0, 
        message: language === 'ko' 
          ? '해당 고객은 이미 스탬프가 가득 차서 더 이상 지급할 수 없습니다.' 
          : 'Customer stamp board is already full.' 
      };
    }

    const actualGive = Math.min(count, maxCanGive);

    // 1. stampCards 업데이트 (카드가 없으면 신규 생성, 있으면 기존 카드 업데이트)
    const store = dbState.stores.find(s => s.id === storeId);
    const rewardPer7 = store ? store.pointRewardPer7Stamps : 5;
    const valuePerStamp = rewardPer7 / 7;

    const stampsToAdd = [];
    for (let i = 0; i < actualGive; i++) {
      stampsToAdd.push({
        id: `stamp_${Date.now()}_owner_${i}_${Math.floor(Math.random() * 1000)}`,
        acquiredAt: getSkewCorrectedIsoString(),
        cashValue: parseFloat(valuePerStamp.toFixed(2))
      });
    }

    if (cardIdx === -1) {
      const newCard: StampCard = {
        id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: customerId,
        storeId,
        currentStamps: actualGive,
        stamps: stampsToAdd,
        updatedAt: getSkewCorrectedIsoString()
      };
      stampCardsList.push(newCard);
    } else {
      const card = stampCardsList[cardIdx];
      const existingStamps = card.stamps ? [...(card.stamps || [])] : [];
      // 자가 치유
      if (existingStamps.length !== current) {
        existingStamps.length = 0;
        for (let i = 0; i < current; i++) {
          existingStamps.push({
            id: `stamp_mig_${card.id}_${i}_${Date.now()}`,
            acquiredAt: card.updatedAt || getSkewCorrectedIsoString(),
            cashValue: parseFloat(valuePerStamp.toFixed(2))
          });
        }
      }

      stampCardsList[cardIdx] = {
        ...card,
        currentStamps: current + actualGive,
        stamps: [...existingStamps, ...stampsToAdd],
        updatedAt: getSkewCorrectedIsoString()
      };
    }

    // 2. Gift 테이블에 즉시 수락(accepted) 완료된 상태로 기프트 생성
    const giftId = `gift_${Date.now()}_owner`;
    const newGift: Gift = {
      id: giftId,
      senderId: currentOwner.id,
      recipientId: customerId,
      storeId,
      stampsSent: actualGive,
      stampsTransferred: actualGive,
      message,
      createdAt: getSkewCorrectedIsoString(),
      status: 'accepted',
      stamps: stampsToAdd
    };

    // 3. 스탬프 거래 내역 추가
    const newStampTxs: StampTransaction[] = [
      ...dbState.stampTransactions,
      {
        id: `stx_${Date.now()}_owner`,
        userId: customerId,
        storeId,
        amount: actualGive,
        type: 'earn',
        referenceId: giftId,
        createdAt: getSkewCorrectedIsoString()
      }
    ];

    updateDbState({
      ...dbState,
      stampCards: stampCardsList,
      stampTransactions: newStampTxs,
      gifts: [...dbState.gifts, newGift]
    });

    const storeName = store ? store.name : storeId;
    playVoiceGuidance(
      language === 'ko'
        ? `${storeName} 스탬프 ${actualGive}개가 성공적으로 지급되었습니다.`
        : `${actualGive} stamps for ${storeName} have been successfully given.`,
      language
    );

    return { success: true, stampsQueued: actualGive, message: 'Stamps given successfully' };
  };

  const requestPayment = (userId: string, storeId: string, amount: number, type: 'payment' | 'donation' = 'payment', nonProfitId?: string): string => {
    if (!dbState) return '';
    const user = dbState.users.find(u => u.id === userId);
    if (!user) return '';
    const requestId = `pr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    
    // 중복 요청 방지를 위해 기존의 동일 유저/매장 대기중인 결제 요청 삭제
    const cleanRequests = dbState.paymentRequests.filter(r => !(r.userId === userId && r.storeId === storeId && r.status === 'pending'));
    
    const npo = nonProfitId ? dbState.nonProfits.find(n => n.id === nonProfitId) : undefined;

    const newRequest: PaymentRequest = {
      id: requestId,
      userId,
      userName: user.name,
      userNickname: user.nickname,
      storeId,
      amount,
      status: 'pending',
      createdAt: getSkewCorrectedIsoString(),
      type,
      nonProfitId,
      nonProfitName: npo ? npo.name : undefined
    };

    updateDbState({
      ...dbState,
      paymentRequests: [newRequest, ...cleanRequests]
    });

    if (type === 'donation' && npo) {
      playVoiceGuidance(
        language === 'ko'
          ? `${npo.name}으로 스탬프 캐시 ${amount}달러 기부 요청을 보냈습니다. 승인을 기다려 주세요.`
          : `Request to donate ${amount} dollars to ${npo.name} has been sent. Please wait for approval.`,
        language
      );
    } else {
      playVoiceGuidance(
        language === 'ko'
          ? `스탬프 캐시 ${amount}달러 사용 요청을 보냈습니다. 점장님의 승인을 기다려 주세요.`
          : `Request to use ${amount} dollars in stamp cash has been sent. Please wait for store manager approval.`,
        language
      );
    }

    return requestId;
  };

  const approvePayment = (requestId: string, customThanksMessage?: string) => {
    if (!dbState) return;
    const request = dbState.paymentRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return;

    // 포인트 잔액 감액 검증
    const userPoints = dbState.storePoints.filter(p => p.userId === request.userId);
    const totalAvailable = userPoints.reduce((sum, p) => sum + p.pointsBalance, 0);
    if (totalAvailable < request.amount) {
      rejectPayment(requestId);
      return;
    }

    let remainingToDeduct = request.amount;
    const updatedPoints = [...dbState.storePoints];
    const newPointTxs = [...dbState.pointTransactions];

    for (let i = 0; i < updatedPoints.length; i++) {
      const p = updatedPoints[i];
      if (p.userId === request.userId && p.pointsBalance > 0) {
        const deductAmount = Math.min(p.pointsBalance, remainingToDeduct);
        updatedPoints[i] = {
          ...p,
          pointsBalance: Math.round((p.pointsBalance - deductAmount) * 100) / 100,
          updatedAt: getSkewCorrectedIsoString()
        };
        newPointTxs.push({
          id: `ptx_${Date.now()}_${i}`,
          userId: request.userId,
          storeId: p.storeId,
          amount: -deductAmount,
          type: 'use_payment' as const,
          createdAt: getSkewCorrectedIsoString()
        });
        remainingToDeduct = Math.round((remainingToDeduct - deductAmount) * 100) / 100;
        if (remainingToDeduct <= 0) break;
      }
    }

    const updatedRequests = dbState.paymentRequests.map(r => 
      r.id === requestId ? { ...r, status: 'approved' as const } : r
    );

    // 스탬프 초기화 (0으로 리셋)
    const updatedCards = [...dbState.stampCards];
    let newStampTxs = [...dbState.stampTransactions];
    
    if (request.type === 'payment') {
      const cardIdx = updatedCards.findIndex(c => c.userId === request.userId && c.storeId === request.storeId);
      if (cardIdx > -1) {
        const prevStamps = updatedCards[cardIdx].currentStamps;
        if (prevStamps > 0) {
          newStampTxs.push({
            id: `stx_${Date.now()}_reset`,
            userId: request.userId,
            storeId: request.storeId,
            amount: -prevStamps,
            type: 'point_conversion',
            createdAt: getSkewCorrectedIsoString()
          });
        }
        updatedCards[cardIdx] = {
          ...updatedCards[cardIdx],
          currentStamps: 0,
          stamps: [],
          updatedAt: getSkewCorrectedIsoString()
        };
      }
    }

    // 기부 요청인 경우 기부 데이터 추가 및 정밀 기부 환산 연산
    let updatedDonations = dbState.donations;
    if (request.type === 'donation' && request.nonProfitId) {
      const store = dbState.stores.find(s => s.id === request.storeId)!;
      // 스탬프 기부 개수 등가 가치 환산 (예: $5 / 7)
      const stampCountEquivalent = Math.round((request.amount * 7 / store.pointRewardPer7Stamps) * 100) / 100;
      
      const donationId = `don_${Date.now()}`;
      const newDonation: Donation = {
        id: donationId,
        donorId: request.userId,
        storeId: request.storeId,
        nonProfitId: request.nonProfitId,
        stampCount: stampCountEquivalent,
        monetaryValue: request.amount,
        createdAt: getSkewCorrectedIsoString()
      };
      
      updatedDonations = [...dbState.donations, newDonation];
    }

    // 스탬프 사용/기부 승인에 대한 사장님 감사 메시지 전송 (gifts 기록)
    const giftId = `gift_${Date.now()}_approve`;
    const defaultMsg = request.type === 'donation'
      ? (language === 'ko' 
          ? `${request.nonProfitName || 'NPO'} 기부가 승인되었습니다. 따뜻한 후원에 감사드립니다.` 
          : `Donation to ${request.nonProfitName || 'NPO'} has been approved. Thank you for your support.`)
      : (language === 'ko'
          ? `스탬프 캐시 ${request.amount}달러 결제가 승인되었습니다. 이용해 주셔서 감사합니다!`
          : `Stamp cash payment of ${request.amount} dollars has been approved. Thank you!`);

    const newGift: Gift = {
      id: giftId,
      senderId: currentOwner ? currentOwner.id : request.storeId,
      recipientId: request.userId,
      storeId: request.storeId,
      stampsSent: 0,
      stampsTransferred: 0,
      message: customThanksMessage || defaultMsg,
      createdAt: getSkewCorrectedIsoString(),
      status: 'accepted',
      thanksMessage: ''
    };

    updateDbState({
      ...dbState,
      storePoints: updatedPoints,
      pointTransactions: newPointTxs,
      paymentRequests: updatedRequests,
      donations: updatedDonations,
      stampCards: updatedCards,
      stampTransactions: newStampTxs,
      gifts: [...dbState.gifts, newGift]
    });

    if (request.type === 'donation' && request.nonProfitName) {
      playVoiceGuidance(
        language === 'ko'
          ? `${request.nonProfitName} 기부 요청이 승인되었습니다. 따뜻한 후원에 감사드립니다.`
          : `Donation to ${request.nonProfitName} has been approved. Thank you for your support.`,
        language
      );
    } else {
      playVoiceGuidance(
        language === 'ko'
          ? `스탬프 캐시 ${request.amount}달러 결제가 승인되었습니다.`
          : `Stamp cash payment of ${request.amount} dollars has been approved.`,
        language
      );
    }
  };

  const rejectPayment = (requestId: string) => {
    if (!dbState) return;
    const request = dbState.paymentRequests.find(r => r.id === requestId);
    if (!request || request.status !== 'pending') return;

    const updatedRequests = dbState.paymentRequests.map(r => 
      r.id === requestId ? { ...r, status: 'rejected' as const } : r
    );

    updateDbState({
      ...dbState,
      paymentRequests: updatedRequests
    });

    if (request.type === 'donation') {
      playVoiceGuidance(
        language === 'ko'
          ? `요청하신 기부 단체 기부가 거절되었습니다.`
          : `Requested charity donation has been rejected.`,
        language
      );
    } else {
      playVoiceGuidance(
        language === 'ko'
          ? `요청하신 스탬프 캐시 사용이 거절되었습니다.`
          : `Requested stamp cash usage has been rejected.`,
        language
      );
    }
  };

  const cancelPaymentRequest = (requestId: string) => {
    if (!dbState) return;
    const updatedRequests = dbState.paymentRequests.filter(r => r.id !== requestId);
    updateDbState({
      ...dbState,
      paymentRequests: updatedRequests
    }, true);
  };

  const addNonProfit = (name: string, description: string) => {
    if (!dbState) return;
    const newNpo: NonProfit = {
      id: `npo_${Date.now()}`,
      code: `CUSTOM_${Date.now()}`,
      name,
      description,
      status: 'active'
    };
    updateDbState({ ...dbState, nonProfits: [...dbState.nonProfits, newNpo] });
  };

  const updateNonProfit = (id: string, name: string, description: string) => {
    if (!dbState) return;
    const updated = dbState.nonProfits.map(n =>
      n.id === id ? { ...n, name, description } : n
    );
    updateDbState({ ...dbState, nonProfits: updated });
  };

  const toggleNonProfitStatus = (id: string) => {
    if (!dbState) return;
    const updated = dbState.nonProfits.map(n =>
      n.id === id ? { ...n, status: n.status === 'active' ? 'inactive' as const : 'active' as const } : n
    );
    updateDbState({ ...dbState, nonProfits: updated });
  };

  const deleteNonProfit = (id: string) => {
    if (!dbState) return;
    updateDbState({
      ...dbState,
      nonProfits: dbState.nonProfits.filter(n => n.id !== id)
    }, true);
  };

  const addAdBanner = (title: string, subtitle: string, linkUrl: string, imageUrl?: string) => {
    if (!dbState) return;
    const newAd: AdBanner = {
      id: `ad_${Date.now()}`,
      title,
      subtitle,
      linkUrl,
      imageUrl,
      status: 'active',
      createdAt: getSkewCorrectedIsoString()
    };
    updateDbState({
      ...dbState,
      adBanners: [newAd, ...dbState.adBanners]
    });
    playVoiceGuidance(
      language === 'ko' ? "새 광고 배너가 등록되었습니다." : "New ad banner registered.",
      language
    );
  };

  const toggleAdBannerStatus = (id: string) => {
    if (!dbState) return;
    const target = dbState.adBanners.find(ad => ad.id === id);
    if (!target) return;
    // 마지막 활성 배너는 비활성화 불가 (최소 1개 유지)
    if (target.status === 'active') {
      const activeCount = dbState.adBanners.filter(ad => ad.status === 'active').length;
      if (activeCount <= 1) return;
    }
    const updatedAds = dbState.adBanners.map(ad =>
      ad.id === id ? { ...ad, status: ad.status === 'active' ? 'inactive' as const : 'active' as const } : ad
    );
    updateDbState({
      ...dbState,
      adBanners: updatedAds
    });
    playVoiceGuidance(
      language === 'ko' ? "광고 상태가 변경되었습니다." : "Ad status updated.",
      language
    );
  };

  const deleteAdBanner = (id: string) => {
    if (!dbState) return;
    const updatedAds = dbState.adBanners.filter(ad => ad.id !== id);
    updateDbState({
      ...dbState,
      adBanners: updatedAds
    }, true);
    playVoiceGuidance(
      language === 'ko' ? "광고 배너가 삭제되었습니다." : "Ad banner deleted.",
      language
    );
  };

  const addCategory = (name: string) => {
    if (!dbState) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    
    const exists = (dbState.categories || []).some(
      cat => cat.toLowerCase().replace(/\s+/g, '') === trimmed.toLowerCase().replace(/\s+/g, '')
    );
    if (exists || trimmed.includes('기타') || trimmed.toLowerCase().includes('other')) {
      alert(language === 'ko' ? '이미 존재하는 업종명이거나 예약된 업종명입니다.' : 'This business type already exists or is reserved.');
      return;
    }

    const updated = [...(dbState.categories || []), trimmed];
    updateDbState({
      ...dbState,
      categories: updated
    });
  };

  const deleteCategory = (name: string) => {
    if (!dbState) return;
    const updated = (dbState.categories || []).filter(cat => cat !== name);
    updateDbState({
      ...dbState,
      categories: updated
    }, true);
  };

  const registerStripeConnect = (storeId: string) => {
    if (!dbState) return;
    const updatedStores = dbState.stores.map(s => {
      if (s.id === storeId) {
        return { ...s, stripeConnected: true, stripeAccountId: `acct_${Math.random().toString(36).substring(2, 10)}` };
      }
      return s;
    });
    updateDbState({
      ...dbState,
      stores: updatedStores
    });
    playVoiceGuidance(
      language === 'ko' ? '스트라이프 커넥트 연동이 완료되었습니다.' : 'Stripe Connect registration completed.',
      language
    );
  };

  const buyGiftCard = (userId: string, storeId: string, amount: number) => {
    if (!dbState) throw new Error('DB not loaded');
    const store = dbState.stores.find(s => s.id === storeId);
    if (!store) throw new Error('Store not found');

    const cardId = `gc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const newGiftCard: GiftCard = {
      id: cardId,
      userId,
      storeId,
      initialAmount: amount,
      currentBalance: amount,
      barcode: `GC-${Math.floor(10000000 + Math.random() * 90000000)}`,
      status: 'active',
      createdAt: getSkewCorrectedIsoString(),
      updatedAt: getSkewCorrectedIsoString()
    };

    const newTx: GiftCardTransaction = {
      id: `gctx_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      giftCardId: cardId,
      type: 'purchase',
      amount,
      createdAt: getSkewCorrectedIsoString()
    };

    const updatedGiftCards = [...(dbState.giftCards || []), newGiftCard];
    const updatedTransactions = [...(dbState.giftCardTransactions || []), newTx];

    updateDbState({
      ...dbState,
      giftCards: updatedGiftCards,
      giftCardTransactions: updatedTransactions
    });

    playVoiceGuidance(
      language === 'ko'
        ? `${amount}달러 기프트 카드 구매가 완료되었습니다.`
        : `$${amount} Gift Card purchased successfully.`,
      language
    );

    return { success: true, giftCard: newGiftCard };
  };

  const sendGiftCard = (giftCardId: string, recipientPhoneNumber: string) => {
    if (!dbState) throw new Error('DB not loaded');
    const updatedGiftCards = dbState.giftCards.map(gc => {
      if (gc.id === giftCardId) {
        return {
          ...gc,
          recipientPhoneNumber,
          updatedAt: getSkewCorrectedIsoString()
        };
      }
      return gc;
    });

    updateDbState({
      ...dbState,
      giftCards: updatedGiftCards
    });

    const shareLink = `${window.location.origin}${window.location.pathname}#/claim?giftId=${giftCardId}`;

    return { success: true, shareLink };
  };

  const claimGiftCard = (userId: string, phoneNumber: string) => {
    if (!dbState) return { success: false, claimedCount: 0 };
    let claimedCount = 0;
    const updatedGiftCards = dbState.giftCards.map(gc => {
      if (gc.recipientPhoneNumber === phoneNumber && gc.userId !== userId) {
        claimedCount++;
        return {
          ...gc,
          userId,
          recipientPhoneNumber: undefined,
          updatedAt: getSkewCorrectedIsoString()
        };
      }
      return gc;
    });

    if (claimedCount > 0) {
      updateDbState({
        ...dbState,
        giftCards: updatedGiftCards
      });
      playVoiceGuidance(
        language === 'ko'
          ? `${claimedCount}개의 선물받은 기프트 카드를 수령했습니다.`
          : `Claimed ${claimedCount} gifted cards.`,
        language
      );
      return { success: true, claimedCount };
    }

    return { success: false, claimedCount: 0 };
  };

  const processSplitPayment = (
    userId: string,
    storeId: string,
    billAmount: number,
    useStamps: boolean,
    useGiftCard: boolean
  ) => {
    if (!dbState) throw new Error('DB not loaded');
    
    let remaining = billAmount;
    let deductedPoints = 0;
    let deductedGift = 0;
    
    const updatedPoints = [...dbState.storePoints];
    const updatedGiftCards = [...dbState.giftCards];
    const updatedTx = [...dbState.giftCardTransactions];
    const pointTxs = [...dbState.pointTransactions];

    // 1. Deduct Stamp Cash (Points) first if toggled
    if (useStamps) {
      const pIdx = updatedPoints.findIndex(p => p.userId === userId && p.storeId === storeId);
      if (pIdx !== -1) {
        const balance = updatedPoints[pIdx].pointsBalance;
        if (balance > 0) {
          const deduct = Math.min(balance, remaining);
          updatedPoints[pIdx] = {
            ...updatedPoints[pIdx],
            pointsBalance: Number((balance - deduct).toFixed(2)),
            updatedAt: getSkewCorrectedIsoString()
          };
          remaining = Number((remaining - deduct).toFixed(2));
          deductedPoints = deduct;

          pointTxs.push({
            id: `ptx_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            userId,
            storeId,
            amount: -deduct,
            type: 'use_payment',
            createdAt: getSkewCorrectedIsoString()
          });
        }
      }
    }

    // 2. Deduct Gift Card second if toggled
    if (useGiftCard && remaining > 0) {
      const activeCards = updatedGiftCards.filter(
        gc => gc.userId === userId && gc.storeId === storeId && gc.currentBalance > 0 && gc.status === 'active'
      );

      for (const gc of activeCards) {
        if (remaining <= 0) break;
        const balance = gc.currentBalance;
        const deduct = Math.min(balance, remaining);
        
        gc.currentBalance = Number((balance - deduct).toFixed(2));
        if (gc.currentBalance <= 0) {
          gc.status = 'exhausted';
        }
        gc.updatedAt = getSkewCorrectedIsoString();
        remaining = Number((remaining - deduct).toFixed(2));
        deductedGift = Number((deductedGift + deduct).toFixed(2));

        updatedTx.push({
          id: `gctx_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          giftCardId: gc.id,
          type: 'use',
          amount: deduct,
          createdAt: getSkewCorrectedIsoString()
        });
      }
    }

    updateDbState({
      ...dbState,
      storePoints: updatedPoints,
      giftCards: updatedGiftCards,
      giftCardTransactions: updatedTx,
      pointTransactions: pointTxs
    });

    const summary = language === 'ko'
      ? `결제 완료: 스탬프 캐시 $${deductedPoints.toFixed(2)}, 기프트 카드 $${deductedGift.toFixed(2)} 차감. (남은 결제액: $${remaining.toFixed(2)})`
      : `Payment completed: Points $${deductedPoints.toFixed(2)}, Gift Card $${deductedGift.toFixed(2)} deducted. (Remaining bill: $${remaining.toFixed(2)})`;

    playVoiceGuidance(
      language === 'ko' ? '결제가 완료되었습니다.' : 'Payment approved.',
      language
    );

    return {
      success: true,
      summary,
      remaining,
      deductedPoints,
      deductedGift
    };
  };

  const processRefund = (transactionId: string, refundAmount: number, pinCode: string) => {
    if (!dbState) throw new Error('DB not loaded');

    // 3-Tier Security Validation
    if (refundAmount <= 10) {
      // Instant approval
    } else if (refundAmount > 10 && refundAmount < 100) {
      if (pinCode !== '1234') {
        return { success: false, message: language === 'ko' ? '매니저 비밀번호(PIN)가 틀렸습니다.' : 'Incorrect Manager PIN.' };
      }
    } else {
      if (pinCode !== 'owner1234') {
        return { success: false, message: language === 'ko' ? '점주 승인 패스워드가 올바르지 않습니다.' : 'Invalid Owner credentials.' };
      }
    }

    const targetTx = dbState.giftCardTransactions.find(t => t.id === transactionId);
    if (!targetTx) {
      return { success: false, message: language === 'ko' ? '거래 내역을 찾을 수 없습니다.' : 'Transaction not found.' };
    }

    const updatedGiftCards = dbState.giftCards.map(gc => {
      if (gc.id === targetTx.giftCardId) {
        const newBalance = Number((gc.currentBalance + refundAmount).toFixed(2));
        return {
          ...gc,
          currentBalance: newBalance,
          status: newBalance > 0 ? 'active' as const : gc.status,
          updatedAt: getSkewCorrectedIsoString()
        };
      }
      return gc;
    });

    const newTx: GiftCardTransaction = {
      id: `gctx_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      giftCardId: targetTx.giftCardId,
      type: 'refund_add',
      amount: refundAmount,
      createdAt: getSkewCorrectedIsoString()
    };

    updateDbState({
      ...dbState,
      giftCards: updatedGiftCards,
      giftCardTransactions: [...dbState.giftCardTransactions, newTx]
    });

    playVoiceGuidance(
      language === 'ko' ? `${refundAmount}달러가 환불 처리되었습니다.` : `$${refundAmount} has been refunded.`,
      language
    );

    return { success: true, message: 'Success' };
  };

  const suspendUser = (userId: string) => {
    if (!dbState) return;
    const updatedUsers = dbState.users.map(u => {
      if (u.id === userId) {
        const newStatus = u.status === 'suspended' ? 'active' : 'suspended';
        return { ...u, status: newStatus as 'active' | 'suspended' };
      }
      return u;
    });

    updateDbState({
      ...dbState,
      users: updatedUsers
    });

    const updatedUser = updatedUsers.find(u => u.id === userId);
    if (updatedUser) {
      const isSuspended = updatedUser.status === 'suspended';
      playVoiceGuidance(
        language === 'ko'
          ? `${updatedUser.name} 회원의 활동정지 상태가 ${isSuspended ? '설정' : '해제'}되었습니다.`
          : `User ${updatedUser.name} has been ${isSuspended ? 'suspended' : 'unsuspended'}.`,
        language
      );
      
      if (isSuspended) {
        if (currentUser && currentUser.id === userId) {
          logout();
        }
        if (currentOwner && currentOwner.id === userId) {
          setCurrentOwner(null);
        }
      }
    }
  };

  const deleteUser = (userId: string) => {
    if (!dbState) return;
    const targetUser = dbState.users.find(u => u.id === userId);
    if (!targetUser) return;

    const updatedUsers = dbState.users.map(u => 
      u.id === userId 
        ? { ...u, status: 'deleted' as const, updatedAt: getSkewCorrectedIsoString() } 
        : u
    );
    const updatedDevices = dbState.userDevices.filter(d => d.userId !== userId);
    const updatedCards = dbState.stampCards.filter(c => c.userId !== userId);
    const updatedPoints = dbState.storePoints.filter(p => p.userId !== userId);
    
    // Clean up related lists to prevent orphan references/UI crashes
    const updatedGifts = dbState.gifts.filter(g => g.senderId !== userId && g.recipientId !== userId);
    const updatedDonations = dbState.donations.filter(d => d.donorId !== userId);
    const updatedStampTxs = dbState.stampTransactions.filter(t => t.userId !== userId);
    const updatedPointTxs = dbState.pointTransactions.filter(t => t.userId !== userId);
    const updatedPaymentRequests = dbState.paymentRequests.filter(r => r.userId !== userId);

    updateDbState({
      ...dbState,
      users: updatedUsers,
      userDevices: updatedDevices,
      stampCards: updatedCards,
      storePoints: updatedPoints,
      gifts: updatedGifts,
      donations: updatedDonations,
      stampTransactions: updatedStampTxs,
      pointTransactions: updatedPointTxs,
      paymentRequests: updatedPaymentRequests
    }, true);

    playVoiceGuidance(
      language === 'ko'
        ? `${targetUser.name} 회원의 계정 및 모든 데이터가 성공적으로 삭제되었습니다.`
        : `User ${targetUser.name} and all associated data have been deleted.`,
      language
    );

    if (currentUser && currentUser.id === userId) {
      logout();
    }
    if (currentOwner && currentOwner.id === userId) {
      setCurrentOwner(null);
    }
  };

  const toggleStoreStatus = (storeId: string) => {
    if (!dbState) return;
    const updatedStores = dbState.stores.map(s => {
      if (s.id === storeId) {
        const currentStatus = s.status || 'active';
        return {
          ...s,
          status: (currentStatus === 'active' ? 'suspended' : 'active') as 'active' | 'suspended'
        };
      }
      return s;
    });

    updateDbState({
      ...dbState,
      stores: updatedStores
    });

    const targetStore = updatedStores.find(s => s.id === storeId);
    if (targetStore) {
      const isSuspended = targetStore.status === 'suspended';
      playVoiceGuidance(
        language === 'ko'
          ? `${targetStore.name} 매장의 상태가 ${isSuspended ? '활동정지' : '정지해제'} 상태로 변경되었습니다.`
          : `Store ${targetStore.name} has been ${isSuspended ? 'suspended' : 'unsuspended'}.`,
        language
      );
    }
  };

  const deleteStore = (storeId: string) => {
    if (!dbState) return;
    const targetStore = dbState.stores.find(s => s.id === storeId);
    if (!targetStore) return;

    const updatedStores = dbState.stores.filter(s => s.id !== storeId);
    const updatedCards = dbState.stampCards.filter(c => c.storeId !== storeId);
    const updatedPoints = dbState.storePoints.filter(p => p.storeId !== storeId);
    const updatedDonations = dbState.donations.filter(d => d.storeId !== storeId);
    const updatedGifts = dbState.gifts.filter(g => g.storeId !== storeId);
    const updatedStampTxs = dbState.stampTransactions.filter(t => t.storeId !== storeId);
    const updatedPointTxs = dbState.pointTransactions.filter(t => t.storeId !== storeId);
    const updatedReceiptScans = dbState.receiptScans.filter(r => r.storeId !== storeId);
    const updatedPaymentRequests = dbState.paymentRequests.filter(r => r.storeId !== storeId);
    const updatedGiftCards = dbState.giftCards.filter(g => g.storeId !== storeId);
    const updatedGiftCardTxs = dbState.giftCardTransactions.filter(tx => {
      const gcIds = new Set(updatedGiftCards.map(gc => gc.id));
      return gcIds.has(tx.giftCardId);
    });

    updateDbState({
      ...dbState,
      stores: updatedStores,
      stampCards: updatedCards,
      storePoints: updatedPoints,
      donations: updatedDonations,
      gifts: updatedGifts,
      stampTransactions: updatedStampTxs,
      pointTransactions: updatedPointTxs,
      receiptScans: updatedReceiptScans,
      paymentRequests: updatedPaymentRequests,
      giftCards: updatedGiftCards,
      giftCardTransactions: updatedGiftCardTxs
    }, true);

    playVoiceGuidance(
      language === 'ko'
        ? `${targetStore.name} 매장과 관련된 모든 데이터가 삭제되었습니다.`
        : `Store ${targetStore.name} and all related data have been deleted.`,
      language
    );
  };

  const changeOwnerPassword = (ownerId: string, newPassword: string): { success: boolean; message: string } => {
    if (!dbState) return { success: false, message: 'DB 상태 에러' };
    const targetOwner = dbState.users.find(u => u.id === ownerId && u.role === 'owner');
    if (!targetOwner) {
      return { success: false, message: language === 'ko' ? '사장을 찾을 수 없습니다.' : 'Owner not found.' };
    }

    const updatedUsers = dbState.users.map(u => {
      if (u.id === ownerId) {
        return { ...u, password: newPassword };
      }
      return u;
    });

    updateDbState({
      ...dbState,
      users: updatedUsers
    });

    if (currentOwner && currentOwner.id === ownerId) {
      const updatedOwner = { ...currentOwner, password: newPassword };
      setCurrentOwner(updatedOwner);
    }

    playVoiceGuidance(
      language === 'ko'
        ? `${targetOwner.name} 사장님의 비밀번호가 변경되었습니다.`
        : `Password for owner ${targetOwner.name} has been changed.`,
      language
    );

    return { success: true, message: 'Success' };
  };

  const approveOwnerRequest = (ownerId: string) => {
    if (!dbState) return;
    const targetOwner = dbState.users.find(u => u.id === ownerId);
    if (!targetOwner) return;

    const updatedUsers = dbState.users.map(u => {
      if (u.id === ownerId) {
        return { ...u, status: 'active' as const, updatedAt: getSkewCorrectedIsoString() };
      }
      return u;
    });

    updateDbState({
      ...dbState,
      users: updatedUsers
    });

    playVoiceGuidance(
      language === 'ko'
        ? `${targetOwner.name} 사장님의 가입 요청이 승인되었습니다.`
        : `Registration request for owner ${targetOwner.name} has been approved.`,
      language
    );
  };

  const rejectOwnerRequest = (ownerId: string) => {
    if (!dbState) return;
    const targetOwner = dbState.users.find(u => u.id === ownerId);
    if (!targetOwner) return;

    // Reset store mapped to this owner
    const updatedStores = dbState.stores.map(s => {
      if (s.ownerId === ownerId) {
        return { ...s, ownerId: 'none', updatedAt: getSkewCorrectedIsoString() };
      }
      return s;
    });

    // Remove owner user
    const updatedUsers = dbState.users.filter(u => u.id !== ownerId);

    updateDbState({
      ...dbState,
      users: updatedUsers,
      stores: updatedStores
    }, true);

    playVoiceGuidance(
      language === 'ko'
        ? `${targetOwner.name} 사장님의 가입 요청이 거절되었습니다.`
        : `Registration request for owner ${targetOwner.name} has been rejected.`,
      language
    );
  };

  // 기기/탭 간 실시간 세션 동기화 (예: 다른 탭에서 사장 승인 시 세션 강제 갱신 등)
  useEffect(() => {
    if (!dbState || !currentOwner) return;
    const freshOwner = dbState.users.find(u => u.id === currentOwner.id);
    if (freshOwner && freshOwner.status !== currentOwner.status) {
      setCurrentOwner(freshOwner);
    }
  }, [dbState, currentOwner]);

  // 컨텍스트에 바인딩
  const value: DatabaseContextProps = {
    users: dbState?.users || [],
    userDevices: dbState?.userDevices || [],
    stores: dbState ? dbState.stores.map(s => translateStore(s, language)) : [],
    stampCards: dbState?.stampCards || [],
    storePoints: dbState?.storePoints || [],
    nonProfits: dbState ? dbState.nonProfits.map(n => translateNpo(n, language)) : [],
    donations: dbState?.donations || [],
    gifts: dbState?.gifts || [],
    stampTransactions: dbState?.stampTransactions || [],
    pointTransactions: dbState?.pointTransactions || [],
    receiptScans: dbState?.receiptScans || [],
    paymentRequests: dbState?.paymentRequests || [],
    adBanners: dbState ? dbState.adBanners.map(ad => translateAd(ad, language)) : [],
    
    currentUser,
    currentDeviceToken,
    setCurrentUser,
    loginByDeviceToken,
    loginByPhoneNumber,
    logout,
    registerUser,
    searchFriend,
    
    generateQR,
    validateQR,
    registerQRScan,
    claimQRStamps,
    
    earnStampsDirectly,
    giftStamps,
    acceptGift,
    declineGift,
    convertStampsToCash,
    donateStamps,
    donatePointsDirect,
    redeemPoints,
    settleDonations,
    updateStoreInterval,
    updateStoreRewardAmount,
    deductStampsByOwner,
    giveStampsByOwner,

    requestPayment,
    approvePayment,
    rejectPayment,
    cancelPaymentRequest,
    
    addAdBanner,
    toggleAdBannerStatus,
    deleteAdBanner,

    addNonProfit,
    updateNonProfit,
    toggleNonProfitStatus,
    deleteNonProfit,

    resetDatabase,
    importDatabase,
    exportDatabase,
    
    language,
    setLanguage,
    selectedStoreId: dbState && dbState.stores.length > 0 && dbState.stores.some(s => s.id === selectedStoreId)
      ? selectedStoreId
      : (dbState && dbState.stores.length > 0 ? dbState.stores[0].id : 'store_id_1'),
    setSelectedStoreId,
    customerSelectedStoreId: dbState && dbState.stores.length > 0 && dbState.stores.some(s => s.id === customerSelectedStoreId)
      ? customerSelectedStoreId
      : (dbState && dbState.stores.length > 0 ? dbState.stores[0].id : 'store_id_1'),
    setCustomerSelectedStoreId,
    kioskSelectedStoreId: dbState && dbState.stores.length > 0 && dbState.stores.some(s => s.id === kioskSelectedStoreId)
      ? kioskSelectedStoreId
      : (dbState && dbState.stores.length > 0 ? dbState.stores[0].id : 'store_id_1'),
    setKioskSelectedStoreId,
    ownerSelectedStoreId: dbState && dbState.stores.length > 0 && dbState.stores.some(s => s.id === ownerSelectedStoreId)
      ? ownerSelectedStoreId
      : (dbState && dbState.stores.length > 0 ? dbState.stores[0].id : 'store_id_1'),
    setOwnerSelectedStoreId,
    ownerPassword,
    setOwnerPassword,
    currentOwner,
    setCurrentOwner,
    registerOwner,
    registerStore,
    
    suspendUser,
    deleteUser,
    reviews: dbState?.reviews || [],
    addReview,
    updateReviewMedia,
    updateStoreMiniHome,
    giftCards: dbState?.giftCards || [],
    giftCardTransactions: dbState?.giftCardTransactions || [],
    buyGiftCard,
    sendGiftCard,
    claimGiftCard,
    processSplitPayment,
    processRefund,
    registerStripeConnect,
    categories: dbState?.categories || [],
    addCategory,
    deleteCategory,
    approveOwnerRequest,
    rejectOwnerRequest,
    toggleStoreStatus,
    deleteStore,
    changeOwnerPassword
  };

  return (
    <DatabaseContext.Provider value={value}>
      {dbState ? children : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>가상 데이터베이스 구동중...</div>}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
