'use client';

import { useEffect, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';

type Stats = {
  storeName: string;
  slug: string;
  customers: number;
  activeStamps: number;
  reviewCount: number;
  avgRating: number;
  recentReviews: { author: string; rating: number; comment: string; createdAt: string }[];
};

export default function OwnerDashboard() {
  const [slug, setSlug] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ss_owner_store');
      if (saved) { setSlug(saved); load(saved); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (s: string) => {
    const target = s.trim();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const db = getDb();
      const storeSnap = await getDocs(query(collection(db, 'stores'), where('slug', '==', target), limit(1)));
      if (storeSnap.empty) { setError('해당 slug의 매장을 찾지 못했어요.'); setStats(null); return; }
      const storeDoc = storeSnap.docs[0];
      const store = storeDoc.data() as { name: string; slug: string };

      const [cardsSnap, reviewsSnap] = await Promise.all([
        getDocs(collection(db, 'stores', storeDoc.id, 'stampCards')),
        getDocs(collection(db, 'stores', storeDoc.id, 'reviews')),
      ]);

      const activeStamps = cardsSnap.docs.reduce((sum, d) => sum + ((d.data().currentStamps as number) || 0), 0);
      const reviews = reviewsSnap.docs
        .map((d) => d.data() as Stats['recentReviews'][number])
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const avg = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;

      setStats({
        storeName: store.name,
        slug: store.slug,
        customers: cardsSnap.size,
        activeStamps,
        reviewCount: reviews.length,
        avgRating: avg,
        recentReviews: reviews.slice(0, 5),
      });
      try { localStorage.setItem('ss_owner_store', target); } catch {}
    } catch {
      setError('불러오기에 실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>점주 대시보드</h1>
      <form onSubmit={(e) => { e.preventDefault(); load(slug); }} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="매장 slug (예: loveletter-fullerton)" style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 }} />
        <button type="submit" disabled={busy} style={{ padding: '10px 16px', border: 'none', borderRadius: 8, background: '#6d28d9', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{busy ? '…' : '조회'}</button>
      </form>
      {error && <p style={{ color: '#c00', marginTop: 12 }}>{error}</p>}

      {stats && (
        <>
          <h2 style={{ fontSize: 20, marginTop: 24 }}>{stats.storeName}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
            <Stat label="고객(스탬프카드)" value={stats.customers} />
            <Stat label="적립된 스탬프 합계" value={stats.activeStamps} />
            <Stat label="리뷰 수" value={stats.reviewCount} />
            <Stat label="평균 별점" value={stats.reviewCount ? stats.avgRating.toFixed(1) : '—'} />
          </div>

          <h3 style={{ fontSize: 16, marginTop: 24 }}>최근 리뷰</h3>
          {stats.recentReviews.length === 0 && <p style={{ color: '#777' }}>아직 리뷰가 없어요.</p>}
          {stats.recentReviews.map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f2f2f2' }}>
              <div style={{ fontWeight: 700 }}>{r.author} — ★ {r.rating}</div>
              <div style={{ color: '#444', fontSize: 14 }}>{r.comment}</div>
            </div>
          ))}

          <p style={{ marginTop: 20 }}>
            <a href={`/store/${stats.slug}`} style={{ color: '#6d28d9', fontWeight: 700 }}>→ 내 매장 페이지 보기</a>
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ padding: 14, border: '1px solid #eee', borderRadius: 12, background: '#faf8ff' }}>
      <div style={{ fontSize: 12, color: '#777' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#4c1d95' }}>{value}</div>
    </div>
  );
}
