import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { postReviewToSns, enabledNetworks } from '../../lib/snsApi';
import { storage as firebaseStorage } from '../../firebase';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  ArrowLeft, Phone, Clock, Award, Star, Image as ImageIcon, Sparkles, MessageSquarePlus, X, Send, HelpCircle,
  Bookmark, Share2, MoreVertical, Search, SlidersHorizontal, ThumbsUp
} from 'lucide-react';

export const StoreMiniHome: React.FC = () => {
  const {
    stores,
    reviews,
    addReview,
    updateReviewSnsShared,
    donations,
    language,
    currentUser,
    submitSnsShare,
    recordSnsReferral,
    setCustomerSelectedStoreId
  } = useDatabase();

  const [sharingReviewId, setSharingReviewId] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // 내 리뷰를 내 SNS로 원탭 공유 → +1 스탬프 (하루 1장/매장).
  // navigator.share는 클릭 직후 동기로(앞에 await 없이) 호출해야 공유 시트가 뜬다.
  const shareReviewToSns = async (review: { id: string; storeId: string; comment: string; photoUrl?: string }, storeName: string) => {
    const refLink = `${window.location.origin}/#/store-home/${review.storeId}?ref=${currentUser?.id || ''}`;
    const caption = `${review.comment}\n\n📍 ${storeName}\n${refLink}`;
    const nav = navigator as any;
    let opened = false;
    if (nav.share) {
      setSharingReviewId(review.id);
      try {
        await nav.share({ title: storeName, text: caption, url: refLink });
        opened = true;
      } catch (e: any) {
        setSharingReviewId(null);
        if (e && e.name === 'AbortError') return; // 취소 → 스탬프 미지급
      }
      setSharingReviewId(null);
    }
    try { navigator.clipboard?.writeText(caption); } catch (e) { /* ignore */ }
    const res = submitSnsShare(review.storeId, 'other', refLink);
    const okMsg = res.stampAwarded ? (language === 'ko' ? 'SNS 공유 완료! 스탬프 1장 적립 🎉' : 'Shared! +1 stamp 🎉') : res.message;
    setShareToast(
      opened
        ? okMsg
        : (language === 'ko'
            ? `이 브라우저는 공유창 미지원(폰/크롬에서 됨). 캡션 복사됨 — SNS에 붙여넣어 올려주세요.${res.stampAwarded ? ' (+1)' : ''}`
            : `Share sheet not supported here. Caption copied — paste on your SNS.${res.stampAwarded ? ' (+1)' : ''}`)
    );
    setTimeout(() => setShareToast(null), opened ? 2800 : 4500);
  };

  // 해시에서 매장ID 추출 (?ref 같은 쿼리는 제거)
  const parseStoreIdFromHash = () => ((window.location.hash.split('/').pop() || 'store_id_1').split('?')[0]);

  const [storeId, setStoreId] = useState<string>(parseStoreIdFromHash);

  // Listen to hash changes in case of navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.includes('store-home')) {
        setStoreId(parseStoreIdFromHash());
        setActiveTab(getInitialTab());
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 공유 링크(?ref)를 타고 들어온 방문이면 → 게시 확인/유입 기록 (세션당 1회)
  useEffect(() => {
    const query = (window.location.hash.split('?')[1]) || '';
    const ref = new URLSearchParams(query).get('ref');
    if (!ref || !storeId) return;
    const guardKey = `snsref_${ref}_${storeId}`;
    if (sessionStorage.getItem(guardKey)) return;
    let referrerHost = '';
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { /* ignore */ }
    sessionStorage.setItem(guardKey, '1');
    recordSnsReferral(ref, storeId, referrerHost);
  }, [storeId]);

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
  const visibleStoreReviews = storeReviews.slice(0, 5);
  const storeDonations = donations.filter(d => d.storeId === store.id);
  const totalStampsDonated = storeDonations.reduce((acc, d) => acc + d.stampCount, 0);
  const totalMoneyDonated = storeDonations.reduce((acc, d) => acc + d.monetaryValue, 0);

  const avgRating = storeReviews.length > 0 
    ? parseFloat((storeReviews.reduce((sum, r) => sum + r.rating, 0) / storeReviews.length).toFixed(1))
    : 5.0;

  const getInitialTab = (): 'menu' | 'ask' | 'info' | 'faq' | 'reviews' => {
    const query = (window.location.hash.split('?')[1]) || '';
    const tab = new URLSearchParams(query).get('tab');
    if (tab === 'menu' || tab === 'ask' || tab === 'info' || tab === 'faq' || tab === 'reviews') return tab;
    return 'menu';
  };

  const [activeTab, setActiveTab] = useState<'menu' | 'ask' | 'info' | 'faq' | 'reviews'>(getInitialTab);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeTab !== 'reviews') return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }, [activeTab, storeId]);

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
      "🍱 맛과 양, 매장 청결 상태 등에 대해 써주시면 큰 힘이 됩니다.",
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

  // base64 미리보기(데이터 URL)는 Outstand가 가져갈 수 없으므로, 게시 전에
  // Firebase Storage에 올려 공개 URL을 확보한다. (인스타는 이미지 필수)
  const uploadReviewPhotoForSns = async (dataUrl: string): Promise<string> => {
    if (!firebaseStorage || !dataUrl.startsWith('data:')) return '';
    const blob = await (await fetch(dataUrl)).blob();
    const safeUserId = currentUser?.id || 'guest';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`;
    const path = `reviews/${store.id}/${safeUserId}/photo/${fileName}`;
    const uploaded = await uploadBytes(storageRef(firebaseStorage, path), blob, { contentType: 'image/jpeg' });
    return getDownloadURL(uploaded.ref);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
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

    // 리셋 전에 등록/게시에 쓸 값 캡처
    const reviewComment = comment.trim();
    const reviewRating = rating;
    const reviewPhotoBase64 = selectedPhotoUrl;

    // 폼 즉시 닫기 (낙관적 UX)
    setRating(5);
    setComment('');
    setSelectedPhotoUrl('');
    setShowReviewModal(false);

    // 사진을 Firebase Storage에 올려 공개 URL을 확보한다.
    // → 리뷰엔 큰 base64 대신 URL만 저장(공유 Firestore 문서 비대화 방지),
    //   같은 공개 URL을 인스타/페북 자동게시에 그대로 사용. 업로드 실패 시에만 base64 폴백.
    let publicPhotoUrl = '';
    try {
      publicPhotoUrl = await uploadReviewPhotoForSns(reviewPhotoBase64);
    } catch (err) {
      console.error('Review photo upload failed, using inline image:', err);
    }

    const result = addReview(store.id, reviewRating, reviewComment, publicPhotoUrl || reviewPhotoBase64);

    // 매장이 연동한 SNS 채널(페이스북/인스타 등)에 자동 게시.
    // 게시 실패가 리뷰 등록을 막지 않도록 throw하지 않고 조용히 처리한다.
    const networks = enabledNetworks(store.snsSettings as Record<string, boolean> | undefined);
    if (result.reviewId && networks.length) {
      try {
        const r = await postReviewToSns({
          storeId: store.id,
          content: reviewComment,
          mediaUrls: publicPhotoUrl ? [publicPhotoUrl] : [],
          networks,
        });
        if (r.success && Object.keys(r.snsShared).length) {
          updateReviewSnsShared(result.reviewId, r.snsShared);
        } else if (!r.success) {
          console.warn('SNS auto-post from mini-home returned no posted networks.', { networks });
        }
      } catch (err) {
        console.error('SNS auto-post from mini-home failed:', err);
      }
    }
  };

  const t = {
    title: language === 'ko' ? '매장 미니홈피' : 'Store Mini-Home',
    menuTab: language === 'ko' ? '메뉴' : 'Menu',
    askTab: language === 'ko' ? 'Ask' : 'Ask',
    infoTab: language === 'ko' ? '정보·메뉴' : 'Info & Menu',
    faqTab: language === 'ko' ? 'FAQ' : 'FAQ',
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

  const primaryMenu = store.menuItems?.[0];
  const topReview = storeReviews[0];
  const faqItems = language === 'ko' ? [
    {
      q: `${store.name}은 어떤 매장인가요?`,
      a: store.description || `${store.name}은 ${store.category.split(' ')[0]} 카테고리의 ShareStamps 가맹점입니다.`
    },
    {
      q: `${store.name}의 대표 메뉴는 무엇인가요?`,
      a: primaryMenu
        ? `대표 메뉴로 ${primaryMenu.name}${primaryMenu.price ? `($${primaryMenu.price.toFixed(2)})` : ''}을 추천합니다.${primaryMenu.description ? ` ${primaryMenu.description}` : ''}`
        : '아직 등록된 대표 메뉴 정보가 없습니다. 매장 정보가 업데이트되면 메뉴를 확인할 수 있습니다.'
    },
    {
      q: `${store.name} 영업시간은 어떻게 되나요?`,
      a: store.hours || '영업시간 정보는 아직 등록되지 않았습니다. 방문 전 매장에 확인해 주세요.'
    },
    {
      q: `${store.name} 위치와 연락처는 무엇인가요?`,
      a: `${store.address || '주소 정보가 등록되지 않았습니다.'} ${store.phone ? `전화번호는 ${store.phone}입니다.` : '전화번호 정보는 아직 등록되지 않았습니다.'}`
    },
    {
      q: `${store.name} 리뷰 평점은 어떤가요?`,
      a: `${storeReviews.length > 0 ? `${storeReviews.length}개 리뷰 기준 평균 ${avgRating.toFixed(1)}점입니다.` : '아직 고객 리뷰가 많지 않습니다.'}${topReview ? ` 최근 리뷰에서는 “${topReview.comment.slice(0, 80)}${topReview.comment.length > 80 ? '...' : ''}”라고 말했습니다.` : ''}`
    },
    {
      q: `${store.name}에서 ShareStamps 스탬프를 받을 수 있나요?`,
      a: `네. 이 매장은 7개 스탬프 완성 시 ${store.currency || 'USD'} ${store.pointRewardPer7Stamps.toFixed(2)} 상당의 보상을 제공하는 ShareStamps 가맹점입니다.`
    }
  ] : [
    {
      q: `What kind of business is ${store.name}?`,
      a: store.description || `${store.name} is a ShareStamps partner in the ${store.category.split(' ')[0]} category.`
    },
    {
      q: `What is the signature menu at ${store.name}?`,
      a: primaryMenu
        ? `A popular item is ${primaryMenu.name}${primaryMenu.price ? ` ($${primaryMenu.price.toFixed(2)})` : ''}.${primaryMenu.description ? ` ${primaryMenu.description}` : ''}`
        : 'Signature menu information has not been added yet.'
    },
    {
      q: `What are the hours for ${store.name}?`,
      a: store.hours || 'Hours have not been added yet. Please check with the store before visiting.'
    },
    {
      q: `Where is ${store.name} and how can I contact it?`,
      a: `${store.address || 'Address information has not been added yet.'} ${store.phone ? `Phone: ${store.phone}.` : 'Phone information has not been added yet.'}`
    },
    {
      q: `How are the reviews for ${store.name}?`,
      a: `${storeReviews.length > 0 ? `${store.name} has an average rating of ${avgRating.toFixed(1)} from ${storeReviews.length} reviews.` : 'There are not many customer reviews yet.'}${topReview ? ` A recent review says: “${topReview.comment.slice(0, 80)}${topReview.comment.length > 80 ? '...' : ''}”` : ''}`
    },
    {
      q: `Can customers earn ShareStamps at ${store.name}?`,
      a: `Yes. Customers can collect stamps here and receive a ${store.currency || 'USD'} ${store.pointRewardPer7Stamps.toFixed(2)} reward after completing 7 stamps.`
    }
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a
      }
    }))
  };

  const fallbackPhoto = store.thumbnailUrl || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600';
  const heroPhoto = store.bannerUrl || fallbackPhoto;
  const reviewPhotos = storeReviews.filter(r => r.photoUrl).map(r => r.photoUrl as string);
  const photoGallery = [heroPhoto, fallbackPhoto, ...reviewPhotos].filter(Boolean).slice(0, 8);
  const menuItems = store.menuItems && store.menuItems.length > 0
    ? store.menuItems
    : [{ name: language === 'ko' ? '대표 메뉴' : 'Signature item', price: 0, description: store.description }];
  const peopleSay = language === 'ko'
    ? ['친절한 서비스', '다시 방문하고 싶은 곳', '대표 메뉴 추천', '스탬프 혜택']
    : ['Friendly service', 'Worth revisiting', 'Popular menu', 'Stamp rewards'];
  const askSuggestions = language === 'ko'
    ? ['대표 메뉴가 뭐야?', '리뷰에서 많이 나온 장점은?', '영업시간 알려줘', '스탬프 혜택은 어떻게 돼?']
    : ['What is the signature item?', 'What do reviews praise?', 'What are the hours?', 'How do stamp rewards work?'];

  const jumpToSection = (tab: 'menu' | 'ask' | 'info' | 'faq' | 'reviews') => {
    setActiveTab(tab);
    const scrollRoot = scrollRef.current;
    const target = document.getElementById(`store-${tab}`);
    if (!scrollRoot || !target) return;

    const rootRect = scrollRoot.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const navOffset = 66;

    scrollRoot.scrollTo({
      top: Math.max(0, scrollRoot.scrollTop + targetRect.top - rootRect.top - navOffset),
      behavior: 'smooth'
    });
  };

  const openReviewsPage = () => {
    setActiveTab('reviews');
    window.location.hash = `#/store-home/${storeId || store.id}?tab=reviews`;
  };

  const openStoreHome = () => {
    setActiveTab('menu');
    window.location.hash = `#/store-home/${storeId || store.id}?tab=menu`;
  };

  const isReviewsPage = activeTab === 'reviews';

  if (isReviewsPage) {
    return (
      <div ref={scrollRef} style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#ffffff',
        fontFamily: 'var(--font-sans)',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative'
      }}>
        <style>{`.store-mini-scrollbarless::-webkit-scrollbar{display:none}`}</style>

        <header style={{ position: 'sticky', top: 0, zIndex: 20, minHeight: '64px', backgroundColor: '#ffffff', borderBottom: '1px solid #eeeeee', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px' }}>
          <button onClick={openStoreHome} aria-label={t.backBtn} style={{ width: '42px', height: '42px', borderRadius: '50%', border: 'none', backgroundColor: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <ArrowLeft size={23} color="#111111" />
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: '19px', fontWeight: 950, color: '#111111', lineHeight: 1.1 }}>
              {language === 'ko' ? '전체 리뷰' : 'Reviews'}
            </div>
            <div style={{ fontSize: '12px', color: '#71717a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '3px' }}>
              {store.name} · {storeReviews.length} reviews
            </div>
          </div>
          <button
            onClick={() => {
              setErrorMsg(null);
              setCustomerSelectedStoreId(store.id);
              localStorage.setItem('sharestamps_open_sharbee_review_store_id', store.id);
              window.location.hash = '#/customer';
            }}
            style={{ width: '42px', height: '42px', borderRadius: '50%', border: 'none', backgroundColor: 'var(--primary-color)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            aria-label={t.writeReviewBtn}
          >
            <MessageSquarePlus size={21} />
          </button>
        </header>

        <section style={{ padding: '26px 20px 18px', borderBottom: '1px solid #eeeeee', textAlign: 'left' }}>
          <h1 style={{ fontSize: '34px', fontWeight: 950, letterSpacing: '-0.04em', margin: '0 0 24px', lineHeight: 1.05 }}>
            {language === 'ko' ? '추천 리뷰' : 'Recommended reviews'}
          </h1>
          <div>
            <h2 style={{ fontSize: '21px', fontWeight: 900, margin: '0 0 12px' }}>{language === 'ko' ? '전체 평점' : 'Overall rating'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ width: '31px', height: '31px', borderRadius: '6px', backgroundColor: i < Math.round(avgRating) ? 'var(--primary-color)' : '#eeeeee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={19} fill="#ffffff" color="#ffffff" />
                  </span>
                ))}
              </div>
              <strong style={{ fontSize: '20px', fontWeight: 900, color: '#18181b' }}>{avgRating.toFixed(1)}</strong>
              <span style={{ color: '#767676', fontSize: '18px', fontWeight: 650 }}>{storeReviews.length} reviews</span>
            </div>
          </div>
          <div className="store-mini-scrollbarless" style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '26px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {[Search, SlidersHorizontal].map((Icon, idx) => (
              <button key={idx} style={{ flex: '0 0 auto', border: '1.5px solid #d6d6d6', backgroundColor: '#ffffff', borderRadius: '999px', padding: '11px 15px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 850 }}>
                <Icon size={19} /> {idx === 0 ? (language === 'ko' ? '검색' : 'Search') : (language === 'ko' ? '정렬' : 'Sort')}
              </button>
            ))}
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {storeReviews.length > 0 ? (
            storeReviews.map(review => (
              <article key={review.id} style={{ padding: '24px 20px', borderBottom: '1px solid #eeeeee', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#52525b', fontSize: '20px', fontWeight: 950, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {review.userName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 950, color: '#18181b', lineHeight: 1.1 }}>{review.userName}</span>
                        {review.isAIContent && (
                          <span style={{ fontSize: '12px', fontWeight: 900, padding: '3px 7px', borderRadius: '5px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                            {language === 'ko' ? '샤비' : 'AI'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '14px', color: '#71717a', marginTop: '5px', display: 'block', fontWeight: 650 }}>@{review.userNickname}</span>
                    </div>
                  </div>
                  <MoreVertical size={24} color="#111111" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '22px' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ width: '29px', height: '29px', borderRadius: '6px', backgroundColor: i < review.rating ? 'var(--primary-color)' : '#eeeeee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Star size={18} fill="#ffffff" color="#ffffff" />
                      </span>
                    ))}
                  </div>
                  <span style={{ color: '#8a8a8a', fontSize: '16px', fontWeight: 650 }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>

                <p style={{ fontSize: '18px', color: '#202020', lineHeight: 1.48, margin: '18px 0 0', fontWeight: 500, whiteSpace: 'pre-line' }}>
                  {review.comment}
                </p>

                {review.videoUrl && (
                  <div style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#000000', position: 'relative', aspectRatio: '16 / 9', marginTop: '16px' }}>
                    <video src={review.videoUrl} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                )}

                {review.photoUrl && (
                  <div style={{ width: '100%', height: '160px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f4f4f5', marginTop: '16px' }}>
                    <img src={review.photoUrl} alt="Review attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '22px', paddingTop: '14px', borderTop: '1px solid #f0f0f0' }}>
                  {[
                    [ThumbsUp, language === 'ko' ? '도움돼요' : 'Helpful'],
                    [Sparkles, language === 'ko' ? '고마워요' : 'Thanks'],
                    [Award, language === 'ko' ? '좋아요' : 'Love this']
                  ].map(([Icon, label]) => (
                    <button key={String(label)} style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: '#71717a', fontSize: '12px', fontWeight: 750 }}>
                      <Icon size={26} color="#71717a" />
                      {String(label)}
                    </button>
                  ))}
                  {currentUser && review.userId === currentUser.id && (
                    <button type="button" disabled={sharingReviewId === review.id} onClick={() => shareReviewToSns(review, store.name)} style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: 'var(--primary-color)', fontSize: '12px', fontWeight: 800 }}>
                      <Send size={26} color="var(--primary-color)" />
                      {language === 'ko' ? '공유 +1' : 'Share +1'}
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: '#71717a', fontSize: '13px', padding: '40px 0' }}>
              <ImageIcon size={24} style={{ color: '#d4d4d8', margin: '0 auto 8px auto', display: 'block' }} />
              <span>{t.noReviews}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#ffffff',
      fontFamily: 'var(--font-sans)',
      overflowY: 'auto',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <style>{`.store-mini-scrollbarless::-webkit-scrollbar{display:none}`}</style>
      <div style={{ position: 'relative', minHeight: '330px', backgroundColor: '#18181b' }}>
        <img src={heroPhoto} alt={store.name} style={{ width: '100%', height: '330px', objectFit: 'cover', display: 'block', opacity: 0.88 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.12) 38%, rgba(0,0,0,0.82) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
          <button onClick={handleBack} aria-label={t.backBtn} style={{ width: '42px', height: '42px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={24} color="#111111" />
          </button>
          <div style={{ display: 'flex', gap: '14px', color: '#ffffff', alignItems: 'center' }}>
            <Bookmark size={28} />
            <Share2 size={28} />
            <MoreVertical size={28} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: '20px', right: '20px', bottom: '24px', color: '#ffffff', zIndex: 2, textAlign: 'left' }}>
          <h1 style={{ fontSize: '40px', lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.04em', margin: '0 0 12px' }}>{store.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: i < Math.round(avgRating) ? 'var(--primary-color)' : 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star size={17} fill="#ffffff" color="#ffffff" />
                </span>
              ))}
            </div>
            <strong style={{ fontSize: '20px', fontWeight: 800 }}>{avgRating.toFixed(1)}</strong>
            <span style={{ fontSize: '16px', fontWeight: 650, opacity: 0.95 }}>({storeReviews.length} reviews)</span>
          </div>
          <button style={{ width: '100%', border: 'none', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.18)', color: '#ffffff', padding: '11px 16px', fontSize: '15px', fontWeight: 850, backdropFilter: 'blur(8px)' }}>
            {language === 'ko' ? `사진 ${photoGallery.length}장 보기` : `See all ${photoGallery.length} photos`}
          </button>
        </div>
      </div>

      <section style={{ padding: '22px 20px 18px', borderBottom: '1px solid #eeeeee', backgroundColor: '#ffffff', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '21px', fontWeight: 900, color: '#111111', lineHeight: 1.25 }}>
              {store.currency === 'USD' ? '$$' : '$'} · {store.category.replace(/[()]/g, '').replace('카페', '').trim()}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 750, marginTop: '8px', color: '#1f9d84' }}>
              {language === 'ko' ? '영업중' : 'Open'} <span style={{ color: '#71717a', fontWeight: 650 }}>{store.hours || '11:00 AM - 10:00 PM'}</span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '13px', lineHeight: 1.45, color: '#71717a', fontWeight: 600 }}>
              {store.description || (language === 'ko' ? '기분 좋은 서비스와 혜택을 드리는 ShareStamps 가맹점입니다.' : 'A ShareStamps partner with friendly service and rewards.')}
            </p>
          </div>
          <img src={fallbackPhoto} alt={`${store.name} logo`} style={{ width: '76px', height: '76px', borderRadius: '18px', objectFit: 'cover', border: '1px solid #eeeeee' }} />
        </div>
        <div className="store-mini-scrollbarless" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingTop: '20px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {[
            { icon: MessageSquarePlus, label: t.writeReviewBtn, primary: true, action: () => { setErrorMsg(null); setCustomerSelectedStoreId(store.id); localStorage.setItem('sharestamps_open_sharbee_review_store_id', store.id); window.location.hash = '#/customer'; } },
            { icon: Sparkles, label: 'Ask', action: () => jumpToSection('ask') },
            { icon: Clock, label: language === 'ko' ? '정보' : 'Info', action: () => jumpToSection('info') },
            { icon: Phone, label: language === 'ko' ? '전화' : 'Call', action: () => { if (store.phone) window.location.href = `tel:${store.phone}`; } }
          ].map(item => (
            <button key={item.label} onClick={item.action} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '9px', minHeight: '56px', padding: '0 20px', borderRadius: '999px', border: 'none', backgroundColor: item.primary ? 'var(--primary-color)' : (item.icon === Sparkles ? 'var(--primary-light)' : '#f1f1f1'), color: item.primary ? '#ffffff' : (item.icon === Sparkles ? 'var(--primary-color)' : '#27272a'), fontSize: '16px', fontWeight: 900, cursor: 'pointer' }}>
              <item.icon size={23} />
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <nav className="store-mini-scrollbarless" style={{ display: 'flex', alignItems: 'stretch', minHeight: '64px', borderBottom: '1px solid #e5e5e5', backgroundColor: '#ffffff', position: 'relative', zIndex: 9, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {([
          ['menu', t.menuTab],
          ['ask', t.askTab],
          ['info', language === 'ko' ? '정보' : 'Info'],
          ['reviews', language === 'ko' ? '리뷰' : 'Reviews'],
          ['faq', 'FAQ']
        ] as const).map(([tab, label]) => {
          const isActive = activeTab === tab;
          return (
            <button key={tab} onClick={() => tab === 'reviews' ? openReviewsPage() : jumpToSection(tab)} style={{ flex: '0 0 auto', minWidth: '92px', padding: '19px 18px 14px', border: 'none', borderBottom: isActive ? '4px solid var(--primary-color)' : '4px solid transparent', background: '#ffffff', color: isActive ? 'var(--primary-color)' : '#6b6b6b', fontSize: '18px', fontWeight: isActive ? 900 : 750, cursor: 'pointer' }}>
              {label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, paddingBottom: '104px', backgroundColor: '#ffffff' }}>

        <section id="store-menu" style={{ padding: '22px 20px', textAlign: 'left', scrollMarginTop: '70px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
              <h2 style={{ fontSize: '31px', fontWeight: 950, letterSpacing: '-0.04em', margin: 0 }}>{language === 'ko' ? '메뉴' : 'Menu'}</h2>
              <ArrowLeft size={28} style={{ transform: 'rotate(180deg)' }} />
            </div>
            <h3 style={{ fontSize: '21px', fontWeight: 900, margin: '0 0 14px' }}>{language === 'ko' ? '인기 메뉴' : 'Popular Dishes'}</h3>
            <div className="store-mini-scrollbarless" style={{ display: 'flex', gap: '18px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {menuItems.map((item, idx) => (
                <div key={`${item.name}-${idx}`} style={{ flex: '0 0 252px' }}>
                  <div style={{ position: 'relative', height: '172px', borderRadius: '9px', overflow: 'hidden', backgroundColor: '#f4f4f5' }}>
                    <img src={photoGallery[idx % photoGallery.length] || fallbackPhoto} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {item.price > 0 && <span style={{ position: 'absolute', left: '16px', bottom: '14px', color: '#ffffff', fontSize: '24px', fontWeight: 950, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>${item.price.toFixed(2)}</span>}
                  </div>
                  <h4 style={{ fontSize: '21px', fontWeight: 950, margin: '14px 0 7px', color: '#111111', lineHeight: 1.15 }}>{item.name}</h4>
                  <p style={{ fontSize: '14px', color: '#767676', margin: 0, fontWeight: 650 }}>{Math.max(1, storeReviews.length * (idx + 1))} reviews</p>
                </div>
              ))}
            </div>
            <button style={{ width: '100%', border: '1.5px solid #cfcfcf', backgroundColor: '#ffffff', borderRadius: '999px', padding: '15px', fontSize: '18px', fontWeight: 850, marginTop: '18px' }}>
              {language === 'ko' ? '전체 메뉴 보기' : 'See full menu'}
            </button>
        </section>

        <section id="store-ask" style={{ textAlign: 'left', scrollMarginTop: '70px' }}>
            <section style={{ padding: '22px 20px', borderBottom: '12px solid #f2f2f2' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 18px' }}>{language === 'ko' ? '사람들이 말해요' : 'People say'}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
                {peopleSay.map((item, idx) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', fontWeight: 700, color: '#52525b' }}>
                    {idx % 2 === 0 ? <Sparkles size={28} color="#27213f" /> : <Award size={28} color="#27213f" />}
                    {item}
                  </div>
                ))}
              </div>
            </section>
            <section style={{ padding: '26px 20px', borderBottom: '12px solid #f2f2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div style={{ width: '62px', height: '62px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={28} color="var(--primary-color)" />
                </div>
                <h2 style={{ fontSize: '28px', fontWeight: 950, margin: 0 }}>{language === 'ko' ? 'Ask Sharbee Assistant' : 'Ask Sharbee Assistant'}</h2>
              </div>
              <div style={{ border: '1.5px solid #cfcfcf', borderRadius: '8px', height: '66px', display: 'flex', alignItems: 'center', padding: '0 10px 0 16px', gap: '10px' }}>
                <span style={{ flex: 1, color: '#8a8a8a', fontSize: '18px', fontWeight: 500 }}>{language === 'ko' ? '“리뷰에서는 뭐라고 말해?”' : 'Ask, “What do reviews say?”'}</span>
                <button style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', backgroundColor: 'var(--primary-color)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowLeft size={24} style={{ transform: 'rotate(180deg)' }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
                {askSuggestions.map(q => (
                  <button key={q} style={{ border: 'none', borderRadius: '999px', backgroundColor: '#f0f0f0', padding: '12px 16px', fontSize: '14px', fontWeight: 750, color: '#2f2f2f' }}>{q}</button>
                ))}
              </div>
            </section>
        </section>

        <section id="store-info" style={{ textAlign: 'left', scrollMarginTop: '70px' }}>
            <section style={{ padding: '24px 20px', borderBottom: '12px solid #f2f2f2' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 14px' }}>{language === 'ko' ? '매장 정보' : 'Info'}</h2>
              {[
                [Clock, store.hours || '07:00 ~ 22:00'],
                [Phone, store.phone || '02-123-4567'],
                [Award, language === 'ko' ? `7개 적립 시 ${store.currency} ${store.pointRewardPer7Stamps.toFixed(2)} 보상` : `${store.currency} ${store.pointRewardPer7Stamps.toFixed(2)} after 7 stamps`]
              ].map(([Icon, text]) => (
                <div key={String(text)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', fontSize: '16px', fontWeight: 700, color: '#3f3f46' }}>
                  <Icon size={22} color="#27213f" />
                  <span>{String(text)}</span>
                </div>
              ))}
            </section>
            <section style={{ padding: '24px 20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 14px' }}>{language === 'ko' ? '나눔 임팩트' : 'Impact'}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ borderRadius: '14px', backgroundColor: '#f7f7f7', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#71717a', fontWeight: 700 }}>{t.totalDonatedLabel}</div>
                  <div style={{ fontSize: '28px', color: 'var(--primary-color)', fontWeight: 950 }}>{totalStampsDonated}</div>
                </div>
                <div style={{ borderRadius: '14px', backgroundColor: '#f7f7f7', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#71717a', fontWeight: 700 }}>{t.totalMoneyLabel}</div>
                  <div style={{ fontSize: '28px', color: '#1f9d84', fontWeight: 950 }}>${totalMoneyDonated.toFixed(2)}</div>
                </div>
              </div>
            </section>
        </section>

        <section id="store-faq" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '22px 20px', borderTop: '12px solid #f2f2f7', scrollMarginTop: '70px' }}>
            <div style={{
              padding: '18px 16px',
              borderRadius: '18px',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid rgba(95, 92, 230, 0.18)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <HelpCircle size={20} color="var(--primary-color)" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#18181b', margin: '0 0 6px' }}>
                  {language === 'ko' ? '자주 묻는 질문' : 'Common Questions'}
                </h3>
                <p style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--primary-hover)', margin: 0, fontWeight: 650 }}>
                  {language === 'ko'
                    ? '방문 전 손님들이 자주 확인하는 메뉴, 영업시간, 리뷰, 스탬프 혜택을 정리했어요.'
                    : 'Quick answers about the store, menu, hours, reviews, and stamp benefits.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {faqItems.map((item, idx) => (
                <details
                  key={item.q}
                  open={idx < 2}
                  style={{
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #ececec',
                    boxShadow: '0 8px 18px rgba(0,0,0,0.04)',
                    overflow: 'hidden'
                  }}
                >
                  <summary style={{
                    padding: '15px 16px',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: 850,
                    color: '#18181b',
                    lineHeight: 1.35,
                    textAlign: 'left'
                  }}>
                    {item.q}
                  </summary>
                  <div style={{
                    padding: '0 16px 16px',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    color: '#52525b',
                    textAlign: 'left',
                    fontWeight: 500
                  }}>
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
        </section>

        <section id="store-reviews" style={{ textAlign: 'left', borderTop: '12px solid #f2f2f7', scrollMarginTop: '70px' }}>
            <section style={{ padding: '26px 20px 18px', borderBottom: '1px solid #eeeeee' }}>
              <h2 style={{ fontSize: '30px', fontWeight: 950, letterSpacing: '-0.04em', margin: '0 0 24px' }}>{language === 'ko' ? '추천 리뷰' : 'Recommended reviews'}</h2>
              <div>
                <h3 style={{ fontSize: '21px', fontWeight: 900, margin: '0 0 12px' }}>{language === 'ko' ? '전체 평점' : 'Overall rating'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{ width: '31px', height: '31px', borderRadius: '6px', backgroundColor: i < Math.round(avgRating) ? 'var(--primary-color)' : '#eeeeee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Star size={19} fill="#ffffff" color="#ffffff" />
                      </span>
                    ))}
                  </div>
                  <strong style={{ fontSize: '20px', fontWeight: 900, color: '#18181b' }}>{avgRating.toFixed(1)}</strong>
                  <span style={{ color: '#767676', fontSize: '18px', fontWeight: 650 }}>{storeReviews.length} reviews</span>
                </div>
              </div>
              <div className="store-mini-scrollbarless" style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '26px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {[Search, SlidersHorizontal].map((Icon, idx) => (
                  <button key={idx} style={{ flex: '0 0 auto', border: '1.5px solid #d6d6d6', backgroundColor: '#ffffff', borderRadius: '999px', padding: '11px 15px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 850 }}>
                    <Icon size={19} /> {idx === 0 ? (language === 'ko' ? '검색' : 'Search') : (language === 'ko' ? '정렬' : 'Sort')}
                  </button>
                ))}
              </div>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleStoreReviews.length > 0 ? (
                visibleStoreReviews.map(review => (
                  <article key={review.id} style={{ padding: '24px 20px', borderBottom: '1px solid #eeeeee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          backgroundColor: '#dbeafe',
                          color: '#52525b',
                          fontSize: '20px',
                          fontWeight: 950,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {review.userName.charAt(0)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 950, color: '#18181b', lineHeight: 1.1 }}>{review.userName}</span>
                            {review.isAIContent && (
                              <span style={{ fontSize: '12px', fontWeight: 900, padding: '3px 7px', borderRadius: '5px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                                {language === 'ko' ? '샤비' : 'AI'}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '14px', color: '#71717a', marginTop: '5px', display: 'block', fontWeight: 650 }}>@{review.userNickname}</span>
                        </div>
                      </div>
                      <MoreVertical size={24} color="#111111" />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '22px' }}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} style={{ width: '29px', height: '29px', borderRadius: '6px', backgroundColor: i < review.rating ? 'var(--primary-color)' : '#eeeeee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Star size={18} fill="#ffffff" color="#ffffff" />
                          </span>
                        ))}
                      </div>
                      <span style={{ color: '#8a8a8a', fontSize: '16px', fontWeight: 650 }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p style={{ fontSize: '18px', color: '#202020', lineHeight: 1.48, margin: '18px 0 0', fontWeight: 500, whiteSpace: 'pre-line' }}>
                      {review.comment}
                    </p>

                    {review.videoUrl && (
                      <div style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#000000', position: 'relative', aspectRatio: '16 / 9', marginTop: '16px' }}>
                        <video 
                          src={review.videoUrl} 
                          controls 
                          playsInline
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    )}

                    {review.photoUrl && (
                      <div style={{ width: '100%', height: '160px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f4f4f5', marginTop: '16px' }}>
                        <img 
                          src={review.photoUrl} 
                          alt="Review attachment" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '22px', paddingTop: '14px', borderTop: '1px solid #f0f0f0' }}>
                      {[
                        [ThumbsUp, language === 'ko' ? '도움돼요' : 'Helpful'],
                        [Sparkles, language === 'ko' ? '고마워요' : 'Thanks'],
                        [Award, language === 'ko' ? '좋아요' : 'Love this']
                      ].map(([Icon, label]) => (
                        <button key={String(label)} style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: '#71717a', fontSize: '12px', fontWeight: 750 }}>
                          <Icon size={26} color="#71717a" />
                          {String(label)}
                        </button>
                      ))}
                      {currentUser && review.userId === currentUser.id && (
                        <button type="button" disabled={sharingReviewId === review.id} onClick={() => shareReviewToSns(review, store.name)} style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: 'var(--primary-color)', fontSize: '12px', fontWeight: 800 }}>
                          <Send size={26} color="var(--primary-color)" />
                          {language === 'ko' ? '공유 +1' : 'Share +1'}
                        </button>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: '#71717a', fontSize: '13px', padding: '40px 0' }}>
                  <ImageIcon size={24} style={{ color: '#d4d4d8', margin: '0 auto 8px auto', display: 'block' }} />
                  <span>{t.noReviews}</span>
                </div>
              )}
            </div>
            {storeReviews.length > visibleStoreReviews.length && (
              <div style={{ padding: '18px 20px 26px', borderTop: '1px solid #eeeeee' }}>
                <button onClick={openReviewsPage} style={{ width: '100%', border: '1.5px solid #d6d6d6', backgroundColor: '#ffffff', borderRadius: '999px', padding: '15px', fontSize: '17px', fontWeight: 900, color: '#18181b' }}>
                  {language === 'ko' ? `전체 리뷰 ${storeReviews.length}개 보기` : `See all ${storeReviews.length} reviews`}
                </button>
              </div>
            )}
        </section>

      </div>

      <div className="store-mini-scrollbarless" style={{ position: 'sticky', bottom: 0, zIndex: 20, backgroundColor: '#ffffff', borderTop: '1px solid #ececec', padding: '13px 14px', display: 'flex', gap: '10px', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', boxShadow: '0 -8px 20px rgba(0,0,0,0.08)' }}>
        {[
          { icon: MessageSquarePlus, label: t.writeReviewBtn, primary: true, action: () => { setErrorMsg(null); setCustomerSelectedStoreId(store.id); localStorage.setItem('sharestamps_open_sharbee_review_store_id', store.id); window.location.hash = '#/customer'; } },
          { icon: Sparkles, label: 'Ask', action: () => jumpToSection('ask') },
          { icon: Phone, label: language === 'ko' ? '전화' : 'Call', action: () => { if (store.phone) window.location.href = `tel:${store.phone}`; } }
        ].map(item => (
          <button key={item.label} onClick={item.action} style={{ flex: '0 0 auto', minWidth: item.primary ? '150px' : '112px', height: '56px', borderRadius: '999px', border: 'none', backgroundColor: item.primary ? 'var(--primary-color)' : (item.icon === Sparkles ? 'var(--primary-light)' : '#eeeeee'), color: item.primary ? '#ffffff' : (item.icon === Sparkles ? 'var(--primary-color)' : '#27272a'), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '17px', fontWeight: 900 }}>
            <item.icon size={24} />
            {item.label}
          </button>
        ))}
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

                        // 캔버스 리사이즈. 인스타 자동게시는 최소 픽셀/비율 요건이 있어
                        // 긴 변 1080px까지 허용(IG 권장 크기). 게시 전 Firebase Storage로
                        // 업로드하므로 큰 base64가 DB 공유 문서에 박히지 않는다.
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const max_size = 1080;
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
                            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85); // 85% quality jpeg
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

      {shareToast && (
        <div style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', backgroundColor: '#141413', color: '#fff', padding: '10px 18px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, zIndex: 2000, boxShadow: '0 6px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>
          {shareToast}
        </div>
      )}
    </div>
  );
};
