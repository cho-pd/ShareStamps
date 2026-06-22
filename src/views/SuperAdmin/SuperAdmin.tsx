import React, { useState, useRef, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import type { User, NonProfit } from '../../context/DatabaseContext';
import { BarChart3, Building2, Users2, HeartHandshake, CheckCircle2, AlertCircle, FileText, Megaphone, Plus, Trash2, ExternalLink, LogOut, XCircle, Sparkles, X, Globe } from 'lucide-react';
import { playVoiceGuidance } from '../../utils/voice';

export const SuperAdmin: React.FC = () => {
  const { 
    stores, users, donations, nonProfits, gifts, adBanners, addAdBanner, 
    toggleAdBannerStatus, deleteAdBanner, stampCards, storePoints, 
    paymentRequests, registerStore, addNonProfit, updateNonProfit, toggleNonProfitStatus, 
    deleteNonProfit, resetDatabase, stampTransactions, pointTransactions, 
    suspendUser, deleteUser, language, setLanguage,
    categories, addCategory, deleteCategory,
    approveOwnerRequest, rejectOwnerRequest,
    toggleStoreStatus, deleteStore,
    changeOwnerPassword,
    setSelectedStoreId, setCurrentOwner
  } = useDatabase();

  const t = {
    logout: language === 'ko' ? '로그아웃' : 'Logout',
    title: language === 'ko' ? '종합 플랫폼 관리자 (Super Admin)' : 'Super Admin Dashboard',
    desc: language === 'ko' ? '플랫폼 내 100개 이상의 매장 기부 정산 대장 및 NPO 자금을 원격 감시합니다.' : 'Monitor store donation ledgers, settlements, and NPO balances.',
    tabOverview: language === 'ko' ? '통합 대시보드' : 'Overview',
    tabStores: (count: number) => language === 'ko' ? `매장 디렉토리 (${count}개)` : `Store Directory (${count})`,
    tabNpos: language === 'ko' ? 'NPO 관리' : 'NPOs',
    tabSettlement: language === 'ko' ? '월별 정산 원장' : 'Monthly Ledger',
    tabUsers: language === 'ko' ? '회원' : 'Members',
    tabAds: language === 'ko' ? '광고 배너 관리' : 'Ad Banners',
    tabLogs: language === 'ko' ? '실시간 요청 로그' : 'Live Logs',
    
    // KPI Cards
    kpiTotalDonated: language === 'ko' ? '플랫폼 총 누적 기부액' : 'Total Platform Donations',
    kpiDonatedStamps: (count: number) => language === 'ko' ? `기부 도장 수: ${count}개` : `Donated Stamps: ${count}`,
    kpiActiveStores: language === 'ko' ? '플랫폼 입점 매장' : 'Active Stores',
    kpiStoreCount: (count: number) => language === 'ko' ? `${count}개 매장` : `${count} Stores`,
    kpiStoreSubtext: language === 'ko' ? '데모 5개 / 가상 97개' : '5 Demo / 97 Virtual',
    kpiActiveCustomers: language === 'ko' ? '적립 활성 회원' : 'Active Members',
    kpiCustomerCount: (count: number) => language === 'ko' ? `${count}명` : `${count} Members`,
    kpiCustomerSubtext: language === 'ko' ? '총 가입 유저 수' : 'Total Registered Members',
    kpiSharedStamps: language === 'ko' ? '나눔 이전 활성도' : 'Stamp Gift Virality',
    kpiSharedCount: (count: number) => language === 'ko' ? `${count}개 전달` : `${count} Transferred`,
    kpiSharedSubtext: language === 'ko' ? '선물 전송 완료 도장 수' : 'Stamps Sent as Gifts',
  };
  
  const [activeSubTab, setActiveSubTab] = useState<'kpi' | 'stores' | 'npos' | 'settlement' | 'ads' | 'users' | 'logs'>('kpi');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNpo, setSelectedNpo] = useState<NonProfit | null>(null);

  // NPO 등록 폼 상태
  const [npoFormName, setNpoFormName] = useState('');
  const [npoFormDesc, setNpoFormDesc] = useState('');
  const [showNpoForm, setShowNpoForm] = useState(false);

  // NPO 수정 폼 상태
  const [editingNpoId, setEditingNpoId] = useState<string | null>(null);
  const [editingNpoName, setEditingNpoName] = useState('');
  const [editingNpoDesc, setEditingNpoDesc] = useState('');

  // 회원 & 마케팅 상태
  const [selectedUserStoreFilter, setSelectedUserStoreFilter] = useState<string>('all');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [selectedDetailedUser, setSelectedDetailedUser] = useState<User | null>(null);
  const [userRoleTab, setUserRoleTab] = useState<'customer' | 'owner'>('customer');

  const customers = users.filter(u => u.role === 'customer' && u.status !== 'deleted');
  const owners = users.filter(u => u.role === 'owner' && u.status !== 'pending_approval' && u.status !== 'deleted');
  const pendingOwners = users.filter(u => u.role === 'owner' && u.status === 'pending_approval');

  // 모달 제어 상태 및 알림음 추적 Ref 추가
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const prevPendingCountRef = useRef<number>(0);

  const playDingDongChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      // 첫번째 톤 (띵) - E5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // 두번째 톤 (동) - C5
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.25);
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.25);
      gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);
      
      osc2.start(ctx.currentTime + 0.25);
      osc2.stop(ctx.currentTime + 0.75);
    } catch (error) {
      console.error('Failed to play chime sound:', error);
    }
  };

  useEffect(() => {
    if (pendingOwners.length > prevPendingCountRef.current) {
      setShowApprovalModal(true);
      playDingDongChime();
    }
    if (pendingOwners.length === 0) {
      setShowApprovalModal(false);
    }
    prevPendingCountRef.current = pendingOwners.length;
  }, [pendingOwners.length]);

  // Web Audio API 자동 재생 제한 잠금해제 로직 추가
  useEffect(() => {
    const unlockAudio = () => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        try {
          const ctx = new AudioContext();
          ctx.resume().then(() => {
            console.log('[SuperAdmin] AudioContext successfully resumed/unlocked.');
            window.removeEventListener('click', unlockAudio);
          }).catch(console.error);
        } catch (e) {
          console.error('[SuperAdmin] Failed to initialize AudioContext for unlock:', e);
        }
      }
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  // 마케팅 세그먼트 통계
  const segmentStats = customers.reduce((acc, u) => {
    const cards = stampCards.filter(c => c.userId === u.id);
    const hasDonated = donations.some(d => d.donorId === u.id);
    const stamps = cards.reduce((sum, c) => sum + c.currentStamps, 0);
    
    if (cards.length >= 3) {
      acc.loyal++;
    } else if (hasDonated) {
      acc.donor++;
    } else if (cards.length <= 1 && stamps <= 1) {
      acc.newUsers++;
    } else {
      acc.normal++;
    }
    return acc;
  }, { loyal: 0, donor: 0, newUsers: 0, normal: 0 });

  const avgStoresPerUser = customers.length > 0 ? (stampCards.length / customers.length) : 0;

  const filteredCustomers = customers.filter(u => {
    if (selectedUserStoreFilter !== 'all') {
      const hasCard = stampCards.some(c => c.userId === u.id && c.storeId === selectedUserStoreFilter);
      if (!hasCard) return false;
    }
    
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase();
      const cleanPhone = u.phoneNumber.replace(/\D/g, '');
      return u.nickname.toLowerCase().includes(q) || 
             u.name.toLowerCase().includes(q) || 
             cleanPhone.includes(q) || 
             (q.length >= 4 && cleanPhone.endsWith(q));
    }
    return true;
  });

  const filteredOwners = owners.filter(u => {
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase();
      const cleanPhone = u.phoneNumber.replace(/\D/g, '');
      return u.nickname.toLowerCase().includes(q) || 
             u.name.toLowerCase().includes(q) || 
             cleanPhone.includes(q) || 
             (q.length >= 4 && cleanPhone.endsWith(q));
    }
    return true;
  });

  const renderRoleTabs = () => (
    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
      <button
        onClick={() => {
          setUserRoleTab('customer');
          setUserSearchQuery('');
        }}
        className="imin-btn"
        style={{
          width: 'auto',
          padding: '8px 20px',
          fontSize: '13px',
          fontWeight: 700,
          borderRadius: 'var(--border-radius-pill)',
          border: 'none',
          backgroundColor: userRoleTab === 'customer' ? 'var(--primary-color)' : '#F2F2F7',
          color: userRoleTab === 'customer' ? '#ffffff' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        👤 일반 회원
      </button>
      <button
        onClick={() => {
          setUserRoleTab('owner');
          setUserSearchQuery('');
        }}
        className="imin-btn"
        style={{
          width: 'auto',
          padding: '8px 20px',
          fontSize: '13px',
          fontWeight: 700,
          borderRadius: 'var(--border-radius-pill)',
          border: 'none',
          backgroundColor: userRoleTab === 'owner' ? 'var(--primary-color)' : '#F2F2F7',
          color: userRoleTab === 'owner' ? '#ffffff' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        👨‍🍳 사장님 회원
      </button>
    </div>
  );

  // 광고 등록 폼 상태
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adUploadFile, setAdUploadFile] = useState<File | null>(null);
  const [adPreviewUrl, setAdPreviewUrl] = useState<string>('');
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStoreDetailId, setSelectedStoreDetailId] = useState<string | null>(null);

  const handleAdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAdUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawUrl = ev.target?.result as string;
      
      // Canvas를 이용해 업로드된 이미지를 800px 너비로 리사이징하고 압축
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          // PNG 투명도를 흰색 배경으로 보정
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // JPEG 포맷으로 압축률 0.8 적용 (파일 용량을 50KB 이하로 최적화)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setAdPreviewUrl(compressedDataUrl);
          setAdImageUrl(compressedDataUrl);
        } else {
          setAdPreviewUrl(rawUrl);
          setAdImageUrl(rawUrl);
        }
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterAd = (e: React.FormEvent) => {
    e.preventDefault();
    const finalImageUrl = adImageUrl.trim();
    let finalLinkUrl = adLinkUrl.trim();
    if (!finalImageUrl) {
      setFormError('배너 이미지(업로드 또는 URL)은 필수 항목입니다.');
      return;
    }
    if (!finalLinkUrl) {
      setFormError('랜딩 페이지 링크 URL은 필수 항목입니다.');
      return;
    }
    // https:// 없으면 자동으로 붙이기
    if (!/^https?:\/\//i.test(finalLinkUrl)) {
      finalLinkUrl = 'https://' + finalLinkUrl;
    }
    setFormError('');

    try {
      addAdBanner('', '', finalLinkUrl, finalImageUrl);
      setAdLinkUrl('');
      setAdImageUrl('');
      setAdUploadFile(null);
      setAdPreviewUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // 광고 등록 성공 시 하단 목록 창으로 화면 자동 스크롤 이동
      setTimeout(() => {
        const element = document.getElementById('ad-banner-list');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      console.error('Error during ad registration:', err);
      setFormError(
        language === 'ko'
          ? '광고 등록 처리 중 에러가 발생했습니다. 이미지 용량을 줄여서 다시 시도해 주세요.'
          : 'Failed to register ad banner. Please try a smaller image size.'
      );
    }
  };


  // 매장 등록 폼 상태
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreOwnerId, setNewStoreOwnerId] = useState('');
  const [newStoreCategory, setNewStoreCategory] = useState<string>('Cafe (카페)');
  const [newStoreReward, setNewStoreReward] = useState<number>(5.0);
  const [storeRegError, setStoreRegError] = useState('');
  const [storeRegSuccess, setStoreRegSuccess] = useState('');

  // 업종 관리 상태 추가
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleRegisterStore = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreRegError('');
    setStoreRegSuccess('');

    if (!newStoreName.trim()) {
      setStoreRegError('매장 이름을 입력해 주세요.');
      return;
    }
    if (isNaN(newStoreReward) || newStoreReward <= 0) {
      setStoreRegError('올바른 보상 금액을 입력해 주세요.');
      return;
    }

    const res = registerStore(
      newStoreName.trim(),
      newStoreOwnerId || 'none',
      newStoreCategory,
      newStoreReward
    );

    if (res.success && res.store) {
      setStoreRegSuccess(
        newStoreOwnerId 
          ? `새로운 매장 "${res.store.name}"이 성공적으로 등록 및 사장님 어카운트에 연결되었습니다.`
          : `새로운 미배정 매장 "${res.store.name}"이 성공적으로 등록되었습니다.`
      );
      setNewStoreName('');
      setNewStoreOwnerId('');
      setNewStoreCategory('Cafe (카페)');
      setNewStoreReward(5.0);
    } else {
      setStoreRegError(res.message || '매장 등록에 실패했습니다.');
    }
  };

  // 가상 빌링 납부 완료 처리 상태 리스트
  const [settledBills, setSettledBills] = useState<Record<string, boolean>>({});

  // 1. KPI 지표 계산
  const totalActiveStores = stores.length;
  const totalCustomers = users.filter(u => u.role === 'customer' && u.status !== 'deleted').length;
  const platformTotalDonatedValue = donations.reduce((sum, d) => sum + d.monetaryValue, 0);
  const platformTotalDonatedStamps = donations.reduce((sum, d) => sum + d.stampCount, 0);
  const platformTotalSharedStamps = gifts.reduce((sum, g) => sum + g.stampsTransferred, 0);

  // NPO별 정산 데이터 가공
  const getNPOStats = (npoId: string) => {
    const npoDons = donations.filter(d => d.nonProfitId === npoId);
    const stamps = npoDons.reduce((sum, d) => sum + d.stampCount, 0);
    const value = npoDons.reduce((sum, d) => sum + d.monetaryValue, 0);
    
    const settledStamps = npoDons.filter(d => d.settledStatus === 'settled').reduce((sum, d) => sum + d.stampCount, 0);
    const settledValue = npoDons.filter(d => d.settledStatus === 'settled').reduce((sum, d) => sum + d.monetaryValue, 0);
    
    const pendingStamps = npoDons.filter(d => d.settledStatus !== 'settled').reduce((sum, d) => sum + d.stampCount, 0);
    const pendingValue = npoDons.filter(d => d.settledStatus !== 'settled').reduce((sum, d) => sum + d.monetaryValue, 0);
    
    return { stamps, value, settledStamps, settledValue, pendingStamps, pendingValue };
  };

  // 매장별 NPO 정산 대장 데이터 가공
  const getBillingItems = () => {
    // 매장별 NPO별 기부 합산
    const billingMap: Record<string, {
      id: string;
      storeId: string;
      storeName: string;
      category: string;
      npoName: string;
      stampsCount: number;
      amount: number;
    }> = {};

    donations.forEach(d => {
      const store = stores.find(s => s.id === d.storeId);
      const npo = nonProfits.find(n => n.id === d.nonProfitId);
      if (!store || !npo) return;

      const key = `${d.storeId}_${d.nonProfitId}`;
      if (billingMap[key]) {
        billingMap[key].stampsCount += d.stampCount;
        billingMap[key].amount += d.monetaryValue;
      } else {
        billingMap[key] = {
          id: key,
          storeId: d.storeId,
          storeName: store.name,
          category: store.category,
          npoName: npo.name,
          stampsCount: d.stampCount,
          amount: d.monetaryValue
        };
      }
    });

    return Object.values(billingMap);
  };

  const billings = getBillingItems();

  const handleSettleBill = (billId: string, storeName: string, npoName: string, amount: number) => {
    setSettledBills(prev => ({ ...prev, [billId]: true }));
    playVoiceGuidance(`${storeName}에서 ${npoName}으로 기부금 ${amount.toFixed(2)}달러의 정산 송금이 완료되었습니다.`);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 관리자 상단 헤더 */}
      <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
        {/* 우상단 조작 영역 (언어 선택 & 로그아웃) */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* 언어 선택 토글 버튼 */}
          <button 
            type="button"
            onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
            className="imin-chip"
            style={{ 
              padding: '7px 14px', 
              fontSize: '12px',
              backgroundColor: 'var(--surface-color)',
              color: 'var(--primary-color)',
              border: '1px solid var(--border-color)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <Globe size={13} />
            {language === 'ko' ? 'English (EN)' : '한국어 (KO)'}
          </button>

          {/* 로그아웃 */}
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('lock-simulator-role'));
            }} 
            className="imin-chip"
            style={{ 
              padding: '7px 14px', 
              fontSize: '12px',
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <LogOut size={13} />
            {t.logout}
          </button>
        </div>

        <div style={{ paddingRight: '220px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary-color)' }}>{t.title}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '2px' }}>{t.desc}</p>
        </div>

        {/* 대시보드 탭 메뉴 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveSubTab('kpi')}
            className={`imin-chip ${activeSubTab === 'kpi' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {t.tabOverview}
          </button>
          <button 
            onClick={() => setActiveSubTab('stores')}
            className={`imin-chip ${activeSubTab === 'stores' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {t.tabStores(totalActiveStores)}
          </button>
          <button 
            onClick={() => setActiveSubTab('npos')}
            className={`imin-chip ${activeSubTab === 'npos' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {t.tabNpos}
          </button>
          <button 
            onClick={() => setActiveSubTab('settlement')}
            className={`imin-chip ${activeSubTab === 'settlement' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {t.tabSettlement}
          </button>
          <button 
            onClick={() => setActiveSubTab('users')}
            className={`imin-chip ${activeSubTab === 'users' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {t.tabUsers}
          </button>
          <button 
            onClick={() => setActiveSubTab('ads')}
            className={`imin-chip ${activeSubTab === 'ads' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {t.tabAds}
          </button>
          <button 
            onClick={() => setActiveSubTab('logs')}
            className={`imin-chip ${activeSubTab === 'logs' ? 'active' : ''}`}
            style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            {t.tabLogs}
          </button>
        </div>
      </div>

      {/* 🔔 가맹 가입 승인 대기 배너 (모달이 닫혀있을 때 상시 노출) */}
      {pendingOwners.length > 0 && !showApprovalModal && (
        <div 
          onClick={() => setShowApprovalModal(true)}
          className="imin-card" 
          style={{ 
            padding: '16px 20px', 
            backgroundColor: 'rgba(255, 149, 0, 0.08)', 
            border: '1.5px solid #FF9500', 
            borderRadius: 'var(--border-radius-md)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            cursor: 'pointer',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(255, 149, 0, 0.1)',
            transition: 'all 0.2s ease',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 149, 0, 0.12)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 149, 0, 0.08)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ color: '#FF9500' }} />
            <span style={{ fontWeight: 700, color: '#FF9500', fontSize: '14.5px' }}>
              {language === 'ko' 
                ? `대기 중인 가맹 가입 승인 요청이 ${pendingOwners.length}건 있습니다. 클릭하여 승인 창 열기` 
                : `There are ${pendingOwners.length} pending owner registration requests. Click to open.`}
            </span>
          </div>
          <span style={{ 
            fontSize: '13px', 
            fontWeight: 700, 
            color: '#FF9500', 
            textDecoration: 'underline',
            padding: '4px 10px',
            backgroundColor: 'rgba(255, 149, 0, 0.15)',
            borderRadius: '6px'
          }}>
            {language === 'ko' ? '열기' : 'Open'}
          </span>
        </div>
      )}

      {/* 🔔 가맹 가입 승인 대기 모달 팝업 */}
      {showApprovalModal && pendingOwners.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="imin-card" style={{
            width: '100%',
            maxWidth: '650px',
            padding: '32px',
            backgroundColor: '#ffffff',
            border: '1.5px solid rgba(255, 149, 0, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            position: 'relative'
          }}>
            {/* 닫기 버튼 */}
            <button 
              onClick={() => setShowApprovalModal(false)}
              style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '50%',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-color)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={20} />
            </button>

            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255, 149, 0, 0.15)', paddingBottom: '16px' }}>
              <AlertCircle size={26} style={{ color: '#FF9500' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FF9500', margin: 0 }}>
                🔔 {language === 'ko' ? `가맹 가입 승인 대기 현황 (${pendingOwners.length}건)` : `Pending Owner Registrations (${pendingOwners.length})`}
              </h3>
            </div>
            
            <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255, 149, 0, 0.15)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <th style={{ padding: '12px' }}>{language === 'ko' ? '사장님 이름' : 'Owner Name'}</th>
                    <th style={{ padding: '12px' }}>{language === 'ko' ? '아이디' : 'ID'}</th>
                    <th style={{ padding: '12px' }}>{language === 'ko' ? '신청 가맹점' : 'Store'}</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>{language === 'ko' ? '관리' : 'Manage'}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOwners.map(owner => {
                    const store = stores.find(s => s.ownerId === owner.id);
                    return (
                      <tr key={owner.id} style={{ borderBottom: '1px solid var(--border-color)', height: '56px' }}>
                        <td style={{ padding: '12px', fontWeight: 700 }}>{owner.name}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>@{owner.nickname}</td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          {store ? store.name : <span style={{ color: 'var(--accent-red)' }}>{language === 'ko' ? '정보 없음' : 'No Info'}</span>}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => approveOwnerRequest(owner.id)}
                            className="imin-btn"
                            style={{
                              width: 'auto',
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: 700,
                              backgroundColor: '#34C759',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            ✓ {language === 'ko' ? '승인' : 'Approve'}
                          </button>
                          <button
                            onClick={() => rejectOwnerRequest(owner.id)}
                            className="imin-btn"
                            style={{
                              width: 'auto',
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: 700,
                              backgroundColor: '#FF3B30',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            ✕ {language === 'ko' ? '거절' : 'Reject'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 1. 통합 KPI 지표 카드 */}
      {activeSubTab === 'kpi' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                <HeartHandshake size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.kpiTotalDonated}</span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--primary-color)' }}>
                  ${platformTotalDonatedValue.toFixed(2)}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.kpiDonatedStamps(platformTotalDonatedStamps)}</span>
              </div>
            </div>

            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(10, 132, 255, 0.08)', color: 'var(--accent-blue)' }}>
                <Building2 size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.kpiActiveStores}</span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-blue)' }}>
                  {t.kpiStoreCount(totalActiveStores)}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.kpiStoreSubtext}</span>
              </div>
            </div>

            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--accent-green)' }}>
                <Users2 size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.kpiActiveCustomers}</span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-green)' }}>
                  {t.kpiCustomerCount(totalCustomers)}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.kpiCustomerSubtext}</span>
              </div>
            </div>

            <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(191, 90, 242, 0.08)', color: 'var(--accent-purple)' }}>
                <BarChart3 size={24} />
              </div>
              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.kpiSharedStamps}</span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-purple)' }}>
                  {t.kpiSharedCount(platformTotalSharedStamps)}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.kpiSharedSubtext}</span>
              </div>
            </div>
          </div>

          {/* 기부 랭킹 및 NPO 가치 리포트 */}
          <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              🎗️ 비영리 단체(NPO)별 누적 모금 현황
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {nonProfits.map(npo => {
                const stats = getNPOStats(npo.id);
                return (
                  <div key={npo.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC' }}>
                    <div style={{ maxWidth: '60%' }}>
                      <strong style={{ fontSize: '15px' }}>{npo.name}</strong>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '3px' }}>{npo.description}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--primary-color)', fontWeight: 700, fontSize: '18px' }}>
                        ${stats.value.toFixed(2)}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>기부 도장: {stats.stamps}개</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 2. 매장 디렉토리 탭 */}
      {activeSubTab === 'stores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 새 매장 등록 폼 (멀티 매장 연동) */}
          <div className="imin-card" style={{ padding: '24px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              🏪 새 가맹점 매장 등록 (멀티 매장 매핑)
            </h4>
            
            <form onSubmit={handleRegisterStore} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>매장 이름</label>
                  <input 
                    type="text" 
                    placeholder="예: 커피하우스 신촌점"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    className="imin-input"
                    style={{ padding: '10px' }}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>가맹점 사장님 선택</label>
                  <select 
                    value={newStoreOwnerId}
                    onChange={(e) => setNewStoreOwnerId(e.target.value)}
                    className="imin-input"
                    style={{ padding: '10px', cursor: 'pointer' }}
                  >
                    <option value="">없음 (미배정 - 가입 시 사장님이 검색하여 등록 가능)</option>
                    {users.filter(u => u.role === 'owner' && u.status !== 'deleted').map(owner => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} (@{owner.nickname})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>업종 카테고리</label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryEditor(!showCategoryEditor)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0
                      }}
                    >
                      <span>⚙️ 업종 편집</span>
                    </button>
                  </div>
                  
                  <select 
                    value={newStoreCategory}
                    onChange={(e) => setNewStoreCategory(e.target.value)}
                    className="imin-input"
                    style={{ padding: '10px', cursor: 'pointer' }}
                  >
                    {[...categories]
                      .sort((a, b) => a.localeCompare(b))
                      .map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    }
                    <option value="Other (기타)">Other (기타)</option>
                  </select>

                  {/* 업종 카테고리 편집 패널 */}
                  {showCategoryEditor && (
                    <div style={{
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        🏷️ 업종 추가/삭제
                      </div>
                      
                      {/* 추가 입력창 */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="예: Gym (헬스장)"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="imin-input"
                          style={{ padding: '6px 10px', fontSize: '12.5px', flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newCategoryName.trim();
                            if (!trimmed) return;
                            addCategory(trimmed);
                            setNewCategoryName('');
                          }}
                          className="imin-btn imin-btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}
                        >
                          추가
                        </button>
                      </div>

                      {/* 등록 목록 */}
                      <div style={{
                        maxHeight: '120px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        borderTop: '1px solid #e9ecef',
                        paddingTop: '8px'
                      }}>
                        {categories.length === 0 ? (
                          <span style={{ fontSize: '11px', color: '#8e8e93' }}>등록된 업종이 없습니다.</span>
                        ) : (
                          [...categories]
                            .sort((a, b) => a.localeCompare(b))
                            .map(cat => (
                              <div
                                key={cat}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  backgroundColor: '#ffffff',
                                  borderRadius: '4px',
                                  border: '1px solid #e9ecef'
                                }}
                              >
                                <span>{cat}</span>
                                <button
                                  type="button"
                                  onClick={() => deleteCategory(cat)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--accent-red)',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '0 4px'
                                  }}
                                >
                                  삭제
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>7회 완성 보상 금액 ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.1"
                    value={newStoreReward}
                    onChange={(e) => setNewStoreReward(parseFloat(e.target.value))}
                    className="imin-input"
                    style={{ padding: '10px' }}
                  />
                </div>
              </div>

              {storeRegError && (
                <div style={{ color: 'var(--accent-red)', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ {storeRegError}
                </div>
              )}

              {storeRegSuccess && (
                <div style={{ color: 'var(--accent-green)', fontSize: '13px', fontWeight: 600 }}>
                  ✓ {storeRegSuccess}
                </div>
              )}

              <button 
                type="submit" 
                className="imin-btn imin-btn-primary" 
                style={{ alignSelf: 'flex-end', width: 'auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} />
                매장 등록 및 사장님 연결
              </button>
            </form>
          </div>

          {/* 기존 입점 매장 목록 카드 */}
          <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>입점 매장 목록</h3>
              
              {/* 검색어 필터 */}
              <input 
                type="text" 
                placeholder="매장명 또는 업종 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="imin-input"
                style={{ maxWidth: '240px', padding: '8px 4px', fontSize: '13px' }}
              />
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '550px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <th style={{ padding: '12px' }}>매장명</th>
                    <th style={{ padding: '12px' }}>업종</th>
                    <th style={{ padding: '12px' }}>배정 사장님</th>
                    <th style={{ padding: '12px' }}>7회 적립 시 보상</th>
                    <th style={{ padding: '12px' }}>1도장 가치</th>
                    <th style={{ padding: '12px' }}>누적 기부 스탬프</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>바로가기</th>
                  </tr>
                </thead>
                <tbody>
                  {stores
                    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.category.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(s => {
                      const storeDons = donations.filter(d => d.storeId === s.id);
                      const stampCount = storeDons.reduce((sum, d) => sum + d.stampCount, 0);
                      const ownerUser = users.find(u => u.id === s.ownerId);
                      const ownerName = ownerUser ? `${ownerUser.name} (@${ownerUser.nickname})` : '';

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', height: '48px' }}>
                          <td style={{ padding: '12px', fontWeight: 600 }}>
                            <span
                              onClick={() => setSelectedStoreDetailId(s.id)}
                              style={{
                                color: 'var(--primary-color)',
                                cursor: 'pointer',
                                borderBottom: '1px dashed var(--primary-color)',
                                transition: 'opacity 0.2s'
                              }}
                              onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                              onMouseOut={e => e.currentTarget.style.opacity = '1'}
                            >
                              {s.name}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: 'var(--border-radius-pill)', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', fontWeight: 600 }}>
                                {s.category.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ 
                              fontSize: '13px', 
                              fontWeight: 600, 
                              color: ownerUser ? (ownerUser.status === 'pending_approval' ? '#d97706' : 'var(--text-primary)') : '#b45309'
                            }}>
                              {ownerUser ? (
                                ownerUser.status === 'pending_approval'
                                  ? `⏳ 승인 대기중 (${ownerUser.name})`
                                  : `👤 ${ownerName}`
                              ) : '⏳ 미배정 (가입 대기)'}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontWeight: 700, color: 'var(--accent-green)' }}>${s.pointRewardPer7Stamps.toFixed(2)}</td>
                          <td style={{ padding: '12px' }}>${(s.pointRewardPer7Stamps / 7).toFixed(2)}</td>
                          <td style={{ padding: '12px' }}>{stampCount}개</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {ownerUser ? (
                              <button
                                onClick={() => {
                                  setSelectedStoreId(s.id);
                                  setCurrentOwner(ownerUser);
                                  localStorage.setItem('sharestamps_selected_store_id', s.id);
                                  localStorage.setItem('sharestamps_session_owner', JSON.stringify(ownerUser));
                                  window.open('#/store', '_blank');
                                  playVoiceGuidance(language === 'ko' ? `${s.name} 사장님 페이지를 새 창으로 엽니다.` : `Opening ${s.name} owner dashboard in a new tab.`);
                                }}
                                className="imin-btn"
                                style={{
                                  width: 'auto',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  backgroundColor: 'var(--primary-color)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: '0 2px 6px rgba(95, 92, 230, 0.2)',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={e => {
                                  e.currentTarget.style.backgroundColor = '#4a47b3';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseOut={e => {
                                  e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <ExternalLink size={12} />
                                <span>{language === 'ko' ? '사장님 POS' : 'Owner POS'}</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                {language === 'ko' ? '사장님 미배정' : 'No Owner'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 3. NPO 목록 관리 탭 */}
      {activeSubTab === 'npos' && (
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* 헤더: 제목 + 초기화 + 등록 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>등록 비영리 단체 (NPO) 디렉토리</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>활성 상태의 NPO만 고객 폰 앱에 표시됩니다.</p>
            </div>
             <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="imin-btn imin-btn-secondary"
                style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }}
                onClick={() => setShowNpoForm(v => !v)}
              >
                {showNpoForm ? '❌ 입력 취소' : '+ 신규 단체 등록'}
              </button>
            </div>
          </div>

          {/* NPO 등록 폼 */}
          {showNpoForm && (
            <div style={{ padding: '16px', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>🌟 신규 NPO 단체 등록</h4>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>단체명 *</label>
                <input
                  type="text"
                  value={npoFormName}
                  onChange={e => setNpoFormName(e.target.value)}
                  placeholder="예: 희망 푸드뱅크"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>단체 소개 *</label>
                <textarea
                  value={npoFormDesc}
                  onChange={e => setNpoFormDesc(e.target.value)}
                  placeholder="이 단체의 활동과 목적을 입력하세요."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <button
                className="imin-btn imin-btn-primary"
                style={{ width: 'auto', alignSelf: 'flex-end', padding: '10px 24px', fontSize: '13px' }}
                onClick={() => {
                  if (!npoFormName.trim() || !npoFormDesc.trim()) {
                    alert('단체명과 소개를 모두 입력해주세요.');
                    return;
                  }
                  addNonProfit(npoFormName.trim(), npoFormDesc.trim());
                  setNpoFormName('');
                  setNpoFormDesc('');
                  setShowNpoForm(false);
                }}
              >
                등록 확인
              </button>
            </div>
          )}

          {/* NPO 카드 목록 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {nonProfits.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-md)' }}>
                🌱 등록된 NPO 단체가 없습니다. 위의 양식으로 신규 단체를 등록하세요.
              </div>
            ) : nonProfits.map(npo => {
              const stats = getNPOStats(npo.id);
              const isActive = npo.status === 'active';
              const isEditing = editingNpoId === npo.id;
              return (
                <div key={npo.id} className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', border: `1px solid ${isActive ? 'var(--border-color)' : '#FECACA'}`, backgroundColor: isActive ? 'var(--surface-color)' : '#FFF5F5' }}>
                  {isEditing ? (
                    // NPO 내용 수정 모드 폼
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ID: {npo.id}</span>
                      </div>
                      <input
                        type="text"
                        value={editingNpoName}
                        onChange={e => setEditingNpoName(e.target.value)}
                        placeholder="NPO 단체명"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '13px', outline: 'none' }}
                      />
                      <textarea
                        value={editingNpoDesc}
                        onChange={e => setEditingNpoDesc(e.target.value)}
                        placeholder="NPO 단체 소개"
                        rows={2}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          className="imin-btn imin-btn-secondary"
                          style={{ width: 'auto', padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => setEditingNpoId(null)}
                        >
                          취소
                        </button>
                        <button
                          className="imin-btn imin-btn-primary"
                          style={{ width: 'auto', padding: '4px 12px', fontSize: '11px' }}
                          onClick={() => {
                            if (!editingNpoName.trim() || !editingNpoDesc.trim()) {
                              alert('단체명과 소개를 모두 입력해주세요.');
                              return;
                            }
                            updateNonProfit(npo.id, editingNpoName.trim(), editingNpoDesc.trim());
                            setEditingNpoId(null);
                          }}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 기존 NPO 카드 레이아웃 (수정 ✏️ 버튼 추가 및 이름 옆 ID 표기 추가)
                    <>
                      {/* 상단 라인: 상태 뱃지 + 이름(ID포함) + 수정/삭제 버튼 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                          <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: isActive ? '#ECFDF5' : '#FEF2F2', color: isActive ? '#065F46' : '#991B1B', fontWeight: 600 }}>
                            {isActive ? '활성' : '비활성'}
                          </span>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            {npo.name}
                            <span style={{ fontSize: '10px', color: '#AEAEB2', fontWeight: 500 }}>({npo.id})</span>
                          </h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => {
                              setEditingNpoId(npo.id);
                              setEditingNpoName(npo.name);
                              setEditingNpoDesc(npo.description);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', padding: '2px', fontSize: '11px' }}
                            title="단체 정보 수정"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => { if (window.confirm(`'${npo.name}' 단체를 삭제하시겠습니까?`)) deleteNonProfit(npo.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AEAEB2', padding: '2px' }}
                            title="단체 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* 설명 구문 (콤팩트화) */}
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={npo.description}>{npo.description}</p>

                      {/* 중단 라인: 총 수령액 및 미정산 잔액 가로 1줄 배치 */}
                      <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '6px 0', display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>총 수령액:</span>
                          <strong>${stats.value.toFixed(2)} ({stats.stamps}개)</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', marginRight: '4px' }}>미정산:</span>
                          <strong style={{ color: 'var(--accent-red)' }}>${stats.pendingValue.toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* 하단 버튼 컨트롤들 */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                        {/* 슬라이딩 토글 바 */}
                        <div
                          onClick={() => toggleNonProfitStatus(npo.id)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            position: 'relative',
                            backgroundColor: '#F0F0F5',
                            borderRadius: '999px',
                            padding: '2px',
                            cursor: 'pointer',
                            userSelect: 'none',
                            border: '1px solid #E0E0EA'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: '2px',
                            bottom: '2px',
                            left: isActive ? '2px' : '50%',
                            width: 'calc(50% - 2px)',
                            borderRadius: '999px',
                            backgroundColor: isActive ? '#5F5CE6' : '#FF453A',
                            transition: 'left 0.25s ease, background-color 0.25s ease',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                          }} />
                          <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: '11px', fontWeight: 700, color: isActive ? '#ffffff' : '#AEAEB2', position: 'relative', zIndex: 1, transition: 'color 0.25s ease' }}>
                            표시
                          </div>
                          <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: '11px', fontWeight: 700, color: !isActive ? '#ffffff' : '#AEAEB2', position: 'relative', zIndex: 1, transition: 'color 0.25s ease' }}>
                            중지
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedNpo(npo)}
                          className="imin-chip"
                          style={{ flex: 0.8, padding: '6px', fontSize: '11px', borderRadius: 'var(--border-radius-pill)', fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--background-color)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        >
                          📋 기부 내역
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>


          {/* 전체 기부 및 정산 원장 내역 */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>📜 기부 및 정산 세부 내역 원장 (Donation Audit Ledger)</h3>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <th style={{ padding: '10px 12px' }}>기부 일시</th>
                    <th style={{ padding: '10px 12px' }}>기부 단체</th>
                    <th style={{ padding: '10px 12px' }}>기부 매장</th>
                    <th style={{ padding: '10px 12px' }}>기부 고객</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>기부 도장</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>환산 가치</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>사장 정산 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.length > 0 ? (
                    donations
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(d => {
                        const npo = nonProfits.find(n => n.id === d.nonProfitId);
                        const store = stores.find(s => s.id === d.storeId);
                        const donor = users.find(u => u.id === d.donorId);
                        const isSettled = d.settledStatus === 'settled';

                        return (
                          <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)', height: '48px' }}>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                              {new Date(d.createdAt).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                              {npo ? npo.name : d.nonProfitId}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {store ? store.name : d.storeId}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                              <div style={{ fontWeight: 500 }}>{donor ? donor.name : d.donorId}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {donor ? `@${donor.nickname}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                              ⭐ {d.stampCount}개
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>
                              ${d.monetaryValue.toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span 
                                style={{ 
                                  fontSize: '11.5px', 
                                  padding: '4px 8px', 
                                  borderRadius: 'var(--border-radius-pill)', 
                                  backgroundColor: isSettled ? '#ECFDF5' : '#FFFBEB', 
                                  color: isSettled ? '#065F46' : '#B45309', 
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isSettled ? '#10B981' : '#F59E0B' }} />
                                {isSettled ? '정산완료' : '정산대기'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                        접수된 기부 내역이 존재하지 않습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NPO 기부 상세 모달 */}
      {selectedNpo && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={() => setSelectedNpo(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--surface-color)', borderRadius: 'var(--border-radius-lg)',
              padding: '24px', width: '100%', maxWidth: '720px', maxHeight: '82vh',
              overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>💝 {selectedNpo.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedNpo.description}</p>
              </div>
              <button onClick={() => setSelectedNpo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', flexShrink: 0 }}>
                <X size={20} />
              </button>
            </div>

            {/* 요약 수치 */}
            {(() => {
              const npoDons = donations.filter(d => d.nonProfitId === selectedNpo.id);
              const totalStamps = npoDons.reduce((s, d) => s + d.stampCount, 0);
              const totalValue = npoDons.reduce((s, d) => s + d.monetaryValue, 0);
              const pendingValue = npoDons.filter(d => d.settledStatus !== 'settled').reduce((s, d) => s + d.monetaryValue, 0);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ textAlign: 'center', padding: '14px', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-md)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-color)' }}>{npoDons.length}건</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>총 기부 횟수</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '14px', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-md)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green)' }}>${totalValue.toFixed(2)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>총 수령액 ({totalStamps}개 스탬프)</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '14px', backgroundColor: 'var(--background-color)', borderRadius: 'var(--border-radius-md)' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-red)' }}>${pendingValue.toFixed(2)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>미정산 잔액</div>
                  </div>
                </div>
              );
            })()}

            {/* 기부 내역 테이블 */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>일시</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>기부자 (ID)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>기부 매장</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>스탬프</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>금액</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {donations
                    .filter(d => d.nonProfitId === selectedNpo.id)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(d => {
                      const donor = users.find(u => u.id === d.donorId);
                      const store = stores.find(s => s.id === d.storeId);
                      const isSettled = d.settledStatus === 'settled';
                      return (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {new Date(d.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{donor?.nickname ?? d.donorId}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{donor?.phoneNumber ?? ''}</div>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {store ? store.name : (d.storeId === 'none' ? '캐시 직접 기부' : d.storeId)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {d.stampCount > 0 ? `⭐ ${d.stampCount}개` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>
                            ${d.monetaryValue.toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: '11px', padding: '3px 8px', borderRadius: 'var(--border-radius-pill)',
                              backgroundColor: isSettled ? '#ECFDF5' : '#FFFBEB',
                              color: isSettled ? '#065F46' : '#B45309', fontWeight: 600
                            }}>
                              {isSettled ? '✅ 정산완료' : '⏳ 대기중'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  {donations.filter(d => d.nonProfitId === selectedNpo.id).length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        아직 이 단체에 대한 기부 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. 월별 기부 정산 대장 탭 */}
      {activeSubTab === 'settlement' && (
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>월별 기부금 정산 청구 대장</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
              각 매장 점주가 NPO 단체별로 직접 납부해야 하는 스탬프 현금 가치 청구 내역입니다.
            </p>
          </div>

          {billings.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <th style={{ padding: '12px' }}>매장명</th>
                    <th style={{ padding: '12px' }}>NPO 수신처</th>
                    <th style={{ padding: '12px' }}>기부 스탬프</th>
                    <th style={{ padding: '12px' }}>정산 청구액</th>
                    <th style={{ padding: '12px' }}>정산 상태</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>청구 승인</th>
                  </tr>
                </thead>
                <tbody>
                  {billings.map(b => {
                    const isSettled = settledBills[b.id];
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)', height: '52px' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          <span
                            onClick={() => setSelectedStoreDetailId(b.storeId)}
                            style={{
                              color: 'var(--primary-color)',
                              cursor: 'pointer',
                              borderBottom: '1px dashed var(--primary-color)',
                              transition: 'opacity 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                            onMouseOut={e => e.currentTarget.style.opacity = '1'}
                          >
                            {b.storeName}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{b.npoName}</td>
                        <td style={{ padding: '12px' }}>{b.stampsCount}개</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: 'var(--primary-color)' }}>
                          ${b.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span 
                            style={{ 
                              fontSize: '12px', 
                              padding: '4px 8px', 
                              borderRadius: 'var(--border-radius-pill)', 
                              backgroundColor: isSettled ? '#ECFDF5' : '#FFFBEB', 
                              color: isSettled ? '#065F46' : '#B45309', 
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isSettled ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            {isSettled ? '정산 납부완료' : '정산 청구대기'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            disabled={isSettled}
                            onClick={() => handleSettleBill(b.id, b.storeName, b.npoName, b.amount)}
                            className="imin-btn imin-btn-primary"
                            style={{ 
                              width: 'auto', 
                              padding: '6px 12px', 
                              fontSize: '12px',
                              borderRadius: '4px'
                            }}
                          >
                            {isSettled ? '정산완료' : '송금 시뮬레이션'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <FileText size={48} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
              <p>이달에 청구된 정산 대상 기부금 내역이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 5. 광고 배너 관리 탭 */}
      {activeSubTab === 'ads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 광고 등록 폼 */}
          <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Megaphone size={18} style={{ color: 'var(--primary-color)' }} />
                새 광고 배너 등록
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                등록된 광고는 고객 스마트폰 PWA 상단 배너 영역에 실시간으로 반영됩니다.
              </p>
            </div>

            <form onSubmit={handleRegisterAd} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* 이미지 업로드 영역 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  배너 이미지 <span style={{ color: 'var(--accent-red)' }}>*</span>
                  <span style={{ fontWeight: 400, marginLeft: '6px', color: '#8e8e93' }}>(파일 업로드 또는 URL 직접 입력 — 16:4 비율 권장)</span>
                </label>
                {/* 파일 업로드 */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '9px 16px', backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary-color)', borderRadius: 'var(--border-radius-pill)',
                    fontWeight: 600, fontSize: '13px', cursor: 'pointer', border: '1px solid var(--primary-color)',
                    flexShrink: 0
                  }}>
                    <Plus size={14} />
                    파일 선택
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAdFileChange} style={{ display: 'none' }} />
                  </label>
                  {adUploadFile && (
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, backgroundColor: '#f0f0f5', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      📁 {adUploadFile.name}
                      <X size={14} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => {
                        setAdUploadFile(null);
                        setAdPreviewUrl('');
                        setAdImageUrl('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }} />
                    </span>
                  )}
                  <input
                    type="url"
                    placeholder="또는 이미지 URL 직접 입력 (https://...)"
                    value={adUploadFile ? '' : adImageUrl}
                    onChange={(e) => {
                      setAdImageUrl(e.target.value);
                      setAdUploadFile(null);
                      setAdPreviewUrl(e.target.value);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="imin-input"
                    style={{ padding: '10px 12px', flex: 1, minWidth: '200px' }}
                  />
                </div>
                {/* 미리보기 */}
                {adPreviewUrl && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{
                      width: '100%', maxWidth: '400px',
                      aspectRatio: '16 / 4',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      position: 'relative'
                    }}>
                      <img
                        src={adPreviewUrl}
                        alt="미리보기"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      ↑ 고객 PWA에 노출되는 실제 비율(16:4) 미리보기
                    </span>
                  </div>
                )}
              </div>

              {/* 링크 URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  랜딩 페이지 링크 URL <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: www.starbucks.co.kr (https:// 없어도 자동 추가)"
                  value={adLinkUrl}
                  onChange={(e) => setAdLinkUrl(e.target.value)}
                  className="imin-input"
                  style={{ padding: '10px 12px' }}
                />
              </div>

              {formError && (
                <div style={{ color: 'var(--accent-red)', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ {formError}
                </div>
              )}

              <button
                type="submit"
                className="imin-btn imin-btn-primary"
                style={{ alignSelf: 'flex-end', width: 'auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} />
                광고 등록하기
              </button>
            </form>
          </div>

          {/* 광고 배너 목록 */}
          <div id="ad-banner-list" className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>등록된 광고 배너 목록</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                가장 상단에 활성화(Active) 처리된 광고가 고객 PWA에 실시간으로 표시됩니다.
              </p>
            </div>

            {adBanners.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <th style={{ padding: '12px', width: '200px' }}>이미지 미리보기</th>
                      <th style={{ padding: '12px' }}>링크</th>
                      <th style={{ padding: '12px', width: '100px' }}>등록일시</th>
                      <th style={{ padding: '12px', width: '140px' }}>상태</th>
                      <th style={{ padding: '12px', width: '80px', textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adBanners.map(ad => (
                      <tr key={ad.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {/* 이미지 미리보기 16:4 */}
                        <td style={{ padding: '12px', width: '200px' }}>
                          {ad.imageUrl ? (
                            <div style={{
                              width: '180px',
                              aspectRatio: '16 / 4',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: '1px solid var(--border-color)',
                              position: 'relative'
                            }}>
                              <img
                                src={ad.imageUrl}
                                alt="배너 미리보기"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            </div>
                          ) : (
                            <div style={{
                              width: '180px',
                              aspectRatio: '16 / 4',
                              borderRadius: '6px',
                              background: 'linear-gradient(135deg, var(--primary-light), var(--primary-color))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              border: '1px solid #e5e5ea'
                            }}>
                              <Megaphone size={20} />
                            </div>
                          )}
                        </td>
                        {/* 링크 */}
                        <td style={{ padding: '12px' }}>
                          <a
                            href={ad.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500, wordBreak: 'break-all', fontSize: '13px' }}
                          >
                            {ad.linkUrl}
                            <ExternalLink size={12} style={{ flexShrink: 0 }} />
                          </a>
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(ad.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {(() => {
                            const activeCount = adBanners.filter(a => a.status === 'active').length;
                            const isLastActive = ad.status === 'active' && activeCount <= 1;
                            return (
                              <button
                                onClick={() => toggleAdBannerStatus(ad.id)}
                                className="imin-chip"
                                disabled={isLastActive}
                                title={isLastActive ? '최소 1개 이상의 배너가 노출 중이어야 합니다.' : undefined}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  borderRadius: 'var(--border-radius-pill)',
                                  backgroundColor: ad.status === 'active' ? '#ECFDF5' : '#FEF2F2',
                                  color: ad.status === 'active' ? '#065F46' : '#991B1B',
                                  border: `1px solid ${ad.status === 'active' ? '#A7F3D0' : '#FECACA'}`,
                                  fontWeight: 700,
                                  cursor: isLastActive ? 'not-allowed' : 'pointer',
                                  opacity: isLastActive ? 0.5 : 1,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {isLastActive && <span style={{ fontSize: '10px' }}>🔒</span>}
                                {ad.status === 'active' ? '노출 중 (Active)' : '중지됨 (Inactive)'}
                              </button>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            onClick={() => deleteAdBanner(ad.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '6px' }}
                            title="광고 삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <Megaphone size={48} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                <p>등록된 광고 배너가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. 회원 및 마케팅 분석 탭 */}
      {activeSubTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          


          {userRoleTab === 'customer' ? (
            <>
              {/* 마케팅 분석 KPI 요약 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                    <Users2 size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>플랫폼 총 회원 수</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--primary-color)' }}>
                      {customers.length}명
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>소비자 회원 기준</span>
                  </div>
                </div>

                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(10, 132, 255, 0.08)', color: 'var(--accent-blue)' }}>
                    <Building2 size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>평균 가입 매장 수</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-blue)' }}>
                      {avgStoresPerUser.toFixed(1)}개
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>1인당 스탬프 카드 개설 수</span>
                  </div>
                </div>

                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--accent-green)' }}>
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>단골 고객 (로열 멤버)</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-green)' }}>
                      {segmentStats.loyal}명
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>3개 이상 매장 이용 비율: {customers.length > 0 ? ((segmentStats.loyal / customers.length) * 100).toFixed(0) : 0}%</span>
                  </div>
                </div>

                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(255, 69, 58, 0.08)', color: 'var(--accent-red)' }}>
                    <HeartHandshake size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>나눔 기부 참여 고객</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-red)' }}>
                      {segmentStats.donor}명
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>누적 기금 전달 완료 비율: {customers.length > 0 ? ((segmentStats.donor / customers.length) * 100).toFixed(0) : 0}%</span>
                  </div>
                </div>
              </div>

              {renderRoleTabs()}

              {/* 회원 목록 & 세부 컨트롤 */}
              <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>회원 마케팅 대장</h3>
                  
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {/* 매장별 필터 */}
                    <select 
                      value={selectedUserStoreFilter}
                      onChange={(e) => setSelectedUserStoreFilter(e.target.value)}
                      className="imin-input"
                      style={{ width: '190px', padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--border-radius-pill)', cursor: 'pointer' }}
                    >
                      <option value="all">🌐 전체 매장 회원 보기</option>
                      {stores.filter(s => s.id.startsWith('store_id_')).slice(0, 5).map(s => (
                        <option key={s.id} value={s.id}>🏪 {s.name}</option>
                      ))}
                    </select>

                    {/* 검색 필드 */}
                    <input 
                      type="text" 
                      placeholder="이름, 닉네임, 연락처(뒤 4자리) 검색..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="imin-input"
                      style={{ width: '250px', padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--border-radius-pill)' }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <th style={{ padding: '12px' }}>회원 정보</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>가입 매장 수</th>
                        <th style={{ padding: '12px' }}>마케팅 세그먼트</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>
                          {selectedUserStoreFilter === 'all' ? '보유 스탬프 (총합)' : '해당 매장 스탬프'}
                        </th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>
                          보유 스탬프 캐시
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>분석</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map(user => {
                        const userCards = stampCards.filter(c => c.userId === user.id);
                        const userPoints = storePoints.filter(p => p.userId === user.id);
                        
                        // 필터에 따른 값 동적 노출
                        let stampsDisplay = 0;
                        const cashDisplay = userPoints.reduce((sum, p) => sum + p.pointsBalance, 0);
                        
                        if (selectedUserStoreFilter === 'all') {
                          stampsDisplay = userCards.reduce((sum, c) => sum + c.currentStamps, 0);
                        } else {
                          stampsDisplay = userCards.find(c => c.storeId === selectedUserStoreFilter)?.currentStamps || 0;
                        }

                        const isLoyal = userCards.length >= 3;
                        const hasDonated = donations.some(d => d.donorId === user.id);
                        const totalStamps = userCards.reduce((sum, c) => sum + c.currentStamps, 0);
                        const isNew = userCards.length <= 1 && totalStamps <= 1 && !hasDonated;

                        return (
                          <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)', height: '54px' }}>
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontWeight: 600 }}>{user.name} <span style={{ fontSize: '11px', color: '#AEAEB2', fontWeight: 500 }}>({user.id})</span></div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                @{user.nickname} • {user.phoneNumber}
                              </div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: 'var(--primary-color)' }}>
                              {userCards.length}개 매장
                            </td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {user.status === 'suspended' && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 69, 58, 0.15)', color: '#ff453a', fontWeight: 'bold' }}>
                                    🔴 활동 정지
                                  </span>
                                )}
                                {isLoyal && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(95, 92, 230, 0.1)', color: '#5f5ce6', fontWeight: 'bold' }}>
                                    👑 로열 멤버
                                  </span>
                                )}
                                {hasDonated && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 69, 58, 0.1)', color: '#ff453a', fontWeight: 'bold' }}>
                                    🧡 나눔 엔젤
                                  </span>
                                )}
                                {isNew && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 'bold' }}>
                                    🌱 신규 회원
                                  </span>
                                )}
                                {!isLoyal && !hasDonated && !isNew && (
                                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F2F2F7', color: '#8e8e93', fontWeight: 'bold' }}>
                                    👤 일반 회원
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                              ⭐ {stampsDisplay}개
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)' }}>
                              ${cashDisplay.toFixed(2)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button 
                                onClick={() => setSelectedDetailedUser(user)}
                                className="imin-btn"
                                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                              >
                                상세 분석
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 사장님 KPI 요약 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                    <Users2 size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 사장님 수</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--primary-color)' }}>
                      {owners.length}명
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>가입된 매장 점주 기준</span>
                  </div>
                </div>

                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(10, 132, 255, 0.08)', color: 'var(--accent-blue)' }}>
                    <Building2 size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>총 매장 수</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-blue)' }}>
                      {stores.length}개
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>플랫폼 등록 매장 합계</span>
                  </div>
                </div>

                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--accent-green)' }}>
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>평균 운영 매장 수</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-green)' }}>
                      {(stores.length / Math.max(1, owners.length)).toFixed(1)}개
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>1점주당 관리 매장 수</span>
                  </div>
                </div>

                <div className="imin-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'rgba(255, 69, 58, 0.08)', color: 'var(--accent-red)' }}>
                    <HeartHandshake size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>활성 사장님 비율</span>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '2px', color: 'var(--accent-red)' }}>
                      {(owners.filter(o => stores.some(s => s.ownerId === o.id)).length / Math.max(1, owners.length) * 100).toFixed(0)}%
                    </h3>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>1개 이상 매장 매칭 비율</span>
                  </div>
                </div>
              </div>

              {renderRoleTabs()}

              {/* 사장님 목록 & 세부 컨트롤 */}
              <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>가맹 가입 사장님 대장</h3>
                  
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {/* 검색 필드 */}
                    <input 
                      type="text" 
                      placeholder="이름, 닉네임, 연락처(뒤 4자리) 검색..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="imin-input"
                      style={{ width: '250px', padding: '6px 12px', fontSize: '13px', borderRadius: 'var(--border-radius-pill)' }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <th style={{ padding: '12px' }}>사장님 정보</th>
                        <th style={{ padding: '12px' }}>연락처</th>
                        <th style={{ padding: '12px' }}>아이디</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>운영 매장 수</th>
                        <th style={{ padding: '12px' }}>운영 매장 목록</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>총 스탬프 발행</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>총 캐시 지급액</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>분석</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwners.length > 0 ? (
                        filteredOwners.map(owner => {
                          const ownerStores = stores.filter(s => s.ownerId === owner.id);
                          const ownerStoreIds = ownerStores.map(s => s.id);
                          
                          // 총 스탬프 발행액
                          const stampsIssued = stampTransactions
                            .filter(t => ownerStoreIds.includes(t.storeId) && (
                              t.type === 'earn' ||
                              (t.type === 'gift_receive' && gifts.find(g => g.id === t.referenceId)?.senderId === owner.id)
                            ))
                            .reduce((sum, t) => sum + Math.max(0, t.amount), 0);
                            
                          // 총 캐시 지급액
                          const cashPaid = pointTransactions
                            .filter(t => ownerStoreIds.includes(t.storeId) && t.amount > 0)
                            .reduce((sum, t) => sum + t.amount, 0);

                          return (
                            <tr key={owner.id} style={{ borderBottom: '1px solid var(--border-color)', height: '54px' }}>
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600 }}>{owner.name}</span>
                                  {owner.status === 'suspended' && (
                                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(255, 69, 58, 0.15)', color: '#ff453a', fontWeight: 'bold' }}>
                                      🔴 활동 정지
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  @{owner.nickname}
                                </div>
                              </td>
                              <td style={{ padding: '12px' }}>
                                {owner.phoneNumber}
                              </td>
                              <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                                {owner.loginId || 'N/A'}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: 'var(--primary-color)' }}>
                                {ownerStores.length}개
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {ownerStores.map(store => (
                                    <span key={store.id} style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F2F2F7', color: 'var(--text-primary)', fontWeight: 600 }}>
                                      {store.name}
                                    </span>
                                  ))}
                                  {ownerStores.length === 0 && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                      연동 매장 없음
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                                ⭐ {stampsIssued}개
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)' }}>
                                ${cashPaid.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <button 
                                  onClick={() => setSelectedDetailedUser(owner)}
                                  className="imin-btn"
                                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  상세 분석
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            검색된 사장님이 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 6. 실시간 요청 및 기부 로그 탭 */}
      {activeSubTab === 'logs' && (
        <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>실시간 결제 & 기부 요청 전체 로그</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
              플랫폼 내 전체 가입 매장에서 접수된 실시간 할인 결제 및 기부 단체 기부 요청 목록입니다.
            </p>
          </div>

          {paymentRequests.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <th style={{ padding: '12px' }}>일시</th>
                    <th style={{ padding: '12px' }}>매장명</th>
                    <th style={{ padding: '12px' }}>고객 정보</th>
                    <th style={{ padding: '12px' }}>요청 유형</th>
                    <th style={{ padding: '12px' }}>수신 단체</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>요청 금액</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>처리 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRequests.map(req => {
                    const store = stores.find(s => s.id === req.storeId);
                    return (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--border-color)', height: '48px' }}>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(req.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          {store ? (
                            <span
                              onClick={() => setSelectedStoreDetailId(store.id)}
                              style={{
                                color: 'var(--primary-color)',
                                cursor: 'pointer',
                                borderBottom: '1px dashed var(--primary-color)',
                                transition: 'opacity 0.2s'
                              }}
                              onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                              onMouseOut={e => e.currentTarget.style.opacity = '1'}
                            >
                              {store.name}
                            </span>
                          ) : (
                            req.storeId
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600 }}>{req.userName.replace('회원_', '회원 ')}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>@{req.userNickname}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            fontSize: '12px', 
                            padding: '4px 8px', 
                            borderRadius: 'var(--border-radius-pill)',
                            backgroundColor: req.type === 'donation' ? 'rgba(255, 69, 58, 0.08)' : 'rgba(10, 132, 255, 0.08)',
                            color: req.type === 'donation' ? 'var(--accent-red)' : 'var(--accent-blue)',
                            fontWeight: 600
                          }}>
                            {req.type === 'donation' ? '🧡 기부' : '👤 결제 할인'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent-purple)' }}>
                          {req.type === 'donation' ? (req.nonProfitName || req.nonProfitId || '-') : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ${req.amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span 
                            style={{ 
                                fontSize: '12px', 
                                padding: '4px 8px', 
                                borderRadius: 'var(--border-radius-pill)', 
                                backgroundColor: req.status === 'approved' 
                                  ? '#ECFDF5' 
                                  : req.status === 'rejected' 
                                    ? '#FEF2F2' 
                                    : '#FFFBEB', 
                                color: req.status === 'approved' 
                                  ? '#065F46' 
                                  : req.status === 'rejected' 
                                    ? '#991B1B' 
                                    : '#B45309', 
                                fontWeight: 600
                            }}
                          >
                            {req.status === 'approved' ? '승인 완료' : req.status === 'rejected' ? '거절됨' : '대기 중'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <p>접수된 실시간 할인 및 기부 요청 로그가 존재하지 않습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 8. 글로벌 데이터베이스 초기화 (맨 아래 위치) */}
      <div style={{ 
        marginTop: '40px', 
        paddingTop: '20px', 
        borderTop: '1px dashed var(--border-color)', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
          ⚙️ 가상 데이터베이스 초기화 옵션
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="imin-btn imin-btn-secondary"
            style={{ 
              width: 'auto', 
              padding: '10px 20px', 
              fontSize: '13px', 
              color: 'var(--text-primary)', 
              borderColor: 'var(--border-color)',
              fontWeight: 700
            }}
            onClick={async () => {
              if (window.confirm('⚠️ 전체 데이터(매장, 회원 등)를 지우고 기본 샘플 데이터셋으로 다시 초기화하시겠습니까?')) {
                try {
                  await resetDatabase(false);
                  window.location.reload();
                } catch (err) {
                  console.error("Failed to reset database to sample:", err);
                }
              }
            }}
          >
            🔄 샘플 데이터 포함 초기화
          </button>
          
          <button
            className="imin-btn imin-btn-secondary"
            style={{ 
              width: 'auto', 
              padding: '10px 20px', 
              fontSize: '13px', 
              color: 'var(--accent-red)', 
              borderColor: 'var(--accent-red)',
              fontWeight: 700
            }}
            onClick={async () => {
              if (window.confirm('🚨 경고: 매장, 회원, NPO, 거래 내역을 포함한 모든 데이터를 100% 완전 삭제(공란 초기화)합니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) {
                try {
                  await resetDatabase(true);
                  window.location.reload();
                } catch (err) {
                  console.error("Failed to fully clear database:", err);
                }
              }
            }}
          >
            🗑️ 100% 완전 공란 초기화
          </button>
        </div>
      </div>

      {/* 7. 회원 상세 매장별 자산 분포 분석 모달 */}
      {selectedDetailedUser && (() => {
        const user = users.find(u => u.id === selectedDetailedUser.id) || selectedDetailedUser;
        const userCards = stampCards.filter(c => c.userId === user.id);
        const userPoints = storePoints.filter(p => p.userId === user.id);
        const userDonations = donations.filter(d => d.donorId === user.id);
        const totalDonatedValue = userDonations.reduce((sum, d) => sum + d.monetaryValue, 0);
        const totalDonatedStamps = userDonations.reduce((sum, d) => sum + d.stampCount, 0);
        const totalCash = userPoints.reduce((sum, p) => sum + p.pointsBalance, 0);
        
        return (
          <div 
            className="bottom-sheet-overlay" 
            onClick={() => setSelectedDetailedUser(null)}
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundColor: 'rgba(0, 0, 0, 0.4)', 
              backdropFilter: 'blur(8px)', 
              zIndex: 99999, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}
          >
            <div 
              className="imin-card animate-slide-up" 
              onClick={e => e.stopPropagation()} 
              style={{ 
                width: '90%', 
                maxWidth: '600px', 
                padding: '28px', 
                borderRadius: 'var(--border-radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
                backgroundColor: 'var(--surface-color)',
                border: '1px solid var(--border-color)'
              }}
            >
              {/* 모달 닫기 버튼 */}
              <button 
                onClick={() => setSelectedDetailedUser(null)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <XCircle size={24} />
              </button>

              {/* 회원 기본 프로필 */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800 }}>{user.name}</h3>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>@{user.nickname}</span>
                  {user.status === 'suspended' && (
                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255, 69, 58, 0.1)', color: '#ff453a', fontWeight: 'bold' }}>
                      🔴 활동 정지됨
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>연락처: {user.phoneNumber}</p>
                
                {/* 마케팅 세그먼트 태그 표시 */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {userCards.length >= 3 && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(95, 92, 230, 0.1)', color: '#5f5ce6', fontWeight: 'bold' }}>
                      👑 로열 멤버
                    </span>
                  )}
                  {userDonations.length > 0 && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(255, 69, 58, 0.1)', color: '#ff453a', fontWeight: 'bold' }}>
                      🧡 나눔 엔젤
                    </span>
                  )}
                  {userCards.length <= 1 && userCards.reduce((sum, c) => sum + c.currentStamps, 0) <= 1 && userDonations.length === 0 && (
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 'bold' }}>
                      🌱 신규 회원
                    </span>
                  )}
                </div>
              </div>

              {/* 마케팅 자산 현황 요약 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>가입 매장 수</span>
                  <strong style={{ fontSize: '18px', color: 'var(--primary-color)', marginTop: '4px', display: 'block' }}>{userCards.length}개 매장</strong>
                </div>
                <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>보유 스탬프 캐시</span>
                  <strong style={{ fontSize: '18px', color: 'var(--accent-green)', marginTop: '4px', display: 'block' }}>${totalCash.toFixed(2)}</strong>
                </div>
                <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>누적 기부 (환산액)</span>
                  <strong style={{ fontSize: '18px', color: '#ff453a', marginTop: '4px', display: 'block' }}>${totalDonatedValue.toFixed(2)} ({totalDonatedStamps}개)</strong>
                </div>
              </div>

              {/* 매장별 개설 스탬프 카드 및 적립금 목록 */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>🏪 매장별 개설 세부 정보</h4>
                {userCards.length > 0 ? (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#FAFAFC', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          <th style={{ padding: '10px 12px' }}>매장명</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>도장판 상태 (⭐)</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>보유 스탬프 캐시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userCards.map(card => {
                          const store = stores.find(s => s.id === card.storeId);
                          const points = userPoints.find(p => p.storeId === card.storeId)?.pointsBalance || 0;
                          if (!store) return null;
                          return (
                            <tr key={card.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{store.name}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                ⭐ {card.currentStamps} / 7
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-green)' }}>
                                ${points.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '20px' }}>
                    {language === 'ko' ? '활동 기록이 없습니다.' : 'No activity records found.'}
                  </p>
                )}
              </div>

              {/* 관리 제어 기능 */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => suspendUser(user.id)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--border-radius-md)',
                    border: user.status === 'suspended' ? '1px solid var(--accent-green)' : '1px solid #ff9500',
                    backgroundColor: 'transparent',
                    color: user.status === 'suspended' ? 'var(--accent-green)' : '#ff9500',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {user.status === 'suspended' ? '🔓 활동 정지 해제' : '🔒 회원 활동 정지'}
                </button>
                <button
                  onClick={() => {
                    const confirmMsg = language === 'ko'
                      ? `정말로 "${user.name}" 회원을 삭제하시겠습니까?\n이 회원의 모든 자산(스탬프, 포인트 등) 및 디바이스 정보가 영구적으로 삭제되며 복구할 수 없습니다.`
                      : `Are you sure you want to delete user "${user.name}"?\nAll associated assets (stamps, points, etc.) and device info will be permanently deleted and cannot be recovered.`;
                    if (window.confirm(confirmMsg)) {
                      deleteUser(user.id);
                      setSelectedDetailedUser(null);
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--border-radius-md)',
                    border: '1px solid var(--accent-red)',
                    backgroundColor: 'transparent',
                    color: 'var(--accent-red)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Trash2 size={14} />
                  {language === 'ko' ? '회원 삭제' : 'Delete User'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* 매장 상세 정보 모달 */}
      {selectedStoreDetailId && (() => {
        const store = stores.find(s => s.id === selectedStoreDetailId);
        if (!store) return null;
        
        // 발행된 스탬프 수 (Stamps Issued)
        const stampsIssued = stampTransactions
          .filter(t => t.storeId === store.id && (
            t.type === 'earn' ||
            (t.type === 'gift_receive' && gifts.find(g => g.id === t.referenceId)?.senderId === store.ownerId)
          ))
          .reduce((sum, t) => sum + Math.max(0, t.amount), 0);

        // 사용된 스탬프 (Stamps Converted to Cash)
        const stampsUsed = stampTransactions
          .filter(t => t.storeId === store.id && t.type === 'point_conversion')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // 잔액 스탬프 (Active Board Balance)
        const activeStamps = stampCards
          .filter(sc => sc.storeId === store.id)
          .reduce((sum, sc) => sum + sc.currentStamps, 0);

        // 기부된 스탬프 및 환산액
        const storeDonations = donations.filter(d => d.storeId === store.id);
        const stampsDonated = storeDonations.reduce((sum, d) => sum + d.stampCount, 0);
        const monetaryDonated = storeDonations.reduce((sum, d) => sum + d.monetaryValue, 0);

        // 기부된 단체 목록 및 정산 정보 가공
        const npoGroups: Record<string, { npoId: string; name: string; stampCount: number; monetaryValue: number; settled: number; pending: number }> = {};
        
        storeDonations.forEach(d => {
          if (!npoGroups[d.nonProfitId]) {
            const npo = nonProfits.find(n => n.id === d.nonProfitId);
            npoGroups[d.nonProfitId] = {
              npoId: d.nonProfitId,
              name: npo ? npo.name : d.nonProfitId,
              stampCount: 0,
              monetaryValue: 0,
              settled: 0,
              pending: 0
            };
          }
          npoGroups[d.nonProfitId].stampCount += d.stampCount;
          npoGroups[d.nonProfitId].monetaryValue += d.monetaryValue;
          if (d.settledStatus === 'settled') {
            npoGroups[d.nonProfitId].settled += d.monetaryValue;
          } else {
            npoGroups[d.nonProfitId].pending += d.monetaryValue;
          }
        });

        const groupedNpos = Object.values(npoGroups).sort((a, b) => b.stampCount - a.stampCount);
        const ownerUser = users.find(u => u.id === store.ownerId);

        return (
          <div 
            className="bottom-sheet-overlay" 
            onClick={() => setSelectedStoreDetailId(null)}
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              backgroundColor: 'rgba(0, 0, 0, 0.4)', 
              backdropFilter: 'blur(8px)', 
              zIndex: 99999, 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}
          >
            <div 
              className="imin-card animate-slide-up" 
              onClick={e => e.stopPropagation()} 
              style={{ 
                width: '90%', 
                maxWidth: '650px', 
                padding: '28px', 
                borderRadius: 'var(--border-radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
                backgroundColor: 'var(--surface-color)',
                border: '1px solid var(--border-color)'
              }}
            >
              {/* 모달 닫기 버튼 */}
              <button 
                onClick={() => setSelectedStoreDetailId(null)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <XCircle size={24} />
              </button>

              {/* 매장 기본 정보 */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800 }}>{store.name}</h3>
                  <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', fontWeight: 700 }}>
                    {store.category.toUpperCase()}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>👤 배정 사장님: {ownerUser ? `${ownerUser.name} (@${ownerUser.nickname})` : '미배정 (가입 대기)'}</span>
                  {ownerUser && (
                    <button
                      onClick={() => {
                        const newPw = window.prompt(
                          language === 'ko'
                            ? `"${ownerUser.name}" 사장님의 새 로그인 비밀번호를 입력해 주세요.`
                            : `Enter new login password for owner "${ownerUser.name}".`
                        );
                        if (newPw === null) return;
                        if (newPw.trim() === '') {
                          alert(language === 'ko' ? '비밀번호는 공백일 수 없습니다.' : 'Password cannot be empty.');
                          return;
                        }
                        const res = changeOwnerPassword(ownerUser.id, newPw.trim());
                        if (res.success) {
                          alert(language === 'ko' ? '비밀번호가 성공적으로 변경되었습니다.' : 'Password changed successfully.');
                        } else {
                          alert(res.message);
                        }
                      }}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary-color)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {language === 'ko' ? '비밀번호 변경' : 'Change PW'}
                    </button>
                  )}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginTop: '2px' }}>
                  🎫 1도장 가치: ${(store.pointRewardPer7Stamps / 7).toFixed(2)} (7회 보상: ${store.pointRewardPer7Stamps})
                </p>
              </div>

              {/* 스탬프 현황 요약 (4단 그리드) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>총 발행된 스탬프 수</span>
                  <strong style={{ fontSize: '20px', color: 'var(--primary-color)', marginTop: '6px', display: 'block', fontWeight: 800 }}>
                    {stampsIssued.toLocaleString()} 개
                  </strong>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>사용 (캐시 보상 전환) 스탬프</span>
                  <strong style={{ fontSize: '20px', color: 'var(--accent-green)', marginTop: '6px', display: 'block', fontWeight: 800 }}>
                    {stampsUsed.toLocaleString()} 개
                  </strong>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>고객 보유 잔액 스탬프</span>
                  <strong style={{ fontSize: '20px', color: 'var(--accent-blue)', marginTop: '6px', display: 'block', fontWeight: 800 }}>
                    {activeStamps.toLocaleString()} 개
                  </strong>
                </div>
                <div style={{ padding: '14px', borderRadius: 'var(--border-radius-md)', backgroundColor: '#FAFAFC', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>누적 기부된 스탬프</span>
                  <strong style={{ fontSize: '20px', color: 'var(--accent-red)', marginTop: '6px', display: 'block', fontWeight: 800 }}>
                    {stampsDonated.toLocaleString()} 개 <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>(${monetaryDonated.toFixed(2)})</span>
                  </strong>
                </div>
              </div>

              {/* 기부된 단체 목록 */}
              <div>
                <h4 style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🧡 기부된 단체 목록 및 정산 현황
                </h4>
                {groupedNpos.length > 0 ? (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#FAFAFC', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          <th style={{ padding: '10px 12px' }}>단체명</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>기부 스탬프</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>환산액</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>정산 완료액</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>미정산 잔액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedNpos.map(g => (
                          <tr key={g.npoId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{g.name}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>
                              {g.stampCount} 개
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                              ${g.monetaryValue.toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--accent-green)', fontWeight: 700 }}>
                              ${g.settled.toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ff9500', fontWeight: 700 }}>
                              ${g.pending.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', backgroundColor: '#FAFAFC', border: '1px dashed var(--border-color)', borderRadius: 'var(--border-radius-md)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    이 매장에서 기부된 이력이 존재하지 않습니다.
                  </div>
                )}
              </div>

              {/* 하단 제어 버튼 (활동정지, 삭제, 닫기) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* 활동 정지 / 해제 버튼 */}
                  <button
                    onClick={() => {
                      if (window.confirm(
                        store.status === 'suspended'
                          ? (language === 'ko' ? `"${store.name}" 매장의 활동 정지를 해제하시겠습니까?` : `Lift suspension for "${store.name}"?`)
                          : (language === 'ko' ? `"${store.name}" 매장을 활동 정지 처리하시겠습니까?` : `Suspend "${store.name}"?`)
                      )) {
                        toggleStoreStatus(store.id);
                      }
                    }}
                    className="imin-btn"
                    style={{
                      width: 'auto',
                      padding: '8px 16px',
                      borderRadius: 'var(--border-radius-md)',
                      backgroundColor: store.status === 'suspended' ? 'var(--accent-green)' : 'var(--accent-red)',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    {store.status === 'suspended'
                      ? (language === 'ko' ? '활동정지 해제' : 'Lift Suspension')
                      : (language === 'ko' ? '활동 정지' : 'Suspend Store')}
                  </button>

                  {/* 매장 삭제 버튼 */}
                  <button
                    onClick={() => {
                      if (window.confirm(
                        language === 'ko'
                          ? `⚠️ 정말로 "${store.name}" 매장을 삭제하시겠습니까?\n매장과 관련된 모든 적립 카드 및 트랜잭션 데이터가 함께 삭제됩니다.`
                          : `⚠️ Are you sure you want to delete "${store.name}"?\nAll associated cards and transactions will be permanently deleted.`
                      )) {
                        deleteStore(store.id);
                        setSelectedStoreDetailId(null);
                      }
                    }}
                    className="imin-btn"
                    style={{
                      width: 'auto',
                      padding: '8px 16px',
                      borderRadius: 'var(--border-radius-md)',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--accent-red)',
                      color: 'var(--accent-red)',
                      fontWeight: 600,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                    {language === 'ko' ? '매장 삭제' : 'Delete Store'}
                  </button>
                </div>

                <button
                  onClick={() => setSelectedStoreDetailId(null)}
                  className="imin-btn imin-btn-secondary"
                  style={{ width: 'auto', padding: '8px 20px', borderRadius: 'var(--border-radius-md)', cursor: 'pointer' }}
                >
                  닫기
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
