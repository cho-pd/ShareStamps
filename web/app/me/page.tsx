'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';

// 옛 CustomerPWA 손님 스탬프 페이지 구성: 로그인 · 매장별 7칸 허니컴 카드(하트+칸별가치) ·
// 포인트 잔액/캐시 사용 · 3출구(적립전환·친구선물·NPO기부) · 나눔 타임라인.

const NPOS = [
  { id: 'npo_food', name: '푸드뱅크 (이웃 끼니)' },
  { id: 'npo_animal', name: '유기견 보호센터' },
  { id: 'npo_child', name: '지역 아동센터' },
];

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('ss_device_id');
    if (!id) {
      id = crypto.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('ss_device_id', id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}
const normPhone = (p: string) => p.replace(/[^0-9]/g, '');

type Card = { storeId: string; storeName: string; slug: string; currentStamps: number; reward: number; currency: string };
type Donation = { storeName: string; npoName?: string; amount: number; currency: string; createdAt: string };

function Hex({ filled, num, value }: { filled: boolean; num: number; value: number }) {
  const clip = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid aspect-square w-full place-items-center p-[2px]" style={{ clipPath: clip, background: filled ? 'var(--color-brand-600, #7c3aed)' : '#e4e4e7' }}>
        <div className="grid h-full w-full place-items-center text-[13px] font-extrabold" style={{ clipPath: clip, background: filled ? 'var(--color-brand-600, #7c3aed)' : '#ffffff', color: filled ? '#fff' : '#a1a1aa' }}>
          {filled ? '❤️' : num}
        </div>
      </div>
      <span className={`whitespace-nowrap text-[8px] font-bold tracking-tight ${filled ? 'text-emerald-500' : 'text-emerald-500/40'}`}>+${value.toFixed(2)}</span>
    </div>
  );
}

