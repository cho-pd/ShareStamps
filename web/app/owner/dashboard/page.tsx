'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { SITE_URL } from '@/lib/stores';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, limit } from 'firebase/firestore';

// 옛 OwnerDashboard 구성 차용: [현황] 통계·QR·적립설정·리뷰  +  [매장 편집] 배너·소개·메뉴·SNS.

type Review = { author: string; rating: number; comment: string; createdAt: string };
type MenuItem = { id: string; name: string; price: number; signature?: boolean; description?: string };
type Loaded = {
  storeId: string; storeName: string; slug: string;
  reward: number; interval: number; banner: string; description: string; sns: string[];
  customers: number; activeStamps: number; reviews: Review[]; menu: MenuItem[];
};

const SNS_CHANNELS = ['facebook', 'instagram', 'google', 'tiktok', 'youtube'];

export default function OwnerDashboard() {
  const [slug, setSlug] = useState('');
  const [data, setData] = useState<Loaded | null>(null);
  const [tab, setTab] = useState<'home' | 'edit'>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // form
  const [reward, setReward] = useState('');
  const [interval, setIntervalV] = useState('');
  const [banner, setBanner] = useState('');
  const [desc, setDesc] = useState('');
  const [sns, setSns] = useState<string[]>([]);
  const [newItem, setNewItem] = useState({ name: '', price: '', signature: false });

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    try { const s = localStorage.getItem('ss_owner_store'); if (s) { setSlug(s); load(s); } } catch {}
    // eslint-disable-next-line
  }, []);

  const load = async (s: string) => {
    const target = s.trim(); if (!target) return;
    setBusy(true); setError(null);
    try {
      const db = getDb();
      const storeSnap = await getDocs(query(collection(db, 'stores'), where('slug', '==', target), limit(1)));
      if (storeSnap.empty) { setError('해당 slug의 매장을 찾지 못했어요.'); setData(null); return; }
      const sd = storeSnap.docs[0];
      const st = sd.data() as { name: string; slug: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number; bannerUrl?: string; description?: string; snsChannels?: string[] };
      const [cardsSnap, reviewsSnap, menuSnap] = await Promise.all([
        getDocs(collection(db, 'stores', sd.id, 'stampCards')),
        getDocs(collection(db, 'stores', sd.id, 'reviews')),
        getDocs(collection(db, 'stores', sd.id, 'menuItems')),
      ]);
      const activeStamps = cardsSnap.docs.reduce((s2, d) => s2 + ((d.data().currentStamps as number) || 0), 0);
      const reviews = reviewsSnap.docs.map((d) => d.data() as Review).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const menu = menuSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as MenuItem));
      const rwd = st.pointRewardPer7Stamps ?? 5, itv = st.earningIntervalMinutes ?? 60;
      setData({ storeId: sd.id, storeName: st.name, slug: st.slug, reward: rwd, interval: itv, banner: st.bannerUrl || '', description: st.description || '', sns: st.snsChannels || [], customers: cardsSnap.size, activeStamps, reviews: reviews.slice(0, 5), menu });
      setReward(String(rwd)); setIntervalV(String(itv)); setBanner(st.bannerUrl || ''); setDesc(st.description || ''); setSns(st.snsChannels || []);
      try { localStorage.setItem('ss_owner_store', target); } catch {}
    } catch { setError('불러오기에 실패했어요.'); }
    finally { setBusy(false); }
  };

  const saveStore = async (patch: Record<string, unknown>) => {
    if (!data) return;
    await setDoc(doc(getDb(), 'stores', data.storeId), patch, { merge: true });
    flash('저장됐어요 ✓'); await load(data.slug);
  };

  const addMenu = async () => {
    if (!data || !newItem.name.trim()) return;
    const id = `m_${Date.now()}`;
    await setDoc(doc(getDb(), 'stores', data.storeId, 'menuItems', id), { name: newItem.name.trim(), price: parseFloat(newItem.price) || 0, signature: newItem.signature });
    setNewItem({ name: '', price: '', signature: false }); flash('메뉴 추가됨 ✓'); await load(data.slug);
  };
  const delMenu = async (id: string) => { if (!data) return; await deleteDoc(doc(getDb(), 'stores', data.storeId, 'menuItems', id)); await load(data.slug); };

  const storeUrl = data ? `${SITE_URL}/store/${data.slug}` : '';
  const qr = data ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(storeUrl)}` : '';

  return (
    <main className="mx-auto max-w-xl px-4 pb-24">
      <header className="px-1 pt-6">
        <h1 className="text-2xl font-black tracking-tight">점주 대시보드</h1>
        <p className="mt-0.5 text-sm text-zinc-500">매장 현황·설정·QR·미니홈피를 관리해요.</p>
      </header>

      <form onSubmit={(e) => { e.preventDefault(); load(slug); }} className="mt-4 flex gap-2">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="매장 slug (예: loveletter-fullerton)" className="ss-input flex-1" />
        <button type="submit" disabled={busy} className="ss-btn-primary px-4 py-2.5">{busy ? '…' : '조회'}</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <div className="mt-4 flex gap-1.5">
            <button onClick={() => setTab('home')} className={`flex-1 rounded-full py-2 text-sm font-bold ${tab === 'home' ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>현황</button>
            <button onClick={() => setTab('edit')} className={`flex-1 rounded-full py-2 text-sm font-bold ${tab === 'edit' ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>매장 편집</button>
          </div>

          <h2 className="mt-4 px-1 text-lg font-extrabold">{data.storeName}</h2>

          {tab === 'home' && (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="고객" value={data.customers} />
                <Stat label="적립 스탬프" value={data.activeStamps} />
                <Stat label="리뷰" value={data.reviews.length} />
              </div>

              <section className="ss-card mt-4 p-5 text-center">
                <h3 className="text-base font-extrabold">테이블 QR</h3>
                <p className="mt-1 text-xs text-zinc-500">손님이 찍으면 매장 페이지로 들어와 스탬프·메뉴·샤비를 써요.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="store QR" className="mx-auto mt-3 h-44 w-44 rounded-xl border border-zinc-100" />
                <Link href={`/store/${data.slug}`} className="ss-btn-soft mt-3">매장 페이지 보기</Link>
                <p className="mt-2 break-all text-[11px] text-zinc-400">{storeUrl}</p>
              </section>

              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">적립 설정</h3>
                <label className="ss-label">7개당 보상</label>
                <input value={reward} onChange={(e) => setReward(e.target.value)} className="ss-input" placeholder="5.00" />
                <label className="ss-label">재적립 인터벌 (분)</label>
                <input value={interval} onChange={(e) => setIntervalV(e.target.value)} className="ss-input" placeholder="60" />
                <p className="mt-1 text-[11px] text-zinc-400">예: 240(4시간)이면 점심·저녁 재방문 손님이 각각 적립돼요. 0이면 제한 없음.</p>
                <button onClick={() => saveStore({ pointRewardPer7Stamps: parseFloat(reward) || 0, earningIntervalMinutes: parseInt(interval, 10) || 0 })} className="ss-btn-primary mt-3 w-full">설정 저장</button>
              </section>

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

          {tab === 'edit' && (
            <>
              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">대문 이미지 & 소개</h3>
                {banner && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner} alt="banner" className="mt-2 h-32 w-full rounded-xl object-cover" />
                )}
                <label className="ss-label">대문 이미지 URL (비우면 샘플 자동)</label>
                <input value={banner} onChange={(e) => setBanner(e.target.value)} className="ss-input" placeholder="https://..." />
                <label className="ss-label">한 줄 소개</label>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="ss-input min-h-20" placeholder="매장 소개" />
                <button onClick={() => saveStore({ bannerUrl: banner.trim(), description: desc.trim() })} className="ss-btn-primary mt-3 w-full">대문·소개 저장</button>
                <p className="mt-1 text-[11px] text-zinc-400">* 파일 업로드는 Firebase Storage 규칙 확장 후 붙어요. 지금은 이미지 URL로 즉시 교체 가능.</p>
              </section>

              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">SNS 자동게시 채널</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SNS_CHANNELS.map((ch) => {
                    const on = sns.includes(ch);
                    return (
                      <button key={ch} onClick={() => setSns((p) => on ? p.filter((x) => x !== ch) : [...p, ch])} className={`rounded-full px-3 py-1.5 text-sm font-bold capitalize ${on ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{ch}</button>
                    );
                  })}
                </div>
                <button onClick={() => saveStore({ snsChannels: sns })} className="ss-btn-soft mt-3 w-full">채널 저장</button>
              </section>

              <section className="ss-card mt-4 p-5">
                <h3 className="text-base font-extrabold">메뉴 관리</h3>
                <div className="mt-2 divide-y divide-zinc-100">
                  {data.menu.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2.5">
                      <div className="text-sm"><span className="font-semibold">{m.name}</span>{m.signature && <span className="ml-1.5 rounded bg-honey px-1.5 py-0.5 text-[10px] font-bold text-honey-ink">SIG</span>}</div>
                      <div className="flex items-center gap-3"><span className="text-sm font-bold text-zinc-600">${m.price.toFixed(2)}</span><button onClick={() => delMenu(m.id)} className="text-xs text-red-500">삭제</button></div>
                    </div>
                  ))}
                  {data.menu.length === 0 && <p className="py-2 text-sm text-zinc-400">메뉴가 없어요. 추가해 보세요.</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="ss-input flex-1" placeholder="메뉴명" />
                  <input value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="ss-input w-20" placeholder="$" inputMode="decimal" />
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm text-zinc-600"><input type="checkbox" checked={newItem.signature} onChange={(e) => setNewItem({ ...newItem, signature: e.target.checked })} /> 시그니처</label>
                <button onClick={addMenu} className="ss-btn-primary mt-2 w-full">메뉴 추가</button>
              </section>
            </>
          )}
        </>
      )}

      {toast && <div className="fixed inset-x-0 bottom-5 z-[60] mx-auto w-fit rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
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
