import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { 
  ArrowLeft, MapPin, Phone, Clock, Award, Star, Image as ImageIcon, Sparkles, MessageSquarePlus, X
} from 'lucide-react';

export const StoreMiniHome: React.FC = () => {
  const { 
    stores, 
    reviews, 
    addReview, 
    donations, 
    language,
    setCustomerSelectedStoreId
  } = useDatabase();

  const [storeId, setStoreId] = useState<string>(() => {
    const hash = window.location.hash;
    return hash.split('/').pop() || 'store_id_1';
  });

  // Listen to hash changes in case of navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('store-home')) {
        setStoreId(hash.split('/').pop() || 'store_id_1');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const store = stores.find(s => s.id === storeId) || stores[0] || {
    id: 'store_id_1',
    name: '스타벅스 강남점',
    category: 'Cafe (카페)',
    pointRewardPer7Stamps: 5,
    currency: 'USD',
    ownerId: 'owner_id_1',
    description: '신선한 커피가 있는 공간입니다.',
    address: '서울시 강남구',
    phone: '02-123-4567',
    hours: '07:00 ~ 22:00',
    thumbnailUrl: '',
    bannerUrl: '',
    menuItems: []
  };

  const storeReviews = reviews.filter(r => r.storeId === store.id);
  const storeDonations = donations.filter(d => d.storeId === store.id);
  const totalStampsDonated = storeDonations.reduce((acc, d) => acc + d.stampCount, 0);
  const totalMoneyDonated = storeDonations.reduce((acc, d) => acc + d.monetaryValue, 0);

  const avgRating = storeReviews.length > 0 
    ? parseFloat((storeReviews.reduce((sum, r) => sum + r.rating, 0) / storeReviews.length).toFixed(1))
    : 5.0;

  const [activeTab, setActiveTab] = useState<'info' | 'esg' | 'reviews'>('reviews');
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

  // Review Form States
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-set beautiful review stock photos (LocalStorage safe)
  const stockPhotos = [
    { name: 'Coffee', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300' },
    { name: 'Cake', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300' },
    { name: 'Hair', url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=300' },
    { name: 'Food', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300' },
    { name: 'Interior', url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300' },
    { name: 'Service', url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300' },
  ];

  // AI review writing helpers
  const aiTips = {
    ko: [
      "☕ 매장의 분위기와 대표 메뉴 맛은 어떠셨나요?",
      "💇 사장님/디자이너님의 친절도나 시술 만족도를 남겨주세요!",
      "🍱 맛과 영양, 포장 위생 상태 등에 대해 써주시면 큰 힘이 됩니다.",
      "✨ 스탬프 기부나 적립 경험이 마음에 드셨는지 표현해 보세요!"
    ],
    en: [
      "☕ How was the atmosphere and the taste of their signature menu?",
      "💇 Share your satisfaction with the styling and the staff's friendliness!",
      "🍱 Mentioning the portion size, taste, and packaging helps a lot.",
      "✨ Tell us how you liked the stamp earning and donation experience!"
    ]
  };

  const [aiTipIndex, setAiTipIndex] = useState<number>(0);

  // Rotate AI tips when writing
  useEffect(() => {
    if (comment.length > 0 && comment.length % 15 === 0) {
      setAiTipIndex((prev) => (prev + 1) % aiTips[language === 'ko' ? 'ko' : 'en'].length);
    }
  }, [comment]);

  const handleBack = () => {
    // Navigate back to where they came from
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = '#/';
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (comment.trim().length < 30) {
      setErrorMsg(
        language === 'ko'
          ? '리뷰 내용을 최소 30자 이상 작성해 주세요. (현재: ' + comment.trim().length + '자)'
          : 'Please write at least 30 characters. (Current: ' + comment.trim().length + ')'
      );
      return;
    }

    if (!selectedPhotoUrl) {
      setErrorMsg(
        language === 'ko'
          ? '리뷰 인증을 위해 사진을 1장 선택해 주세요.'
          : 'Please select 1 photo for review verification.'
      );
      return;
    }

    addReview(store.id, rating, comment, selectedPhotoUrl);
    
    // Reset Form
    setRating(5);
    setComment('');
    setSelectedPhotoUrl('');
    setShowReviewModal(false);
  };

  const t = {
    title: language === 'ko' ? '매장 미니홈피' : 'Store Mini-Home',
    infoTab: language === 'ko' ? '정보·메뉴' : 'Info & Menu',
    esgTab: language === 'ko' ? '나눔공헌' : 'Impact',
    reviewsTab: language === 'ko' ? '리뷰 피드' : 'Reviews',
    menuTitle: language === 'ko' ? '🍽️ 대표 메뉴' : '🍽️ Signature Menu',
    contactTitle: language === 'ko' ? '📞 연락처 및 안내' : '📞 Contact Info',
    esgHeadline: language === 'ko' ? '이 매장에서 꽃피운 나눔' : 'Donations Earned Here',
    esgSub: language === 'ko' ? '단골 고객님들의 스탬프 기부로 이웃에게 사랑을 전했습니다.' : 'Stamps donated by loyal customers convert to direct community funding.',
    totalDonatedLabel: language === 'ko' ? '누적 기부 스탬프' : 'Total Donated Stamps',
    totalMoneyLabel: language === 'ko' ? '정산 완료된 기부액' : 'Settled Funding',
    npoTitle: language === 'ko' ? '기부 참여율 분석' : 'Donation Campaign Share',
    writeReviewBtn: language === 'ko' ? '리뷰 쓰기' : 'Write Review',
    reviewsCount: (n: number) => language === 'ko' ? `${n}개의 고객 피드` : `${n} customer feeds`,
    noReviews: language === 'ko' ? '첫 번째 리뷰를 남겨주세요!' : 'Be the first to write a review!',
    modalTitle: language === 'ko' ? '소중한 리뷰 작성' : 'Write Customer Review',
    ratingLabel: language === 'ko' ? '평가 점수' : 'Rating',
    commentPlaceholder: language === 'ko' ? '이곳에 30자 이상의 소중한 이용 후기를 입력해 주세요...' : 'Please enter your review of at least 30 characters here...',
    photoSelectLabel: language === 'ko' ? '인증 사진 선택 (필수)' : 'Select Verification Photo (Required)',
    submitBtn: language === 'ko' ? '리뷰 등록하기' : 'Submit Review',
    aiAssistantTitle: language === 'ko' ? '🐝 샤비의 실시간 팁' : '🐝 Sharbee\'s Helper Tip',
    backBtn: language === 'ko' ? '이전' : 'Back',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#ffffff',
      fontFamily: 'var(--font-sans)',
      overflowY: 'auto',
      position: 'relative'
    }}>
      {/* Top Nav Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid #f4f4f5',
        backgroundColor: '#ffffff',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button 
          onClick={handleBack}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: '#18181b', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '14px',
            fontWeight: 700,
            padding: 0
          }}
        >
          <ArrowLeft size={18} />
          <span>{t.backBtn}</span>
        </button>
        <span style={{ fontSize: '15px', fontWeight: 800, color: '#18181b' }}>{t.title}</span>
        <div style={{ width: '40px' }} /> {/* Spacer */}
      </div>

      {/* Banner & Brand Info Header */}
      <div style={{ position: 'relative', width: '100%', height: '160px', backgroundColor: '#e4e4e7' }}>
        <img 
          src={store.bannerUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800'} 
          alt={store.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          bottom: '-32px',
          left: '16px',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: '#ffffff',
          border: '2px solid #ffffff',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5
        }}>
          <img 
            src={store.thumbnailUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300'} 
            alt={store.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>

      {/* Store Basic info */}
      <div style={{ padding: '40px 16px 12px 16px', borderBottom: '1px solid #f4f4f5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#18181b', margin: 0 }}>{store.name}</h2>
            <span style={{ 
              fontSize: '11px', 
              color: '#5f5ce6', 
              backgroundColor: 'rgba(95, 92, 230, 0.08)',
              padding: '2px 8px',
              borderRadius: '20px',
              fontWeight: 800,
              display: 'inline-block',
              marginTop: '4px'
            }}>
              {store.category.split(' ')[0]}
            </span>
          </div>
          
          {/* Rating */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Star size={16} fill="#ffb800" color="#ffb800" />
              <strong style={{ fontSize: '16px', fontWeight: 900, color: '#18181b' }}>{avgRating.toFixed(1)}</strong>
            </div>
            <span style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>
              ({storeReviews.length} reviews)
            </span>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#52525b', lineHeight: 1.5, marginTop: '10px', margin: 0, fontWeight: 500 }}>
          {store.description || (language === 'ko' ? '언제나 훌륭한 퀄리티로 보답하는 가맹점입니다.' : 'A good partner store serving with pride.')}
        </p>
      </div>

      {/* Tabs Menu */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #f4f4f5',
        backgroundColor: '#ffffff',
        position: 'sticky',
        top: '45px',
        zIndex: 9
      }}>
        {(['reviews', 'info', 'esg'] as const).map(tab => {
          const isActive = activeTab === tab;
          let label = t.infoTab;
          if (tab === 'esg') label = t.esgTab;
          if (tab === 'reviews') label = t.reviewsTab;
          
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '14px 0',
                border: 'none',
                background: 'none',
                fontSize: '13.5px',
                fontWeight: isActive ? 800 : 600,
                color: isActive ? '#5f5ce6' : '#71717a',
                borderBottom: isActive ? '2px solid #5f5ce6' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div style={{ flex: 1, padding: '16px' }}>
        
        {/* TAB 1: INFO & MENU */}
        {activeTab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Store Information Card */}
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#18181b', margin: '0 0 12px 0' }}>{t.contactTitle}</h3>
              <div className="imin-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4b5563' }}>
                  <MapPin size={16} style={{ color: '#5f5ce6' }} />
                  <span>{store.address || (language === 'ko' ? '서울시 강남구' : 'Seoul, Korea')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4b5563' }}>
                  <Phone size={16} style={{ color: '#5f5ce6' }} />
                  <span>{store.phone || '02-123-4567'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4b5563' }}>
                  <Clock size={16} style={{ color: '#5f5ce6' }} />
                  <span>{store.hours || '07:00 ~ 22:00'}</span>
                </div>
              </div>
            </div>

            {/* Menu List */}
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#18181b', margin: '0 0 12px 0' }}>{t.menuTitle}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {store.menuItems && store.menuItems.length > 0 ? (
                  store.menuItems.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="imin-card" 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '14px' 
                      }}
                    >
                      <div style={{ textAlign: 'left', flex: 1, paddingRight: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#18181b', display: 'block' }}>{item.name}</span>
                        {item.description && (
                          <span style={{ fontSize: '11px', color: '#71717a', display: 'block', marginTop: '2px' }}>{item.description}</span>
                        )}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#5f5ce6' }}>
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', color: '#71717a', fontSize: '13px', padding: '20px' }}>
                    {language === 'ko' ? '등록된 메뉴 정보가 없습니다.' : 'No menu information available.'}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: ESG STATS */}
        {activeTab === 'esg' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
              <Award size={36} style={{ color: '#5f5ce6', margin: '0 auto 8px auto' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#18181b', margin: 0 }}>{t.esgHeadline}</h3>
              <p style={{ fontSize: '12px', color: '#71717a', marginTop: '6px', lineHeight: 1.45, padding: '0 8px', margin: 0 }}>
                {t.esgSub}
              </p>
            </div>

            {/* Donation Stats Grid */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="imin-card" style={{ flex: 1, padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600 }}>{t.totalDonatedLabel}</span>
                <span style={{ fontSize: '24px', fontWeight: 950, color: '#5f5ce6', marginTop: '8px' }}>
                  {totalStampsDonated} <span style={{ fontSize: '13px', fontWeight: 800 }}>장</span>
                </span>
              </div>
              <div className="imin-card" style={{ flex: 1, padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600 }}>{t.totalMoneyLabel}</span>
                <span style={{ fontSize: '24px', fontWeight: 950, color: '#10b981', marginTop: '8px' }}>
                  ${totalMoneyDonated.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Charity Campaign list */}
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#71717a', margin: '0 0 10px 0', textTransform: 'uppercase' }}>{t.npoTitle}</h3>
              <div className="imin-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {storeDonations.length > 0 ? (
                  // Simple breakdown grouping by NPO
                  Array.from(new Set(storeDonations.map(d => d.nonProfitId))).map(npoId => {
                    const npoTxs = storeDonations.filter(d => d.nonProfitId === npoId);
                    const stampSum = npoTxs.reduce((sum, tx) => sum + tx.stampCount, 0);
                    const pct = totalStampsDonated > 0 ? Math.round((stampSum / totalStampsDonated) * 100) : 0;
                    
                    // Fallback names
                    const npoNames: Record<string, string> = {
                      'npo_1': '세이브더칠드런',
                      'npo_2': '그린피스',
                      'npo_3': '동물권행동 카라'
                    };
                    const name = npoNames[npoId] || npoId;

                    return (
                      <div key={npoId}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, color: '#3f3f46' }}>
                          <span>{name}</span>
                          <span>{stampSum}장 ({pct}%)</span>
                        </div>
                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#f4f4f5', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#5f5ce6', borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', color: '#71717a', fontSize: '12.5px', padding: '10px 0' }}>
                    {language === 'ko' ? '아직 이 매장에서 기부된 내역이 없습니다.' : 'No stamp donations recorded at this store yet.'}
                  </div>
                )}
              </div>
            </div>

            {/* Mascot Tip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '16px', backgroundColor: 'rgba(95, 92, 230, 0.04)', border: '1px dashed rgba(95, 92, 230, 0.2)' }}>
              <img src="/sharbee/sharbee5.png" alt="Mascot" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <p style={{ fontSize: '11px', color: '#4b5563', lineHeight: 1.45, margin: 0, fontWeight: 550 }}>
                {language === 'ko'
                  ? "스탬프 1장이라도 기부되면 지역 상권 활성화와 사회 공헌에 실시간으로 쓰여요. 고객 한 분 한 분의 나눔이 큰 힘이 됩니다!"
                  : "Every single stamp donated builds a warmer community. Your micro-philanthropy creates immediate visual impact!"}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: REVIEWS FEED */}
        {activeTab === 'reviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Reviews Count & Write Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#52525b' }}>
                {t.reviewsCount(storeReviews.length)}
              </span>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setCustomerSelectedStoreId(store.id);
                  localStorage.setItem('sharestamps_open_sharbee_review_store_id', store.id);
                  window.location.hash = '#/customer';
                }}
                className="imin-btn imin-btn-primary"
                style={{ 
                  width: 'auto', 
                  padding: '8px 16px', 
                  fontSize: '12px', 
                  fontWeight: 800, 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <MessageSquarePlus size={14} />
                <span>{t.writeReviewBtn}</span>
              </button>
            </div>

            {/* Reviews List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {storeReviews.length > 0 ? (
                storeReviews.map(review => (
                  <div key={review.id} className="imin-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: '#e4e4e7',
                          color: '#52525b',
                          fontSize: '11px',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {review.userName.charAt(0)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#18181b', lineHeight: 1.1 }}>{review.userName}</span>
                            {review.isAIContent && (
                              <span style={{
                                fontSize: '8.5px',
                                fontWeight: 800,
                                padding: '1.5px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 184, 0, 0.12)',
                                color: '#D97706',
                                border: '1px solid rgba(255, 184, 0, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2.5px',
                                whiteSpace: 'nowrap'
                              }}>
                                🌟 {language === 'ko' ? 'AI 콘텐츠' : 'AI Content'}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '10px', color: '#71717a', marginTop: '2px' }}>@{review.userNickname}</span>
                        </div>
                      </div>
                      
                      {/* Rating stars */}
                      <div style={{ display: 'flex', gap: '1px' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            size={12} 
                            fill={i < review.rating ? '#ffb800' : 'none'} 
                            color={i < review.rating ? '#ffb800' : '#e4e4e7'} 
                          />
                        ))}
                      </div>
                    </div>

                    <p style={{ 
                      fontSize: '13px', 
                      color: '#4b5563', 
                      lineHeight: 1.5, 
                      margin: 0, 
                      textAlign: 'left', 
                      fontWeight: 500,
                      whiteSpace: 'pre-line'
                    }}>
                      {review.comment}
                    </p>

                    {review.videoUrl && (
                      <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000000', position: 'relative', aspectRatio: '16 / 9' }}>
                        <video 
                          src={review.videoUrl} 
                          controls 
                          playsInline
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    )}

                    {review.photoUrl && (
                      <div style={{ width: '100%', maxHeight: '200px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f4f4f5' }}>
                        <img 
                          src={review.photoUrl} 
                          alt="Review attachment" 
                          style={{ width: '100%', height: '100%', maxHeight: '200px', objectFit: 'cover' }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '10px', color: '#a1a1aa' }}>
                      <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: '#71717a', fontSize: '13px', padding: '40px 0' }}>
                  <ImageIcon size={24} style={{ color: '#d4d4d8', margin: '0 auto 8px auto', display: 'block' }} />
                  <span>{t.noReviews}</span>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Review Modal SHEET overlay */}
      {showReviewModal && (
        <div 
          className="bottom-sheet-overlay"
          onClick={() => setShowReviewModal(false)}
          style={{ zIndex: 100, alignItems: 'flex-end' }}
        >
          <div 
            className="imin-card"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '430px',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              backgroundColor: '#ffffff',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f4f4f5', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#18181b', margin: 0 }}>{t.modalTitle}</h3>
              <button 
                onClick={() => setShowReviewModal(false)}
                style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Review Form */}
            <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Rating Selector */}
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#52525b', display: 'block', marginBottom: '8px' }}>
                  {t.ratingLabel}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const starVal = idx + 1;
                    const active = starVal <= rating;
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setRating(starVal)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Star size={28} fill={active ? '#ffb800' : 'none'} color={active ? '#ffb800' : '#d4d4d8'} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Review Comment Textarea */}
              <div style={{ position: 'relative' }}>
                <textarea
                  className="imin-input"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t.commentPlaceholder}
                  style={{ resize: 'none', padding: '12px', fontSize: '13px', lineHeight: 1.5 }}
                  required
                />
                
                {/* Character Counter */}
                <div style={{ 
                  textAlign: 'right', 
                  fontSize: '11px', 
                  color: comment.trim().length >= 30 ? '#10b981' : '#f59e0b', 
                  fontWeight: 700, 
                  marginTop: '4px' 
                }}>
                  {comment.trim().length} / 30+ {language === 'ko' ? '자' : 'chars'}
                </div>
              </div>

              {/* AI review assistant card (Requirement 1.2) */}
              <div style={{ 
                padding: '12px', 
                borderRadius: '12px', 
                backgroundColor: 'rgba(95, 92, 230, 0.04)', 
                border: '1px dashed rgba(95, 92, 230, 0.22)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                textAlign: 'left'
              }}>
                <Sparkles size={16} style={{ color: '#5f5ce6', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#5f5ce6', display: 'block' }}>{t.aiAssistantTitle}</span>
                  <span style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px', display: 'block', lineHeight: 1.4 }}>
                    {aiTips[language === 'ko' ? 'ko' : 'en'][aiTipIndex]}
                  </span>
                </div>
              </div>

              {/* Photo Selector (LocalStorage Safe Pre-sets) */}
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#52525b', display: 'block', marginBottom: '8px' }}>
                  {t.photoSelectLabel}
                </label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(6, 1fr)', 
                  gap: '8px' 
                }}>
                  {stockPhotos.map((photo, index) => {
                    const isSelected = selectedPhotoUrl === photo.url;
                    return (
                      <button
                        type="button"
                        key={index}
                        onClick={() => setSelectedPhotoUrl(photo.url)}
                        style={{
                          aspectRatio: '1',
                          padding: 0,
                          borderRadius: '8px',
                          border: isSelected ? '3px solid #5f5ce6' : '1px solid #e4e4e7',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                      >
                        <img 
                          src={photo.url} 
                          alt={photo.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {isSelected && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(95, 92, 230, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 900
                          }}>
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom File Upload Compression for Safety */}
                <div style={{ marginTop: '10px' }}>
                  <label 
                    className="imin-btn imin-btn-outline"
                    style={{ 
                      padding: '8px 12px', 
                      fontSize: '11.5px', 
                      fontWeight: 700, 
                      textAlign: 'center', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      borderColor: '#d4d4d8',
                      color: '#4b5563'
                    }}
                  >
                    <ImageIcon size={14} />
                    <span>{language === 'ko' ? '기기 사진 업로드 (자동 압축)' : 'Upload Custom Image (Auto-Compress)'}</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // FileReader + Canvas resizing to prevent QuotaExceededError (Max 150x150)
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const max_size = 150;
                            let width = img.width;
                            let height = img.height;
                            if (width > height) {
                              if (width > max_size) {
                                height *= max_size / width;
                                width = max_size;
                              }
                            } else {
                              if (height > max_size) {
                                width *= max_size / height;
                                height = max_size;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);
                            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg
                            setSelectedPhotoUrl(compressedBase64);
                          };
                          img.src = event.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {selectedPhotoUrl && selectedPhotoUrl.startsWith('data:') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                      <span>✓</span>
                      <span>{language === 'ko' ? '사용자 이미지가 성공적으로 업로드 및 압축되었습니다.' : 'User image successfully compressed & loaded.'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="imin-btn imin-btn-primary"
                style={{ marginTop: '8px' }}
              >
                {t.submitBtn}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
