import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { 
  Heart, Gift, Smartphone, Tablet, Coins, ArrowRight,
  TrendingUp, Users, Megaphone, Landmark, HeartHandshake, Receipt, Award, Database, Zap
} from 'lucide-react';

const translations = {
  ko: {
    badge: "💌 버려지는 모든 스탬프에 새로운 나눔을",
    title1: "단 한 장의 스탬프도,",
    title2: "기부하고 선물",
    title3: "할 수 있습니다.",
    desc: "7장을 전부 다 채우지 못해 실물 쿠폰을 버려보신 적이 있으신가요? ShareStamps는 미완성 상태의 낙전 스탬프에 실시간 금전 가치를 매겨 보존합니다. 이웃에게 따뜻한 기부를 건네고, 소중한 친구에게 한 장씩 선물해 보세요.",
    
    btnCustomer: "고객 PWA 체험",
    btnStore: "매장 Kiosk/POS 체험",
    
    impactBtnTitle: "나의 나눔 임팩트 확인",
    impactBtnDesc: "기부한 스탬프와 이웃을 도운 내역을 확인해 보세요",
    
    card1Title: "고객 PWA",
    card1Desc: "내 스탬프 카드 조회, 친구에게 선물하기, 결식 아동 및 애국지사 기념사업회 기부를 모바일 웹 형태로 체험합니다.",
    card1Action: "PWA 앱 실행",
    
    card2Title: "매장 Kiosk",
    card2Desc: "영수증 OCR 스캔 적립과 고객 잔액 조회를 위한 태블릿용 키오스크 화면입니다. 스크린세이버 기능이 포함됩니다.",
    card2Action: "키오스크 실행",
    
    card3Title: "본사 관리자 (HQ)",
    card3Desc: "가맹 매장 총괄, NGO 기부 캠페인 관리, 통합 로그 모니터링 및 PWA 배너 광고를 제어하는 본사 데스크톱 보드입니다.",
    card3Action: "관리 콘솔 실행",
    
    benefitsTitle: "점주(사장님)가 얻는 확실한 이익",
    benefitsSub: "ShareStamps의 똑똑한 스탬프 순환 생태계가 점포 운영 효율과 매출을 극대화합니다.",
    colTitle: "이익 항목",
    colDesc: "내용 상세",
    
    mechTitle: "나눔을 순환하는 똑똑한 메커니즘",
    mechSub: "ShareStamps가 스탬프의 기부와 선물 문화를 기술적으로 구현하는 3대 구조",
    
    m1Badge: "Stamp Cash Tracker",
    m1Title: "1장도 가치 있게, 개별 가치 추적",
    m1Desc: "적립되는 각각의 개별 스탬프는 획득 시점의 가치 요율을 추적 기록합니다. 매장이 리워드액을 중간에 변경하더라도 고객이 보유한 스탬프의 화폐 가치는 영구 보존됩니다.",
    m1Label: "⭐ 나의 적립 가치",
    m1Sub: "획득 시점의 가치 실시간 합산 결과",
    
    m2Badge: "Frictionless Gifting",
    m2Title: "친구에게 스탬프 선물하고 보드 합치기",
    m2Desc: "수신인의 스마트폰 연락처 번호만 입력하면 보유하고 있는 낱장 스탬프를 즉각 선물하고, 친구의 기존 스탬프 보드와 합쳐 보상에 도달할 수 있습니다.",
    m2Sender: "보낸이",
    m2Recip: "받는이",
    m2Done: "🎁 스탬프 1장 양도 완료",
    
    m3Badge: "NPO Donations",
    m3Title: "낙전 스탬프로 실현하는 비영리 기부",
    m3Desc: "기한 내 채우지 못할 낙전 스탬프를 가치 있는 사회적 재원으로 환원하세요. 단 1장이라도 NPO 단체에 기부하면, 실제 매장 정산 처리를 거쳐 기부금으로 쓰입니다.",
    m3Target: "기부 대상 단체",
    m3TargetName: "안창호 기념 사업회",
    m3Done: "♥ 스탬프 3장 기부 완료"
  },
  en: {
    badge: "💌 Giving new life to every single stamp",
    title1: "Even a single stamp,",
    title2: "can be gifted and donated",
    title3: "to make a difference.",
    desc: "Have you ever thrown away a physical coupon because you couldn't collect all 7 stamps? ShareStamps preserves the real-time monetary value of unused stamps. Spread warmth by donating to neighbors or gift stamps one by one to your friends.",
    
    btnCustomer: "Customer PWA",
    btnStore: "Store Kiosk/POS",
    
    impactBtnTitle: "See My Impact",
    impactBtnDesc: "Check your stamps and how you're helping neighbors",
    
    card1Title: "Customer Mobile PWA",
    card1Desc: "View your active cards, send loose stamps to friends, and make real-time donations to children in need or patriot memorial NPOs.",
    card1Action: "Launch PWA",
    
    card2Title: "Checkout Kiosk",
    card2Desc: "A tablet-optimized kiosk simulator for receipt OCR scanning and balance checks. Includes an automatic screensaver.",
    card2Action: "Launch Kiosk",
    
    card3Title: "Headquarters (HQ) Admin",
    card3Desc: "A back-office panel to oversee franchise stores, approve non-profit causes, upload advertisements, and monitor system logs.",
    card3Action: "Open HQ Console",
    
    benefitsTitle: "Merchant Value & Benefits",
    benefitsSub: "ShareStamps's smart stamp ecosystem maximizes store revenue and operational efficiency.",
    colTitle: "Benefit Category",
    colDesc: "Details",
    
    mechTitle: "The Shared Circulation Mechanics",
    mechSub: "How ShareStamps transforms loose stamps into meaningful value",
    
    m1Badge: "Stamp Cash Tracker",
    m1Title: "Individual Stamp Value Lock & Tracker",
    m1Desc: "Each stamp records and secures its point-based cash value at the time of earning. Even if the store changes its campaign rewards later, the historical monetary value of your active stamps remains fully protected.",
    m1Label: "⭐ My Accumulated Value",
    m1Sub: "Real-time sum of historical stamp values",
    
    m2Badge: "Frictionless Gifting",
    m2Title: "Peer-to-Peer Stamp Gifting & Consolidation",
    m2Desc: "Ditch physical paper cards. Instantly transfer individual stamps to friends using only their mobile numbers, allowing them to consolidate and redeem rewards faster.",
    m2Sender: "Sender",
    m2Recip: "Recipient",
    m2Done: "🎁 1 Stamp Gift Sent",
    
    m3Badge: "NPO Donations",
    m3Title: "Micro NGO Donation with Loose Stamps",
    m3Desc: "Donate fractional stamps that would otherwise expire. Single stamps donated to authorized NGOs convert to direct community funding, supported by automated merchant-HQ settlement.",
    m3Target: "NGO Cause",
    m3TargetName: "Ahn Chang-ho Memorial",
    m3Done: "♥ 3 Stamps Donated"
  }
};

