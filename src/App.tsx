import React, { useState } from 'react';
import { DatabaseProvider, useDatabase } from './context/DatabaseContext';
import { CustomerPWA } from './views/CustomerPWA/CustomerPWA';
import { TabletKiosk } from './views/TabletKiosk/TabletKiosk';
import { OwnerDashboard } from './views/OwnerDashboard/OwnerDashboard';
import { SuperAdmin } from './views/SuperAdmin/SuperAdmin';
import { LandingPage } from './views/LandingPage/LandingPage';
import { StoreMiniHome } from './views/StoreMiniHome/StoreMiniHome';
import { playVoiceGuidance } from './utils/voice';
import { 
  Settings, Key, Tablet, Monitor, Lock, X
} from 'lucide-react';

const parseHashRoute = (): { route: 'customer' | 'store' | 'admin' | 'home' | 'store-home'; mode: 'customer' | 'kiosk' | 'owner' | 'admin' | 'home' | 'store-home' } => {
  const hash = window.location.hash.toLowerCase();
  
  if (hash.includes('store-home') || hash.includes('/store-home')) {
    return { route: 'store-home', mode: 'store-home' };
  }
  if (hash.includes('/admin') || hash.includes('/hq') || hash === '#admin' || hash === '#hq') {
    return { route: 'admin', mode: 'admin' };
  }
  if (hash.includes('/store') || hash.includes('/kiosk') || hash.includes('/owner') || hash === '#store' || hash === '#kiosk' || hash === '#owner') {
    const mode = (hash.includes('owner') || hash === '#owner' || hash.includes('store') || hash === '#store') ? 'owner' : 'kiosk';
    return { route: 'store', mode };
  }
  if (hash.includes('/customer') || hash === '#customer') {
    return { route: 'customer', mode: 'customer' };
  }
  return { route: 'home', mode: 'home' };
};

