'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { SITE_URL } from '@/lib/stores';
import { collection, getDocs, getDoc, collectionGroup, doc, setDoc, deleteDoc, query, where, limit } from 'firebase/firestore';


// 옛 OwnerDashboard 4탭 구성 차용(기프트카드 제외) · 태블릿/PC 레이아웃: 📊오버뷰 · 🔍고객 · 📈정산 · 🏠미니홈피.

type Review = { author: string; rating: number; comment: string; createdAt: string };
type MenuItem = { id: string; name: string; price: number; signature?: boolean; description?: string; category?: string };
type Cardholder = { name: string; phone?: string; stamps: number };
type Member = { deviceId: string; name: string; phone?: string; stamps: number; balance: number; donated: number; suspended?: boolean; memo?: string; allergy?: string };
type Donation = { npoName?: string; amount: number; createdAt: string };
type Charity = { id: string; name: string; linkUrl?: string; source: 'owner' | 'hq'; status: 'pending' | 'approved' | 'rejected' };
type StampLog = { name: string; amount: number | null; source: 'receipt' | 'review' | string; createdAt: string };
type Loaded = {
  storeId: string; storeName: string; slug: string;
  reward: number; interval: number; banner: string; description: string; sns: string[];
  customers: number; activeStamps: number; issuedValue: number;
  reviews: Review[]; menu: MenuItem[]; cardholders: Cardholder[]; members: Member[]; donations: Donation[]; charities: Charity[]; stampLogs: StampLog[];
};

