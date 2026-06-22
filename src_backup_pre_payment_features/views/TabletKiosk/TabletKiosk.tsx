import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { Camera, RotateCcw, AlertTriangle } from 'lucide-react';
import { playVoiceGuidance } from '../../utils/voice';

export const TabletKiosk: React.FC = () => {
  const { stores, generateQR, language, paymentRequests, approvePayment, rejectPayment, selectedStoreId } = useDatabase();
  
  // 상태 관리
  const [clickCount, setClickCount] = useState<number>(0);

  // 시크릿 클릭 타이머
  useEffect(() => {
    if (clickCount === 0) return;
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, [clickCount]);
  
  // 1. 적립 관련 상태
  const [scanStatus, setScanStatus] = useState<'scanning' | 'done'>('scanning');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showScreensaver, setShowScreensaver] = useState<boolean>(false);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const [stampsToAward, setStampsToAward] = useState<number>(1);

  // 실시간 결제 요청 알림용 상태
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const selectedStore = stores.find(s => s.id === selectedStoreId) || stores[0] || { id: 'store_id_1', name: 'ShareStamp 매장', category: 'cafe', pointRewardPer7Stamps: 5, currency: 'USD', earningIntervalMinutes: 60, ownerId: 'none' };

  // 대기 중인 사용 요청 조회
  const pendingRequests = paymentRequests.filter(r => r.storeId === selectedStoreId && r.status === 'pending');
  const activeRequest = pendingRequests[0];

  // 새 요청 수신 시 TTS (한글 모드에서도 항상 영어로 재생)
  useEffect(() => {
    if (activeRequest && activeRequest.id !== lastRequestId) {
      setLastRequestId(activeRequest.id);
      if (activeRequest.type === 'donation') {
        playVoiceGuidance('A new donation request has arrived.', 'en');
      } else {
        playVoiceGuidance('A new stamp cash usage request has arrived.', 'en');
      }
    }
  }, [activeRequest?.id, language]);

  // 다국어 번역 사전 정의
  const t = {
    title: language === 'ko' ? '스탬프 적립 Kiosk' : 'Stamp Accumulation Kiosk',
    
    // Earn Mode
    earnTitle: language === 'ko' ? '영수증을 카메라에 비춰주세요' : 'Please present receipt to the camera',
    earnDesc: language === 'ko' ? '출구 앞 영수증 인식 카메라가 자동으로 영수증을 분석합니다.' : 'Receipt recognition camera automatically analyzes your receipt.',
    earnStartBtn: language === 'ko' ? '영수증 스캔 시작 (시뮬레이션)' : 'Start Receipt Scan (Simulation)',
    earnScanning: language === 'ko' ? '영수증 분석 및 적립금 계산 중...' : 'Analyzing receipt & calculating stamps...',
    earnScanningDesc: language === 'ko' ? '인공지능이 영수증 유효성을 검증하고 있습니다.' : 'AI is validating the receipt authenticity.',
    earnDoneTitle: (count: number) => language === 'ko' ? `스탬프 ${count}개 적립 가능!` : `${count} stamps available to earn!`,
    earnDoneDesc: language === 'ko' ? '위 QR 코드를 폰 카메라로 스캔하여 적립받으세요.' : 'Scan the QR code below with your phone to claim stamps.',
    remainingTime: (sec: number) => language === 'ko' ? `남은 시간: ${sec}초` : `Time remaining: ${sec}s`,
    firstBtn: language === 'ko' ? '처음으로' : 'Reset Kiosk',
    simulateBtn: language === 'ko' ? '📱 회원 스마트폰으로 스캔 시뮬레이션 (자동 전환)' : '📱 Scan simulation with member phone (Auto switch)',
    scanTipTitle: language === 'ko' ? '💡 모바일 PWA 스캔 팁:' : '💡 Mobile PWA scan tip:',
    scanTipDesc: (token: string) => language === 'ko' 
      ? `모바일 뷰로 전환하신 뒤 본 QR 토큰(${token})으로 직접 적립받거나, 이 화면을 띄워놓고 모바일 화면에서 이 스탬프 카드 적립을 완료하실 수 있습니다.` 
      : `Switch to guest mobile PWA view and claim stamps with token (${token}), or keep this QR page open and scan it.`,
    expiredTitle: language === 'ko' ? 'QR 코드 유효시간이 만료되었습니다.' : 'QR code has expired.',
    retryBtn: language === 'ko' ? '다시 스캔하기' : 'Scan Again'
  };

  // QR 코드 카운트다운 타이머
  useEffect(() => {
    if (qrCountdown <= 0) {
      setQrToken(null);
      return;
    }
    const timer = setInterval(() => {
      setQrCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [qrCountdown]);

  // 유휴 시간 감지 및 스크린세이버 전환
  useEffect(() => {
    if (showScreensaver || scanStatus !== 'scanning' || isAnalyzing) return;

    const interval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTime;
      if (timeSinceLastActivity >= 15000) { // 15초 유휴 시 대기 화면 진입
        setShowScreensaver(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivityTime, showScreensaver, scanStatus, isAnalyzing]);

  // 터치/클릭 입력 감지 시 유휴 타이머 리셋
  useEffect(() => {
    const handleActivity = () => {
      setLastActivityTime(Date.now());
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('mousemove', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
    };
  }, []);

  const handleDismissScreensaver = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowScreensaver(false);
    setLastActivityTime(Date.now());
  };

  // 영수증 스캔 시뮬레이션
  const handleReceiptScanSimulate = () => {
    setIsAnalyzing(true);
    
    // 2초 뒤 분석 완료 및 QR 생성
    setTimeout(() => {
      setScanStatus('done');
      setIsAnalyzing(false);
      // 임의의 적립 도장수 (기본 1개, 혹은 결제 금액에 따라 무작위 1~3개)
      const stamps = Math.floor(Math.random() * 2) + 1; // 1 or 2 stamps
      setStampsToAward(stamps);
      
      const token = generateQR(selectedStoreId, stamps, 'receipt_photo_sim');
      setQrToken(token);
      setQrCountdown(10); // 10초 유효
    }, 2000);
  };

  const handleResetKiosk = () => {
    setScanStatus('scanning');
    setIsAnalyzing(false);
    setQrToken(null);
    setQrCountdown(0);
  };

  // 바코드 스캔 할인 기능 제거됨

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: '680px', maxWidth: '800px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>

      {/* --- 대기 화면 (스크린세이버) --- */}
      {showScreensaver && (() => {
        const FloatingScreensaver = () => {
          const containerRef = React.useRef<HTMLDivElement>(null);
          const boxRef = React.useRef<HTMLDivElement>(null);
          const rafRef = React.useRef<number>(0);
          const stateRef = React.useRef({
            x: 60, y: 60,           // px 위치 (초기값)
            vx: 0.55, vy: 0.38,     // px/프레임 기본 속도
            tick: 0
          });

          React.useEffect(() => {
            const animate = () => {
              const s = stateRef.current;
              const container = containerRef.current;
              const box = boxRef.current;
              if (!container || !box) {
                rafRef.current = requestAnimationFrame(animate);
                return;
              }

              s.tick++;

              // 속도 변조: sin 곡선으로 강→약→중→약 사이클 (약 8초 주기)
              const speedMod = 0.5 + 0.5 * Math.abs(Math.sin(s.tick * 0.008));
              s.x += s.vx * speedMod;
              s.y += s.vy * speedMod;

              // 실제 픽셀 크기로 경계 계산
              const cW = container.clientWidth;
              const cH = container.clientHeight;
              const bW = box.offsetWidth;
              const bH = box.offsetHeight;
              const maxX = cW - bW;
              const maxY = cH - bH;

              if (s.x <= 0 || s.x >= maxX) {
                s.vx *= -1;
                s.x = Math.max(0, Math.min(maxX, s.x));
              }
              if (s.y <= 0 || s.y >= maxY) {
                s.vy *= -1;
                s.y = Math.max(0, Math.min(maxY, s.y));
              }

              // DOM 직접 업데이트 → React 리렌더 없음 → 떨림 없음
              box.style.left = `${s.x}px`;
              box.style.top  = `${s.y}px`;

              rafRef.current = requestAnimationFrame(animate);
            };

            rafRef.current = requestAnimationFrame(animate);
            return () => cancelAnimationFrame(rafRef.current);
          }, []);

          return (
            <div
              ref={containerRef}
              onClick={handleDismissScreensaver}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: '#0b0b0f',
                zIndex: 99999,
                cursor: 'pointer',
                borderRadius: '28px',
                overflow: 'hidden',
                animation: 'fadeInKioskScreensaver 0.5s ease-out'
              }}
            >
              {/* 유영하는 컨텐츠 블록 */}
              <div
                ref={boxRef}
                style={{
                  position: 'absolute',
                  left: '60px',
                  top: '60px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  width: '320px',
                  alignItems: 'center',
                  textAlign: 'center',
                  color: '#ffffff',
                  willChange: 'left, top'
                }}
              >
                <h1 style={{ fontSize: '38px', fontWeight: 900, color: 'var(--primary-color)', margin: 0, letterSpacing: '-1.5px' }}>
                  ShareStamp
                </h1>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#FFB800', margin: 0, lineHeight: '1.35' }}>
                  "버려지는 스탬프로 따뜻한 기부를!"
                </h2>
                <p className="pulse-text" style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  지금 화면을 터치해 영수증을 스캔해 보세요.
                </p>
                <p style={{ fontSize: '12px', color: '#5e5e63', lineHeight: '1.6', margin: 0, fontWeight: 500 }}>
                  스캔 즉시 생성되는 QR코드를 휴대폰으로 촬영하시면<br />기부 스탬프가 적립됩니다.
                </p>
              </div>

              <style>{`
                @keyframes fadeInKioskScreensaver {
                  from { opacity: 0; } to { opacity: 1; }
                }
                .pulse-text {
                  animation: breathing 3s infinite ease-in-out;
                }
                @keyframes breathing {
                  0%, 100% { opacity: 0.35; }
                  50% { opacity: 1; }
                }
              `}</style>
            </div>
          );
        };
        return <FloatingScreensaver key="screensaver" />;
      })()}

      {/* 매장명 상단 중앙 정렬 (3번 클릭 시 관리자 설정 모달 트리거) */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
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
          style={{ 
            fontSize: '32px', 
            fontWeight: 850, 
            color: '#ffffff', 
            letterSpacing: '-0.5px', 
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          {selectedStore.name}
        </h1>
      </div>

      {/* 탭 내용 영역 (카메라 집중을 위한 검은색 배경) */}
      <div className="imin-card" style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '450px', width: '100%', boxSizing: 'border-box', backgroundColor: '#111115', border: '1px solid #222228' }}>
        
        {/* 고객 적립 모드 */}
        <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center', color: '#ffffff' }}>
          {scanStatus === 'scanning' && (
            <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', justifyContent: 'center' }}>
              {/* 세로로 긴 카메라 뷰파인더 영역 (항시 켜져 있는 스캐너 레이저 라인 애니메이션 적용) */}
              <div style={{ 
                width: '100%', 
                maxWidth: '300px',
                height: '480px',
                maxHeight: '70vh',
                borderRadius: '16px', 
                border: '2px solid var(--primary-color)',
                backgroundColor: 'rgba(95, 92, 230, 0.06)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                {/* 뷰파인더 코너 장식 */}
                <div style={{ position: 'absolute', top: '16px', left: '16px', width: '20px', height: '20px', borderLeft: '4px solid var(--primary-color)', borderTop: '4px solid var(--primary-color)' }} />
                <div style={{ position: 'absolute', top: '16px', right: '16px', width: '20px', height: '20px', borderRight: '4px solid var(--primary-color)', borderTop: '4px solid var(--primary-color)' }} />
                <div style={{ position: 'absolute', bottom: '16px', left: '16px', width: '20px', height: '20px', borderLeft: '4px solid var(--primary-color)', borderBottom: '4px solid var(--primary-color)' }} />
                <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '20px', height: '20px', borderRight: '4px solid var(--primary-color)', borderBottom: '4px solid var(--primary-color)' }} />

                {/* 빨간색 스캐닝 레이저 라인 애니메이션 (항시 작동) */}
                <div className="scanner-laser" style={{ 
                  position: 'absolute', 
                  left: 0, 
                  right: 0, 
                  height: '3px', 
                  backgroundColor: 'var(--accent-red)', 
                  boxShadow: '0 0 12px var(--accent-red)',
                  animation: 'scan-down 2s ease-in-out infinite'
                }} />

                {isAnalyzing ? (
                  <>
                    <div className="scanning-spinner" style={{ width: '56px', height: '56px', borderRadius: '50%', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary-color)', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 650, color: '#ffffff' }}>{t.earnScanning}</h3>
                      <p style={{ color: '#a0a0ab', fontSize: '14px', marginTop: '4px' }}>{t.earnScanningDesc}</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 중앙 카메라 아이콘 */}
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', marginBottom: '16px' }}>
                      <Camera size={36} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#ffffff' }}>{t.earnTitle}</h3>
                      <p style={{ color: '#a0a0ab', fontSize: '14px', maxWidth: '300px', margin: '0 auto', lineHeight: 1.4 }}>{t.earnDesc}</p>
                    </div>
                  </>
                )}

                <style>{`
                  @keyframes scan-down {
                    0% { top: 16px; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: calc(100% - 16px); opacity: 0; }
                  }
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>

              {!isAnalyzing && (
                <button 
                  onClick={handleReceiptScanSimulate}
                  className="imin-btn imin-btn-primary" 
                  style={{ width: '100%', maxWidth: '280px', padding: '14px', fontSize: '15px', fontWeight: 700 }}
                >
                  {t.earnStartBtn}
                </button>
              )}
            </div>
          )}

          {scanStatus === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
              {qrToken ? (
                <>
                  <div style={{ border: '12px solid #1F1F24', padding: '16px', borderRadius: '24px', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-md)' }}>
                    {/* 가상 QR 코드 그래픽 */}
                    <div style={{ width: '180px', height: '180px', display: 'flex', flexWrap: 'wrap', gap: '4px', opacity: 0.9 }}>
                      {Array.from({ length: 144 }).map((_, i) => (
                        <div 
                          key={i} 
                          style={{ 
                            width: '11px', 
                            height: '11px', 
                            backgroundColor: (i * 7 + 13) % 5 === 0 || (i > 20 && i < 40) || (i > 80 && i < 110) ? '#1F1F24' : '#ffffff' 
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-green)' }}>{t.earnDoneTitle(stampsToAward)}</h4>
                    <p style={{ color: '#a0a0ab', fontSize: '14px', marginTop: '6px' }}>{t.earnDoneDesc}</p>
                  </div>

                  {/* 카운트다운 타이머 바 */}
                  <div style={{ width: '100%', maxWidth: '240px', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{ width: `${(qrCountdown / 10) * 100}%`, height: '100%', backgroundColor: 'var(--accent-red)', transition: 'width 1s linear' }} />
                  </div>
                  
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-red)' }}>{t.remainingTime(qrCountdown)}</span>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button onClick={handleResetKiosk} className="imin-btn imin-btn-secondary" style={{ padding: '10px 20px', fontSize: '14px' }}>
                      <RotateCcw size={16} style={{ marginRight: '6px' }} />
                      {t.firstBtn}
                    </button>
                    <button 
                      onClick={() => {
                        localStorage.setItem('sharestamp_pending_qr_token', qrToken);
                        window.location.hash = '#/customer';
                        window.dispatchEvent(new CustomEvent('check-pending-qr'));
                      }}
                      className="imin-btn imin-btn-primary" 
                      style={{ padding: '10px 20px', fontSize: '14px', backgroundColor: 'var(--primary-color)' }}
                    >
                      {t.simulateBtn}
                    </button>
                  </div>

                  {/* 빠른 테스트 모의 스캔용 정보 노출 */}
                  <div style={{ marginTop: '20px', padding: '12px', border: '1px dashed var(--primary-color)', borderRadius: 'var(--border-radius-md)', backgroundColor: 'var(--primary-light)', fontSize: '13px', color: 'var(--primary-color)' }}>
                    <strong>{t.scanTipTitle}</strong> {t.scanTipDesc(qrToken)}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ color: 'var(--accent-red)' }}>
                    <AlertTriangle size={48} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{t.expiredTitle}</h3>
                  <button onClick={handleResetKiosk} className="imin-btn imin-btn-primary" style={{ maxWidth: '200px' }}>
                    {t.retryBtn}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* --- 스탬프 캐시 사용 승인 요청 실시간 팝업 --- */}
      {activeRequest && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(31, 31, 36, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '24px'
        }}>
          <div className="imin-card" style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            textAlign: 'center',
            border: '2px solid var(--primary-color)',
            animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <style>{`
              @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-color)',
                fontSize: '28px'
              }}>
                {activeRequest.type === 'donation' ? '🧡' : '💰'}
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {activeRequest.type === 'donation'
                  ? (language === 'ko' ? '기부 단체 기부 요청' : 'Charity Donation Request')
                  : (language === 'ko' ? '스탬프 캐시 사용 요청' : 'Stamp Cash Usage Request')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                {activeRequest.type === 'donation'
                  ? (language === 'ko' ? '고객이 기부 단체로의 캐시 기부를 요청했습니다.' : 'A customer requested a donation to charity.')
                  : (language === 'ko' ? '고객이 스탬프 캐시 할인을 요청했습니다.' : 'A customer requested stamp cash discount.')}
              </p>
            </div>

            {/* 요청 세부 정보 */}
            <div style={{
              backgroundColor: 'var(--background-color)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{language === 'ko' ? '요청 고객' : 'Customer'}</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {activeRequest.userName.replace('회원_', language === 'ko' ? '회원 ' : 'Member ')} ({activeRequest.userNickname})
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{language === 'ko' ? '요청 매장' : 'Store'}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedStore.name}</span>
              </div>
              {activeRequest.type === 'donation' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{language === 'ko' ? '기부 수신처' : 'Charity'}</span>
                  <strong style={{ color: 'var(--accent-purple)' }}>{activeRequest.nonProfitName}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {activeRequest.type === 'donation' 
                    ? (language === 'ko' ? '기부 신청 금액' : 'Donation Amount')
                    : (language === 'ko' ? '결제 할인 금액' : 'Discount Amount')}
                </span>
                <strong style={{ fontSize: '26px', fontWeight: 900, color: 'var(--primary-color)' }}>
                  ${activeRequest.amount.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                onClick={() => rejectPayment(activeRequest.id)}
                className="imin-btn imin-btn-outline"
                style={{
                  flex: 1,
                  borderColor: 'var(--accent-red)',
                  color: 'var(--accent-red)',
                  fontWeight: 700,
                  fontSize: '16px',
                  padding: '14px'
                }}
              >
                {language === 'ko' ? '거절' : 'Reject'}
              </button>
              <button
                onClick={() => approvePayment(activeRequest.id)}
                className="imin-btn imin-btn-primary"
                style={{
                  flex: 1,
                  fontWeight: 700,
                  fontSize: '16px',
                  padding: '14px',
                  boxShadow: '0 4px 12px rgba(95, 92, 230, 0.3)'
                }}
              >
                {language === 'ko' ? '승인' : 'Approve'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 우하단 설정 기어 및 모달 제거됨 */}
    </div>
  );
};
