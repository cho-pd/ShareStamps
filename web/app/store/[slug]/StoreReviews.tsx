'use client';

import { useEffect, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

// 미니홈 리뷰 목록 — 서버(ISR) 초기값으로 시작하되, 마운트 시 Firestore에서 최신으로 갱신.
// 방금 쓴 리뷰가 60초 ISR 캐시를 기다리지 않고 바로 보이게 한다. ('ss-review-added' 이벤트로 즉시 재조회)
type Review = { id: string; author: string; rating: number; comment: string; createdAt: string };

export default function StoreReviews({ storeId, initial }: { storeId: string; initial: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initial);

  useEffect(() => {
    let cancelled = false;
    const fetchReviews = async () => {
      try {
        const snap = await getDocs(collection(getDb(), 'stores', storeId, 'reviews'));
        if (cancelled) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Review, 'id'>) }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReviews(list);
      } catch {}
    };
    fetchReviews();
    const onAdded = () => fetchReviews();
    window.addEventListener('ss-review-added', onAdded);
    return () => { cancelled = true; window.removeEventListener('ss-review-added', onAdded); };
  }, [storeId]);

  if (!reviews.length) return <p className="mt-3 text-sm text-zinc-400">아직 리뷰가 없어요. 첫 리뷰를 남겨보세요 🐝</p>;

  return (
    <div className="mt-3 space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-xl bg-zinc-50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{r.author}</span>
            <span className="text-sm font-bold text-amber-500">★ {r.rating}</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">{r.comment}</p>
        </div>
      ))}
    </div>
  );
}
