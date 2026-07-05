import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllStores, getStoreBySlug, averageRating, SITE_URL, type FaqItem, type Store } from '@/lib/stores';
import { buildStoreJsonLd, buildFaqJsonLd } from '@/lib/schema';
import { sampleHero } from '@/lib/sampleImages';
import SharbeeChat from './SharbeeChat';
import SharbeeReview from './SharbeeReview';
import SharbeeOrder from './SharbeeOrder';
import ReviewForm from './ReviewForm';
import StoreReviews from './StoreReviews';

export const revalidate = 60;

export async function generateStaticParams() {
  const stores = await getAllStores();
  return stores.map((s) => ({ slug: s.slug }));
}

function buildFaq(store: Store): FaqItem[] {
  const signatures = store.menu.filter((m) => m.signature).map((m) => m.name);
  const cityLine = store.address?.city ? ` in ${store.address.city}${store.address.region ? ', ' + store.address.region : ''}` : '';
  return [
    { q: `What is ${store.name} known for?`, a: `${store.name} is a ${store.category.toLowerCase()}${cityLine}. ${store.description}` },
    { q: `What are the signature dishes at ${store.name}?`, a: signatures.length ? `Signature items include ${signatures.join(', ')}.` : `Ask staff for today's recommendations.` },
    { q: `What are the hours of ${store.name}?`, a: `${store.name} is open ${store.hours}.` },
    { q: `Does ${store.name} offer a loyalty reward?`, a: `Yes. Collect 9 stamps to receive a ${store.currency} ${store.pointRewardPer7Stamps.toFixed(2)} reward.` },
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
  // 점주가 등록한 FAQ가 있으면 우선 사용, 없으면 자동 생성
  const faq = store.faqs && store.faqs.length ? store.faqs.filter((f) => f.q?.trim() && f.a?.trim()) : buildFaq(store);
  const storeJsonLd = buildStoreJsonLd(store);
  const faqJsonLd = buildFaqJsonLd(faq);

  const where = store.address?.city ? ` in ${store.address.city}, ${store.address.region ?? ''}`.trimEnd() : '';
  const signatures = store.menu.filter((m) => m.signature).map((m) => m.name);
  const tldr = `${store.name} is a ${store.category.toLowerCase()}${where}${signatures.length ? `, known for ${signatures.join(' and ')}` : ''}. Open ${store.hours}.`;
  // 실제 사진 우선, 없으면 카테고리에 맞는 샘플 대문(디자인 완성도용 임시 — 점주가 교체).
  const heroImg = store.bannerUrl || store.thumbnailUrl || sampleHero(store.category, store.slug);
  const isSample = !store.bannerUrl && !store.thumbnailUrl;

  return (
    <main className="mx-auto max-w-xl px-4 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Hero (대문) */}
      <section className="ss-card mt-5 overflow-hidden">
        <div className="relative h-52 w-full">
          <img src={heroImg} alt={store.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {isSample && (
            <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white/90">
              sample
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h1 className="text-2xl font-black tracking-tight text-white drop-shadow">{store.name}</h1>
            {store.reviews.length > 0 && (
              <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-amber-300">
                ★ {avg.toFixed(1)} <span className="font-medium text-white/80">({store.reviews.length} reviews)</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ss-chip">{store.category}</span>
            {store.priceRange && <span className="text-xs font-bold text-zinc-500">{store.priceRange}</span>}
            {store.address?.city && <span className="text-xs text-zinc-500">· {store.address.city}, {store.address.region}</span>}
          </div>
          <p id="tldr" className="mt-3 rounded-xl border-l-4 border-brand-500 bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-900">
            {tldr}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">{store.description}</p>
        </div>
      </section>

      {/* 대화형 주문 (?order=1 / ?table=N 이면 자동 오픈) */}
      <div className="mt-4">
        <SharbeeOrder storeId={store.id} storeName={store.name} menu={store.menu} guidance={store.chatbotMenu} />
      </div>

      {/* 샤비 메뉴 추천 */}
      <div className="mt-3">
        <SharbeeChat storeName={store.name} menu={store.menu} guidance={store.chatbotMenu} />
      </div>

      {/* 정보 */}
      <section className="ss-card mt-4 p-5">
        <h2 className="text-base font-extrabold">Hours &amp; Contact</h2>
        <dl className="mt-2 space-y-1 text-sm text-zinc-600">
          <div className="flex gap-2"><dt className="w-16 shrink-0 font-semibold text-zinc-400">Open</dt><dd>{store.hours}</dd></div>
          {store.phone && <div className="flex gap-2"><dt className="w-16 shrink-0 font-semibold text-zinc-400">Phone</dt><dd>{store.phone}</dd></div>}
          {store.address && (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 font-semibold text-zinc-400">Address</dt>
              <dd>{[store.address.street, store.address.city, store.address.region, store.address.postalCode].filter(Boolean).join(', ')}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* 메뉴 */}
      <section className="ss-card mt-4 p-5">
        <h2 className="text-base font-extrabold">Menu</h2>
        <ul className="mt-2 divide-y divide-zinc-100">
          {store.menu.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <div className="font-semibold">
                  {m.name}
                  {m.signature && <span className="ml-1.5 rounded bg-honey px-1.5 py-0.5 text-[10px] font-bold text-honey-ink align-middle">SIGNATURE</span>}
                </div>
                {m.description && <p className="mt-0.5 text-[13px] text-zinc-500">{m.description}</p>}
              </div>
              <div className="shrink-0 font-bold text-zinc-700">{store.currency} {m.price.toFixed(2)}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* 리뷰 */}
      <section className="ss-card mt-4 p-5">
        <h2 className="text-base font-extrabold">Reviews</h2>
        <SharbeeReview storeId={store.id} storeName={store.name} menu={store.menu} guidance={store.chatbotReview} />
        <ReviewForm storeId={store.id} storeName={store.name} />
        <StoreReviews storeId={store.id} initial={store.reviews} />
      </section>

      {/* FAQ */}
      <section className="ss-card mt-4 p-5">
        <h2 className="text-base font-extrabold">FAQ</h2>
        <div className="mt-2 divide-y divide-zinc-100">
          {faq.map((f, i) => (
            <div key={i} className="py-3">
              <h3 className="text-[15px] font-bold">{f.q}</h3>
              <p className="mt-1 text-sm text-zinc-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-zinc-400">Powered by ShareStamps</p>
    </main>
  );
}