export default function MePage() {
  const [profile, setProfile] = useState<{ name: string; phone: string } | null | undefined>(undefined);
  const [nameIn, setNameIn] = useState('');
  const [phoneIn, setPhoneIn] = useState('');
  const [cards, setCards] = useState<Card[] | null>(null);
  const [balance, setBalance] = useState(0);
  const [donated, setDonated] = useState(0);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [donateSheet, setDonateSheet] = useState<Card | null>(null);
  const [giftSheet, setGiftSheet] = useState<Card | null>(null);
  const [useSheet, setUseSheet] = useState(false);
  const [npo, setNpo] = useState(NPOS[0].id);
  const [friendPhone, setFriendPhone] = useState('');
  const [giftCount, setGiftCount] = useState(1);

  const flash = (m: string, ms = 3000) => { setToast(m); setTimeout(() => setToast(null), ms); };

  const load = async () => {
    try {
      const db = getDb();
      const id = getDeviceId();
      const [cardSnap, custSnap, donSnap] = await Promise.all([
        getDocs(collection(db, 'customers', id, 'cards')),
        getDoc(doc(db, 'customers', id)),
        getDocs(query(collection(db, 'customers', id, 'donations'), orderBy('createdAt', 'desc'), limit(5))).catch(() => null),
      ]);
      setCards(cardSnap.docs.map((d) => d.data() as Card).sort((a, b) => b.currentStamps - a.currentStamps));
      const c = custSnap.exists() ? custSnap.data() : {};
      setBalance((c.balance as number) || 0);
      setDonated((c.donated as number) || 0);
      setProfile(c.name ? { name: c.name as string, phone: (c.phone as string) || '' } : null);
      setDonations(donSnap ? donSnap.docs.map((d) => d.data() as Donation) : []);
    } catch {
      setCards([]); setProfile(null);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const signup = async () => {
    if (!nameIn.trim() || normPhone(phoneIn).length < 8) { flash('이름과 전화번호를 입력해 주세요.'); return; }
    setBusy(true);
    try {
      const db = getDb();
      const id = getDeviceId();
      const phone = normPhone(phoneIn);
      await setDoc(doc(db, 'customers', id), { name: nameIn.trim(), phone }, { merge: true });
      await setDoc(doc(db, 'phoneIndex', phone), { deviceId: id, name: nameIn.trim() }, { merge: true });
      setProfile({ name: nameIn.trim(), phone });
      flash(`${nameIn.trim()}님 환영해요! 🐝`);
    } catch { flash('가입에 실패했어요.'); }
    finally { setBusy(false); }
  };

  const stampUnit = (card: Card) => card.reward / 7;
  const stampValue = (card: Card) => stampUnit(card) * Math.min(card.currentStamps, 7);

  const reset = async (db: ReturnType<typeof getDb>, id: string, card: Card, now: string) => {
    await setDoc(doc(db, 'stores', card.storeId, 'stampCards', id), { currentStamps: 0, updatedAt: now }, { merge: true });
    await setDoc(doc(db, 'customers', id, 'cards', card.storeId), { currentStamps: 0, updatedAt: now }, { merge: true });
  };

  const redeem = async (card: Card) => {
    setBusy(true);
    try {
      const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString();
      const val = stampValue(card);
      await reset(db, id, card, now);
      await setDoc(doc(db, 'customers', id), { balance: balance + val }, { merge: true });
      flash(`${card.currency} ${val.toFixed(2)} 적립됐어요! 🎉`); await load();
    } catch { flash('처리에 실패했어요.'); }
    finally { setBusy(false); }
  };

  const confirmDonate = async () => {
    if (!donateSheet) return;
    const card = donateSheet; setBusy(true);
    try {
      const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString();
      const val = stampValue(card); const npoName = NPOS.find((n) => n.id === npo)?.name;
      await reset(db, id, card, now);
      await setDoc(doc(db, 'customers', id), { donated: donated + val }, { merge: true });
      await setDoc(doc(collection(db, 'customers', id, 'donations'), `d_${Date.now()}`), {
        storeId: card.storeId, storeName: card.storeName, npoName, amount: val, currency: card.currency, createdAt: now });
      setDonateSheet(null); flash(`${card.currency} ${val.toFixed(2)} 기부 완료! 💛 ${npoName}에 전달돼요.`, 3500); await load();
    } catch { flash('기부에 실패했어요.'); }
    finally { setBusy(false); }
  };

  // 친구 선물: 같은 매장 카드로만, 친구 7개 상한 초과분은 회수
  const confirmGift = async () => {
    if (!giftSheet) return;
    const card = giftSheet;
    const phone = normPhone(friendPhone);
    if (phone.length < 8) { flash('친구 전화번호를 입력해 주세요.'); return; }
    if (phone === profile?.phone) { flash('본인에게는 선물할 수 없어요.'); return; }
    const want = Math.max(1, Math.min(giftCount, card.currentStamps));
    setBusy(true);
    try {
      const db = getDb(); const id = getDeviceId(); const now = new Date().toISOString();
      const idxSnap = await getDoc(doc(db, 'phoneIndex', phone));
      if (!idxSnap.exists()) { flash('친구를 찾지 못했어요. (친구도 /me에서 가입 필요)'); setBusy(false); return; }
      const friendId = idxSnap.data().deviceId as string;
      const friendName = (idxSnap.data().name as string) || '친구';
      // 친구의 같은 매장 카드 현황
      const fCardRef = doc(db, 'stores', card.storeId, 'stampCards', friendId);
      const fSnap = await getDoc(fCardRef);
      const fCur = fSnap.exists() ? ((fSnap.data().currentStamps as number) || 0) : 0;
      const accept = Math.min(want, 7 - fCur); // 친구 7개 상한
      const returned = want - accept;
      if (accept <= 0) { flash(`${friendName}님 카드가 이미 가득 찼어요 (7/7).`); setBusy(false); return; }
      const fNext = fCur + accept;
      // 친구 카드 적립 (매장측 + 친구 지갑)
      await setDoc(fCardRef, { deviceId: friendId, currentStamps: fNext, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', friendId, 'cards', card.storeId),
        { storeId: card.storeId, storeName: card.storeName, slug: card.slug, currentStamps: fNext, reward: card.reward, currency: card.currency, updatedAt: now }, { merge: true });
      // 내 카드 차감 (회수분은 보존)
      const myNext = card.currentStamps - accept;
      await setDoc(doc(db, 'stores', card.storeId, 'stampCards', id), { currentStamps: myNext, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', id, 'cards', card.storeId), { currentStamps: myNext, updatedAt: now }, { merge: true });
      // 선물 기록(타임라인)
      await setDoc(doc(collection(db, 'customers', id, 'gifts'), `g_${Date.now()}`), {
        storeName: card.storeName, toName: friendName, count: accept, createdAt: now });
      setGiftSheet(null); setFriendPhone(''); setGiftCount(1);
      flash(`${friendName}님께 스탬프 ${accept}개 선물! 🎁${returned ? ` (상한 초과 ${returned}개는 회수)` : ''}`, 4000);
      await load();
    } catch { flash('선물에 실패했어요.'); }
    finally { setBusy(false); }
  };

  const useQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(`ss-redeem:${typeof window !== 'undefined' ? getDeviceId() : ''}:${balance.toFixed(2)}`)}`;

  // 로그인 게이트
  if (profile === undefined) return <main className="mx-auto max-w-xl px-4 pt-10 text-center text-sm text-zinc-400">불러오는 중…</main>;
  if (profile === null) {
    return (
      <main className="mx-auto max-w-xl px-4 pb-20">
        <header className="px-1 pt-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sharbee/sharbee5.png" alt="샤비" className="mx-auto h-16 w-16 object-contain" />
          <h1 className="mt-2 text-2xl font-black tracking-tight">내 스탬프 시작하기</h1>
          <p className="mt-1 text-sm text-zinc-500">이름과 전화번호로 스탬프를 모으고 친구에게 선물하세요.</p>
        </header>
        <section className="ss-card mt-5 p-5">
          <label className="ss-label">이름</label>
          <input value={nameIn} onChange={(e) => setNameIn(e.target.value)} className="ss-input" placeholder="홍길동" />
          <label className="ss-label">전화번호</label>
          <input value={phoneIn} onChange={(e) => setPhoneIn(e.target.value)} className="ss-input" placeholder="010-1234-5678" inputMode="tel" />
          <button onClick={signup} disabled={busy} className="ss-btn-primary mt-3 w-full">{busy ? '…' : '시작하기'}</button>
          <p className="mt-2 text-[11px] text-zinc-400">* 문자 인증은 다음 단계에서 붙어요. 지금은 이름·전화로 바로 시작.</p>
        </section>
        {toast && <div className="fixed inset-x-0 bottom-5 z-[60] mx-auto w-fit max-w-[90%] rounded-full bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-24">
      <header className="flex items-end justify-between px-1 pt-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{profile.name}님의 스탬프</h1>
          <p className="mt-0.5 text-sm text-zinc-500">동네 가게에서 모은 스탬프와 나눔이에요 🐝</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="ss-card bg-brand-50/60 p-4">
          <div className="text-xs font-semibold text-zinc-500">포인트 잔액</div>
          <div className="text-2xl font-black text-rose-500">${balance.toFixed(2)}</div>
          <button onClick={() => setUseSheet(true)} disabled={balance <= 0} className="ss-btn-primary mt-2 w-full px-2 py-1.5 text-xs disabled:opacity-40">캐시 사용 (할인 바코드)</button>
        </div>
        <div className="ss-card p-4">
          <div className="text-xs font-semibold text-zinc-500">나눔 누적 💛</div>
          <div className="text-2xl font-black text-amber-600">${donated.toFixed(2)}</div>
          <p className="mt-2 text-[11px] text-zinc-400">기부한 스탬프 가치 합계</p>
        </div>
      </section>

      {cards === null ? (
        <p className="mt-8 text-center text-sm text-zinc-400">불러오는 중…</p>
      ) : cards.length === 0 ? (
        <div className="ss-card mt-4 p-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sharbee/sharbee5.png" alt="샤비" className="mx-auto h-16 w-16 object-contain" />
          <p className="mt-3 font-bold">아직 모은 스탬프가 없어요</p>
          <p className="mt-1 text-sm text-zinc-500">매장에서 QR을 찍고 스탬프를 모아보세요!</p>
          <Link href="/store/loveletter-fullerton" className="ss-btn-soft mt-4">데모 매장 둘러보기</Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {cards.map((card) => {
            const filled = Math.min(card.currentStamps, 7);
            const canUse = card.currentStamps >= 1;
            const val = stampValue(card);
            const unit = stampUnit(card);
            return (
              <section key={card.storeId} className="ss-card p-5">
                <div className="flex items-center justify-between">
                  <Link href={`/store/${card.slug}`} className="font-extrabold hover:text-brand-700">{card.storeName} 🔗</Link>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">⭐ {filled}/7</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  7개당 보상 <strong className="text-rose-500">${card.reward.toFixed(2)}</strong> · 현재 누적가치 <strong className="text-brand-700">${val.toFixed(2)}</strong>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Hex key={i} filled={i < filled} num={i + 1} value={unit} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => redeem(card)} disabled={busy || !canUse} className="ss-btn-primary px-2 py-2.5 text-sm disabled:opacity-40">적립 전환</button>
                  <button onClick={() => { setGiftSheet(card); setGiftCount(1); }} disabled={busy || !canUse} className="ss-btn-soft px-2 py-2.5 text-sm disabled:opacity-40">친구 선물</button>
                  <button onClick={() => setDonateSheet(card)} disabled={busy || !canUse} className="ss-chip justify-center py-2.5 text-sm disabled:opacity-40">기부 💛</button>
                </div>
                <Link href={`/store/${card.slug}`} className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-honey/60 bg-honey/10 py-2.5 text-[13px] font-extrabold text-honey-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sharbee/sharbee5.png" alt="샤비" className="h-5 w-5 object-contain" /> 샤비와 리뷰 쓰고 스탬프 받기
                </Link>
                {!canUse && <p className="mt-2 text-[11px] text-zinc-400">스탬프 1개 이상부터 적립·선물·기부가 가능해요.</p>}
              </section>
            );
          })}
        </div>
      )}

      {donations.length > 0 && (
        <section className="ss-card mt-4 p-5">
          <h2 className="text-base font-extrabold">💬 스탬프 나눔 타임라인</h2>
          <div className="mt-2 space-y-2">
            {donations.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">{d.storeName} → {d.npoName ?? '기부'}</span>
                <span className="font-bold text-amber-600">${d.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 캐시 사용 시트 */}
      {useSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setUseSheet(false)}>
          <div className="w-full rounded-t-3xl bg-white p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" />
            <h3 className="text-lg font-black">캐시 사용 💳</h3>
            <p className="mt-1 text-sm text-zinc-500">결제 시 이 화면을 점주에게 보여주세요.</p>
            <div className="mt-2 text-3xl font-black text-rose-500">${balance.toFixed(2)}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={useQr} alt="redeem code" className="mx-auto mt-3 h-44 w-44 rounded-xl border border-zinc-100" />
            <button onClick={() => setUseSheet(false)} className="ss-btn-soft mt-3 w-full">닫기</button>
          </div>
        </div>
      )}

      {/* 친구 선물 시트 */}
      {giftSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setGiftSheet(null)}>
          <div className="w-full rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" />
            <h3 className="text-lg font-black">친구에게 스탬프 선물 🎁</h3>
            <p className="mt-1 text-sm text-zinc-500">{giftSheet.storeName} 스탬프는 같은 매장 친구 카드로만 보내져요. (친구 7개 초과분은 회수)</p>
            <label className="ss-label">친구 전화번호</label>
            <input value={friendPhone} onChange={(e) => setFriendPhone(e.target.value)} className="ss-input" placeholder="010-..." inputMode="tel" />
            <label className="ss-label">선물 수량 (보유 {giftSheet.currentStamps}개)</label>
            <input type="number" min={1} max={giftSheet.currentStamps} value={giftCount} onChange={(e) => setGiftCount(parseInt(e.target.value, 10) || 1)} className="ss-input" />
            <button onClick={confirmGift} disabled={busy} className="ss-btn-primary mt-3 w-full">{busy ? '보내는 중…' : '선물 보내기'}</button>
          </div>
        </div>
      )}

      {/* 기부 시트 */}
      {donateSheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setDonateSheet(null)}>
          <div className="w-full rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" />
            <h3 className="text-lg font-black">스탬프 기부하기 💛</h3>
            <p className="mt-1 text-sm text-zinc-500">{donateSheet.storeName}의 스탬프 가치 <strong className="text-brand-700">${stampValue(donateSheet).toFixed(2)}</strong>를 기부해요.</p>
            <div className="mt-3 space-y-2">
              {NPOS.map((n) => (
                <label key={n.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${npo === n.id ? 'border-brand-500 bg-brand-50' : 'border-zinc-200'}`}>
                  <input type="radio" name="npo" checked={npo === n.id} onChange={() => setNpo(n.id)} />
                  <span className="text-sm font-semibold">{n.name}</span>
                </label>
              ))}
            </div>
            <button onClick={confirmDonate} disabled={busy} className="ss-btn-primary mt-4 w-full">{busy ? '기부 중…' : '기부 확정하기'}</button>
          </div>
        </div>
      )}

      {toast && <div className="fixed inset-x-0 bottom-5 z-[60] mx-auto w-fit max-w-[90%] rounded-full bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-lg">{toast}</div>}
    </main>
  );
}
