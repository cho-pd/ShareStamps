import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { RotateCcw, AlertTriangle, Lock, X, CheckCircle2, Maximize2, Minimize2 } from 'lucide-react';
import { playVoiceGuidance } from '../../utils/voice';

interface FloatingScreensaverProps {
  onDismiss: (e: React.MouseEvent) => void;
}

const FloatingScreensaver: React.FC<FloatingScreensaverProps> = ({ onDismiss }) => {
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
      onClick={onDismiss}
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
          gap: '12px',
          width: '320px',
          alignItems: 'center',
          textAlign: 'center',
          color: '#ffffff',
          willChange: 'left, top',
          padding: '24px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
        }}
      >
        <img 
          src="/apple-touch-icon.png" 
          alt="ShareStamps Icon" 
          style={{ 
            width: '84px', 
            height: '84px', 
            borderRadius: '20px', 
            marginBottom: '6px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)',
            objectFit: 'contain',
            border: '2px solid rgba(255, 255, 255, 0.1)'
          }} 
        />
        <h1 style={{ fontSize: '36px', fontWeight: 900, color: 'var(--primary-color)', margin: 0, letterSpacing: '-1.5px', lineHeight: '1.1' }}>
          ShareStamps
        </h1>
        <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#FFB800', margin: 0, lineHeight: '1.35', marginTop: '4px' }}>
          "버려지는 스탬프로 따뜻한 기부를!"
        </h2>
        <p className="pulse-text" style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', margin: 0, marginTop: '4px' }}>
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

