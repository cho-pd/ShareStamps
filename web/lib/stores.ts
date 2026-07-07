// 매장 데이터 접근 계층.
// 지금은 seed(인메모리)로 동작하지만, 시그니처를 Firestore 연결 시 그대로 유지하도록 async로 둔다.
// P2에서 이 파일의 getAllStores/getStoreBySlug 내부만 per-store Firestore 읽기로 교체한다.
// 데이터 모델: stores/{storeId} + stores/{storeId}/menuItems + stores/{storeId}/reviews

// 서빙 도메인이 www (apex는 308→www) → canonical/스키마/sitemap/OG를 www로 통일해 AEO 신호 일관성 확보.
export const SITE_URL = 'https://www.sharestamps.com';

export interface MenuItem {
  id: string;
  name: string;
  price: number;              // 단일가 + 하위호환. variants 있으면 그쪽이 우선.
  description?: string;
  signature?: boolean;
  category?: string;          // 카테고리(그룹핑용)
  variants?: { label: string; price: number }[]; // 다중가: 예 [{label:'R',price:17.99},{label:'L',price:22.99}]
  soldOut?: boolean;          // 품절 토글
  hidden?: boolean;           // AI 미니홈/샤비 노출 제외
  spicy?: boolean;            // 매운맛 표시(뱃지)
  order?: number;             // 카테고리 내 정렬
  imageUrl?: string;          // 메뉴 사진(Firebase Storage 공개 URL). "말하면 사진 팝업"의 원천.
  imageSample?: boolean;      // 우리가 심은 샘플 사진(스톡). 점주가 실사진 올리면 false로. "샘플" 뱃지 표시용.
}

// 손님 주문 화면·점주 편집의 표준 6 카테고리 (자유입력 금지 — enum 고정)
export const MENU_CATEGORIES = ['STARTERS', 'SIDE MEAL', 'PIZZA', 'CHICKEN', 'PASTA', 'DRINKS'] as const;

export interface Review {
  id: string;
  author: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string; // ISO
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  category: string;        // 예: "Korean Restaurant", "Cafe"
  currency: string;        // "USD"
  description: string;
  hours: string;           // "11:00 AM - 10:00 PM"
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;       // 주
    postalCode?: string;
    country?: string;      // "US"
  };
  priceRange?: string;     // "$$"
  sellingPoints: string[]; // AEO 키워드 원천
  pointRewardPer7Stamps: number;
  earningIntervalMinutes?: number; // 재적립 최소 간격(분), 점주 설정. 기본 60.
  geo?: { lat: number; lng: number }; // LocalBusiness 위/경도 (AEO 지역 매칭)
  // 매장의 외부 채널 URL(플랫폼키→URL). schema.org `sameAs`(엔티티 링크 그래프)와 손님 미니홈 "링크 허브"의 단일 진실 소스.
  // ⚠️ snsChannels(자동배포 연결 플래그)와 별개 — 이건 "손님에게 보여줄/AI가 따라갈 URL".
  socialLinks?: Record<string, string>; // 예: { instagram: 'instagram.com/store', yelp: '...', google: '...' }
  thumbnailUrl?: string;
  bannerUrl?: string;
  chatbotMenu?: string;    // 점주 설정: 메뉴 추천 챗봇 맞춤 안내(성격/추천 포인트)
  chatbotReview?: string;  // 점주 설정: 리뷰 챗봇 맞춤 안내(물어볼 포인트/톤)
  faqs?: FaqItem[];        // 점주 설정: AI 미니홈 FAQ(있으면 자동생성 대신 사용)
  protected?: boolean;     // 기본 보호 매장(삭제 불가)
  menu: MenuItem[];
  reviews: Review[];
}

// ShareStamps 기본 보호 매장 — 코드 정의라 항상 존재하고 삭제할 수 없다.
export const SHARESTAMPS_STORE: Store = {
  id: 'store_sharestamps',
  slug: 'sharestamps',
  name: 'ShareStamps',
  category: 'Other',
  currency: 'USD',
  description: '동네 가게를 AI 검색(AEO/GEO)에 노출시키는 스탬프 로열티 플랫폼 — ShareStamps 공식 매장입니다.',
  hours: '24/7',
  priceRange: '$$',
  sellingPoints: ['stamp loyalty', 'AEO', 'GEO', 'local stores', 'Sharbee'],
  pointRewardPer7Stamps: 5,
  earningIntervalMinutes: 60,
  protected: true,
  thumbnailUrl: '/sharbee/sharbee5.png',
  menu: [],
  reviews: [],
};