const benefits_ko = [
  { icon: <TrendingUp size={20} color="#5f5ce6" />, title: '매출 증가', desc: '적립고객 재방문 비율 71%, 1년 평균 28회 방문 유도로 매장 매출이 비약적으로 향상됩니다.' },
  { icon: <Users size={20} color="#10b981" />, title: '신규 고객', desc: '68%의 고객이 쿠폰·기부 경험으로 매장을 인지하고 새 손님을 데려옵니다.' },
  { icon: <Megaphone size={20} color="#3b82f6" />, title: '홍보', desc: '착한가게 인증 판 + 언론 홍보 + 지도·플랫폼 노출로 저절로 홍보됩니다.' },
  { icon: <Landmark size={20} color="#f59e0b" />, title: '소득공제', desc: '착한가게 인증 시 연말 소득공제 혜택이 있습니다.' },
  { icon: <HeartHandshake size={20} color="#ec4899" />, title: '고객 충성', desc: '로열티 프로그램이 브랜드 관계 유지에 80% 이상 영향을 줍니다.' },
  { icon: <Receipt size={20} color="#8b5cf6" />, title: '마케팅 비용 절감', desc: '재방문 유도 기능이 광고 효과를 대체해 비용이 줄어듭니다.' },
  { icon: <Award size={20} color="#ef4444" />, title: '브랜드 이미지', desc: '“남은 1개도 기부” 철학이 지역사회·교회·NPO와 신뢰를 높입니다.' },
  { icon: <Database size={20} color="#06b6d4" />, title: '데이터 관리', desc: '대시보드에서 방문 주기·기부 전환 비율을 확인해 프로모션 타임을 정확히 잡을 수 있습니다.' },
  { icon: <Zap size={20} color="#10b981" />, title: '운영 효율', desc: '태블릿·POS 연동 시 수동 입력이 줄어 운영이 간단합니다.' }
];

