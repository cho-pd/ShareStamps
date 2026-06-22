import React, { createContext, useContext, useState, useEffect } from 'react';
import { playVoiceGuidance } from '../utils/voice';

const formatInterval = (minutes: number, lang: 'ko' | 'en' = 'ko') => {
  const minsNum = typeof minutes === 'number' && !isNaN(minutes) ? minutes : 60;
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
  
  const name = translations[store.id] || store.name.replace('매장', 'Store').replace('호점', '');
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

// --- 인터페이스 정의 ---
export interface User {
  id: string;
  phoneNumber: string;
  nickname: string;
  name: string;
  role: 'customer' | 'owner' | 'admin';
  loginId?: string;
  password?: string;
  status?: 'active' | 'suspended';
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
  category: 'restaurant' | 'cafe' | 'salon' | 'bakery' | 'retail' | 'other';
  pointRewardPer7Stamps: number; // 7개 완성 시 보상 캐시 금액 (예: $5.00, $30.00)
  currency: string;
  earningIntervalMinutes: number; // 동일 고객 재적립 제한 시간 (분)
}

export interface StampCard {
  id: string;
  userId: string;
  storeId: string;
  currentStamps: number; // 0 to 6
  updatedAt: string;
}

export interface StorePoint {
  id: string;
  userId: string;
  storeId: string;
  pointsBalance: number;
  updatedAt: string;
}

export interface NonProfit {
  id: string;
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
}

export interface StampTransaction {
  id: string;
  userId: string;
  storeId: string;
  amount: number;
  type: 'earn' | 'gift_send' | 'gift_receive' | 'donation' | 'point_conversion';
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
  
  // 로그인 상태 및 디바이스
  currentUser: User | null;
  currentDeviceToken: string | null;
  setCurrentUser: (user: User | null) => void;
  loginByDeviceToken: (token: string) => boolean;
  loginByPhoneNumber: (phoneNumber: string) => User | null;
  logout: () => void;
  registerUser: (phoneNumber: string, nickname: string, name: string, job?: string, hobbies?: string[]) => { user: User; token: string };
  searchFriend: (query: string) => User[];
  
  // 계산대 영수증 스캔 및 10초 QR
  generateQR: (storeId: string, stampsToAward: number, photoUrl: string) => string;
  validateQR: (token: string) => ReceiptScan | null;
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
  toggleNonProfitStatus: (id: string) => void;
  deleteNonProfit: (id: string) => void;

  // 관리데이터 리셋
  resetDatabase: () => void;
  
  // 다국어 관련 추가
  language: 'ko' | 'en';
  setLanguage: (lang: 'ko' | 'en') => void;
  
  // 매장 관리 동기화 관련 추가
  selectedStoreId: string;
  setSelectedStoreId: (storeId: string) => void;

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
}

const DatabaseContext = createContext<DatabaseContextProps | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'sharestamp_db_v2';

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
  } | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentDeviceToken, setCurrentDeviceToken] = useState<string | null>(null);

  const [language, setLanguageState] = useState<'ko' | 'en'>(() => {
    return (localStorage.getItem('sharestamp_language') as 'ko' | 'en') || 'ko';
  });

  const setLanguage = (lang: 'ko' | 'en') => {
    setLanguageState(lang);
    localStorage.setItem('sharestamp_language', lang);
  };

  const [selectedStoreId, setSelectedStoreIdState] = useState<string>(() => {
    return localStorage.getItem('sharestamp_selected_store_id') || 'store_id_1';
  });

  const setSelectedStoreId = (storeId: string) => {
    setSelectedStoreIdState(storeId);
    localStorage.setItem('sharestamp_selected_store_id', storeId);
  };

  // selectedStoreId 유효성 체크 및 자동 복구 (Reset DB 등으로 로컬스토리지 불일치 방지)
  useEffect(() => {
    if (dbState && dbState.stores.length > 0) {
      const exists = dbState.stores.some(s => s.id === selectedStoreId);
      if (!exists) {
        const defaultStoreId = dbState.stores[0].id;
        setSelectedStoreIdState(defaultStoreId);
        localStorage.setItem('sharestamp_selected_store_id', defaultStoreId);
      }
    }
  }, [dbState, selectedStoreId]);

  const [ownerPassword, setOwnerPasswordState] = useState<string>(() => {
    return localStorage.getItem('sharestamp_owner_password') || '1234';
  });

  const setOwnerPassword = (pw: string) => {
    setOwnerPasswordState(pw);
    localStorage.setItem('sharestamp_owner_password', pw);
  };

  const [currentOwner, setCurrentOwnerState] = useState<User | null>(null);

  const setCurrentOwner = (owner: User | null) => {
    setCurrentOwnerState(owner);
    if (owner) {
      localStorage.setItem('sharestamp_session_owner', JSON.stringify(owner));
    } else {
      localStorage.removeItem('sharestamp_session_owner');
    }
  };

  // 데이터베이스 초기 로딩 및 초기 데이터 설정 (Seeding) 및 세션 복원
  useEffect(() => {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed) {
          let migrated = false;
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
            parsed.stores = parsed.stores.map((s: any) => ({
              ...s,
              earningIntervalMinutes: typeof s.earningIntervalMinutes === 'number' && !isNaN(s.earningIntervalMinutes) ? s.earningIntervalMinutes : 60
            }));
          }
          if (!parsed.paymentRequests) {
            parsed.paymentRequests = [];
          } else if (Array.isArray(parsed.paymentRequests)) {
            parsed.paymentRequests = parsed.paymentRequests.map((r: any) => {
              if (r.userName && r.userName.includes('손님_')) {
                migrated = true;
                return { ...r, userName: r.userName.replace('손님_', '회원_') };
              }
              return r;
            });
          }
          if (!parsed.adBanners) {
            parsed.adBanners = [
              {
                id: 'ad_default_duracell',
                title: '듀라셀 CR2032 리튬 코인 건전지 9개입 (어린이 안전 포장)',
                subtitle: '아마존 제휴 프로그램의 일환으로 수수료를 제공받을 수 있습니다.',
                linkUrl: 'https://www.amazon.com/dp/B0855G6FVS',
                status: 'active' as const,
                createdAt: new Date().toISOString()
              }
            ];
          }
          if (migrated) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
          }
          setDbState(parsed);
        }
      } catch (e) {
        initializeDefaultDb();
      }
    } else {
      initializeDefaultDb();
    }

    const savedUser = localStorage.getItem('sharestamp_session_user');
    const savedToken = localStorage.getItem('sharestamp_session_token');
    if (savedUser && savedToken) {
      try {
        let user = JSON.parse(savedUser);
        if (user && user.name && user.name.startsWith('손님_')) {
          user.name = user.name.replace('손님_', '회원_');
          localStorage.setItem('sharestamp_session_user', JSON.stringify(user));
        }
        setCurrentUser(user);
        setCurrentDeviceToken(savedToken);
      } catch (e) {
        // ignore
      }
    }

    const savedOwner = localStorage.getItem('sharestamp_session_owner');
    if (savedOwner) {
      try {
        setCurrentOwnerState(JSON.parse(savedOwner));
      } catch (e) {
        // ignore
      }
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
      
      if (e.key === 'sharestamp_session_user') {
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
      if (e.key === 'sharestamp_session_token') {
        setCurrentDeviceToken(e.newValue);
      }
      if (e.key === 'sharestamp_session_owner') {
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
      if (e.key === 'sharestamp_selected_store_id') {
        if (e.newValue) {
          setSelectedStoreIdState(e.newValue);
        }
      }
      if (e.key === 'sharestamp_language') {
        if (e.newValue) {
          setLanguageState(e.newValue as 'ko' | 'en');
        }
      }
      if (e.key === 'sharestamp_owner_password') {
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


  // 신규 진입 시 웰컴 스탬프 1개 및 웰컴 스탬프 캐시 자동 지급을 위한 이펙트
  useEffect(() => {
    if (!currentUser || !dbState) return;
    
    const demoStoreIds = ['store_id_1', 'store_id_2', 'store_id_3', 'store_id_4', 'store_id_5'];
    let needsUpdate = false;
    const updatedCards = [...dbState.stampCards];
    const updatedPoints = [...dbState.storePoints];
    
    demoStoreIds.forEach(storeId => {
      const cardExists = updatedCards.some(c => c.userId === currentUser.id && c.storeId === storeId);
      if (!cardExists) {
        updatedCards.push({
          id: `card_${Date.now()}_${storeId}_${Math.random().toString(36).substring(2, 5)}`,
          userId: currentUser.id,
          storeId,
          currentStamps: 1, // 웰컴 스탬프 1개 지급
          updatedAt: new Date().toISOString()
        });
        needsUpdate = true;
      }
      
      const pointsIdx = updatedPoints.findIndex(p => p.userId === currentUser.id && p.storeId === storeId);
      if (pointsIdx === -1) {
        updatedPoints.push({
          id: `points_${Date.now()}_${storeId}_${Math.random().toString(36).substring(2, 5)}`,
          userId: currentUser.id,
          storeId,
          pointsBalance: 15.00, // 웰컴 스탬프 캐시 $15.00 자동 지급
          updatedAt: new Date().toISOString()
        });
        needsUpdate = true;
      } else if (updatedPoints[pointsIdx].pointsBalance <= 0) {
        // 테스트 편의를 위해 스탬프 캐시가 0 이하이면 $15.00로 자동 리필
        updatedPoints[pointsIdx] = {
          ...updatedPoints[pointsIdx],
          pointsBalance: 15.00,
          updatedAt: new Date().toISOString()
        };
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      updateDbState({
        ...dbState,
        stampCards: updatedCards,
        storePoints: updatedPoints
      });
    }
  }, [currentUser?.id, !!dbState]);

  // 활동 정지된 세션 실시간 강제 로그아웃 감시
  useEffect(() => {
    if (!dbState) return;
    if (currentUser) {
      const freshUser = dbState.users.find(u => u.id === currentUser.id);
      if (freshUser && freshUser.status === 'suspended') {
        logout();
      }
    }
    if (currentOwner) {
      const freshOwner = dbState.users.find(u => u.id === currentOwner.id);
      if (freshOwner && freshOwner.status === 'suspended') {
        setCurrentOwner(null);
      }
    }
  }, [dbState, currentUser, currentOwner]);

  // 상태 변경 시 LocalStorage에 반영
  const updateDbState = (newState: typeof dbState) => {
    if (!newState) return;
    setDbState(newState);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
  };

  const initializeDefaultDb = () => {
    // 1. 유저 시딩
    const defaultUsers: User[] = [
      { id: 'owner_id_1', phoneNumber: '01011112222', nickname: 'coffee_boss', name: '김사장', role: 'owner', loginId: 'coffee_boss', password: '1234' },
      { id: 'owner_id_2', phoneNumber: '01033334444', nickname: 'hair_master', name: '이원장', role: 'owner', loginId: 'hair_master', password: '1234' },
      { id: 'user_id_jimin', phoneNumber: '01055556666', nickname: 'coffee_lover', name: '박지민', role: 'customer' },
      { id: 'user_id_yujin', phoneNumber: '01077778888', nickname: 'bread_girl', name: '최유진', role: 'customer' },
      { id: 'admin_id_super', phoneNumber: '01099999999', nickname: 'super_admin', name: '운영자', role: 'admin' },
    ];

    // 2. 디바이스 시딩
    const defaultDevices: UserDevice[] = [
      { id: 'dev_1', userId: 'user_id_jimin', deviceToken: 'token_jimin_device' },
      { id: 'dev_2', userId: 'user_id_yujin', deviceToken: 'token_yujin_device' }
    ];

    // 3. 매장 시딩 (초기화됨)
    const defaultStores: Store[] = [];

    // 4. 비영리 단체 시딩 (초기화됨 - 관리자가 직접 등록)
    const defaultNPOs: NonProfit[] = [];

    // 5. 기본 스탬프 적립 상태 세팅 (초기화됨)
    const defaultStampCards: StampCard[] = [];

    const defaultStorePoints: StorePoint[] = [];

    // 6. 기부 데이터 (초기화됨)
    const defaultDonations: Donation[] = [];

    const defaultGifts: Gift[] = [];

    const defaultStampTransactions: StampTransaction[] = [];

    const defaultPointTransactions: PointTransaction[] = [];

    const initialDb = {
      users: defaultUsers,
      userDevices: defaultDevices,
      stores: defaultStores,
      stampCards: defaultStampCards,
      storePoints: defaultStorePoints,
      nonProfits: defaultNPOs,
      donations: defaultDonations,
      gifts: defaultGifts,
      stampTransactions: defaultStampTransactions,
      pointTransactions: defaultPointTransactions,
      receiptScans: [],
      paymentRequests: [],
      adBanners: [
        {
          id: 'ad_default_duracell',
          title: '듀라셀 CR2032 리튬 코인 건전지 9개입 (어린이 안전 포장)',
          subtitle: '아마존 제휴 프로그램의 일환으로 수수료를 제공받을 수 있습니다.',
          linkUrl: 'https://www.amazon.com/dp/B0855G6FVS',
          status: 'active' as const,
          createdAt: new Date().toISOString()
        }
      ]
    };

    updateDbState(initialDb);
  };

  const resetDatabase = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('sharestamp_session_user');
    localStorage.removeItem('sharestamp_session_token');
    initializeDefaultDb();
    setCurrentUser(null);
    setCurrentDeviceToken(null);
    playVoiceGuidance(
      language === 'ko' ? "데이터베이스 초기화가 완료되었습니다." : "Database initialization complete.",
      language
    );
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
        localStorage.setItem('sharestamp_session_user', JSON.stringify(user));
        localStorage.setItem('sharestamp_session_token', token);
        return true;
      }
    }
    return false;
  };

  const loginByPhoneNumber = (phoneNumber: string): User | null => {
    if (!dbState) return null;
    const cleanInput = phoneNumber.replace(/\D/g, '');
    const user = dbState.users.find(u => u.phoneNumber.replace(/\D/g, '') === cleanInput);
    if (user) {
      if (user.status === 'suspended') {
        playVoiceGuidance(
          language === 'ko' ? "활동이 정지된 계정입니다. 본사에 문의하세요." : "This account has been suspended. Please contact HQ.",
          language
        );
        return null;
      }
      setCurrentUser(user);
      localStorage.setItem('sharestamp_session_user', JSON.stringify(user));
      localStorage.setItem('sharestamp_last_phone_number', phoneNumber);
      // 디바이스 토큰 자동 찾기 또는 신규 가발급
      const device = dbState.userDevices.find(d => d.userId === user.id);
      if (device) {
        setCurrentDeviceToken(device.deviceToken);
        localStorage.setItem('sharestamp_session_token', device.deviceToken);
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
        localStorage.setItem('sharestamp_session_token', newToken);
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
    localStorage.removeItem('sharestamp_session_user');
    localStorage.removeItem('sharestamp_session_token');
  };

  const registerOwner = (name: string, storeId: string, loginId: string, password: string) => {
    if (!dbState) return { success: false, message: 'Database not loaded.' };
    
    // 중복 아이디 체크
    const exists = dbState.users.find(u => u.loginId === loginId);
    if (exists) {
      return { success: false, message: language === 'ko' ? '이미 존재하는 아이디입니다.' : 'ID already exists.' };
    }

    // 대상 매장 검색 및 중복 사장 배정 방지 검증
    const storeIdx = dbState.stores.findIndex(s => s.id === storeId);
    if (storeIdx === -1) {
      return { success: false, message: language === 'ko' ? '존재하지 않는 매장입니다.' : 'Store does not exist.' };
    }
    const targetStore = dbState.stores[storeIdx];
    if (targetStore.ownerId && targetStore.ownerId !== 'none' && targetStore.ownerId !== '') {
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
      password
    };
    
    const updatedStores = [...dbState.stores];
    updatedStores[storeIdx] = {
      ...targetStore,
      ownerId: ownerId
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
      earningIntervalMinutes: 60
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

  const registerUser = (phoneNumber: string, nickname: string, name: string, _job?: string, _hobbies?: string[]) => {
    if (!dbState) throw new Error('DB가 준비되지 않았습니다.');
    
    // 중복 체크 (전화번호에서 대시 기호를 빼고 매칭)
    const cleanInput = phoneNumber.replace(/\D/g, '');
    const exists = dbState.users.find(u => 
      u.phoneNumber.replace(/\D/g, '') === cleanInput || 
      u.nickname === nickname
    );
    if (exists) {
      if (exists.status === 'suspended') {
        throw new Error(language === 'ko' ? '활동이 정지된 계정입니다. 본사에 문의하세요.' : 'This account has been suspended. Please contact HQ.');
      }
      // 이미 회원이 존재하면 즉시 세션 로그인 처리하여 대시보드로 진입할 수 있도록 함
      setCurrentUser(exists);
      const device = dbState.userDevices.find(d => d.userId === exists.id);
      if (device) {
        setCurrentDeviceToken(device.deviceToken);
        localStorage.setItem('sharestamp_session_token', device.deviceToken);
      } else {
        const newToken = `token_${Math.random().toString(36).substring(2)}`;
        const newDevice: UserDevice = {
          id: `dev_${Date.now()}`,
          userId: exists.id,
          deviceToken: newToken
        };
        const updatedDevices = [...dbState.userDevices, newDevice];
        updateDbState({ ...dbState, userDevices: updatedDevices });
        setCurrentDeviceToken(newToken);
        localStorage.setItem('sharestamp_session_token', newToken);
      }
      localStorage.setItem('sharestamp_session_user', JSON.stringify(exists));
      localStorage.setItem('sharestamp_last_phone_number', phoneNumber);
      
      const cleanExistsName = exists.name.replace('회원_', '');
      playVoiceGuidance(
        language === 'ko' ? `${cleanExistsName}님, 반갑습니다.` : `Welcome, ${cleanExistsName}.`,
        language
      );
      return { user: exists, token: device?.deviceToken || '' };
    }

    const newUserId = `user_${Date.now()}`;
    const newUser: User = {
      id: newUserId,
      phoneNumber,
      nickname,
      name,
      role: 'customer'
    };

    const newToken = `token_${Math.random().toString(36).substring(2)}`;
    const newDevice: UserDevice = {
      id: `dev_${Date.now()}`,
      userId: newUserId,
      deviceToken: newToken
    };

    const updatedUsers = [...dbState.users, newUser];
    const updatedDevices = [...dbState.userDevices, newDevice];

    updateDbState({
      ...dbState,
      users: updatedUsers,
      userDevices: updatedDevices
    });

    setCurrentUser(newUser);
    setCurrentDeviceToken(newToken);
    localStorage.setItem('sharestamp_session_user', JSON.stringify(newUser));
    localStorage.setItem('sharestamp_session_token', newToken);
    localStorage.setItem('sharestamp_last_phone_number', phoneNumber);

    playVoiceGuidance(
      language === 'ko' ? "환영합니다! 회원 가입이 완료되었습니다." : "Welcome! Registration complete.",
      language
    );
    return { user: newUser, token: newToken };
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
      expiresAt: new Date(Date.now() + 10 * 1000).toISOString(), // 10초 만료
      createdAt: new Date().toISOString()
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

    const scan = validateQR(token);
    if (!scan) {
      return { success: false, message: '만료되었거나 이미 적립 완료된 QR 코드입니다.', stampsAwarded: 0, newStamps: 0, earnedPoints: 0 };
    }

    // --- Lucky 7 적립 프로세스 돌입 ---
    const store = dbState.stores.find(s => s.id === scan.storeId)!;

    // 동일 점포 재적립 제한 시간(분) 체크
    const userStoreTxs = dbState.stampTransactions
      .filter(t => t.userId === user.id && t.storeId === store.id && t.amount > 0 && t.type === 'earn')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (userStoreTxs.length > 0 && store.earningIntervalMinutes > 0) {
      const lastTxTime = new Date(userStoreTxs[0].createdAt).getTime();
      const diffMinutes = Math.floor((Date.now() - lastTxTime) / 60000);
      
      if (diffMinutes < store.earningIntervalMinutes) {
        const remainingMinutes = store.earningIntervalMinutes - diffMinutes;
        return { 
          success: false, 
          message: `동일 매장 재적립 제한 시간 이내입니다. (제한: ${formatInterval(store.earningIntervalMinutes)}, 남은시간: ${formatInterval(remainingMinutes)})`, 
          stampsAwarded: 0, 
          newStamps: 0, 
          earnedPoints: 0 
        };
      }
    }
    
    // 기존 스탬프 조회
    let card = dbState.stampCards.find(c => c.userId === user.id && c.storeId === store.id);
    let currentStamps = card ? card.currentStamps : 0;
    
    const stampsToAward = scan.stampsToAward;
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
      createdAt: new Date().toISOString()
    });

    // auto-conversion disabled, max out at 7 stamps
    newStamps = Math.min(7, newStamps);

    // 카드 업데이트
    const cardIdx = updatedCards.findIndex(c => c.userId === user.id && c.storeId === store.id);
    if (cardIdx > -1) {
      updatedCards[cardIdx] = {
        ...updatedCards[cardIdx],
        currentStamps: newStamps,
        updatedAt: new Date().toISOString()
      };
    } else {
      updatedCards.push({
        id: `card_${Date.now()}`,
        userId: user.id,
        storeId: store.id,
        currentStamps: newStamps,
        updatedAt: new Date().toISOString()
      });
    }

    // QR 토큰 완료 처리
    const updatedScans = dbState.receiptScans.map(s => 
      s.qrToken === token ? { ...s, status: 'claimed' as const } : s
    );

    // DB 저장
    updateDbState({
      ...dbState,
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
      createdAt: new Date().toISOString()
    });

    // auto-conversion disabled, max out at 7 stamps
    newStamps = Math.min(7, newStamps);

    const cardIdx = updatedCards.findIndex(c => c.userId === userId && c.storeId === storeId);
    if (cardIdx > -1) {
      updatedCards[cardIdx] = {
        ...updatedCards[cardIdx],
        currentStamps: newStamps,
        updatedAt: new Date().toISOString()
      };
    } else {
      updatedCards.push({
        id: `card_${Date.now()}`,
        userId,
        storeId,
        currentStamps: newStamps,
        updatedAt: new Date().toISOString()
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
    updatedCards[senderCardIdx] = {
      ...updatedCards[senderCardIdx],
      currentStamps: updatedCards[senderCardIdx].currentStamps - actualTransferred,
      updatedAt: new Date().toISOString()
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
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    newStampTxs.push({
      id: `stx_${Date.now()}_gift1`,
      userId: senderId,
      storeId,
      amount: -actualTransferred,
      type: 'gift_send',
      referenceId: giftId,
      createdAt: new Date().toISOString()
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
    // let recipientEarnedPoints = 0;

    // auto-conversion disabled, max out at 7 stamps
    recipientNewStamps = Math.min(7, recipientNewStamps);

    if (recipientCardIdx > -1) {
      updatedCards[recipientCardIdx] = {
        ...updatedCards[recipientCardIdx],
        currentStamps: recipientNewStamps,
        updatedAt: new Date().toISOString()
      };
    } else {
      updatedCards.push({
        id: `card_${Date.now()}`,
        userId: recipientId,
        storeId,
        currentStamps: recipientNewStamps,
        updatedAt: new Date().toISOString()
      });
    }

    newStampTxs.push({
      id: `stx_${Date.now()}_gift_recv`,
      userId: recipientId,
      storeId,
      amount: finalTransferred,
      type: 'gift_receive',
      referenceId: giftId,
      createdAt: new Date().toISOString()
    });

    // 2. 한도 초과분 송신자에게 반환
    if (returnedToSender > 0) {
      const senderCardIdx = updatedCards.findIndex(c => c.userId === senderId && c.storeId === storeId);
      if (senderCardIdx > -1) {
        let senderNewStamps = updatedCards[senderCardIdx].currentStamps + returnedToSender;
        // let senderEarnedPoints = 0;

        // auto-conversion disabled, max out at 7 stamps
        senderNewStamps = Math.min(7, senderNewStamps);

        updatedCards[senderCardIdx] = {
          ...updatedCards[senderCardIdx],
          currentStamps: senderNewStamps,
          updatedAt: new Date().toISOString()
        };

        newStampTxs.push({
          id: `stx_${Date.now()}_gift_ret`,
          userId: senderId,
          storeId,
          amount: returnedToSender,
          type: 'gift_receive',
          referenceId: giftId,
          createdAt: new Date().toISOString()
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
    const senderCardIdx = updatedCards.findIndex(c => c.userId === senderId && c.storeId === storeId);
    if (senderCardIdx > -1) {
      let senderNewStamps = updatedCards[senderCardIdx].currentStamps + stampsToReturn;
      // let senderEarnedPoints = 0;

      // auto-conversion disabled, max out at 7 stamps
      senderNewStamps = Math.min(7, senderNewStamps);

      updatedCards[senderCardIdx] = {
        ...updatedCards[senderCardIdx],
        currentStamps: senderNewStamps,
        updatedAt: new Date().toISOString()
      };

      newStampTxs.push({
        id: `stx_${Date.now()}_decl_ret`,
        userId: senderId,
        storeId,
        amount: stampsToReturn,
        type: 'gift_receive',
        referenceId: giftId,
        createdAt: new Date().toISOString()
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

    // Deduct 7 stamps
    updatedCards[cardIdx] = {
      ...updatedCards[cardIdx],
      currentStamps: 0,
      updatedAt: new Date().toISOString()
    };

    // Add cash points
    const earnedPoints = store.pointRewardPer7Stamps;
    const ptsIdx = updatedPoints.findIndex(p => p.userId === userId && p.storeId === storeId);
    if (ptsIdx > -1) {
      updatedPoints[ptsIdx] = {
        ...updatedPoints[ptsIdx],
        pointsBalance: Math.round((updatedPoints[ptsIdx].pointsBalance + earnedPoints) * 100) / 100,
        updatedAt: new Date().toISOString()
      };
    } else {
      updatedPoints.push({
        id: `pts_${Date.now()}_conv`,
        userId,
        storeId,
        pointsBalance: earnedPoints,
        updatedAt: new Date().toISOString()
      });
    }

    // Log stamp tx (negative 7 stamps)
    newStampTxs.push({
      id: `stx_${Date.now()}_conv`,
      userId,
      storeId,
      amount: -7,
      type: 'point_conversion',
      createdAt: new Date().toISOString()
    });

    // Log point tx (positive cash)
    newPointTxs.push({
      id: `ptx_${Date.now()}_conv`,
      userId,
      storeId,
      amount: earnedPoints,
      type: 'earn_from_stamps',
      createdAt: new Date().toISOString()
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
          settledAt: new Date().toISOString()
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

    // 기부금 가치 환산 (보상금액 / 7 * count) -> 소수점 2자리 반올림
    const donationValue = Math.round((store.pointRewardPer7Stamps / 7) * count * 100) / 100;

    // 데이터 업데이트
    const updatedCards = [...dbState.stampCards];
    updatedCards[cardIdx] = {
      ...updatedCards[cardIdx],
      currentStamps: updatedCards[cardIdx].currentStamps - count,
      updatedAt: new Date().toISOString()
    };

    const donationId = `don_${Date.now()}`;
    const newDonation: Donation = {
      id: donationId,
      donorId: userId,
      storeId,
      nonProfitId,
      stampCount: count,
      monetaryValue: donationValue,
      createdAt: new Date().toISOString()
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
        createdAt: new Date().toISOString()
      }
    ];

    updateDbState({
      ...dbState,
      stampCards: updatedCards,
      stampTransactions: newStampTxs,
      donations: [...dbState.donations, newDonation]
    });

    const npo = dbState.nonProfits.find(n => n.id === nonProfitId)!;
    const npoName = language === 'en' ? translateNpo(npo, 'en').name : npo.name;
    playVoiceGuidance(
      language === 'ko'
        ? `따뜻한 나눔에 감사드립니다. ${npoName}에 스탬프 ${count}개가 성공적으로 기부되었습니다.`
        : `Thank you for your warm donation. ${count} stamps have been successfully donated to ${npoName}.`,
      language
    );

    // SMS 감사 알림 시뮬레이션
    const smsMsg = '사랑의 기부를 해주셔서 감사합니다. ShareStamp는 나눔을 위해 최선을 다하겠습니다.';
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
          createdAt: new Date().toISOString()
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
      createdAt: new Date().toISOString()
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
    const smsMsg = '사랑의 기부를 해주셔서 감사합니다. ShareStamp는 나눔을 위해 최선을 다하겠습니다.';
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
          updatedAt: new Date().toISOString()
        };
        newPointTxs.push({
          id: `ptx_${Date.now()}_${i}`,
          userId,
          storeId: p.storeId,
          amount: -deductAmount,
          type: 'use_payment' as const,
          createdAt: new Date().toISOString()
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
    updatedCards[cardIdx] = {
      ...card,
      currentStamps: current - actualDeducted,
      updatedAt: new Date().toISOString()
    };

    const newStampTxs = [
      ...dbState.stampTransactions,
      {
        id: `stx_${Date.now()}_owner_deduct`,
        userId: customerId,
        storeId,
        amount: -actualDeducted,
        type: 'point_conversion' as const,
        createdAt: new Date().toISOString()
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

    const card = dbState.stampCards.find(c => c.userId === customerId && c.storeId === storeId);
    const current = card ? card.currentStamps : 0;
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

    if (count > maxCanGive) {
      return { 
        success: false, 
        stampsQueued: 0, 
        message: language === 'ko' 
          ? `스탬프 한도(최대 7개)를 초과합니다. 최대 ${maxCanGive}개까지만 줄 수 있습니다.` 
          : `Exceeds stamp limit. Max you can give is ${maxCanGive}.` 
      };
    }

    // Gift 테이블에 pending 상태의 기프트 생성
    const giftId = `gift_${Date.now()}_owner`;
    const newGift: Gift = {
      id: giftId,
      senderId: currentOwner.id,
      recipientId: customerId,
      storeId,
      stampsSent: count,
      stampsTransferred: count,
      message,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    updateDbState({
      ...dbState,
      gifts: [...dbState.gifts, newGift]
    });

    const store = dbState.stores.find(s => s.id === storeId);
    const storeName = store ? store.name : storeId;
    playVoiceGuidance(
      language === 'ko'
        ? `${storeName} 스탬프 ${count}개 전송을 요청했습니다. 수령 승인을 기다립니다.`
        : `${count} stamps for ${storeName} queued for customer. Waiting for acceptance.`,
      language
    );

    return { success: true, stampsQueued: count, message: 'Queued successfully' };
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
      createdAt: new Date().toISOString(),
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
          updatedAt: new Date().toISOString()
        };
        newPointTxs.push({
          id: `ptx_${Date.now()}_${i}`,
          userId: request.userId,
          storeId: p.storeId,
          amount: -deductAmount,
          type: 'use_payment' as const,
          createdAt: new Date().toISOString()
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
            createdAt: new Date().toISOString()
          });
        }
        updatedCards[cardIdx] = {
          ...updatedCards[cardIdx],
          currentStamps: 0,
          updatedAt: new Date().toISOString()
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
        createdAt: new Date().toISOString()
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
      createdAt: new Date().toISOString(),
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
    });
  };

  const addNonProfit = (name: string, description: string) => {
    if (!dbState) return;
    const newNpo: NonProfit = {
      id: `npo_${Date.now()}`,
      name,
      description,
      status: 'active'
    };
    updateDbState({ ...dbState, nonProfits: [...dbState.nonProfits, newNpo] });
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
    });
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
      createdAt: new Date().toISOString()
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
    });
    playVoiceGuidance(
      language === 'ko' ? "광고 배너가 삭제되었습니다." : "Ad banner deleted.",
      language
    );
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

    const updatedUsers = dbState.users.filter(u => u.id !== userId);
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
    });

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
    toggleNonProfitStatus,
    deleteNonProfit,

    resetDatabase,
    
    language,
    setLanguage,
    selectedStoreId: dbState && dbState.stores.length > 0 && dbState.stores.some(s => s.id === selectedStoreId)
      ? selectedStoreId
      : (dbState && dbState.stores.length > 0 ? dbState.stores[0].id : 'store_id_1'),
    setSelectedStoreId,
    ownerPassword,
    setOwnerPassword,
    currentOwner,
    setCurrentOwner,
    registerOwner,
    registerStore,
    
    suspendUser,
    deleteUser
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
