// schema.org JSON-LD 빌더. 서버 HTML에 그대로 박혀 AI/크롤러가 매장을 엔티티로 인식·인용하게 한다.
// (AEO 핵심: Restaurant/LocalBusiness + Menu + AggregateRating + Review + FAQPage)
import { Store, FaqItem, SITE_URL, averageRating } from './stores';
import { menuSampleImage } from './menuImages';

// 카테고리로 스키마 타입 결정. 음식점만 Restaurant(+servesCuisine/hasMenu), 그 외엔 LocalBusiness.
// (세탁소·미용실 등에 Restaurant/servesCuisine를 찍으면 잘못된 엔티티 신호 → AI 인용 신뢰 훼손)
const FOOD_HINTS = ['restaurant', 'pizza', 'chicken', 'cafe', 'coffee', 'food', 'korean', 'bar', 'bakery', 'dessert', 'grill', 'kitchen', 'bbq', 'noodle', 'sushi', 'ramen', 'taco', 'burger', 'deli', 'bistro', 'eatery', 'diner', 'pub', 'brunch', 'chinese', 'japanese', 'thai', 'mexican', 'pho', 'boba', 'tea'];
function isFoodBusiness(category: string): boolean {
  const c = (category || '').toLowerCase();
  return FOOD_HINTS.some((h) => c.includes(h));
}
// sameAs 값은 절대 URL이어야 AI가 엔티티로 따라간다. 스킴 없으면 https:// 보정.
const toAbsoluteUrl = (v: string): string => (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`);

export function buildStoreJsonLd(store: Store) {
  const url = `${SITE_URL}/store/${store.slug}`;
  const reviews = store.reviews ?? [];
  const avg = averageRating(reviews);
  const isFood = isFoodBusiness(store.category);

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': isFood ? 'Restaurant' : 'LocalBusiness',
    '@id': url,
    name: store.name,
    description: store.description,
    url,
    priceRange: store.priceRange,
    telephone: store.phone,
    openingHours: store.hours,
    keywords: store.sellingPoints.join(', '),
  };
  // servesCuisine 은 음식점에만 (LocalBusiness엔 무의미)
  if (isFood) json.servesCuisine = store.category;

  // sameAs: 미니홈 ↔ 외부 채널(SNS·Yelp·GBP·홈페이지) 링크 그래프 = 엔티티 신뢰 신호(헌터 AEO §1-B).
  const sameAs = Object.values(store.socialLinks ?? {}).map((v) => (v || '').trim()).filter(Boolean).map(toAbsoluteUrl);
  if (sameAs.length) json.sameAs = sameAs;

  if (store.thumbnailUrl || store.bannerUrl) {
    json.image = [store.bannerUrl, store.thumbnailUrl].filter(Boolean);
  }

  if (store.address) {
    json.address = {
      '@type': 'PostalAddress',
      streetAddress: store.address.street,
      addressLocality: store.address.city,
      addressRegion: store.address.region,
      postalCode: store.address.postalCode,
      addressCountry: store.address.country,
    };
  }

  if (store.geo) {
    json.geo = { '@type': 'GeoCoordinates', latitude: store.geo.lat, longitude: store.geo.lng };
  }

  // 음성검색 답변 구간 지정 (TL;DR 박스 + 제목)
  json.speakable = { '@type': 'SpeakableSpecification', cssSelector: ['#tldr', 'h1'] };

  const menu = (store.menu ?? []).filter((m) => !m.hidden);
  if (isFood && menu.length) {
    // 6 카테고리별 MenuSection으로 분리 + 각 MenuItem에 사진(image)·다중가격(Offer) 마크업 → AI가 dish 단위로 인용
    const byCat: Record<string, typeof menu> = {};
    menu.forEach((m) => { const c = m.category || 'Menu'; (byCat[c] = byCat[c] || []).push(m); });
    json.hasMenu = {
      '@type': 'Menu',
      hasMenuSection: Object.entries(byCat).map(([cat, items]) => ({
        '@type': 'MenuSection',
        name: cat,
        hasMenuItem: items.map((m) => {
          const img = m.imageUrl || menuSampleImage(m.name, m.category);
          const item: Record<string, unknown> = {
            '@type': 'MenuItem',
            name: m.name,
            offers: m.variants?.length
              ? m.variants.map((v) => ({ '@type': 'Offer', name: v.label, price: v.price.toFixed(2), priceCurrency: store.currency }))
              : { '@type': 'Offer', price: m.price.toFixed(2), priceCurrency: store.currency },
          };
          if (m.description) item.description = m.description;
          if (img) item.image = img;
          return item;
        }),
      })),
    };
  }

  if (reviews.length) {
    json.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: avg.toFixed(1),
      reviewCount: reviews.length,
      bestRating: '5',
      worstRating: '1',
    };
    json.review = reviews.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      datePublished: r.createdAt,
      reviewRating: { '@type': 'Rating', ratingValue: String(r.rating), bestRating: '5', worstRating: '1' },
      reviewBody: r.comment,
    }));
  }

  return json;
}

export function buildFaqJsonLd(faq: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
