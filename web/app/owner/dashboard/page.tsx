'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { SITE_URL } from '@/lib/stores';
import { collection, getDocs, getDoc, collectionGroup, doc, setDoc, deleteDoc, query, where, limit } from 'firebase/firestore';

const normPhone = (p: string) => p.replace(/[^0-9]/g, '');

// 옛 OwnerDashboard 4탭 구성 차용(기프트카드 제외) · 태블릿/PC 레이아웃: 📊오버뷰 · 🔍고객 · 📈정산 · 🏠미니홈피.

type Review = { author: string; rating: number; comment: string; createdAt: string };
type MenuItem = { id: string; name: string; price: number; signature?: boolean; description?: string; category?: string };
type Cardholder = { name: string; phone?: string; stamps: number };
type Donation = { npoName?: string; amount: number; createdAt: string };
type Charity = { id: string; name: string; linkUrl?: string; source: 'owner' | 'hq'; status: 'pending' | 'approved' | 'rejected' };
type Loaded = {
  storeId: string; storeName: string; slug: string;
  reward: number; interval: number; banner: string; description: string; sns: string[];
  customers: number; activeStamps: number; issuedValue: number;
  reviews: Review[]; menu: MenuItem[]; cardholders: Cardholder[]; donations: Donation[]; charities: Charity[];
};

