import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllStores } from '@/lib/stores';
import { sampleHero } from '@/lib/sampleImages';
import StampBanner from './StampBanner';

export const metadata: Metadata = { title: { absolute: 'ShareStamps — 동네 가게 AI 검색·스탬프 로열티' } };
export const revalidate = 600;

// 옛 LandingPage(VISION deck) 구성 차용: 문제 → 노출(AEO) → 콘텐츠(샤비) → 9스탬프 보상
//  → 경제 역설 → 사회적 가치(3출구) → 게임화/엔진 → 무한 루프 → 생태계 혜택표.

const expose = [
  { icon: '🏷️', t: '브랜드명 일원화', d: '브랜드명·서브타이틀을 통일해 AI가 흩어진 콘텐츠를 같은 매장(엔티티)으로 인식하게 합니다.' },
  { icon: '💬', t: 'AI 맞춤형 FAQ', d: '홈피에 질문-답변(FAQ) 구조를 구축 — AEO의 핵심으로, AI 답변에 인용되게 합니다.' },
  { icon: '📡', t: '옴니채널 배포', d: '일관된 브랜드 정보를 모든 채널·플랫폼에 동시 발행해 노출 빈도를 극대화합니다.' },
];
const content = [
  { icon: '🐝', t: 'AI 챗봇(샤비) 리뷰', d: '손님이 샤비와 대화하며 Q&A 방식으로 리뷰를 작성 — AI 검색에 최적화됩니다.' },
  { icon: '📤', t: '전채널 자동 배포', d: '생성된 리뷰가 페북·인스타·유튜브 쇼츠·틱톡·구글 비즈니스 등 전 채널에 자동 배포됩니다.' },
];
const social = [
  { icon: '💛', t: '비영리 단체 기부', d: '단 1개의 스탬프라도 내가 지정한 비영리 단체에 기부할 수 있습니다.' },
  { icon: '🎁', t: '친구에게 선물', d: '가족·연인·친구에게 내가 모은 스탬프를 선물해 함께 혜택을 나눕니다.' },
  { icon: '💳', t: '적립금 직접 사용', d: '9개를 모아 본인이 직접 현금(적립금)으로 알뜰하게 쓸 수도 있습니다.' },
];
const loopSteps = ['손님 방문', '샤비 리뷰', '전채널 배포', 'AI 검색 노출', '보상·재방문'];

function Eyebrow({ children }: { children: string }) {
  return <div className="text-xs font-extrabold uppercase tracking-widest text-brand-600">{children}</div>;
}