const benefits_en = [
  { icon: <TrendingUp size={20} color="#5f5ce6" />, title: 'Revenue Growth', desc: 'Customer return rate increases by 71%, driving an average of 28 annual visits, significantly boosting sales.' },
  { icon: <Users size={20} color="#10b981" />, title: 'New Customers', desc: '68% of customers discover the store through coupon/donation shares and bring new guests along.' },
  { icon: <Megaphone size={20} color="#3b82f6" />, title: 'Organic PR', desc: 'Receives a physical "Good Store" plaque, press PR support, and organic exposure on local maps and platforms.' },
  { icon: <Landmark size={20} color="#f59e0b" />, title: 'Tax Deductions', desc: 'Official "Good Store" certification enables year-end tax write-offs and charity donation receipts.' },
  { icon: <HeartHandshake size={20} color="#ec4899" />, title: 'Customer Loyalty', desc: 'A premium loyalty program coupled with philanthropy has an 80%+ positive impact on brand relationship retention.' },
  { icon: <Receipt size={20} color="#8b5cf6" />, title: 'Reduced Costs', desc: 'Automated app pushes and return reminders replace expensive local flyers and ads, cutting promo costs.' },
  { icon: <Award size={20} color="#ef4444" />, title: 'Brand Image', desc: 'The "single stamp donation" philosophy builds trust with local communities, churches, and NPOs.' },
  { icon: <Database size={20} color="#06b6d4" />, title: 'Data Analytics', desc: 'Tracks visit cycles and donation conversion rates on the dashboard to run promotions at the perfect time.' },
  { icon: <Zap size={20} color="#10b981" />, title: 'Operational Ease', desc: 'Cloud synchronization between tablet kiosk and POS enables immediate staff adoption with zero training.' }
];

