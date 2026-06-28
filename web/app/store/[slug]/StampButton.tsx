'use client';

import { useEffect, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

const DAILY_STAMP_CAP = 6;

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('ss_device_id');
    if (!id) {
      id = (crypto.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`);
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
  intervalMinutes,
  reward,
  currency,
}: {
  storeId: string;
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
        setStamps(snap.exists() ? (snap.data().currentStamps as number) ?? 0 : 0);
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

      // 오늘 적립 내역 (하루 한도 + 인터벌 체크)
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
      // 인터벌: 마지막 적립 이후 경과 분
      if (intervalMinutes > 0 && todayTx.length) {
        const last = todayTx.map((t) => new Date(t.createdAt).getTime()).sort((a, b) => b - a)[0];
        const diffMin = Math.floor((Date.now() - last) / 60000);
        if (diffMin < intervalMinutes) {
          const remain = intervalMinutes - diffMin;
          setMsg(`재적립 대기 중이에요. ${remain}분 후 다시 받을 수 있어요.`);
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

      setStamps(next);
      setMsg(next >= 7 ? `7개 완성! ${currency} ${reward.toFixed(2)} 보상을 받을 수 있어요 🎉` : '스탬프 1개 적립됐어요! ⭐');
    } catch (e) {
      setMsg('적립에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ marginTop: 24, padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#faf8ff' }}>
      <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>내 스탬프</h2>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>
        {stamps === null ? '…' : '⭐'.repeat(stamps) + '☆'.repeat(Math.max(0, 7 - stamps))}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#666', marginLeft: 8 }}>
          {stamps === null ? '' : `${stamps}/7`}
        </span>
      </div>
      <button
        onClick={earn}
        disabled={busy}
        style={{ marginTop: 12, padding: '12px 18px', border: 'none', borderRadius: 10, background: '#6d28d9', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        {busy ? '처리 중…' : '스탬프 적립 (+1)'}
      </button>
      {msg && <p style={{ margin: '10px 0 0', fontSize: 14, color: '#4c1d95', fontWeight: 700 }}>{msg}</p>}
      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#999' }}>7개를 모으면 {currency} {reward.toFixed(2)} 보상.</p>
    </section>
  );
}