const SNS_CHANNELS = ['facebook', 'instagram', 'google', 'tiktok', 'youtube'];
const TABS = [
  { id: 'overview', ko: '📊 오버뷰', en: '📊 Overview' },
  { id: 'customers', ko: '🔍 고객', en: '🔍 Customers' },
  { id: 'settlement', ko: '📈 정산', en: '📈 Settlement' },
  { id: 'minihome', ko: '🏠 미니홈피', en: '🏠 Mini-Home' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function OwnerDashboard() {
  const [slug, setSlug] = useState('');
  const [data, setData] = useState<Loaded | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reward, setReward] = useState('');
  const [interval, setIntervalV] = useState('');
  const [banner, setBanner] = useState('');
  const [desc, setDesc] = useState('');
  const [sns, setSns] = useState<string[]>([]);
  const [newItem, setNewItem] = useState({ name: '', price: '', signature: false });
  const [stampPhone, setStampPhone] = useState('');
  const [ownerCh, setOwnerCh] = useState<{ name: string; linkUrl: string }[]>([{ name: '', linkUrl: '' }, { name: '', linkUrl: '' }]);
  const [lang, setLang] = useState<'ko' | 'en'>('ko');

  useEffect(() => { try { const l = localStorage.getItem('ss_lang'); if (l === 'en' || l === 'ko') setLang(l); } catch {} }, []);
  const toggleLang = () => { const n = lang === 'ko' ? 'en' : 'ko'; setLang(n); try { localStorage.setItem('ss_lang', n); } catch {} };
  const t = (ko: string, en: string) => (lang === 'ko' ? ko : en);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('store'); // 본사 콘솔에서 ?store=slug 로 진입
      const s = q || localStorage.getItem('ss_owner_store');
      if (s) { setSlug(s); load(s); }
    } catch {}
    // eslint-disable-next-line
  }, []);

  const load = async (s: string) => {
    const target = s.trim(); if (!target) return;
    setBusy(true); setError(null);
    try {
      const db = getDb();
      const storeSnap = await getDocs(query(collection(db, 'stores'), where('slug', '==', target), limit(1)));
      if (storeSnap.empty) { setError(t('해당 slug의 매장을 찾지 못했어요.', 'No store found for that slug.')); setData(null); return; }
      const sd = storeSnap.docs[0];
      const st = sd.data() as { name: string; slug: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number; bannerUrl?: string; description?: string; snsChannels?: string[] };
      const [cardsSnap, reviewsSnap, menuSnap, custSnap, donSnap, chSnap] = await Promise.all([
        getDocs(collection(db, 'stores', sd.id, 'stampCards')),
        getDocs(collection(db, 'stores', sd.id, 'reviews')),
        getDocs(collection(db, 'stores', sd.id, 'menuItems')),
        getDocs(collection(db, 'customers')).catch(() => null),
        getDocs(collectionGroup(db, 'donations')).catch(() => null),
        getDocs(collection(db, 'stores', sd.id, 'charities')).catch(() => null),
      ]);
      const charities: Charity[] = (chSnap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as object) } as Charity));
      const o1 = charities.find((c) => c.id === 'owner_1'); const o2 = charities.find((c) => c.id === 'owner_2');
      setOwnerCh([{ name: o1?.name || '', linkUrl: o1?.linkUrl || '' }, { name: o2?.name || '', linkUrl: o2?.linkUrl || '' }]);
      const rwd = st.pointRewardPer7Stamps ?? 5, itv = st.earningIntervalMinutes ?? 60;
      const activeStamps = cardsSnap.docs.reduce((s2, d) => s2 + ((d.data().currentStamps as number) || 0), 0);
      const reviews = reviewsSnap.docs.map((d) => d.data() as Review).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const menu = menuSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as MenuItem));
      const custMap = new Map<string, { name?: string; phone?: string }>();
      (custSnap?.docs ?? []).forEach((d) => custMap.set(d.id, d.data() as { name?: string; phone?: string }));
      const cardholders: Cardholder[] = cardsSnap.docs
        .map((d) => ({ name: custMap.get(d.id)?.name || '', phone: custMap.get(d.id)?.phone, stamps: (d.data().currentStamps as number) || 0 }))
        .filter((c) => c.stamps > 0).sort((a, b) => b.stamps - a.stamps);
      const donations: Donation[] = (donSnap?.docs ?? [])
        .map((d) => d.data() as Donation & { storeId?: string })
        .filter((d) => (d as { storeId?: string }).storeId === sd.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setData({
        storeId: sd.id, storeName: st.name, slug: st.slug, reward: rwd, interval: itv,
        banner: st.bannerUrl || '', description: st.description || '', sns: st.snsChannels || [],
        customers: cardsSnap.size, activeStamps, issuedValue: activeStamps * (rwd / 7),
        reviews: reviews.slice(0, 8), menu, cardholders, donations, charities,
      });
      setReward(String(rwd)); setIntervalV(String(itv)); setBanner(st.bannerUrl || ''); setDesc(st.description || ''); setSns(st.snsChannels || []);
      try { localStorage.setItem('ss_owner_store', target); } catch {}
    } catch { setError(t('불러오기에 실패했어요.', 'Failed to load.')); }
    finally { setBusy(false); }
  };

  const saveStore = async (patch: Record<string, unknown>) => {
    if (!data) return;
    await setDoc(doc(getDb(), 'stores', data.storeId), patch, { merge: true });
    flash(t('저장됐어요 ✓', 'Saved ✓')); await load(data.slug);
  };
  const addMenu = async () => {
    if (!data || !newItem.name.trim()) return;
    await setDoc(doc(getDb(), 'stores', data.storeId, 'menuItems', `m_${Date.now()}`), { name: newItem.name.trim(), price: parseFloat(newItem.price) || 0, signature: newItem.signature });
    setNewItem({ name: '', price: '', signature: false }); flash(t('메뉴 추가됨 ✓', 'Menu added ✓')); await load(data.slug);
  };
  const delMenu = async (id: string) => { if (!data) return; await deleteDoc(doc(getDb(), 'stores', data.storeId, 'menuItems', id)); await load(data.slug); };

  // 회원 스탬프 직접 지급/차감 (전화번호로)
  const adjustStamp = async (delta: number) => {
    if (!data) return;
    const phone = normPhone(stampPhone);
    if (phone.length < 8) { flash(t('회원 전화번호를 입력해 주세요.', 'Enter the member phone number.')); return; }
    setBusy(true);
    try {
      const db = getDb();
      const idx = await getDoc(doc(db, 'phoneIndex', phone));
      if (!idx.exists()) { flash(t('해당 번호의 회원을 찾지 못했어요. (회원 가입 필요)', 'No member found for that number. (sign-up required)')); setBusy(false); return; }
      const did = idx.data().deviceId as string;
      const cardRef = doc(db, 'stores', data.storeId, 'stampCards', did);
      const snap = await getDoc(cardRef);
      const cur = snap.exists() ? ((snap.data().currentStamps as number) || 0) : 0;
      const next = Math.max(0, Math.min(7, cur + delta));
      const now = new Date().toISOString();
      await setDoc(cardRef, { deviceId: did, currentStamps: next, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', did, 'cards', data.storeId), { storeId: data.storeId, storeName: data.storeName, slug: data.slug, currentStamps: next, reward: data.reward, currency: 'USD', interval: data.interval, updatedAt: now }, { merge: true });
      flash(`${idx.data().name || t('회원', 'Member')}: ${delta > 0 ? '+' : ''}${delta} → ${next}/7`);
      await load(data.slug);
    } catch { flash(t('처리 실패', 'Failed.')); } finally { setBusy(false); }
  };
  // 사장 지정 기부단체 등록(본사 승인 대기)
  const saveOwnerCharity = async (slot: number) => {
    if (!data) return;
    const c = ownerCh[slot];
    if (!c.name.trim()) { flash(t('단체명을 입력해 주세요.', 'Enter the charity name.')); return; }
    await setDoc(doc(getDb(), 'stores', data.storeId, 'charities', `owner_${slot + 1}`), { name: c.name.trim(), linkUrl: c.linkUrl.trim(), source: 'owner', status: 'pending', updatedAt: new Date().toISOString() }, { merge: true });
    flash(t('등록 요청됨 — 본사 승인 대기 ✓', 'Requested — awaiting HQ approval ✓')); await load(data.slug);
  };

  const storeUrl = data ? `${SITE_URL}/store/${data.slug}` : '';
  const qr = data ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(storeUrl)}` : '';
  const donatedTotal = data ? data.donations.reduce((s, d) => s + (d.amount || 0), 0) : 0;
  const chStatus = (s?: string) => s === 'approved' ? t('승인됨', 'Approved') : s === 'rejected' ? t('반려됨', 'Rejected') : t('승인 대기', 'Pending');

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3 px-1 pt-7">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('👨‍🍳 점주 대시보드', '👨‍🍳 Owner Dashboard')} <span className="text-sm font-medium text-zinc-400">{t('(태블릿·PC)', '(Tablet·PC)')}</span></h1>
          <p className="mt-0.5 text-sm text-zinc-500">{t('매장 현황·고객·정산·미니홈피를 관리해요.', 'Manage store status, customers, settlement, and mini-home.')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={toggleLang} className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-600">{lang === 'ko' ? 'EN' : '한국어'}</button>
          <Link href={`/owner/scan${(data?.slug || slug) ? `?store=${data?.slug || slug}` : ''}`} className="ss-btn-primary px-5 py-2.5">{t('📷 QR 스캔 모드', '📷 QR Scan Mode')}</Link>
        </div>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); load(slug); }} className="mt-4 flex max-w-md gap-2">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('매장 slug (예: loveletter-fullerton)', 'Store slug (e.g. loveletter-fullerton)')} className="ss-input flex-1" />
        <button type="submit" disabled={busy} className="ss-btn-primary px-4 py-2.5">{busy ? '…' : t('조회', 'Load')}</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <div className="mt-5 flex items-center gap-3 border-b border-zinc-100 pb-px">
            {TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)} className={`-mb-px whitespace-nowrap border-b-2 px-2 pb-2 text-sm font-bold transition ${tab === tb.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>{lang === 'ko' ? tb.ko : tb.en}</button>
            ))}
            <span className="ml-auto text-sm font-extrabold text-zinc-700">{data.storeName}</span>
          </div>

          {/* 📊 오버뷰 */}
          {tab === 'overview' && (
            <div className="mt-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat label={t('발행 적립금', 'Issued Reward')} value={`$${data.issuedValue.toFixed(2)}`} accent="rose" />
                <Stat label={t('고객(카드)', 'Customers')} value={data.customers} accent="brand" />
                <Stat label={t('적립 스탬프', 'Stamps')} value={data.activeStamps} accent="emerald" />
                <Stat label={t('리뷰', 'Reviews')} value={data.reviews.length} accent="amber" />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
                <section className="ss-card p-5 text-center">
                  <h3 className="text-base font-extrabold">{t('착한 매장 · 테이블 QR', 'Good Store · Table QR')}</h3>
                  <p className="mt-1 text-xs text-zinc-500">{t('손님이 찍으면 매장 페이지로 들어와 스탬프·메뉴·샤비를 써요.', 'Customers scan to open your store page for stamps, menu, and Sharbee.')}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="store QR" className="mx-auto mt-3 h-44 w-44 rounded-xl border border-zinc-100" />
                  <Link href={`/store/${data.slug}`} className="ss-btn-soft mt-3">{t('매장 페이지 보기', 'View Store Page')}</Link>
                  <p className="mt-2 break-all text-[11px] text-zinc-400">{storeUrl}</p>
                </section>

                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('적립 설정', 'Earning Settings')}</h3>
                  <label className="ss-label">{t('7개당 보상', 'Reward per 7')}</label>
                  <input value={reward} onChange={(e) => setReward(e.target.value)} className="ss-input" placeholder="5.00" />
                  <label className="ss-label">{t('재적립 인터벌 (분)', 'Re-earn interval (min)')}</label>
                  <input value={interval} onChange={(e) => setIntervalV(e.target.value)} className="ss-input" placeholder="60" />
                  <p className="mt-1 text-[11px] text-zinc-400">{t('예: 240(4시간)이면 점심·저녁 재방문 손님이 각각 적립돼요. 0이면 제한 없음.', 'e.g. 240 (4h) lets lunch & dinner revisits each earn. 0 = no limit.')}</p>
                  <button onClick={() => saveStore({ pointRewardPer7Stamps: parseFloat(reward) || 0, earningIntervalMinutes: parseInt(interval, 10) || 0 })} className="ss-btn-primary mt-3 w-full">{t('설정 저장', 'Save Settings')}</button>
                </section>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('회원 스탬프 직접 지급/차감', 'Give / Deduct Member Stamps')}</h3>
                  <p className="mt-1 text-[11px] text-zinc-400">{t('회원 전화번호로 스탬프를 직접 ± 해요.', 'Adjust stamps directly by member phone.')}</p>
                  <input value={stampPhone} onChange={(e) => setStampPhone(e.target.value)} placeholder="000-000-0000" inputMode="tel" className="ss-input mt-2" />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={() => adjustStamp(1)} disabled={busy} className="ss-btn-primary">{t('＋1 지급', '＋1 Give')}</button>
                    <button onClick={() => adjustStamp(-1)} disabled={busy} className="rounded-xl border border-rose-200 bg-white py-3 text-sm font-bold text-rose-600 disabled:opacity-50">{t('－1 차감', '－1 Deduct')}</button>
                  </div>
                </section>
                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('💰 실시간 캐시 승인 큐', '💰 Live Cash Approval Queue')}</h3>
                  <p className="mt-2 text-center text-sm text-zinc-400">{t('대기 중인 승인이 없어요.', 'No pending approvals.')}</p>
                  <p className="mt-1 text-center text-[11px] text-zinc-400">{t('* 손님 결제 승인 연동은 다음 단계.', '* Customer payment approval — coming next.')}</p>
                </section>
              </div>

              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">{t('기부 단체', 'Charities')} <span className="text-xs font-medium text-zinc-400">{t('(사장 2 · 본사 3 · 모두 본사 관리)', '(Owner 2 · HQ 3 · all HQ-managed)')}</span></h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {[0, 1].map((i) => {
                    const ex = data.charities.find((c) => c.id === `owner_${i + 1}`);
                    const st = ex?.status;
                    return (
                      <div key={`o${i}`} className="rounded-xl border border-brand-200 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-brand-700">{t('사장 지정', 'Owner pick')} #{i + 1}</span>
                          {st && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${st === 'approved' ? 'bg-emerald-100 text-emerald-700' : st === 'rejected' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>{chStatus(st)}</span>}
                        </div>
                        <input value={ownerCh[i].name} onChange={(e) => setOwnerCh((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={t('단체명', 'Charity name')} className="ss-input mt-2" />
                        <input value={ownerCh[i].linkUrl} onChange={(e) => setOwnerCh((p) => p.map((x, j) => j === i ? { ...x, linkUrl: e.target.value } : x))} placeholder={t('단체 링크 https://...', 'Charity link https://...')} className="ss-input mt-2" />
                        <button onClick={() => saveOwnerCharity(i)} className="ss-btn-soft mt-2 w-full">{t('등록 요청 (본사 승인)', 'Request (HQ approval)')}</button>
                      </div>
                    );
                  })}
                  {[0, 1, 2].map((i) => {
                    const hq = data.charities.filter((c) => c.source === 'hq')[i];
                    return (
                      <div key={`h${i}`} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                        <span className="text-xs font-bold text-zinc-500">{t('본사 지정', 'HQ pick')} #{i + 1}</span>
                        <div className="mt-2 text-sm font-semibold">{hq ? hq.name : <span className="text-zinc-400">{t('본사 지정 대기', 'Awaiting HQ pick')}</span>}</div>
                        {hq?.linkUrl && <a href={hq.linkUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[11px] text-brand-600">{hq.linkUrl}</a>}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-zinc-400">{t('* 사장 지정 단체는 본사 승인 후 손님 기부 목록에 노출돼요. 본사 3개는 본사가 지정·관리합니다.', '* Owner-picked charities appear in the customer donation list after HQ approval. The 3 HQ slots are managed by HQ.')}</p>
              </section>
            </div>
          )}

          {/* 🔍 고객 */}
          {tab === 'customers' && (
            <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-start">
              <section className="ss-card p-5">
                <h3 className="text-base font-extrabold">{t('🎫 단골 스탬프 카드 현황', '🎫 Regulars — Stamp Cards')}</h3>
                {data.cardholders.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{t('아직 적립한 고객이 없어요.', 'No customers have earned yet.')}</p> : (
                  <div className="mt-2 divide-y divide-zinc-100">
                    {data.cardholders.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <div className="text-sm"><span className="font-bold">{c.name || t('손님', 'Guest')}</span> <span className="text-zinc-400">{c.phone || ''}</span></div>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">⭐ {Math.min(c.stamps, 7)}/7</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="ss-card p-5">
                <h3 className="text-base font-extrabold">{t('스탬프 직접 지급', 'Give Stamps')}</h3>
                <p className="mt-2 text-center text-sm text-zinc-400">{t('전화번호로 단골에게 스탬프 직접 지급 — 다음 단계.', 'Give stamps to regulars by phone — coming next.')}</p>
              </section>
            </div>
          )}

          {/* 📈 정산 */}
          {tab === 'settlement' && (
            <div className="mt-5">
              <div className="grid max-w-md grid-cols-2 gap-4">
                <Stat label={t('발행 적립금', 'Issued Reward')} value={`$${data.issuedValue.toFixed(2)}`} accent="rose" />
                <Stat label={t('기부 정산 💛', 'Donations 💛')} value={`$${donatedTotal.toFixed(2)}`} accent="amber" />
              </div>
              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">{t('📊 매장 기부 정산 대장', '📊 Donation Ledger')}</h3>
                {data.donations.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{t('정산할 기부 내역이 없어요.', 'No donations to settle.')}</p> : (
                  <div className="mt-2 divide-y divide-zinc-100">
                    {data.donations.map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="text-zinc-600">{d.npoName ?? t('기부', 'Donation')} · {new Date(d.createdAt).toLocaleDateString()}</span>
                        <span className="font-bold text-amber-600">${(d.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-zinc-400">{t('* 일/주/월 정산 시트·송금은 다음 단계.', '* Daily/weekly/monthly sheets & payout — coming next.')}</p>
              </section>
            </div>
          )}

          {/* 🏠 미니홈피 */}
          {tab === 'minihome' && (
            <div className="mt-5">
              <div className="grid gap-4 md:grid-cols-2 md:items-start">
                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('대문 이미지 & 소개', 'Cover Image & Intro')}</h3>
                  {banner && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={banner} alt="banner" className="mt-2 h-32 w-full rounded-xl object-cover" />
                  )}
                  <label className="ss-label">{t('대문 이미지 URL (비우면 샘플 자동)', 'Cover image URL (blank = sample)')}</label>
                  <input value={banner} onChange={(e) => setBanner(e.target.value)} className="ss-input" placeholder="https://..." />
                  <label className="ss-label">{t('한 줄 소개', 'One-line intro')}</label>
                  <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="ss-input min-h-20" placeholder={t('매장 소개', 'Store intro')} />
                  <button onClick={() => saveStore({ bannerUrl: banner.trim(), description: desc.trim() })} className="ss-btn-primary mt-3 w-full">{t('대문·소개 저장', 'Save Cover & Intro')}</button>
                </section>

                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('SNS 자동게시 채널', 'SNS Auto-post Channels')}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SNS_CHANNELS.map((ch) => {
                      const on = sns.includes(ch);
                      return <button key={ch} onClick={() => setSns((p) => on ? p.filter((x) => x !== ch) : [...p, ch])} className={`rounded-full px-3 py-1.5 text-sm font-bold capitalize ${on ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{ch}</button>;
                    })}
                  </div>
                  <button onClick={() => saveStore({ snsChannels: sns })} className="ss-btn-soft mt-3 w-full">{t('채널 저장', 'Save Channels')}</button>
                </section>
              </div>

              <section className="ss-card mt-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold">{t('메뉴 관리', 'Menu Management')}</h3>
                  <span className="ss-chip">{t('📄 엑셀 일괄등록 (곧)', '📄 Excel bulk (soon)')}</span>
                </div>
                <div className="mt-2 divide-y divide-zinc-100">
                  {data.menu.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2.5">
                      <div className="text-sm"><span className="font-semibold">{m.name}</span>{m.signature && <span className="ml-1.5 rounded bg-honey px-1.5 py-0.5 text-[10px] font-bold text-honey-ink">SIG</span>}</div>
                      <div className="flex items-center gap-3"><span className="text-sm font-bold text-zinc-600">${m.price.toFixed(2)}</span><button onClick={() => delMenu(m.id)} className="text-xs text-red-500">{t('삭제', 'Delete')}</button></div>
                    </div>
                  ))}
                  {data.menu.length === 0 && <p className="py-2 text-sm text-zinc-400">{t('메뉴가 없어요. 추가해 보세요.', 'No menu yet. Add one.')}</p>}
                </div>
                <div className="mt-3 flex max-w-md gap-2">
                  <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="ss-input flex-1" placeholder={t('메뉴명', 'Item name')} />
                  <input value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="ss-input w-24" placeholder="$" inputMode="decimal" />
                  <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-zinc-600"><input type="checkbox" checked={newItem.signature} onChange={(e) => setNewItem({ ...newItem, signature: e.target.checked })} /> {t('시그니처', 'Signature')}</label>
                  <button onClick={addMenu} className="ss-btn-primary px-5">{t('추가', 'Add')}</button>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {toast && <div className="fixed inset-x-0 bottom-5 z-[60] mx-auto w-fit rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </main>
  );
}

function Stat({ label, value, accent = 'brand' }: { label: string; value: number | string; accent?: 'brand' | 'rose' | 'emerald' | 'amber' }) {
  const c = { brand: 'text-brand-700', rose: 'text-rose-500', emerald: 'text-emerald-600', amber: 'text-amber-600' }[accent];
  return (
    <div className="ss-card bg-zinc-50 p-4 text-center">
      <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-black ${c}`}>{value}</div>
    </div>
  );
}