const SNS_CHANNELS = ['facebook', 'instagram', 'google', 'tiktok', 'youtube'];
const FAQ_TEMPLATES = [
  { q: '영업시간이 어떻게 되나요?', a: '' },
  { q: '주차 가능한가요?', a: '' },
  { q: '예약이 되나요?', a: '' },
  { q: '대표 메뉴가 뭔가요?', a: '' },
];
const TABS = [
  { id: 'overview', ko: '📊 오버뷰', en: '📊 Overview' },
  { id: 'customers', ko: '🔍 고객', en: '🔍 Customers' },
  { id: 'settlement', ko: '📈 정산', en: '📈 Settlement' },
  { id: 'minihome', ko: '🏠 미니홈피', en: '🏠 Mini-Home' },
  { id: 'chatbot', ko: '🤖 챗봇', en: '🤖 Chatbot' },
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
  const [cbMenu, setCbMenu] = useState(''); const [cbReview, setCbReview] = useState('');
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [custQ, setCustQ] = useState('');
  const [selMemberId, setSelMemberId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [memoDraft, setMemoDraft] = useState(''); const [allergyDraft, setAllergyDraft] = useState('');
  const [newMemberName, setNewMemberName] = useState(''); const [newMemberPhone, setNewMemberPhone] = useState('');
  const normPhone = (p: string) => p.replace(/\D/g, '');
  const [memberDonations, setMemberDonations] = useState<{ npoName?: string; storeName?: string; amount: number; createdAt: string }[]>([]);
  // 사장 마케팅용 — 전화번호 전체 표시(보기 좋게 포맷)
  const fmtPhone = (p?: string) => {
    if (!p) return '—';
    const d = p.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('1')) return `${d[0]}-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return p;
  };
  const [ownerCh, setOwnerCh] = useState<{ name: string; linkUrl: string }[]>([{ name: '', linkUrl: '' }, { name: '', linkUrl: '' }]);
  const [lang, setLang] = useState<'ko' | 'en'>('ko');

  useEffect(() => { try { const l = localStorage.getItem('ss_lang'); if (l === 'en' || l === 'ko') setLang(l); } catch {} }, []);
  const toggleLang = () => { const n = lang === 'ko' ? 'en' : 'ko'; setLang(n); try { localStorage.setItem('ss_lang', n); } catch {} };
  const t = (ko: string, en: string) => (lang === 'ko' ? ko : en);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const [authed, setAuthed] = useState(false);
  const [gate, setGate] = useState<{ id: string; name: string; slug: string; ownerStatus?: string; ownerPassword?: string } | null>(null);
  const [pwIn, setPwIn] = useState(''); const [gateErr, setGateErr] = useState('');

  // 점주 로그인 게이트: 인증된 점주(또는 본사 hq=1)만 대시보드 입장.
  const prepare = async (s: string, hq = false) => {
    const target = s.trim(); if (!target) return;
    setSlug(target); setBusy(true); setError(null);
    try {
      const snap = await getDocs(query(collection(getDb(), 'stores'), where('slug', '==', target), limit(1)));
      if (snap.empty) { setError(t('해당 slug의 매장을 찾지 못했어요.', 'No store found for that slug.')); setGate(null); setAuthed(false); setData(null); return; }
      const d = snap.docs[0]; const sd = d.data() as { name: string; ownerStatus?: string; ownerPassword?: string };
      setGate({ id: d.id, name: sd.name, slug: target, ownerStatus: sd.ownerStatus, ownerPassword: sd.ownerPassword });
      let sess = ''; try { sess = localStorage.getItem('ss_owner_auth') || ''; } catch {}
      if (hq || sess === target) { setAuthed(true); await load(target); }
      else { setAuthed(false); setData(null); }
    } catch { setError(t('불러오기에 실패했어요.', 'Failed to load.')); }
    finally { setBusy(false); }
  };
  const submitGate = () => {
    if (!gate) return;
    if (gate.ownerStatus !== 'approved') { setGateErr(t('아직 본사 승인 전 매장이에요.', 'This store is not approved by HQ yet.')); return; }
    if ((gate.ownerPassword || '') !== pwIn) { setGateErr(t('비밀번호가 올바르지 않아요.', 'Incorrect password.')); return; }
    try { localStorage.setItem('ss_owner_auth', gate.slug); } catch {}
    setGateErr(''); setPwIn(''); setAuthed(true); load(gate.slug);
  };
  const logout = () => { try { localStorage.removeItem('ss_owner_auth'); } catch {} setAuthed(false); setData(null); setPwIn(''); };

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const hq = sp.get('hq') === '1'; // 본사 콘솔에서 hq=1 로 진입 시 게이트 우회
      const s = sp.get('store') || localStorage.getItem('ss_owner_store');
      if (s) prepare(s, hq);
    } catch {}
    // eslint-disable-next-line
  }, []);

  // 회원 상세 열 때 그 회원의 기부 내역 로드 (customers/{deviceId}/donations)
  useEffect(() => {
    if (!selMemberId) { setMemberDonations([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(getDb(), 'customers', selMemberId, 'donations'));
        if (cancelled) return;
        setMemberDonations(snap.docs
          .map((d) => d.data() as { npoName?: string; storeName?: string; amount: number; createdAt: string })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch { if (!cancelled) setMemberDonations([]); }
    })();
    return () => { cancelled = true; };
  }, [selMemberId]);

  const load = async (s: string) => {
    const target = s.trim(); if (!target) return;
    setBusy(true); setError(null);
    try {
      const db = getDb();
      const storeSnap = await getDocs(query(collection(db, 'stores'), where('slug', '==', target), limit(1)));
      if (storeSnap.empty) { setError(t('해당 slug의 매장을 찾지 못했어요.', 'No store found for that slug.')); setData(null); return; }
      const sd = storeSnap.docs[0];
      const st = sd.data() as { name: string; slug: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number; bannerUrl?: string; description?: string; snsChannels?: string[]; chatbotMenu?: string; chatbotReview?: string; faqs?: { q: string; a: string }[] };
      const [cardsSnap, reviewsSnap, menuSnap, custSnap, donSnap, chSnap, logSnap] = await Promise.all([
        getDocs(collection(db, 'stores', sd.id, 'stampCards')),
        getDocs(collection(db, 'stores', sd.id, 'reviews')),
        getDocs(collection(db, 'stores', sd.id, 'menuItems')),
        getDocs(collection(db, 'customers')).catch(() => null),
        getDocs(collectionGroup(db, 'donations')).catch(() => null),
        getDocs(collection(db, 'stores', sd.id, 'charities')).catch(() => null),
        getDocs(collection(db, 'stores', sd.id, 'stampLog')).catch(() => null),
      ]);
      const charities: Charity[] = (chSnap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as object) } as Charity));
      const o1 = charities.find((c) => c.id === 'owner_1'); const o2 = charities.find((c) => c.id === 'owner_2');
      setOwnerCh([{ name: o1?.name || '', linkUrl: o1?.linkUrl || '' }, { name: o2?.name || '', linkUrl: o2?.linkUrl || '' }]);
      const rwd = st.pointRewardPer7Stamps ?? 5, itv = st.earningIntervalMinutes ?? 60;
      const activeStamps = cardsSnap.docs.reduce((s2, d) => s2 + ((d.data().currentStamps as number) || 0), 0);
      const reviews = reviewsSnap.docs.map((d) => d.data() as Review).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const menu = menuSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as MenuItem));
      const custMap = new Map<string, { name?: string; phone?: string; balance?: number; donated?: number }>();
      (custSnap?.docs ?? []).forEach((d) => custMap.set(d.id, d.data() as { name?: string; phone?: string; balance?: number; donated?: number }));
      const cardholders: Cardholder[] = cardsSnap.docs
        .map((d) => ({ name: custMap.get(d.id)?.name || '', phone: custMap.get(d.id)?.phone, stamps: (d.data().currentStamps as number) || 0 }))
        .filter((c) => c.stamps > 0).sort((a, b) => b.stamps - a.stamps);
      // 회원 명부: 이 매장에 카드가 있는 모든 회원(스탬프 0 포함)
      const members: Member[] = cardsSnap.docs
        .map((d) => { const c = custMap.get(d.id) || {}; return { deviceId: d.id, name: c.name || '', phone: c.phone, stamps: (d.data().currentStamps as number) || 0, balance: c.balance || 0, donated: c.donated || 0, suspended: !!d.data().suspended, memo: (d.data().memo as string) || '', allergy: (d.data().allergy as string) || '' }; })
        .sort((a, b) => b.stamps - a.stamps || (b.balance - a.balance));
      const donations: Donation[] = (donSnap?.docs ?? [])
        .map((d) => d.data() as Donation & { storeId?: string })
        .filter((d) => (d as { storeId?: string }).storeId === sd.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const stampLogs: StampLog[] = (logSnap?.docs ?? [])
        .map((d) => { const l = d.data() as { deviceId?: string; amount?: number | null; source?: string; createdAt: string }; return { name: custMap.get(l.deviceId || '')?.name || t('손님', 'Guest'), amount: l.amount ?? null, source: l.source || 'receipt', createdAt: l.createdAt }; })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setData({
        storeId: sd.id, storeName: st.name, slug: st.slug, reward: rwd, interval: itv,
        banner: st.bannerUrl || '', description: st.description || '', sns: st.snsChannels || [],
        customers: cardsSnap.size, activeStamps, issuedValue: activeStamps * (rwd / 7),
        reviews: reviews.slice(0, 8), menu, cardholders, members, donations, charities, stampLogs,
      });
      setReward(String(rwd)); setIntervalV(String(itv)); setBanner(st.bannerUrl || ''); setDesc(st.description || ''); setSns(st.snsChannels || []);
      setCbMenu(st.chatbotMenu || ''); setCbReview(st.chatbotReview || ''); setFaqs(st.faqs || []);
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

  // 점주가 신규 회원을 수동으로 추가 (이름+전화) — 앱 없이 방문한 손님 온보딩용
  const addMember = async () => {
    if (!data) return;
    const phone = normPhone(newMemberPhone);
    if (!newMemberName.trim()) { flash(t('회원 이름을 입력해 주세요.', 'Enter the member name.')); return; }
    if (phone.length < 8) { flash(t('전화번호를 입력해 주세요.', 'Enter a phone number.')); return; }
    setBusy(true);
    try {
      const db = getDb();
      const idx = await getDoc(doc(db, 'phoneIndex', phone));
      const id = idx.exists() ? (idx.data().deviceId as string) : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      await setDoc(doc(db, 'customers', id), { name: newMemberName.trim(), phone, role: 'customer' }, { merge: true });
      await setDoc(doc(db, 'phoneIndex', phone), { deviceId: id, name: newMemberName.trim() }, { merge: true });
      const cardRef = doc(db, 'stores', data.storeId, 'stampCards', id);
      const already = await getDoc(cardRef);
      const cur = already.exists() ? ((already.data().currentStamps as number) || 0) : 0;
      await setDoc(cardRef, { deviceId: id, currentStamps: cur, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', id, 'cards', data.storeId), { storeId: data.storeId, storeName: data.storeName, slug: data.slug, currentStamps: cur, reward: data.reward, currency: 'USD', interval: data.interval, updatedAt: now }, { merge: true });
      flash(`${newMemberName.trim()} ${t('회원 추가됨 ✓', 'added ✓')}`);
      setNewMemberName(''); setNewMemberPhone(''); setShowAddMember(false);
      await load(data.slug);
    } catch { flash(t('추가 실패', 'Failed to add.')); } finally { setBusy(false); }
  };

  // 회원 명부에서 스탬프 직접 조정 (deviceId로 — 명부 행의 +/−)
  const adjustMemberStamp = async (deviceId: string, name: string, delta: number) => {
    if (!data) return;
    setBusy(true);
    try {
      const db = getDb();
      const cardRef = doc(db, 'stores', data.storeId, 'stampCards', deviceId);
      const snap = await getDoc(cardRef);
      const cur = snap.exists() ? ((snap.data().currentStamps as number) || 0) : 0;
      const next = Math.max(0, Math.min(7, cur + delta));
      const now = new Date().toISOString();
      await setDoc(cardRef, { deviceId, currentStamps: next, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', deviceId, 'cards', data.storeId), { storeId: data.storeId, storeName: data.storeName, slug: data.slug, currentStamps: next, reward: data.reward, currency: 'USD', interval: data.interval, updatedAt: now }, { merge: true });
      flash(`${name || t('회원', 'Member')}: ${delta > 0 ? '+' : ''}${delta} → ${next}/7`);
      await load(data.slug);
    } catch { flash(t('처리 실패', 'Failed.')); } finally { setBusy(false); }
  };

  // 회원 활동정지/해제 — 이 매장 카드 기준(다른 매장 계정엔 영향 없음). 정지 시 이 매장 적립도 막힘(/claim에서 체크).
  const toggleMemberSuspend = async (deviceId: string, name: string, suspend: boolean) => {
    if (!data) return;
    setBusy(true);
    try {
      await setDoc(doc(getDb(), 'stores', data.storeId, 'stampCards', deviceId), { suspended: suspend, updatedAt: new Date().toISOString() }, { merge: true });
      flash(suspend ? `${name || t('회원', 'Member')} ${t('활동정지됨', 'suspended')}` : `${name || t('회원', 'Member')} ${t('정지 해제됨', 'unsuspended')}`);
      await load(data.slug);
    } catch { flash(t('처리 실패', 'Failed.')); } finally { setBusy(false); }
  };
  // 회원 삭제 — 이 매장의 카드만 제거(글로벌 계정·다른 매장 카드는 유지)
  const deleteMember = async (deviceId: string) => {
    if (!data) return;
    setBusy(true);
    try {
      const db = getDb();
      await deleteDoc(doc(db, 'stores', data.storeId, 'stampCards', deviceId));
      await deleteDoc(doc(db, 'customers', deviceId, 'cards', data.storeId));
      flash(t('회원이 이 매장에서 삭제됐어요.', 'Member removed from this store.'));
      setSelMemberId(null);
      await load(data.slug);
    } catch { flash(t('삭제 실패', 'Delete failed.')); } finally { setBusy(false); }
  };

  // 회원 메모(특이사항)·알러지 저장 — 이 매장 카드 기준
  const saveMemberNotes = async (deviceId: string) => {
    if (!data) return;
    setBusy(true);
    try {
      await setDoc(doc(getDb(), 'stores', data.storeId, 'stampCards', deviceId), { memo: memoDraft.trim(), allergy: allergyDraft.trim(), updatedAt: new Date().toISOString() }, { merge: true });
      flash(t('저장됐어요 ✓', 'Saved ✓'));
      await load(data.slug);
    } catch { flash(t('저장 실패', 'Save failed.')); } finally { setBusy(false); }
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
  const receiptTotal = data ? data.stampLogs.reduce((s, l) => s + (l.amount || 0), 0) : 0;
  const chStatus = (s?: string) => s === 'approved' ? t('승인됨', 'Approved') : s === 'rejected' ? t('반려됨', 'Rejected') : t('승인 대기', 'Pending');
  const filteredMembers = data ? data.members.filter((m) => { const q = custQ.trim().toLowerCase(); if (!q) return true; return (m.name || '').toLowerCase().includes(q) || (m.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '')); }) : [];
  const selMember = data && selMemberId ? data.members.find((m) => m.deviceId === selMemberId) || null : null;

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3 px-1 pt-7">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('👨‍🍳 점주 대시보드', '👨‍🍳 Owner Dashboard')} <span className="text-sm font-medium text-zinc-400">{t('(태블릿·PC)', '(Tablet·PC)')}</span></h1>
          <p className="mt-0.5 text-sm text-zinc-500">{t('매장 현황·고객·정산·미니홈피를 관리해요.', 'Manage store status, customers, settlement, and mini-home.')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={toggleLang} className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-600">{lang === 'ko' ? 'EN' : '한국어'}</button>
          {authed && <Link href={`/owner/scan${(data?.slug || slug) ? `?store=${data?.slug || slug}` : ''}`} className="ss-btn-primary px-5 py-2.5">{t('📷 QR 스캔 모드', '📷 QR Scan Mode')}</Link>}
        </div>
      </header>

      {/* 로그인 게이트 — 인증 안 된 점주 */}
      {!authed && (
        <div className="mt-8 flex flex-col items-center">
          <div className="ss-card w-full max-w-sm p-7 text-center">
            {gate ? (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl">🔒</div>
                <h2 className="mt-3 text-lg font-black">{gate.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{t('점주 비밀번호를 입력해 입장하세요.', 'Enter the owner password to continue.')}</p>
                <input type="password" value={pwIn} onChange={(e) => { setPwIn(e.target.value); setGateErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter') submitGate(); }} className="ss-input mt-4 text-center" placeholder={t('점주 비밀번호', 'Owner password')} autoFocus />
                {gateErr && <p className="mt-2 text-sm font-semibold text-rose-500">{gateErr}</p>}
                <button onClick={submitGate} className="ss-btn-primary mt-4 block w-full py-3">{t('입장', 'Enter')}</button>
                <Link href="/owner/new" className="mt-3 block text-xs font-bold text-brand-600">{t('점주 신청 / 다른 매장', 'Owner signup / other store')}</Link>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">🔒</div>
                <p className="mt-3 text-sm text-zinc-500">{t('인증된 점주만 대시보드에 입장할 수 있어요.', 'Only verified owners can enter the dashboard.')}</p>
                <form onSubmit={(e) => { e.preventDefault(); prepare(slug); }} className="mt-3 flex gap-2">
                  <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('매장 slug', 'Store slug')} className="ss-input flex-1" />
                  <button type="submit" disabled={busy} className="ss-btn-primary px-4">{busy ? '…' : t('확인', 'Go')}</button>
                </form>
                <Link href="/owner/new" className="mt-4 block text-sm font-bold text-brand-600">{t('점주 시작하기 →', 'Start as owner →')}</Link>
              </>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {authed && data && (
        <>
          <div className="mt-5 flex items-center gap-3 border-b border-zinc-100 pb-px">
            {TABS.map((tb) => (
              <button key={tb.id} onClick={() => { setTab(tb.id); setSelMemberId(null); }} className={`-mb-px whitespace-nowrap border-b-2 px-2 pb-2 text-sm font-bold transition ${tab === tb.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>{lang === 'ko' ? tb.ko : tb.en}</button>
            ))}
            <span className="ml-auto flex items-center gap-2 text-sm font-extrabold text-zinc-700">{data.storeName}<button onClick={logout} className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-bold text-zinc-400 hover:text-zinc-600">{t('로그아웃', 'Logout')}</button></span>
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

              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">{t('💰 실시간 캐시 승인 큐', '💰 Live Cash Approval Queue')}</h3>
                <p className="mt-2 text-center text-sm text-zinc-400">{t('대기 중인 승인이 없어요.', 'No pending approvals.')}</p>
                <p className="mt-1 text-center text-[11px] text-zinc-400">{t('* 회원 스탬프 지급/차감은 🔍 고객 탭(회원 명부)에서. 손님 결제 승인 연동은 다음 단계.', '* Give/deduct member stamps in the 🔍 Customers tab. Customer payment approval — coming next.')}</p>
              </section>

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

          {/* 🔍 고객 — 회원 명부 */}
          {tab === 'customers' && !selMember && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold">{t('회원 명부', 'Members')} <b className="text-brand-700">{data.members.length}</b></span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-zinc-500">{t('활성 단골', 'Active')} {data.members.filter((m) => m.stamps > 0).length}</span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-zinc-500">7/7 {data.members.filter((m) => m.stamps >= 7).length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder={t('이름·전화 검색', 'Search name/phone')} className="ss-input w-full max-w-xs" />
                  <button onClick={() => setShowAddMember((v) => !v)} className="ss-btn-primary shrink-0 px-4 py-2 text-sm">{showAddMember ? t('닫기', 'Close') : t('＋ 회원 추가', '＋ Add Member')}</button>
                </div>
              </div>

              {showAddMember && (
                <section className="ss-card mt-3 p-4">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1">
                      <label className="ss-label">{t('이름', 'Name')}</label>
                      <input value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} className="ss-input" placeholder={t('홍길동', 'e.g. John Kim')} />
                    </div>
                    <div className="flex-1">
                      <label className="ss-label">{t('전화번호', 'Phone')}</label>
                      <input value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} className="ss-input" placeholder="000-000-0000" inputMode="tel" />
                    </div>
                    <button onClick={addMember} disabled={busy} className="ss-btn-primary px-5 py-2.5">{t('추가', 'Add')}</button>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">{t('* 앱 없이 방문한 손님도 이름·전화로 등록해 스탬프를 관리할 수 있어요.', '* Onboard walk-in customers by name & phone, even without the app.')}</p>
                </section>
              )}

              <div className="ss-card mt-3 overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                      <th className="px-3 py-3">{t('회원', 'Member')}</th>
                      <th className="px-3 py-3">{t('전화', 'Phone')}</th>
                      <th className="px-3 py-3">{t('스탬프', 'Stamps')}</th>
                      <th className="px-3 py-3">{t('캐시', 'Cash')}</th>
                      <th className="px-3 py-3">{t('기부', 'Donated')}</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => (
                      <tr key={m.deviceId} onClick={() => { setSelMemberId(m.deviceId); setConfirmDelete(false); setMemoDraft(m.memo || ''); setAllergyDraft(m.allergy || ''); }} className={`cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 ${m.suspended ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2.5 font-bold text-brand-700 hover:underline">
                          {m.name || t('손님', 'Guest')}
                          {m.suspended && <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 align-middle text-[10px] font-bold text-zinc-500">{t('정지', 'Suspended')}</span>}
                          {m.allergy && <span className="ml-1.5 align-middle" title={m.allergy}>⚠️</span>}
                          {m.memo && <span className="ml-1 align-middle" title={m.memo}>📝</span>}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-500">{fmtPhone(m.phone)}</td>
                        <td className="px-3 py-2.5"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">⭐ {Math.min(m.stamps, 7)}/7</span></td>
                        <td className="px-3 py-2.5 font-semibold text-zinc-700">${m.balance.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-amber-600">${m.donated.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right text-zinc-300">›</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredMembers.length === 0 && <p className="py-5 text-center text-sm text-zinc-400">{data.members.length === 0 ? t('아직 회원이 없어요.', 'No members yet.') : t('검색 결과가 없어요.', 'No matches.')}</p>}
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">{t('* 회원 이름을 클릭하면 상세에서 스탬프 지급/차감할 수 있어요.', '* Click a member name to give/deduct stamps in the detail page.')}</p>
            </div>
          )}

          {/* 🔍 고객 — 회원 상세 (사장용: 단순 리스트) */}
          {tab === 'customers' && selMember && (
            <div className="mx-auto mt-5 max-w-2xl">
              <button onClick={() => { setSelMemberId(null); setConfirmDelete(false); }} className="text-sm font-bold text-zinc-500 hover:text-zinc-700">{t('← 회원 명부', '← Members')}</button>

              <div className="ss-card mt-3 divide-y divide-zinc-100 p-0">
                {/* 이름·전화 + 스탬프 조정 */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <div className="min-w-0">
                    <div className="text-lg font-black leading-tight">{selMember.name || t('손님', 'Guest')}{selMember.suspended && <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 align-middle text-[11px] font-bold text-zinc-500">{t('활동정지됨', 'Suspended')}</span>}</div>
                    <div className="text-sm text-zinc-500">{fmtPhone(selMember.phone)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustMemberStamp(selMember.deviceId, selMember.name, -1)} disabled={busy || selMember.suspended} className="h-8 w-8 rounded-lg border border-zinc-200 text-lg font-bold text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">−</button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 7 }).map((_, i) => (<span key={i} className={`h-2.5 w-2.5 rounded-full ${i < Math.min(selMember.stamps, 7) ? 'bg-brand-600' : 'bg-zinc-200'}`} />))}
                      <span className="ml-1.5 text-sm font-bold text-zinc-700">{Math.min(selMember.stamps, 7)}/7</span>
                    </div>
                    <button onClick={() => adjustMemberStamp(selMember.deviceId, selMember.name, 1)} disabled={busy || selMember.suspended} className="h-8 w-8 rounded-lg bg-brand-600 text-lg font-bold text-white hover:bg-brand-700 disabled:opacity-40">＋</button>
                  </div>
                </div>

                {/* 요약: 라벨 / 값 리스트 */}
                <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-zinc-500">{t('스탬프 가치', 'Stamp value')}</span><span className="font-bold text-zinc-800">${(Math.min(selMember.stamps, 7) * (data.reward / 7)).toFixed(2)}</span></div>
                <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-zinc-500">{t('캐시 잔액', 'Cash balance')}</span><span className="font-bold text-zinc-800">${selMember.balance.toFixed(2)}</span></div>
                <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-zinc-500">{t('누적 기부', 'Total donated')}</span><span className="font-bold text-amber-600">${selMember.donated.toFixed(2)}</span></div>

                {/* 알러지 · 메모(특이사항) */}
                <div className="px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{t('알러지 · 메모', 'Allergy · Notes')}</div>
                  <div className="mt-2">
                    <label className="ss-label">⚠️ {t('알러지', 'Allergy')}</label>
                    <input value={allergyDraft} onChange={(e) => setAllergyDraft(e.target.value)} className="ss-input" placeholder={t('예: 땅콩, 갑각류', 'e.g. Peanuts, Shellfish')} />
                  </div>
                  <div className="mt-2">
                    <label className="ss-label">📝 {t('메모 (특이사항)', 'Notes')}</label>
                    <textarea value={memoDraft} onChange={(e) => setMemoDraft(e.target.value)} className="ss-input min-h-20" placeholder={t('예: 진상 고객, 항상 늦게 취소함 / VIP, 매주 방문', 'e.g. difficult customer, cancels late / VIP, weekly regular')} />
                  </div>
                  <button onClick={() => saveMemberNotes(selMember.deviceId)} disabled={busy} className="ss-btn-primary mt-2 px-5 py-2 text-sm disabled:opacity-50">{t('메모 저장', 'Save Notes')}</button>
                </div>

                {/* 기부 내역 */}
                <div className="px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{t('기부 내역', 'Donation history')} · {memberDonations.length}{t('건', '')}</div>
                  {memberDonations.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-400">{t('기부 내역이 없어요.', 'No donations.')}</p>
                  ) : (
                    <div className="mt-1.5 divide-y divide-zinc-50">
                      {memberDonations.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <div className="min-w-0 truncate"><span className="font-semibold">💛 {d.npoName || t('기부', 'Donation')}</span><span className="ml-1.5 text-[11px] text-zinc-400">{d.storeName ? `${d.storeName} · ` : ''}{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}</span></div>
                          <span className="shrink-0 font-bold text-amber-600">${(d.amount || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 회원 관리 — 활동정지/해제, 삭제 */}
                <div className="px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{t('회원 관리', 'Member Management')}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selMember.suspended ? (
                      <button onClick={() => toggleMemberSuspend(selMember.deviceId, selMember.name, false)} disabled={busy} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-bold text-emerald-600 disabled:opacity-50">{t('정지 해제', 'Unsuspend')}</button>
                    ) : (
                      <button onClick={() => toggleMemberSuspend(selMember.deviceId, selMember.name, true)} disabled={busy} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold text-zinc-600 disabled:opacity-50">{t('활동정지', 'Suspend')}</button>
                    )}
                    {!confirmDelete ? (
                      <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-bold text-rose-600">{t('회원 삭제', 'Delete Member')}</button>
                    ) : (
                      <span className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-sm">
                        <span className="font-semibold text-rose-600">{t('정말 삭제할까요?', 'Delete for real?')}</span>
                        <button onClick={() => deleteMember(selMember.deviceId)} disabled={busy} className="font-bold text-rose-700 underline disabled:opacity-50">{t('삭제', 'Delete')}</button>
                        <button onClick={() => setConfirmDelete(false)} className="font-bold text-zinc-500">{t('취소', 'Cancel')}</button>
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">{t('* 정지 시 이 매장에서 스탬프 지급/적립이 막혀요. 삭제는 이 매장 카드만 지워지고, 회원 계정과 다른 매장 기록은 남아요.', '* Suspending blocks giving/earning stamps at this store. Deleting removes only this store’s card — the account and other stores are unaffected.')}</p>
                </div>
              </div>
            </div>
          )}

          {/* 📈 정산 */}
          {tab === 'settlement' && (
            <div className="mt-5">
              <div className="grid max-w-2xl grid-cols-3 gap-4">
                <Stat label={t('발행 적립금', 'Issued Reward')} value={`$${data.issuedValue.toFixed(2)}`} accent="rose" />
                <Stat label={t('기부 정산 💛', 'Donations 💛')} value={`$${donatedTotal.toFixed(2)}`} accent="amber" />
                <Stat label={t('영수증 총액 🧾', 'Receipt Total 🧾')} value={`$${receiptTotal.toFixed(2)}`} accent="brand" />
              </div>

              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">{t('🧾 스탬프 적립 내역', 'Stamp Earning Log')}</h3>
                <p className="mt-0.5 text-[11px] text-zinc-400">{t('영수증 스캔은 금액이 기록되고, 리뷰 적립은 금액 없이 기록돼요.', 'Receipt scans record an amount; review-earned stamps show no amount.')}</p>
                {data.stampLogs.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{t('적립 내역이 없어요.', 'No stamp log yet.')}</p> : (
                  <div className="mt-2 max-h-80 divide-y divide-zinc-100 overflow-y-auto">
                    {data.stampLogs.map((l, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <span className="font-semibold">{l.name}</span>
                          <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">{l.source === 'review' ? t('리뷰', 'Review') : t('영수증', 'Receipt')}</span>
                          <span className="ml-1.5 text-[11px] text-zinc-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className="font-bold text-brand-700">{l.amount != null ? `$${l.amount.toFixed(2)}` : t('금액 없음', 'No amount')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

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

              <section className="ss-card mt-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold">{t('❓ FAQ 관리', '❓ FAQ')}</h3>
                  <button onClick={() => setFaqs((p) => [...p, { q: '', a: '' }])} className="ss-chip">{t('＋ 질문 추가', '＋ Add question')}</button>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">{t('비우면 매장 정보로 자동 생성돼요. 등록하면 미니홈·AI 검색에 그대로 노출.', 'Leave empty to auto-generate. Saved FAQs show on the mini-home & AI search.')}</p>
                <div className="mt-3 space-y-3">
                  {faqs.length === 0 && (
                    <p className="text-sm text-zinc-400">{t('등록된 FAQ가 없어요. (지금은 자동 생성 사용 중)', 'No custom FAQ yet. (auto-generated for now)')}
                      <button onClick={() => setFaqs(FAQ_TEMPLATES.map((x) => ({ ...x })))} className="ml-2 font-bold text-brand-600">{t('기본 질문으로 시작', 'Start with templates')}</button>
                    </p>
                  )}
                  {faqs.map((f, i) => (
                    <div key={i} className="rounded-xl border border-zinc-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500">Q{i + 1}</span>
                        <button onClick={() => setFaqs((p) => p.filter((_, j) => j !== i))} className="text-xs font-bold text-red-500">{t('삭제', 'Delete')}</button>
                      </div>
                      <input value={f.q} onChange={(e) => setFaqs((p) => p.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} placeholder={t('질문 (예: 주차 되나요?)', 'Question (e.g. Is parking available?)')} className="ss-input mt-1" />
                      <textarea value={f.a} onChange={(e) => setFaqs((p) => p.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} placeholder={t('답변', 'Answer')} className="ss-input mt-1.5 min-h-16" />
                    </div>
                  ))}
                </div>
                <button onClick={() => saveStore({ faqs: faqs.filter((f) => f.q.trim() && f.a.trim()).map((f) => ({ q: f.q.trim(), a: f.a.trim() })) })} className="ss-btn-primary mt-3 w-full max-w-xs">{t('FAQ 저장', 'Save FAQ')}</button>

                {faqs.some((f) => f.q.trim() && f.a.trim()) && (
                  <div className="mt-5 rounded-xl bg-zinc-50 p-4">
                    <h4 className="text-xs font-bold text-zinc-500">{t('미리보기 — 미니홈에 이렇게 보여요', 'Preview — how it shows on the mini-home')}</h4>
                    <div className="mt-2 divide-y divide-zinc-100">
                      {faqs.filter((f) => f.q.trim() && f.a.trim()).map((f, i) => (
                        <div key={i} className="py-2.5">
                          <div className="text-sm font-bold">{f.q}</div>
                          <p className="mt-0.5 text-sm text-zinc-600">{f.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 🤖 챗봇 */}
          {tab === 'chatbot' && (
            <div className="mt-5">
              <p className="text-sm text-zinc-500">{t('매장 페이지의 샤비(메뉴 추천·리뷰)를 매장 특성에 맞게 안내해요. 저장하면 손님 챗봇에 바로 반영돼요.', 'Guide Sharbee (menu & review) to fit your store. Saved guidance applies to the customer chatbot right away.')}</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2 md:items-start">
                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('🍽 메뉴 추천 챗봇', '🍽 Menu Chatbot')}</h3>
                  <p className="mt-1 text-[11px] text-zinc-400">{t('손님이 메뉴 고를 때 샤비가 우선 반영할 안내 — 추천 포인트·말투·특이사항.', 'What Sharbee prioritizes when helping pick — highlights, tone, notes.')}</p>
                  <textarea value={cbMenu} onChange={(e) => setCbMenu(e.target.value)} className="ss-input mt-2 min-h-32" placeholder={t('예: 매운맛 약한 분께는 순두부보다 갈비탕을 먼저 권해줘. 시그니처는 불고기야. 둘이 오면 2인 세트 추천.', 'e.g. For mild-spice guests recommend galbitang first. Signature is bulgogi. Suggest the combo for pairs.')} />
                </section>
                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('✍️ 리뷰 챗봇', '✍️ Review Chatbot')}</h3>
                  <p className="mt-1 text-[11px] text-zinc-400">{t('리뷰 쓸 때 샤비가 우선 물어볼 포인트·톤.', 'Points/tone Sharbee prioritizes when helping write reviews.')}</p>
                  <textarea value={cbReview} onChange={(e) => setCbReview(e.target.value)} className="ss-input mt-2 min-h-32" placeholder={t('예: 분위기와 직원 친절도를 꼭 물어봐줘. 가족 모임 후기면 더 좋아. 너무 과장하진 말고.', 'e.g. Always ask about ambiance and staff friendliness. Family-visit reviews are great. Keep it honest.')} />
                </section>
              </div>
              <button onClick={() => saveStore({ chatbotMenu: cbMenu.trim(), chatbotReview: cbReview.trim() })} className="ss-btn-primary mt-4 w-full max-w-xs">{t('챗봇 안내 저장', 'Save Chatbot Guidance')}</button>
              <p className="mt-2 text-[11px] text-zinc-400">{t('* 비워두면 샤비 기본 성격으로 동작해요. 메뉴/가격은 메뉴 관리에 등록된 것만 추천합니다.', '* Leave blank for default Sharbee. Only registered menu items/prices are recommended.')}</p>
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