const MainAppContent: React.FC = () => {
  const {
    resetDatabase,
    importDatabase,
    exportDatabase,
    stores,
    language,
    setLanguage,
    selectedStoreId,
    setSelectedStoreId,
    setCustomerSelectedStoreId,
    setKioskSelectedStoreId,
    setOwnerSelectedStoreId,
    ownerPassword,
    setOwnerPassword,
    currentOwner
  } = useDatabase();

  const t = {
    settingsTitle: language === 'ko' ? '매장 설정 및 디바이스 전환' : 'Store Settings & Device Switcher',
    authDesc: language === 'ko' ? '안전한 권한 제어를 위해 매장 비밀번호를 입력해 주세요.' : 'Please enter the store password for secure control.',
    storePassword: language === 'ko' ? '매장 비밀번호' : 'Store Password',
    passwordPlaceholder: language === 'ko' ? '비밀번호 입력' : 'Enter password',
    approveBtn: language === 'ko' ? '매장 권한 승인' : 'Approve Store Access',
    passwordGuideTitle: language === 'ko' ? '💡 매장 비밀번호 안내:' : '💡 Store Password Information:',
    passwordGuideDesc: (pwd: string) => language === 'ko' 
      ? `* ${pwd} 입력 시 태블릿 Kiosk와 사장님 POS 간의 전환 권한이 승인됩니다.`
      : `* Entering ${pwd} authorizes switching between Kiosk and Owner POS.`,
    authStatusLabel: language === 'ko' ? '현재 인증 상태' : 'Current Auth Status',
    authApproved: (pwd: string) => language === 'ko' 
      ? `🔓 매장 관리자 승인완료 (${pwd})`
      : `🔓 Store Admin Approved (${pwd})`,
    selectDeviceLabel: language === 'ko' ? '매장 디바이스 선택' : 'Select Store Device',
    kioskTitle: language === 'ko' ? '2-1. 계산대 태블릿 Kiosk' : '2-1. Checkout Tablet Kiosk',
    kioskDesc: language === 'ko' ? '스태프/점원용 결제 적립 및 OTP 수신 화면' : 'Staff/clerk screen for payment savings and OTP reception',
    ownerTitle: language === 'ko' ? '2-2. 매장 사장님 포스 (PC/Tablet)' : '2-2. Owner POS Dashboard (PC/Tablet)',
    ownerDesc: language === 'ko' ? '실시간 캐시 승인, 정산 통계 대장 및 고객 조회' : 'Real-time cash approval, settlement analytics, & customer lookup',
    selectStoreLabel: language === 'ko' ? '기기 연결 매장 지정' : 'Assign Connected Store',
    selectLanguageLabel: language === 'ko' ? '화면 표시 언어 선택' : 'Select Display Language',
    changePasswordLabel: language === 'ko' ? '매장 설정 비밀번호 변경' : 'Change Store Settings Password',
    currentPasswordLabel: language === 'ko' ? '현재 설정된 비밀번호:' : 'Currently set password:',
    newPasswordPlaceholder: language === 'ko' ? '새 비밀번호 입력' : 'Enter new password',
    changeBtn: language === 'ko' ? '변경' : 'Change',
    changeSuccess: language === 'ko' ? '✓ 비밀번호가 성공적으로 변경되었습니다.' : '✓ Password changed successfully.',
    lockNowBtn: language === 'ko' ? '권한 즉시 잠금' : 'Lock Access Now',
    resetDbBtn: language === 'ko' ? 'DB 완전 리셋' : 'Full DB Reset'
  };
  
  // 라우트 상태 및 시뮬레이터 모드 상태
  const initialRouteInfo = parseHashRoute();
  const [route, setRoute] = useState<'customer' | 'store' | 'admin' | 'home' | 'store-home'>(initialRouteInfo.route);
  const [simulatorMode, setSimulatorMode] = useState<'kiosk' | 'customer' | 'owner' | 'admin' | 'home' | 'store-home'>(() => {
    if (initialRouteInfo.route === 'store' && !currentOwner) {
      return 'owner';
    }
    return initialRouteInfo.mode;
  });
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // open-store-settings 커스텀 이벤트 리스너 등록
  React.useEffect(() => {
    const handleOpenSettings = () => {
      setShowSettingsModal(true);
      setAuthError(null);
      if (route !== 'admin') {
        setUnlockedRole('none');
      }
    };
    window.addEventListener('open-store-settings', handleOpenSettings);
    return () => window.removeEventListener('open-store-settings', handleOpenSettings);
  }, [route]);

  // lock-simulator-role 커스텀 이벤트 리스너 등록
  React.useEffect(() => {
    const handleLockRole = () => {
      setUnlockedRole('none');
      if (currentOwner) {
        setSimulatorMode('kiosk');
        window.location.hash = '#/kiosk';
      } else {
        setSimulatorMode('owner');
        window.location.hash = '#/store';
      }
    };
    window.addEventListener('lock-simulator-role', handleLockRole);
    return () => window.removeEventListener('lock-simulator-role', handleLockRole);
  }, [currentOwner]);

  // 사장님 로그아웃 또는 비인증 상태에서 직접 키오스크 모드 진입 제한 리디렉션
  React.useEffect(() => {
    if (!currentOwner) {
      setUnlockedRole('none');
      if (route === 'store') {
        setSimulatorMode('owner');
        if (window.location.hash.toLowerCase().includes('kiosk')) {
          window.location.hash = '#/store';
        }
      }
    }
  }, [currentOwner, route]);
  
  // 비밀번호 인증 관련
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [unlockedRole, setUnlockedRole] = useState<'none' | 'owner' | 'hq'>(() => {
    return initialRouteInfo.route === 'admin' ? 'hq' : 'none';
  });
  const [authError, setAuthError] = useState<string | null>(null);

  const closeSettings = () => {
    setShowSettingsModal(false);
    if (route !== 'admin') {
      setUnlockedRole('none');
    }
  };

  // 비밀번호 변경용 상태
  const [newOwnerPasswordInput, setNewOwnerPasswordInput] = useState<string>('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<boolean>(false);

  // URL 해시 변경 감지 및 모드 적용
  React.useEffect(() => {
    const handleHashChange = () => {
      const info = parseHashRoute();
      setRoute(info.route);
      
      if (info.route === 'store' && !currentOwner) {
        setSimulatorMode('owner');
        if (window.location.hash.toLowerCase().includes('kiosk')) {
          window.location.hash = '#/store';
        }
      } else {
        setSimulatorMode(info.mode);
      }
      
      if (info.route === 'admin') {
        setUnlockedRole('hq');
      } else {
        setUnlockedRole('none');
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentOwner]);

  // 비밀번호 검증 (매장 전용)
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (passwordInput === ownerPassword) {
      setUnlockedRole('owner');
      setPasswordInput('');
      playVoiceGuidance("Password verified. Store settings activated.");
    } else {
      setAuthError(language === 'ko' ? `올바르지 않은 비밀번호입니다. (점포: ${ownerPassword})` : `Incorrect password. (Store: ${ownerPassword})`);
      playVoiceGuidance("Incorrect password.");
    }
  };

  const handleRoleLock = () => {
    setUnlockedRole('none');
    setSimulatorMode('kiosk');
    playVoiceGuidance("Store access locked.");
  };

  const handleStoreAssignmentChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    setCustomerSelectedStoreId(storeId);
    setKioskSelectedStoreId(storeId);
    setOwnerSelectedStoreId(storeId);
  };

  const switchStoreDevice = (mode: 'kiosk' | 'owner') => {
    setSimulatorMode(mode);
    window.location.hash = mode === 'kiosk' ? '#/kiosk' : '#/store';
    closeSettings();
  };

  // 1. 랜딩 페이지 홈 라우트 뷰
  if (route === 'home') {
    return <LandingPage />;
  }

  // 2. 회원 스마트폰 PWA 단독 라우트 뷰
  if (route === 'customer') {
    return (
      <div className="customer-pwa-container">
        {/* 모바일 폰 프레임 */}
        <div className="phone-frame-wrapper">
          <div className="phone-notch" />
          <div className="phone-screen">
            {/* 노치 높이만큼 상단 패딩 부여 */}
            <div className="phone-notch-spacer" style={{ height: '24px', backgroundColor: '#ffffff' }} />
            <CustomerPWA />
          </div>
        </div>
      </div>
    );
  }

  // 2-3. 매장 미니홈피 단독 라우트 뷰
  if (route === 'store-home') {
    return (
      <div className="customer-pwa-container">
        {/* 모바일 폰 프레임 */}
        <div className="phone-frame-wrapper">
          <div className="phone-notch" />
          <div className="phone-screen">
            {/* 노치 높이만큼 상단 패딩 부여 */}
            <div className="phone-notch-spacer" style={{ height: '24px', backgroundColor: '#ffffff' }} />
            <StoreMiniHome />
          </div>
        </div>
      </div>
    );
  }

  // 2. 본사 종합 관리자 단독 라우트 뷰
  if (route === 'admin') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F2F2F7', padding: '24px' }}>
        <SuperAdmin />
      </div>
    );
  }

  // 3. 매장 환경 (키오스크 <-> 사장님 POS 비밀번호 스위칭) 라우트 뷰
  return (
    <div className="kiosk-pos-wrapper">
      
      {/* 각 역할 디바이스 프레임 렌더러 */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        {simulatorMode === 'kiosk' ? (
          /* 태블릿 키오스크 프레임 */
          <div className="tablet-frame-wrapper">
            <div className="tablet-screen">
              <TabletKiosk />
            </div>
          </div>
        ) : (
          /* 사장님 포스기 PC 프레임 */
          <div className="pc-frame-wrapper">
            <div className="pc-window-header no-print">
              <div className="pc-dot pc-dot-red" />
              <div className="pc-dot pc-dot-yellow" />
              <div className="pc-dot pc-dot-green" />
              <span style={{ fontSize: '12px', color: '#666', fontWeight: 600, marginLeft: '8px' }}>
                Store Admin Terminal - POS (PC/Tablet)
              </span>
            </div>
            <div className="pc-screen" style={{ padding: 0 }}>
              <OwnerDashboard />
            </div>
          </div>
        )}
      </div>

      {/* 시뮬레이터 잠금/해제 및 모드전환 설정 모달 */}
      {showSettingsModal && (
        <div 
          className="bottom-sheet-overlay" 
          onClick={closeSettings}
          style={{ alignItems: 'center' }}
        >
          <div 
            className="imin-card" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              width: '90%', 
              maxWidth: '440px', 
              padding: '28px', 
              borderRadius: 'var(--border-radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative'
            }}
          >
            <button 
              onClick={closeSettings}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {/* 화면 표시 언어 선택 (우측 상단 소형 버튼으로 이동) */}
            <div style={{ position: 'absolute', top: '16px', right: '48px', display: 'flex', gap: '4px' }}>
              <button 
                onClick={() => setLanguage('ko')}
                style={{
                  padding: '3px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: language === 'ko' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  backgroundColor: language === 'ko' ? 'var(--primary-light)' : 'transparent',
                  border: language === 'ko' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  lineHeight: '1.2'
                }}
              >
                KO
              </button>
              <button 
                onClick={() => setLanguage('en')}
                style={{
                  padding: '3px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: language === 'en' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  backgroundColor: language === 'en' ? 'var(--primary-light)' : 'transparent',
                  border: language === 'en' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  lineHeight: '1.2'
                }}
              >
                EN
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Settings size={22} style={{ color: 'var(--primary-color)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>{t.settingsTitle}</h3>
            </div>

            {/* 역할 잠금 여부에 따른 제어 영역 */}
            {unlockedRole !== 'owner' ? (
              /* 비밀번호 입력 양식 */
              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <Lock size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 8px auto' }} />
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {t.authDesc}
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.storePassword}</label>
                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <Key size={16} style={{ position: 'absolute', left: '8px', top: '14px', color: 'var(--text-secondary)' }} />
                    <input 
                      type="password" 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className="imin-input"
                      style={{ paddingLeft: '32px' }}
                      required
                    />
                  </div>
                </div>

                {authError && (
                  <span style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600 }}>{authError}</span>
                )}

                <button type="submit" className="imin-btn imin-btn-primary">
                  {t.approveBtn}
                </button>

                <div style={{ padding: '12px', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--background-color)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong>{t.passwordGuideTitle}</strong><br/>
                  {t.passwordGuideDesc(ownerPassword)}
                </div>
              </form>
            ) : (
              /* 해제 성공 후 모드 스위처 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.authStatusLabel}</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)', marginTop: '4px' }}>
                    {t.authApproved(ownerPassword)}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.selectDeviceLabel}</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                    
                    <button 
                      onClick={() => switchStoreDevice('kiosk')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: simulatorMode === 'kiosk' ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Tablet size={20} style={{ color: 'var(--primary-color)' }} />
                      <div>
                        <strong style={{ fontSize: '14px', display: 'block' }}>{t.kioskTitle}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.kioskDesc}</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => switchStoreDevice('owner')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: simulatorMode === 'owner' ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <Monitor size={20} style={{ color: 'var(--primary-color)' }} />
                      <div>
                        <strong style={{ fontSize: '14px', display: 'block' }}>{t.ownerTitle}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.ownerDesc}</span>
                      </div>
                    </button>

                  </div>
                </div>

                {/* 매장 지정 셀렉트 */}
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.selectStoreLabel}</label>
                  <select 
                    value={selectedStoreId} 
                    onChange={(e) => handleStoreAssignmentChange(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '14px', fontWeight: 600, marginTop: '6px', cursor: 'pointer' }}
                  >
                    {stores.filter(s => !s.name.includes('호점')).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>



                {/* 매장 비밀번호 설정 */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.changePasswordLabel}</label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span>{t.currentPasswordLabel}</span>
                    <strong style={{ color: 'var(--primary-color)', letterSpacing: '1px' }}>{ownerPassword}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <input 
                      type="password" 
                      value={newOwnerPasswordInput}
                      onChange={(e) => {
                        setNewOwnerPasswordInput(e.target.value);
                        setPasswordChangeSuccess(false);
                      }}
                      placeholder={t.newPasswordPlaceholder}
                      className="imin-input"
                      style={{ flex: 1, padding: '10px 12px', fontSize: '13px' }}
                    />
                    <button 
                      onClick={() => {
                        if (!newOwnerPasswordInput.trim()) return;
                        setOwnerPassword(newOwnerPasswordInput.trim());
                        setNewOwnerPasswordInput('');
                        setPasswordChangeSuccess(true);
                        playVoiceGuidance("Password changed successfully.");
                        setTimeout(() => setPasswordChangeSuccess(false), 3000);
                      }}
                      className="imin-btn imin-btn-primary"
                      style={{ width: 'auto', padding: '10px 16px', fontSize: '13px', fontWeight: 700 }}
                    >
                      {t.changeBtn}
                    </button>
                  </div>
                  {passwordChangeSuccess && (
                    <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600, marginTop: '4px' }}>
                      {t.changeSuccess}
                    </div>
                  )}
                </div>

                {/* 데이터 백업/가져오기 (데이터 동기화) */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {language === 'ko' ? '데이터 기기간 동기화 (백업/복구)' : 'Data Sync Between Devices (Backup/Restore)'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => {
                        const dbData = exportDatabase();
                        const blob = new Blob([dbData], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `sharestamp_db_backup_${Date.now()}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        playVoiceGuidance("Database backup file downloaded.");
                      }}
                      className="imin-btn imin-btn-secondary"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '12.5px', fontWeight: 700 }}
                    >
                      {language === 'ko' ? '내보내기 (Export)' : 'Export DB'}
                    </button>
                    <label 
                      className="imin-btn imin-btn-outline"
                      style={{ 
                        flex: 1, 
                        padding: '8px 12px', 
                        fontSize: '12.5px', 
                        fontWeight: 700, 
                        textAlign: 'center', 
                        cursor: 'pointer',
                        borderColor: 'var(--primary-color)',
                        color: 'var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {language === 'ko' ? '가져오기 (Import)' : 'Import DB'}
                      <input 
                        type="file" 
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const txt = event.target?.result as string;
                            if (txt) {
                              const res = importDatabase(txt);
                              if (res.success) {
                                alert(language === 'ko' ? '데이터베이스를 성공적으로 동기화했습니다!' : 'Database successfully imported/synced!');
                                closeSettings();
                              } else {
                                alert(res.message);
                              }
                            }
                          };
                          reader.readAsText(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={handleRoleLock} className="imin-btn imin-btn-secondary" style={{ flex: 1, padding: '10px', fontSize: '14px' }}>
                    {t.lockNowBtn}
                  </button>
                  <button 
                    onClick={() => { resetDatabase(); closeSettings(); }}
                    className="imin-btn imin-btn-outline" 
                    style={{ flex: 1, padding: '10px', fontSize: '14px', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                  >
                    {t.resetDbBtn}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <DatabaseProvider>
      <MainAppContent />
    </DatabaseProvider>
  );
}

export default App;
