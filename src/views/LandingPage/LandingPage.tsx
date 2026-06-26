import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import {
  Heart, Gift, ArrowRight,
  TrendingUp, Users, HeartHandshake, Receipt, Award,
  Package, MessageSquare, Share2, Bot, Send, Wallet, Trophy, Infinity as InfinityIcon
} from 'lucide-react';

const translations = {
  ko: {
    badge: "🐝 AI 검색 시대, 손님이 만드는 우리 가게 마케팅",
    title1: "AI가",
    title2: "우리 가게를 추천하게",
    title3: "만듭니다.",
    desc: "“제로클릭 서치 (Zero-Click Search)”, 들어보셨나요?\n손님은 더 이상 클릭하지 않습니다.\n마케팅도 AEO·GEO로 바뀌어야 합니다.\n손님이 챗봇과 대화하면 페이스북·인스타그램·구글 비즈니스 등\n10개 채널에 자동 배포되고,\nAI 검색이 우리 가게를 먼저 찾아냅니다.",

    btnCustomer: "고객 앱 체험하기",
    btnStore: "점주 — 우리 가게 시작하기",
    
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
    badge: "🐝 AI-era marketing your customers create for you",
    title1: "Get AI to",
    title2: "recommend",
    title3: "your store.",
    desc: "Ever heard of “Zero-Click Search”? These days people don’t click links anymore. That means marketing has to change too — now it’s about AEO and GEO. When a customer chats with our bot, their review posts automatically to 10 channels like Facebook, Instagram, and Google Business — so AI search finds your store first.",

    btnCustomer: "Try the customer app",
    btnStore: "For owners — Get started",
    
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

  // VISION / 비즈니스 구조 콘텐츠 (PDF deck 기반)
  const viz = lang === 'ko' ? {
    problem: {
      eyebrow: '문제 정의', title: '소규모 매장의 생존은\n결국 홍보·마케팅이다',
      points: [
        'AI 시대 — 검색 결과를 클릭하지 않는 노클릭 서치(no-click search)가 늘었다',
        '단순 SEO를 넘어 AEO(답변엔진 최적화) + GEO(생성엔진 최적화)가 필요하다',
        '한 곳에 콘텐츠를 올리는 것으로는 한계 — 전방위(옴니채널) 배포가 필요하다',
      ],
    },
    expose: { eyebrow: '노출 전략', title: 'AI가 우리 가게를 발견·이해하게', cards: [
      { icon: Package, t: '브랜드명 일원화', d: '브랜드명·서브타이틀을 통일해 AI가 흩어진 콘텐츠를 같은 매장(엔티티)으로 인식하게 합니다.' },
      { icon: MessageSquare, t: 'AI 맞춤형 FAQ', d: '홈피에 질문-답변(FAQ) 구조를 구축 — AEO의 핵심으로, AI 답변에 인용되게 합니다.' },
      { icon: Share2, t: '옴니채널 배포', d: '일관된 브랜드 정보를 모든 채널·플랫폼에 동시 발행해 노출 빈도를 극대화합니다.' },
    ] },
    content: { eyebrow: '콘텐츠 생산', title: '손님이 콘텐츠를 만든다', cards: [
      { icon: Bot, t: 'AI 챗봇(샤비) 리뷰', d: '손님이 샤비와 대화하며 질문-대답(Q&A) 방식으로 리뷰를 작성 — AI 검색에 최적화됩니다.' },
      { icon: Send, t: '전채널 자동 배포', d: '생성된 리뷰가 페북·인스타·유튜브 쇼츠·틱톡·구글 비즈니스 등 전 채널에 자동 배포됩니다.' },
    ] },
    motive: { big: '7', label: 'STAMPS', title: '행동을 유발하는 확실한 보상', desc: '손님은 아무 이유 없이 리뷰를 쓰지 않습니다. 7개의 스탬프를 모으면 현금으로 보상하는 파격적인 제도로 확실한 참여 동기를 부여합니다.' },
    paradox: { eyebrow: '경제 모델의 역설', title: '이 사업의 차별점', cards: [
      { icon: Receipt, t: '기존 모델의 한계 (낙전)', d: '고객은 7장을 다 못 채울 걸 알아서 포기합니다. 사라지는 스탬프(낙전)는 전부 돈입니다.' },
      { icon: TrendingUp, t: '점주의 진짜 이득', d: '돈을 안 줘서 이득이 아닙니다. 약간의 비용으로 손님이 단 한 번이라도 더 방문하면 그게 이득입니다.' },
      { icon: Award, t: '압도적 가치 창출', d: '스탬프에 들어가는 비용보다, 단골이 되어 발생하는 재방문 가치가 훨씬 큽니다.' },
    ] },
    social: { eyebrow: '사회적 가치화', title: '스탬프 찍는 행위에 의미를 부여', cards: [
      { icon: HeartHandshake, t: '비영리 단체 기부', d: '단 1개의 스탬프라도 내가 지정한 비영리 단체에 기부할 수 있습니다.' },
      { icon: Gift, t: '친구에게 선물', d: '가족·연인·친구에게 내가 모은 스탬프를 선물해 함께 혜택을 나눕니다.' },
      { icon: Wallet, t: '적립금 직접 사용', d: '물론 7개를 모아 본인이 직접 현금(적립금)으로 알뜰하게 쓸 수도 있습니다.' },
    ] },
    engine: {
      eyebrow: '게임화 & 실행 엔진',
      gam: { icon: Trophy, t: '게임화 — ShareChamp', items: ['게임처럼 지속 참여를 유도하는 ShareChamp 리스트 운영', '스탬프 활동이 뛰어난 챔피언(고객) 선정', '우수 매장을 챔피언 매장으로 선정·홍보'] },
      staff: { icon: Users, t: '실행 엔진 — 직원 인센티브', items: ['스탬프를 찍게 만드는 현장의 핵심은 매장 내 서버(직원)', '스탬프 캐시 발행액의 약 10%를 직원에게 지급', '직원의 적극적·자발적인 스탬프 권유 문화 정착'] },
    },
    loop: { eyebrow: '귀결', title: '선한 영향력의 무한 루프', desc: '스탬프를 찍으면 자동 마케팅(AEO·GEO)이 되고, 그 혜택이 사회 기부로 이어지는 완벽한 상생 생태계입니다.', steps: ['손님 방문', '샤비 리뷰', '전채널 배포', 'AI 검색 노출', '보상·재방문'] },
    table: { eyebrow: '생태계 혜택 요약', title: '모두가 이득인 구조', col: ['참여 주체', '주요 혜택 및 보상', '최종 결과'], rows: [
      { who: '소상공인 (점주)', benefit: '자동화된 AEO/GEO 마케팅, 고객 재방문율 상승', result: "'좋은 가게' 현판 부여, 기부액에 따른 세금 공제 혜택" },
      { who: '고객 (소비자)', benefit: '리뷰 작성을 통한 확실한 보상 (7개 모으면 현금)', result: '기부·선물·직접 사용 등 가치 있는 소비 경험' },
      { who: '매장 직원 (서버)', benefit: '고객 스탬프 발행 시 10% 인센티브 적립', result: '업무 동기 부여 및 추가 수익 창출' },
      { who: '사회단체', benefit: '점주·고객이 지정한 기부금 지속적 수령', result: '안정적인 후원 확보 및 지역 사회 발전 기여' },
    ] },
  } : {
    problem: {
      eyebrow: 'THE PROBLEM', title: 'A local shop lives or dies\nby its marketing',
      points: [
        'In the AI era, no-click search keeps users from ever clicking through',
        'Beyond plain SEO you now need AEO (answer-engine) + GEO (generative-engine) optimization',
        'Posting in one place is not enough — you need omni-channel distribution',
      ],
    },
    expose: { eyebrow: 'GET FOUND BY AI', title: 'Make AI discover and understand you', cards: [
      { icon: Package, t: 'Unified brand identity', d: 'One brand name and subtitle so AI recognizes scattered content as the same store entity.' },
      { icon: MessageSquare, t: 'AI-ready FAQ', d: 'A question-answer FAQ on your page — the core of AEO, so AI quotes you in its answers.' },
      { icon: Share2, t: 'Omni-channel reach', d: 'Publish consistent brand info to every channel at once to maximize exposure.' },
    ] },
    content: { eyebrow: 'CUSTOMERS CREATE IT', title: 'Your customers make the content', cards: [
      { icon: Bot, t: 'AI chatbot (Sharbee) reviews', d: 'Customers chat with Sharbee to write reviews in a Q&A format — optimized for AI search.' },
      { icon: Send, t: 'Auto cross-posting', d: 'Each review auto-publishes to Facebook, Instagram, YouTube Shorts, TikTok, Google Business and more.' },
    ] },
    motive: { big: '7', label: 'STAMPS', title: 'A reward strong enough to act', desc: 'Customers do not write reviews for nothing. Collect 7 stamps and get cash back — a bold reward that creates real motivation to participate.' },
    paradox: { eyebrow: "THE TWIST", title: 'The economic paradox', cards: [
      { icon: Receipt, t: 'The breakage trap', d: 'Customers give up knowing they will never fill all 7. Every abandoned stamp is real money.' },
      { icon: TrendingUp, t: "The owner's real gain", d: 'The win is not unpaid stamps — for a small cost, one extra visit is already profit.' },
      { icon: Award, t: 'Outsized value', d: 'The value of a returning regular far outweighs the small cost of the stamps.' },
    ] },
    social: { eyebrow: 'SOCIAL GOOD', title: 'Give the act of stamping meaning', cards: [
      { icon: HeartHandshake, t: 'Donate to non-profits', d: 'Even a single stamp can be donated to a non-profit you choose.' },
      { icon: Gift, t: 'Gift to friends', d: 'Send the stamps you collected to family and friends to share the reward.' },
      { icon: Wallet, t: 'Use as cash', d: 'Or collect 7 and simply use them as cash credit for yourself.' },
    ] },
    engine: {
      eyebrow: 'GAMIFICATION & ENGINE',
      gam: { icon: Trophy, t: 'Gamification — ShareChamp', items: ['A ShareChamp leaderboard that keeps people coming back', 'Champion customers selected from top stamp activity', 'Top stores featured as champion stores'] },
      staff: { icon: Users, t: 'Engine — staff incentive', items: ['The real driver of stamping is the in-store server (staff)', 'About 10% of issued stamp cash is paid to staff', 'A culture where staff actively encourage stamping'] },
    },
    loop: { eyebrow: 'THE RESULT', title: 'A virtuous, endless loop', desc: 'Stamping becomes automatic AEO/GEO marketing, and the reward flows back into social giving — a complete win-win ecosystem.', steps: ['Visit', 'Sharbee review', 'Cross-post', 'AI search', 'Reward & return'] },
    table: { eyebrow: 'ECOSYSTEM BENEFITS', title: 'Everyone wins', col: ['Participant', 'Benefit & reward', 'Outcome'], rows: [
      { who: 'Owner', benefit: 'Automated AEO/GEO marketing, higher return rate', result: "A 'Good Store' plaque and tax deductions on donations" },
      { who: 'Customer', benefit: 'A real reward for reviews (cash at 7 stamps)', result: 'Meaningful spending: donate, gift, or use as cash' },
      { who: 'Staff (server)', benefit: '10% incentive on issued stamp cash', result: 'Stronger motivation and extra income' },
      { who: 'Non-profits', benefit: 'Steady donations directed by owners and customers', result: 'Reliable funding and local community impact' },
    ] },
  };

  return (
    <div className="landing-container" style={{
      minHeight: '100vh',
      backgroundColor: '#F3F0EE',
      color: '#141413',
      fontFamily: "'Sofia Sans', 'Pretendard', system-ui, -apple-system, sans-serif",
      letterSpacing: '-0.01em',
      position: 'relative',
      overflowX: 'hidden',
      paddingBottom: '80px'
    }}>
      {/* Ghost watermark headline (cream-on-cream, Mastercard signature) */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        top: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        textAlign: 'center',
        fontSize: 'clamp(80px, 16vw, 200px)',
        fontWeight: 500,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        color: '#E8E2DA',
        zIndex: 0,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap'
      }}>
        ShareStamps
      </div>

      {/* Floating Nav Pill (Mastercard signature) */}
      <header style={{
        maxWidth: '1120px',
        margin: '24px auto 0 auto',
        padding: '12px 16px 12px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        zIndex: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: '999px',
        boxShadow: 'rgba(0, 0, 0, 0.04) 0px 4px 24px 0px',
        width: 'calc(100% - 40px)'
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <img
            src="/favicon.png"
            alt="ShareStamps Logo"
            style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'contain' }}
          />
          <span style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.04em', color: '#141413' }}>
            ShareStamps
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Language Selection — ink/cream pill */}
          <div style={{
            display: 'flex',
            backgroundColor: '#F3F0EE',
            padding: '3px',
            borderRadius: '999px',
            alignItems: 'center'
          }}>
            {(['ko', 'en'] as const).map(lng => (
              <button
                key={lng}
                onClick={() => setLang(lng)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: lang === lng ? '#141413' : 'transparent',
                  color: lang === lng ? '#F3F0EE' : '#696969',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{
        maxWidth: '1120px',
        width: 'calc(100% - 40px)',
        margin: '8px auto 0 auto',
        display: 'flex',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 20
      }}>
        <button
          onClick={() => navigateTo('#/customer')}
          style={{
            padding: '9px 22px',
            borderRadius: '999px',
            border: '1.5px solid #141413',
            backgroundColor: '#141413',
            color: '#F3F0EE',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          {t.impactBtnTitle}
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
        {/* Eyebrow — accent dot + label (Mastercard signature) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#CF4500', display: 'inline-block' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>
            {lang === 'ko' ? 'AI 검색 마케팅 엔진' : 'AI SEARCH MARKETING'}
          </span>
        </div>

        {/* Mascot — circular portrait */}
        <div style={{
          width: '152px',
          height: '152px',
          borderRadius: '50%',
          backgroundColor: '#FCFBFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 32px auto',
          boxShadow: 'rgba(0, 0, 0, 0.08) 0px 24px 48px 0px'
        }}>
          <img
            src="/sharbee/sharbee10.png"
            alt="Sharbee Mascot"
            style={{ width: '120px', height: '120px', objectFit: 'contain' }}
          />
        </div>

        {/* Hero headline — ink, weight 500, tight tracking */}
        <h1 style={{
          fontSize: 'clamp(34px, 6vw, 60px)',
          fontWeight: 500,
          lineHeight: 1.05,
          marginBottom: '22px',
          color: '#141413',
          letterSpacing: '-0.03em'
        }}>
          {t.title1}<br />{t.title2} {t.title3}
        </h1>

        {/* Hero description — body weight 450 */}
        <p style={{
          fontSize: '17px',
          color: '#262627',
          fontWeight: 450,
          lineHeight: 1.5,
          maxWidth: '580px',
          margin: '0 auto 34px auto',
          letterSpacing: '-0.01em',
          whiteSpace: 'pre-line'
        }}>
          {t.desc}
        </p>

        {/* Hero CTAs — ink pill primary + outlined pill secondary */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '8px'
        }}>
          <button
            onClick={() => navigateTo('#/store')}
            style={{
              padding: '14px 32px',
              borderRadius: '20px',
              border: '1.5px solid #141413',
              backgroundColor: '#141413',
              color: '#F3F0EE',
              fontSize: '16px',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {t.btnStore}
          </button>
          <button
            onClick={() => navigateTo('#/customer')}
            style={{
              padding: '14px 32px',
              borderRadius: '20px',
              border: '1.5px solid #141413',
              backgroundColor: '#FFFFFF',
              color: '#141413',
              fontSize: '16px',
              fontWeight: 450,
              letterSpacing: '-0.02em',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {t.btnCustomer}
          </button>
        </div>

      {/* Featured Stores (Mastercard) */}
      <section style={{ maxWidth: '1120px', margin: '64px auto 0 auto', padding: '0 28px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{lang === 'ko' ? '추천 가맹점' : 'FEATURED STORES'}</span>
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', fontWeight: 500, letterSpacing: '-0.03em', color: '#141413', margin: 0 }}>{lang === 'ko' ? '착한 가맹점 미니홈피' : 'Good neighbor stores'}</h2>
          </div>
          <span style={{ fontSize: '13px', color: '#696969', fontWeight: 450 }}>
            {lang === 'ko' ? `총 ${stores.filter(s => !s.name.includes('호점')).length}개 매장` : `${stores.filter(s => !s.name.includes('호점')).length} stores`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {stores.filter(s => !s.name.includes('호점')).map(store => {
            const { avg, count } = getStoreRatingInfo(store.id);
            return (
              <div
                key={store.id}
                onClick={() => navigateTo(`#/store-home/${store.id}`)}
                style={{
                  display: 'flex',
                  gap: '18px',
                  alignItems: 'center',
                  backgroundColor: '#FCFBFA',
                  borderRadius: '24px',
                  padding: '20px',
                  boxShadow: 'rgba(0,0,0,0.06) 0px 18px 40px 0px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: '76px', height: '76px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#F3F0EE' }}>
                  <img
                    src={store.thumbnailUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300'}
                    alt={store.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: 500, letterSpacing: '-0.02em', margin: 0, color: '#141413', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.name}</h3>
                    <span style={{ fontSize: '11px', fontWeight: 450, color: '#696969', backgroundColor: '#F3F0EE', padding: '3px 10px', borderRadius: '999px', flexShrink: 0 }}>{store.category.split(' ')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
                    <span style={{ color: '#F37338', fontSize: '13px' }}>★</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#141413' }}>{avg.toFixed(1)}</span>
                    <span style={{ fontSize: '11px', color: '#696969' }}>({count})</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#565656', margin: '7px 0 0 0', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {store.description || (lang === 'ko' ? '기분 좋은 서비스와 혜택을 드리는 가맹점입니다.' : 'A good store with nice service and stamp rewards.')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      </section>

      {/* ===== VISION A. 문제 정의 ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '76px 28px 44px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{viz.problem.eyebrow}</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#141413', margin: 0, whiteSpace: 'pre-line' }}>{viz.problem.title}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '6px' }}>
            {viz.problem.points.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: '1px', color: '#CF4500' }}><ArrowRight size={18} /></span>
                <span style={{ fontSize: '16px', fontWeight: 450, lineHeight: 1.5, color: '#262627' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== VISION B. 노출 전략 (3 cards) ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{viz.expose.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#141413', margin: 0 }}>{viz.expose.title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: '20px' }}>
          {viz.expose.cards.map(card => (
            <div key={card.t} style={{ backgroundColor: '#FCFBFA', borderRadius: '24px', padding: '32px 28px', boxShadow: 'rgba(0,0,0,0.06) 0px 18px 40px 0px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F3F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <card.icon size={24} color="#141413" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em', color: '#141413', margin: '0 0 10px' }}>{card.t}</h3>
              <p style={{ fontSize: '15px', fontWeight: 450, lineHeight: 1.55, color: '#565656', margin: 0 }}>{card.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== VISION D. 콘텐츠 메커니즘 (2 cards) ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{viz.content.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#141413', margin: 0 }}>{viz.content.title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', maxWidth: '760px', margin: '0 auto' }}>
          {viz.content.cards.map(card => (
            <div key={card.t} style={{ backgroundColor: '#FCFBFA', borderRadius: '24px', padding: '32px 28px', boxShadow: 'rgba(0,0,0,0.06) 0px 18px 40px 0px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F3F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <card.icon size={24} color="#141413" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em', color: '#141413', margin: '0 0 10px' }}>{card.t}</h3>
              <p style={{ fontSize: '15px', fontWeight: 450, lineHeight: 1.55, color: '#565656', margin: 0 }}>{card.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== VISION E. 동기 (7 stamps) ===== */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '52px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 'clamp(96px, 16vw, 160px)', fontWeight: 500, letterSpacing: '-0.05em', lineHeight: 0.9, color: '#141413' }}>{viz.motive.big}</div>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.3em', color: '#CF4500', marginBottom: '24px' }}>{viz.motive.label}</div>
        <h2 style={{ fontSize: 'clamp(24px, 3.4vw, 32px)', fontWeight: 500, letterSpacing: '-0.02em', color: '#141413', margin: '0 0 14px' }}>{viz.motive.title}</h2>
        <p style={{ fontSize: '17px', fontWeight: 450, lineHeight: 1.5, color: '#565656', maxWidth: '560px', margin: '0 auto' }}>{viz.motive.desc}</p>
      </section>

      {/* ===== VISION F. 경제 모델의 역설 (3 cards) ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{viz.paradox.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#141413', margin: 0 }}>{viz.paradox.title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: '20px' }}>
          {viz.paradox.cards.map(card => (
            <div key={card.t} style={{ backgroundColor: '#FCFBFA', borderRadius: '24px', padding: '32px 28px', boxShadow: 'rgba(0,0,0,0.06) 0px 18px 40px 0px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F3F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <card.icon size={24} color="#141413" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em', color: '#141413', margin: '0 0 10px' }}>{card.t}</h3>
              <p style={{ fontSize: '15px', fontWeight: 450, lineHeight: 1.55, color: '#565656', margin: 0 }}>{card.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== VISION G. 사회적 가치화 (3 cards) ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{viz.social.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.15, color: '#141413', margin: 0 }}>{viz.social.title}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: '20px' }}>
          {viz.social.cards.map(card => (
            <div key={card.t} style={{ backgroundColor: '#FCFBFA', borderRadius: '24px', padding: '32px 28px', boxShadow: 'rgba(0,0,0,0.06) 0px 18px 40px 0px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F3F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <card.icon size={24} color="#141413" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em', color: '#141413', margin: '0 0 10px' }}>{card.t}</h3>
              <p style={{ fontSize: '15px', fontWeight: 450, lineHeight: 1.55, color: '#565656', margin: 0 }}>{card.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== VISION H & I. 게임화 & 실행 엔진 (2 cols) ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{viz.engine.eyebrow}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {[viz.engine.gam, viz.engine.staff].map(col => (
            <div key={col.t} style={{ backgroundColor: '#FCFBFA', borderRadius: '24px', padding: '34px 30px', boxShadow: 'rgba(0,0,0,0.06) 0px 18px 40px 0px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F3F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <col.icon size={22} color="#141413" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em', color: '#141413', margin: 0 }}>{col.t}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {col.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, marginTop: '1px', color: '#CF4500' }}><ArrowRight size={16} /></span>
                    <span style={{ fontSize: '15px', fontWeight: 450, lineHeight: 1.5, color: '#565656' }}>{it}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== VISION J. 선한 영향력의 무한 루프 (ink band) ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 28px' }}>
        <div style={{ backgroundColor: '#141413', borderRadius: '40px', padding: 'clamp(44px, 7vw, 80px) 28px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(243,240,238,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <InfinityIcon size={30} color="#F3F0EE" />
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4.4vw, 44px)', fontWeight: 500, letterSpacing: '-0.03em', color: '#F3F0EE', margin: '0 0 16px' }}>{viz.loop.title}</h2>
          <p style={{ fontSize: '16px', fontWeight: 450, lineHeight: 1.5, color: '#B4B0AB', maxWidth: '560px', margin: '0 auto 32px' }}>{viz.loop.desc}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
            {viz.loop.steps.map((s, i) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ padding: '9px 18px', borderRadius: '999px', border: '1px solid rgba(243,240,238,0.25)', color: '#F3F0EE', fontSize: '14px', fontWeight: 450 }}>{s}</span>
                {i < viz.loop.steps.length - 1 && <ArrowRight size={16} color="#F37338" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== VISION 생태계 혜택 요약 (table) ===== */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '44px 28px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#CF4500' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', color: '#696969' }}>{viz.table.eyebrow}</span>
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', fontWeight: 500, letterSpacing: '-0.03em', color: '#141413', margin: 0 }}>{viz.table.title}</h2>
        </div>
        <div style={{ backgroundColor: '#FCFBFA', borderRadius: '24px', overflow: 'hidden', boxShadow: 'rgba(0,0,0,0.06) 0px 18px 40px 0px' }}>
          <div className="eco-row eco-head" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', gap: '16px', padding: '16px 28px', borderBottom: '1px solid #E8E2DA' }}>
            {viz.table.col.map(c => (
              <span key={c} style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: '#696969' }}>{c}</span>
            ))}
          </div>
          {viz.table.rows.map((r, i) => (
            <div key={r.who} className="eco-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', gap: '16px', padding: '20px 28px', borderBottom: i < viz.table.rows.length - 1 ? '1px solid #EFEAE4' : 'none', alignItems: 'start' }}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: '#141413' }}>{r.who}</span>
              <span style={{ fontSize: '14px', fontWeight: 450, lineHeight: 1.5, color: '#565656' }}>{r.benefit}</span>
              <span style={{ fontSize: '14px', fontWeight: 450, lineHeight: 1.5, color: '#565656' }}>{r.result}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Ink Footer (Mastercard signature) */}
      <footer style={{ backgroundColor: '#141413', color: '#FFFFFF', borderRadius: '40px 40px 0 0', marginTop: '40px', padding: 'clamp(48px, 7vw, 88px) 28px 56px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.2vw, 44px)', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.12, color: '#F3F0EE', margin: '0 0 32px', maxWidth: '640px' }}>
            {lang === 'ko' ? '동네 가게의 마케팅,\n손님과 함께 자라납니다.' : "Local marketing that grows\nwith your customers."}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '48px' }}>
            <button
              onClick={() => navigateTo('#/store')}
              style={{ padding: '13px 30px', borderRadius: '20px', border: '1.5px solid #F3F0EE', backgroundColor: '#F3F0EE', color: '#141413', fontSize: '15px', fontWeight: 500, letterSpacing: '-0.02em', cursor: 'pointer' }}
            >
              {t.btnStore}
            </button>
            <button
              onClick={() => navigateTo('#/customer')}
              style={{ padding: '13px 30px', borderRadius: '20px', border: '1.5px solid rgba(243,240,238,0.4)', backgroundColor: 'transparent', color: '#F3F0EE', fontSize: '15px', fontWeight: 450, letterSpacing: '-0.02em', cursor: 'pointer' }}
            >
              {t.btnCustomer}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '28px', borderTop: '1px solid rgba(243,240,238,0.18)', paddingTop: '36px' }}>
            {[
              { h: lang === 'ko' ? '서비스' : 'Product', items: [{ t: t.card1Title, go: '#/customer' }, { t: t.card2Title, go: '#/kiosk' }, { t: lang === 'ko' ? '점주 대시보드' : 'Owner dashboard', go: '#/store' }] },
              { h: lang === 'ko' ? '둘러보기' : 'Explore', items: [{ t: lang === 'ko' ? '가맹점' : 'Stores', go: '#/' }, { t: lang === 'ko' ? '본사 관리자' : 'HQ admin', go: '#/admin' }] },
            ].map(col => (
              <div key={col.h}>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: '#888780', marginBottom: '14px' }}>{col.h}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {col.items.map(it => (
                    <span key={it.t} onClick={() => navigateTo(it.go)} style={{ fontSize: '14px', fontWeight: 450, color: '#D3D1C7', cursor: 'pointer' }}>{it.t}</span>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ minWidth: '160px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
                <img src="/favicon.png" alt="ShareStamps" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'contain' }} />
                <span style={{ fontSize: '16px', fontWeight: 500, letterSpacing: '-0.03em', color: '#F3F0EE' }}>ShareStamps</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 450, lineHeight: 1.5, color: '#888780', margin: 0 }}>
                {lang === 'ko' ? '소상공인·고객·사회를 잇는 상생 마케팅 플랫폼' : 'A win-win marketing platform for shops, customers and community.'}
              </p>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#696969', marginTop: '40px' }}>© {new Date().getFullYear()} ShareStamps</div>
        </div>
      </footer>

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