export const TabletKiosk: React.FC = () => {
  const { stores, generateQR, language, paymentRequests, approvePayment, rejectPayment, kioskSelectedStoreId: selectedStoreId, users, giftCards, ownerPassword, receiptScans } = useDatabase();
  
  // 전체화면 상태 및 함수
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    const root = document.documentElement;
    const isCurrentlyFs = root.classList.contains('kiosk-fullscreen-active');

    if (!isCurrentlyFs) {
      root.classList.add('kiosk-fullscreen-active');
      setIsFullscreen(true);
      
      // HTML5 네이티브 전체화면 시도 (미지원 브라우저는 커스텀 CSS 강제 전체화면으로 동작)
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(() => {});
      } else if ((root as any).webkitRequestFullscreen) {
        (root as any).webkitRequestFullscreen();
      }
    } else {
      root.classList.remove('kiosk-fullscreen-active');
      setIsFullscreen(false);
      
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = !!document.fullscreenElement;
      const root = document.documentElement;
      
      if (isNativeFs) {
        root.classList.add('kiosk-fullscreen-active');
        setIsFullscreen(true);
      } else if (!document.fullscreenElement && !isNativeFs) {
        // Esc 키 등으로 네이티브 전체화면을 빠져나온 경우 커스텀 클래스도 제거
        root.classList.remove('kiosk-fullscreen-active');
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 상태 관리
  const [clickCount, setClickCount] = useState<number>(0);
  const [showKioskPasscodeModal, setShowKioskPasscodeModal] = useState<boolean>(false);
  const [kioskPasscodeInput, setKioskPasscodeInput] = useState<string>('');
  const [kioskPasscodeError, setKioskPasscodeError] = useState<string | null>(null);

  const handleKioskPasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kioskPasscodeInput === ownerPassword) {
      setShowKioskPasscodeModal(false);
      setKioskPasscodeInput('');
      setKioskPasscodeError(null);
      // 사장모드로 전환
      window.location.hash = '#/store';
    } else {
      setKioskPasscodeError(language === 'ko' ? '비밀번호가 올바르지 않습니다.' : 'Incorrect password.');
    }
  };

  // 진짜 카메라 연동을 위한 상태 및 Ref
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStream(mediaStream);
    } catch (err) {
      console.error("Camera access error:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
  };

  // 기프트 카드 잔액 조회 모드 상태 추가
  const [kioskMode] = useState<'earn' | 'balance'>('earn');
  const [balancePhoneInput, setBalancePhoneInput] = useState<string>('01055556666'); // 디폴트 시뮬레이션 번호
  const [balanceSearchResults, setBalanceSearchResults] = useState<any[] | null>(null);
  const [balanceSearchCustomer, setBalanceSearchCustomer] = useState<any | null>(null);
  const [balanceCountdown, setBalanceCountdown] = useState<number>(0);
  const [isSearchingBalance, setIsSearchingBalance] = useState<boolean>(false);

  const handleResetBalanceSearch = () => {
    setBalanceSearchResults(null);
    setBalanceSearchCustomer(null);
    setBalanceCountdown(0);
    setIsSearchingBalance(false);
    setCapturedImage(null);
  };

  const handleBalanceSearch = (phoneNumber: string) => {
    setIsSearchingBalance(true);
    
    // 1.2초 뒤 조회 시뮬레이션 완료
    setTimeout(() => {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const customer = users.find(u => u.phoneNumber.replace(/[^0-9]/g, '') === cleanPhone);
      
      if (customer) {
        const activeCards = giftCards.filter(
          gc => gc.userId === customer.id && gc.storeId === selectedStoreId && gc.status === 'active'
        );
        setBalanceSearchCustomer(customer);
        setBalanceSearchResults(activeCards);
        setBalanceCountdown(30); // 30초 동안 결과 표시
        
        playVoiceGuidance(
          language === 'ko' 
            ? `${customer.nickname} 고객님의 기프트 카드 정보를 조회했습니다.` 
            : `Retrieved gift card information for customer ${customer.nickname}.`,
          language
        );
      } else {
        alert(language === 'ko' ? '등록되지 않은 고객 번호입니다.' : 'No customer registered with this phone number.');
        handleResetBalanceSearch();
      }
      setIsSearchingBalance(false);
    }, 1200);
  };

  // 잔액 조회 자동 닫기 타이머
  useEffect(() => {
    if (balanceCountdown <= 0) {
      if (balanceSearchResults !== null) {
        handleResetBalanceSearch();
      }
      return;
    }
    const timer = setInterval(() => {
      setBalanceCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [balanceCountdown, balanceSearchResults]);

  // 시크릿 클릭 타이머
  useEffect(() => {
    if (clickCount === 0) return;
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 1500);
    return () => clearTimeout(timer);
  }, [clickCount]);

  // 1. 적립 관련 상태
  const [scanStatus, setScanStatus] = useState<'scanning' | 'done' | 'success'>('scanning');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showScreensaver, setShowScreensaver] = useState<boolean>(false);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const [stampsToAward, setStampsToAward] = useState<number>(1);

  // 실시간 결제 요청 알림용 상태
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  // 카메라 라이프사이클 관리
  useEffect(() => {
    const shouldActive = !showScreensaver && (
                          (kioskMode === 'earn' && scanStatus === 'scanning') || 
                          (kioskMode === 'balance' && balanceSearchResults === null)
                         );
    
    if (shouldActive) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [kioskMode, scanStatus, balanceSearchResults, showScreensaver]);

  // 비디오 요소와 스트림 연결
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef.current]);

  const selectedStore = stores.find(s => s.id === selectedStoreId) || stores[0] || { id: 'store_id_1', name: 'ShareStamps 매장', category: 'cafe', pointRewardPer7Stamps: 5, currency: 'USD', earningIntervalMinutes: 60, ownerId: 'none' };

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
    earnStartBtn: language === 'ko' ? '📷 영수증 촬영 및 스탬프 적립' : '📷 Capture Receipt & Earn Stamps',
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
      if (timeSinceLastActivity >= 30000) { // 30초 유휴 시 대기 화면 진입
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

  // 스캔 상태가 scanning으로 복귀할 때 유휴 타이머 시작 시점을 강제로 갱신 (스크린세이버 조기 전환 방지)
  useEffect(() => {
    if (scanStatus === 'scanning') {
      setLastActivityTime(Date.now());
    }
  }, [scanStatus]);

  // 스캔 성공(적립 완료) 실시간 감지
  useEffect(() => {
    if (!qrToken || scanStatus !== 'done') return;

    const scan = receiptScans.find(s => s.qrToken === qrToken);
    if (scan && scan.status === 'claimed') {
      // 적립 성공 상태로 전환
      setScanStatus('success');
      setQrCountdown(0);
      setQrToken(null);
      
      // 음성 안내
      playVoiceGuidance(
        language === 'ko' ? "스탬프 적립이 완료되었습니다. 감사합니다." : "Stamp earned successfully. Thank you.",
        language
      );

      // 5초 후 자동 리셋하여 카메라 화면으로 복귀
      const timer = setTimeout(() => {
        handleResetKiosk();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [receiptScans, qrToken, scanStatus]);

  // QR 만료 화면 노출 시 5초 후 자동으로 카메라 모드 복귀
  useEffect(() => {
    if (scanStatus === 'done' && !qrToken) {
      const timer = setTimeout(() => {
        handleResetKiosk();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [scanStatus, qrToken]);

  const handleDismissScreensaver = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowScreensaver(false);
    setLastActivityTime(Date.now());
  };

  // 영수증 진짜 카메라 촬영 및 스탬프 적립
  const handleReceiptScan = () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setCapturedImage(canvas.toDataURL('image/jpeg'));
      }
    }

    setIsAnalyzing(true);
    
    // 3초 뒤 분석 완료 및 QR 생성 (요청 사항: 3초 스캔 분석 및 스탬프 1개 적립)
    setTimeout(() => {
      setScanStatus('done');
      setIsAnalyzing(false);
      setCapturedImage(null);
      
      const stamps = 1; // 스탬프 1개 고정 적립
      setStampsToAward(stamps);
      
      const token = generateQR(selectedStoreId, stamps, 'receipt_photo_real');
      setQrToken(token);
      setQrCountdown(30); // 유효 시간 30초로 설정
    }, 3000);
  };

  const handleResetKiosk = () => {
    setScanStatus('scanning');
    setIsAnalyzing(false);
    setQrToken(null);
    setQrCountdown(0);
    setLastActivityTime(Date.now());
  };

  // 바코드 스캔 할인 기능 제거됨

  if (selectedStore.status === 'suspended') {
    return (
      <div style={{ position: 'relative', height: '100%', minHeight: '680px', maxWidth: '800px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' }}>
        <div style={{
          width: '100%',
          padding: '48px 24px',
          borderRadius: '28px',
          backgroundColor: '#0b0b0f',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
          gap: '20px'
        }}>
          <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#FF4D4F', margin: 0 }}>
            {language === 'ko' ? '서비스 일시 중단' : 'Service Suspended'}
          </h2>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#E4E4E7', lineHeight: 1.6, margin: 0 }}>
            {language === 'ko'
              ? `현재 "${selectedStore.name}" 매장은 활동 정지 상태입니다.`
              : `"${selectedStore.name}" is currently suspended.`}
            <br />
            {language === 'ko' ? '이용에 불편을 드려 죄송합니다. 본사로 문의해 주세요.' : 'Please contact HQ for assistance.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tablet-kiosk-container">

      {/* 전체화면 토글 버튼 (크기를 키우고 좌측 상단으로 이동) */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "전체화면 종료" : "전체화면"}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: '1.5px solid rgba(255, 255, 255, 0.25)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity: 0.75,
          transition: 'all 0.2s ease',
          zIndex: 10000000,
          backdropFilter: 'blur(4px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.75'}
      >
        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>

      {/* --- 대기 화면 (스크린세이버) --- */}
      {showScreensaver && (
        <FloatingScreensaver onDismiss={handleDismissScreensaver} />
      )}

      {/* 매장명 상단 중앙 정렬 (3번 클릭 시 사장님 모드 전환 인증 트리거) */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
        <h1 
          onClick={() => {
            setClickCount(prev => {
              const next = prev + 1;
              if (next >= 3) {
                setShowKioskPasscodeModal(true);
                setKioskPasscodeInput('');
                setKioskPasscodeError(null);
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


      {/* 탭 내용 영역 (카메라 집중을 위한 검은색 배경, 카메라가 켜져 있으면 가득 차도록 여백 조정) */}
      <div 
        className="imin-card" 
        style={{ 
          padding: ((kioskMode === 'earn' && (scanStatus === 'scanning' || isAnalyzing) && (stream || capturedImage)) || (kioskMode === 'balance' && balanceSearchResults === null && stream)) ? '0' : '36px 24px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flex: 1, 
          minHeight: '450px', 
          width: '100%', 
          boxSizing: 'border-box', 
          backgroundColor: '#111115', 
          border: '1px solid #222228',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* 진짜 카메라 스트림 (카드 전체를 덮는 배경으로 배치) */}
        {stream && !capturedImage && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1
            }}
          />
        )}

        {/* 캡처된 이미지 */}
        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captured screen"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1
            }}
          />
        )}

        {/* 공통 스타일 (애니메이션 선언) */}
        <style>{`
          @keyframes scan-down-viewfinder {
            0% { top: 6px; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: calc(100% - 6px); opacity: 0; }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes scaleUp {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        
        {/* 고객 적립 모드 */}
        {kioskMode === 'earn' && (
          <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center', color: '#ffffff', position: 'relative', zIndex: 2 }}>
            {scanStatus === 'scanning' && (
              <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'flex-start', padding: '24px 16px', boxSizing: 'border-box', minHeight: '440px' }}>
                
                {/* 상단 안내 메시지 (카메라 영상 위에 잘 보이도록 반투명 어두운 배경 처리) */}
                <div style={{ 
                  position: 'relative',
                  zIndex: 10,
                  backgroundColor: 'rgba(0, 0, 0, 0.75)', 
                  padding: '12px 20px', 
                  borderRadius: 'var(--border-radius-lg)', 
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  maxWidth: '90%',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  marginBottom: '8px'
                }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: 0 }}>{t.earnTitle}</h3>
                  <p style={{ color: '#d0d0d8', fontSize: '12.5px', marginTop: '4px', margin: 0 }}>{t.earnDesc}</p>
                </div>

                {/* 중앙 뷰파인더 코너 가이드 + 하단 스캔 버튼 컨테이너 (위로 올리고 밀착시킴) */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '16px', 
                  width: '100%', 
                  zIndex: 5,
                  marginTop: '-10px'
                }}>
                  {/* 중앙 뷰파인더 코너 가이드 (영수증에 최적화된 10인치 태블릿용 세로형 사이즈, 바깥 영역은 65% 어두운 마스크 처리) */}
                  <div style={{ 
                    width: '85%', 
                    maxWidth: '460px', 
                    height: '784px', 
                    maxHeight: '77vh', 
                    position: 'relative',
                    border: '2px dashed rgba(255, 255, 255, 0.45)',
                    borderRadius: '24px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)', // 뷰파인더 바깥쪽 어둡게 마스킹
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {/* 코너 데코레이션 */}
                    <div style={{ position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderLeft: '5px solid var(--primary-color)', borderTop: '5px solid var(--primary-color)', borderRadius: '20px 0 0 0' }} />
                    <div style={{ position: 'absolute', top: '0', right: '0', width: '28px', height: '28px', borderRight: '5px solid var(--primary-color)', borderTop: '5px solid var(--primary-color)', borderRadius: '0 20px 0 0' }} />
                    <div style={{ position: 'absolute', bottom: '0', left: '0', width: '28px', height: '28px', borderLeft: '5px solid var(--primary-color)', borderBottom: '5px solid var(--primary-color)', borderRadius: '0 0 0 20px' }} />
                    <div style={{ position: 'absolute', bottom: '0', right: '0', width: '28px', height: '28px', borderRight: '5px solid var(--primary-color)', borderBottom: '5px solid var(--primary-color)', borderRadius: '0 0 20px 0' }} />
                    
                    {/* 분석 중 또는 스캔 대기 설명 */}
                    {isAnalyzing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#ffffff' }}>
                        <div className="scanning-spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary-color)', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{t.earnScanning}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>영수증을 이 사각형에 맞춰주세요</span>
                    )}

                    {/* 빨간색 스캐닝 레이저 라인 */}
                    <div className="scanner-laser" style={{ 
                      position: 'absolute', 
                      left: '6px', 
                      right: '6px', 
                      height: '2px', 
                      backgroundColor: 'var(--accent-red)', 
                      boxShadow: '0 0 8px var(--accent-red)',
                      animation: 'scan-down-viewfinder 2s ease-in-out infinite',
                      zIndex: 2
                    }} />
                  </div>

                  {/* 하단 스캔 버튼 */}
                  {!isAnalyzing && (
                    <button 
                      onClick={handleReceiptScan}
                      className="imin-btn imin-btn-primary" 
                      style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '280px', padding: '14px', fontSize: '15px', fontWeight: 700, boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}
                    >
                      {t.earnStartBtn}
                    </button>
                  )}
                </div>
              </div>
            )}

            {scanStatus === 'done' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', padding: '24px' }}>
                {qrToken ? (
                  <>
                    <div style={{ border: '12px solid #1F1F24', padding: '16px', borderRadius: '24px', backgroundColor: '#ffffff', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {/* 실제 스캔 가능한 QR 코드 이미지 */}
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/#/customer?token=${qrToken}&storeId=${selectedStoreId}&stamps=${stampsToAward}&expires=${new Date(Date.now() + 10 * 60 * 1000).toISOString()}`)}`}
                        alt="QR Code"
                        style={{ width: '180px', height: '180px', display: 'block' }}
                      />
                    </div>
                    
                    <div>
                      <h4 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-green)' }}>{t.earnDoneTitle(stampsToAward)}</h4>
                      <p style={{ color: '#a0a0ab', fontSize: '14px', marginTop: '6px' }}>{t.earnDoneDesc}</p>
                    </div>

                    {/* 카운트다운 타이머 바 */}
                    <div style={{ width: '100%', maxWidth: '240px', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                      <div style={{ width: `${(qrCountdown / 30) * 100}%`, height: '100%', backgroundColor: 'var(--accent-red)', transition: 'width 1s linear' }} />
                    </div>
                    
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-red)' }}>{t.remainingTime(qrCountdown)}</span>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button onClick={handleResetKiosk} className="imin-btn imin-btn-secondary" style={{ padding: '10px 20px', fontSize: '14px' }}>
                        <RotateCcw size={16} style={{ marginRight: '6px' }} />
                        {t.firstBtn}
                      </button>
                      <button 
                        onClick={() => {
                          localStorage.setItem('sharestamps_pending_qr_token', qrToken);
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

            {scanStatus === 'success' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%', 
                  backgroundColor: 'rgba(52, 199, 89, 0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--accent-green)',
                  marginBottom: '12px',
                  animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}>
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-green)' }}>
                    {language === 'ko' ? '적립 완료!' : 'Stamp Earned!'}
                  </h3>
                  <p style={{ color: '#a0a0ab', fontSize: '15px', marginTop: '8px', lineHeight: '1.5' }}>
                    {language === 'ko' ? '스탬프가 성공적으로 적립되었습니다.\n따뜻한 하루 되세요!' : 'Your stamp has been successfully earned.\nHave a wonderful day!'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 기프트 카드 잔액 조회 모드 */}
        {kioskMode === 'balance' && (
          <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', textAlign: 'center', color: '#ffffff', position: 'relative', zIndex: 2 }}>
             {balanceSearchResults === null ? (
              // 스캔 전 화면 (카메라 꽉차게 레이아웃 구성)
              <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', justifyContent: 'space-between', padding: '24px 16px', boxSizing: 'border-box', minHeight: '440px' }}>
                
                {/* 상단 안내 메시지 */}
                <div style={{ 
                  position: 'relative',
                  zIndex: 10,
                  backgroundColor: 'rgba(0, 0, 0, 0.75)', 
                  padding: '12px 20px', 
                  borderRadius: 'var(--border-radius-lg)', 
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  maxWidth: '90%',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                    {language === 'ko' ? 'QR 코드 또는 바코드를 대주세요' : 'Please present QR or Barcode'}
                  </h3>
                  <p style={{ color: '#d0d0d8', fontSize: '12.5px', marginTop: '4px', margin: 0 }}>
                    {language === 'ko' ? '회원 PWA 홈 화면의 적립/사용 QR을 비추면 잔액이 조회됩니다.' : 'Scan customer profile QR code to check card balance.'}
                  </p>
                </div>

                {/* 중앙 뷰파인더 코너 가이드 (보라색 테마, 10인치 태블릿 최적 비율 정사각형 크기, 바깥 영역 65% 어두운 마스크 처리) */}
                <div style={{ 
                  width: '80%', 
                  maxWidth: '460px', 
                  height: '666px', 
                  maxHeight: '63vh', 
                  position: 'relative',
                  zIndex: 5,
                  border: '2px dashed rgba(255, 255, 255, 0.45)',
                  borderRadius: '24px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)', // 뷰파인더 바깥쪽 어둡게 마스킹
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {/* 코너 데코레이션 */}
                  <div style={{ position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderLeft: '5px solid var(--accent-purple, #9b51e0)', borderTop: '5px solid var(--accent-purple, #9b51e0)', borderRadius: '20px 0 0 0' }} />
                  <div style={{ position: 'absolute', top: '0', right: '0', width: '28px', height: '28px', borderRight: '5px solid var(--accent-purple, #9b51e0)', borderTop: '5px solid var(--accent-purple, #9b51e0)', borderRadius: '0 20px 0 0' }} />
                  <div style={{ position: 'absolute', bottom: '0', left: '0', width: '28px', height: '28px', borderLeft: '5px solid var(--accent-purple, #9b51e0)', borderBottom: '5px solid var(--accent-purple, #9b51e0)', borderRadius: '0 0 0 20px' }} />
                  <div style={{ position: 'absolute', bottom: '0', right: '0', width: '28px', height: '28px', borderRight: '5px solid var(--accent-purple, #9b51e0)', borderBottom: '5px solid var(--accent-purple, #9b51e0)', borderRadius: '0 0 20px 0' }} />
                  
                  {/* 분석 중 또는 스캔 대기 설명 */}
                  {isSearchingBalance ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#ffffff' }}>
                      <div className="scanning-spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid rgba(155, 81, 224, 0.2)', borderTopColor: 'var(--accent-purple, #9b51e0)', animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>
                        {language === 'ko' ? '회원 정보 조회 중...' : 'Looking up customer...'}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>QR코드를 맞춰주세요</span>
                  )}

                  {/* 보라색 레이저 라인 */}
                  <div className="scanner-laser-purple" style={{ 
                    position: 'absolute', 
                    left: '6px', 
                    right: '6px', 
                    height: '2px', 
                    backgroundColor: 'var(--accent-purple, #9b51e0)', 
                    boxShadow: '0 0 8px var(--accent-purple, #9b51e0)',
                    animation: 'scan-down-viewfinder 2.5s ease-in-out infinite',
                    zIndex: 2
                  }} />
                </div>

                {/* 수동 번호 입력 및 시뮬레이션 */}
                {!isSearchingBalance && (
                  <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
                    {stream && (
                      <button
                        onClick={() => {
                          if (videoRef.current && stream) {
                            const canvas = document.createElement('canvas');
                            canvas.width = videoRef.current.videoWidth || 640;
                            canvas.height = videoRef.current.videoHeight || 480;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                              setCapturedImage(canvas.toDataURL('image/jpeg'));
                            }
                          }
                          handleBalanceSearch(balancePhoneInput || '01055556666');
                        }}
                        className="imin-btn"
                        style={{
                          padding: '14px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--accent-purple, #9b51e0)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 800,
                          fontSize: '15px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(155, 81, 224, 0.3)',
                          marginBottom: '4px'
                        }}
                      >
                        📷 {language === 'ko' ? 'QR 코드 촬영 및 인식' : 'Scan QR Code'}
                      </button>
                    )}
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={balancePhoneInput}
                        onChange={(e) => setBalancePhoneInput(e.target.value)}
                        placeholder={language === 'ko' ? '휴대폰 번호 입력' : 'Enter phone number'}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: '1.5px solid #33333f',
                          backgroundColor: '#1f1f24',
                          color: '#ffffff',
                          fontSize: '15px',
                          fontWeight: 600,
                          outline: 'none',
                          textAlign: 'center'
                        }}
                      />
                      <button
                        onClick={() => handleBalanceSearch(balancePhoneInput)}
                        className="imin-btn"
                        style={{
                          padding: '12px 20px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--accent-purple, #9b51e0)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {language === 'ko' ? '조회' : 'Search'}
                      </button>
                    </div>

                    <button
                      onClick={() => handleBalanceSearch('01055556666')}
                      className="imin-btn"
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        color: '#a0a0ab',
                        border: '1px dashed #444455',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      {language === 'ko' ? '📱 박지민 (010-5555-6666) 정보로 스캔 시뮬레이션' : '📱 Simulate Scan for Jimin Park'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // 조회 결과 화면
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '480px', animation: 'fadeInScale 0.3s ease' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(52, 199, 89, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-green)',
                  fontSize: '32px'
                }}>
                  ✅
                </div>
                
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff' }}>
                    {language === 'ko' ? `${balanceSearchCustomer?.nickname} 고객님` : `${balanceSearchCustomer?.nickname}`}
                  </h3>
                  <p style={{ color: '#a0a0ab', fontSize: '14px', marginTop: '4px' }}>
                    {language === 'ko' ? '이 매장에서 사용 가능한 기프트 카드 잔액 정보입니다.' : 'Active gift cards available for use at this store.'}
                  </p>
                </div>

                {/* 기프트 카드 목록 */}
                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  padding: '4px'
                }}>
                  {balanceSearchResults.length > 0 ? (
                    balanceSearchResults.map(card => (
                      <div
                        key={card.id}
                        style={{
                          padding: '18px',
                          borderRadius: '16px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1.5px solid rgba(255, 255, 255, 0.1)',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-purple, #9b51e0)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {card.barcode}
                          </span>
                          <div style={{ fontSize: '13px', color: '#a0a0ab', marginTop: '2px' }}>
                            {language === 'ko' ? `최초 충전액: $${card.initialAmount.toFixed(2)}` : `Purchased: $${card.initialAmount.toFixed(2)}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent-green)' }}>
                            ${card.currentBalance.toFixed(2)}
                          </div>
                          <span style={{ fontSize: '10.5px', color: '#8e8e93' }}>
                            {language === 'ko' ? '사용 가능' : 'Active Balance'}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{
                      padding: '32px 16px',
                      borderRadius: '16px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px dashed #33333f',
                      color: '#a0a0ab',
                      fontSize: '14px'
                    }}>
                      🚫 {language === 'ko' ? '등록된 활성 기프트 카드가 존재하지 않습니다.' : 'No active gift cards found for this store.'}
                    </div>
                  )}
                </div>

                {/* 자동 복귀 카운트다운 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', marginTop: '12px' }}>
                  <div style={{ width: '120px', height: '6px', backgroundColor: '#33333f', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(balanceCountdown / 30) * 100}%`, height: '100%', backgroundColor: 'var(--accent-purple, #9b51e0)', transition: 'width 1s linear' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#a0a0ab', fontWeight: 600 }}>
                    {language === 'ko' ? `${balanceCountdown}초 후 화면 자동 닫힘` : `Closing in ${balanceCountdown}s`}
                  </span>
                </div>

                <button
                  onClick={handleResetBalanceSearch}
                  className="imin-btn"
                  style={{
                    padding: '10px 24px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  {language === 'ko' ? '닫기' : 'Close'}
                </button>
              </div>
            )}
          </div>
        )}

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

      {/* --- 사장님 모드 전환용 4자리 비밀번호 모달 --- */}
      {showKioskPasscodeModal && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(17, 17, 21, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '24px'
        }}>
          <div className="imin-card" style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            textAlign: 'center',
            border: '2px solid var(--primary-color)',
            animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)' }}>
                <Lock size={18} />
                <span style={{ fontSize: '15px', fontWeight: 800 }}>
                  {language === 'ko' ? '사장님 모드 권한 인증' : 'Owner POS Authorization'}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowKioskPasscodeModal(false);
                  setKioskPasscodeInput('');
                  setKioskPasscodeError(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleKioskPasscodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '4px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
                {language === 'ko' ? '사장님 모드로 전환하려면 4자리 비밀번호를 입력해 주세요.' : 'Please enter the 4-digit store password to switch to Owner mode.'}
              </p>

              <div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="password"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    maxLength={4}
                    value={kioskPasscodeInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setKioskPasscodeInput(val);
                    }}
                    placeholder="••••"
                    style={{
                      width: '120px',
                      letterSpacing: '10px',
                      textAlign: 'center',
                      fontSize: '24px',
                      fontWeight: 800,
                      padding: '8px 12px',
                      borderRadius: '12px',
                      border: '2px solid var(--border-color)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {kioskPasscodeError && (
                <span style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 600 }}>
                  ⚠️ {kioskPasscodeError}
                </span>
              )}

              <button
                type="submit"
                className="imin-btn imin-btn-primary"
                style={{
                  width: '100%',
                  fontWeight: 700,
                  fontSize: '14px',
                  padding: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(95, 92, 230, 0.3)'
                }}
              >
                {language === 'ko' ? '확인 및 모드 전환' : 'Authorize & Switch'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 우하단 설정 기어 및 모달 제거됨 */}
    </div>
  );
};
