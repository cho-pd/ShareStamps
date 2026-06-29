'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, collectionGroup, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { DEFAULT_ADS, type AdBanner } from '@/lib/ads';
import { SITE_URL } from '@/lib/stores';
import { storeSlug } from '@/lib/slug';

// 옛 SuperAdmin(본사 관리자) 데스크톱 보드 구성 차용 · 태블릿/PC 레이아웃.
// 통합 대시보드 · 매장 · 기부 단체 승인 · NPO · 정산 · 회원 · 광고.

type Tier = 'free' | 'official' | 'premium';
type Pay = 'paid' | 'overdue' | 'unpaid';
type Store = {
  id: string; name: string; slug: string; category: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number;
  phone?: string; ownerName?: string; ownerVerified?: boolean; address?: { street?: string; city?: string; region?: string; postalCode?: string };
  manager?: string; memo?: string; signupDate?: string; tier?: Tier; paymentStatus?: Pay; monthlyFee?: number; lastPaidAt?: string; tablets?: number; stands?: number;
  ownerStatus?: string; ownerClaimedAt?: string;
};
type MForm = { name: string; category: string; ownerName: string; manager: string; phone: string; street: string; city: string; region: string; reward: string; interval: string; tier: Tier; paymentStatus: Pay; monthlyFee: string; lastPaidAt: string; tablets: string; stands: string; memo: string; signupDate: string };

const TIER_LABEL: Record<Tier, string> = { free: '프리', official: '정식', premium: '프리미엄' };
const TIER_CLS: Record<Tier, string> = { free: 'bg-zinc-100 text-zinc-500', official: 'bg-brand-100 text-brand-700', premium: 'bg-amber-100 text-amber-700' };
const PAY_LABEL: Record<Pay, string> = { paid: '입금', overdue: '연체', unpaid: '미납' };
const PAY_CLS: Record<Pay, string> = { paid: 'bg-emerald-100 text-emerald-700', overdue: 'bg-rose-100 text-rose-600', unpaid: 'bg-zinc-100 text-zinc-400' };
type Customer = { id: string; name?: string; phone?: string; balance?: number; donated?: number };
type Donation = { storeName?: string; npoName?: string; amount?: number; createdAt?: string };
type Charity = { id: string; storeId: string; name: string; linkUrl?: string; source: 'owner' | 'hq'; status: 'pending' | 'approved' | 'rejected' };

