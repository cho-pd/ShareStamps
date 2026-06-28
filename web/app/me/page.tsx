'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

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

type Card = { storeId: string; storeName: string; slug: string; currentStamps: number; reward: number; currency: string };

export default function MePage() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [balance, setBalance] = useState(0);
  const [donated, setDonated] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const db = getDb();
      const id = getDeviceId();
      const [cardSnap, custSnap] = await Promise.all([
        getDocs(collection(db, 'customers', id, 'cards')),
        getDoc(doc(db, 'customers', id)),
      ]);
      setCards(cardSnap.docs.map((d) => d.data() as Card).sort((a, b) => b.currentStamps - a.currentStamps));
      const c = custSnap.exists() ? custSnap.data() : {};
      setBalance((c.balance as number) || 0);
      setDonated((c.donated as number) || 0);
    } catch {
      setCards([]);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const redeemOrDonate = async (card: Card, kind: 'redeem' | 'donate') => {
    setBusy(card.storeId + kind);
    try {
      const db = getDb();
      const id = getDeviceId();
      const now = new Date().toISOString();
      // 카드 리셋 (매장측 + 손님 지갑측)
      await setDoc(doc(db, 'stores', card.storeId, 'stampCards', id), { currentStamps: 0, updatedAt: now }, { merge: true });
      await setDoc(doc(db, 'customers', id, 'cards', card.storeId), { currentStamps: 0, updatedAt: now }, { merge: true });
      // 손님 잔액/기부 누적
      await setDoc(doc(db, 'customers', id), kind === 'redeem' ? { balance: increment(card.reward) } : { donated: increment(card.reward) }, { merge: true }).catch(async () => {
        await updateDoc(doc(db, 'customers', id), kind === 'redeem' ? { balance: increment(card.reward) } : { donated: increment(card.reward) });
      });
      if (kind === 'donate') {
        await setDoc(doc(collection(db, 'customers', id, 'donations'), `d_${Date.now()}`), {
          storeId: card.storeId, storeName: card.storeName, amount: card.reward, currency: card.currency, createdAt: now,
        });
      }
      setToast(kind === 'redeem' ? `${card.currency} ${card.reward.toFixed(2)} 적립됐어요! 🎉` : `${card.currency} ${card.reward.toFixed(2)} 기부 완료! 따뜻한 마음 고마워요 💛`);
      await load();
    } catch {
      setToast('처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 pb-20">
      <header className="px-1 pt-6">
        <h1 className="text-2xl font-black tracking-tight">내 스탬프</h1>
        <p className="mt-0.5 text-sm text-zinc-500">동네 가게에서 모은 스탬프와 보상이에요.</p>
      </header>

      {/* 요약 */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="ss-card bg-brand-50/60 p-4">
          <div className="text-xs font-semibold text-zinc-500">적립 보상</div>
          <div className="text-2xl font-black text-brand-700">${balance.toFixed(2)}</div>
        </div>
        <div className="ss-card p-4">
          <div className="text-xs font-semibold text-zinc-500">기부 누적 💛</div>
          <div className="text-2xl font-black text-amber-600">${donated.toFixed(2)}</div>
        </div>
      </section>

      {/* 카드들 */}
      {cards === null ? (
        <p className="mt-8 text-center text-sm text-zinc-400">불러오는 중…</p>
      ) : cards.length === 0 ? (
        <div className="ss-card mt-4 p-8 text-center">
          <div className="text-4xl">🐝</div>
          <p className="mt-3 font-bold">아직 모은 스탬프가 없어요</p>
          <p className="mt-1 text-sm text-zinc-500">매장에서 QR을 찍고 스탬프를 모아보세요!</p>
          <Link href="/store/loveletter-fullerton" className="ss-btn-soft mt-4">데모 매장 둘러보기</Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {cards.map((card) => {
            const filled = Math.min(card.currentStamps, 7);
            const full = card.currentStamps >= 7;
            return (
              <section key={card.storeId} className="ss-card p-5">
                <div className="flex items-center justify-between">
                  <Link href={`/store/${card.slug}`} className="font-extrabold hover:text-brand-700">{card.storeName}</Link>
                  <span className="text-xs font-bold text-zinc-400">{filled}/7</span>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className={`flex aspect-square items-center justify-center rounded-full text-sm ${i < filled ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-300'}`}>
                      {i < filled ? '⭐' : '○'}
                    </div>
                  ))}
                </div>
                {full ? (
                  <div className="mt-4">
                    <p className="text-sm font-bold text-brand-700">7개 완성! {card.currency} {card.reward.toFixed(2)} 보상을 쓰세요</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button onClick={() => redeemOrDonate(card, 'redeem')} disabled={!!busy} className="ss-btn-primary px-2 py-2.5 text-sm">적립</button>
                      <button onClick={() => redeemOrDonate(card, 'donate')} disabled={!!busy} className="ss-btn-soft px-2 py-2.5 text-sm">기부 💛</button>
                      <button onClick={() => setToast('선물하기는 곧 열려요 🎁')} disabled={!!busy} className="ss-chip justify-center py-2.5 text-sm">선물</button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-400">{7 - filled}개 더 모으면 {card.currency} {card.reward.toFixed(2)} 보상!</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-5 z-50 mx-auto w-fit rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
