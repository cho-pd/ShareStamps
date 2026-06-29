'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import AdBannerSlot from './AdBanner';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';

// 옛 CustomerPWA 대시보드 구성 그대로: 상단바(닉네임·QR스캔) · 매장 선택 드롭다운 ·
// 매장 헤더(7-stamp Cash·누적가치·인터벌) · 허니컴(번호/하트+칸별가치) · My Stamp Cash Balance(+Request) ·
// Stamp Timeline · Donate to Charity · 하단탭(스탬프 / 나눔 임팩트).

const NPOS = [
  { id: 'npo_save', name: '세이브더칠드런', sub: '어린이 급식 지원' },
  { id: 'npo_green', name: '그린피스', sub: '기후 위기 대응' },
  { id: 'npo_kara', name: 'KARA', sub: '동물권 행동' },
];

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('ss_device_id');
    if (!id) { id = crypto.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`; localStorage.setItem('ss_device_id', id); }
    return id;
  } catch { return `dev_${Date.now()}`; }
}
const normPhone = (p: string) => p.replace(/[^0-9]/g, '');

type Card = { storeId: string; storeName: string; slug: string; currentStamps: number; reward: number; currency: string; interval?: number };
type Donation = { storeName?: string; npoName?: string; amount: number; currency: string; createdAt: string };

// 스탬프 카드가 없을 때도 허니컴 구조를 보여주는 미리보기(예시) 카드 — 옛 'Unassigned' 빈 카드처럼.
const DEMO: Card = { storeId: 'demo', storeName: '스탬프 카드 미리보기', slug: 'loveletter-fullerton', currentStamps: 0, reward: 5, currency: 'USD', interval: 60 };

// 종합관리자 조PD & ShareStamps 기본 카드(무조건 3개) — ShareStamps 매장만.
const ADMIN_PHONE = '2132564820'; // 213-256-4820
const SS_CARD: Card = { storeId: 'store_sharestamps', storeName: 'ShareStamps', slug: 'sharestamps', currentStamps: 3, reward: 5, currency: 'USD', interval: 60 };

export default function MePage() {
  const [profile, setProfile] = useState<{ name: string; phone: string } | null | undefined>(undefined);
  const [nameIn, setNameIn] = useState(''); const [phoneIn, setPhoneIn] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [selId, setSelId] = useState<string>('');
  const [balance, setBalance] = useState(0); const [donated, setDonated] = useState(0);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [nav, setNav] = useState<'home' | 'impact'>('home');
  const [busy, setBusy] = useState(false); const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<'redeem' | 'gift' | 'donate' | null>(null); // 버튼 바로 아래 인라인 패널
  const [useSheet, setUseSheet] = useState(false);
  const [npo, setNpo] = useState(NPOS[0].id);
  const [friendPhone, setFriendPhone] = useState(''); const [giftCount, setGiftCount] = useState(1);
  const [lang, setLang] = useState<'ko' | 'en'>('ko');

  useEffect(() => { try { const l = localStorage.getItem('ss_lang'); if (l === 'en' || l === 'ko') setLang(l); } catch {} }, []);
  const toggleLang = () => { const n = lang === 'ko' ? 'en' : 'ko'; setLang(n); try { localStorage.setItem('ss_lang', n); } catch {} };
  const t = (ko: string, en: string) => (lang === 'ko' ? ko : en);

  const flash = (m: string, ms = 3000) => { setToast(m); setTimeout(() => setToast(null), ms); };

  const load = async () => {
    try {
      const db = getDb(); const id = getDeviceId();
      const [cardSnap, custSnap, donSnap] = await Promise.all([
        getDocs(collection(db, 'customers', id, 'cards')),
        getDoc(doc(db, 'customers', id)),
        getDocs(query(collection(db, 'customers', id, 'donations'), orderBy('createdAt', 'desc'), limit(8))).catch(() => null),
      ]);
      let cs = cardSnap.docs.map((d) => d.data() as Card);
      // ShareStamps 기본 카드(무조건 3개) 보장 — 그 매장만
      if (!cs.some((c) => c.storeId === SS_CARD.storeId)) {
        cs = [{ ...SS_CARD }, ...cs];
        const now = new Date().toISOString();
        setDoc(doc(db, 'customers', id, 'cards', SS_CARD.storeId), { ...SS_CARD, updatedAt: now }, { merge: true }).catch(() => {});
        setDoc(doc(db, 'stores', SS_CARD.storeId, 'stampCards', id), { deviceId: id, currentStamps: SS_CARD.currentStamps, updatedAt: now }, { merge: true }).catch(() => {});
      }
      cs.sort((a, b) => b.currentStamps - a.currentStamps);
      setCards(cs);
      setSelId((prev) => prev && cs.some((c) => c.storeId === prev) ? prev : (cs[0]?.storeId || ''));
      const c = custSnap.exists() ? custSnap.data() : {};
      setBalance((c.balance as number) || 0); setDonated((c.donated as number) || 0);
      setProfile(c.name ? { name: c.name as string, phone: (c.phone as string) || '' } : null);
      setDonations(donSnap ? donSnap.docs.map((d) => d.data() as Donation) : []);
      ensureDefaults(db); // 조PD 종합관리자 기본 회원 보장(브라우저당 1회)
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
  const unit = (c: Card) => c.reward / 7;
  const value = (c: Card) => unit(c) * Math.min(c.currentStamps, 7);

  const reset = async (db: ReturnType<typeof getDb>, id: string, c: Card, now: string) => {
    await setDoc(doc(db, 'stores', c.storeId, 'stampCards', id), { currentStamps: 0, updatedAt: now }, { merge: true });
    await setDoc(doc(db, 'customers', id, 'cards', c.storeId), { currentStamps: 0, updatedAt: now }, { merge: true });
  };
  const redeem = async (c: Card) => {
    setBusy(true);
    try { const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString(); const v = value(c);
      await reset(db, id, c, now); await setDoc(doc(db, 'customers', id), { balance: balance + v }, { merge: true });
      flash(`${c.currency} ${v.toFixed(2)} 적립 전환! 🎉`); await load();
    } catch { flash('처리 실패'); } finally { setBusy(false); }
  };
  const confirmDonate = async () => {
    const c = disp; if (c.currentStamps < 1) return; setBusy(true);
    try { const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString(); const v = value(c);
      const n = NPOS.find((x) => x.id === npo)?.name;
      await reset(db, id, c, now); await setDoc(doc(db, 'customers', id), { donated: donated + v }, { merge: true });
      await setDoc(doc(collection(db, 'customers', id, 'donations'), `d_${Date.now()}`), { storeId: c.storeId, storeName: c.storeName, npoName: n, amount: v, currency: c.currency, createdAt: now });
      setPanel(null); flash(`${c.currency} ${v.toFixed(2)} 기부 완료! 💛 ${n}`, 3500); await load();
    } catch { flash('기부 실패'); } finally { setBusy(false); }
  };
  const confirmGift = async () => {
    const c = disp; const phone = normPhone(friendPhone);
    if (phone.length < 8) { flash('친구 전화번호를 입력해 주세요.'); return; }
    if (phone === profile?.phone) { flash('본인에게는 선물할 수 없어요.'); return; }
    const want = Math.max(1, Math.min(giftCount, c.currentStamps)); setBusy(true);
    try {
      const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString();
      const idx = await getDoc(doc(db, 'phoneIndex', phone));
      if (!idx.exists()) { flash('친구를 찾지 못했어요. (친구도 가입 필요)'); setBusy(false); return; }
      const fId = idx.data().deviceId as string; const fName = (idx.data().name as string) || '친구';
      const fRef = doc(db, 'stores', c.storeId, 'stampCards', fId); const fSnap = await getDoc(fRef);
      const fCur = fSnap.exists() ? ((fSnap.data().currentStamps as number) || 0) : 0;
      const accept = Math.min(want, 7 - fCur); const returned = want - accept;
      if (accept <= 0) { flash(`${fName}님 카드가 가득 찼어요 (7/7).`); setBusy(false); return; }
      const fNext = fCur + accept;
      await setDoc(fRef, { deviceId: fId, currentStamps: fNext, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', fId, 'cards', c.storeId), { storeId: c.storeId, storeName: c.storeName, slug: c.slug, currentStamps: fNext, reward: c.reward, currency: c.currency, updatedAt: now }, { merge: true });
      const myNext = c.currentStamps - accept;
      await setDoc(doc(db, 'stores', c.storeId, 'stampCards', id), { currentStamps: myNext, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', id, 'cards', c.storeId), { currentStamps: myNext, updatedAt: now }, { merge: true });
      setPanel(null); setFriendPhone(''); setGiftCount(1);
      flash(`${fName}님께 ${accept}개 선물! 🎁${returned ? ` (초과 ${returned}개 회수)` : ''}`, 4000); await load();
    } catch { flash('선물 실패'); } finally { setBusy(false); }
  };

  const useQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(`ss-redeem:${typeof window !== 'undefined' ? getDeviceId() : ''}:${balance.toFixed(2)}`)}`;
  const clip = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

  // ── 로그인 게이트 ──
  if (profile === undefined) return <main className="mx-auto max-w-md px-4 pt-16 text-center text-sm text-zinc-400">불러오는 중…</main>;
  if (profile === null) {
    return (
      <main className="mx-auto max-w-md px-5 pb-20 pt-6 text-center">
        <div className="flex justify-end"><button onClick={toggleLang} className="rounded-full bg-zinc-100 px-2.5 py-1.5 text-xs font-bold text-zinc-600">🌐 {lang === 'ko' ? 'KO' : 'EN'}</button></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sharbee/sharbee5.png" alt="샤비" className="mx-auto mt-2 h-24 w-24 rounded-3xl bg-brand-600 object-contain p-2 shadow-lg" />
        <h1 className="mt-4 text-3xl font-black tracking-tight text-brand-700">ShareStamps</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('동네 가게 스탬프를 모으고 친구에게 선물하세요', 'Collect local stamps and gift them to friends')}</p>

        {/* 가입 전에도 허니컴 미리보기 — 친구 추천으로 처음 온 손님이 보고 시작하게 */}
        <section className="ss-card mt-6 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-brand-700">⭐ {t('이렇게 스탬프를 모아요', 'How stamps work')}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">0/7</span>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="grid aspect-square w-full place-items-center p-[2px]" style={{ clipPath: clip, background: '#e4e4e7' }}>
                  <div className="grid h-full w-full place-items-center text-[12px] font-extrabold" style={{ clipPath: clip, background: '#fff', color: '#a1a1aa' }}>{i + 1}</div>
                </div>
                <span className="text-[8px] font-bold text-emerald-500/40">+$0.71</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-zinc-500">{t('7개를 모으면 현금 보상 💰 · 기부·친구 선물도 돼요 💛', 'Collect 7 for cash 💰 · or donate & gift 💛')}</p>
        </section>

        <div className="ss-card mt-3 p-5 text-left">
          <label className="ss-label">{t('이름 (닉네임)', 'Name (nickname)')}</label>
          <input value={nameIn} onChange={(e) => setNameIn(e.target.value)} className="ss-input" placeholder={t('홍길동', 'Your name')} />
          <label className="ss-label">{t('전화번호', 'Phone number')}</label>
          <input value={phoneIn} onChange={(e) => setPhoneIn(e.target.value)} className="ss-input" placeholder="010-1234-5678" inputMode="tel" />
          <button onClick={signup} disabled={busy} className="ss-btn-primary mt-3 w-full">{busy ? '…' : t('시작하기', 'Get started')}</button>
          <p className="mt-2 text-[11px] text-zinc-400">{t('* 문자 인증은 다음 단계. 지금은 이름·전화로 바로 시작.', '* SMS verification comes later. Start now with name & phone.')}</p>
        </div>
        {toast && <Toast t={toast} />}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-24">
      {/* 상단바 */}
      <div className="flex items-center justify-between pt-3 pb-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-brand-700">👤 {profile.name}</span>
        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className="rounded-full bg-zinc-100 px-2.5 py-1.5 text-xs font-bold text-zinc-600">🌐 {lang === 'ko' ? 'KO' : 'EN'}</button>
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
              <section className="ss-card mt-3 overflow-hidden p-0 ring-2 ring-brand-200">
                <div className="p-5 pb-3 text-center">
                  <Link href={`/store/${disp.slug}`} className="group inline-flex items-center gap-1.5 text-2xl font-black transition hover:text-brand-700" title={t('미니홈피 보기', 'View mini-home')}>
                    {disp.storeName}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 animate-pulse text-zinc-400 transition group-hover:animate-none group-hover:text-brand-600 group-active:text-brand-600 motion-reduce:animate-none">
                      <path d="M5 19 19 5M9 5h10v10" />
                    </svg>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-zinc-600">
                    <span>{t('7개 모으면', 'Collect 7 →')} <strong className="text-rose-500">${disp.reward.toFixed(2)}</strong> · {t('누적', 'now')} <strong className="text-brand-700">${value(disp).toFixed(2)}</strong></span>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-500">{disp.interval ?? '—'}m</span>
                  </div>
                </div>
                <div className="border-t border-zinc-100 bg-brand-50/50 p-5">
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const on = i < Math.min(disp.currentStamps, 7);
                      return (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="grid aspect-square w-full place-items-center p-[2px]" style={{ clipPath: clip, background: on ? '#7c3aed' : '#ddd6fe' }}>
                            <div className="grid h-full w-full place-items-center text-[15px] font-black" style={{ clipPath: clip, background: on ? '#7c3aed' : '#ffffff', color: on ? '#fff' : '#a78bfa' }}>{on ? '❤️' : i + 1}</div>
                          </div>
                          <span className={`text-[8px] font-bold ${on ? 'text-emerald-500' : 'text-emerald-400/60'}`}>+${unit(disp).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* 액션: 0개여도 또렷하게(흐림 X), 누르면 안내 */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button onClick={() => setPanel(panel === 'redeem' ? null : 'redeem')} disabled={busy} className={`rounded-xl border py-3 text-sm font-bold text-rose-600 transition active:scale-[0.98] ${panel === 'redeem' ? 'border-rose-400 bg-rose-50' : 'border-rose-200 bg-white'}`}>{t('적립 전환', 'Redeem')}</button>
                    <button onClick={() => setPanel(panel === 'gift' ? null : 'gift')} disabled={busy} className={`rounded-xl border py-3 text-sm font-bold text-brand-700 transition active:scale-[0.98] ${panel === 'gift' ? 'border-brand-500 bg-brand-50' : 'border-brand-200 bg-white'}`}>{t('친구 선물', 'Gift')}</button>
                    <button onClick={() => setPanel(panel === 'donate' ? null : 'donate')} disabled={busy} className={`rounded-xl border py-3 text-sm font-bold text-amber-700 transition active:scale-[0.98] ${panel === 'donate' ? 'border-amber-400 bg-amber-100' : 'border-amber-300 bg-amber-50'}`}>{t('기부', 'Donate')} 💛</button>
                  </div>

                  {/* 버튼 바로 아래 인라인 패널 — 적립/선물/기부 같은 스타일 */}
                  {panel && (
                    <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="-mt-1 mb-1 flex justify-end"><button onClick={() => setPanel(null)} className="text-xs font-bold text-zinc-400">✕</button></div>
                      {panel === 'redeem' && (disp.currentStamps < 7 ? (
                        <div className="text-center">
                          <p className="text-sm font-bold text-zinc-700">{t('적립은 스탬프 7개가 모아져야 합니다.', 'You need all 7 stamps to redeem.')}</p>
                          <p className="mt-1 text-xs text-zinc-500">{t('현재', 'Now')} {disp.currentStamps}/7</p>
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
                          <input value={friendPhone} onChange={(e) => setFriendPhone(e.target.value)} className="ss-input mt-2" placeholder={t('친구 전화번호', "Friend's phone")} inputMode="tel" />
                          <input type="number" min={1} max={disp.currentStamps} value={giftCount} onChange={(e) => setGiftCount(parseInt(e.target.value, 10) || 1)} className="ss-input mt-2" />
                          <button onClick={confirmGift} disabled={busy} className="ss-btn-primary mt-2 w-full">{busy ? '…' : t('선물 보내기', 'Send gift')}</button>
                        </div>
                      ))}
                      {panel === 'donate' && (disp.currentStamps < 1 ? (
                        <p className="text-center text-sm text-zinc-500">{t('스탬프 1개 이상부터 기부할 수 있어요.', 'Need at least 1 stamp to donate.')}</p>
                      ) : (
                        <div>
                          <p className="text-sm font-bold">{t('어디에 기부할까요? 💛', 'Donate to? 💛')} <span className="text-zinc-400">(${value(disp).toFixed(2)})</span></p>
                          <div className="mt-2 space-y-1.5">
                            {NPOS.map((n) => (
                              <label key={n.id} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 ${npo === n.id ? 'border-brand-500 bg-brand-50' : 'border-zinc-200'}`}>
                                <input type="radio" name="npo2" checked={npo === n.id} onChange={() => setNpo(n.id)} />
                                <span className="text-sm font-semibold">{n.name} <span className="text-[11px] text-zinc-400">· {n.sub}</span></span>
                              </label>
                            ))}
                          </div>
                          <button onClick={confirmDonate} disabled={busy} className="ss-btn-primary mt-2 w-full">{busy ? '…' : t('기부 확정하기', 'Confirm donation')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* 샤비와 리뷰 — 독립 카드 */}
              <Link href={`/store/${disp.slug}`} className="ss-card mt-3 flex items-center gap-3 border border-honey/60 bg-honey/20 p-4 active:scale-[0.99]">
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
                <button onClick={() => setUseSheet(true)} disabled={balance <= 0} className="ss-chip disabled:opacity-50">{t('캐시 사용', 'Use cash')}</button>
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
            <h3 className="text-sm font-extrabold text-brand-700">💛 {t('단체 기부하기', 'Donate to charity')}</h3>
            <div className="mt-2 space-y-2">
              {NPOS.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                  <div><div className="text-sm font-bold">{n.name}</div><div className="text-[11px] text-zinc-500">{n.sub}</div></div>
                  <button onClick={() => { if (!sel || sel.currentStamps < 1) { flash(t('스탬프 1개 이상부터 기부 가능해요.', 'Need at least 1 stamp to donate.')); return; } setNpo(n.id); setPanel('donate'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="ss-chip">{t('기부', 'Donate')}</button>
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

      {/* 시트들 */}
      {useSheet && <Sheet onClose={() => setUseSheet(false)}><div className="text-center"><h3 className="text-lg font-black">{t('스탬프 캐시 사용 💳', 'Use stamp cash 💳')}</h3><p className="mt-1 text-sm text-zinc-500">{t('결제 시 점주에게 보여주세요.', 'Show this to the owner at checkout.')}</p><div className="mt-2 text-3xl font-black text-rose-500">${balance.toFixed(2)}</div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={useQr} alt="code" className="mx-auto mt-3 h-44 w-44 rounded-xl border border-zinc-100" /><button onClick={() => setUseSheet(false)} className="ss-btn-soft mt-3 w-full">{t('닫기', 'Close')}</button></div></Sheet>}

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
