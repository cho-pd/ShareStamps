// schema.org JSON-LD 빌더. 서버 HTML에 그대로 박혀 AI/크롤러가 매장을 엔티티로 인식·인용하게 한다.
// (AEO 핵심: Restaurant/LocalBusiness + Menu + AggregateRating + Review + FAQPage)
import { Store, FaqItem, SITE_URL, averageRating } from './stores';

export function buildStoreJsonLd(store: Store) {
  const url = `${SITE_URL}/store/${store.slug}`;
  const reviews = store.reviews ?? [];
  const avg = averageRating(reviews);

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': url,
    name: store.name,
    description: store.description,
    url,
    servesCuisine: store.category,
    priceRange: store.priceRange,
    telephone: store.phone,
    openingHours: store.hours,
    keywords: store.sellingPoints.join(', '),
  };

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

  if (store.menu?.length) {
    json.hasMenu = {
      '@type': 'Menu',
      hasMenuSection: {
        '@type': 'MenuSection',
        name: 'Menu',
        hasMenuItem: store.menu.map((m) => ({
          '@type': 'MenuItem',
          name: m.name,
          description: m.description,
          offers: { '@type': 'Offer', price: m.price.toFixed(2), priceCurrency: store.currency },
        })),
      },
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
