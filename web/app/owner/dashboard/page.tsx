'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb, getStorageBucket } from '@/lib/firebase';
import { collection, getDocs, getDoc, collectionGroup, doc, setDoc, deleteDoc, onSnapshot, runTransaction, query, where, limit, type Firestore, type QuerySnapshot, type DocumentData } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { buildSettlementReport, resolveExpiredNpo } from '@/lib/settlement';
import { NPOS } from '@/lib/npos';


// 옛 OwnerDashboard 4탭 구성 차용(기프트카드 제외) · 태블릿/PC 레이아웃: 📊오버뷰 · 🔍고객 · 📈정산 · 🏠미니홈피.

type Review = { author: string; rating: number; comment: string; createdAt: string };
type MenuItem = { id: string; name: string; price: number; signature?: boolean; description?: string; category?: string; variants?: { label: string; price: number }[]; soldOut?: boolean; hidden?: boolean; spicy?: boolean; order?: number; imageUrl?: string; imageSample?: boolean };
const MENU_CATS = ['STARTERS', 'SIDE MEAL', 'PIZZA', 'CHICKEN', 'PASTA', 'DRINKS'];
type Cardholder = { name: string; phone?: string; stamps: number };
type Member = { deviceId: string; name: string; phone?: string; password?: string; stamps: number; balance: number; donated: number; suspended?: boolean; memo?: string; allergy?: string };
type Donation = { npoName?: string; amount: number; settled?: boolean; source?: string; createdAt: string; refPath?: string };
type Charity = { id: string; name: string; desc?: string; linkUrl?: string; source: 'owner' | 'hq'; status: 'pending' | 'approved' | 'rejected'; docUrl?: string; docName?: string };
type StampLog = { deviceId: string; name: string; amount: number | null; count?: number; value?: number; source: 'receipt' | 'review' | string; createdAt: string; npoName?: string };
type CashReq = { id: string; deviceId: string; name?: string; phone?: string; amount: number; usedAmount?: number; status: string; createdAt: string; resolvedAt?: string };
type Loaded = {
  storeId: string; storeName: string; slug: string;
  reward: number; interval: number; banner: string; description: string; sns: string[];
  customers: number; activeStamps: number; issuedValue: number;
  expiredNpo: { id: string; name: string } | null;   // 매장 기본 만료 스탬프 기부처
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

// 1년 만료 스탬프 자동 기부 처리 — 점주가 대시보드를 열 때 실행 (안티 설계 §3.2 흐름).
// 기부처 우선순위: 손님 지정(defaultNpo) → 매장 지정(expiredStampsNpo) → 매장 승인 단체 1순위 → 기본 NPO.
// 만료 가치는 칸별 획득시점 잠금값(stampValues) 합 — 보상 인상돼도 과거 가치 그대로.
async function processExpiredStamps(
  db: Firestore, storeId: string, storeName: string, slug: string,
  storeNpo: { id: string; name: string } | null, charities: Charity[],
  cardsSnap: QuerySnapshot<DocumentData>,
): Promise<boolean> {
  const cutoff = Date.now() - 365 * 24 * 3600 * 1000;
  let changed = false;
  for (const m of cardsSnap.docs) {
    const cur = (m.data().currentStamps as number) || 0;
    if (cur < 1) continue;
    const deviceId = m.id;
    const cardRef = doc(db, 'customers', deviceId, 'cards', storeId);
    const cs = await getDoc(cardRef);
    if (!cs.exists()) continue;
    const cd = cs.data();
    const dates = (cd.stampDates as string[] | undefined) ?? [];
    const vals = (cd.stampValues as number[] | undefined) ?? [];
    if (!dates.length) continue; // 날짜 기록이 없는 옛 카드는 만료 판정하지 않음
    const keepIdx: number[] = []; const expIdx: number[] = [];
    for (let i = 0; i < cur; i++) {
      const ds = dates[i];
      if (ds && new Date(ds).getTime() < cutoff) expIdx.push(i); else keepIdx.push(i);
    }
    if (!expIdx.length) continue;
    const expCount = expIdx.length;
    const expValue = expIdx.reduce((s, i) => s + (vals[i] ?? 0), 0);
    const now = new Date().toISOString();
    // 기부처 결정
    let customerNpo: { id?: string; name?: string } | null = null;
    let donated = 0;
    try { const cu = await getDoc(doc(db, 'customers', deviceId)); if (cu.exists()) { customerNpo = { id: cu.data().defaultNpoId as string, name: cu.data().defaultNpoName as string }; donated = (cu.data().donated as number) || 0; } } catch {}
    const firstCharity = charities.find((c) => c.name && (c.source === 'hq' || c.status === 'approved'));
    const npo = resolveExpiredNpo({ customerNpo, storeNpo, fallback: firstCharity ? { id: firstCharity.id, name: firstCharity.name } : { id: NPOS[0].id, name: NPOS[0].name } });
    // 카드에서 만료 칸 제거
    await setDoc(cardRef, { currentStamps: keepIdx.length, stampValues: keepIdx.map((i) => vals[i] ?? 0), stampDates: keepIdx.map((i) => dates[i] ?? ''), updatedAt: now }, { merge: true });
    await setDoc(doc(db, 'stores', storeId, 'stampCards', deviceId), { currentStamps: keepIdx.length, updatedAt: now }, { merge: true });
    // 기부 기록 + 고객 누적 기부 갱신 + 정산 로그
    if (npo && expValue > 0) {
      await setDoc(doc(collection(db, 'customers', deviceId, 'donations')), { storeId, storeName, slug, npoId: npo.id, npoName: npo.name, amount: expValue, count: expCount, source: 'expired', settled: false, createdAt: now });
      await setDoc(doc(db, 'customers', deviceId), { donated: donated + expValue }, { merge: true });
    }
    await setDoc(doc(collection(db, 'stores', storeId, 'stampLog')), { deviceId, amount: null, source: 'expired', count: expCount, value: expValue, npoName: npo?.name || '', createdAt: now });
    changed = true;
  }
  return changed;
}

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
  const [newItem, setNewItem] = useState({ name: '', price: '', signature: false, category: '' });
  const [menuQ, setMenuQ] = useState('');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [uploadingMenuId, setUploadingMenuId] = useState<string | null>(null);
  const [cbMenu, setCbMenu] = useState(''); const [cbReview, setCbReview] = useState('');
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [custQ, setCustQ] = useState('');
  const [selMemberId, setSelMemberId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 스탬프 지급/차감 — 수량 입력 + 확인 다이얼로그(스탬프는 현금과 같으니 재확인)
  const [stampQty, setStampQty] = useState(1);
  const [stampConfirm, setStampConfirm] = useState<{ deviceId: string; name: string; delta: number } | null>(null);
  // 고객 화면 보기 — 새 탭 이동 대신 팝업(iframe)으로, 그대로 다 되는 화면 + X로 닫기
  const [customerPreview, setCustomerPreview] = useState<string | null>(null);
  // 정산 월 필터 (null = 전체 기간)
  const [setlYear, setSetlYear] = useState<number | null>(new Date().getFullYear());
  const [setlMonth, setSetlMonth] = useState<number | null>(new Date().getMonth() + 1);
  // 캐시 사용 요청 — 손님이 송금 요청하면 팝업으로 승인/거절, 홈에 오늘 사용 목록
  const [cashPending, setCashPending] = useState<CashReq[]>([]);
  const [cashToday, setCashToday] = useState<CashReq[]>([]);
  // 마케팅 푸시 — 제목·내용 작성해 이 매장 회원에게 발송 (남발 금지 안내 포함)
  const [pushTitle, setPushTitle] = useState(''); const [pushBody, setPushBody] = useState(''); const [pushSending, setPushSending] = useState(false);
  const sendMarketingPush = async () => {
    if (!data) return;
    if (!pushBody.trim()) { flash(t('보낼 내용을 입력해 주세요.', 'Enter a message.')); return; }
    const ids = data.members.map((m) => m.deviceId);
    if (!ids.length) { flash(t('발송할 회원이 없어요.', 'No members.')); return; }
    setPushSending(true);
    try {
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceIds: ids, title: pushTitle.trim() || `📣 ${data.storeName}`, body: pushBody.trim(), url: `/me?store=${data.slug}`, tag: `mkt_${data.storeId}` }) });
      const d = await res.json();
      if (d?.ok) { flash(t(`발송 완료 — 알림 켠 ${d.subscribed}명 중 ${d.sent}명에게 전송`, `Sent to ${d.sent} of ${d.subscribed} opted-in`)); setPushTitle(''); setPushBody(''); }
      else flash(t(d?.error === 'VAPID keys not set' ? '푸시 키 미설정 (배포 후 Vercel 환경변수 필요)' : '발송 실패', 'Send failed'));
    } catch { flash(t('발송 실패', 'Send failed')); }
    finally { setPushSending(false); }
  };
  const [memoDraft, setMemoDraft] = useState(''); const [allergyDraft, setAllergyDraft] = useState('');
  // 회원 정보 수정 드래프트 (닉네임·전화·비밀번호)
  const [editName, setEditName] = useState(''); const [editPhone, setEditPhone] = useState(''); const [editPassword, setEditPassword] = useState('');
  const [stampHistoryOpen, setStampHistoryOpen] = useState(false); // 스탬프 내역 더보기
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
  const [ownerCh, setOwnerCh] = useState<{ name: string; desc: string; linkUrl: string; docUrl: string; docName: string }[]>([{ name: '', desc: '', linkUrl: '', docUrl: '', docName: '' }, { name: '', desc: '', linkUrl: '', docUrl: '', docName: '' }]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
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

  // 캐시 사용 요청 실시간 구독 — 손님이 요청하면 pending 목록 갱신 → 팝업
  useEffect(() => {
    const sid = data?.storeId; if (!sid) return;
    const unsub = onSnapshot(query(collection(getDb(), 'stores', sid, 'cashRequests'), where('status', '==', 'pending')), (snap) => {
      setCashPending(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as CashReq)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    });
    return () => unsub();
  }, [data?.storeId]);

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
      const st = sd.data() as { name: string; slug: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number; bannerUrl?: string; description?: string; snsChannels?: string[]; chatbotMenu?: string; chatbotReview?: string; faqs?: { q: string; a: string }[]; expiredStampsNpoId?: string; expiredStampsNpoName?: string };
      // 카드·기부단체 먼저 로드 → 1년 만료 스탬프 자동 기부 처리 → 나머지 로드 (처리 결과가 정산에 바로 반영되게)
      let cardsSnap = await getDocs(collection(db, 'stores', sd.id, 'stampCards'));
      const chSnap = await getDocs(collection(db, 'stores', sd.id, 'charities')).catch(() => null);
      const charities: Charity[] = (chSnap?.docs ?? []).map((d) => ({ id: d.id, ...(d.data() as object) } as Charity));
      const storeNpo = st.expiredStampsNpoName ? { id: st.expiredStampsNpoId || '', name: st.expiredStampsNpoName } : null;
      try {
        const changed = await processExpiredStamps(db, sd.id, st.name, st.slug || target, storeNpo, charities, cardsSnap);
        if (changed) cardsSnap = await getDocs(collection(db, 'stores', sd.id, 'stampCards'));
      } catch { /* 만료 처리 실패해도 대시보드는 뜬다 */ }
      const [reviewsSnap, menuSnap, custSnap, donSnap, logSnap, cashSnap] = await Promise.all([
        getDocs(collection(db, 'stores', sd.id, 'reviews')),
        getDocs(collection(db, 'stores', sd.id, 'menuItems')),
        getDocs(collection(db, 'customers')).catch(() => null),
        getDocs(collectionGroup(db, 'donations')).catch(() => null),
        getDocs(collection(db, 'stores', sd.id, 'stampLog')).catch(() => null),
        getDocs(collection(db, 'stores', sd.id, 'cashRequests')).catch(() => null),
      ]);
      // 오늘 승인된 캐시 사용 목록
      const todayStr = new Date().toDateString();
      setCashToday((cashSnap?.docs ?? [])
        .map((d) => ({ id: d.id, ...(d.data() as object) } as CashReq))
        .filter((r) => r.status === 'approved' && r.resolvedAt && new Date(r.resolvedAt).toDateString() === todayStr)
        .sort((a, b) => (b.resolvedAt || '').localeCompare(a.resolvedAt || '')));
      const o1 = charities.find((c) => c.id === 'owner_1'); const o2 = charities.find((c) => c.id === 'owner_2');
      setOwnerCh([{ name: o1?.name || '', desc: o1?.desc || '', linkUrl: o1?.linkUrl || '', docUrl: o1?.docUrl || '', docName: o1?.docName || '' }, { name: o2?.name || '', desc: o2?.desc || '', linkUrl: o2?.linkUrl || '', docUrl: o2?.docUrl || '', docName: o2?.docName || '' }]);
      const rwd = st.pointRewardPer7Stamps ?? 5, itv = st.earningIntervalMinutes ?? 60;
      const activeStamps = cardsSnap.docs.reduce((s2, d) => s2 + ((d.data().currentStamps as number) || 0), 0);
      const reviews = reviewsSnap.docs.map((d) => d.data() as Review).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const menu = menuSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as MenuItem));
      const custMap = new Map<string, { name?: string; phone?: string; password?: string; balance?: number; donated?: number }>();
      (custSnap?.docs ?? []).forEach((d) => custMap.set(d.id, d.data() as { name?: string; phone?: string; password?: string; balance?: number; donated?: number }));
      const cardholders: Cardholder[] = cardsSnap.docs
        .map((d) => ({ name: custMap.get(d.id)?.name || '', phone: custMap.get(d.id)?.phone, stamps: (d.data().currentStamps as number) || 0 }))
        .filter((c) => c.stamps > 0).sort((a, b) => b.stamps - a.stamps);
      // 회원 명부: 이 매장에 카드가 있는 모든 회원(스탬프 0 포함)
      const members: Member[] = cardsSnap.docs
        .map((d) => { const c = custMap.get(d.id) || {}; return { deviceId: d.id, name: c.name || '', phone: c.phone, password: c.password || '', stamps: (d.data().currentStamps as number) || 0, balance: c.balance || 0, donated: c.donated || 0, suspended: !!d.data().suspended, memo: (d.data().memo as string) || '', allergy: (d.data().allergy as string) || '' }; })
        .sort((a, b) => b.stamps - a.stamps || (b.balance - a.balance));
      const donations: Donation[] = (donSnap?.docs ?? [])
        .filter((d) => (d.data() as { storeId?: string }).storeId === sd.id)
        .map((d) => ({ ...(d.data() as Donation), refPath: d.ref.path }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const stampLogs: StampLog[] = (logSnap?.docs ?? [])
        .map((d) => { const l = d.data() as { deviceId?: string; amount?: number | null; count?: number; value?: number; source?: string; createdAt: string; npoName?: string }; return { deviceId: l.deviceId || '', name: custMap.get(l.deviceId || '')?.name || t('손님', 'Guest'), amount: l.amount ?? null, count: l.count, value: l.value, source: l.source || 'receipt', createdAt: l.createdAt, npoName: l.npoName }; })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setData({
        storeId: sd.id, storeName: st.name, slug: st.slug, reward: rwd, interval: itv,
        banner: st.bannerUrl || '', description: st.description || '', sns: st.snsChannels || [],
        customers: cardsSnap.size, activeStamps, issuedValue: activeStamps * (rwd / 9),
        expiredNpo: storeNpo,
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
    await setDoc(doc(getDb(), 'stores', data.storeId, 'menuItems', `m_${Date.now()}`), { name: newItem.name.trim(), price: parseFloat(newItem.price) || 0, signature: newItem.signature, category: newItem.category.trim() || t('기타', 'Other') });
    setNewItem({ name: '', price: '', signature: false, category: newItem.category }); flash(t('메뉴 추가됨 ✓', 'Menu added ✓')); await load(data.slug);
  };
  const delMenu = async (id: string) => { if (!data) return; await deleteDoc(doc(getDb(), 'stores', data.storeId, 'menuItems', id)); setData((d) => (d ? { ...d, menu: d.menu.filter((m) => m.id !== id) } : d)); };
  // 항목 단위 즉시 저장 + 낙관적 반영 (48개 일괄저장 금지 — write-storm 방지, CLAUDE.md §1)
  const updateMenu = async (id: string, patch: Partial<MenuItem>) => {
    if (!data) return;
    setData((d) => (d ? { ...d, menu: d.menu.map((m) => (m.id === id ? { ...m, ...patch } : m)) } : d));
    try { await setDoc(doc(getDb(), 'stores', data.storeId, 'menuItems', id), patch, { merge: true }); flash(t('저장됐어요 ✓', 'Saved ✓')); }
    catch { flash(t('저장 실패', 'Save failed')); }
  };
  // 메뉴 사진 업로드 → Firebase Storage 공개 URL → imageUrl 저장 (CLAUDE.md §5: blob 금지, 공개 URL 필수)
  const uploadMenuPhoto = async (id: string, file: File) => {
    if (!data) return;
    setUploadingMenuId(id);
    try {
      const r = storageRef(getStorageBucket(), `menu-photos/${data.storeId}/${id}_${Date.now()}`);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      await updateMenu(id, { imageUrl: url, imageSample: false });
    } catch { flash(t('사진 업로드 실패', 'Photo upload failed')); }
    finally { setUploadingMenuId(null); }
  };

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
      const custCardRef = doc(db, 'customers', deviceId, 'cards', data.storeId);
      const snap = await getDoc(cardRef);
      const cur = snap.exists() ? ((snap.data().currentStamps as number) || 0) : 0;
      const next = Math.max(0, Math.min(9, cur + delta));
      const added = next - cur; // >0 지급, <0 차감 (상한 9 반영된 실제 변화량)
      const now = new Date().toISOString();
      // 칸별 가치·날짜: 지급은 "지금 보상÷9"·오늘 날짜를 added 개수만큼 추가, 차감은 뒤에서 제거
      const custSnap = await getDoc(custCardRef);
      const prevVals = (custSnap.exists() ? (custSnap.data().stampValues as number[] | undefined) : undefined) ?? Array.from({ length: cur }).map(() => data.reward / 9);
      const prevDates = (custSnap.exists() ? (custSnap.data().stampDates as string[] | undefined) : undefined) ?? Array.from({ length: cur }).map(() => now);
      const stampValues = added > 0 ? [...prevVals.slice(0, cur), ...Array.from({ length: added }).map(() => data.reward / 9)] : prevVals.slice(0, next);
      const stampDates = added > 0 ? [...prevDates.slice(0, cur), ...Array.from({ length: added }).map(() => now)] : prevDates.slice(0, next);
      await setDoc(cardRef, { deviceId, currentStamps: next, updatedAt: now }, { merge: true });
      await setDoc(custCardRef, { storeId: data.storeId, storeName: data.storeName, slug: data.slug, currentStamps: next, reward: data.reward, currency: 'USD', interval: data.interval, stampValues, stampDates, updatedAt: now }, { merge: true });
      if (added > 0) {
        await setDoc(doc(collection(db, 'stores', data.storeId, 'stampLog')), { deviceId, amount: null, source: 'owner', count: added, value: added * (data.reward / 9), createdAt: now });
        // 카톡처럼 — 점주 특별 지급을 회원에게 웹푸시로 알림
        fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceIds: [deviceId], title: `🎁 ${data.storeName}`, body: t(`스탬프 ${added}개를 특별 지급받았어요! 지금 확인해 보세요.`, `You received ${added} bonus stamp(s)!`), url: `/me?store=${data.slug}`, tag: `grant_${deviceId}` }) }).catch(() => {});
      }
      flash(`${name || t('회원', 'Member')}: ${added > 0 ? '+' : ''}${added} → ${next}/9`);
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

  // 회원 정보(닉네임·전화·비밀번호) 저장 — customers/{deviceId}. 전화 변경 시 phoneIndex 이전.
  const saveMemberInfo = async (deviceId: string, oldPhone?: string) => {
    if (!data) return;
    const name = editName.trim();
    const phone = editPhone.replace(/[^0-9]/g, '');
    if (!name) { flash(t('닉네임을 입력해 주세요.', 'Enter a nickname.')); return; }
    if (phone.length < 8) { flash(t('전화번호를 확인해 주세요.', 'Check the phone number.')); return; }
    setBusy(true);
    try {
      const db = getDb();
      // 다른 회원이 이미 쓰는 번호인지 확인
      const oldP = (oldPhone || '').replace(/[^0-9]/g, '');
      if (phone !== oldP) {
        const dup = await getDoc(doc(db, 'phoneIndex', phone));
        if (dup.exists() && dup.data().deviceId !== deviceId) { flash(t('이미 사용 중인 전화번호예요.', 'Phone already in use.')); setBusy(false); return; }
      }
      await setDoc(doc(db, 'customers', deviceId), { name, phone, password: editPassword.trim() }, { merge: true });
      if (oldP && oldP !== phone) await deleteDoc(doc(db, 'phoneIndex', oldP)).catch(() => {});
      await setDoc(doc(db, 'phoneIndex', phone), { deviceId, name }, { merge: true });
      flash(t('회원 정보 저장됨 ✓', 'Member info saved ✓'));
      await load(data.slug);
    } catch { flash(t('저장 실패', 'Save failed.')); } finally { setBusy(false); }
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

  // 501(c)(3) 등 증빙 서류 첨부 — Firebase Storage(charity-docs/)에 업로드하고 URL을 슬롯 상태에 보관
  const uploadCharityDoc = async (slot: number, file: File) => {
    if (!data) return;
    if (file.size > 15 * 1024 * 1024) { flash(t('파일은 15MB 미만이어야 해요.', 'File must be under 15MB.')); return; }
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) { flash(t('PDF 또는 이미지 파일만 첨부할 수 있어요.', 'Only PDF or image files are allowed.')); return; }
    setUploadingSlot(slot);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `charity-docs/${data.storeId}/owner_${slot + 1}_${Date.now()}_${safe}`;
      const r = storageRef(getStorageBucket(), path);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      setOwnerCh((p) => p.map((x, j) => j === slot ? { ...x, docUrl: url, docName: file.name } : x));
      flash(t('서류 첨부됨 — 등록 요청을 눌러 저장하세요.', 'Attached — click Request to save.'));
    } catch { flash(t('첨부 실패 — 다시 시도해 주세요.', 'Upload failed — try again.')); }
    finally { setUploadingSlot(null); }
  };

  // 사장 지정 기부단체 등록(본사 승인 대기)
  const saveOwnerCharity = async (slot: number) => {
    if (!data) return;
    const c = ownerCh[slot];
    if (!c.name.trim()) { flash(t('단체명을 입력해 주세요.', 'Enter the charity name.')); return; }
    await setDoc(doc(getDb(), 'stores', data.storeId, 'charities', `owner_${slot + 1}`), { name: c.name.trim(), desc: c.desc.trim(), linkUrl: c.linkUrl.trim(), docUrl: c.docUrl || '', docName: c.docName || '', source: 'owner', status: 'pending', updatedAt: new Date().toISOString() }, { merge: true });
    flash(t('등록 요청됨 — 본사 승인 대기 ✓', 'Requested — awaiting HQ approval ✓')); await load(data.slug);
  };

  // 월간 정산 보고서 — 연산은 lib/settlement.ts 에 격리 (UI는 결과만 렌더)
  const report = data ? buildSettlementReport({
    year: setlYear, month: setlMonth,
    logs: data.stampLogs, donations: data.donations,
    outstandingCount: data.activeStamps, stampValue: data.reward / 9,
  }) : null;
  // NPO 미정산 → 정산 완료 마킹 (해당 기간 대기 기부 문서들의 settled=true)
  const settleNpo = async (npoName: string, refPaths: string[]) => {
    if (!refPaths.length) return;
    setBusy(true);
    try {
      const db = getDb();
      await Promise.all(refPaths.map((p) => setDoc(doc(db, p), { settled: true, settledAt: new Date().toISOString() }, { merge: true })));
      flash(`${npoName} ${t('정산 완료 처리됨 ✓', 'marked settled ✓')}`);
      if (data) await load(data.slug);
    } catch { flash(t('처리 실패', 'Failed.')); } finally { setBusy(false); }
  };
  // 캐시 사용 승인 — 손님 잔액 차감(트랜잭션) + 요청 approved. 직원은 POS에서 그 금액만큼 DC.
  const approveCashUse = async (req: CashReq) => {
    if (!data) return;
    setBusy(true);
    try {
      const db = getDb();
      await runTransaction(db, async (tx) => {
        const cRef = doc(db, 'customers', req.deviceId);
        const cs = await tx.get(cRef);
        const bal = cs.exists() ? ((cs.data().balance as number) || 0) : 0;
        const used = Math.min(req.amount, bal); // 잔액 초과 방지
        tx.set(cRef, { balance: Math.max(0, bal - used) }, { merge: true });
        tx.set(doc(db, 'stores', data.storeId, 'cashRequests', req.id), { status: 'approved', usedAmount: used, resolvedAt: new Date().toISOString() }, { merge: true });
      });
      flash(`${req.name || t('손님', 'Guest')} $${req.amount.toFixed(2)} ${t('사용 승인됨 ✓', 'approved ✓')}`);
      await load(data.slug);
    } catch { flash(t('처리 실패', 'Failed.')); } finally { setBusy(false); }
  };
  const rejectCashUse = async (req: CashReq) => {
    if (!data) return;
    setBusy(true);
    try { await setDoc(doc(getDb(), 'stores', data.storeId, 'cashRequests', req.id), { status: 'rejected', resolvedAt: new Date().toISOString() }, { merge: true }); }
    finally { setBusy(false); }
  };

  // 매장 기본 만료 기부처 저장 — 선택지: 이 매장 활성 단체(사장 승인+본사) 우선, 없으면 기본 NPO
  const expiredNpoOptions = data
    ? [...data.charities.filter((c) => c.name && (c.source === 'hq' || c.status === 'approved')).map((c) => ({ id: c.id, name: c.name })),
       ...NPOS.filter((n) => !data.charities.some((c) => c.name === n.name)).map((n) => ({ id: n.id, name: n.name }))]
    : [];
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

              <div className="mt-4">
                <section className="ss-card p-5">
                  <h3 className="text-base font-extrabold">{t('적립 설정', 'Earning Settings')}</h3>
                  <label className="ss-label">{t('9개당 보상', 'Reward per 9')}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-zinc-500">$</span>
                    <input value={reward} onChange={(e) => setReward(e.target.value)} className="ss-input pl-7" inputMode="decimal" placeholder="5.00" />
                  </div>
                  <label className="ss-label">{t('재적립 인터벌', 'Re-earn interval')}</label>
                  <select value={interval} onChange={(e) => setIntervalV(e.target.value)} className="ss-input">
                    {[
                      { v: '0', ko: '제한 없음', en: 'No limit' },
                      { v: '1', ko: '1분 (테스트)', en: '1 min (test)' },
                      { v: '30', ko: '30분', en: '30 min' },
                      { v: '60', ko: '1시간', en: '1 hour' },
                      { v: '120', ko: '2시간', en: '2 hours' },
                      { v: '180', ko: '3시간', en: '3 hours' },
                      { v: '240', ko: '4시간 (점심·저녁)', en: '4 hours (lunch·dinner)' },
                      { v: '360', ko: '6시간', en: '6 hours' },
                      { v: '720', ko: '12시간', en: '12 hours' },
                      { v: '1440', ko: '24시간 (하루 1회)', en: '24 hours (once a day)' },
                    ].map((o) => <option key={o.v} value={o.v}>{t(o.ko, o.en)}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-400">{t('같은 손님이 다시 적립하려면 이 시간이 지나야 해요. "제한 없음"이면 매번 적립돼요.', 'A customer must wait this long to earn again. "No limit" earns every time.')}</p>
                  <button onClick={() => saveStore({ pointRewardPer7Stamps: parseFloat(reward) || 0, earningIntervalMinutes: parseInt(interval, 10) || 0 })} className="ss-btn-primary mt-3 w-full">{t('설정 저장', 'Save Settings')}</button>
                </section>
              </div>

              {/* 📣 마케팅 푸시 알림 — 앱 알림 켠 회원에게 발송 (재사용 가능한 마케팅 도구) */}
              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">📣 {t('푸시 알림 보내기', 'Push Notification')} <span className="text-xs font-medium text-zinc-400">· {t('회원', 'members')} {data.members.length}</span></h3>
                <p className="mt-0.5 text-[11px] text-zinc-400">{t('앱 알림을 켠 회원의 휴대폰으로 알림이 가요. 이벤트·신메뉴·재방문 유도에 쓰되, 너무 자주 보내면 회원이 알림을 꺼요.', 'Sent to members who opted in. Great for events & re-engagement — but too many pushes and they opt out.')}</p>
                <input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} maxLength={40} className="ss-input mt-2" placeholder={t(`제목 (비우면 "📣 ${data.storeName}")`, 'Title (optional)')} />
                <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} maxLength={120} className="ss-input mt-2 min-h-16" placeholder={t('예: 오늘 방문하면 스탬프 2배! 저녁 8시까지 🐝', 'e.g. Double stamps today until 8pm 🐝')} />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">{pushBody.length}/120</span>
                  <button onClick={sendMarketingPush} disabled={pushSending || !pushBody.trim()} className="ss-btn-primary px-5 py-2 text-sm disabled:opacity-50">{pushSending ? '…' : t('전체 회원에게 발송', 'Send to all members')}</button>
                </div>
              </section>

              <section className="ss-card mt-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-extrabold">{t('💳 오늘의 스탬프 캐시 사용', "💳 Today's Cash Use")}</h3>
                  <span className="text-sm font-bold text-zinc-500">{t('합계', 'Total')} <b className="text-rose-600">${cashToday.reduce((s, r) => s + (r.usedAmount ?? r.amount), 0).toFixed(2)}</b> · {cashToday.length}{t('건', '')}</span>
                </div>
                {cashToday.length === 0 ? (
                  <p className="mt-2 text-center text-sm text-zinc-400">{t('오늘 사용 내역이 없어요.', 'No cash used today.')}</p>
                ) : (
                  <div className="mt-2 divide-y divide-zinc-100">
                    {cashToday.map((r) => (
                      <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div><span className="font-semibold">{r.name || t('손님', 'Guest')}</span> <span className="text-[11px] text-zinc-400">{r.phone ? fmtPhone(r.phone) : ''} · {r.resolvedAt ? new Date(r.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
                        <span className="font-bold text-rose-600">−${(r.usedAmount ?? r.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-zinc-400">{t('* 손님이 캐시 사용을 요청하면 이 화면에 팝업이 떠요. POS에서 그 금액만큼 할인 후 승인하면 잔액이 차감됩니다.', '* When a customer requests cash use, a popup appears here. Apply the discount on your POS, then approve to deduct their balance.')}</p>
              </section>

              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">{t('기부 단체', 'Charities')} <span className="text-xs font-medium text-zinc-400">{t('(사장 2 · 본사 3 · 모두 본사 관리)', '(Owner 2 · HQ 3 · all HQ-managed)')}</span></h3>
                {/* 사장 지정 2개 — 위 (점주가 신청) */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                        <input value={ownerCh[i].desc} onChange={(e) => setOwnerCh((p) => p.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} maxLength={40} placeholder={t('한줄 설명 (예: 어린이 급식 지원)', 'One-line description')} className="ss-input mt-2" />
                        <input value={ownerCh[i].linkUrl} onChange={(e) => setOwnerCh((p) => p.map((x, j) => j === i ? { ...x, linkUrl: e.target.value } : x))} placeholder={t('단체 링크 https://...', 'Charity link https://...')} className="ss-input mt-2" />
                        {/* 501(c)(3) 등 비영리 증빙 서류 첨부 (PDF/이미지) */}
                        <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-3 py-2.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50">
                          <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploadingSlot === i} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCharityDoc(i, f); e.target.value = ''; }} />
                          {uploadingSlot === i ? t('업로드 중…', 'Uploading…') : ownerCh[i].docUrl ? t('📎 501(c)(3) 재첨부', '📎 Replace 501(c)(3)') : t('📎 501(c)(3) 서류 첨부', '📎 Attach 501(c)(3)')}
                        </label>
                        {ownerCh[i].docUrl && (
                          <a href={ownerCh[i].docUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[11px] font-medium text-emerald-600" title={ownerCh[i].docName}>✓ {ownerCh[i].docName || t('첨부된 서류 보기', 'View attached doc')}</a>
                        )}
                        <button onClick={() => saveOwnerCharity(i)} className="ss-btn-soft mt-2 w-full">{t('등록 요청 (본사 승인)', 'Request (HQ approval)')}</button>
                      </div>
                    );
                  })}
                </div>
                {/* 본사 지정 3개 — 아래 (본사 관리, 보기 전용) */}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((i) => {
                    const hq = data.charities.filter((c) => c.source === 'hq')[i];
                    return (
                      <div key={`h${i}`} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                        <span className="text-xs font-bold text-zinc-500">{t('본사 지정', 'HQ pick')} #{i + 1}</span>
                        <div className="mt-2 text-sm font-semibold">{hq ? hq.name : <span className="text-zinc-400">{t('본사 지정 대기', 'Awaiting HQ pick')}</span>}</div>
                        {hq?.desc && <div className="text-[11px] text-zinc-500">{hq.desc}</div>}
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
                  <span className="text-zinc-500">9/9 {data.members.filter((m) => m.stamps >= 9).length}</span>
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
                      <tr key={m.deviceId} onClick={() => { setSelMemberId(m.deviceId); setConfirmDelete(false); setStampHistoryOpen(false); setMemoDraft(m.memo || ''); setAllergyDraft(m.allergy || ''); setEditName(m.name || ''); setEditPhone(m.phone || ''); setEditPassword(m.password || ''); }} className={`cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 ${m.suspended ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2.5 font-bold text-brand-700 hover:underline">
                          {m.name || t('손님', 'Guest')}
                          {m.suspended && <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 align-middle text-[10px] font-bold text-zinc-500">{t('정지', 'Suspended')}</span>}
                          {m.allergy && <span className="ml-1.5 align-middle" title={m.allergy}>⚠️</span>}
                          {m.memo && <span className="ml-1 align-middle" title={m.memo}>📝</span>}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-500">{fmtPhone(m.phone)}</td>
                        <td className="px-3 py-2.5"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">⭐ {Math.min(m.stamps, 9)}/9</span></td>
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

              {/* 카드 1 · 회원 정보 (이름=최상위 20px, 전화=보조 캡션) */}
              <div className="ss-card mt-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl font-black leading-tight">{selMember.name || t('손님', 'Guest')}</span>
                  {selMember.suspended && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-bold text-zinc-500">{t('활동정지됨', 'Suspended')}</span>}
                  <button onClick={() => setCustomerPreview(selMember.deviceId)} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 transition hover:bg-brand-100">👀 {t('고객 화면 보기', 'View customer screen')}</button>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{fmtPhone(selMember.phone)}</div>
              </div>

              {/* 카드 2 · 스탬프 (허니컴 + 지급/수량/차감 + 값 요약) — 단일 박스 */}
              <section className="ss-card mt-3 p-5">
                <h3 className="text-base font-extrabold">🎯 {t('스탬프', 'Stamps')}</h3>
                {/* 허니컴(왼쪽) + 지급/수량/차감(오른쪽) — 같은 줄에 정렬 */}
                {(() => {
                  const clip = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
                  const filled = Math.min(selMember.stamps, 9);
                  return (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex" style={{ gap: 4 }}>
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} style={{ width: 22, aspectRatio: '0.866', clipPath: clip, background: i < filled ? 'linear-gradient(160deg,#8b5cf6,#5b21b6)' : '#eee9fb' }} />
                          ))}
                        </div>
                        <span className="text-base font-black text-brand-700">{filled}<span className="font-bold text-zinc-400">/9</span></span>
                      </div>
                      {/* 지급 상한 = 9 − 현재 보유(빈 칸 수) · 차감 상한 = 보유 수 */}
                      {(() => {
                        const giveMax = Math.max(0, 9 - filled);
                        const qtyMax = Math.max(giveMax, filled, 1);
                        return (
                          <div className="flex items-center gap-2">
                            <button onClick={() => setStampConfirm({ deviceId: selMember.deviceId, name: selMember.name, delta: Math.min(stampQty, giveMax) })} disabled={busy || selMember.suspended || giveMax === 0} title={giveMax === 0 ? t('카드가 가득 찼어요 (9/9)', 'Card is full (9/9)') : t(`최대 ${giveMax}개 지급 가능`, `Up to ${giveMax}`)} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">{t('지급', 'Give')}</button>
                            <input type="number" min={1} max={qtyMax} value={stampQty} onChange={(e) => setStampQty(Math.max(1, Math.min(qtyMax, parseInt(e.target.value, 10) || 1)))} disabled={selMember.suspended} className="h-11 w-16 rounded-xl border border-zinc-200 px-2 text-center text-lg font-black text-zinc-800 outline-none focus:border-brand-500 disabled:opacity-40" />
                            <button onClick={() => setStampConfirm({ deviceId: selMember.deviceId, name: selMember.name, delta: -Math.min(stampQty, filled) })} disabled={busy || selMember.suspended || filled < 1} className="h-11 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40">{t('차감', 'Deduct')}</button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
                {/* 값 요약 — 라벨/값 리스트 (14px 통일) */}
                <div className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100">
                  <div className="flex items-center justify-between py-2.5 text-sm"><span className="text-zinc-500">{t('스탬프 가치', 'Stamp value')}</span><span className="font-bold text-zinc-800">${(Math.min(selMember.stamps, 9) * (data.reward / 9)).toFixed(2)}</span></div>
                  <div className="flex items-center justify-between py-2.5 text-sm"><span className="text-zinc-500">{t('캐시 잔액', 'Cash balance')}</span><span className="font-bold text-zinc-800">${selMember.balance.toFixed(2)}</span></div>
                  <div className="flex items-center justify-between py-2.5 text-sm"><span className="text-zinc-500">{t('누적 기부', 'Total donated')}</span><span className="font-bold text-amber-600">${selMember.donated.toFixed(2)}</span></div>
                </div>
              </section>

              {/* 카드 3 · 알러지 · 메모 */}
              <section className="ss-card mt-3 p-5">
                <h3 className="text-base font-extrabold">📝 {t('알러지 · 메모', 'Allergy · Notes')}</h3>
                <label className="ss-label">⚠️ {t('알러지', 'Allergy')}</label>
                <input value={allergyDraft} onChange={(e) => setAllergyDraft(e.target.value)} className="ss-input" placeholder={t('예: 땅콩, 갑각류', 'e.g. Peanuts, Shellfish')} />
                <label className="ss-label">🗒 {t('메모 (특이사항)', 'Notes')}</label>
                <textarea value={memoDraft} onChange={(e) => setMemoDraft(e.target.value)} className="ss-input min-h-20" placeholder={t('예: 진상 고객, 항상 늦게 취소함 / VIP, 매주 방문', 'e.g. difficult customer, cancels late / VIP, weekly regular')} />
                <button onClick={() => saveMemberNotes(selMember.deviceId)} disabled={busy} className="ss-btn-primary mt-3 px-5 py-2 text-sm disabled:opacity-50">{t('메모 저장', 'Save Notes')}</button>
              </section>

              {/* 카드 4 · 기부 내역 */}
              {memberDonations.length > 0 && (
                <section className="ss-card mt-3 p-5">
                  <h3 className="text-base font-extrabold">💛 {t('기부 내역', 'Donation history')} <span className="text-xs font-medium text-zinc-400">· {memberDonations.length}{t('건', '')}</span></h3>
                  <div className="mt-2 divide-y divide-zinc-100">
                    {memberDonations.map((d, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0 truncate"><span className="font-semibold">{d.npoName || t('기부', 'Donation')}</span><span className="ml-1.5 text-[11px] text-zinc-400">{d.storeName ? `${d.storeName} · ` : ''}{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}</span></div>
                        <span className="shrink-0 font-bold text-amber-600">${(d.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 카드 · 스탬프 획득/이동 내역 (이 회원) — 최근 1건만, 나머지는 더보기 */}
              {(() => {
                const rows = data.stampLogs.filter((l) => l.deviceId === selMember.deviceId);
                const tagOf = (src: string) => src === 'review' ? { ko: '리뷰', en: 'Review', cls: 'bg-honey/40 text-honey-ink' }
                  : src === 'owner' ? { ko: '점주 지급', en: 'Owner', cls: 'bg-blue-100 text-blue-700' }
                  : src === 'gift' ? { ko: '선물', en: 'Gift', cls: 'bg-purple-100 text-purple-700' }
                  : src === 'redeem' ? { ko: '캐시 전환', en: 'Redeem', cls: 'bg-rose-100 text-rose-600' }
                  : src === 'expired' ? { ko: '만료 기부', en: 'Expired', cls: 'bg-amber-100 text-amber-700' }
                  : { ko: '영수증', en: 'Receipt', cls: 'bg-zinc-100 text-zinc-500' };
                const Row = ({ l }: { l: StampLog }) => { const tag = tagOf(l.source); return (
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tag.cls}`}>{t(tag.ko, tag.en)}</span>
                      {l.count != null && <span className="ml-1.5 font-bold text-zinc-700">{l.count}{t('개', '')}</span>}
                      {l.npoName && <span className="ml-1 text-[11px] text-zinc-400">→ {l.npoName}</span>}
                      <span className="ml-1.5 text-[11px] text-zinc-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                    </div>
                    <span className="font-bold text-brand-700">{l.amount != null ? `$${l.amount.toFixed(2)}` : l.value != null ? `$${l.value.toFixed(2)}` : '—'}</span>
                  </div>
                ); };
                return (
                  <section className="ss-card mt-3 p-5">
                    <h3 className="text-base font-extrabold">🐝 {t('스탬프 내역', 'Stamp history')} <span className="text-xs font-medium text-zinc-400">· {rows.length}{t('건', '')}</span></h3>
                    {rows.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{t('아직 스탬프 내역이 없어요.', 'No stamp activity yet.')}</p> : (
                      <div className="mt-2">
                        <div className="divide-y divide-zinc-100"><Row l={rows[0]} /></div>
                        {rows.length > 1 && (
                          <>
                            {stampHistoryOpen && <div className="divide-y divide-zinc-100 border-t border-zinc-100">{rows.slice(1).map((l, i) => <Row key={i} l={l} />)}</div>}
                            <button onClick={() => setStampHistoryOpen((v) => !v)} className="mt-2 w-full rounded-lg border border-zinc-200 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-50">
                              {stampHistoryOpen ? `▲ ${t('접기', 'Collapse')}` : `▼ ${t(`나머지 ${rows.length - 1}건 더보기`, `Show ${rows.length - 1} more`)}`}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* 카드 5 · 회원 정보 수정 (닉네임·전화·비밀번호) */}
              <section className="ss-card mt-3 p-5">
                <h3 className="text-base font-extrabold">✏️ {t('회원 정보 수정', 'Edit Member Info')}</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="ss-label">{t('닉네임', 'Nickname')}</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="ss-input" placeholder={t('홍길동', 'Name')} />
                  </div>
                  <div>
                    <label className="ss-label">{t('전화번호', 'Phone')}</label>
                    <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="ss-input" placeholder="000-000-0000" inputMode="tel" />
                  </div>
                  <div>
                    <label className="ss-label">{t('비밀번호', 'Password')}</label>
                    <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="ss-input" placeholder={t('없으면 비움', 'Blank = none')} />
                  </div>
                </div>
                <button onClick={() => saveMemberInfo(selMember.deviceId, selMember.phone)} disabled={busy} className="ss-btn-primary mt-3 px-5 py-2 text-sm disabled:opacity-50">{t('정보 저장', 'Save Info')}</button>
                <p className="mt-2 text-[11px] text-zinc-400">{t('* 비밀번호를 설정하면 그 회원은 로그인 시 전화번호와 함께 비밀번호를 입력해야 해요. 비우면 전화번호만으로 로그인.', '* If a password is set, the member must enter it with their phone to log in. Blank = phone-only login.')}</p>
              </section>

              {/* 카드 6 · 회원 관리 */}
              <section className="ss-card mt-3 p-5">
                <h3 className="text-base font-extrabold">⚙️ {t('회원 관리', 'Member Management')}</h3>
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
              </section>
            </div>
          )}

          {/* 📈 정산 — 월별 결산 보고서 (연산: lib/settlement.ts) */}
          {tab === 'settlement' && report && (
            <div className="mt-5">
              {/* 기간 필터 — 연/월 셀렉터 + 퀵 버튼 */}
              <div className="flex flex-wrap items-center gap-2">
                <select value={setlYear ?? ''} onChange={(e) => { const v = e.target.value; setSetlYear(v ? parseInt(v, 10) : null); if (!v) setSetlMonth(null); }} className="ss-input w-28">
                  <option value="">{t('전체', 'All')}</option>
                  {[0, 1, 2].map((d) => { const y = new Date().getFullYear() - d; return <option key={y} value={y}>{y}{t('년', '')}</option>; })}
                </select>
                <select value={setlMonth ?? ''} onChange={(e) => { const v = e.target.value; setSetlMonth(v ? parseInt(v, 10) : null); if (!v) setSetlYear(null); }} className="ss-input w-24" disabled={setlYear == null}>
                  <option value="">{t('전체', 'All')}</option>
                  {Array.from({ length: 12 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}{t('월', '')}</option>)}
                </select>
                {([
                  { k: 'this', ko: '이번 달', en: 'This month' },
                  { k: 'last', ko: '지난달', en: 'Last month' },
                  { k: 'all', ko: '전체 기간', en: 'All time' },
                ] as const).map((b) => (
                  <button key={b.k} onClick={() => {
                    if (b.k === 'all') { setSetlYear(null); setSetlMonth(null); return; }
                    const d = new Date(); if (b.k === 'last') d.setMonth(d.getMonth() - 1);
                    setSetlYear(d.getFullYear()); setSetlMonth(d.getMonth() + 1);
                  }} className="ss-chip">{t(b.ko, b.en)}</button>
                ))}
                <span className="ml-auto text-xs font-bold text-zinc-400">{report.periodLabel}</span>
              </div>

              {/* 핵심 지표 6종 — 개수·금액 함께 */}
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                {([
                  { icon: '🐝', ko: '발행 스탬프', en: 'Stamps issued', count: report.issued.count, value: report.issued.value, cls: 'text-brand-700' },
                  { icon: '🧾', ko: '영수증 결제 총액', en: 'Receipt total', count: null, value: report.receiptTotal, cls: 'text-zinc-800' },
                  { icon: '🎁', ko: '친구 선물 이동', en: 'Gifted', count: report.gifted.count, value: report.gifted.value, cls: 'text-purple-600' },
                  { icon: '💳', ko: '캐시 전환', en: 'Cash converted', count: report.redeemed.count, value: report.redeemed.value, cls: 'text-rose-600' },
                  { icon: '⏳', ko: '만료 자동기부', en: 'Expired → donated', count: report.expired.count, value: report.expired.value, cls: 'text-amber-600' },
                  { icon: '📦', ko: '미사용 잔액 (부채)', en: 'Outstanding (liability)', count: report.outstanding.count, value: report.outstanding.value, cls: 'text-sky-600' },
                ]).map((c, i) => (
                  <div key={i} className="ss-card p-4">
                    <div className="text-[11px] font-bold text-zinc-500">{c.icon} {t(c.ko, c.en)}</div>
                    <div className={`mt-1 text-xl font-black ${c.cls}`}>${c.value.toFixed(2)}</div>
                    {c.count != null && <div className="text-[11px] font-semibold text-zinc-400">{c.count}{t('개', ' stamps')}</div>}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">{t('* 미사용 잔액은 기간과 무관한 현재 시점 부채예요. 캐시 할인 사용액은 결제 승인 연동 후 제공돼요.', '* Outstanding is a point-in-time liability. Cash-discount usage arrives with payment approval.')}</p>

              {/* 🤝 NPO 단체별 기부금 결산 — 대기/완료 + 송금 후 정산완료 처리 */}
              <section className="ss-card mt-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-extrabold">🤝 {t('NPO 단체별 기부금 결산', 'Donations by NPO')}</h3>
                  <span className="text-xs font-bold text-zinc-500">{t('송금 대기', 'Pending')} <b className="text-rose-600">${report.donations.pending.toFixed(2)}</b> · {t('정산 완료', 'Settled')} <b className="text-emerald-600">${report.donations.settled.toFixed(2)}</b></span>
                </div>
                {report.donations.byNpo.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{t('이 기간 기부 내역이 없어요.', 'No donations in this period.')}</p> : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                          <th className="px-3 py-2.5">{t('단체', 'NPO')}</th>
                          <th className="px-3 py-2.5">{t('건수', 'Count')}</th>
                          <th className="px-3 py-2.5">{t('총액', 'Total')}</th>
                          <th className="px-3 py-2.5">{t('송금 대기', 'Pending')}</th>
                          <th className="px-3 py-2.5">{t('정산 완료', 'Settled')}</th>
                          <th className="px-3 py-2.5 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.donations.byNpo.map((r) => (
                          <tr key={r.npoName} className="border-b border-zinc-100">
                            <td className="px-3 py-2.5 font-bold">{r.npoName}</td>
                            <td className="px-3 py-2.5 text-zinc-600">{r.count}</td>
                            <td className="px-3 py-2.5 font-bold text-amber-600">${r.total.toFixed(2)}</td>
                            <td className="px-3 py-2.5 font-bold text-rose-600">${r.pending.toFixed(2)}</td>
                            <td className="px-3 py-2.5 font-bold text-emerald-600">${r.settled.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right">
                              {r.pending > 0
                                ? <button onClick={() => settleNpo(r.npoName, r.refPaths)} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{t('송금함 → 정산 완료', 'Sent → settle')}</button>
                                : <span className="text-xs font-bold text-emerald-600">✓ {t('완료', 'Done')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-zinc-400">{t('* 단체에 실제 송금한 뒤 "정산 완료"를 눌러 대기 금액을 지워 주세요.', '* After wiring the money, click “settle” to clear the pending amount.')}</p>
              </section>

              {/* ⏳ 매장 기본 만료 스탬프 기부처 — 손님 미지정 시 이 단체로 자동 기부 */}
              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">⏳ {t('만료 스탬프 기본 기부처', 'Default NPO for expired stamps')}</h3>
                <p className="mt-0.5 text-[11px] text-zinc-400">{t('스탬프는 적립 1년 후 만료되며 자동 기부돼요. 손님이 기부처를 지정하지 않았으면 여기 지정한 단체로 갑니다.', 'Stamps expire 1 year after earning and are auto-donated. Used when the customer has no preference.')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={data.expiredNpo?.name || ''} onChange={(e) => {
                    const opt = expiredNpoOptions.find((o) => o.name === e.target.value);
                    saveStore(opt ? { expiredStampsNpoId: opt.id, expiredStampsNpoName: opt.name } : { expiredStampsNpoId: '', expiredStampsNpoName: '' });
                  }} className="ss-input max-w-xs">
                    <option value="">{t('지정 안 함 (매장 승인 단체 1순위로)', 'None (falls back to first charity)')}</option>
                    {expiredNpoOptions.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  {data.expiredNpo?.name && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">💛 {data.expiredNpo.name}</span>}
                </div>
              </section>

              {/* 🧾 스탬프 이동 내역 — 적립·선물·전환·만료 전체 */}
              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">{t('🧾 스탬프 이동 내역', 'Stamp Activity Log')}</h3>
                <p className="mt-0.5 text-[11px] text-zinc-400">{t('영수증 스캔은 결제액이 함께 기록되고, 리뷰 적립은 금액 없이 기록돼요.', 'Receipt scans record the bill; review stamps have no amount.')}</p>
                {data.stampLogs.length === 0 ? <p className="mt-2 text-sm text-zinc-400">{t('내역이 없어요.', 'No activity yet.')}</p> : (
                  <div className="mt-2 max-h-80 divide-y divide-zinc-100 overflow-y-auto">
                    {data.stampLogs.map((l, i) => {
                      const tag = l.source === 'review' ? { ko: '리뷰', en: 'Review', cls: 'bg-honey/40 text-honey-ink' }
                        : l.source === 'owner' ? { ko: '점주 지급', en: 'Owner', cls: 'bg-blue-100 text-blue-700' }
                        : l.source === 'gift' ? { ko: '선물', en: 'Gift', cls: 'bg-purple-100 text-purple-700' }
                        : l.source === 'redeem' ? { ko: '캐시 전환', en: 'Redeem', cls: 'bg-rose-100 text-rose-600' }
                        : l.source === 'expired' ? { ko: '만료 기부', en: 'Expired', cls: 'bg-amber-100 text-amber-700' }
                        : { ko: '영수증', en: 'Receipt', cls: 'bg-zinc-100 text-zinc-500' };
                      return (
                        <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                          <div>
                            <span className="font-semibold">{l.name}</span>
                            <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${tag.cls}`}>{t(tag.ko, tag.en)}</span>
                            {l.count != null && <span className="ml-1.5 text-[11px] font-bold text-zinc-500">{l.count}{t('개', '')}</span>}
                            <span className="ml-1.5 text-[11px] text-zinc-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                          </div>
                          <span className="font-bold text-brand-700">{l.amount != null ? `$${l.amount.toFixed(2)}` : l.value != null ? `$${l.value.toFixed(2)}` : t('금액 없음', 'No amount')}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  <span className="text-xs font-bold text-zinc-400">{data.menu.length}{t('개', '')}</span>
                </div>
                <input value={menuQ} onChange={(e) => setMenuQ(e.target.value)} className="ss-input mt-2" placeholder={t('메뉴 검색…', 'Search menu…')} />

                <div className="mt-3 space-y-2">
                  {(() => {
                    const q = menuQ.trim().toLowerCase();
                    const filtered = data.menu.filter((m) => !q || m.name.toLowerCase().includes(q));
                    if (filtered.length === 0) return <p className="py-2 text-sm text-zinc-400">{data.menu.length === 0 ? t('메뉴가 없어요. 아래에서 추가하세요.', 'No menu yet. Add below.') : t('검색 결과가 없어요.', 'No results.')}</p>;
                    const groups: Record<string, MenuItem[]> = {};
                    filtered.forEach((m) => { const c = m.category || t('기타', 'Other'); (groups[c] = groups[c] || []).push(m); });
                    const cats = Object.keys(groups).sort((a, b) => { const ia = MENU_CATS.indexOf(a), ib = MENU_CATS.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
                    return cats.map((cat) => {
                      const items = groups[cat];
                      const open = q ? true : (openCats[cat] ?? false);
                      const soldCnt = items.filter((m) => m.soldOut).length;
                      return (
                        <div key={cat} className="overflow-hidden rounded-xl border border-zinc-100">
                          <button type="button" onClick={() => setOpenCats((p) => ({ ...p, [cat]: !open }))} className="flex w-full items-center justify-between bg-zinc-50 px-3.5 py-2.5 text-left">
                            <span className="text-sm font-extrabold text-zinc-800">{cat}</span>
                            <span className="flex items-center gap-2 text-[11px] text-zinc-400"><span>{items.length}{t('개', '')}{soldCnt > 0 && <span className="ml-1 text-red-500">· {t('품절', 'sold')} {soldCnt}</span>}</span><span className="text-zinc-300">{open ? '▲' : '▼'}</span></span>
                          </button>
                          {open && (
                            <div className="divide-y divide-zinc-100">
                              {items.map((m) => (
                                <div key={m.id} className="flex gap-2.5 px-3.5 py-2.5">
                                  <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-zinc-100 ring-1 ring-zinc-100">
                                    {m.imageUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={m.imageUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="flex h-full w-full items-center justify-center text-lg text-zinc-300">＋</span>
                                    )}
                                    {m.imageSample && m.imageUrl && <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 text-center text-[8px] font-bold text-white">샘플</span>}
                                    {uploadingMenuId === m.id && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[9px] font-bold text-brand-700">…</span>}
                                    <input type="file" accept="image/*" className="hidden" disabled={uploadingMenuId === m.id} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMenuPhoto(m.id, f); e.target.value = ''; }} />
                                  </label>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className={`text-sm ${m.soldOut ? 'text-zinc-400 line-through' : 'font-semibold text-zinc-800'}`}>
                                        {m.name}
                                        {m.signature && <span className="ml-1.5 rounded bg-honey px-1.5 py-0.5 text-[10px] font-bold text-honey-ink">SIG</span>}
                                        {m.spicy && <span className="ml-1">🌶️</span>}
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <button type="button" onClick={() => updateMenu(m.id, { soldOut: !m.soldOut })} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.soldOut ? 'bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-500'}`}>{m.soldOut ? t('품절', 'Sold out') : t('판매중', 'On')}</button>
                                        <button type="button" onClick={() => updateMenu(m.id, { hidden: !m.hidden })} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.hidden ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-100 text-zinc-400'}`}>{m.hidden ? t('숨김', 'Hidden') : t('노출', 'Shown')}</button>
                                        <button type="button" onClick={() => { if (window.confirm(t('삭제할까요?', 'Delete?'))) delMenu(m.id); }} className="text-[11px] text-red-500">{t('삭제', 'Del')}</button>
                                      </div>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                      {m.variants && m.variants.length > 0 ? (
                                        m.variants.map((v, i) => (
                                          <span key={i} className="flex items-center gap-1">
                                            <span className="text-[11px] font-bold text-zinc-400">{v.label}</span>
                                            <span className="relative"><span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                                              <input type="text" inputMode="decimal" defaultValue={v.price.toFixed(2)} onBlur={(e) => updateMenu(m.id, { variants: (m.variants || []).map((x, j) => (j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x)) })} className="ss-input w-20 py-1.5 pl-5 text-sm" /></span>
                                          </span>
                                        ))
                                      ) : (
                                        <span className="relative"><span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                                          <input type="text" inputMode="decimal" defaultValue={m.price.toFixed(2)} onBlur={(e) => updateMenu(m.id, { price: parseFloat(e.target.value) || 0 })} className="ss-input w-24 py-1.5 pl-5 text-sm" /></span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* 새 메뉴 추가 */}
                <div className="mt-3 rounded-xl border border-dashed border-zinc-200 p-3">
                  <div className="flex flex-wrap gap-2">
                    <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="ss-input min-w-[120px] flex-1" placeholder={t('메뉴명', 'Item name')} />
                    <input value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} list="menucats" className="ss-input w-32" placeholder={t('카테고리', 'Category')} />
                    <datalist id="menucats">{MENU_CATS.map((c) => <option key={c} value={c} />)}</datalist>
                    <input value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="ss-input w-24" placeholder="$" inputMode="decimal" />
                    <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-zinc-600"><input type="checkbox" checked={newItem.signature} onChange={(e) => setNewItem({ ...newItem, signature: e.target.checked })} /> {t('시그니처', 'Sig')}</label>
                    <button onClick={addMenu} className="ss-btn-primary px-5">{t('추가', 'Add')}</button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400">{t('가격은 항목의 숫자를 탭해 바로 고쳐요(입력창 밖을 누르면 저장). R/L 등 다중가격은 자동 표시.', 'Tap a price to edit — saves on blur. Multi-size (R/L) shows automatically.')}</p>
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

      {/* 스탬프 지급/차감 확인 — 스탬프는 현금과 같으니 한 번 더 확인 */}
      {stampConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-6" onClick={() => setStampConfirm(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-3xl ${stampConfirm.delta > 0 ? 'bg-blue-100' : 'bg-rose-100'}`}>{stampConfirm.delta > 0 ? '🎁' : '↩️'}</div>
            <h3 className={`mt-3 text-lg font-black ${stampConfirm.delta > 0 ? 'text-blue-700' : 'text-rose-700'}`}>{stampConfirm.delta > 0 ? t('스탬프 지급 확인', 'Confirm give') : t('스탬프 차감 확인', 'Confirm deduct')}</h3>
            <p className="mt-2 text-sm text-zinc-600">
              <b className="text-zinc-800">{stampConfirm.name || t('회원', 'Member')}</b>{t('님에게 스탬프 ', ' — ')}
              <b className="text-zinc-800">{Math.abs(stampConfirm.delta)}{t('개', '')}</b>{t('를', ' stamp(s)')}
            </p>
            <p className={`mt-1 text-2xl font-black ${stampConfirm.delta > 0 ? 'text-blue-600' : 'text-rose-600'}`}>{stampConfirm.delta > 0 ? t('지급할까요?', 'Give?') : t('차감할까요?', 'Deduct?')}</p>
            <p className="mt-2 text-[12px] font-bold text-rose-500">⚠ {t('스탬프는 현금과 같아요. 신중히 확인해 주세요.', 'Stamps are like cash — please confirm carefully.')}</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStampConfirm(null)} className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-500">{t('취소', 'Cancel')}</button>
              <button onClick={() => { const c = stampConfirm; setStampConfirm(null); adjustMemberStamp(c.deviceId, c.name, c.delta); }} disabled={busy} className={`flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 ${stampConfirm.delta > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{stampConfirm.delta > 0 ? t('지급 확인', 'Confirm give') : t('차감 확인', 'Confirm deduct')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 고객 화면 보기 — 새 탭 이동 대신 팝업(iframe)으로 그대로 띄우고 X로 닫기 */}
      {customerPreview && data && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 sm:p-8" onClick={() => setCustomerPreview(null)}>
          <div className="relative flex h-full max-h-[880px] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setCustomerPreview(null)} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900/80 text-lg font-bold text-white hover:bg-zinc-900">✕</button>
            <iframe src={`/me?store=${data.slug}&as=${customerPreview}`} className="h-full w-full flex-1 border-0" title="customer preview" />
          </div>
        </div>
      )}

      {/* 💳 캐시 사용 요청 팝업 — 손님이 송금 요청하면 태블릿에 뜸. 직원이 POS DC 후 승인 */}
      {cashPending.length > 0 && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💳</span>
              <h3 className="text-lg font-black">{t('캐시 사용 요청', 'Cash-use request')}{cashPending.length > 1 ? ` (${cashPending.length})` : ''}</h3>
            </div>
            {(() => {
              const req = cashPending[0];
              return (
                <div className="mt-3 rounded-2xl bg-zinc-50 p-4 text-center">
                  <div className="text-sm font-bold text-zinc-700">{req.name || t('손님', 'Guest')} <span className="text-zinc-400">{req.phone ? fmtPhone(req.phone) : ''}</span></div>
                  <div className="mt-1 text-[12px] text-zinc-500">{t('아래 금액만큼 사용을 요청했어요.', 'requests to use the amount below.')}</div>
                  <div className="mt-2 text-4xl font-black text-rose-500">${req.amount.toFixed(2)}</div>
                  <p className="mt-2 text-[12px] font-bold text-brand-700">👉 {t('POS에서 이 금액만큼 할인(DC) 후 승인하세요.', 'Apply this discount on the POS, then approve.')}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => rejectCashUse(req)} disabled={busy} className="flex-1 rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-500 disabled:opacity-50">{t('거절', 'Decline')}</button>
                    <button onClick={() => approveCashUse(req)} disabled={busy} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{t('DC 완료 → 승인', 'Discounted → Approve')}</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
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