// ── seed (P1 검증용) ─────────────────────────────────────────────
const SEED_STORES: Store[] = [
  {
    id: 'store_loveletter',
    slug: 'loveletter-fullerton',
    name: 'Love Letter Pizza & Chicken',
    category: 'Korean Pizza & Chicken',
    currency: 'USD',
    description:
      'Love Letter Pizza & Chicken is a K-style (Korean) pizza and fried chicken spot in La Habra, CA. Known for its signature Sweet Potato Pizza (고구마 피자), Kimchi Pizza, Korean fried chicken and wings, and K-pasta — plus soju, draft beer, and combo specials. (loveletterusa.com)',
    hours: '11:00 AM - 10:00 PM',
    phone: '+1-714-446-9904',
    address: {
      street: '1180 S. Idaho St #D',
      city: 'La Habra',
      region: 'CA',
      postalCode: '90631',
      country: 'US',
    },
    priceRange: '$$',
    sellingPoints: ['K-style Korean pizza', 'Korean fried chicken', 'Sweet Potato Pizza', 'Kimchi Pizza', 'chicken wings', 'soju & draft beer'],
    socialLinks: { website: 'https://loveletterusa.com' },
    pointRewardPer7Stamps: 5,
    menu: [
      { id: 'll-sp-01', name: 'Sweet Potato Pizza', price: 17.99, category: 'PIZZA', description: '고구마 청크, 화이트소스, 햄, 양파, 소시지, 파인애플, 피망, 콘, 치즈', signature: true, variants: [{ label: 'R', price: 17.99 }, { label: 'L', price: 22.99 }] },
      { id: 'll-sp-02', name: 'Kimchi Pizza', price: 17.99, category: 'PIZZA', description: '김치, 소시지, 햄, 베이컨, 양파, 피망, 버섯, 할라피뇨, 치즈', spicy: true, variants: [{ label: 'R', price: 17.99 }, { label: 'L', price: 22.99 }] },
      { id: 'll-fc-01', name: 'Original Fried Chicken', price: 14.99, category: 'CHICKEN', description: '한국식 후라이드 (Half/Whole)', spicy: true, variants: [{ label: 'Half', price: 14.99 }, { label: 'Whole', price: 27.99 }] },
      { id: 'll-wg-01', name: 'Original Fried Wings (10pc)', price: 20.99, category: 'CHICKEN', description: '싱글 배터 윙', spicy: true },
    ],
    reviews: [
      { id: 'r1', author: 'Jamie', rating: 5, comment: 'The Sweet Potato Pizza is unreal — sweet, savory, so K-style. Crispy juicy fried chicken too.', createdAt: '2026-06-20T19:05:00Z' },
      { id: 'r2', author: 'Min', rating: 5, comment: 'Kimchi pizza + a bottle of soju = perfect night. Cozy spot in La Habra.', createdAt: '2026-06-22T18:40:00Z' },
      { id: 'r3', author: 'Alex', rating: 4, comment: 'First time trying Korean-style pizza and I get the hype. The combo special is a great deal.', createdAt: '2026-06-24T20:10:00Z' },
    ],
  },
];

// Firestore에서 per-store 모델(stores/{id} + menuItems + reviews)을 읽는다.
// 비어있거나 오류면 seed로 폴백 → 빌드/런타임이 항상 안전.
async function fetchStoresFromFirestore(): Promise<Store[] | null> {
  try {
    const { getDb } = await import('./firebase');
    const { collection, getDocs } = await import('firebase/firestore');
    const db = getDb();
    const storeSnap = await getDocs(collection(db, 'stores'));
    if (storeSnap.empty) return null;

    const stores: Store[] = [];
    for (const d of storeSnap.docs) {
      const data = d.data() as Omit<Store, 'menu' | 'reviews'>;
      const [menuSnap, reviewSnap] = await Promise.all([
        getDocs(collection(db, 'stores', d.id, 'menuItems')),
        getDocs(collection(db, 'stores', d.id, 'reviews')),
      ]);
      stores.push({
        ...data,
        id: d.id,
        menu: menuSnap.docs.map((m) => ({ id: m.id, ...(m.data() as Omit<MenuItem, 'id'>) })),
        reviews: reviewSnap.docs
          .map((r) => ({ id: r.id, ...(r.data() as Omit<Review, 'id'>) }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      });
    }
    return stores;
  } catch (e) {
    console.warn('[stores] Firestore read failed, using seed fallback:', (e as Error)?.message);
    return null;
  }
}

export async function getAllStores(): Promise<Store[]> {
  const fromDb = await fetchStoresFromFirestore();
  const list = fromDb ?? SEED_STORES;
  // ShareStamps 기본 보호 매장은 항상 포함(삭제 불가)
  return list.some((s) => s.slug === 'sharestamps') ? list : [SHARESTAMPS_STORE, ...list];
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const stores = await getAllStores();
  return stores.find((s) => s.slug === slug) ?? null;
}

export function averageRating(reviews: Review[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}