export default async function HomePage() {
  const stores = await getAllStores();
  // 착한 가맹점 미니홈피 — ShareStamps 공식 매장/다지점(호점)은 제외한 이웃 가게만
  const featured = stores.filter((s) => s.id !== 'store_sharestamps' && !s.name.includes('호점'));
  return (
    <main className="mx-auto max-w-xl px-4 pb-24">
      {/* 브랜드 헤더 */}
      <header className="flex items-center justify-between pt-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/sharestamps-logo.svg" alt="ShareStamps" className="h-6" />
        <Link href="/me" className="ss-chip">내 스탬프 보기</Link>
      </header>

      {/* 재방문 고객(홈스크린 진입) 지름길 — ss_device_id 있을 때만 노출 */}
      <StampBanner />

      {/* Hero — 디자인 시스템(퍼플 brand + honey + ss-btn) 적용. 부드러운 퍼플 카드에 떠다니는 샤비. */}
      <section className="relative mt-4 overflow-hidden rounded-3xl border border-zinc-100 bg-gradient-to-b from-brand-50 to-white px-5 pb-9 pt-9 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-brand-700 ring-1 ring-brand-100">🐝 AI 검색 마케팅 엔진</span>
        <div className="relative mx-auto mb-6 mt-6 h-[132px] w-[132px]">
          <div aria-hidden className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,230,138,0.55), transparent 68%)' }} />
          <div className="ss-float relative flex h-full w-full items-center justify-center rounded-full bg-white" style={{ boxShadow: '0 16px 38px rgba(109,40,217,0.16)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sharbee/sharbee10.png" alt="샤비" className="h-[104px] w-[104px] object-contain" />
          </div>
        </div>
        <h1 className="text-[30px] font-black leading-[1.18] tracking-tight text-zinc-900">손님이 알아서<br />우리 가게를 <span className="text-brand-600">AI에 광고</span>합니다</h1>
        <p className="mx-auto mt-3.5 max-w-md text-[15px] leading-relaxed text-zinc-600">사장님은 스탬프만 찍어주세요. 리뷰·SNS 배포는 손님과 샤비가 알아서 하고, <b className="font-bold text-zinc-800">AI 검색이 우리 가게를 먼저 찾아냅니다.</b></p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href="/owner/new" className="ss-btn-primary w-full max-w-xs py-4 text-base">무료로 가맹점 등록하기</Link>
          <Link href="/me" className="text-[13.5px] font-bold text-zinc-500 transition hover:text-brand-600">손님에겐 이렇게 보여요 →</Link>
        </div>
      </section>

      {/* 함께하는 가맹점 — 점주 대상 랜딩에선 '고객이 발견할 목록'이 아니라 '이미 함께하는 매장 = 사회적 증거' */}
      <section className="mt-8">
        <Eyebrow>함께하는 가게</Eyebrow>
        <h2 className="mt-1 text-xl font-black tracking-tight text-zinc-900">이미 사장님들이 함께하고 있어요</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">손님과 샤비가 대신 알리는 중 — 지금 <b className="font-black text-zinc-900">{featured.length}곳</b>의 미니홈피가 AI 검색에 노출되고 있어요.</p>
        <div className="mt-3 space-y-2.5">
          {featured.map((s) => {
            const rev = s.reviews || [];
            const count = rev.length;
            const avg = count ? rev.reduce((a, r) => a + r.rating, 0) / count : 0;
            return (
              <Link key={s.id} href={`/store/${s.slug}`} className="ss-card flex items-center gap-3.5 p-3.5 transition active:scale-[0.99]">
                <span className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-2xl bg-brand-50 ring-1 ring-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumbnailUrl || s.bannerUrl || sampleHero(s.category, s.slug)} alt={s.name} className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-extrabold text-zinc-900">{s.name}</span>
                    <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{s.category}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[13px] text-zinc-500">
                    <span className="text-amber-400">★</span><b className="font-bold text-zinc-700">{avg.toFixed(1)}</b><span className="text-zinc-300">·</span>리뷰 {count}
                  </span>
                </span>
                <span className="shrink-0 text-lg text-zinc-300">›</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 문제 정의 (옛 히어로가 상단으로 오면서 아래로 내린 딜레마 프레이밍) */}
      <section className="mt-10">
        <Eyebrow>문제 정의</Eyebrow>
        <h2 className="mt-1 text-xl font-black leading-tight tracking-tight">소규모 매장의 생존은 결국 <span className="text-brand-600">홍보·마케팅</span>이다</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-zinc-600">
          <li>• AI 시대 — 검색 결과를 클릭하지 않는 <b>노클릭 서치</b>가 늘었다</li>
          <li>• 단순 SEO를 넘어 <b>AEO(답변엔진)+GEO(생성엔진)</b> 최적화가 필요하다</li>
          <li>• 한 곳에 올리는 것으론 한계 — <b>옴니채널 배포</b>가 필요하다</li>
        </ul>
      </section>

      {/* 노출 전략 */}
      <section className="mt-10">
        <Eyebrow>노출 전략</Eyebrow>
        <h2 className="mt-1 text-xl font-black tracking-tight">AI가 우리 가게를 발견·이해하게</h2>
        <div className="mt-3 space-y-3">
          {expose.map((c) => <Card key={c.t} {...c} />)}
        </div>
      </section>

      {/* 콘텐츠 생산 (샤비) */}
      <section className="mt-10">
        <Eyebrow>콘텐츠 생산</Eyebrow>
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sharbee/sharbee10.png" alt="샤비 마스코트" className="h-20 w-20 shrink-0 object-contain drop-shadow" />
          <div>
            <h2 className="text-xl font-black tracking-tight">손님이 콘텐츠를 만든다</h2>
            <p className="mt-0.5 text-sm text-zinc-500">꿀벌 컨시어지 <b className="text-honey-ink">샤비</b>가 손님과 대화하며 리뷰를 만들어요.</p>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {content.map((c) => <Card key={c.t} {...c} />)}
        </div>
      </section>

      {/* 9 스탬프 */}
      <section className="ss-card mt-10 bg-brand-600 p-7 text-center text-white">
        <div className="text-6xl font-black leading-none">9</div>
        <div className="text-xs font-extrabold tracking-widest text-white/80">STAMPS</div>
        <h2 className="mt-3 text-xl font-black">행동을 유발하는 확실한 보상</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/85">손님은 아무 이유 없이 리뷰를 쓰지 않습니다. 9개를 모으면 현금으로 보상하는 파격적 제도로 확실한 참여 동기를 부여합니다.</p>
      </section>

      {/* 사회적 가치 */}
      <section className="mt-10">
        <Eyebrow>사회적 가치화</Eyebrow>
        <h2 className="mt-1 text-xl font-black tracking-tight">스탬프 찍는 행위에 의미를 부여</h2>
        <div className="mt-3 space-y-3">
          {social.map((c) => <Card key={c.t} {...c} />)}
        </div>
      </section>

      {/* 무한 루프 */}
      <section className="ss-card mt-10 p-6 text-center">
        <Eyebrow>귀결</Eyebrow>
        <h2 className="mt-1 text-xl font-black tracking-tight">선한 영향력의 무한 루프</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">스탬프를 찍으면 자동 마케팅(AEO·GEO)이 되고, 그 혜택이 사회 기부로 이어지는 상생 생태계.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold">
          {loopSteps.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">{s}</span>
              {i < loopSteps.length - 1 && <span className="text-zinc-300">→</span>}
            </span>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-zinc-100 pt-6 text-center text-xs text-zinc-400">
        <div className="font-black text-zinc-500">ShareStamps</div>
        <p className="mt-1">동네 가게를 AI 검색에 노출시키는 스탬프 로열티 플랫폼</p>
        <div className="mt-3 flex justify-center gap-3">
          <Link href="/owner/new" className="hover:text-brand-600">점주</Link>
          <Link href="/owner/dashboard" className="hover:text-brand-600">대시보드</Link>
          <Link href="/me" className="hover:text-brand-600">내 스탬프</Link>
          <Link href="/admin" className="hover:text-brand-600">관리자</Link>
        </div>
      </footer>
    </main>
  );
}

function Card({ icon, t, d }: { icon: string; t: string; d: string }) {
  return (
    <div className="ss-card p-5">
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-2 font-extrabold">{t}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600">{d}</p>
    </div>
  );
}
