'use client';

import { useEffect, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { DEFAULT_ADS, type AdBanner } from '@/lib/ads';

// 옛 상단 광고 배너 복원: 16:4, 15초 자동순환, AD 배지, 클릭 시 링크 이동.
// 노출 = 디폴트 보호배너(숨김 제외) + Firestore 커스텀 배너(active).
export default function AdBannerSlot() {
  const [ads, setAds] = useState<AdBanner[]>(DEFAULT_ADS.filter((a) => a.status === 'active'));
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [custSnap, hidSnap] = await Promise.all([
          getDocs(collection(db, 'adBanners')).catch(() => null),
          getDocs(collection(db, 'adHidden')).catch(() => null),
        ]);
        const hidden = new Set((hidSnap?.docs ?? []).map((d) => d.id));
        const customs = (custSnap?.docs ?? [])
          .map((d) => ({ id: d.id, ...(d.data() as object) }) as AdBanner)
          .filter((a) => a.status === 'active');
        const defaults = DEFAULT_ADS.filter((a) => a.status === 'active' && !hidden.has(a.id));
        const list = [...defaults, ...customs];
        if (list.length) setAds(list);
      } catch { /* 디폴트 유지 */ }
    })();
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % ads.length), 15000);
    return () => clearInterval(t);
  }, [ads.length]);

  if (!ads.length) return null;
  const ad = ads[idx % ads.length];

  const inner = (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 4' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={ad.id} src={ad.imageUrl} alt={ad.title ?? '광고 배너'} className="h-full w-full object-cover" />
      <span className="absolute bottom-1.5 right-2 rounded bg-black/35 px-1 text-[8px] font-bold tracking-wide text-white/85">AD</span>
    </div>
  );

  if (!ad.linkUrl) return inner;
  const external = /^https?:\/\//.test(ad.linkUrl);
  return external ? (
    <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block active:opacity-95">{inner}</a>
  ) : (
    <a href={ad.linkUrl} className="block active:opacity-95">{inner}</a>
  );
}