export const LandingPage: React.FC = () => {
  const { stores, reviews } = useDatabase();
  const [showImpactModal, setShowImpactModal] = useState<boolean>(false);
  // OS 언어 감지 및 기본 언어 세팅 (영어일 경우 en, 아니면 ko)
  const [lang, setLang] = useState<'ko' | 'en'>(() => {
    const browserLang = navigator.language || (navigator as any).userLanguage || 'ko';
    return browserLang.toLowerCase().startsWith('en') ? 'en' : 'ko';
  });

  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  const getStoreRatingInfo = (storeId: string) => {
    const storeReviews = reviews.filter(r => r.storeId === storeId);
    if (storeReviews.length === 0) return { avg: 5.0, count: 0 };
    const sum = storeReviews.reduce((acc, r) => acc + r.rating, 0);
    return { avg: parseFloat((sum / storeReviews.length).toFixed(1)), count: storeReviews.length };
  };

  const t = translations[lang];
  const activeBenefits = lang === 'en' ? benefits_en : benefits_ko;

  return (
    <div className="landing-container" style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fc',
      color: '#1f1f24',
      fontFamily: 'var(--font-sans)',
      letterSpacing: '-0.025em',
      position: 'relative',
      overflowX: 'hidden',
      paddingBottom: '80px'
    }}>
      {/* Background soft gradients (Optimized for Mobile/Performance) */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '600px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(95, 92, 230, 0.06) 0%, rgba(255,255,255,0) 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Top Header - Optimized for Mobile Spacing */}
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src="/favicon.png" 
            alt="ShareStamps Logo" 
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              boxShadow: '0 4px 10px rgba(95, 92, 230, 0.15)',
              objectFit: 'contain'
            }}
          />
          <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.5px', color: '#1f1f24', textTransform: 'none' }}>
            ShareStamps
          </span>
        </div>
        
        {/* Language Selection Switch - Modern Pill Selector */}
        <div style={{
          display: 'flex',
          backgroundColor: '#e4e4e7',
          padding: '2px',
          borderRadius: '20px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setLang('ko')}
            style={{
              padding: '6px 14px',
              borderRadius: '18px',
              border: 'none',
              backgroundColor: lang === 'ko' ? '#ffffff' : 'transparent',
              color: lang === 'ko' ? '#5f5ce6' : '#71717a',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: lang === 'ko' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            KO
          </button>
          <button
            onClick={() => setLang('en')}
            style={{
              padding: '6px 14px',
              borderRadius: '18px',
              border: 'none',
              backgroundColor: lang === 'en' ? '#ffffff' : 'transparent',
              color: lang === 'en' ? '#5f5ce6' : '#71717a',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: lang === 'en' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            EN
          </button>
        </div>
      </header>

      {/* 'See My Impact' Banner/Button Container - Placed in the red box area */}
      <div style={{
        maxWidth: '480px',
        margin: '12px auto 8px auto',
        padding: '0 20px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        <button
          onClick={() => navigateTo('#/customer')}
          className="see-my-impact-btn"
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: '20px',
            border: 'none',
            background: 'linear-gradient(135deg, #FF3B30 0%, #FF2D55 100%)',
            color: '#ffffff',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255, 45, 85, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: 'scale(1)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(255, 45, 85, 0.35)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 45, 85, 0.25)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Heart size={18} fill="#ffffff" strokeWidth={0} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, lineHeight: '1.2' }}>
                {t.impactBtnTitle}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.9, marginTop: '4px', lineHeight: '1.2' }}>
                {t.impactBtnDesc}
              </span>
            </div>
          </div>
          <ArrowRight size={18} style={{ flexShrink: 0, opacity: 0.9 }} />
        </button>
      </div>

      {/* Hero Section - Mobile-first layout */}
      <section style={{
        maxWidth: '800px',
        margin: '24px auto 40px auto',
        padding: '0 20px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Sharbee Mascot Character */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '24px',
          position: 'relative'
        }}>
          {/* Character Image */}
          <img 
            src="/sharbee/sharbee10.png" 
            alt="Sharbee Mascot" 
            className="hero-mascot-img"
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 10px 24px rgba(95, 92, 230, 0.18))',
              animation: 'bounceCharacter 3s ease-in-out infinite'
            }}
          />
        </div>

        {/* Soft Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '30px',
          backgroundColor: 'rgba(95, 92, 230, 0.08)',
          border: '1px solid rgba(95, 92, 230, 0.16)',
          color: '#5f5ce6',
          fontSize: '12.5px',
          fontWeight: 700,
          marginBottom: '20px',
          boxShadow: '0 4px 10px rgba(95, 92, 230, 0.02)'
        }}>
          <span>{t.badge}</span>
        </div>

        {/* Main Title - Responsive sizing */}
        <h1 className="hero-title" style={{
          fontSize: '32px', // Default mobile size
          fontWeight: 900,
          lineHeight: '1.25',
          marginBottom: '16px',
          color: '#1f1f24',
          letterSpacing: '-0.04em'
        }}>
          {t.title1}<br />
          <span style={{ 
            background: 'linear-gradient(90deg, #5f5ce6 0%, #10b981 100%)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            fontWeight: 950
          }}>{t.title2}</span> {t.title3}
        </h1>

        {/* Hero description */}
        <p style={{
          fontSize: '14.5px',
          color: '#4b5563',
          fontWeight: 500,
          lineHeight: '1.65',
          maxWidth: '640px',
          margin: '0 auto 28px auto',
          letterSpacing: '-0.02em',
          padding: '0 4px'
        }}>
          {t.desc}
        </p>

        {/* Quick buttons under Hero on Mobile */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '320px',
          margin: '0 auto 40px auto'
        }}>
          <button 
            onClick={() => navigateTo('#/customer')}
            className="landing-nav-btn-purple"
            style={{
              padding: '14px 24px',
              borderRadius: '16px',
              border: 'none',
              backgroundColor: '#5f5ce6',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(95, 92, 230, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {t.btnCustomer}
          </button>
          <button 
            onClick={() => navigateTo('#/store')}
            style={{
              padding: '14px 24px',
              borderRadius: '16px',
              border: '1px solid rgba(95, 92, 230, 0.2)',
              backgroundColor: '#ffffff',
              color: '#5f5ce6',
              fontSize: '14.5px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              transition: 'all 0.2s ease'
            }}
          >
            {t.btnStore}
          </button>
        </div>

      {/* Yelp-style Store Explorer Section */}
      <section style={{
        maxWidth: '800px',
        margin: '0 auto 48px auto',
        padding: '0 20px',
        textAlign: 'left',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1f1f24', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>🏪</span> {lang === 'ko' ? '추천 착한 가맹점 미니홈피' : 'Explore Featured Stores'}
          </h2>
          <span style={{ fontSize: '12px', color: '#5f5ce6', fontWeight: 700 }}>
            {lang === 'ko' ? `총 ${stores.filter(s => !s.name.includes('호점')).length}개 매장` : `${stores.filter(s => !s.name.includes('호점')).length} stores`}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '16px'
        }}>
          {stores.filter(s => !s.name.includes('호점')).map(store => {
            const { avg, count } = getStoreRatingInfo(store.id);
            return (
              <div 
                key={store.id}
                onClick={() => navigateTo(`#/store-home/${store.id}`)}
                style={{
                  display: 'flex',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid rgba(95, 92, 230, 0.1)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                className="landing-card-white"
              >
                {/* Store Thumbnail */}
                <div style={{ width: '100px', height: '100px', flexShrink: 0, backgroundColor: '#f1f3f9' }}>
                  <img 
                    src={store.thumbnailUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300'} 
                    alt={store.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Store Text details */}
                <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#1f1f24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {store.name}
                      </h3>
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: 700, 
                        color: '#5f5ce6', 
                        backgroundColor: 'rgba(95, 92, 230, 0.08)',
                        padding: '2px 6px',
                        borderRadius: '20px',
                        flexShrink: 0
                      }}>
                        {store.category.split(' ')[0]}
                      </span>
                    </div>
                    
                    {/* Star Rating */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <span style={{ color: '#ffb800', fontSize: '13px' }}>★</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1f1f24' }}>{avg.toFixed(1)}</span>
                      <span style={{ fontSize: '11px', color: '#71717a' }}>({count})</span>
                    </div>

                    <p style={{ fontSize: '12.5px', color: '#52525b', margin: '6px 0 0 0', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {store.description || (lang === 'ko' ? '기분 좋은 서비스와 혜택을 드리는 가맹점입니다.' : 'A good store with nice service and stamp rewards.')}
                    </p>
                  </div>

                  <div style={{ fontSize: '11px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                    <span>📍</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {store.address || (lang === 'ko' ? '서울시 강남구' : 'Seoul, Korea')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

        {/* Grid Container for Cards */}
        <div className="landing-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr', // Mobile first: 1 column
          gap: '20px',
          maxWidth: '680px',
          margin: '0 auto',
          textAlign: 'left'
        }}>
          {/* Card 1: Customer PWA */}
          <div 
            onClick={() => navigateTo('#/customer')}
            className="landing-card-white"
            style={{
              padding: '24px',
              borderRadius: '20px',
              backgroundColor: '#ffffff',
              border: '1px solid rgba(95, 92, 230, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(95, 92, 230, 0.08)',
              border: '1px solid rgba(95, 92, 230, 0.15)',
              color: '#5f5ce6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Smartphone size={20} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#1f1f24', marginBottom: '8px' }}>{t.card1Title}</h3>
            <p style={{ fontSize: '13px', color: '#52525b', lineHeight: '1.5', marginBottom: '16px' }}>
              {t.card1Desc}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#5f5ce6', fontSize: '13px', fontWeight: 800 }}>
              <span>{t.card1Action}</span>
              <ArrowRight size={12} />
            </div>
          </div>

          {/* Card 2: Tablet Kiosk */}
          <div 
            onClick={() => navigateTo('#/kiosk')}
            className="landing-card-white"
            style={{
              padding: '24px',
              borderRadius: '20px',
              backgroundColor: '#ffffff',
              border: '1px solid rgba(95, 92, 230, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <Tablet size={20} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#1f1f24', marginBottom: '8px' }}>{t.card2Title}</h3>
            <p style={{ fontSize: '13px', color: '#52525b', lineHeight: '1.5', marginBottom: '16px' }}>
              {t.card2Desc}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '13px', fontWeight: 800 }}>
              <span>{t.card2Action}</span>
              <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </section>

      {/* "사장님이 얻는 이익" Section - Transformed dynamically for Mobile */}
      <section style={{
        maxWidth: '960px',
        margin: '60px auto 60px auto',
        padding: '0 20px',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.04em', color: '#1f1f24' }}>
            {t.benefitsTitle}
          </h2>
          <p style={{ color: '#52525b', fontSize: '13.5px', marginTop: '6px', fontWeight: 500, lineHeight: 1.4 }}>
            {t.benefitsSub}
          </p>
        </div>

        {/* Benefits Table - Mobile block-card layout & Desktop clean grid */}
        <div className="benefits-table-wrapper" style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(95, 92, 230, 0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          overflow: 'hidden'
        }}>
          {/* Table Header (hidden in mobile style via CSS below) */}
          <div className="benefits-table-header" style={{
            backgroundColor: '#f1f3f9',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(95, 92, 230, 0.08)',
            fontWeight: 800,
            fontSize: '13.5px',
            color: '#4b5563'
          }}>
            <div className="col-cat" style={{ width: '130px', flexShrink: 0 }}>{t.colTitle}</div>
            <div className="col-desc" style={{ flex: 1, paddingLeft: '16px' }}>{t.colDesc}</div>
          </div>

          {/* Table Body Rows */}
          {activeBenefits.map((benefit, idx) => (
            <div 
              key={idx} 
              className="benefit-row"
              style={{
                borderBottom: idx === activeBenefits.length - 1 ? 'none' : '1px solid rgba(95, 92, 230, 0.06)',
                transition: 'all 0.2s ease'
              }}
            >
              <div className="benefit-row-inner" style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                fontSize: '13.5px'
              }}>
                {/* Category with Icon */}
                <div className="benefit-col-category" style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {benefit.icon}
                  <span style={{ fontWeight: 800, color: '#1f1f24' }}>{benefit.title}</span>
                </div>
                
                {/* Details */}
                <div className="benefit-col-desc" style={{ flex: 1, paddingLeft: '16px', color: '#4b5563', lineHeight: 1.45, fontWeight: 500 }}>
                  {benefit.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sharbee Tip Banner */}
        <div style={{
          marginTop: '24px',
          padding: '20px',
          borderRadius: '20px',
          backgroundColor: 'rgba(95, 92, 230, 0.04)',
          border: '1px dashed rgba(95, 92, 230, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          textAlign: 'left'
        }}>
          <img 
            src="/sharbee/sharbee8.png" 
            alt="Sharbee recommendation" 
            style={{ width: '64px', height: '64px', objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#5f5ce6', margin: '0 0 4px 0' }}>
              {lang === 'ko' ? '🐝 스탬프 요정 샤비의 한마디!' : '🐝 A quick word from Sharbee!'}
            </h4>
            <p style={{ fontSize: '12.5px', color: '#4b5563', margin: 0, fontWeight: 500, lineHeight: 1.45 }}>
              {lang === 'ko' 
                ? '낙전으로 사라지던 스탬프가 가치 있는 포인트와 기부금으로 순환되면, 매장 단골 고객이 2.5배 더 자주 방문해요! 샤비와 함께 따뜻하고 현명한 매장을 만들어봐요.' 
                : 'When loose stamps circulate as valuable points and donations, store loyalty visits increase by 2.5x! Let’s build a warmer and smarter store together with Sharbee.'}
            </p>
          </div>
        </div>
      </section>

      {/* Feature Philosophy Detailed Section - Compact for Mobile */}
      <section style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '0 20px',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '36px'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-0.04em', color: '#1f1f24' }}>
            {t.mechTitle}
          </h2>
          <p style={{ color: '#52525b', fontSize: '13.5px', marginTop: '6px', fontWeight: 500 }}>
            {t.mechSub}
          </p>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Detail Item 1 */}
          <div style={{
            padding: '24px',
            paddingRight: '76px', // space for mascot
            borderRadius: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(95, 92, 230, 0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <img 
              src="/sharbee/sharbee2.png" 
              alt="Sharbee" 
              style={{
                position: 'absolute',
                right: '16px',
                top: '16px',
                width: '56px',
                height: '56px',
                objectFit: 'contain'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5f5ce6' }}>
              <Coins size={16} />
              <span style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.m1Badge}</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1f1f24', margin: 0 }}>
              {t.m1Title}
            </h3>
            <p style={{ color: '#52525b', fontSize: '13px', lineHeight: '1.55', margin: 0, fontWeight: 500 }}>
              {t.m1Desc}
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: '#f8f9fc',
              border: '1px solid rgba(95, 92, 230, 0.06)'
            }}>
              <div style={{ fontSize: '11.5px', color: '#5f5ce6', fontWeight: 800, marginBottom: '6px' }}>{t.m1Label}</div>
              <div style={{ fontSize: '28px', fontWeight: 950, color: '#10b981' }}>$10.57</div>
              <div style={{ fontSize: '10.5px', color: '#71717a', marginTop: '4px', fontWeight: 500 }}>{t.m1Sub}</div>
            </div>
          </div>

          {/* Detail Item 2 */}
          <div style={{
            padding: '24px',
            paddingRight: '76px', // space for mascot
            borderRadius: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(95, 92, 230, 0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <img 
              src="/sharbee/sharbee3.png" 
              alt="Sharbee" 
              style={{
                position: 'absolute',
                right: '16px',
                top: '16px',
                width: '56px',
                height: '56px',
                objectFit: 'contain'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
              <Gift size={16} />
              <span style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.m2Badge}</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1f1f24', margin: 0 }}>
              {t.m2Title}
            </h3>
            <p style={{ color: '#52525b', fontSize: '13px', lineHeight: '1.55', margin: 0, fontWeight: 500 }}>
              {t.m2Desc}
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: '#f8f9fc',
              border: '1px solid rgba(95, 92, 230, 0.06)'
            }}>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '11.5px', color: '#71717a' }}>
                <span>{t.m2Sender}</span>
                <span style={{ color: '#1e1e24', fontWeight: 700 }}>010-1234-5678</span>
              </div>
              <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontSize: '11.5px', color: '#71717a' }}>
                <span>{t.m2Recip}</span>
                <span style={{ color: '#1e1e24', fontWeight: 700 }}>010-5555-6666</span>
              </div>
              <div style={{ height: '1px', backgroundColor: 'rgba(95, 92, 230, 0.06)' }} />
              <div style={{ textAlign: 'center', color: '#10b981', fontWeight: 800, fontSize: '12px' }}>
                {t.m2Done}
              </div>
            </div>
          </div>

          {/* Detail Item 3 */}
          <div style={{
            padding: '24px',
            paddingRight: '76px', // space for mascot
            borderRadius: '20px',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(95, 92, 230, 0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <img 
              src="/sharbee/sharbee5.png" 
              alt="Sharbee" 
              style={{
                position: 'absolute',
                right: '16px',
                top: '16px',
                width: '56px',
                height: '56px',
                objectFit: 'contain'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
              <Heart size={16} fill="#ef4444" color="#ef4444" />
              <span style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.m3Badge}</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1f1f24', margin: 0 }}>
              {t.m3Title}
            </h3>
            <p style={{ color: '#52525b', fontSize: '13px', lineHeight: '1.55', margin: 0, fontWeight: 500 }}>
              {t.m3Desc}
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: '#f8f9fc',
              border: '1px solid rgba(95, 92, 230, 0.06)',
              gap: '4px'
            }}>
              <span style={{ fontSize: '11.5px', color: '#71717a' }}>{t.m3Target}</span>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1e1e24' }}>{t.m3TargetName}</span>
              <span style={{ fontSize: '15px', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>{t.m3Done}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Responsive Styles Injection */}
      <style>{`
        /* Desktop/Tablet Breakpoint */
        @media (min-width: 640px) {
          .hero-title {
            font-size: 44px !important;
            margin-bottom: 24px !important;
          }
          .landing-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .landing-nav-btn-white:hover {
            background-color: rgba(95, 92, 230, 0.04) !important;
          }
          .landing-nav-btn-purple:hover {
            background-color: #4b48cc !important;
            box-shadow: 0 6px 16px rgba(95, 92, 230, 0.35) !important;
          }
          .benefit-row:hover {
            background-color: #fcfdff;
          }
          .hero-mascot-img {
            width: 330px !important;
            height: 330px !important;
          }
        }
        
        /* Mobile-specific Table transformations to Cards */
        @media (max-width: 640px) {
          .benefits-table-header {
            display: none !important;
          }
          .benefit-row-inner {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            padding: 16px !important;
            gap: 10px !important;
          }
          .benefit-col-category {
            width: 100% !important;
            font-size: 15px !important;
          }
          .benefit-col-desc {
            width: 100% !important;
            padding-left: 0 !important;
            font-size: 13px !important;
          }
        }
        
        .landing-card-white:hover {
          transform: translateY(-4px);
          border-color: #5f5ce6 !important;
          box-shadow: 0 8px 24px rgba(95, 92, 230, 0.08) !important;
        }
        .hero-mascot-img {
          width: 230px;
          height: 230px;
          transition: all 0.3s ease;
        }
        @keyframes bounceCharacter {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes floatBubble {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>

      {/* 'See My Impact' Modal */}
      {showImpactModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '400px',
            padding: '28px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            boxSizing: 'border-box',
            textAlign: 'center',
            position: 'relative',
            animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowImpactModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#8e8e93',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>

            {/* Impact Icon */}
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 45, 85, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#FF3B30'
            }}>
              <Heart size={32} fill="#FF3B30" strokeWidth={0} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#1f1f24', margin: '0 0 10px 0' }}>
              {lang === 'ko' ? '나의 따뜻한 기부 영향력' : 'My Giving Impact'}
            </h3>
            <p style={{ fontSize: '13px', color: '#636366', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {lang === 'ko' 
                ? '버려질 수 있었던 낙전 스탬프가 모여 세상을 바꾸는 큰 나눔이 되었습니다.' 
                : 'Loose stamps that would otherwise expire are transformed into community funding.'}
            </p>

            {/* Statistics Box */}
            <div style={{
              backgroundColor: '#f8f9fc',
              borderRadius: '16px',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700, display: 'block' }}>
                  {lang === 'ko' ? '기부한 스탬프' : 'Stamps Donated'}
                </span>
                <span style={{ fontSize: '18px', color: '#5f5ce6', fontWeight: 900 }}>
                  24 EA
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700, display: 'block' }}>
                  {lang === 'ko' ? '매칭 누적 기부금' : 'Matching Donations'}
                </span>
                <span style={{ fontSize: '18px', color: '#10b981', fontWeight: 900 }}>
                  $31.20
                </span>
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e5e5ea', paddingTop: '10px' }}>
                <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700, display: 'block' }}>
                  {lang === 'ko' ? '주요 후원 대상' : 'Primary NPO Cause'}
                </span>
                <span style={{ fontSize: '13px', color: '#1f1f24', fontWeight: 800 }}>
                  {lang === 'ko' ? '안창호기념사업회, 결식아동 돕기' : 'Ahn Chang-ho Memorial, Children Food Aid'}
                </span>
              </div>
            </div>

            {/* Message from Sharbee */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'rgba(95, 92, 230, 0.05)',
              borderRadius: '12px',
              padding: '12px',
              textAlign: 'left',
              marginBottom: '24px'
            }}>
              <img src="/sharbee/sharbee8.png" alt="Sharbee" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
              <p style={{ fontSize: '11.5px', color: '#48484a', margin: 0, lineHeight: 1.4, fontWeight: 500 }}>
                {lang === 'ko' 
                  ? '우리의 작은 발걸음이 모여 더 따뜻한 내일을 만들어요. 함께해주셔서 고마워요! 🐝❤️' 
                  : 'Every small action builds a brighter tomorrow. Thank you for joining us! 🐝❤️'}
              </p>
            </div>

            {/* Close Button Action */}
            <button
              onClick={() => setShowImpactModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: '#5f5ce6',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(95, 92, 230, 0.2)'
              }}
            >
              {lang === 'ko' ? '확인' : 'Great!'}
            </button>
          </div>
          <style>{`
            @keyframes modalSlideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};
