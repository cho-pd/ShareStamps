'use client';

import { useEffect, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

const DAILY_STAMP_CAP = 6;

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

function startOfTodayMs(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

export default function StampButton({
  storeId,
  storeName,
  slug,
  intervalMinutes,
  reward,
  currency,
}: {
  storeId: string;
  storeName: string;
  slug: string;
  intervalMinutes: number;
  reward: number;
  currency: string;
}) {
  const [stamps, setStamps] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const snap = await getDoc(doc(db, 'stores', storeId, 'stampCards', getDeviceId()));
        setStamps(snap.exists() ? ((snap.data().currentStamps as number) ?? 0) : 0);
      } catch {
        setStamps(0);
      }
    })();
  }, [storeId]);

  const earn = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const db = getDb();
      const deviceId = getDeviceId();
      const txCol = collection(db, 'stores', storeId, 'stampTx');
      const todaySnap = await getDocs(query(txCol, where('deviceId', '==', deviceId)));
      const todayStart = startOfTodayMs();
      const todayTx = todaySnap.docs
        .map((d) => d.data() as { createdAt: string; amount: number })
        .filter((t) => new Date(t.createdAt).getTime() >= todayStart);
      const dailyTotal = todayTx.reduce((s, t) => s + (t.amount || 0), 0);

      if (dailyTotal >= DAILY_STAMP_CAP) {
        setMsg('오늘은 이 매장 스탬프를 다 받으셨어요 😊 내일 또 와주세요!');
        return;
      }
      if (intervalMinutes > 0 && todayTx.length) {
        const last = todayTx.map((t) => new Date(t.createdAt).getTime()).sort((a, b) => b - a)[0];
        const diffMin = Math.floor((Date.now() - last) / 60000);
        if (diffMin < intervalMinutes) {
          setMsg(`재적립 대기 중이에요. ${intervalMinutes - diffMin}분 후 다시 받을 수 있어요.`);
          return;
        }
      }

      const cardRef = doc(db, 'stores', storeId, 'stampCards', deviceId);
      const cardSnap = await getDoc(cardRef);
      const current = cardSnap.exists() ? ((cardSnap.data().currentStamps as number) ?? 0) : 0;
      const next = current >= 7 ? 7 : current + 1;
      const now = new Date().toISOString();
      await setDoc(cardRef, { deviceId, currentStamps: next, updatedAt: now }, { merge: true });
      await setDoc(doc(txCol, `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`), {
        deviceId,
        source: 'visit',
        amount: 1,
        createdAt: now,
      });
      // 손님 지갑(여러 매장 모아보기)용 비정규화 기록
      await setDoc(
        doc(db, 'customers', deviceId, 'cards', storeId),
        { storeId, storeName, slug, currentStamps: next, reward, currency, updatedAt: now },
        { merge: true }
      );
      setStamps(next);
      setMsg(next >= 7 ? `7개 완성! ${currency} ${reward.toFixed(2)} 보상을 받을 수 있어요 🎉` : '스탬프 1개 적립됐어요! ⭐');
    } catch {
      setMsg('적립에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const filled = stamps ?? 0;

  return (
    <section className="ss-card bg-brand-50/60 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold">내 스탬프</h2>
        <span className="text-xs font-bold text-zinc-400">{stamps === null ? '' : `${filled}/7`}</span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-full text-base ${
              i < filled ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-zinc-300 ring-1 ring-zinc-200'
            }`}
          >
            {i < filled ? '⭐' : '○'}
          </div>
        ))}
      </div>
      <button onClick={earn} disabled={busy} className="ss-btn-primary mt-4 w-full">
        {busy ? '처리 중…' : '스탬프 적립 +1'}
      </button>
      {msg && <p className="mt-2.5 text-sm font-semibold text-brand-700">{msg}</p>}
      <p className="mt-2 text-xs text-zinc-400">
        7개를 모으면 {currency} {reward.toFixed(2)} 보상.
      </p>
    </section>
  );
}
