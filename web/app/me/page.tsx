'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import AdBannerSlot from './AdBanner';
import { getDb, getStorageBucket } from '@/lib/firebase';
import { NPOS } from '@/lib/npos';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { enablePush, disablePush, pushPermission } from '@/lib/push';

// 옛 CustomerPWA 대시보드 구성 그대로: 상단바(닉네임·QR스캔) · 매장 선택 드롭다운 ·
// 매장 헤더(9-stamp Cash·누적가치·인터벌) · 허니컴(번호/하트+칸별가치) · My Stamp Cash Balance(+Request) ·
// Stamp Timeline · Donate to Charity · 하단탭(스탬프 / 나눔 임팩트).


function getDeviceId(): string {
  try {
    let id = localStorage.getItem('ss_device_id');
    if (!id) { id = crypto.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`; localStorage.setItem('ss_device_id', id); }
    return id;
  } catch { return `dev_${Date.now()}`; }
}
const normPhone = (p: string) => p.replace(/[^0-9]/g, '');
// 미국식 전화 표기: 213-256-4820 (11자리 1로 시작하면 1-xxx-xxx-xxxx)
const fmtUS = (p?: string) => {
  const d = normPhone(p || '');
  if (d.length === 11 && d.startsWith('1')) return `1-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 6) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return d;
};

// 스탬프 목표: 방문·리뷰·SNS연결 3가지 획득이라 9개로. 벌집 = 큰 금액 허니컴 + 4 + 5.
const STAMP_GOAL = 9;
// stampValues: 칸별 가치(획득 시점의 보상÷9) · stampDates: 칸별 획득일 — 가치·날짜를 카드에 함께 고정한다.
type Card = { storeId: string; storeName: string; slug: string; currentStamps: number; reward: number; currency: string; interval?: number; stampValues?: number[]; stampDates?: string[] };
// 칸별 가치: 기록 있으면 그 값, 없으면(옛 데이터) 현재 보상÷9 폴백
const cellValue = (c: Card, i: number) => c.stampValues?.[i] ?? c.reward / STAMP_GOAL;
const cellDate = (c: Card, i: number) => c.stampDates?.[i];
const cardValue = (c: Card) => Array.from({ length: Math.min(c.currentStamps, STAMP_GOAL) }).reduce<number>((s, _, i) => s + cellValue(c, i), 0);
type Donation = { storeName?: string; npoName?: string; amount: number; currency: string; createdAt: string };

// 스탬프 카드가 없을 때도 허니컴 구조를 보여주는 미리보기(예시) 카드 — 옛 'Unassigned' 빈 카드처럼.
const DEMO: Card = { storeId: 'demo', storeName: '스탬프 카드 미리보기', slug: 'loveletter-fullerton', currentStamps: 0, reward: 5, currency: 'USD', interval: 60 };

// 종합관리자 조PD & ShareStamps 기본 카드(무조건 3개) — ShareStamps 매장만.
const ADMIN_PHONE = '2132564820'; // 213-256-4820
const SS_CARD: Card = { storeId: 'store_sharestamps', storeName: 'ShareStamps', slug: 'sharestamps', currentStamps: 3, reward: 5, currency: 'USD', interval: 60 };

export default function MePage() {
  const [profile, setProfile] = useState<{ name: string; phone: string } | null | undefined>(undefined);
  const [nameIn, setNameIn] = useState(''); const [phoneIn, setPhoneIn] = useState('');
  const [loginStep, setLoginStep] = useState<'phone' | 'welcome' | 'newuser'>('phone');
  const [foundAccount, setFoundAccount] = useState<{ deviceId: string; name: string; password?: string } | null>(null);
  const [loginPw, setLoginPw] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [selId, setSelId] = useState<string>('');
  const [balance, setBalance] = useState(0); const [donated, setDonated] = useState(0);
  // 프로필 사진 — 없으면 닉네임 첫 글자 아바타
  const [photoUrl, setPhotoUrl] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  // 내 프로필 화면 (헤더 아바타 클릭) — 보기·수정 + 사진 + 나눔 임팩트
  const [profileOpen, setProfileOpen] = useState(false);
  const [pfEdit, setPfEdit] = useState(false); // 프로필 수정 — 처음엔 접혀 있음
  const [pfName, setPfName] = useState(''); const [pfPhone, setPfPhone] = useState(''); const [pfPw, setPfPw] = useState(''); const [pfPw2, setPfPw2] = useState('');
  const [myPw, setMyPw] = useState('');
  // 전화번호 인증 (문자 코드) — 인증해야 친구 선물·기부·캐시 전환 가능
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [vGen, setVGen] = useState<{ code: string; exp: number } | null>(null);
  const [vCode, setVCode] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const [vTestHint, setVTestHint] = useState('');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [nav, setNav] = useState<'home' | 'impact'>('home');
  const [busy, setBusy] = useState(false); const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<'redeem' | 'gift' | 'donate' | null>(null); // 버튼 바로 아래 인라인 패널
  const [useSheet, setUseSheet] = useState(false);
  // 캐시 사용 요청 — 금액 조절 후 매장에 송금 요청 → 사장 승인 대기
  const [useAmount, setUseAmount] = useState('');
  const [useReq, setUseReq] = useState<{ id: string; storeId: string; status: 'pending' | 'approved' | 'rejected' } | null>(null);
  const [useBusy, setUseBusy] = useState(false);
  const [npo, setNpo] = useState(NPOS[0].id);
  const [storeCharities, setStoreCharities] = useState<{ id: string; name: string; source: string; desc?: string }[]>([]);
  const [tapIdx, setTapIdx] = useState<number | null>(null);
  const [bigTap, setBigTap] = useState(false);
  const tapTimerRef = useRef<number | null>(null);
  const bigTimerRef = useRef<number | null>(null);
  const [giftCount, setGiftCount] = useState(1);
  const [giftMsg, setGiftMsg] = useState(''); // 친구에게 보내는 인삿말
  const [pushOn, setPushOn] = useState(false); const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => { setPushOn(pushPermission() === 'granted'); }, []);
  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) { await disablePush(myId()); setPushOn(false); flash(t('알림을 껐어요.', 'Notifications off.')); }
      else { const ok = await enablePush(myId()); setPushOn(ok); flash(ok ? t('알림을 켰어요 🔔 선물·이벤트 소식을 받아요!', 'Notifications on 🔔') : t('알림 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.', 'Permission denied — allow in browser settings.')); }
    } finally { setPushBusy(false); }
  };
  // 친구 선물 — 닉네임 또는 전화번호로 라이브 검색(1글자부터) → 후보 목록에서 선택
  const [friendQuery, setFriendQuery] = useState('');
  const [friendIndex, setFriendIndex] = useState<{ phone: string; name: string; deviceId: string }[] | null>(null);
  const [friendPick, setFriendPick] = useState<{ phone: string; name: string; deviceId: string } | null>(null);
  const [donateCount, setDonateCount] = useState(1); // 기부할 스탬프 수량
  // 만료 스탬프 자동 기부처 (내 설정) + 전체 NPO 목록 (본사 등록 npos 컬렉션, 없으면 기본)
  const [myNpo, setMyNpo] = useState<{ id: string; name: string } | null>(null);
  const [globalNpos, setGlobalNpos] = useState<{ id: string; name: string; sub?: string }[]>(NPOS);
  useEffect(() => {
    (async () => {
      try {
        const s = await getDocs(collection(getDb(), 'npos'));
        if (s.size > 0) setGlobalNpos(s.docs.map((d) => ({ id: d.id, name: (d.data().name as string) || d.id, sub: d.data().sub as string })));
      } catch { /* 기본 NPOS 유지 */ }
    })();
  }, []);
  const saveMyNpo = async (id: string) => {
    const n = globalNpos.find((x) => x.id === id) || null;
    setMyNpo(n);
    try { await setDoc(doc(getDb(), 'customers', myId()), { defaultNpoId: n?.id || '', defaultNpoName: n?.name || '' }, { merge: true }); flash(n ? t(`만료 스탬프는 ${n.name}에 자동 기부돼요 💛`, `Expired stamps will go to ${n.name} 💛`) : t('자동 기부처 지정을 해제했어요.', 'Preference cleared.')); } catch { flash(t('저장 실패', 'Save failed')); }
  };
  const [lang, setLang] = useState<'ko' | 'en'>('ko');

  useEffect(() => { try { const l = localStorage.getItem('ss_lang'); if (l === 'en' || l === 'ko') setLang(l); } catch {} }, []);
  const toggleLang = () => { const n = lang === 'ko' ? 'en' : 'ko'; setLang(n); try { localStorage.setItem('ss_lang', n); } catch {} };
  const t = (ko: string, en: string) => (lang === 'ko' ? ko : en);

  const flash = (m: string, ms = 3000) => { setToast(m); setTimeout(() => setToast(null), ms); };

  // 점주 미리보기: /me?as=<deviceId> → 그 회원의 카드/프로필을 읽기 전용으로 표시(적립/선물/기부 액션 숨김)
  const previewId = useMemo(() => { try { return new URLSearchParams(window.location.search).get('as') || ''; } catch { return ''; } }, []);
  const preview = !!previewId;
  const myId = () => previewId || getDeviceId();

  const load = async () => {
    try {
      const db = getDb(); const id = myId();
      const [cardSnap, custSnap, donSnap] = await Promise.all([
        getDocs(collection(db, 'customers', id, 'cards')),
        getDoc(doc(db, 'customers', id)),
        getDocs(query(collection(db, 'customers', id, 'donations'), orderBy('createdAt', 'desc'), limit(8))).catch(() => null),
      ]);
      let cs = cardSnap.docs.map((d) => d.data() as Card);
      // ShareStamps 기본 카드(무조건 3개) 보장 — 그 매장만. (점주 미리보기에선 대신 쓰지 않음)
      if (!cs.some((c) => c.storeId === SS_CARD.storeId)) {
        cs = [{ ...SS_CARD }, ...cs];
        if (!preview) {
          const now = new Date().toISOString();
          setDoc(doc(db, 'customers', id, 'cards', SS_CARD.storeId), { ...SS_CARD, updatedAt: now }, { merge: true }).catch(() => {});
          setDoc(doc(db, 'stores', SS_CARD.storeId, 'stampCards', id), { deviceId: id, currentStamps: SS_CARD.currentStamps, updatedAt: now }, { merge: true }).catch(() => {});
        }
      }
      cs.sort((a, b) => b.currentStamps - a.currentStamps);
      setCards(cs);
      setSelId((prev) => prev && cs.some((c) => c.storeId === prev) ? prev : (cs[0]?.storeId || ''));
      const c = custSnap.exists() ? custSnap.data() : {};
      setBalance((c.balance as number) || 0); setDonated((c.donated as number) || 0);
      setPhotoUrl((c.photoUrl as string) || '');
      setMyPw((c.password as string) || '');
      setPhoneVerified(!!c.phoneVerified);
      setMyNpo(c.defaultNpoName ? { id: (c.defaultNpoId as string) || '', name: c.defaultNpoName as string } : null);
      setProfile(c.name ? { name: c.name as string, phone: (c.phone as string) || '' } : null);
      setDonations(donSnap ? donSnap.docs.map((d) => d.data() as Donation) : []);
      if (!preview) ensureDefaults(db); // 조PD 종합관리자 기본 회원 보장(브라우저당 1회)
    } catch { setProfile(null); }
  };

  // 기본 회원: 조PD 종합관리자(삭제 불가) — 브라우저당 1회만 기록
  const ensureDefaults = async (db: ReturnType<typeof getDb>) => {
    try {
      if (localStorage.getItem('ss_defaults_v1')) return;
      await setDoc(doc(db, 'customers', 'admin_jopd'), { name: '조PD', phone: ADMIN_PHONE, role: 'admin', protected: true }, { merge: true });
      await setDoc(doc(db, 'phoneIndex', ADMIN_PHONE), { deviceId: 'admin_jopd', name: '조PD' }, { merge: true });
      localStorage.setItem('ss_defaults_v1', '1');
    } catch { /* noop */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // 카드 실시간 구독 — 점주가 스탬프를 지급/차감하면 열려있는 화면에도 바로 반영
  useEffect(() => {
    if (!profile) return; // 로그인 후에만
    const id = myId();
    const unsub = onSnapshot(collection(getDb(), 'customers', id, 'cards'), (snap) => {
      const cs = snap.docs.map((d) => d.data() as Card);
      if (!cs.length) return;
      cs.sort((a, b) => b.currentStamps - a.currentStamps);
      setCards(cs);
    });
    return () => unsub();
  }, [profile]);

  // /claim 등에서 ?store=slug 로 넘어오면 그 매장 카드를 선택
  const preRan = useRef(false);
  useEffect(() => {
    if (preRan.current || !cards.length) return;
    try {
      const w = new URLSearchParams(window.location.search).get('store');
      if (w) { const m = cards.find((c) => c.slug === w); if (m) setSelId(m.storeId); }
    } catch {}
    preRan.current = true;
  }, [cards]);

  // 전화번호 조회 → 기존 회원이면 환영, 처음이면 닉네임 받기
  const checkPhone = async () => {
    const phone = normPhone(phoneIn);
    if (phone.length < 8) { flash(t('전화번호를 입력해 주세요.', 'Enter your phone number.')); return; }
    setBusy(true);
    try {
      const db = getDb();
      setLoginPw('');
      const resolve = async (deviceId: string, name: string) => {
        let password = '';
        try { const cd = await getDoc(doc(db, 'customers', deviceId)); if (cd.exists()) password = (cd.data().password as string) || ''; } catch {}
        setFoundAccount({ deviceId, name, password }); setLoginStep('welcome');
      };
      if (phone === ADMIN_PHONE) { await resolve('admin_jopd', '조PD'); return; }
      const idx = await getDoc(doc(db, 'phoneIndex', phone));
      if (idx.exists()) { await resolve(idx.data().deviceId as string, (idx.data().name as string) || ''); }
      else { setLoginStep('newuser'); }
    } catch { flash(t('확인에 실패했어요.', 'Lookup failed.')); }
    finally { setBusy(false); }
  };
  // 기존 회원 입장: 그 계정(deviceId)으로 세션 전환 후 로드
  const enterExisting = async () => {
    if (!foundAccount) return;
    if (foundAccount.password && loginPw.trim() !== foundAccount.password) { flash(t('비밀번호가 틀려요.', 'Wrong password.')); return; }
    setBusy(true);
    try { try { localStorage.setItem('ss_device_id', foundAccount.deviceId); } catch {} await load(); }
    finally { setBusy(false); }
  };

  const signup = async () => {
    if (!nameIn.trim() || normPhone(phoneIn).length < 8) { flash('이름과 전화번호를 입력해 주세요.'); return; }
    setBusy(true);
    try {
      const db = getDb(); const phone = normPhone(phoneIn);
      const isAdmin = phone === ADMIN_PHONE; // 213-256-4820 → 조PD 종합관리자
      let id = getDeviceId();
      if (isAdmin) { id = 'admin_jopd'; try { localStorage.setItem('ss_device_id', 'admin_jopd'); } catch {} }
      await setDoc(doc(db, 'customers', id), { name: nameIn.trim(), phone, role: isAdmin ? 'admin' : 'customer', protected: isAdmin }, { merge: true });
      await setDoc(doc(db, 'phoneIndex', phone), { deviceId: id, name: nameIn.trim() }, { merge: true });
      setProfile({ name: nameIn.trim(), phone }); flash(isAdmin ? `${nameIn.trim()} 종합관리자님 환영해요! 🐝` : `${nameIn.trim()}님 환영해요! 🐝`);
      await load();
    } catch { flash('가입에 실패했어요.'); } finally { setBusy(false); }
  };

  const sel = useMemo(() => cards.find((c) => c.storeId === selId) || cards[0], [cards, selId]);
  const disp = sel ?? DEMO; // 카드 없으면 미리보기로 허니컴 항상 표시

  // 선택 매장의 승인된 기부 단체 로드 (사장 지정 approved + 본사 지정) — 없으면 기본 NPOS 폴백
  useEffect(() => {
    const sid = disp.storeId;
    if (!sid || sid === 'demo') { setStoreCharities([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(getDb(), 'stores', sid, 'charities'));
        if (cancelled) return;
        setStoreCharities(snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as { name?: string; source?: string; status?: string; desc?: string }) }))
          .filter((c) => c.name && (c.source === 'hq' || c.status === 'approved'))
          .map((c) => ({ id: c.id, name: c.name as string, source: c.source || 'hq', desc: c.desc })));
      } catch { if (!cancelled) setStoreCharities([]); }
    })();
    return () => { cancelled = true; };
  }, [disp.storeId]);
  const showTapDate = (i: number) => {
    setTapIdx(i);
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => setTapIdx(null), 1600);
  };
  const showBigTap = () => {
    setBigTap(true);
    if (bigTimerRef.current) window.clearTimeout(bigTimerRef.current);
    bigTimerRef.current = window.setTimeout(() => setBigTap(false), 1600);
  };

  const charityList = storeCharities.length
    ? storeCharities.map((c) => ({ id: c.id, name: c.name, sub: c.desc?.trim() || (c.source === 'owner' ? t('사장 지정 단체', 'Owner-picked') : t('본사 지정 단체', 'HQ-picked')) }))
    : NPOS;
  useEffect(() => { const l = storeCharities.length ? storeCharities : NPOS; if (!l.some((n) => n.id === npo)) setNpo(l[0].id); }, [storeCharities]); // eslint-disable-line

  const value = (c: Card) => cardValue(c); // 칸별 획득 시점 가치의 합

  const reset = async (db: ReturnType<typeof getDb>, id: string, c: Card, now: string) => {
    await setDoc(doc(db, 'stores', c.storeId, 'stampCards', id), { currentStamps: 0, updatedAt: now }, { merge: true });
    await setDoc(doc(db, 'customers', id, 'cards', c.storeId), { currentStamps: 0, stampValues: [], stampDates: [], updatedAt: now }, { merge: true });
  };
  const redeem = async (c: Card) => {
    if (!requireVerified()) return;
    setBusy(true);
    try { const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString(); const v = value(c);
      const cnt = Math.min(c.currentStamps, STAMP_GOAL);
      await reset(db, id, c, now); await setDoc(doc(db, 'customers', id), { balance: balance + v }, { merge: true });
      // 정산용 로그 — 캐시 전환 이벤트 (획득시점 잠금 가치 합)
      await setDoc(doc(collection(db, 'stores', c.storeId, 'stampLog')), { deviceId: id, amount: null, source: 'redeem', count: cnt, value: v, createdAt: now }).catch(() => {});
      flash(`${c.currency} ${v.toFixed(2)} 적립 전환! 🎉`); await load();
    } catch { flash('처리 실패'); } finally { setBusy(false); }
  };
  // 뒤에서부터 n개 스탬프의 가치 합(획득 시점 가치 기준) — 기부/부분 처리에 사용
  const lastNValue = (c: Card, n: number) => {
    const vals = Array.from({ length: Math.min(c.currentStamps, STAMP_GOAL) }).map((_, i) => cellValue(c, i));
    const k = Math.max(0, Math.min(n, vals.length));
    return vals.slice(vals.length - k).reduce((s, v) => s + v, 0);
  };
  // 친구 인덱스 1회 로드 — 이후 타이핑마다 즉시(클라이언트) 필터
  const ensureFriendIndex = async () => {
    if (friendIndex) return;
    try {
      const snap = await getDocs(collection(getDb(), 'phoneIndex'));
      setFriendIndex(snap.docs
        .map((d) => ({ phone: d.id, name: (d.data().name as string) || '', deviceId: (d.data().deviceId as string) || '' }))
        .filter((r) => r.deviceId));
    } catch { setFriendIndex([]); }
  };
  useEffect(() => { if (panel === 'gift') ensureFriendIndex(); /* eslint-disable-next-line */ }, [panel]);
  // 닉네임 부분일치(대소문자 무시) 또는 전화번호 숫자 부분일치 — 1글자부터 즉시
  const friendMatches = useMemo(() => {
    const q = friendQuery.trim();
    if (!q || !friendIndex) return [];
    const mine = profile?.phone ? normPhone(profile.phone) : '';
    const ql = q.toLowerCase();
    const qd = q.replace(/[^0-9]/g, '');
    return friendIndex
      .filter((r) => r.phone !== mine)
      .filter((r) => r.name.toLowerCase().includes(ql) || (qd.length > 0 && r.phone.includes(qd)))
      .slice(0, 8);
  }, [friendQuery, friendIndex, profile?.phone]);
  const confirmDonate = async () => {
    const c = disp; if (c.currentStamps < 1) return;
    if (!requireVerified()) return;
    const qty = Math.max(1, Math.min(donateCount, c.currentStamps)); setBusy(true);
    try { const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString();
      const n = charityList.find((x) => x.id === npo)?.name;
      const allVals = Array.from({ length: Math.min(c.currentStamps, STAMP_GOAL) }).map((_, i) => cellValue(c, i));
      const allDates = Array.from({ length: Math.min(c.currentStamps, STAMP_GOAL) }).map((_, i) => cellDate(c, i) || now);
      const amount = allVals.slice(allVals.length - qty).reduce((s, v) => s + v, 0);
      const keptVals = allVals.slice(0, allVals.length - qty);
      const keptDates = allDates.slice(0, allDates.length - qty);
      const myNext = c.currentStamps - qty;
      await setDoc(doc(db, 'stores', c.storeId, 'stampCards', id), { currentStamps: myNext, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', id, 'cards', c.storeId), { currentStamps: myNext, stampValues: keptVals, stampDates: keptDates, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', id), { donated: donated + amount }, { merge: true });
      await setDoc(doc(collection(db, 'customers', id, 'donations'), `d_${Date.now()}`), { storeId: c.storeId, storeName: c.storeName, npoName: n, amount, currency: c.currency, settled: false, createdAt: now });
      setPanel(null); setDonateCount(1); flash(`${c.currency} ${amount.toFixed(2)} 기부 완료! 💛 ${n}`, 3500); await load();
    } catch { flash('기부 실패'); } finally { setBusy(false); }
  };
  const confirmGift = async () => {
    const c = disp;
    if (!requireVerified()) return;
    if (!friendPick) { flash(t('선물할 친구를 선택해 주세요.', 'Pick a friend first.')); return; }
    if (friendPick.phone === (profile?.phone ? normPhone(profile.phone) : '')) { flash('본인에게는 선물할 수 없어요.'); return; }
    const want = Math.max(1, Math.min(giftCount, c.currentStamps)); setBusy(true);
    try {
      const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString();
      const fId = friendPick.deviceId; const fName = friendPick.name || '친구';
      const fRef = doc(db, 'stores', c.storeId, 'stampCards', fId); const fSnap = await getDoc(fRef);
      const fCur = fSnap.exists() ? ((fSnap.data().currentStamps as number) || 0) : 0;
      const accept = Math.min(want, STAMP_GOAL - fCur); const returned = want - accept;
      if (accept <= 0) { flash(`${fName}님 카드가 가득 찼어요 (${STAMP_GOAL}/${STAMP_GOAL}).`); setBusy(false); return; }
      const fNext = fCur + accept;
      // 가치·날짜 배열도 함께 이동 — 내 마지막 accept개를 친구 카드 뒤에 붙인다
      const myVals = Array.from({ length: Math.min(c.currentStamps, STAMP_GOAL) }).map((_, i) => cellValue(c, i));
      const myDates = Array.from({ length: Math.min(c.currentStamps, STAMP_GOAL) }).map((_, i) => cellDate(c, i) || now);
      const movedVals = myVals.splice(myVals.length - accept, accept);
      const movedDates = myDates.splice(myDates.length - accept, accept);
      const fCardSnap = await getDoc(doc(db, 'customers', fId, 'cards', c.storeId));
      const fData = fCardSnap.exists() ? fCardSnap.data() : {};
      const fVals = ((fData.stampValues as number[] | undefined) ?? Array.from({ length: fCur }).map(() => c.reward / STAMP_GOAL)).slice(0, fCur);
      const fDates = ((fData.stampDates as string[] | undefined) ?? Array.from({ length: fCur }).map(() => now)).slice(0, fCur);
      await setDoc(fRef, { deviceId: fId, currentStamps: fNext, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', fId, 'cards', c.storeId), { storeId: c.storeId, storeName: c.storeName, slug: c.slug, currentStamps: fNext, reward: c.reward, currency: c.currency, stampValues: [...fVals, ...movedVals], stampDates: [...fDates, ...movedDates], updatedAt: now }, { merge: true });
      const myNext = c.currentStamps - accept;
      await setDoc(doc(db, 'stores', c.storeId, 'stampCards', id), { currentStamps: myNext, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', id, 'cards', c.storeId), { currentStamps: myNext, stampValues: myVals, stampDates: myDates, updatedAt: now }, { merge: true });
      // 정산용 로그 — 선물 이동 이벤트 (이동한 칸들의 잠금 가치 합)
      await setDoc(doc(collection(db, 'stores', c.storeId, 'stampLog')), { deviceId: id, toDeviceId: fId, amount: null, source: 'gift', count: accept, value: movedVals.reduce((s, v) => s + v, 0), createdAt: now }).catch(() => {});
      // 카톡처럼 — 친구에게 인삿말과 함께 웹푸시 알림
      const myName = profile?.name || '친구';
      const bodyMsg = giftMsg.trim() ? `"${giftMsg.trim()}" — ${myName}` : t(`${myName}님이 스탬프 ${accept}개를 선물했어요!`, `${myName} gifted you ${accept} stamp(s)!`);
      fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceIds: [fId], title: `🎁 ${t('스탬프 선물', 'Stamp gift')} (${accept})`, body: bodyMsg, url: `/me?store=${c.slug}`, tag: `gift_${fId}` }) }).catch(() => {});
      setPanel(null); setFriendQuery(''); setFriendPick(null); setGiftCount(1); setGiftMsg('');
      flash(`${fName}님께 ${accept}개 선물! 🎁${returned ? ` (초과 ${returned}개 회수)` : ''}`, 4000); await load();
    } catch { flash('선물 실패'); } finally { setBusy(false); }
  };

  // 프로필 사진 업로드 — Storage avatars/ 에 올리고 customers 문서에 URL 저장
  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) { flash(t('이미지 파일만 올릴 수 있어요.', 'Images only.')); return; }
    if (file.size > 10 * 1024 * 1024) { flash(t('사진은 10MB 미만이어야 해요.', 'Under 10MB please.')); return; }
    setAvatarBusy(true);
    try {
      const id = myId();
      const r = storageRef(getStorageBucket(), `avatars/${id}_${Date.now()}.jpg`);
      await uploadBytes(r, file, { contentType: file.type });
      const url = await getDownloadURL(r);
      await setDoc(doc(getDb(), 'customers', id), { photoUrl: url }, { merge: true });
      setPhotoUrl(url); flash(t('프로필 사진이 바뀌었어요 ✓', 'Profile photo updated ✓'));
    } catch { flash(t('업로드 실패 — 다시 시도해 주세요.', 'Upload failed.')); }
    finally { setAvatarBusy(false); }
  };

  // 인증 코드 발송 — 6자리 생성 후 문자 발송(API). 게이트웨이 연동 전엔 테스트 모드로 코드 표시.
  const sendVerifyCode = async () => {
    const phone = profile?.phone ? normPhone(profile.phone) : '';
    if (phone.length < 10) { flash(t('전화번호를 먼저 등록해 주세요.', 'Register your phone first.')); setPfEdit(true); return; }
    setVBusy(true); setVTestHint('');
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const res = await fetch('/api/verify-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, code }) });
      const d = await res.json();
      if (!d?.ok) { flash(t('문자 발송 실패 — 잠시 후 다시 시도해 주세요.', 'SMS failed — try again.')); return; }
      setVGen({ code, exp: Date.now() + 10 * 60 * 1000 }); setVCode('');
      if (d.testMode) { setVTestHint(code); flash(t('테스트 모드 — 아래 코드를 입력하세요.', 'Test mode — enter the code below.')); }
      else flash(t('인증 코드를 문자로 보냈어요 📩', 'Code sent 📩'));
    } catch { flash(t('문자 발송 실패', 'SMS failed.')); }
    finally { setVBusy(false); }
  };
  // 코드 확인 → 인증 완료
  const confirmVerifyCode = async () => {
    if (!vGen) return;
    if (Date.now() > vGen.exp) { flash(t('코드가 만료됐어요. 다시 받아주세요.', 'Code expired — resend.')); setVGen(null); return; }
    if (vCode.trim() !== vGen.code) { flash(t('코드가 올바르지 않아요.', 'Wrong code.')); return; }
    setVBusy(true);
    try {
      await setDoc(doc(getDb(), 'customers', myId()), { phoneVerified: true }, { merge: true });
      setPhoneVerified(true); setVGen(null); setVCode(''); setVTestHint('');
      flash(t('전화번호 인증 완료 ✓ 이제 선물·기부·캐시 전환을 쓸 수 있어요!', 'Phone verified ✓'), 3500);
    } catch { flash(t('처리 실패', 'Failed.')); }
    finally { setVBusy(false); }
  };
  // 인증 필요 액션 게이트 — 선물·기부·캐시 전환
  const requireVerified = () => {
    if (phoneVerified) return true;
    flash(t('전화번호 인증 후 이용할 수 있어요 — 내 프로필에서 인증해 주세요 📱', 'Verify your phone in My Profile first 📱'), 3500);
    openProfile();
    return false;
  };

  // 내 프로필 열기 — 현재 값으로 드래프트 채움 (수정 섹션은 접힌 채)
  const openProfile = () => {
    setPfName(profile?.name || ''); setPfPhone(fmtUS(profile?.phone)); setPfPw(myPw); setPfPw2(myPw);
    setPfEdit(false);
    setProfileOpen(true);
  };
  // 내 프로필 저장 — 닉네임·전화(선택)·비밀번호(확인 일치). 전화 변경 시 phoneIndex 이전(중복 검사)
  const saveProfile = async () => {
    const name = pfName.trim(); const phone = normPhone(pfPhone);
    if (!name) { flash(t('닉네임을 입력해 주세요.', 'Enter a nickname.')); return; }
    if (phone && phone.length < 10) { flash(t('전화번호를 확인해 주세요. (미국식 10자리)', 'Check the phone number (10 digits).')); return; }
    if (pfPw.trim() !== pfPw2.trim()) { flash(t('비밀번호 확인이 일치하지 않아요.', 'Passwords do not match.')); return; }
    setBusy(true);
    try {
      const db = getDb(); const id = myId();
      const oldP = profile?.phone ? normPhone(profile.phone) : '';
      if (phone && phone !== oldP) {
        const dup = await getDoc(doc(db, 'phoneIndex', phone));
        if (dup.exists() && dup.data().deviceId !== id) { flash(t('이미 사용 중인 전화번호예요.', 'Phone already in use.')); setBusy(false); return; }
      }
      const phoneChanged = phone !== oldP;
      await setDoc(doc(db, 'customers', id), { name, phone, password: pfPw.trim(), ...(phoneChanged ? { phoneVerified: false } : {}) }, { merge: true });
      if (oldP && oldP !== phone) await deleteDoc(doc(db, 'phoneIndex', oldP)).catch(() => {});
      if (phone) await setDoc(doc(db, 'phoneIndex', phone), { deviceId: id, name }, { merge: true });
      setProfile({ name, phone }); setMyPw(pfPw.trim()); setPfEdit(false);
      if (phoneChanged) { setPhoneVerified(false); setVGen(null); setVTestHint(''); }
      flash(t('프로필이 저장됐어요 ✓', 'Profile saved ✓'));
    } catch { flash(t('저장 실패', 'Save failed.')); }
    finally { setBusy(false); }
  };

  // 캐시 사용 송금 요청 — 매장에 pending 요청 생성, 사장 태블릿 팝업으로 승인
  const requestCashUse = async () => {
    const c = disp; const amt = Math.min(parseFloat(useAmount) || 0, balance);
    if (!(amt > 0)) { flash(t('사용할 금액을 입력해 주세요.', 'Enter an amount.')); return; }
    if (!c.storeId || c.storeId === 'demo') { flash(t('매장을 선택해 주세요.', 'Pick a store.')); return; }
    setUseBusy(true);
    try {
      const db = getDb(); const id = myId();
      const ref = doc(collection(db, 'stores', c.storeId, 'cashRequests'));
      await setDoc(ref, { deviceId: id, name: profile?.name || '', phone: profile?.phone || '', amount: amt, status: 'pending', storeName: c.storeName, createdAt: new Date().toISOString() });
      setUseReq({ id: ref.id, storeId: c.storeId, status: 'pending' });
    } catch { flash(t('요청 실패 — 다시 시도해 주세요.', 'Request failed.')); }
    finally { setUseBusy(false); }
  };
  // 요청 상태 실시간 구독 — 사장이 승인/거절하면 시트가 즉시 반영
  useEffect(() => {
    if (!useReq || useReq.status !== 'pending') return;
    const unsub = onSnapshot(doc(getDb(), 'stores', useReq.storeId, 'cashRequests', useReq.id), (snap) => {
      const s = snap.exists() ? (snap.data().status as string) : '';
      if (s === 'approved') { setUseReq((r) => r ? { ...r, status: 'approved' } : r); load(); }
      else if (s === 'rejected') { setUseReq((r) => r ? { ...r, status: 'rejected' } : r); }
    });
    return () => unsub();
    // eslint-disable-next-line
  }, [useReq?.id, useReq?.status]);
  const clip = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

  // ── 로그인 게이트 ──
  if (profile === undefined) return <main className="mx-auto max-w-md px-4 pt-16 text-center text-sm text-zinc-400">불러오는 중…</main>;
  if (profile === null) {
    return (
      <main className="mx-auto max-w-md px-5 pb-20 pt-6 text-center">
        <div className="flex justify-end"><button onClick={toggleLang} className="rounded-full bg-zinc-100 px-2.5 py-1.5 text-xs font-bold text-zinc-600">🌐 {lang === 'ko' ? 'EN' : 'KO'}</button></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/sharestamps-symbol.svg" alt="ShareStamps" className="mx-auto mt-2 h-20 w-20" />
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-700">ShareStamps</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('동네 가게 스탬프를 모으고 친구에게 선물하세요', 'Collect local stamps and gift them to friends')}</p>

        <div className="ss-card mt-6 p-5 text-left">
          {loginStep === 'phone' && (
            <>
              <label className="ss-label">{t('전화번호', 'Phone number')}</label>
              <input value={phoneIn} onChange={(e) => setPhoneIn(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') checkPhone(); }} className="ss-input" placeholder="000-000-0000" inputMode="tel" autoFocus />
              <button onClick={checkPhone} disabled={busy} className="ss-btn-primary mt-3 w-full">{busy ? '…' : t('다음', 'Next')}</button>
              <p className="mt-2 text-[11px] text-zinc-400">{t('전화번호로 시작해요. 처음이면 닉네임을 받아요.', 'Start with your phone — new users pick a nickname.')}</p>
            </>
          )}
          {loginStep === 'welcome' && foundAccount && (
            <div className="text-center">
              <div className="text-3xl">🐝</div>
              <p className="mt-1 text-lg font-black text-brand-700">{t('또 오셨군요', 'Welcome back')}{foundAccount.name ? `, ${foundAccount.name}님!` : '!'}</p>
              <p className="mt-0.5 text-sm text-zinc-500">{phoneIn}</p>
              {foundAccount.password && (
                <div className="mt-3 text-left">
                  <label className="ss-label">🔒 {t('비밀번호', 'Password')}</label>
                  <input value={loginPw} onChange={(e) => setLoginPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enterExisting(); }} type="password" className="ss-input" placeholder={t('비밀번호 입력', 'Enter password')} autoFocus />
                </div>
              )}
              <button onClick={enterExisting} disabled={busy} className="ss-btn-primary mt-4 w-full">{busy ? '…' : t('들어가기', 'Enter')}</button>
              <button onClick={() => { setLoginStep('phone'); setFoundAccount(null); }} className="mt-2 text-xs font-bold text-zinc-400">{t('다른 번호로', 'Use a different number')}</button>
            </div>
          )}
          {loginStep === 'newuser' && (
            <>
              <p className="text-sm font-bold text-brand-700">{t('처음 오셨네요! 닉네임을 정해주세요 🐝', 'First time here! Pick a nickname 🐝')}</p>
              <label className="ss-label">{t('이름 (닉네임)', 'Name (nickname)')}</label>
              <input value={nameIn} onChange={(e) => setNameIn(e.target.value)} className="ss-input" placeholder={t('홍길동', 'Your name')} autoFocus />
              <label className="ss-label">{t('전화번호', 'Phone number')}</label>
              <input value={phoneIn} onChange={(e) => setPhoneIn(e.target.value)} className="ss-input" placeholder="000-000-0000" inputMode="tel" />
              <button onClick={signup} disabled={busy} className="ss-btn-primary mt-3 w-full">{busy ? '…' : t('가입하고 시작', 'Sign up & start')}</button>
              <button onClick={() => setLoginStep('phone')} className="mt-2 text-xs font-bold text-zinc-400">{t('뒤로', 'Back')}</button>
            </>
          )}
        </div>
        {toast && <Toast t={toast} />}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-24">
      {/* 점주 미리보기 배너 — 팝업(iframe)의 X로 닫으므로 여기엔 안내만 */}
      {preview && (
        <div className="-mx-4 mb-1 bg-brand-600 px-4 py-2 text-center text-white">
          <span className="text-xs font-bold">👀 {t('점주 화면에서 보는 고객 화면', "Owner's view of the customer screen")}</span>
        </div>
      )}
      {/* 상단바 */}
      <div className="flex items-center justify-between pt-3 pb-2">
        <button onClick={openProfile} className="flex items-center gap-2" title={t('내 프로필', 'My profile')}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={profile.name} className="h-9 w-9 rounded-full border-2 border-brand-200 object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-base font-black text-white">{(profile.name || '?').trim().charAt(0).toUpperCase()}</span>
          )}
          <span className="text-sm font-bold text-brand-700">{profile.name}</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className="rounded-full bg-zinc-100 px-2.5 py-1.5 text-xs font-bold text-zinc-600">🌐 {lang === 'ko' ? 'EN' : 'KO'}</button>
          <Link href={cards[0] ? `/store/${cards[0].slug}` : '/'} className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white">📷 {t('QR 스캔', 'QR Scan')}</Link>
        </div>
      </div>

      {/* 상단 광고 배너 (16:4 · 15초 자동순환 · 직각 풀블리드) */}
      <div className="-mx-4 mb-4">
        <AdBannerSlot />
      </div>

      {nav === 'home' && (
        <>
          {/* 매장 선택 */}
          <select value={selId} onChange={(e) => { setSelId(e.target.value); setPanel(null); }} className="ss-input w-full text-center font-bold">
            {cards.length === 0 && <option>{t('매장 없음', 'No store')}</option>}
            {cards.map((c) => <option key={c.storeId} value={c.storeId}>{c.storeName}</option>)}
          </select>

          {!sel && (
            <div className="ss-card mt-3 flex items-center gap-3 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sharbee/sharbee5.png" alt="샤비" className="h-11 w-11 shrink-0 object-contain" />
              <div className="flex-1">
                <p className="text-sm font-bold">{t('스탬프 카드 미리보기', 'Stamp card preview')}</p>
                <p className="text-xs text-zinc-500">{t('매장에서 QR을 찍으면 내 카드가 생겨요.', 'Scan a store QR to create your card.')}</p>
              </div>
              <Link href="/store/loveletter-fullerton" className="ss-chip">{t('둘러보기', 'Explore')}</Link>
            </div>
          )}
          {(
            <>
              {/* 스탬프 카드 — 화면의 주인공(헤더+허니컴 한 덩어리, 링으로 강조) */}
              <section className="ss-card mt-3 p-0 ring-2 ring-brand-200">
                <div className="p-5 pb-3 text-center">
                  <Link href={`/store/${disp.slug}`} className="group inline-flex items-center gap-1.5 text-2xl font-black transition hover:text-brand-700" title={t('미니홈피 보기', 'View mini-home')}>
                    {disp.storeName}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 animate-pulse text-zinc-400 transition group-hover:animate-none group-hover:text-brand-600 group-active:text-brand-600 motion-reduce:animate-none">
                      <path d="M5 19 19 5M9 5h10v10" />
                    </svg>
                  </Link>
                </div>
                <div className="relative rounded-b-2xl border-t border-zinc-100 bg-gradient-to-b from-brand-50/70 to-white px-5 pb-5 pt-3">
                  {/* 적립 간격 — 경계선 아래 좌상단에 옅게. 60분 단위는 h, 그 외는 min */}
                  <span className="absolute left-4 top-2.5 z-10 text-[11px] font-medium text-zinc-400">{t('적립간격', 'Interval')} {disp.interval == null ? '—' : disp.interval % 60 === 0 ? `${disp.interval / 60}h` : `${disp.interval}min`}</span>
                  {/* 축하하는 샤비 — 카드 경계를 넘어 떠 있는 느낌 (흰 배경은 multiply로 녹임) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sharbee/gole.png" alt="" aria-hidden className="ss-float pointer-events-none absolute -right-8 -top-10 z-20 w-44 select-none mix-blend-multiply" style={{ filter: 'drop-shadow(0 10px 12px rgba(0,0,0,.18))' }} />
                  {(() => {
                    const filledCount = Math.min(disp.currentStamps, STAMP_GOAL);
                    const CELL = 51; const GAP = 6; const H = CELL * 1.1547; const OVERLAP = H * 0.20;
                    const BIG = CELL * 1.62; const Hs = BIG * 1.1547;
                    const fmtTap = (iso?: string) => {
                      if (!iso) return '—';
                      const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0');
                      return `${p(d.getMonth() + 1)}.${p(d.getDate())}.${String(d.getFullYear()).slice(-2)}`;
                    };
                    const Hex = ({ i }: { i: number }) => {
                      const on = i < filledCount;
                      return (
                        <div className="relative flex flex-col items-center" style={{ width: CELL }}>
                          {tapIdx === i && (
                            <span className="ss-tapfade pointer-events-none absolute -top-11 z-30 flex flex-col items-center whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-center text-white shadow-lg">
                              <span className="text-[10px] font-bold">{fmtTap(cellDate(disp, i))}</span>
                              <span className="text-[10px] font-black text-emerald-300">+${cellValue(disp, i).toFixed(2)}</span>
                            </span>
                          )}
                          <div onClick={() => on && showTapDate(i)} style={{ width: CELL, aspectRatio: '0.866', clipPath: clip, background: on ? 'linear-gradient(150deg,#a855f7,#6d28d9)' : '#e3daf9', cursor: on ? 'pointer' : 'default', padding: 2 }}>
                            <div className="grid h-full w-full place-items-center text-[16px] font-black" style={{ clipPath: clip, background: on ? 'linear-gradient(160deg,#8b5cf6,#5b21b6)' : '#ffffff', color: on ? '#fff' : '#b8a6e8' }}>{on ? '❤️' : i + 1}</div>
                          </div>
                        </div>
                      );
                    };
                    return (
                      <div className="flex flex-col items-center">
                        {/* 맨 위 금빛 허니컴 — 금액만. 클릭하면 오늘 날짜·누적 툴팁 */}
                        <div className="relative" style={{ filter: 'drop-shadow(0 6px 14px rgba(217,119,6,.5))', marginBottom: 6, zIndex: 10 }}>
                          {bigTap && (
                            <span className="ss-tapfade pointer-events-none absolute -top-10 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1 text-center text-white shadow-lg">
                              <span className="text-[10px] font-bold">{fmtTap(new Date().toISOString())}</span>
                              <span className="text-[11px] font-black text-emerald-300">{t('누적', 'Saved')} ${value(disp).toFixed(2)}</span>
                            </span>
                          )}
                          <div onClick={showBigTap} className="ss-bighex cursor-pointer" style={{ width: BIG, aspectRatio: '0.866', clipPath: clip, background: 'linear-gradient(160deg,#fcd34d 0%,#b45309 100%)', padding: 3 }}>
                            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-1" style={{ clipPath: clip, background: 'radial-gradient(120% 92% at 50% 20%, #fffbe6 0%, #fde047 34%, #f59e0b 74%, #d97706 100%)' }}>
                              {/* 상단 광택 하이라이트 */}
                              <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: '48%', background: 'linear-gradient(180deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,0) 100%)' }} />
                              <span className="ss-goldtext relative text-[21px] font-black leading-none" style={{ textShadow: '0 1px 2px rgba(120,53,15,.55)' }}>${disp.reward.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </div>
                        {/* 위 4개 (번호 6~9) */}
                        <div className="flex justify-center" style={{ gap: GAP }}>{[5, 6, 7, 8].map((i) => <Hex key={i} i={i} />)}</div>
                        {/* 아래 5개 (번호 1~5) — 벌집 사이 쌓기. 채움은 아래에서부터 */}
                        <div className="flex justify-center" style={{ gap: GAP, marginTop: -OVERLAP }}>{[0, 1, 2, 3, 4].map((i) => <Hex key={i} i={i} />)}</div>
                      </div>
                    );
                  })()}
                  {/* 액션: 0개여도 또렷하게(흐림 X), 누르면 안내 */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button onClick={() => { if (panel === 'redeem') { setPanel(null); return; } if (!requireVerified()) return; setPanel('redeem'); }} disabled={busy} className={`rounded-xl border py-3 text-sm font-bold text-rose-600 transition active:scale-[0.98] ${panel === 'redeem' ? 'border-rose-400 bg-rose-50' : 'border-rose-200 bg-white'}`}>{t('적립 전환', 'Redeem')}</button>
                    <button onClick={() => { if (panel === 'gift') { setPanel(null); return; } if (!requireVerified()) return; setPanel('gift'); }} disabled={busy} className={`rounded-xl border py-3 text-sm font-bold text-brand-700 transition active:scale-[0.98] ${panel === 'gift' ? 'border-brand-500 bg-brand-50' : 'border-brand-200 bg-white'}`}>{t('친구 선물', 'Gift')}</button>
                    <button onClick={() => { if (panel === 'donate') { setPanel(null); return; } if (!requireVerified()) return; setPanel('donate'); }} disabled={busy} className={`rounded-xl border py-3 text-sm font-bold text-amber-700 transition active:scale-[0.98] ${panel === 'donate' ? 'border-amber-400 bg-amber-100' : 'border-amber-300 bg-amber-50'}`}>{t('기부', 'Donate')} 💛</button>
                  </div>

                  {/* 버튼 바로 아래 인라인 패널 — 적립/선물/기부 같은 스타일 */}
                  {panel && (
                    <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="-mt-1 mb-1 flex justify-end"><button onClick={() => setPanel(null)} className="text-xs font-bold text-zinc-400">✕</button></div>
                      {panel === 'redeem' && (disp.currentStamps < STAMP_GOAL ? (
                        <div className="text-center">
                          <p className="text-sm font-bold text-zinc-700">{t(`적립은 스탬프 ${STAMP_GOAL}개가 모아져야 합니다.`, `You need all ${STAMP_GOAL} stamps to redeem.`)}</p>
                          <p className="mt-1 text-xs text-zinc-500">{t('현재', 'Now')} {disp.currentStamps}/{STAMP_GOAL}</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm font-bold">{t('얼마를 적립하시겠습니까?', 'How much to redeem?')}</p>
                          <div className="my-1 text-2xl font-black text-rose-500">${value(disp).toFixed(2)}</div>
                          <button onClick={() => redeem(disp)} disabled={busy} className="ss-btn-primary w-full">{busy ? '…' : t('적립하기', 'Redeem')}</button>
                        </div>
                      ))}
                      {panel === 'gift' && (disp.currentStamps < 1 ? (
                        <p className="text-center text-sm text-zinc-500">{t('스탬프 1개 이상부터 선물할 수 있어요.', 'Need at least 1 stamp to gift.')}</p>
                      ) : (
                        <div>
                          <p className="text-sm font-bold">{t('친구에게 스탬프 선물 🎁', 'Gift stamps 🎁')} <span className="text-zinc-400">({t('보유', 'have')} {disp.currentStamps})</span></p>
                          {/* 1) 닉네임 또는 전화번호 — 1글자부터 즉시 검색 */}
                          <input value={friendQuery} onChange={(e) => { setFriendQuery(e.target.value); setFriendPick(null); }} className="ss-input mt-2" placeholder={t('닉네임 또는 전화번호', 'Nickname or phone')} autoFocus />
                          {friendQuery.trim() && friendMatches.length === 0 && <p className="mt-2 text-center text-xs text-zinc-400">{t('일치하는 친구가 없어요. (친구도 가입 필요)', 'No match — your friend needs an account.')}</p>}
                          {/* 2) 후보 목록에서 선택 (전화·닉네임 표시) */}
                          {friendMatches.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {friendMatches.map((f) => {
                                const p = f.phone; const disp2 = p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p;
                                const on = friendPick?.deviceId === f.deviceId;
                                return (
                                  <button key={f.deviceId} onClick={() => setFriendPick(f)} className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left ${on ? 'border-brand-500 bg-brand-50' : 'border-zinc-200'}`}>
                                    <span className="min-w-0"><span className="font-bold">{f.name || t('이름 없음', 'No name')}</span> <span className="text-xs text-zinc-500">{disp2}</span></span>
                                    {on && <span className="shrink-0 text-brand-600">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {/* 3) 수량 + 보내기 (친구 선택 후) */}
                          {friendPick && (
                            <>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-sm font-bold text-zinc-600">{t('보낼 수량', 'Qty')}</span>
                                <input type="number" min={1} max={disp.currentStamps} value={giftCount} onChange={(e) => setGiftCount(Math.max(1, Math.min(disp.currentStamps, parseInt(e.target.value, 10) || 1)))} className="ss-input" />
                              </div>
                              <input value={giftMsg} onChange={(e) => setGiftMsg(e.target.value)} maxLength={60} className="ss-input mt-2" placeholder={t('💌 인삿말 (예: 생일 축하해! 커피 한잔 사줄게)', '💌 Message (optional)')} />
                              <button onClick={confirmGift} disabled={busy} className="ss-btn-primary mt-2 w-full">{busy ? '…' : t(`${friendPick.name || '친구'}님께 ${giftCount}개 선물`, `Gift ${giftCount} to ${friendPick.name || 'friend'}`)}</button>
                            </>
                          )}
                        </div>
                      ))}
                      {panel === 'donate' && (disp.currentStamps < 1 ? (
                        <p className="text-center text-sm text-zinc-500">{t('스탬프 1개 이상부터 기부할 수 있어요.', 'Need at least 1 stamp to donate.')}</p>
                      ) : (
                        <div>
                          <p className="text-sm font-bold">{t('어디에 기부할까요? 💛', 'Donate to? 💛')}</p>
                          <div className="mt-2 space-y-1.5">
                            {charityList.map((n) => (
                              <label key={n.id} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 ${npo === n.id ? 'border-brand-500 bg-brand-50' : 'border-zinc-200'}`}>
                                <input type="radio" name="npo2" checked={npo === n.id} onChange={() => setNpo(n.id)} />
                                <span className="text-sm font-semibold">{n.name} <span className="text-[11px] text-zinc-400">· {n.sub}</span></span>
                              </label>
                            ))}
                          </div>
                          {/* 기부할 수량 선택 (전부가 아니라 원하는 만큼) */}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-zinc-600">{t('기부할 스탬프', 'Stamps to donate')}</span>
                            <input type="number" min={1} max={disp.currentStamps} value={donateCount} onChange={(e) => setDonateCount(Math.max(1, Math.min(disp.currentStamps, parseInt(e.target.value, 10) || 1)))} className="ss-input w-24 text-center" />
                          </div>
                          <div className="mt-1 text-right text-xs text-zinc-500">{t('기부 금액', 'Donation')} <span className="font-black text-amber-600">${lastNValue(disp, Math.max(1, Math.min(donateCount, disp.currentStamps))).toFixed(2)}</span> <span className="text-zinc-400">/ {t('보유', 'have')} {disp.currentStamps}</span></div>
                          <button onClick={confirmDonate} disabled={busy} className="ss-btn-primary mt-2 w-full">{busy ? '…' : t(`${Math.max(1, Math.min(donateCount, disp.currentStamps))}개 기부하기`, `Donate ${Math.max(1, Math.min(donateCount, disp.currentStamps))}`)}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* 샤비와 리뷰 — 독립 카드 (챗봇 바로 열기) */}
              <Link href={`/store/${disp.slug}?review=1`} className="ss-card mt-3 flex items-center gap-3 border border-honey/60 bg-honey/20 p-4 active:scale-[0.99]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sharbee/sharbee5.png" alt="샤비" className="h-11 w-11 shrink-0 object-contain" />
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-honey-ink">{t('샤비와 리뷰 쓰고 스탬프 받기', 'Write a review with Sharbee')}</div>
                  <div className="text-[11px] text-honey-ink/70">{t('대화하듯 리뷰 쓰면 스탬프를 드려요 🐝', 'Chat to write a review, earn a stamp 🐝')}</div>
                </div>
                <span className="text-honey-ink/50">›</span>
              </Link>

              {/* 캐시 잔액 — 보조 정보라 작고 조용한 한 줄로 */}
              <section className="ss-card mt-3 flex items-center justify-between p-4">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-500">{t('내 스탬프 캐시 잔액', 'My stamp cash')}</div>
                  <div className="text-xl font-black text-zinc-800">${balance.toFixed(2)}</div>
                </div>
                <button onClick={() => { setUseReq(null); setUseAmount(balance.toFixed(2)); setUseSheet(true); }} disabled={balance <= 0} className="ss-chip disabled:opacity-50">{t('캐시 사용', 'Use cash')}</button>
              </section>

              {/* Stamp Timeline */}
              <section className="ss-card mt-3 p-5">
                <h3 className="text-sm font-extrabold text-brand-700">💬 {t('스탬프 나눔 타임라인', 'Stamp timeline')}</h3>
                {donations.length === 0 ? <p className="mt-2 text-center text-sm text-zinc-400">{t('아직 활동 내역이 없어요.', 'No activity yet.')}</p> : (
                  <div className="mt-2 space-y-1.5">
                    {donations.map((d, i) => <div key={i} className="flex justify-between text-sm"><span className="text-zinc-600">{d.storeName} → {d.npoName ?? '기부'}</span><span className="font-bold text-amber-600">${d.amount.toFixed(2)}</span></div>)}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Donate to Charity */}
          <section className="ss-card mt-3 p-5">
            <h3 className="text-sm font-extrabold text-brand-700">💛 {t('단체 기부하기', 'Donate to charity')}{storeCharities.length > 0 && <span className="ml-1 text-[11px] font-medium text-zinc-400">· {disp.storeName}</span>}</h3>
            <div className="mt-2 space-y-2">
              {charityList.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                  <div><div className="text-sm font-bold">{n.name}</div><div className="text-[11px] text-zinc-500">{n.sub}</div></div>
                  <button onClick={() => { if (!sel || sel.currentStamps < 1) { flash(t('스탬프 1개 이상부터 기부 가능해요.', 'Need at least 1 stamp to donate.')); return; } if (!requireVerified()) return; setNpo(n.id); setDonateCount(1); setPanel('donate'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="ss-chip">{t('기부', 'Donate')}</button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">{t('* 스탬프 1개 이상일 때 선물·기부가 활성화돼요.', '* Gifting and donating need at least 1 stamp.')}</p>
          </section>
        </>
      )}

      {nav === 'impact' && (
        <div className="pt-2">
          <section className="ss-card bg-amber-50 p-5 text-center">
            <div className="text-xs font-semibold text-zinc-500">{t('나의 누적 나눔 💛', 'My total giving 💛')}</div>
            <div className="text-3xl font-black text-amber-600">${donated.toFixed(2)}</div>
          </section>
          {/* 만료 스탬프 자동 기부처 — 내가 지정한 단체로 1년 만료 스탬프가 자동 기부됨 */}
          <section className="ss-card mt-3 p-5">
            <h3 className="text-sm font-extrabold text-brand-700">⏳ {t('만료 스탬프 자동 기부처', 'Auto-donation for expired stamps')}</h3>
            <p className="mt-1 text-[11px] text-zinc-500">{t('스탬프는 적립 1년 후 만료돼요. 지정한 단체로 자동 기부되어 나의 나눔으로 쌓입니다. 미지정 시 매장 기본 단체로 가요.', 'Stamps expire 1 year after earning and are auto-donated to your chosen NPO (or the store default).')}</p>
            <select value={myNpo?.id || ''} onChange={(e) => saveMyNpo(e.target.value)} className="ss-input mt-2">
              <option value="">{t('지정 안 함 (매장 기본 단체로)', 'No preference (store default)')}</option>
              {globalNpos.map((n) => <option key={n.id} value={n.id}>{n.name}{n.sub ? ` · ${n.sub}` : ''}</option>)}
            </select>
            {myNpo && <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">💛 {t(`만료 스탬프는 ${myNpo.name}(으)로 자동 기부돼요`, `Expired stamps auto-donate to ${myNpo.name}`)}</div>}
          </section>

          <section className="ss-card mt-3 p-5">
            <h3 className="text-sm font-extrabold text-brand-700">{t('기부 내역', 'Donation history')}</h3>
            {donations.length === 0 ? <p className="mt-2 text-center text-sm text-zinc-400">{t('아직 기부 내역이 없어요. 스탬프를 NPO에 전해 보세요!', 'No donations yet. Send stamps to an NPO!')}</p> : (
              <div className="mt-2 divide-y divide-zinc-100">
                {donations.map((d, i) => <div key={i} className="flex justify-between py-2.5 text-sm"><span className="text-zinc-600">{d.storeName} → {d.npoName ?? '기부'}</span><span className="font-bold text-amber-600">${d.amount.toFixed(2)}</span></div>)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 하단 탭바 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t border-zinc-100 bg-white/95 backdrop-blur">
        <button onClick={() => setNav('home')} className={`flex-1 py-3 text-center text-xs font-bold ${nav === 'home' ? 'text-brand-700' : 'text-zinc-400'}`}>⭐<div>{t('스탬프', 'Stamps')}</div></button>
        <button onClick={() => setNav('impact')} className={`flex-1 py-3 text-center text-xs font-bold ${nav === 'impact' ? 'text-brand-700' : 'text-zinc-400'}`}>💛<div>{t('나눔 임팩트', 'Impact')}</div></button>
      </nav>

      {/* 내 프로필 — 사진·정보 수정 + 나눔 임팩트 (헤더 아바타 클릭) */}
      {profileOpen && (
        <div className="fixed inset-0 z-[72] mx-auto flex max-w-md flex-col bg-zinc-50">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3">
            <span className="text-base font-black">👤 {t('내 프로필', 'My Profile')}</span>
            <button onClick={() => setProfileOpen(false)} className="text-xl font-bold text-zinc-400">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">
            {/* 사진 — 탭하면 바꾸기 */}
            <section className="ss-card p-5 text-center">
              <label className="inline-block cursor-pointer">
                <input type="file" accept="image/*" className="hidden" disabled={avatarBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} />
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt={profile.name} className={`mx-auto h-24 w-24 rounded-full border-4 border-brand-200 object-cover ${avatarBusy ? 'opacity-50' : ''}`} />
                ) : (
                  <span className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-4xl font-black text-white ${avatarBusy ? 'opacity-50' : ''}`}>{(profile.name || '?').trim().charAt(0).toUpperCase()}</span>
                )}
                <div className="mt-2 text-xs font-bold text-brand-600">{avatarBusy ? t('업로드 중…', 'Uploading…') : t('📷 사진 바꾸기', '📷 Change photo')}</div>
              </label>
            </section>

            {/* 전화번호 인증 — 가입 땐 입력만 받고, 인증(문자 코드)은 여기서. 수정 폼이 열려 있으면 폼 안 UI 사용 */}
            {profile.phone && !phoneVerified && !pfEdit && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-extrabold text-amber-800">📱 {t('전화번호 인증이 필요해요', 'Verify your phone')}</div>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">{t(`${fmtUS(profile.phone)} 로 문자 코드를 보내 확인해요. 가입할 땐 뒤에 기다리는 손님을 위해 입력만 받았어요. 인증하면 친구 선물·기부·캐시 전환을 쓸 수 있어요.`, `We'll text a code to ${fmtUS(profile.phone)}. Verify to unlock gifting, donating, and cash conversion.`)}</p>
                {!vGen ? (
                  <button onClick={sendVerifyCode} disabled={vBusy} className="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{vBusy ? '…' : t('📩 문자로 인증 코드 받기', '📩 Text me a code')}</button>
                ) : (
                  <div className="mt-2">
                    {vTestHint && <div className="mb-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-center text-xs font-bold text-amber-300">{t('테스트 모드 · 코드', 'Test mode · code')}: {vTestHint} <span className="font-medium text-zinc-400">{t('(SMS 연동 전)', '(pre-SMS gateway)')}</span></div>}
                    <div className="flex gap-2">
                      <input value={vCode} onChange={(e) => setVCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="ss-input text-center text-lg font-black tracking-widest" />
                      <button onClick={confirmVerifyCode} disabled={vBusy || vCode.length !== 6} className="ss-btn-primary shrink-0 px-4 disabled:opacity-50">{t('확인', 'Verify')}</button>
                    </div>
                    <button onClick={sendVerifyCode} disabled={vBusy} className="mt-1.5 text-[11px] font-bold text-amber-600">{t('코드 다시 받기', 'Resend code')}</button>
                  </div>
                )}
              </div>
            )}
            {!profile.phone && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-extrabold text-amber-800">📱 {t('전화번호를 등록해 주세요', 'Register your phone')}</div>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">{t('전화번호를 등록·인증하면 다른 폰 로그인, 친구 선물, 기부, 캐시 전환을 쓸 수 있어요.', 'Add and verify your phone to unlock gifting, donating, and cash conversion.')}</p>
                <button onClick={() => setPfEdit(true)} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">{t('지금 등록하기', 'Register now')}</button>
              </div>
            )}

            {/* 프로필 수정 — 처음엔 접혀 있고 클릭하면 펼침 */}
            <section className="ss-card mt-3 p-5">
              <button onClick={() => setPfEdit(!pfEdit)} className="flex w-full items-center justify-between">
                <h3 className="text-base font-extrabold">✏️ {t('프로필 수정', 'Edit profile')}</h3>
                <span className="text-sm font-bold text-zinc-400">{pfEdit ? '▲' : '▼'}</span>
              </button>
              {!pfEdit ? (
                <div className="mt-2 space-y-1 text-sm text-zinc-600">
                  <div>{t('닉네임', 'Nickname')} · <b className="text-zinc-800">{profile.name}</b></div>
                  <div>{t('전화번호', 'Phone')} · <b className="text-zinc-800">{profile.phone ? fmtUS(profile.phone) : <span className="font-bold text-amber-600">{t('미등록', 'Not set')}</span>}</b>{profile.phone && (phoneVerified ? <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">✓ {t('인증됨', 'Verified')}</span> : <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{t('미인증', 'Unverified')}</span>)}</div>
                  <div>{t('비밀번호', 'Password')} · <b className="text-zinc-800">{myPw ? '••••' : t('없음', 'None')}</b></div>
                </div>
              ) : (
                <div className="mt-1">
                  <label className="ss-label">{t('닉네임', 'Nickname')}</label>
                  <input value={pfName} onChange={(e) => setPfName(e.target.value)} className="ss-input" />
                  <label className="ss-label">{t('전화번호', 'Phone')}</label>
                  <input value={pfPhone} onChange={(e) => setPfPhone(fmtUS(e.target.value))} className="ss-input" inputMode="tel" placeholder="000-000-0000" maxLength={14} />
                  {/* 전화 인증 — 폼 안에서 바로 (저장된 번호 기준) */}
                  <div className="mt-1.5">
                    {phoneVerified && normPhone(pfPhone) === normPhone(profile.phone || '') ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">✓ {t('인증됨', 'Verified')}</span>
                    ) : !vGen ? (
                      <button onClick={() => {
                        if (normPhone(pfPhone) !== normPhone(profile.phone || '')) { flash(t('변경한 번호는 먼저 저장한 뒤 인증해 주세요.', 'Save the new number first, then verify.')); return; }
                        sendVerifyCode();
                      }} disabled={vBusy} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{vBusy ? '…' : t('📩 인증하기 (문자 코드)', '📩 Verify (SMS code)')}</button>
                    ) : (
                      <div>
                        {vTestHint && <div className="mb-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-center text-xs font-bold text-amber-300">{t('테스트 모드 · 코드', 'Test mode · code')}: {vTestHint}</div>}
                        <div className="flex gap-2">
                          <input value={vCode} onChange={(e) => setVCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="ss-input text-center font-black tracking-widest" />
                          <button onClick={confirmVerifyCode} disabled={vBusy || vCode.length !== 6} className="ss-btn-primary shrink-0 px-4 disabled:opacity-50">{t('확인', 'Verify')}</button>
                        </div>
                        <button onClick={sendVerifyCode} disabled={vBusy} className="mt-1 text-[11px] font-bold text-amber-600">{t('코드 다시 받기', 'Resend code')}</button>
                      </div>
                    )}
                  </div>
                  <label className="ss-label">{t('비밀번호 (선택)', 'Password (optional)')}</label>
                  <input value={pfPw} onChange={(e) => setPfPw(e.target.value)} type="password" className="ss-input" placeholder={t('설정하면 로그인 때 물어봐요', 'Asked at login if set')} />
                  <label className="ss-label">{t('비밀번호 확인', 'Confirm password')}</label>
                  <input value={pfPw2} onChange={(e) => setPfPw2(e.target.value)} type="password" className="ss-input" placeholder={t('한 번 더 입력', 'Repeat password')} />
                  <button onClick={saveProfile} disabled={busy} className="ss-btn-primary mt-3 w-full disabled:opacity-50">{busy ? '…' : t('저장', 'Save')}</button>
                </div>
              )}
            </section>

            {/* 🔔 알림 받기 — 선물·이벤트 웹푸시 (남발 방지: 매장이 과하게 보내면 여기서 끄면 됨) */}
            <section className="ss-card mt-3 flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="text-base font-extrabold">🔔 {t('알림 받기', 'Notifications')}</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{t('친구 선물·점주 특별 지급·매장 이벤트 소식을 휴대폰 알림으로 받아요. 언제든 끌 수 있어요.', 'Get gifts, bonus stamps, and store events as phone notifications. Toggle off anytime.')}</p>
              </div>
              <button onClick={togglePush} disabled={pushBusy || pushPermission() === 'unsupported'} className={`relative h-7 w-12 shrink-0 rounded-full transition ${pushOn ? 'bg-brand-600' : 'bg-zinc-300'} disabled:opacity-40`}>
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${pushOn ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </section>

            {/* 나눔 임팩트 */}
            <section className="ss-card mt-3 bg-amber-50 p-5 text-center">
              <div className="text-xs font-semibold text-zinc-500">{t('나의 누적 나눔 💛', 'My total giving 💛')}</div>
              <div className="text-3xl font-black text-amber-600">${donated.toFixed(2)}</div>
            </section>
            <section className="ss-card mt-3 p-5">
              <h3 className="text-sm font-extrabold text-brand-700">⏳ {t('만료 스탬프 자동 기부처', 'Auto-donation for expired stamps')}</h3>
              <select value={myNpo?.id || ''} onChange={(e) => saveMyNpo(e.target.value)} className="ss-input mt-2">
                <option value="">{t('지정 안 함 (매장 기본 단체로)', 'No preference (store default)')}</option>
                {globalNpos.map((n) => <option key={n.id} value={n.id}>{n.name}{n.sub ? ` · ${n.sub}` : ''}</option>)}
              </select>
            </section>
            <section className="ss-card mt-3 p-5">
              <h3 className="text-sm font-extrabold text-brand-700">{t('기부 내역', 'Donation history')}</h3>
              {donations.length === 0 ? <p className="mt-2 text-center text-sm text-zinc-400">{t('아직 기부 내역이 없어요.', 'No donations yet.')}</p> : (
                <div className="mt-2 divide-y divide-zinc-100">
                  {donations.map((d, i) => <div key={i} className="flex justify-between py-2.5 text-sm"><span className="text-zinc-600">{d.storeName} → {d.npoName ?? '기부'}</span><span className="font-bold text-amber-600">${d.amount.toFixed(2)}</span></div>)}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* 캐시 사용 시트 — 금액 조절 → 매장에 송금 요청 → 사장 승인 대기 */}
      {useSheet && (
        <Sheet onClose={() => { setUseSheet(false); setUseReq(null); }}>
          {(!useReq) && (
            <div className="text-center">
              <h3 className="text-lg font-black">{t('스탬프 캐시 사용 💳', 'Use stamp cash 💳')}</h3>
              <p className="mt-1 text-sm text-zinc-500">{t('사용할 금액을 정하고 매장에 요청하세요.', 'Set an amount and request at the counter.')}</p>
              <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3 focus-within:border-brand-500">
                <span className="text-2xl font-black text-zinc-400">$</span>
                <input value={useAmount} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); const n = parseFloat(v); setUseAmount(n > balance ? balance.toFixed(2) : v); }} inputMode="decimal" autoFocus className="w-32 bg-transparent text-3xl font-black text-rose-500 outline-none" />
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-2 text-xs">
                <span className="text-zinc-400">{t('잔액', 'Balance')} ${balance.toFixed(2)}</span>
                <button onClick={() => setUseAmount(balance.toFixed(2))} className="rounded-full bg-zinc-100 px-2 py-0.5 font-bold text-zinc-600">{t('전액', 'Full')}</button>
              </div>
              <button onClick={requestCashUse} disabled={useBusy} className="ss-btn-primary mt-4 w-full">{useBusy ? '…' : t('매장에 사용 요청', 'Request to use')}</button>
              <button onClick={() => setUseSheet(false)} className="ss-btn-soft mt-2 w-full">{t('닫기', 'Close')}</button>
            </div>
          )}
          {useReq?.status === 'pending' && (
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <h3 className="mt-3 text-lg font-black">{t('매장 승인 대기 중…', 'Waiting for approval…')}</h3>
              <p className="mt-1 text-sm text-zinc-500">{t('직원에게 화면을 보여주세요.', 'Show this to the staff.')}</p>
              <div className="mt-2 text-3xl font-black text-rose-500">${(parseFloat(useAmount) || 0).toFixed(2)}</div>
              <button onClick={() => { setUseSheet(false); setUseReq(null); }} className="ss-btn-soft mt-4 w-full">{t('닫기', 'Close')}</button>
            </div>
          )}
          {useReq?.status === 'approved' && (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-4xl">✅</div>
              <h3 className="mt-3 text-lg font-black text-emerald-600">{t('사용 승인됐어요!', 'Approved!')}</h3>
              <p className="mt-1 text-sm text-zinc-500">{t('결제 금액에서 할인됐고 잔액에서 차감됐어요.', 'Applied at checkout and deducted from your balance.')}</p>
              <div className="mt-2 text-xl font-black text-zinc-800">{t('남은 잔액', 'Balance')} ${balance.toFixed(2)}</div>
              <button onClick={() => { setUseSheet(false); setUseReq(null); }} className="ss-btn-primary mt-4 w-full">{t('확인', 'Done')}</button>
            </div>
          )}
          {useReq?.status === 'rejected' && (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-4xl">🙅</div>
              <h3 className="mt-3 text-lg font-black text-rose-600">{t('요청이 거절됐어요', 'Request declined')}</h3>
              <p className="mt-1 text-sm text-zinc-500">{t('매장에 문의해 주세요.', 'Please ask the staff.')}</p>
              <button onClick={() => setUseReq(null)} className="ss-btn-soft mt-4 w-full">{t('다시 요청', 'Try again')}</button>
            </div>
          )}
        </Sheet>
      )}

      {/* 선물·기부·적립은 스탬프 카드 버튼 아래 인라인 패널로 이동(바텀시트 제거) */}

      {toast && <Toast t={toast} />}
    </main>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto w-full max-w-md rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" />{children}
      </div>
    </div>
  );
}
function Toast({ t }: { t: string }) {
  return <div className="fixed inset-x-0 bottom-20 z-[60] mx-auto w-fit max-w-[90%] rounded-full bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg">{t}</div>;
}
