// 매장 데이터 접근 계층.
// 지금은 seed(인메모리)로 동작하지만, 시그니처를 Firestore 연결 시 그대로 유지하도록 async로 둔다.
// P2에서 이 파일의 getAllStores/getStoreBySlug 내부만 per-store Firestore 읽기로 교체한다.
// 데이터 모델: stores/{storeId} + stores/{storeId}/menuItems + stores/{storeId}/reviews

export const SITE_URL = 'https://sharestamps.com';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  signature?: boolean;
}

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
  thumbnailUrl?: string;
  bannerUrl?: string;
  menu: MenuItem[];
  reviews: Review[];
}

// ── seed (P1 검증용) ─────────────────────────────────────────────
const SEED_STORES: Store[] = [
  {
    id: 'store_loveletter',
    slug: 'loveletter-fullerton',
    name: 'LOVELETTER',
    category: 'Korean Restaurant',
    currency: 'USD',
    description:
      'A cozy Korean restaurant in Fullerton serving honey bread, soondubu (soft tofu stew), and bibimbap. Friendly service, fresh daily ingredients, and a warm atmosphere for families and first-timers.',
    hours: '11:00 AM - 10:00 PM',
    phone: '+1-714-555-0142',
    address: {
      street: '123 Commonwealth Ave',
      city: 'Fullerton',
      region: 'CA',
      postalCode: '92832',
      country: 'US',
    },
    priceRange: '$$',
    sellingPoints: ['Korean comfort food', 'fresh daily', 'soondubu', 'honey bread', 'family friendly'],
    pointRewardPer7Stamps: 5,
    menu: [
      { id: 'm_honeybread', name: 'Honey Bread', price: 8.99, description: 'Sweet, warm signature dessert', signature: true },
      { id: 'm_soondubu', name: 'Soondubu (Soft Tofu Stew)', price: 13.99, description: 'Spicy soft tofu stew, choose your spice level', signature: true },
      { id: 'm_bibimbap', name: 'Bibimbap', price: 14.99, description: 'Rice bowl with seasoned vegetables and egg' },
      { id: 'm_bulgogi', name: 'Bulgogi', price: 17.99, description: 'Marinated grilled beef' },
    ],
    reviews: [
      { id: 'r1', author: 'Jamie', rating: 5, comment: 'The soondubu was rich and not too salty. Cozy spot, kind staff.', createdAt: '2026-06-20T19:05:00Z' },
      { id: 'r2', author: 'Min', rating: 4, comment: 'Honey bread is a must — sweet and warm. Will visit again.', createdAt: '2026-06-22T18:40:00Z' },
      { id: 'r3', author: 'Alex', rating: 5, comment: 'First time trying Korean food and the staff explained the menu. Loved the bibimbap.', createdAt: '2026-06-24T20:10:00Z' },
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
  return fromDb ?? SEED_STORES;
}

export async function getStoreBySlug(slug: string): Promise<Store | null> {
  const stores = await getAllStores();
  return stores.find((s) => s.slug === slug) ?? null;
}

export function averageRating(reviews: Review[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}
