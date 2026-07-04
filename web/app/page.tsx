import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllStores } from '@/lib/stores';
import { sampleHero } from '@/lib/sampleImages';

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
const paradox = [
  { icon: '🧾', t: '기존 모델의 한계 (낙전)', d: '고객은 9장을 다 못 채울 걸 알아서 포기합니다. 사라지는 스탬프(낙전)는 전부 돈입니다.' },
  { icon: '📈', t: '점주의 진짜 이득', d: '돈을 안 줘서 이득이 아닙니다. 약간의 비용으로 손님이 한 번이라도 더 방문하면 그게 이득입니다.' },
  { icon: '🏆', t: '압도적 가치 창출', d: '스탬프에 들어가는 비용보다, 단골이 되어 발생하는 재방문 가치가 훨씬 큽니다.' },
];
const social = [
  { icon: '💛', t: '비영리 단체 기부', d: '단 1개의 스탬프라도 내가 지정한 비영리 단체에 기부할 수 있습니다.' },
  { icon: '🎁', t: '친구에게 선물', d: '가족·연인·친구에게 내가 모은 스탬프를 선물해 함께 혜택을 나눕니다.' },
  { icon: '💳', t: '적립금 직접 사용', d: '9개를 모아 본인이 직접 현금(적립금)으로 알뜰하게 쓸 수도 있습니다.' },
];
const loopSteps = ['손님 방문', '샤비 리뷰', '전채널 배포', 'AI 검색 노출', '보상·재방문'];
const tableRows = [
  { who: '소상공인 (점주)', benefit: '자동화된 AEO/GEO 마케팅, 고객 재방문율 상승', result: "'좋은 가게' 현판, 기부액 세금 공제" },
  { who: '고객 (소비자)', benefit: '리뷰 작성으로 확실한 보상 (9개=현금)', result: '기부·선물·직접 사용의 가치 소비' },
  { who: '매장 직원 (서버)', benefit: '고객 스탬프 발행 시 10% 인센티브', result: '업무 동기 + 추가 수익' },
  { who: '사회단체', benefit: '점주·고객이 지정한 기부금 수령', result: '안정적 후원, 지역사회 기여' },
];

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
        <Link href="/me" className="ss-chip">내 스탬프</Link>
      </header>

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
        <h1 className="text-[30px] font-black leading-[1.18] tracking-tight text-zinc-900">AI가 우리 가게를<br /><span className="text-brand-600">추천하게</span> 만듭니다</h1>
        <p className="mx-auto mt-3.5 max-w-md text-[15px] leading-relaxed text-zinc-600">“제로클릭 서치” 시대, 손님은 더 이상 클릭하지 않아요. 챗봇과 대화하면 페북·인스타·구글 비즈니스 등 여러 채널에 자동 배포되고, <b className="font-bold text-zinc-800">AI 검색이 우리 가게를 먼저 찾아냅니다.</b></p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link href="/owner/new" className="ss-btn-primary px-6 text-[15px]">점주로 시작하기</Link>
          <Link href="/me" className="ss-btn-soft px-6 py-3.5 text-[15px]">고객 앱 체험하기</Link>
        </div>
      </section>

      {/* 착한 가맹점 미니홈피 — ss-card 리스트 row(당근식) + 퍼플/허니 액센트 */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-2">
          <div>
            <Eyebrow>추천 가맹점</Eyebrow>
            <h2 className="mt-1 text-xl font-black tracking-tight text-zinc-900">착한 가맹점 미니홈피</h2>
          </div>
          <span className="ss-chip">총 {featured.length}곳</span>
        </div>
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

      {/* 경제 역설 */}
      <section className="mt-10">
        <Eyebrow>경제 모델의 역설</Eyebrow>
        <h2 className="mt-1 text-xl font-black tracking-tight">이 사업의 차별점</h2>
        <div className="mt-3 space-y-3">
          {paradox.map((c) => <Card key={c.t} {...c} />)}
        </div>
      </section>

      {/* 사회적 가치 */}
      <section className="mt-10">
        <Eyebrow>사회적 가치화</Eyebrow>
        <h2 className="mt-1 text-xl font-black tracking-tight">스탬프 찍는 행위에 의미를 부여</h2>
        <div className="mt-3 space-y-3">
          {social.map((c) => <Card key={c.t} {...c} />)}
        </div>
      </section>

      {/* 게임화 & 엔진 */}
      <section className="mt-10 grid gap-3">
        <Eyebrow>게임화 &amp; 실행 엔진</Eyebrow>
        <div className="ss-card p-5">
          <h3 className="font-black">🏆 게임화 — ShareChamp</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600"><li>• 게임처럼 지속 참여를 유도하는 ShareChamp 리스트</li><li>• 스탬프 활동 우수 챔피언(고객) 선정</li><li>• 우수 매장을 챔피언 매장으로 홍보</li></ul>
        </div>
        <div className="ss-card p-5">
          <h3 className="font-black">👥 실행 엔진 — 직원 인센티브</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600"><li>• 스탬프를 찍게 만드는 핵심은 현장의 직원</li><li>• 스탬프 캐시 발행액의 약 10%를 직원에게 지급</li><li>• 직원의 자발적 스탬프 권유 문화 정착</li></ul>
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

      {/* 생태계 혜택표 */}
      <section className="mt-10">
        <Eyebrow>생태계 혜택 요약</Eyebrow>
        <h2 className="mt-1 text-xl font-black tracking-tight">모두가 이득인 구조</h2>
        <div className="ss-card mt-3 divide-y divide-zinc-100 p-0">
          {tableRows.map((r) => (
            <div key={r.who} className="p-4">
              <div className="text-sm font-extrabold text-brand-700">{r.who}</div>
              <div className="mt-1 text-[13px] text-zinc-600">{r.benefit}</div>
              <div className="mt-0.5 text-[13px] font-semibold text-zinc-500">→ {r.result}</div>
            </div>
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
