'use client';

// 재방문 고객 전용 지름길 배너.
// 랜딩은 서버 컴포넌트라 localStorage를 못 읽으므로, 이 작은 클라이언트 컴포넌트가
// 마운트 후 ss_device_id(= /me를 한 번이라도 연 폰)를 감지해:
//   - 없으면(신규/점주) 아무것도 렌더 안 함 → owner-first 히어로 그대로.
//   - 있으면(단골) 즉시 일반 배너, 이후 Firestore에서 이름·스탬프수 오면 개인화.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export default function StampBanner() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState('');
  const [stamps, setStamps] = useState<number | null>(null);

  useEffect(() => {
    let id = '';
    try { id = localStorage.getItem('ss_device_id') || ''; } catch {}
    if (!id) return; // 신규/점주 방문자 → 배너 없음
    setShow(true); // 재방문자 → 즉시 일반 배너
    (async () => {
      try {
        const db = getDb();
        const [cust, cards] = await Promise.all([
          getDoc(doc(db, 'customers', id)),
          getDocs(collection(db, 'customers', id, 'cards')),
        ]);
        if (cust.exists()) {
          const d = cust.data();
          setName((d.name as string) || '');
          setPhoto((d.photoUrl as string) || '');
        }
        setStamps(cards.docs.reduce((s, c) => s + ((c.data().currentStamps as number) || 0), 0));
      } catch { /* 개인화 실패 → 일반 배너 유지 */ }
    })();
  }, []);

  if (!show) return null;

  const initial = (name || 'ME').trim().charAt(0).toUpperCase();
  return (
    <Link
      href="/me"
      className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-600 px-4 py-3.5 text-white shadow-sm transition active:scale-[0.98]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-base font-black">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold">
          {name ? `${name}님, 내 스탬프 보기` : '내 스탬프 보기'}
        </span>
        <span className="block text-[12.5px] text-white/85">
          {stamps === null ? '내 스탬프 카드로 바로가기' : `지금까지 스탬프 ${stamps}개 모았어요 ⭐`}
        </span>
      </span>
      <span className="shrink-0 text-xl leading-none">›</span>
    </Link>
  );
}
