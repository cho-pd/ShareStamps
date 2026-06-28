import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllStores, getStoreBySlug, averageRating, SITE_URL, type FaqItem, type Store } from '@/lib/stores';
import { buildStoreJsonLd, buildFaqJsonLd } from '@/lib/schema';
import StampButton from './StampButton';
import SharbeeChat from './SharbeeChat';
import ReviewForm from './ReviewForm';

// ISR: 매장 페이지를 캐시로 서빙하되 최대 60초마다 갱신 → 새 리뷰·정보가 ~1분 내 반영(크롤 친화 + 비용 미미).
export const revalidate = 60;

export async function generateStaticParams() {
  const stores = await getAllStores();
  return stores.map((s) => ({ slug: s.slug }));
}

function buildFaq(store: Store): FaqItem[] {
  const signatures = store.menu.filter((m) => m.signature).map((m) => m.name);
  const cityLine = store.address?.city ? ` in ${store.address.city}${store.address.region ? ', ' + store.address.region : ''}` : '';
  return [
    {
      q: `What is ${store.name} known for?`,
      a: `${store.name} is a ${store.category.toLowerCase()}${cityLine}. ${store.description}`,
    },
    {
      q: `What are the signature dishes at ${store.name}?`,
      a: signatures.length ? `Signature items include ${signatures.join(', ')}.` : `Ask staff for today's recommendations.`,
    },
    { q: `What are the hours of ${store.name}?`, a: `${store.name} is open ${store.hours}.` },
    {
      q: `Does ${store.name} offer a loyalty reward?`,
      a: `Yes. Collect 7 stamps to receive a ${store.currency} ${store.pointRewardPer7Stamps.toFixed(2)} reward.`,
    },
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: 'Store not found' };

  const cityLine = store.address?.city ? ` · ${store.address.city}${store.address.region ? ', ' + store.address.region : ''}` : '';
  const title = `${store.name} — ${store.category}${cityLine}`;
  const description = store.description.slice(0, 160);
  const url = `${SITE_URL}/store/${store.slug}`;
  const images = [store.bannerUrl, store.thumbnailUrl].filter(Boolean) as string[];

  return {
    title,
    description,
    keywords: store.sellingPoints,
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url, images, siteName: 'ShareStamps' },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const avg = averageRating(store.reviews);
  const faq = buildFaq(store);
  const storeJsonLd = buildStoreJsonLd(store);
  const faqJsonLd = buildFaqJsonLd(faq);

  // Answer-first TL;DR (중립·사실 어조, 음성검색/AI 인용용)
  const where = store.address?.city ? ` in ${store.address.city}, ${store.address.region ?? ''}`.trimEnd() : '';
  const signatures = store.menu.filter((m) => m.signature).map((m) => m.name);
  const tldr = `${store.name} is a ${store.category.toLowerCase()}${where}${
    signatures.length ? `, known for ${signatures.join(' and ')}` : ''
  }. Open ${store.hours}.`;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
      {/* 서버 HTML에 박히는 구조화 데이터 (AEO 핵심) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <p
        id="tldr"
        style={{ margin: '0 0 16px', padding: '12px 14px', background: '#f5f3ff', borderLeft: '4px solid #6d28d9', borderRadius: 8, fontSize: 15, fontWeight: 600, color: '#3b0764' }}
      >
        {tldr}
      </p>

      <header style={{ borderBottom: '1px solid #eee', paddingBottom: 16 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>{store.name}</h1>
        <p style={{ color: '#555', margin: '6px 0 0' }}>
          {store.category}
          {store.priceRange ? ` · ${store.priceRange}` : ''}
          {store.address?.city ? ` · ${store.address.city}, ${store.address.region}` : ''}
        </p>
        {store.reviews.length > 0 && (
          <p style={{ margin: '6px 0 0', fontWeight: 700 }}>
            ★ {avg.toFixed(1)} ({store.reviews.length} reviews)
          </p>
        )}
        <p style={{ margin: '12px 0 0' }}>{store.description}</p>
      </header>

      <StampButton
        storeId={store.id}
        intervalMinutes={store.earningIntervalMinutes ?? 60}
        reward={store.pointRewardPer7Stamps}
        currency={store.currency}
      />

      <SharbeeChat storeName={store.name} menu={store.menu} />

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20 }}>Hours &amp; Contact</h2>
        <p>Open {store.hours}</p>
        {store.phone && <p>Phone: {store.phone}</p>}
        {store.address && (
          <address style={{ fontStyle: 'normal', color: '#444' }}>
            {[store.address.street, store.address.city, store.address.region, store.address.postalCode]
              .filter(Boolean)
              .join(', ')}
          </address>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20 }}>Menu</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {store.menu.map((m) => (
            <li key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #f2f2f2' }}>
              <strong>{m.name}</strong>
              {m.signature ? ' ⭐' : ''} — {store.currency} {m.price.toFixed(2)}
              {m.description ? <div style={{ color: '#666', fontSize: 14 }}>{m.description}</div> : null}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20 }}>Reviews</h2>
        <ReviewForm storeId={store.id} storeName={store.name} />
        {store.reviews.map((r) => (
          <blockquote key={r.id} style={{ margin: '12px 0', paddingLeft: 12, borderLeft: '3px solid #ddd' }}>
            <div style={{ fontWeight: 700 }}>
              {r.author} — ★ {r.rating}
            </div>
            <div style={{ color: '#444' }}>{r.comment}</div>
          </blockquote>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20 }}>FAQ</h2>
        {faq.map((f, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 2px' }}>{f.q}</h3>
            <p style={{ margin: 0, color: '#444' }}>{f.a}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
