'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
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

export default function MePage() {
  const [profile, setProfile] = useState<{ name: string; phone: string } | null | undefined>(undefined);
  const [nameIn, setNameIn] = useState(''); const [phoneIn, setPhoneIn] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [selId, setSelId] = useState<string>('');
  const [balance, setBalance] = useState(0); const [donated, setDonated] = useState(0);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [nav, setNav] = useState<'home' | 'impact'>('home');
  const [busy, setBusy] = useState(false); const [toast, setToast] = useState<string | null>(null);
  const [donateSheet, setDonateSheet] = useState<Card | null>(null);
  const [giftSheet, setGiftSheet] = useState<Card | null>(null);
  const [useSheet, setUseSheet] = useState(false);
  const [npo, setNpo] = useState(NPOS[0].id);
  const [friendPhone, setFriendPhone] = useState(''); const [giftCount, setGiftCount] = useState(1);

  const flash = (m: string, ms = 3000) => { setToast(m); setTimeout(() => setToast(null), ms); };

  const load = async () => {
    try {
      const db = getDb(); const id = getDeviceId();
      const [cardSnap, custSnap, donSnap] = await Promise.all([
        getDocs(collection(db, 'customers', id, 'cards')),
        getDoc(doc(db, 'customers', id)),
        getDocs(query(collection(db, 'customers', id, 'donations'), orderBy('createdAt', 'desc'), limit(8))).catch(() => null),
      ]);
      const cs = cardSnap.docs.map((d) => d.data() as Card).sort((a, b) => b.currentStamps - a.currentStamps);
      setCards(cs);
      setSelId((prev) => prev && cs.some((c) => c.storeId === prev) ? prev : (cs[0]?.storeId || ''));
      const c = custSnap.exists() ? custSnap.data() : {};
      setBalance((c.balance as number) || 0); setDonated((c.donated as number) || 0);
      setProfile(c.name ? { name: c.name as string, phone: (c.phone as string) || '' } : null);
      setDonations(donSnap ? donSnap.docs.map((d) => d.data() as Donation) : []);
    } catch { setProfile(null); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const signup = async () => {
    if (!nameIn.trim() || normPhone(phoneIn).length < 8) { flash('이름과 전화번호를 입력해 주세요.'); return; }
    setBusy(true);
    try {
      const db = getDb(); const id = getDeviceId(); const phone = normPhone(phoneIn);
      await setDoc(doc(db, 'customers', id), { name: nameIn.trim(), phone }, { merge: true });
      await setDoc(doc(db, 'phoneIndex', phone), { deviceId: id, name: nameIn.trim() }, { merge: true });
      setProfile({ name: nameIn.trim(), phone }); flash(`${nameIn.trim()}님 환영해요! 🐝`);
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
    if (!donateSheet) return; const c = donateSheet; setBusy(true);
    try { const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString(); const v = value(c);
      const n = NPOS.find((x) => x.id === npo)?.name;
      await reset(db, id, c, now); await setDoc(doc(db, 'customers', id), { donated: donated + v }, { merge: true });
      await setDoc(doc(collection(db, 'customers', id, 'donations'), `d_${Date.now()}`), { storeId: c.storeId, storeName: c.storeName, npoName: n, amount: v, currency: c.currency, createdAt: now });
      setDonateSheet(null); flash(`${c.currency} ${v.toFixed(2)} 기부 완료! 💛 ${n}`, 3500); await load();
    } catch { flash('기부 실패'); } finally { setBusy(false); }
  };
  const confirmGift = async () => {
    if (!giftSheet) return; const c = giftSheet; const phone = normPhone(friendPhone);
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
      setGiftSheet(null); setFriendPhone(''); setGiftCount(1);
      flash(`${fName}님께 ${accept}개 선물! 🎁${returned ? ` (초과 ${returned}개 회수)` : ''}`, 4000); await load();
    } catch { flash('선물 실패'); } finally { setBusy(false); }
  };

  const useQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(`ss-redeem:${typeof window !== 'undefined' ? getDeviceId() : ''}:${balance.toFixed(2)}`)}`;
  const clip = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

  // ── 로그인 게이트 ──
  if (profile === undefined) return <main className="mx-auto max-w-md px-4 pt-16 text-center text-sm text-zinc-400">불러오는 중…</main>;
  if (profile === null) {
    return (
      <main className="mx-auto max-w-md px-5 pb-20 pt-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sharbee/sharbee5.png" alt="샤비" className="mx-auto h-24 w-24 rounded-3xl bg-brand-600 object-contain p-2 shadow-lg" />
        <h1 className="mt-4 text-3xl font-black tracking-tight text-brand-700">ShareStamps</h1>
        <p className="mt-1 text-sm text-zinc-500">동네 가게 스탬프를 모으고 친구에게 선물하세요</p>
        <div className="ss-card mt-6 p-5 text-left">
          <label className="ss-label">이름 (닉네임)</label>
          <input value={nameIn} onChange={(e) => setNameIn(e.target.value)} className="ss-input" placeholder="홍길동" />
          <label className="ss-label">전화번호</label>
          <input value={phoneIn} onChange={(e) => setPhoneIn(e.target.value)} className="ss-input" placeholder="010-1234-5678" inputMode="tel" />
          <button onClick={signup} disabled={busy} className="ss-btn-primary mt-3 w-full">{busy ? '…' : '시작하기'}</button>
          <p className="mt-2 text-[11px] text-zinc-400">* 문자 인증은 다음 단계. 지금은 이름·전화로 바로 시작.</p>
        </div>
        {toast && <Toast t={toast} />}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-24">
      {/* 상단바 */}
      <div className="flex items-center justify-between py-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-brand-700">👤 {profile.name}</span>
        <Link href={cards[0] ? `/store/${cards[0].slug}` : '/'} className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white">📷 QR 스캔</Link>
      </div>

      {nav === 'home' && (
        <>
          {/* 매장 선택 */}
          <select value={selId} onChange={(e) => setSelId(e.target.value)} className="ss-input w-full text-center font-bold">
            {cards.length === 0 && <option>매장 없음</option>}
            {cards.map((c) => <option key={c.storeId} value={c.storeId}>{c.storeName}</option>)}
          </select>

          {!sel && (
            <div className="ss-card mt-3 flex items-center gap-3 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sharbee/sharbee5.png" alt="샤비" className="h-11 w-11 shrink-0 object-contain" />
              <div className="flex-1">
                <p className="text-sm font-bold">스탬프 카드 미리보기</p>
                <p className="text-xs text-zinc-500">매장에서 QR을 찍으면 내 카드가 생겨요.</p>
              </div>
              <Link href="/store/loveletter-fullerton" className="ss-chip">둘러보기</Link>
            </div>
          )}
          {(
            <>
              {/* 매장 헤더 */}
              <section className="ss-card mt-3 p-5">
                <div className="flex items-start justify-between">
                  <Link href={`/store/${disp.slug}`} className="text-lg font-black hover:text-brand-700">{disp.storeName} 🔗</Link>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-500">interval: {disp.interval ?? '—'}m</span>
                </div>
                <div className="mt-1 text-sm text-zinc-600">7개 모으면 스탬프 캐시: <strong className="text-rose-500">${disp.reward.toFixed(2)}</strong></div>
                <div className="text-xs text-zinc-500">현재 누적 스탬프 가치: <strong className="text-brand-700">${value(disp).toFixed(2)}</strong></div>
              </section>

              {/* 허니컴 */}
              <section className="ss-card mt-3 bg-brand-50/40 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-brand-700">⭐ 현재 스탬프</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{Math.min(disp.currentStamps, 7)}/7</span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const on = i < Math.min(disp.currentStamps, 7);
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="grid aspect-square w-full place-items-center p-[2px]" style={{ clipPath: clip, background: on ? '#7c3aed' : '#e4e4e7' }}>
                          <div className="grid h-full w-full place-items-center text-[12px] font-extrabold" style={{ clipPath: clip, background: on ? '#7c3aed' : '#fff', color: on ? '#fff' : '#a1a1aa' }}>{on ? '❤️' : i + 1}</div>
                        </div>
                        <span className={`text-[8px] font-bold ${on ? 'text-emerald-500' : 'text-emerald-500/40'}`}>+${unit(disp).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => redeem(disp)} disabled={busy || disp.currentStamps < 1} className="ss-btn-primary px-2 py-2.5 text-sm disabled:opacity-40">적립 전환</button>
                  <button onClick={() => { setGiftSheet(disp); setGiftCount(1); }} disabled={busy || disp.currentStamps < 1} className="ss-btn-soft px-2 py-2.5 text-sm disabled:opacity-40">친구 선물</button>
                  <button onClick={() => setDonateSheet(disp)} disabled={busy || disp.currentStamps < 1} className="ss-chip justify-center py-2.5 text-sm disabled:opacity-40">기부 💛</button>
                </div>
                <Link href={`/store/${disp.slug}`} className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-honey/60 bg-honey/10 py-2.5 text-[13px] font-extrabold text-honey-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sharbee/sharbee5.png" alt="샤비" className="h-5 w-5 object-contain" /> 샤비와 리뷰 쓰고 스탬프 받기
                </Link>
              </section>

              {/* My Stamp Cash Balance */}
              <section className="ss-card mt-3 bg-brand-600 p-5 text-center text-white">
                <div className="text-xs font-semibold text-white/80">내 스탬프 캐시 잔액</div>
                <div className="text-3xl font-black">${balance.toFixed(2)}</div>
                <button onClick={() => setUseSheet(true)} disabled={balance <= 0} className="mt-2 w-full rounded-xl bg-white py-2.5 text-sm font-extrabold text-brand-700 disabled:opacity-50">스탬프 캐시 사용 요청</button>
              </section>

              {/* Stamp Timeline */}
              <section className="ss-card mt-3 p-5">
                <h3 className="text-sm font-extrabold text-brand-700">💬 스탬프 나눔 타임라인</h3>
                {donations.length === 0 ? <p className="mt-2 text-center text-sm text-zinc-400">아직 활동 내역이 없어요.</p> : (
                  <div className="mt-2 space-y-1.5">
                    {donations.map((d, i) => <div key={i} className="flex justify-between text-sm"><span className="text-zinc-600">{d.storeName} → {d.npoName ?? '기부'}</span><span className="font-bold text-amber-600">${d.amount.toFixed(2)}</span></div>)}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Donate to Charity */}
          <section className="ss-card mt-3 p-5">
            <h3 className="text-sm font-extrabold text-brand-700">💛 단체 기부하기</h3>
            <div className="mt-2 space-y-2">
              {NPOS.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                  <div><div className="text-sm font-bold">{n.name}</div><div className="text-[11px] text-zinc-500">{n.sub}</div></div>
                  <button onClick={() => { if (!sel || sel.currentStamps < 1) { flash('스탬프 1개 이상부터 기부 가능해요.'); return; } setNpo(n.id); setDonateSheet(sel); }} className="ss-chip">기부</button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">* 스탬프 1개 이상일 때 선물·기부가 활성화돼요.</p>
          </section>
        </>
      )}

      {nav === 'impact' && (
        <div className="pt-2">
          <section className="ss-card bg-amber-50 p-5 text-center">
            <div className="text-xs font-semibold text-zinc-500">나의 누적 나눔 💛</div>
            <div className="text-3xl font-black text-amber-600">${donated.toFixed(2)}</div>
          </section>
          <section className="ss-card mt-3 p-5">
            <h3 className="text-sm font-extrabold text-brand-700">기부 내역</h3>
            {donations.length === 0 ? <p className="mt-2 text-center text-sm text-zinc-400">아직 기부 내역이 없어요. 스탬프를 NPO에 전해 보세요!</p> : (
              <div className="mt-2 divide-y divide-zinc-100">
                {donations.map((d, i) => <div key={i} className="flex justify-between py-2.5 text-sm"><span className="text-zinc-600">{d.storeName} → {d.npoName ?? '기부'}</span><span className="font-bold text-amber-600">${d.amount.toFixed(2)}</span></div>)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 하단 탭바 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t border-zinc-100 bg-white/95 backdrop-blur">
        <button onClick={() => setNav('home')} className={`flex-1 py-3 text-center text-xs font-bold ${nav === 'home' ? 'text-brand-700' : 'text-zinc-400'}`}>⭐<div>스탬프</div></button>
        <button onClick={() => setNav('impact')} className={`flex-1 py-3 text-center text-xs font-bold ${nav === 'impact' ? 'text-brand-700' : 'text-zinc-400'}`}>💛<div>나눔 임팩트</div></button>
      </nav>

      {/* 시트들 */}
      {useSheet && <Sheet onClose={() => setUseSheet(false)}><div className="text-center"><h3 className="text-lg font-black">스탬프 캐시 사용 💳</h3><p className="mt-1 text-sm text-zinc-500">결제 시 점주에게 보여주세요.</p><div className="mt-2 text-3xl font-black text-rose-500">${balance.toFixed(2)}</div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={useQr} alt="code" className="mx-auto mt-3 h-44 w-44 rounded-xl border border-zinc-100" /><button onClick={() => setUseSheet(false)} className="ss-btn-soft mt-3 w-full">닫기</button></div></Sheet>}

      {giftSheet && <Sheet onClose={() => setGiftSheet(null)}><h3 className="text-lg font-black">친구에게 스탬프 선물 🎁</h3><p className="mt-1 text-sm text-zinc-500">{giftSheet.storeName} 스탬프는 같은 매장 친구 카드로만. (친구 7개 초과분 회수)</p><label className="ss-label">친구 전화번호</label><input value={friendPhone} onChange={(e) => setFriendPhone(e.target.value)} className="ss-input" placeholder="010-..." inputMode="tel" /><label className="ss-label">선물 수량 (보유 {giftSheet.currentStamps})</label><input type="number" min={1} max={giftSheet.currentStamps} value={giftCount} onChange={(e) => setGiftCount(parseInt(e.target.value, 10) || 1)} className="ss-input" /><button onClick={confirmGift} disabled={busy} className="ss-btn-primary mt-3 w-full">{busy ? '보내는 중…' : '선물 보내기'}</button></Sheet>}

      {donateSheet && <Sheet onClose={() => setDonateSheet(null)}><h3 className="text-lg font-black">스탬프 기부하기 💛</h3><p className="mt-1 text-sm text-zinc-500">{donateSheet.storeName} 가치 <strong className="text-brand-700">${value(donateSheet).toFixed(2)}</strong> 기부</p><div className="mt-3 space-y-2">{NPOS.map((n) => <label key={n.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${npo === n.id ? 'border-brand-500 bg-brand-50' : 'border-zinc-200'}`}><input type="radio" name="npo" checked={npo === n.id} onChange={() => setNpo(n.id)} /><span className="text-sm font-semibold">{n.name} <span className="text-zinc-400">· {n.sub}</span></span></label>)}</div><button onClick={confirmDonate} disabled={busy} className="ss-btn-primary mt-4 w-full">{busy ? '기부 중…' : '기부 확정하기'}</button></Sheet>}

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
