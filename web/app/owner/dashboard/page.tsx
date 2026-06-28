'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { SITE_URL } from '@/lib/stores';
import { collection, getDocs, doc, getDoc, setDoc, query, where, limit } from 'firebase/firestore';

type Review = { author: string; rating: number; comment: string; createdAt: string };
type Loaded = {
  storeId: string;
  storeName: string;
  slug: string;
  reward: number;
  interval: number;
  customers: number;
  activeStamps: number;
  reviews: Review[];
};

export default function OwnerDashboard() {
  const [slug, setSlug] = useState('');
  const [data, setData] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState('');
  const [interval, setIntervalV] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('ss_owner_store');
      if (s) { setSlug(s); load(s); }
    } catch {}
    // eslint-disable-next-line
  }, []);

  const load = async (s: string) => {
    const target = s.trim();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const db = getDb();
      const storeSnap = await getDocs(query(collection(db, 'stores'), where('slug', '==', target), limit(1)));
      if (storeSnap.empty) { setError('해당 slug의 매장을 찾지 못했어요.'); setData(null); return; }
      const sd = storeSnap.docs[0];
      const store = sd.data() as { name: string; slug: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number };
      const [cardsSnap, reviewsSnap] = await Promise.all([
        getDocs(collection(db, 'stores', sd.id, 'stampCards')),
        getDocs(collection(db, 'stores', sd.id, 'reviews')),
      ]);
      const activeStamps = cardsSnap.docs.reduce((s2, d) => s2 + ((d.data().currentStamps as number) || 0), 0);
      const reviews = reviewsSnap.docs
        .map((d) => d.data() as Review)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const rwd = store.pointRewardPer7Stamps ?? 5;
      const itv = store.earningIntervalMinutes ?? 60;
      setData({ storeId: sd.id, storeName: store.name, slug: store.slug, reward: rwd, interval: itv, customers: cardsSnap.size, activeStamps, reviews: reviews.slice(0, 5) });
      setReward(String(rwd));
      setIntervalV(String(itv));
      try { localStorage.setItem('ss_owner_store', target); } catch {}
    } catch {
      setError('불러오기에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!data) return;
    setSaved(false);
    try {
      const db = getDb();
      await setDoc(doc(db, 'stores', data.storeId), {
        pointRewardPer7Stamps: parseFloat(reward) || 0,
        earningIntervalMinutes: parseInt(interval, 10) || 0,
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError('저장 실패'); }
  };

  const storeUrl = data ? `${SITE_URL}/store/${data.slug}` : '';
  const qr = data ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(storeUrl)}` : '';

  return (
    <main className="mx-auto max-w-xl px-4 pb-20">
      <header className="px-1 pt-6">
        <h1 className="text-2xl font-black tracking-tight">점주 대시보드</h1>
        <p className="mt-0.5 text-sm text-zinc-500">매장 현황·설정·QR을 관리해요.</p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); load(slug); }} className="mt-4 flex gap-2">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="매장 slug (예: loveletter-fullerton)" className="ss-input flex-1" />
        <button type="submit" disabled={busy} className="ss-btn-primary px-4 py-2.5">{busy ? '…' : '조회'}</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <h2 className="mt-5 px-1 text-lg font-extrabold">{data.storeName}</h2>

          {/* 통계 */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="고객" value={data.customers} />
            <Stat label="적립 스탬프" value={data.activeStamps} />
            <Stat label="리뷰" value={data.reviews.length} />
          </div>

          {/* QR (손님 진입) */}
          <section className="ss-card mt-4 p-5 text-center">
            <h3 className="text-base font-extrabold">테이블 QR</h3>
            <p className="mt-1 text-xs text-zinc-500">손님이 찍으면 매장 페이지로 들어와 스탬프·메뉴·샤비를 써요.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="store QR" className="mx-auto mt-3 h-44 w-44 rounded-xl border border-zinc-100" />
            <Link href={`/store/${data.slug}`} className="ss-btn-soft mt-3">매장 페이지 보기</Link>
            <p className="mt-2 break-all text-[11px] text-zinc-400">{storeUrl}</p>
          </section>

          {/* 설정: 보상 + 인터벌 */}
          <section className="ss-card mt-4 p-5">
            <h3 className="text-base font-extrabold">적립 설정</h3>
            <label className="ss-label">7개당 보상 ({data.storeName} 화폐)</label>
            <input value={reward} onChange={(e) => setReward(e.target.value)} className="ss-input" placeholder="5.00" />
            <label className="ss-label">재적립 인터벌 (분) — 같은 손님 재적립 최소 간격</label>
            <input value={interval} onChange={(e) => setIntervalV(e.target.value)} className="ss-input" placeholder="60" />
            <p className="mt-1 text-[11px] text-zinc-400">예: 240(4시간)이면 점심·저녁 재방문 손님이 각각 적립돼요. 0이면 제한 없음.</p>
            <button onClick={saveSettings} className="ss-btn-primary mt-3 w-full">{saved ? '저장됨 ✓' : '설정 저장'}</button>
          </section>

          {/* 최근 리뷰 */}
          <section className="ss-card mt-4 p-5">
            <h3 className="text-base font-extrabold">최근 리뷰</h3>
            {data.reviews.length === 0 && <p className="mt-2 text-sm text-zinc-400">아직 리뷰가 없어요.</p>}
            <div className="mt-2 space-y-2">
              {data.reviews.map((r, i) => (
                <div key={i} className="rounded-xl bg-zinc-50 p-3">
                  <div className="flex justify-between text-sm font-bold"><span>{r.author}</span><span className="text-amber-500">★ {r.rating}</span></div>
                  <p className="mt-0.5 text-sm text-zinc-600">{r.comment}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="ss-card bg-brand-50/60 p-3 text-center">
      <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
      <div className="text-xl font-black text-brand-700">{value}</div>
    </div>
  );
}
