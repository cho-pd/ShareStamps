'use client';

import { useEffect, useState } from 'react';
import { getDb, getStorageBucket } from '@/lib/firebase';
import { collection, getDocs, collectionGroup, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DEFAULT_ADS, type AdBanner } from '@/lib/ads';
import { SITE_URL } from '@/lib/stores';
import { storeSlug } from '@/lib/slug';
import { NPOS, type Npo } from '@/lib/npos';

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

const TIER_CLS: Record<Tier, string> = { free: 'bg-zinc-100 text-zinc-500', official: 'bg-brand-100 text-brand-700', premium: 'bg-amber-100 text-amber-700' };
const PAY_CLS: Record<Pay, string> = { paid: 'bg-emerald-100 text-emerald-700', overdue: 'bg-rose-100 text-rose-600', unpaid: 'bg-zinc-100 text-zinc-400' };
type Customer = { id: string; name?: string; phone?: string; balance?: number; donated?: number };
type Donation = { storeName?: string; npoName?: string; amount?: number; createdAt?: string };
type Charity = { id: string; storeId: string; name: string; desc?: string; linkUrl?: string; source: 'owner' | 'hq'; status: 'pending' | 'approved' | 'rejected'; docUrl?: string; docName?: string; npoId?: string };

const TABS = [
  { id: 'kpi', ko: '📊 통합 대시보드', en: '📊 Dashboard' },
  { id: 'stores', ko: '🏪 매장', en: '🏪 Stores' },
  { id: 'charities', ko: '💛 기부 단체 승인', en: '💛 Charity Approval' },
  { id: 'npos', ko: '🎗️ 비영리단체', en: '🎗️ Nonprofits' },
  { id: 'settlement', ko: '📈 정산', en: '📈 Settlement' },
  { id: 'users', ko: '👥 회원', en: '👥 Members' },
  { id: 'message', ko: '📣 문자 발송', en: '📣 SMS Blast' },
  { id: 'ads', ko: '🖼 광고 배너', en: '🖼 Ad Banners' },
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
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  useEffect(() => { try { const l = localStorage.getItem('ss_lang'); if (l === 'en' || l === 'ko') setLang(l); } catch {} }, []);
  const toggleLang = () => { const n = lang === 'ko' ? 'en' : 'ko'; setLang(n); try { localStorage.setItem('ss_lang', n); } catch {} };
  const tr = (ko: string, en: string) => (lang === 'ko' ? ko : en);
  const tierLabel = (t: Tier) => tr({ free: '프리', official: '정식', premium: '프리미엄' }[t], { free: 'Free', official: 'Official', premium: 'Premium' }[t]);
  const payLabel = (p: Pay) => tr({ paid: '입금', overdue: '연체', unpaid: '미납' }[p], { paid: 'Paid', overdue: 'Overdue', unpaid: 'Unpaid' }[p]);
  const [showNew, setShowNew] = useState(false);
  const [ownerPopupSeen, setOwnerPopupSeen] = useState(false);
  const [charityPopupSeen, setCharityPopupSeen] = useState(false);
  const [msgStoreId, setMsgStoreId] = useState('');
  const [msgMembers, setMsgMembers] = useState<{ name: string; phone: string }[]>([]);
  const [msgText, setMsgText] = useState('');
  const NS0 = { name: '', category: 'Korean Restaurant', ownerName: '', manager: '', phone: '', street: '', city: '', region: '', reward: '5', tier: 'free' as Tier, tablets: '0', stands: '0' };
  const [ns, setNs] = useState(NS0);
  const [manageId, setManageId] = useState<string | null>(null);
  const [mf, setMf] = useState<MForm | null>(null);
  // 비영리단체 마스터(Firestore `npos`) — 목록/등록/상세
  const [npos, setNpos] = useState<Npo[]>([]);
  const [npoManageId, setNpoManageId] = useState<string | null>(null); // null=목록, 'new'=등록, id=상세/편집
  const [nf, setNf] = useState<Npo | null>(null);
  const [npoUploading, setNpoUploading] = useState(false);
  // 매장 추천(점주 제출) 단체 편집 — 본사 관리자는 전권 편집 가능
  const [chEdit, setChEdit] = useState<Charity | null>(null);
  const [chUploading, setChUploading] = useState(false);
  const npoOptions = npos.length ? npos : NPOS; // 드롭다운/조회용 — 비었으면 코드 기본값 폴백

  const reloadStores = async () => {
    const s = await getDocs(collection(getDb(), 'stores'));
    setStores(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Store)));
  };
  const createStore = async () => {
    if (!ns.name.trim()) { flash(tr('매장 이름을 입력해 주세요.', 'Enter a store name.')); return; }
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
    flash(`'${ns.name.trim()}' ${tr('등록됨', 'registered')} ✓`); setNs(NS0); setShowNew(false); await reloadStores();
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
    flash(tr('저장됐어요 ✓', 'Saved ✓')); await reloadStores();
  };
  const set = (k: keyof MForm, v: string) => setMf((p) => p ? { ...p, [k]: v } : p);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [sSnap, cSnap] = await Promise.all([getDocs(collection(db, 'stores')), getDocs(collection(db, 'customers'))]);
        setStores(sSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Store)));
        setCustomers(cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Customer)));
        const [dSnap, adSnap, hidSnap, chSnap, npoSnap] = await Promise.all([
          getDocs(collectionGroup(db, 'donations')).catch(() => null),
          getDocs(collection(db, 'adBanners')).catch(() => null),
          getDocs(collection(db, 'adHidden')).catch(() => null),
          getDocs(collectionGroup(db, 'charities')).catch(() => null),
          getDocs(collection(db, 'npos')).catch(() => null),
        ]);
        if (dSnap) setDonations(dSnap.docs.map((d) => d.data() as Donation));
        if (adSnap) setAdCustoms(adSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as AdBanner)));
        if (hidSnap) setAdHidden(new Set(hidSnap.docs.map((d) => d.id)));
        if (chSnap) setCharities(chSnap.docs.map((d) => ({ id: d.id, storeId: d.ref.parent.parent!.id, ...(d.data() as object) } as Charity)));
        if (npoSnap) setNpos(npoSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Npo)));
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
  // 매장 추천 단체 편집(본사 전권) — 단체명·설명·링크·서류·상태 수정, 삭제
  const setChField = (k: keyof Charity, v: string) => setChEdit((p) => p ? { ...p, [k]: v } as Charity : p);
  const uploadChEditDoc = async (file: File) => {
    if (!chEdit) return;
    if (file.size > 15 * 1024 * 1024) { flash(tr('파일은 15MB 미만이어야 해요.', 'File must be under 15MB.')); return; }
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) { flash(tr('PDF 또는 이미지만 첨부돼요.', 'PDF or image only.')); return; }
    setChUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r = storageRef(getStorageBucket(), `charity-docs/${chEdit.storeId}/${chEdit.id}_${Date.now()}_${safe}`);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      setChEdit((p) => p ? { ...p, docUrl: url, docName: file.name } : p);
      flash(tr('서류 첨부됨 — 저장을 눌러 반영하세요.', 'Attached — click Save.'));
    } catch { flash(tr('첨부 실패 — 다시 시도해 주세요.', 'Upload failed.')); }
    finally { setChUploading(false); }
  };
  const saveChEdit = async () => {
    if (!chEdit || !chEdit.name.trim()) { flash(tr('단체명을 입력해 주세요.', 'Enter a name.')); return; }
    const c = chEdit;
    await setDoc(doc(getDb(), 'stores', c.storeId, 'charities', c.id), { name: c.name.trim(), desc: c.desc || '', linkUrl: c.linkUrl || '', docUrl: c.docUrl || '', docName: c.docName || '', status: c.status, updatedAt: new Date().toISOString() }, { merge: true });
    flash(tr('저장됐어요 ✓', 'Saved ✓')); setChEdit(null); await reloadCharities();
  };
  const deleteCharity = async (c: Charity) => {
    await deleteDoc(doc(getDb(), 'stores', c.storeId, 'charities', c.id)).catch(() => {});
    flash(tr('삭제됐어요', 'Deleted')); setChEdit(null); await reloadCharities();
  };
  const onPickHqStore = (sid: string) => setHqStore(sid);
  // 매장 관리 페이지 — 본사 지정 3개 슬롯을 NPO 마스터 목록에서 드롭다운 선택. 빈 값이면 슬롯 비움.
  const setHqCharitySlot = async (storeId: string, slot: number, npoId: string) => {
    const ref = doc(getDb(), 'stores', storeId, 'charities', `hq_${slot + 1}`);
    if (!npoId) { await deleteDoc(ref).catch(() => {}); await reloadCharities(); return; }
    const n = npoOptions.find((x) => x.id === npoId); if (!n) return;
    await setDoc(ref, { name: n.name, desc: n.sub || '', linkUrl: n.linkUrl || '', npoId: n.id, source: 'hq', status: 'approved', updatedAt: new Date().toISOString() });
    await reloadCharities();
  };

  // ── 비영리단체 마스터 CRUD (Firestore `npos`) ──
  const reloadNpos = async () => {
    const s = await getDocs(collection(getDb(), 'npos')).catch(() => null);
    if (s) setNpos(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Npo)));
  };
  const openNpo = (n?: Npo) => {
    if (n) { setNpoManageId(n.id); setNf({ ...n }); }
    else { setNpoManageId('new'); setNf({ id: '', name: '', sub: '', linkUrl: '', about: '', category: '', docUrl: '', docName: '' }); }
  };
  const setNfField = (k: keyof Npo, v: string) => setNf((p) => p ? { ...p, [k]: v } : p);
  const uploadNpoDoc = async (file: File) => {
    if (!nf) return;
    if (file.size > 15 * 1024 * 1024) { flash(tr('파일은 15MB 미만이어야 해요.', 'File must be under 15MB.')); return; }
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) { flash(tr('PDF 또는 이미지만 첨부돼요.', 'PDF or image only.')); return; }
    setNpoUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r = storageRef(getStorageBucket(), `charity-docs/npos/${nf.id || 'new'}_${Date.now()}_${safe}`);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      setNf((p) => p ? { ...p, docUrl: url, docName: file.name } : p);
      flash(tr('서류 첨부됨 — 저장을 눌러 반영하세요.', 'Attached — click Save.'));
    } catch { flash(tr('첨부 실패 — 다시 시도해 주세요.', 'Upload failed.')); }
    finally { setNpoUploading(false); }
  };
  const saveNpo = async () => {
    if (!nf || !nf.name.trim()) { flash(tr('단체명을 입력해 주세요.', 'Enter a name.')); return; }
    const id = nf.id || `npo_${storeSlug(nf.name) || Date.now().toString(36)}`;
    const { id: _omit, ...body } = nf; void _omit;
    await setDoc(doc(getDb(), 'npos', id), { ...body, updatedAt: new Date().toISOString() }, { merge: true });
    flash(tr('저장됐어요 ✓', 'Saved ✓')); await reloadNpos(); setNpoManageId(null); setNf(null);
  };
  const deleteNpo = async (id: string) => {
    await deleteDoc(doc(getDb(), 'npos', id)).catch(() => {});
    flash(tr('삭제됐어요', 'Deleted')); await reloadNpos(); setNpoManageId(null); setNf(null);
  };
  const seedNpos = async () => {
    await Promise.all(NPOS.map((n) => { const { id, ...b } = n; return setDoc(doc(getDb(), 'npos', id), { ...b, updatedAt: new Date().toISOString() }, { merge: true }); }));
    flash(tr('기본 단체 불러왔어요 ✓', 'Defaults loaded ✓')); await reloadNpos();
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

  // 📣 매장별 문자 발송 — 그 매장 회원의 전화번호 수집(본사 전용)
  const pickMsgStore = async (sid: string) => {
    setMsgStoreId(sid); setMsgMembers([]);
    if (!sid) return;
    try {
      const snap = await getDocs(collection(getDb(), 'stores', sid, 'stampCards'));
      const seen = new Set<string>(); const list: { name: string; phone: string }[] = [];
      snap.docs.forEach((d) => {
        const c = customers.find((x) => x.id === d.id);
        const phone = (c?.phone || '').trim();
        if (phone && !seen.has(phone)) { seen.add(phone); list.push({ name: c?.name || tr('손님', 'Guest'), phone }); }
      });
      setMsgMembers(list);
    } catch { setMsgMembers([]); }
  };
  const copyText = async (text: string, ok: string) => { try { await navigator.clipboard.writeText(text); flash(ok); } catch { flash(tr('복사 실패', 'Copy failed')); } };
  const downloadCsv = () => {
    const rows = [['name', 'phone'], ...msgMembers.map((m) => [m.name, m.phone])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `members_${msgStoreId}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const totalDonated = customers.reduce((s, c) => s + (c.donated || 0), 0);
  const totalBalance = customers.reduce((s, c) => s + (c.balance || 0), 0);
  const activeMembers = customers.filter((c) => c.name).length;
  const byNpo = new Map<string, { amount: number; count: number }>();
  donations.forEach((d) => {
    const n = d.npoName || '기타'; const cur = byNpo.get(n) || { amount: 0, count: 0 };
    byNpo.set(n, { amount: cur.amount + (d.amount || 0), count: cur.count + 1 });
  });
  const pendingCharities = charities.filter((c) => c.source === 'owner' && c.status === 'pending');
  // 매장 추천 비영리단체(점주 제출) — 대기 → 승인 → 반려 순으로 정렬
  const chOrder: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
  const ownerRecs = charities.filter((c) => c.source === 'owner' && c.name).sort((a, b) => (chOrder[a.status] ?? 9) - (chOrder[b.status] ?? 9));
  const managed = manageId ? stores.find((s) => s.id === manageId) || null : null;
  const pendingOwners = stores.filter((s) => s.ownerStatus === 'pending');
  const curTab = TABS.find((tb) => tb.id === tab);

  const approveOwner = async (s: Store) => {
    await setDoc(doc(getDb(), 'stores', s.id), { ownerStatus: 'approved', ownerVerified: true }, { merge: true });
    flash(`${s.name} ${tr('점주 승인됨', 'owner approved')} ✓`); await reloadStores();
  };
  const rejectOwner = async (s: Store) => {
    await setDoc(doc(getDb(), 'stores', s.id), { ownerStatus: null, ownerName: null, ownerPassword: null, ownerVerified: false }, { merge: true });
    flash(`${s.name} ${tr('점주 신청 반려', 'owner claim rejected')}`); await reloadStores();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1680px]">
      <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white px-3 py-6">
        <div className="px-2">
          <div className="text-base font-black leading-tight">{tr('🏢 본사 관리자', '🏢 HQ Admin')}</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">HQ Console</div>
          <button onClick={toggleLang} className="mt-2 rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-bold text-zinc-600">{lang === 'ko' ? 'EN' : '한국어'}</button>
        </div>
        <nav className="mt-6 space-y-1">
          {TABS.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${tab === tb.id ? 'bg-brand-600 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>
              <span>{lang === 'ko' ? tb.ko : tb.en}</span>
              {tb.id === 'charities' && pendingCharities.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{pendingCharities.length}</span>}
              {tb.id === 'stores' && pendingOwners.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{pendingOwners.length}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-10 py-8">
        <h1 className="text-xl font-black tracking-tight">{curTab ? (lang === 'ko' ? curTab.ko : curTab.en) : ''}</h1>
        {loading && <p className="mt-8 text-center text-sm text-zinc-400">{tr('집계 중…', 'Loading…')}</p>}

      {!loading && tab === 'kpi' && (
        <div className="mt-5 space-y-4">
          {/* 핵심 지표 — 아이콘 + 라벨/값/보조설명, 4개 동일 비중 (옛 SuperAdmin 스타일) */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <IconKpi icon="💛" tint="brand" label={tr('플랫폼 총 누적 기부액', 'Total Platform Donations')} value={`$${totalDonated.toFixed(2)}`} sub={`${tr('기부 건수', 'Donations')}: ${donations.length}${tr('건', '')}`} />
            <IconKpi icon="🏪" tint="blue" label={tr('플랫폼 입점 매장', 'Active Stores')} value={tr(`${stores.length}개 매장`, `${stores.length} Stores`)} sub={tr('전체 등록 매장 수', 'Total registered stores')} />
            <IconKpi icon="👥" tint="green" label={tr('적립 활성 회원', 'Active Members')} value={tr(`${activeMembers}명`, `${activeMembers} Members`)} sub={tr('총 가입 유저 수', 'Total registered members')} />
            <IconKpi icon="🪙" tint="purple" label={tr('미사용 적립금', 'Unused Reward')} value={`$${totalBalance.toFixed(0)}`} sub={tr('회원 보유 미사용 캐시', 'Cash balances held by members')} />
          </div>

          {/* 승인 대기 액션 — 풀와이드 (점주 인증 + 기부단체, 클릭 시 해당 탭으로) */}
          <section className="ss-card p-5">
            <h3 className="border-b border-zinc-100 pb-3 text-base font-extrabold">{tr('⏳ 승인 대기 액션', '⏳ Pending Actions')} {(pendingOwners.length + pendingCharities.length) > 0 && <span className="text-rose-500">({pendingOwners.length + pendingCharities.length})</span>}</h3>
            {pendingOwners.length === 0 && pendingCharities.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">{tr('승인 대기 중인 항목이 없어요.', 'Nothing pending approval.')}</p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pendingOwners.map((s) => (
                  <div key={s.id} onClick={() => { setTab('stores'); openManage(s); }} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 hover:bg-amber-50">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{s.name}</div>
                      <div className="text-xs text-zinc-500">{tr('사장', 'Owner')} {s.ownerName || '—'}</div>
                    </div>
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{tr('점주 인증', 'Owner')}</span>
                  </div>
                ))}
                {pendingCharities.map((c) => (
                  <div key={`${c.storeId}_${c.id}`} onClick={() => setTab('charities')} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 hover:bg-brand-50">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{c.name}</div>
                      <div className="text-xs text-zinc-500">{storeName(c.storeId)} · {c.docUrl ? tr('📎 501(c)(3) 첨부됨', '📎 501(c)(3) attached') : tr('⚠ 서류 없음', '⚠ no doc')}</div>
                    </div>
                    <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">{tr('기부 단체', 'Charity')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* NPO별 누적 모금 현황 — 풀와이드 리스트 (옛 SuperAdmin 스타일) */}
          <section className="ss-card p-5">
            <h3 className="border-b border-zinc-100 pb-3 text-base font-extrabold">🎗️ {tr('비영리 단체(NPO)별 누적 모금 현황', 'Cumulative Donations by NPO')}</h3>
            {byNpo.size === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">{tr('아직 기부 내역이 없어요.', 'No donations yet.')}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {[...byNpo.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([n, v]) => (
                  <div key={n} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3.5">
                    <strong className="text-[15px]">{n}</strong>
                    <div className="text-right">
                      <div className="text-lg font-black text-brand-700">${v.amount.toFixed(2)}</div>
                      <span className="text-xs text-zinc-500">{tr('기부 건수', 'Donations')}: {v.count}{tr('건', '')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && tab === 'stores' && !manageId && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{tr('총', 'Total')} <b className="text-zinc-700">{stores.length}</b>{tr('개 매장 · 행 클릭 시 관리', ' stores · click a row to manage')}</p>
            <button onClick={() => setShowNew((v) => !v)} className="ss-btn-primary px-4 py-2">{showNew ? tr('닫기', 'Close') : tr('＋ 신규 매장 등록', '＋ New Store')}</button>
          </div>
          {showNew && (
            <section className="ss-card mt-3 p-5">
              <h3 className="text-base font-extrabold">{tr('신규 매장 등록', 'Register New Store')}</h3>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div><label className="ss-label">{tr('매장 이름 *', 'Store name *')}</label><input value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} className="ss-input" placeholder="LOVELETTER" /></div>
                <div><label className="ss-label">{tr('카테고리', 'Category')}</label><input value={ns.category} onChange={(e) => setNs({ ...ns, category: e.target.value })} className="ss-input" placeholder="Korean Restaurant" /></div>
                <div><label className="ss-label">{tr('가입상태', 'Tier')}</label><select value={ns.tier} onChange={(e) => setNs({ ...ns, tier: e.target.value as Tier })} className="ss-input"><option value="free">{tr('프리', 'Free')}</option><option value="official">{tr('정식', 'Official')}</option><option value="premium">{tr('프리미엄', 'Premium')}</option></select></div>
                <div><label className="ss-label">{tr('사장 이름', 'Owner name')}</label><input value={ns.ownerName} onChange={(e) => setNs({ ...ns, ownerName: e.target.value })} className="ss-input" placeholder={tr('김사장', 'Owner')} /></div>
                <div><label className="ss-label">{tr('담당자', 'Manager')}</label><input value={ns.manager} onChange={(e) => setNs({ ...ns, manager: e.target.value })} className="ss-input" placeholder={tr('본사 담당자', 'HQ manager')} /></div>
                <div><label className="ss-label">{tr('전화번호', 'Phone')}</label><input value={ns.phone} onChange={(e) => setNs({ ...ns, phone: e.target.value })} className="ss-input" placeholder="000-000-0000" inputMode="tel" /></div>
                <div className="md:col-span-2"><label className="ss-label">{tr('주소 (거리)', 'Address (street)')}</label><input value={ns.street} onChange={(e) => setNs({ ...ns, street: e.target.value })} className="ss-input" placeholder="123 Commonwealth Ave" /></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="ss-label">{tr('도시', 'City')}</label><input value={ns.city} onChange={(e) => setNs({ ...ns, city: e.target.value })} className="ss-input" placeholder="Fullerton" /></div><div><label className="ss-label">{tr('주', 'State')}</label><input value={ns.region} onChange={(e) => setNs({ ...ns, region: e.target.value })} className="ss-input" placeholder="CA" /></div></div>
                <div className="grid grid-cols-3 gap-2"><div><label className="ss-label">{tr('보상', 'Reward')}</label><input value={ns.reward} onChange={(e) => setNs({ ...ns, reward: e.target.value })} className="ss-input" placeholder="5" /></div><div><label className="ss-label">{tr('태블릿', 'Tablets')}</label><input value={ns.tablets} onChange={(e) => setNs({ ...ns, tablets: e.target.value })} className="ss-input" /></div><div><label className="ss-label">{tr('스탠드', 'Stands')}</label><input value={ns.stands} onChange={(e) => setNs({ ...ns, stands: e.target.value })} className="ss-input" /></div></div>
              </div>
              <button onClick={createStore} className="ss-btn-primary mt-3 px-6">{tr('매장 등록', 'Register')}</button>
              <p className="mt-1 text-[11px] text-zinc-400">{tr('* slug·매장 페이지 자동 생성. 메뉴는 점주 대시보드 미니홈피에서.', '* Slug & store page auto-created. Menu is added in the owner dashboard mini-home.')}</p>
            </section>
          )}
          <div className="ss-card mt-4 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                  <th className="px-3 py-3">{tr('매장 / 미니홈', 'Store / Mini-home')}</th>
                  <th className="px-3 py-3">{tr('카테고리', 'Category')}</th>
                  <th className="px-3 py-3">{tr('사장 / 담당', 'Owner / Manager')}</th>
                  <th className="px-3 py-3">{tr('가입상태', 'Tier')}</th>
                  <th className="px-3 py-3">{tr('결제', 'Payment')}</th>
                  <th className="px-3 py-3">{tr('기기', 'Devices')}</th>
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
                      <td className="px-3 py-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_CLS[tier]}`}>{tierLabel(tier)}</span></td>
                      <td className="px-3 py-3"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PAY_CLS[pay]}`}>{payLabel(pay)}</span></td>
                      <td className="px-3 py-3 text-xs text-zinc-500">📱{s.tablets ?? 0} · 🧷{s.stands ?? 0}</td>
                      <td className="px-3 py-3 text-right"><span className="ss-chip">{tr('관리 →', 'Manage →')}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {stores.length === 0 && <p className="py-4 text-center text-sm text-zinc-400">{tr('매장이 없어요.', 'No stores.')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'stores' && manageId && mf && (
        <div className="mt-5">
          <button onClick={() => { setManageId(null); setMf(null); }} className="text-sm font-bold text-zinc-500 hover:text-zinc-700">{tr('← 매장 목록', '← Store list')}</button>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black tracking-tight">{mf.name} <span className={`ml-1 rounded px-1.5 py-0.5 align-middle text-[11px] font-bold ${TIER_CLS[mf.tier]}`}>{tierLabel(mf.tier)}</span></h2>
            {managed && (
              <div className="flex items-center gap-3">
                <a href={`/owner/dashboard?store=${managed.slug}&hq=1`} target="_blank" rel="noopener noreferrer" className="ss-btn-primary px-4 py-2 text-sm">{tr('🛠 사장 페이지 열기', '🛠 Open Owner Page')}</a>
                <a href={`/store/${managed.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-600 hover:underline">{tr('미니홈 ↗', 'Mini-home ↗')}</a>
              </div>
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">{tr('사장이 직접 처리 못하는 설정(적립·메뉴·미니홈 등)을 본사 관리팀이 사장 페이지에서 대신 처리.', 'HQ can handle settings the owner cannot (rewards, menu, mini-home) via the owner page.')}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-start">
            <section className="ss-card p-5">
              <h3 className="text-base font-extrabold">{tr('기본 정보', 'Basic Info')}</h3>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div><label className="ss-label">{tr('매장 이름', 'Store name')}</label><input value={mf.name} onChange={(e) => set('name', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('카테고리', 'Category')}</label><input value={mf.category} onChange={(e) => set('category', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('사장 이름', 'Owner name')}</label><input value={mf.ownerName} onChange={(e) => set('ownerName', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('담당자', 'Manager')}</label><input value={mf.manager} onChange={(e) => set('manager', e.target.value)} className="ss-input" /></div>
                <div className="col-span-2"><label className="ss-label">{tr('전화번호', 'Phone')}</label><input value={mf.phone} onChange={(e) => set('phone', e.target.value)} className="ss-input" /></div>
                <div className="col-span-2"><label className="ss-label">{tr('주소 (거리)', 'Address (street)')}</label><input value={mf.street} onChange={(e) => set('street', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('도시', 'City')}</label><input value={mf.city} onChange={(e) => set('city', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('주', 'State')}</label><input value={mf.region} onChange={(e) => set('region', e.target.value)} className="ss-input" /></div>
              </div>
            </section>

            <section className="ss-card p-5">
              <h3 className="text-base font-extrabold">{tr('적립 · 가입 · 결제', 'Reward · Tier · Payment')}</h3>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div><label className="ss-label">{tr('9개당 보상 ($)', 'Reward / 9 ($)')}</label><input value={mf.reward} onChange={(e) => set('reward', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('재적립 인터벌(분)', 'Re-earn interval (min)')}</label><input value={mf.interval} onChange={(e) => set('interval', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('가입상태', 'Tier')}</label><select value={mf.tier} onChange={(e) => set('tier', e.target.value)} className="ss-input"><option value="free">{tr('프리', 'Free')}</option><option value="official">{tr('정식', 'Official')}</option><option value="premium">{tr('프리미엄', 'Premium')}</option></select></div>
                <div><label className="ss-label">{tr('가입일자', 'Signup date')}</label><input type="date" value={mf.signupDate} onChange={(e) => set('signupDate', e.target.value)} className="ss-input" /></div>
                <div><label className="ss-label">{tr('결제 현황', 'Payment status')}</label><select value={mf.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)} className="ss-input"><option value="paid">{tr('입금', 'Paid')}</option><option value="overdue">{tr('연체', 'Overdue')}</option><option value="unpaid">{tr('미납', 'Unpaid')}</option></select></div>
                <div><label className="ss-label">{tr('월 요금($)', 'Monthly fee ($)')}</label><input value={mf.monthlyFee} onChange={(e) => set('monthlyFee', e.target.value)} className="ss-input" /></div>
                <div className="col-span-2"><label className="ss-label">{tr('최근 입금일', 'Last paid')}</label><input type="date" value={mf.lastPaidAt} onChange={(e) => set('lastPaidAt', e.target.value)} className="ss-input" /></div>
              </div>
            </section>

            <section className="ss-card p-5">
              <h3 className="text-base font-extrabold">{tr('기기 렌탈', 'Device Rental')}</h3>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div><label className="ss-label">{tr('📱 태블릿 (대)', '📱 Tablets')}</label><input value={mf.tablets} onChange={(e) => set('tablets', e.target.value)} className="ss-input" inputMode="numeric" /></div>
                <div><label className="ss-label">{tr('🧷 스탠드 (개)', '🧷 Stands')}</label><input value={mf.stands} onChange={(e) => set('stands', e.target.value)} className="ss-input" inputMode="numeric" /></div>
              </div>
            </section>

            <section className="ss-card p-5 md:col-span-2 xl:col-span-3">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <h3 className="text-base font-extrabold">{tr('특이사항 (메모)', 'Notes (memo)')}</h3>
                  <textarea value={mf.memo} onChange={(e) => set('memo', e.target.value)} className="ss-input mt-1 min-h-24" placeholder={tr('가맹점 운영 메모·특이사항…', 'Franchise notes…')} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">{tr('점주 인증', 'Owner Verification')}</h3>
                  <div className="mt-1 rounded-xl bg-zinc-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold">{managed?.ownerName || tr('미신청', 'Not applied')}</div>
                      {managed?.ownerStatus === 'approved' ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{tr('승인됨', 'Approved')}</span>
                        : managed?.ownerStatus === 'pending' ? <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{tr('승인 대기', 'Pending')}</span>
                        : <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-400">{tr('미신청', 'None')}</span>}
                    </div>
                    {!managed?.ownerName && <div className="mt-1 text-xs text-zinc-500">{tr('아직 점주 신청이 없어요.', 'No owner claim yet.')}</div>}
                    {managed?.ownerStatus === 'pending' && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => rejectOwner(managed)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500">{tr('반려', 'Reject')}</button>
                        <button onClick={() => approveOwner(managed)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">{tr('승인', 'Approve')}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 비영리단체 5슬롯 — 사장 2(점주 신청·본사 승인) + 본사 3(드롭다운 선택) */}
            <section className="ss-card p-5 md:col-span-2 xl:col-span-3">
              <h3 className="text-base font-extrabold">{tr('비영리단체', 'Charities')} <span className="text-xs font-medium text-zinc-400">{tr('(5개 = 사장 2 · 본사 3)', '(5 = Owner 2 · HQ 3)')}</span></h3>
              <p className="mt-0.5 text-[11px] text-zinc-400">{tr('사장 2개는 점주가 신청하고 본사가 승인해요. 본사 3개는 드롭다운에서 골라요.', 'Owner 2 are owner-requested & HQ-approved; HQ picks the 3 below.')}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[0, 1].map((i) => {
                  const c = charities.find((x) => x.storeId === manageId && x.id === `owner_${i + 1}`);
                  return (
                    <div key={`mo${i}`} className="rounded-xl border border-brand-200 bg-brand-50/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-brand-700">{tr('사장 지정', 'Owner')} #{i + 1}</span>
                        {c?.status && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : c.status === 'rejected' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>{c.status === 'approved' ? tr('승인', 'OK') : c.status === 'rejected' ? tr('반려', 'No') : tr('대기', 'Pending')}</span>}
                      </div>
                      <div className="mt-1.5 truncate text-sm font-bold">{c?.name || <span className="text-zinc-300">{tr('미신청', '—')}</span>}</div>
                      {c?.desc && <div className="truncate text-[11px] text-zinc-500">{c.desc}</div>}
                      {c && (c.docUrl
                        ? <a href={c.docUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] font-bold text-emerald-600">📎 501(c)(3)</a>
                        : <div className="mt-1 text-[11px] font-medium text-rose-400">⚠ {tr('서류 없음', 'no doc')}</div>)}
                      {c?.status === 'pending' && (
                        <div className="mt-2 flex gap-1.5">
                          <button onClick={() => setCharityStatus(c, 'approved')} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-[11px] font-bold text-white">{tr('승인', 'Approve')}</button>
                          <button onClick={() => setCharityStatus(c, 'rejected')} className="flex-1 rounded-lg border border-rose-200 py-1.5 text-[11px] font-bold text-rose-600">{tr('반려', 'Reject')}</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {[0, 1, 2].map((i) => {
                  const c = charities.find((x) => x.storeId === manageId && x.id === `hq_${i + 1}`);
                  return (
                    <div key={`mh${i}`} className="rounded-xl border border-zinc-200 p-3">
                      <span className="text-[11px] font-bold text-zinc-500">{tr('본사 지정', 'HQ')} #{i + 1}</span>
                      <select value={c?.npoId || ''} onChange={(e) => manageId && setHqCharitySlot(manageId, i, e.target.value)} className="ss-input mt-1.5 text-sm">
                        <option value="">{tr('선택 안 함', 'None')}</option>
                        {npoOptions.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                      {c?.desc && <div className="mt-1 truncate text-[11px] text-zinc-500">{c.desc}</div>}
                      {c?.name && !c.npoId && <div className="mt-1 text-[11px] text-amber-500">{tr('수기: ', 'manual: ')}{c.name}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <button onClick={saveManage} className="ss-btn-primary mt-4 px-8">{tr('저장', 'Save')}</button>
        </div>
      )}

      {/* 💛 기부 단체 승인 */}
      {!loading && tab === 'charities' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-start">
          <section className="ss-card p-5">
            <h3 className="text-base font-extrabold">{tr('사장 지정 단체 — 승인 대기', 'Owner-picked charities — pending')} {pendingCharities.length > 0 && <span className="text-rose-500">({pendingCharities.length})</span>}</h3>
            {pendingCharities.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{tr('승인 대기 중인 단체가 없어요.', 'No charities awaiting approval.')}</p> : (
              <div className="mt-2 space-y-2">
                {pendingCharities.map((c) => (
                  <div key={`${c.storeId}_${c.id}`} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <div className="text-[11px] font-bold text-zinc-500">{storeName(c.storeId)}</div>
                    <div className="text-sm font-bold">{c.name}</div>
                    {c.linkUrl && <a href={c.linkUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-[11px] text-brand-600">{c.linkUrl}</a>}
                    {c.docUrl
                      ? <a href={c.docUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">📎 {tr('501(c)(3) 서류 보기', 'View 501(c)(3)')}</a>
                      : <div className="mt-1 text-[11px] font-medium text-rose-400">⚠ {tr('501(c)(3) 서류 미첨부', 'No 501(c)(3) attached')}</div>}
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => setCharityStatus(c, 'approved')} className="ss-btn-primary flex-1 py-2 text-sm">{tr('승인', 'Approve')}</button>
                      <button onClick={() => setCharityStatus(c, 'rejected')} className="flex-1 rounded-xl border border-rose-200 bg-white py-2 text-sm font-bold text-rose-600">{tr('반려', 'Reject')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] text-zinc-400">{tr('매장당 단체 5개 = 사장 2(승인 필요) + 본사 3. 모두 본사 관리.', '5 charities per store = Owner 2 (needs approval) + HQ 3. All HQ-managed.')}</p>
          </section>

          <section className="ss-card p-5">
            <h3 className="text-base font-extrabold">{tr('본사 지정 단체 (매장별 3개)', 'HQ-picked charities (3 per store)')}</h3>
            <select value={hqStore} onChange={(e) => onPickHqStore(e.target.value)} className="ss-input mt-2">
              <option value="">{tr('매장 선택…', 'Select store…')}</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {hqStore && (
              <div className="mt-3 space-y-3">
                {[0, 1, 2].map((i) => {
                  const c = charities.find((x) => x.storeId === hqStore && x.id === `hq_${i + 1}`);
                  return (
                    <div key={i} className="rounded-xl border border-zinc-200 p-3">
                      <span className="text-xs font-bold text-zinc-500">{tr('본사 지정', 'HQ pick')} #{i + 1}</span>
                      <select value={c?.npoId || ''} onChange={(e) => setHqCharitySlot(hqStore, i, e.target.value)} className="ss-input mt-1">
                        <option value="">{tr('선택 안 함', 'None')}</option>
                        {npoOptions.map((n) => <option key={n.id} value={n.id}>{n.name}{n.sub ? ` · ${n.sub}` : ''}</option>)}
                      </select>
                      {c?.name && !c.npoId && <div className="mt-1 text-[11px] text-amber-500">{tr('수기 등록: ', 'manual: ')}{c.name}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 🎗️ 비영리단체 — 목록 (매장 추천 / 본사 등록 두 그룹) */}
      {!loading && tab === 'npos' && !npoManageId && (
        <div className="mt-5 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black tracking-tight">🎗️ {tr('비영리단체', 'Nonprofits')}</h2>
              <p className="mt-0.5 text-[11px] text-zinc-400">{tr('매장 추천(점주 제출)과 본사 등록(심사 완료) 두 가지로 나뉘어요.', 'Two kinds: store-recommended (owner-submitted) and HQ-registered (vetted).')}</p>
            </div>
            <button onClick={() => openNpo()} className="ss-btn-primary px-4 py-2 text-sm">＋ {tr('신규 비영리단체 등록', 'New nonprofit')}</button>
          </div>

          {/* ① 매장 추천 */}
          <section className="ss-card p-5">
            <h3 className="text-base font-extrabold">🏪 {tr('매장 추천', 'Store-recommended')} <span className="text-amber-600">{ownerRecs.length}</span></h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">{tr('점주가 추천해 등록 요청한 단체예요. 승인하면 해당 매장 기부 목록에 노출돼요.', 'Owner-submitted. Approve to show in that store’s donation list.')}</p>
            {ownerRecs.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">{tr('매장이 추천한 단체가 없어요.', 'No store recommendations.')}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      <th className="px-3 py-2.5">{tr('단체명', 'Name')}</th>
                      <th className="px-3 py-2.5">{tr('한줄 설명', 'Description')}</th>
                      <th className="px-3 py-2.5">{tr('추천 매장', 'Store')}</th>
                      <th className="px-3 py-2.5">501(c)(3)</th>
                      <th className="px-3 py-2.5">{tr('상태', 'Status')}</th>
                      <th className="px-3 py-2.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownerRecs.map((c) => (
                      <tr key={`${c.storeId}_${c.id}`} className="border-b border-zinc-100">
                        <td className="px-3 py-2.5"><span className="font-bold">{c.name}</span> <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">🏪 {tr('매장 추천', 'Rec')}</span></td>
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-zinc-600">{c.desc || '—'}</td>
                        <td className="px-3 py-2.5 text-zinc-600">{storeName(c.storeId)}</td>
                        <td className="px-3 py-2.5">{c.docUrl ? <a href={c.docUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-600">📎 {tr('보기', 'View')}</a> : <span className="text-rose-400">⚠ {tr('없음', 'none')}</span>}</td>
                        <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${c.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : c.status === 'rejected' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>{c.status === 'approved' ? tr('승인', 'Approved') : c.status === 'rejected' ? tr('반려', 'Rejected') : tr('대기', 'Pending')}</span></td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex gap-1.5">
                            {c.status === 'pending' && <>
                              <button onClick={() => setCharityStatus(c, 'approved')} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">{tr('승인', 'Approve')}</button>
                              <button onClick={() => setCharityStatus(c, 'rejected')} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600">{tr('반려', 'Reject')}</button>
                            </>}
                            <button onClick={() => setChEdit({ ...c })} className="ss-chip">{tr('편집', 'Edit')}</button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ② 본사 등록 */}
          <section className="ss-card p-5">
            <h3 className="text-base font-extrabold">🏛 {tr('본사 등록', 'HQ-registered')} <span className="text-brand-700">{npos.length}</span></h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">{tr('본사가 심사·등록한 마스터 목록. 매장 "본사 지정 3개"와 고객 기부 목록이 이 목록을 써요. 행을 눌러 편집.', 'HQ-vetted master list used by store HQ picks & customer donations. Click a row to edit.')}</p>
            {npos.length === 0 ? (
              <div className="mt-3 text-center">
                <p className="text-sm text-zinc-400">{tr('아직 등록된 단체가 없어요.', 'No nonprofits yet.')}</p>
                <button onClick={seedNpos} className="ss-btn-soft mt-3">{tr('기본 목록 불러오기 (8개)', 'Load defaults (8)')}</button>
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      <th className="px-3 py-2.5">{tr('단체명', 'Name')}</th>
                      <th className="px-3 py-2.5">{tr('분야', 'Category')}</th>
                      <th className="px-3 py-2.5">{tr('한줄 설명', 'Description')}</th>
                      <th className="px-3 py-2.5">{tr('홈페이지', 'Website')}</th>
                      <th className="px-3 py-2.5">501(c)(3)</th>
                      <th className="px-3 py-2.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {npos.map((n) => (
                      <tr key={n.id} onClick={() => openNpo(n)} className="cursor-pointer border-b border-zinc-100 hover:bg-brand-50">
                        <td className="px-3 py-2.5 font-bold">{n.name}</td>
                        <td className="px-3 py-2.5 text-zinc-600">{n.category || '—'}</td>
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-zinc-600">{n.sub || '—'}</td>
                        <td className="max-w-[160px] truncate px-3 py-2.5 text-brand-500">{(n.linkUrl || '').replace(/^https?:\/\//, '') || '—'}</td>
                        <td className="px-3 py-2.5">{n.docUrl ? <span className="font-bold text-emerald-600">📎 {tr('있음', 'yes')}</span> : <span className="text-rose-400">⚠ {tr('없음', 'none')}</span>}</td>
                        <td className="px-3 py-2.5 text-right"><span className="ss-chip">{tr('편집 →', 'Edit →')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 🎗️ 비영리단체 — 등록 / 상세·편집 */}
      {!loading && tab === 'npos' && npoManageId && nf && (
        <div className="mt-5">
          <button onClick={() => { setNpoManageId(null); setNf(null); }} className="text-sm font-bold text-zinc-500 hover:text-zinc-700">{tr('← 목록', '← List')}</button>
          <h2 className="mt-2 text-xl font-black tracking-tight">{npoManageId === 'new' ? tr('신규 비영리단체 등록', 'New nonprofit') : nf.name}</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,42rem)_20rem] lg:items-start">
          <div className="ss-card p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="ss-label">{tr('단체명', 'Name')}</label><input value={nf.name} onChange={(e) => setNfField('name', e.target.value)} className="ss-input" placeholder={tr('예: 세이브더칠드런', 'e.g. Save the Children')} /></div>
              <div><label className="ss-label">{tr('분야', 'Category')}</label><input value={nf.category || ''} onChange={(e) => setNfField('category', e.target.value)} className="ss-input" placeholder={tr('아동·환경·동물 등', 'Children, Environment…')} /></div>
            </div>
            <label className="ss-label">{tr('한줄 설명 (고객 노출)', 'One-line description (shown to customers)')}</label>
            <input value={nf.sub || ''} onChange={(e) => setNfField('sub', e.target.value)} maxLength={40} className="ss-input" placeholder={tr('예: 어린이 급식 지원', 'e.g. Feeding children')} />
            <label className="ss-label">{tr('홈페이지 링크', 'Website')}</label>
            <input value={nf.linkUrl || ''} onChange={(e) => setNfField('linkUrl', e.target.value)} className="ss-input" placeholder="https://..." />
            <label className="ss-label">{tr('상세 설명', 'About')}</label>
            <textarea value={nf.about || ''} onChange={(e) => setNfField('about', e.target.value)} className="ss-input min-h-24" placeholder={tr('단체 소개·활동 내용…', 'Mission and activities…')} />
            <label className="ss-label">{tr('501(c)(3) 증빙 서류', '501(c)(3) document')}</label>
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-3 py-2.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50">
              <input type="file" accept="application/pdf,image/*" className="hidden" disabled={npoUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadNpoDoc(f); e.target.value = ''; }} />
              {npoUploading ? tr('업로드 중…', 'Uploading…') : nf.docUrl ? tr('📎 서류 재첨부', '📎 Replace doc') : tr('📎 501(c)(3) 서류 첨부', '📎 Attach 501(c)(3)')}
            </label>
            {nf.docUrl && <a href={nf.docUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[11px] font-bold text-emerald-600" title={nf.docName}>✓ {nf.docName || tr('첨부된 서류 보기', 'View attached doc')}</a>}
            <div className="mt-4 flex gap-2">
              <button onClick={saveNpo} className="ss-btn-primary flex-1">{tr('저장', 'Save')}</button>
              {npoManageId !== 'new' && <button onClick={() => deleteNpo(nf.id)} className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600">{tr('삭제', 'Delete')}</button>}
            </div>
          </div>

          {/* 이 단체를 지정한 매장 — 본사 지정 slot에서 이 NPO를 고른 매장 목록 */}
          {npoManageId !== 'new' && (() => {
            const users = charities.filter((c) => c.source === 'hq' && c.npoId === nf.id);
            return (
              <div className="ss-card p-5">
                <h3 className="text-base font-extrabold">🏪 {tr('이 단체를 지정한 매장', 'Stores using this')} <span className="text-brand-700">{users.length}</span></h3>
                <p className="mt-0.5 text-[11px] text-zinc-400">{tr('본사 지정 슬롯에서 이 단체를 고른 매장이에요.', 'Stores that picked this in an HQ slot.')}</p>
                {users.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-400">{tr('아직 이 단체를 지정한 매장이 없어요.', 'No stores use this yet.')}</p>
                ) : (
                  <div className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-100">
                    {users.map((c) => (
                      <div key={`${c.storeId}_${c.id}`} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <span className="truncate font-bold">{storeName(c.storeId)}</span>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">{c.id.toUpperCase().replace('_', ' #')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {!loading && tab === 'settlement' && (
        <section className="ss-card mt-5 p-5">
          <h3 className="text-base font-extrabold">{tr('매장 → NPO 정산 대장', 'Store → NPO Settlement Ledger')}</h3>
          {donations.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{tr('정산할 기부 내역이 없어요.', 'No donations to settle.')}</p> : (
            <div className="mt-2 divide-y divide-zinc-100">
              {donations.slice(0, 60).map((d, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-zinc-600">{d.storeName ?? tr('매장', 'Store')} → {d.npoName ?? tr('기부', 'Donation')}</span>
                  <span className="font-bold text-amber-600">${(d.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-zinc-400">{tr('* 일/주/월 시트·송금은 다음 단계.', '* Daily/weekly/monthly sheets & payout — coming next.')}</p>
        </section>
      )}

      {!loading && tab === 'users' && (
        <div className="mt-5">
          <p className="text-sm text-zinc-500">{tr('총', 'Total')} <b className="text-zinc-700">{customers.filter((c) => c.name).length}</b>{tr('명 가입', ' members')}</p>
          <div className="ss-card mt-3 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                  <th className="px-3 py-3">{tr('이름', 'Name')}</th>
                  <th className="px-3 py-3">{tr('전화', 'Phone')}</th>
                  <th className="px-3 py-3">{tr('잔액', 'Balance')}</th>
                  <th className="px-3 py-3">{tr('기부', 'Donated')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.filter((c) => c.name).map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2.5 font-bold">{c.name}</td>
                    <td className="px-3 py-2.5 text-zinc-600">{c.phone || '—'}</td>
                    <td className="px-3 py-2.5 font-bold text-rose-500">${(c.balance || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-bold text-amber-600">${(c.donated || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.filter((c) => c.name).length === 0 && <p className="py-5 text-center text-sm text-zinc-400">{tr('가입 회원이 없어요.', 'No members yet.')}</p>}
          </div>
        </div>
      )}

      {!loading && tab === 'message' && (
        <div className="mt-5">
          <div className="ss-card max-w-md p-5">
            <label className="ss-label">{tr('매장 선택', 'Select store')}</label>
            <select value={msgStoreId} onChange={(e) => pickMsgStore(e.target.value)} className="ss-input">
              <option value="">{tr('매장 선택…', 'Select store…')}</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {msgStoreId && (
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              {/* 좌: 수신자 (매장과 직결된 정보라 함께) */}
              <section className="ss-card p-0 xl:col-span-1">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <span className="text-sm font-bold">{tr('수신자', 'Recipients')} <b className="text-brand-700">{msgMembers.length}</b>{tr('명', '')}</span>
                  {msgMembers.length > 0 && (
                    <div className="flex gap-1.5">
                      <button onClick={() => copyText(msgMembers.map((m) => m.phone).join('\n'), tr('번호 복사됨 ✓', 'Phones copied ✓'))} className="ss-chip">{tr('번호 복사', 'Copy')}</button>
                      <button onClick={downloadCsv} className="ss-chip">CSV</button>
                    </div>
                  )}
                </div>
                {msgMembers.length === 0 ? <p className="py-6 text-center text-sm text-zinc-400">{tr('전화번호가 있는 회원이 없어요.', 'No members with a phone.')}</p> : (
                  <div className="max-h-[420px] divide-y divide-zinc-50 overflow-y-auto">
                    {msgMembers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-zinc-600">{m.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 우: 메시지 작성+발송 (수신자 대상 확정 후 바로 옆에서 작성) */}
              <section className="ss-card p-5 xl:col-span-2">
                <h3 className="text-base font-extrabold">{tr('메시지 작성', 'Compose Message')}</h3>
                <textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} className="ss-input mt-2 min-h-40" placeholder={tr('회원에게 보낼 문자 내용…', 'Message to send to members…')} />
                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{msgText.length}{tr('자', ' chars')}</span>
                  <button onClick={() => copyText(msgText, tr('메시지 복사됨 ✓', 'Message copied ✓'))} className="font-bold text-brand-600">{tr('메시지 복사', 'Copy message')}</button>
                </div>
                <button onClick={() => flash(tr('SMS 게이트웨이 연동 후 실제 발송돼요. 지금은 번호·메시지 복사로 발송하세요.', 'SMS gateway pending — copy phones & message to send externally for now.'))} disabled={!msgText.trim() || msgMembers.length === 0} className="ss-btn-primary mt-3 w-full max-w-xs disabled:opacity-50">{tr('일괄 발송', 'Send blast')} ({msgMembers.length})</button>
                <p className="mt-2 text-[11px] text-zinc-400">{tr('* 본사 전용. 실제 발송은 SMS 게이트웨이(예: Twilio) 연동 후 활성화돼요.', '* HQ only. Actual sending activates after SMS gateway (e.g. Twilio) integration.')}</p>
              </section>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'ads' && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-start">
          <section className="ss-card p-4">
            <h3 className="text-base font-extrabold">{tr('기본 보호 배너', 'Protected Default Banners')}</h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">{tr('조PD만 숨김/복원.', 'Only 조PD can hide/restore.')} {isAdmin ? tr('(조PD 로그인됨 ✓)', '(조PD signed in ✓)') : tr('(/me에서 조PD 로그인 시 제어)', '(sign in as 조PD on /me to control)')}</p>
            <div className="mt-2 space-y-2">
              {DEFAULT_ADS.map((a) => {
                const hidden = adHidden.has(a.id);
                return (
                  <div key={a.id} className="rounded-xl border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.title} className="w-full rounded-lg" style={{ aspectRatio: '16/4', objectFit: 'cover' }} />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold">{hidden ? tr('🚫 숨김', '🚫 Hidden') : tr('🟢 노출중', '🟢 Live')} <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">{tr('기본·보호', 'default·protected')}</span></span>
                      {isAdmin && <button onClick={() => hideDefault(a.id, !hidden)} className="ss-chip">{hidden ? tr('복원', 'Restore') : tr('숨기기', 'Hide')}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            <h3 className="mt-4 text-base font-extrabold">{tr('광고 추가', 'Add Ad')}</h3>
            <input value={adImg} onChange={(e) => setAdImg(e.target.value)} className="ss-input mt-2" placeholder={tr('이미지 URL (16:4)', 'Image URL (16:4)')} />
            <input value={adLink} onChange={(e) => setAdLink(e.target.value)} className="ss-input mt-2" placeholder={tr('클릭 링크 (선택)', 'Click link (optional)')} />
            <button onClick={addAd} className="ss-btn-primary mt-2 w-full">{tr('광고 등록', 'Add Ad')}</button>
          </section>
          <section className="ss-card p-4">
            <h3 className="text-base font-extrabold">{tr('등록된 광고', 'Registered Ads')}</h3>
            {adCustoms.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{tr('아직 등록한 광고가 없어요.', 'No ads yet.')}</p> : (
              <div className="mt-2 space-y-2">
                {adCustoms.map((a) => (
                  <div key={a.id} className="rounded-xl border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt="ad" className="w-full rounded-lg" style={{ aspectRatio: '16/4', objectFit: 'cover' }} />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold">{a.status === 'active' ? tr('🟢 노출중', '🟢 Live') : tr('⚪ 비활성', '⚪ Inactive')}</span>
                      <div className="flex gap-2">
                        <button onClick={() => toggleAd(a)} className="ss-chip">{a.status === 'active' ? tr('내리기', 'Pause') : tr('노출', 'Activate')}</button>
                        <button onClick={() => delAd(a.id)} className="text-xs font-bold text-red-500">{tr('삭제', 'Delete')}</button>
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
              <h3 className="text-lg font-black">{tr('점주 인증 신청', 'Owner verification requests')} {pendingOwners.length}{tr('건', '')}</h3>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{tr('새 점주가 매장 인증을 신청했어요. 승인하면 사장 페이지로 입장할 수 있어요.', 'New owners requested verification. Approve to let them enter the owner page.')}</p>
            <div className="mt-4 space-y-2">
              {pendingOwners.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2.5">
                  <div>
                    <div className="font-bold">{s.name}</div>
                    <div className="text-xs text-zinc-500">{tr('사장', 'Owner')} {s.ownerName || '—'}{s.ownerClaimedAt ? ` · ${s.ownerClaimedAt.slice(0, 10)}` : ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => rejectOwner(s)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500">{tr('반려', 'Reject')}</button>
                    <button onClick={() => approveOwner(s)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">{tr('승인', 'Approve')}</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setOwnerPopupSeen(true)} className="mt-4 block w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-bold text-zinc-500">{tr('나중에', 'Later')}</button>
          </div>
        </div>
      )}

      {/* 기부 단체 승인 — 본사 승인 팝업 (점주 인증 팝업 다음 순서로 노출) */}
      {ownerPopupSeen && pendingCharities.length > 0 && !charityPopupSeen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💛</span>
              <h3 className="text-lg font-black">{tr('기부 단체 승인 요청', 'Charity approval requests')} {pendingCharities.length}{tr('건', '')}</h3>
            </div>
            <p className="mt-1 text-sm text-zinc-500">{tr('점주가 등록 요청한 단체예요. 501(c)(3) 서류를 확인하고 승인해 주세요.', 'Owners requested these charities. Check the 501(c)(3) doc before approving.')}</p>
            <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
              {pendingCharities.map((c) => (
                <div key={`${c.storeId}_${c.id}`} className="rounded-xl border border-zinc-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{c.name}</div>
                      {c.desc && <div className="truncate text-xs text-zinc-600">{c.desc}</div>}
                      <div className="text-xs text-zinc-500">{storeName(c.storeId)}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => setCharityStatus(c, 'rejected')} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500">{tr('반려', 'Reject')}</button>
                      <button onClick={() => setCharityStatus(c, 'approved')} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">{tr('승인', 'Approve')}</button>
                    </div>
                  </div>
                  {c.docUrl
                    ? <a href={c.docUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">📎 {tr('501(c)(3) 서류 보기', 'View 501(c)(3)')}</a>
                    : <div className="mt-1.5 text-[11px] font-medium text-rose-400">⚠ {tr('501(c)(3) 서류 미첨부', 'No 501(c)(3) attached')}</div>}
                </div>
              ))}
            </div>
            <button onClick={() => setCharityPopupSeen(true)} className="mt-4 block w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-bold text-zinc-500">{tr('나중에', 'Later')}</button>
          </div>
        </div>
      )}

      {/* 매장 추천 단체 편집 모달 — 본사 전권 */}
      {chEdit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6" onClick={() => setChEdit(null)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">🏪 {tr('매장 추천 단체 편집', 'Edit store-recommended')}</h3>
              <button onClick={() => setChEdit(null)} className="text-xl font-bold text-zinc-400">✕</button>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{storeName(chEdit.storeId)} · {chEdit.id}</p>
            <label className="ss-label">{tr('단체명', 'Name')}</label>
            <input value={chEdit.name} onChange={(e) => setChField('name', e.target.value)} className="ss-input" />
            <label className="ss-label">{tr('한줄 설명 (고객 노출)', 'One-line description')}</label>
            <input value={chEdit.desc || ''} onChange={(e) => setChField('desc', e.target.value)} maxLength={40} className="ss-input" placeholder={tr('예: 어린이 급식 지원', 'e.g. Feeding children')} />
            <label className="ss-label">{tr('홈페이지 링크', 'Website')}</label>
            <input value={chEdit.linkUrl || ''} onChange={(e) => setChField('linkUrl', e.target.value)} className="ss-input" placeholder="https://..." />
            <label className="ss-label">{tr('상태', 'Status')}</label>
            <select value={chEdit.status} onChange={(e) => setChField('status', e.target.value)} className="ss-input">
              <option value="pending">{tr('승인 대기', 'Pending')}</option>
              <option value="approved">{tr('승인', 'Approved')}</option>
              <option value="rejected">{tr('반려', 'Rejected')}</option>
            </select>
            <label className="ss-label">{tr('501(c)(3) 증빙 서류', '501(c)(3) document')}</label>
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-3 py-2.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50">
              <input type="file" accept="application/pdf,image/*" className="hidden" disabled={chUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadChEditDoc(f); e.target.value = ''; }} />
              {chUploading ? tr('업로드 중…', 'Uploading…') : chEdit.docUrl ? tr('📎 서류 재첨부', '📎 Replace doc') : tr('📎 501(c)(3) 서류 첨부', '📎 Attach 501(c)(3)')}
            </label>
            {chEdit.docUrl && <a href={chEdit.docUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[11px] font-bold text-emerald-600" title={chEdit.docName}>✓ {chEdit.docName || tr('첨부된 서류 보기', 'View attached doc')}</a>}
            <div className="mt-4 flex gap-2">
              <button onClick={saveChEdit} className="ss-btn-primary flex-1">{tr('저장', 'Save')}</button>
              <button onClick={() => deleteCharity(chEdit)} className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600">{tr('삭제', 'Delete')}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed inset-x-0 bottom-5 z-[60] mx-auto w-fit rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  );
}

const TINTS = {
  brand: 'bg-brand-50 text-brand-700',
  blue: 'bg-sky-50 text-sky-600',
  green: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-purple-50 text-purple-600',
} as const;

// 옛 SuperAdmin KPI 카드 스타일: 아이콘(색상 박스) + 라벨/값/보조설명, 4개 동일 비중.
function IconKpi({ icon, tint, label, value, sub }: { icon: string; tint: keyof typeof TINTS; label: string; value: string; sub: string }) {
  return (
    <div className="ss-card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${TINTS[tint]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-zinc-500">{label}</div>
        <div className="mt-0.5 truncate text-xl font-black text-zinc-800">{value}</div>
        <div className="mt-0.5 truncate text-[11px] text-zinc-400">{sub}</div>
      </div>
    </div>
  );
}