const TABS = [
  { id: 'kpi', label: '📊 통합 대시보드' },
  { id: 'stores', label: '🏪 매장' },
  { id: 'charities', label: '💛 기부 단체 승인' },
  { id: 'settlement', label: '📈 정산' },
  { id: 'users', label: '👥 회원' },
  { id: 'ads', label: '🖼 광고 배너' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>('kpi');
  const [stores, setStores] = useState<Store[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);
  const [adCustoms, setAdCustoms] = useState<AdBanner[]>([]);
  const [adHidden, setAdHidden] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [adImg, setAdImg] = useState(''); const [adLink, setAdLink] = useState('');
  const [hqStore, setHqStore] = useState('');
  const [hqForm, setHqForm] = useState<{ name: string; link: string }[]>([{ name: '', link: '' }, { name: '', link: '' }, { name: '', link: '' }]);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const [showNew, setShowNew] = useState(false);
  const [ownerPopupSeen, setOwnerPopupSeen] = useState(false);
  const NS0 = { name: '', category: 'Korean Restaurant', ownerName: '', manager: '', phone: '', street: '', city: '', region: '', reward: '5', tier: 'free' as Tier, tablets: '0', stands: '0' };
  const [ns, setNs] = useState(NS0);
  const [manageId, setManageId] = useState<string | null>(null);
  const [mf, setMf] = useState<MForm | null>(null);

  const reloadStores = async () => {
    const s = await getDocs(collection(getDb(), 'stores'));
    setStores(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Store)));
  };
  const createStore = async () => {
    if (!ns.name.trim()) { flash('매장 이름을 입력해 주세요.'); return; }
    const slug = storeSlug(ns.name.trim(), ns.city.trim() || undefined);
    const id = `store_${slug}`.slice(0, 80);
    await setDoc(doc(getDb(), 'stores', id), {
      slug, name: ns.name.trim(), category: ns.category.trim() || 'Other', currency: 'USD',
      description: '', hours: '', phone: ns.phone.trim() || null, priceRange: '$$',
      pointRewardPer7Stamps: parseFloat(ns.reward) || 5, sellingPoints: [],
      address: { street: ns.street.trim() || null, city: ns.city.trim() || null, region: ns.region.trim() || null, country: 'US' },
      ownerName: ns.ownerName.trim() || null, manager: ns.manager.trim() || null, ownerVerified: false,
      tier: ns.tier, paymentStatus: 'unpaid', tablets: parseInt(ns.tablets, 10) || 0, stands: parseInt(ns.stands, 10) || 0,
      signupDate: new Date().toISOString().slice(0, 10), earningIntervalMinutes: 60, updatedAt: new Date().toISOString(),
    });
    flash(`'${ns.name.trim()}' 등록됨 ✓`); setNs(NS0); setShowNew(false); await reloadStores();
  };

  const openManage = (s: Store) => {
    setManageId(s.id);
    setMf({
      name: s.name || '', category: s.category || '', ownerName: s.ownerName || '', manager: s.manager || '',
      phone: s.phone || '', street: s.address?.street || '', city: s.address?.city || '', region: s.address?.region || '',
      reward: String(s.pointRewardPer7Stamps ?? 5), interval: String(s.earningIntervalMinutes ?? 60),
      tier: s.tier || 'free', paymentStatus: s.paymentStatus || 'unpaid', monthlyFee: s.monthlyFee != null ? String(s.monthlyFee) : '', lastPaidAt: s.lastPaidAt || '',
      tablets: String(s.tablets ?? 0), stands: String(s.stands ?? 0), memo: s.memo || '', signupDate: s.signupDate || '',
    });
  };
  const saveManage = async () => {
    if (!manageId || !mf) return;
    await setDoc(doc(getDb(), 'stores', manageId), {
      name: mf.name.trim(), category: mf.category.trim(), ownerName: mf.ownerName.trim() || null, manager: mf.manager.trim() || null,
      phone: mf.phone.trim() || null, address: { street: mf.street.trim() || null, city: mf.city.trim() || null, region: mf.region.trim() || null, country: 'US' },
      pointRewardPer7Stamps: parseFloat(mf.reward) || 5, earningIntervalMinutes: parseInt(mf.interval, 10) || 0,
      tier: mf.tier, paymentStatus: mf.paymentStatus, monthlyFee: parseFloat(mf.monthlyFee) || 0, lastPaidAt: mf.lastPaidAt || null,
      tablets: parseInt(mf.tablets, 10) || 0, stands: parseInt(mf.stands, 10) || 0, memo: mf.memo.trim() || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    flash('저장됐어요 ✓'); await reloadStores();
  };
  const set = (k: keyof MForm, v: string) => setMf((p) => p ? { ...p, [k]: v } : p);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [sSnap, cSnap] = await Promise.all([getDocs(collection(db, 'stores')), getDocs(collection(db, 'customers'))]);
        setStores(sSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Store)));
        setCustomers(cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Customer)));
        const [dSnap, adSnap, hidSnap, chSnap] = await Promise.all([
          getDocs(collectionGroup(db, 'donations')).catch(() => null),
          getDocs(collection(db, 'adBanners')).catch(() => null),
          getDocs(collection(db, 'adHidden')).catch(() => null),
          getDocs(collectionGroup(db, 'charities')).catch(() => null),
        ]);
        if (dSnap) setDonations(dSnap.docs.map((d) => d.data() as Donation));
        if (adSnap) setAdCustoms(adSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as AdBanner)));
        if (hidSnap) setAdHidden(new Set(hidSnap.docs.map((d) => d.id)));
        if (chSnap) setCharities(chSnap.docs.map((d) => ({ id: d.id, storeId: d.ref.parent.parent!.id, ...(d.data() as object) } as Charity)));
        try { setIsAdmin(localStorage.getItem('ss_device_id') === 'admin_jopd'); } catch {}
      } catch { /* noop */ }
      finally { setLoading(false); }
    })();
  }, []);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name || id;
  const reloadCharities = async () => {
    const ch = await getDocs(collectionGroup(getDb(), 'charities')).catch(() => null);
    if (ch) setCharities(ch.docs.map((d) => ({ id: d.id, storeId: d.ref.parent.parent!.id, ...(d.data() as object) } as Charity)));
  };
  const setCharityStatus = async (c: Charity, status: 'approved' | 'rejected') => {
    await setDoc(doc(getDb(), 'stores', c.storeId, 'charities', c.id), { status }, { merge: true }); await reloadCharities();
  };
  const onPickHqStore = (sid: string) => {
    setHqStore(sid);
    setHqForm([0, 1, 2].map((i) => { const hq = charities.filter((c) => c.storeId === sid && c.source === 'hq')[i]; return { name: hq?.name || '', link: hq?.linkUrl || '' }; }));
  };
  const saveHq = async (slot: number) => {
    if (!hqStore) return; const f = hqForm[slot]; if (!f.name.trim()) return;
    await setDoc(doc(getDb(), 'stores', hqStore, 'charities', `hq_${slot + 1}`), { name: f.name.trim(), linkUrl: f.link.trim(), source: 'hq', status: 'approved', updatedAt: new Date().toISOString() }, { merge: true });
    await reloadCharities();
  };

  const reloadAds = async () => {
    const [adSnap, hidSnap] = await Promise.all([getDocs(collection(getDb(), 'adBanners')).catch(() => null), getDocs(collection(getDb(), 'adHidden')).catch(() => null)]);
    if (adSnap) setAdCustoms(adSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as AdBanner)));
    setAdHidden(new Set((hidSnap?.docs ?? []).map((d) => d.id)));
  };
  const addAd = async () => { if (!adImg.trim()) return; await setDoc(doc(getDb(), 'adBanners', `ad_${Date.now()}`), { imageUrl: adImg.trim(), linkUrl: adLink.trim(), status: 'active' }); setAdImg(''); setAdLink(''); await reloadAds(); };
  const delAd = async (id: string) => { await deleteDoc(doc(getDb(), 'adBanners', id)); await reloadAds(); };
  const toggleAd = async (a: AdBanner) => { await setDoc(doc(getDb(), 'adBanners', a.id), { status: a.status === 'active' ? 'inactive' : 'active' }, { merge: true }); await reloadAds(); };
  const hideDefault = async (id: string, hide: boolean) => { if (hide) await setDoc(doc(getDb(), 'adHidden', id), { hidden: true }); else await deleteDoc(doc(getDb(), 'adHidden', id)); await reloadAds(); };

  const totalDonated = customers.reduce((s, c) => s + (c.donated || 0), 0);
  const totalBalance = customers.reduce((s, c) => s + (c.balance || 0), 0);
  const activeMembers = customers.filter((c) => c.name).length;
  const byNpo = new Map<string, number>();
  donations.forEach((d) => byNpo.set(d.npoName || '기타', (byNpo.get(d.npoName || '기타') || 0) + (d.amount || 0)));
  const pendingCharities = charities.filter((c) => c.source === 'owner' && c.status === 'pending');
  const managed = manageId ? stores.find((s) => s.id === manageId) || null : null;
  const pendingOwners = stores.filter((s) => s.ownerStatus === 'pending');

  const approveOwner = async (s: Store) => {
    await setDoc(doc(getDb(), 'stores', s.id), { ownerStatus: 'approved', ownerVerified: true }, { merge: true });
    flash(`${s.name} 점주 승인됨 ✓`); await reloadStores();
  };
  const rejectOwner = async (s: Store) => {
    await setDoc(doc(getDb(), 'stores', s.id), { ownerStatus: null, ownerName: null, ownerPassword: null, ownerVerified: false }, { merge: true });
    flash(`${s.name} 점주 신청 반려`); await reloadStores();
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white px-3 py-6">
        <div className="px-2">
          <div className="text-base font-black leading-tight">🏢 본사 관리자</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">HQ Console</div>
        </div>
        <nav className="mt-6 space-y-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${tab === t.id ? 'bg-brand-600 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>
              <span>{t.label}</span>
              {t.id === 'charities' && pendingCharities.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{pendingCharities.length}</span>}
              {t.id === 'stores' && pendingOwners.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{pendingOwners.length}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-7">
        <h1 className="text-xl font-black tracking-tight">{TABS.find((t) => t.id === tab)?.label}</h1>
        {loading && <p className="mt-8 text-center text-sm text-zinc-400">집계 중…</p>}

      {!loading && tab === 'kpi' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-start">
          <div>
            <div className="ss-card bg-brand-600 p-5 text-white">
              <div className="text-xs font-semibold text-white/80">플랫폼 총 누적 기부액 💛</div>
              <div className="text-3xl font-black">${totalDonated.toFixed(2)}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Kpi label="매장" value={stores.length} />
              <Kpi label="활성 회원" value={activeMembers} />
              <Kpi label="미사용 적립금" value={`$${totalBalance.toFixed(0)}`} />
            </div>
          </div>
          <div className="ss-card p-5">
            <h3 className="text-base font-extrabold">NPO별 기부 분포</h3>
            {byNpo.size === 0 ? <p className="mt-2 text-sm text-zinc-400">아직 기부 내역이 없어요.</p> : (
              <div className="mt-2 space-y-1.5">
                {[...byNpo.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => (
                  <div key={n} className="flex justify-between text-sm"><span className="text-zinc-600">{n}</span><span className="font-bold text-amber-600">${v.toFixed(2)}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && tab === 'stores' && !manageId && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">총 <b className="text-zinc-700">{stores.length}</b>개 매장 · 행 클릭 시 관리</p>
            <button onClick={() => setShowNew((v) => !v)} className="ss-btn-primary px-4 py-2">{showNew ? '닫기' : '＋ 신규 매장 등록'}</button>
          </div>
          {showNew && (
            <section className="ss-card mt-3 p-5">
              <h3 className="text-base font-extrabold">신규 매장 등록</h3>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div><label className="ss-label">매장 이름 *</label><input value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} className="ss-input" placeholder="LOVELETTER" /></div>
                <div><label className="ss-label">카테고리</label><input value={ns.category} onChange={(e) => setNs({ ...ns, category: e.target.value })} className="ss-input" placeholder="Korean Restaurant" /></div>
                <div><label className="ss-label">가입상태</label><select value={ns.tier} onChange={(e) => setNs({ ...ns, tier: e.target.value as Tier })} className="ss-input"><option value="free">프리</option><option value="official">정식</option><option value="premium">프리미엄</option></select></div>
                <div><label className="ss-label">사장 이름</label><input value={ns.ownerName} onChange={(e) => setNs({ ...ns, ownerName: e.target.value })} className="ss-input" placeholder="김사장" /></div>
                <div><label className="ss-label">담당자</label><input value={ns.manager} onChange={(e) => setNs({ ...ns, manager: e.target.value })} className="ss-input" placeholder="본사 담당자" /></div>
                <div><label className="ss-label">전화번호</label><input value={ns.phone} onChange={(e) => setNs({ ...ns, phone: e.target.value })} className="ss-input" placeholder="000-000-0000" inputMode="tel" /></div>
                <div className="md:col-span-2"><label className="ss-label">주소 (거리)</label><input value={ns.street} onChange={(e) => setNs({ ...ns, street: e.target.value })} className="ss-input" placeholder="123 Commonwealth Ave" /></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="ss-label">도시</label><input value={ns.city} onChange={(e) => setNs({ ...ns, city: e.target.value })} className="ss-input" placeholder="Fullerton" /></div><div><label className="ss-label">주</label><input value={ns.region} onChange={(e) => setNs({ ...ns, region: e.target.value })} className="ss-input" placeholder="CA" /></div></div>
                <div className="grid grid-cols-3 gap-2"><div><label className="ss-label">보상</label><input value={ns.reward} onChange={(e) => setNs({ ...ns, reward: e.target.value })} className="ss-input" placeholder="5" /></div><div><label className="ss-label">태블릿</label><input value={ns.tablets} onChange={(e) => setNs({ ...ns, tablets: e.target.value })} className="ss-input" /></div><div><label className="ss-label">스탠드</label><input value={ns.stands} onChange={(e) => setNs({ ...ns, stands: e.target.value })} className="ss-input" /></div></div>
              </div>
              <button onClick={createStore} className="ss-btn-primary mt-3 px-6">매장 등록</button>
              <p className="mt-1 text-[11px] text-zinc-400">* slug·매장 페이지 자동 생성. 메뉴는 점주 대시보드 미니홈피에서.</p>
            </section>
          )}
          <div className="ss-card mt-4 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                  <th className="px-3 py-3">매장 / 미니홈</th>
                  <th className="px-3 py-3">카테고리</th>
                  <th className="px-3 py-3">사장 / 담당</th>
                  <th className="px-3 py-3">가입상태</th>
                  <th className="px-3 py-3">결제</th>
                  <th className="px-3 py-3">기기</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => {
                  const host = `${SITE_URL}/store/${s.slug}`.replace(/^https?:\/\//, '');
                  const tier = (s.tier || 'free') as Tier; const pay = (s.paymentStatus || 'unpaid') as Pay;
                  return (
                    <tr key={s.id} onClick={() => openManage(s)} className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-3"><div className="font-bold">{s.name}</div><div className="text-[11px] text-zinc-400">{host}</div></td>
                      <td className="px-3 py-3 text-zinc-600">{s.category}</td>
                      <td className="px-3 py-3 text-zinc-600">{s.ownerName || '—'}{s.manager ? <span className="text-zinc-400"> / {s.manager}</span> : null}</td>
                      <td className="px-3 py-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_CLS[tier]}`}>{TIER_LABEL[tier]}</span></td>
                      <td className="px-3 py-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PAY_CLS[pay]}`}>{PAY_LABEL[pay]}</span></td>
                      <td className="px-3 py-3 text-xs text-zinc-500">📱{s.tablets ?? 0} · 🧷{s.stands ?? 0}</td>
                      <td className="px-3 py-3 text-right"><span className="ss-chip">관리 →</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {stores.length === 0 && <p className="py-4 text-center text-sm text-zinc-400">매장이 없어요.</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'stores' && manageId && mf && (
        <div className="mt-5">
          <button onClick={() => { setManageId(null); setMf(null); }} className="text-sm font-bold text-zinc-500 hover:text-zinc-700">← 매장 목록</button>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black tracking-tight">{mf.name} <span className={`ml-1 rounded px-1.5 py-0.5 align-middle text-[11px] font-bold ${TIER_CLS[mf.tier]}`}>{TIER_LABEL[mf.tier]}</span></h2>
            {managed && (
              <div className="flex items-center gap-3">
                <a href={`/owner/dashboard?store=${managed.slug}`} target="_blank" rel="noopener noreferrer" className="ss-btn-primary px-4 py-2 text-sm">🛠 사장 페이지 열기</a>
                <a href={`/store/${managed.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-600 hover:underline">미니홈 ↗</a>
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">사장이 직접 처리 못하는 설정(적립·메뉴·미니홈 등)을 본사 관리팀이 사장 페이지에서 대신 처리.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
            <section className="ss-card p-5">
              <h3 className="text-base font-extrabold">기본 정보</h3>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div><label className="ss-label">매장 이름</label><input value={mf.name} onChange={(e) => set('name', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">카테고리</label><input value={mf.category} onChange={(e) => set('category', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">사장 이름</label><input value={mf.ownerName} onChange={(e) => set('ownerName', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">담당자</label><input value={mf.manager} onChange={(e) => set('manager', e.target.value)} className="ss-input" /></div>
                <div className="col-span-2"><label className="ss-label">전화번호</label><input value={mf.phone} onChange={(e) => set('phone', e.target.value)} className="ss-input" /></div>
                <div className="col-span-2"><label className="ss-label">주소 (거리)</label><input value={mf.street} onChange={(e) => set('street', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">도시</label><input value={mf.city} onChange={(e) => set('city', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">주</label><input value={mf.region} onChange={(e) => set('region', e.target.value)} className="ss-input" /></div>
              </div>
            </section>

            <section className="ss-card p-5">
              <h3 className="text-base font-extrabold">적립 · 가입 · 결제</h3>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div><label className="ss-label">7개당 보상</label><input value={mf.reward} onChange={(e) => set('reward', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">재적립 인터벌(분)</label><input value={mf.interval} onChange={(e) => set('interval', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">가입상태</label><select value={mf.tier} onChange={(e) => set('tier', e.target.value)} className="ss-input"><option value="free">프리</option><option value="official">정식</option><option value="premium">프리미엄</option></select></div>
                <div><label className="ss-label">가입일자</label><input type="date" value={mf.signupDate} onChange={(e) => set('signupDate', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">결제 현황</label><select value={mf.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)} className="ss-input"><option value="paid">입금</option><option value="overdue">연체</option><option value="unpaid">미납</option></select></div>
                <div><label className="ss-label">월 요금($)</label><input value={mf.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} className="ss-input" /></div>
                <div className="col-span-2"><label className="ss-label">최근 입금일</label><input type="date" value={mf.lastPaidAt} onChange={(e) => set('lastPaidAt', e.target.value)} className="ss-input" /></div>
              </div>
            </section>

            <section className="ss-card p-5">
              <h3 className="text-base font-extrabold">기기 렌탈</h3>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div><label className="ss-label">📱 태블릿 (대)</label><input value={mf.tablets} onChange={(e) => set('tablets', e.target.value)} className="ss-input" inputMode="numeric" /></div>
                <div><label className="ss-label">🧷 스탠드 (개)</label><input value={mf.stands} onChange={(e) => set('stands', e.target.value)} className="ss-input" inputMode="numeric" /></div>
              </div>
            </section>

            <section className="ss-card p-5">
              <h3 className="text-base font-extrabold">특이사항 (메모)</h3>
              <textarea value={mf.memo} onChange={(e) => set('memo', e.target.value)} className="ss-input mt-1 min-h-24" placeholder="가맹점 운영 메모·특이사항…" />
              <div className="mt-4 rounded-xl bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">점주 인증</div>
                  {managed?.ownerStatus === 'approved' ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">승인됨</span>
                    : managed?.ownerStatus === 'pending' ? <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">승인 대기</span>
                    : <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-400">미신청</span>}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{managed?.ownerName ? `사장: ${managed.ownerName}` : '아직 점주 신청이 없어요.'}</div>
                {managed?.ownerStatus === 'pending' && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => rejectOwner(managed)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500">반려</button>
                    <button onClick={() => approveOwner(managed)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">승인</button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <button onClick={saveManage} className="ss-btn-primary mt-4 px-8">저장</button>
        </div>
      )}

      {/* 💛 기부 단체 승인 */}
      {!loading && tab === 'charities' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-start">
          <section className="ss-card p-5">
            <h3 className="text-base font-extrabold">사장 지정 단체 — 승인 대기 {pendingCharities.length > 0 && <span className="text-rose-500">({pendingCharities.length})</span>}</h3>
            {pendingCharities.length === 0 ? <p className="mt-2 text-sm text-zinc-400">승인 대기 중인 단체가 없어요.</p> : (
              <div className="mt-2 space-y-2">
                {pendingCharities.map((c) => (
                  <div key={`${c.storeId}_${c.id}`} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <div className="text-[11px] font-bold text-zinc-500">{storeName(c.storeId)}</div>
                    <div className="text-sm font-bold">{c.name}</div>
                    {c.linkUrl && <a href={c.linkUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[11px] text-brand-600">{c.linkUrl}</a>}
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => setCharityStatus(c, 'approved')} className="ss-btn-primary flex-1 py-2 text-sm">승인</button>
                      <button onClick={() => setCharityStatus(c, 'rejected')} className="flex-1 rounded-xl border border-rose-200 bg-white py-2 text-sm font-bold text-rose-600">반려</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] text-zinc-400">매장당 단체 5개 = 사장 2(승인 필요) + 본사 3. 모두 본사 관리.</p>
          </section>

          <section className="ss-card p-5">
            <h3 className="text-base font-extrabold">본사 지정 단체 (매장별 3개)</h3>
            <select value={hqStore} onChange={(e) => onPickHqStore(e.target.value)} className="ss-input mt-2">
              <option value="">매장 선택…</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {hqStore && (
              <div className="mt-3 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-zinc-200 p-3">
                    <span className="text-xs font-bold text-zinc-500">본사 지정 #{i + 1}</span>
                    <input value={hqForm[i].name} onChange={(e) => setHqForm((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="단체명" className="ss-input mt-1" />
                    <input value={hqForm[i].link} onChange={(e) => setHqForm((p) => p.map((x, j) => j === i ? { ...x, link: e.target.value } : x))} placeholder="링크 https://..." className="ss-input mt-1.5" />
                    <button onClick={() => saveHq(i)} className="ss-btn-soft mt-1.5 w-full">저장</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && tab === 'settlement' && (
        <section className="ss-card mt-5 p-5">
          <h3 className="text-base font-extrabold">매장 → NPO 정산 대장</h3>
          {donations.length === 0 ? <p className="mt-2 text-sm text-zinc-400">정산할 기부 내역이 없어요.</p> : (
            <div className="mt-2 divide-y divide-zinc-100">
              {donations.slice(0, 60).map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-zinc-600">{d.storeName ?? '매장'} → {d.npoName ?? '기부'}</span>
                  <span className="font-bold text-amber-600">${(d.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-zinc-400">* 일/주/월 시트·송금은 다음 단계.</p>
        </section>
      )}

      {!loading && tab === 'users' && (
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {customers.filter((c) => c.name).map((c) => (
            <div key={c.id} className="ss-card flex items-center justify-between p-4">
              <div><div className="font-bold">{c.name}</div><div className="text-xs text-zinc-500">{c.phone || '—'}</div></div>
              <div className="text-right text-xs"><div className="font-bold text-rose-500">잔액 ${(c.balance || 0).toFixed(2)}</div><div className="text-amber-600">기부 ${(c.donated || 0).toFixed(2)}</div></div>
            </div>
          ))}
          {customers.filter((c) => c.name).length === 0 && <p className="text-center text-sm text-zinc-400">가입 회원이 없어요.</p>}
        </div>
      )}

      {!loading && tab === 'ads' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-start">
          <section className="ss-card p-4">
            <h3 className="text-base font-extrabold">기본 보호 배너</h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">조PD만 숨김/복원. {isAdmin ? '(조PD 로그인됨 ✓)' : '(/me에서 조PD 로그인 시 제어)'}</p>
            <div className="mt-2 space-y-2">
              {DEFAULT_ADS.map((a) => {
                const hidden = adHidden.has(a.id);
                return (
                  <div key={a.id} className="rounded-xl border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.title} className="w-full rounded-lg" style={{ aspectRatio: '16/4', objectFit: 'cover' }} />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold">{hidden ? '🚫 숨김' : '🟢 노출중'} <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">기본·보호</span></span>
                      {isAdmin && <button onClick={() => hideDefault(a.id, !hidden)} className="ss-chip">{hidden ? '복원' : '숨기기'}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <h3 className="mt-4 text-base font-extrabold">광고 추가</h3>
            <input value={adImg} onChange={(e) => setAdImg(e.target.value)} className="ss-input mt-2" placeholder="이미지 URL (16:4)" />
            <input value={adLink} onChange={(e) => setAdLink(e.target.value)} className="ss-input mt-2" placeholder="클릭 링크 (선택)" />
            <button onClick={addAd} className="ss-btn-primary mt-2 w-full">광고 등록</button>
          </section>
          <section className="ss-card p-4">
            <h3 className="text-base font-extrabold">등록된 광고</h3>
            {adCustoms.length === 0 ? <p className="mt-2 text-sm text-zinc-400">아직 등록한 광고가 없어요.</p> : (
              <div className="mt-2 space-y-2">
                {adCustoms.map((a) => (
                  <div key={a.id} className="rounded-xl border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt="ad" className="w-full rounded-lg" style={{ aspectRatio: '16/4', objectFit: 'cover' }} />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold">{a.status === 'active' ? '🟢 노출중' : '⚪ 비활성'}</span>
                      <div className="flex gap-2">
                        <button onClick={() => toggleAd(a)} className="ss-chip">{a.status === 'active' ? '내리기' : '노출'}</button>
                        <button onClick={() => delAd(a.id)} className="text-xs font-bold text-red-500">삭제</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      </main>

      {/* 점주 인증 신청 — 본사 메인 승인 팝업 */}
      {pendingOwners.length > 0 && !ownerPopupSeen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🙋</span>
              <h3 className="text-lg font-black">점주 인증 신청 {pendingOwners.length}건</h3>
            </div>
            <p className="mt-1 text-sm text-zinc-500">새 점주가 매장 인증을 신청했어요. 승인하면 사장 페이지로 입장할 수 있어요.</p>
            <div className="mt-4 space-y-2">
              {pendingOwners.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2.5">
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-zinc-500">사장 {s.ownerName || '—'}{s.ownerClaimedAt ? ` · ${s.ownerClaimedAt.slice(0, 10)}` : ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => rejectOwner(s)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500">반려</button>
                    <button onClick={() => approveOwner(s)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">승인</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setOwnerPopupSeen(true)} className="mt-4 block w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-bold text-zinc-500">나중에</button>
          </div>
        </div>
      )}

      {toast && <div className="fixed inset-x-0 bottom-5 z-[60] mx-auto w-fit rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="ss-card bg-brand-50/60 p-3 text-center">
      <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
      <div className="text-xl font-black text-brand-700">{value}</div>
    </div>
  );
}
