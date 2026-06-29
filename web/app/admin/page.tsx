'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, collectionGroup, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { DEFAULT_ADS, type AdBanner } from '@/lib/ads';

// 옛 SuperAdmin(본사 관리자) 구성 차용: 통합 대시보드(KPI) · 매장 관리 · NPO 관리 · 월별 정산 원장 · 회원.
// 새 모델은 매장별 Firestore — 전 매장/회원/기부를 집계해 본사 시점으로 본다.

type Store = { id: string; name: string; slug: string; category: string; pointRewardPer7Stamps?: number };
type Customer = { id: string; name?: string; phone?: string; balance?: number; donated?: number };
type Donation = { storeName?: string; npoName?: string; amount?: number; createdAt?: string };

const TABS = [
  { id: 'kpi', label: '통합 대시보드' },
  { id: 'stores', label: '매장 관리' },
  { id: 'npos', label: 'NPO 관리' },
  { id: 'settlement', label: '월별 정산 원장' },
  { id: 'users', label: '회원' },
  { id: 'ads', label: '광고 배너 관리' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>('kpi');
  const [stores, setStores] = useState<Store[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adCustoms, setAdCustoms] = useState<AdBanner[]>([]);
  const [adHidden, setAdHidden] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false); // 조PD(admin_jopd) 세션
  const [adImg, setAdImg] = useState(''); const [adLink, setAdLink] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const db = getDb();
        const [sSnap, cSnap] = await Promise.all([
          getDocs(collection(db, 'stores')),
          getDocs(collection(db, 'customers')),
        ]);
        setStores(sSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Store)));
        setCustomers(cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Customer)));
        const dSnap = await getDocs(collectionGroup(db, 'donations')).catch(() => null);
        if (dSnap) setDonations(dSnap.docs.map((d) => d.data() as Donation));
        const [adSnap, hidSnap] = await Promise.all([
          getDocs(collection(db, 'adBanners')).catch(() => null),
          getDocs(collection(db, 'adHidden')).catch(() => null),
        ]);
        if (adSnap) setAdCustoms(adSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as AdBanner)));
        if (hidSnap) setAdHidden(new Set(hidSnap.docs.map((d) => d.id)));
        try { setIsAdmin(localStorage.getItem('ss_device_id') === 'admin_jopd'); } catch {}
      } catch { /* noop */ }
      finally { setLoading(false); }
    })();
  }, []);

  const reloadAds = async () => {
    const db = getDb();
    const [adSnap, hidSnap] = await Promise.all([
      getDocs(collection(db, 'adBanners')).catch(() => null),
      getDocs(collection(db, 'adHidden')).catch(() => null),
    ]);
    if (adSnap) setAdCustoms(adSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as AdBanner)));
    setAdHidden(new Set((hidSnap?.docs ?? []).map((d) => d.id)));
  };
  const addAd = async () => {
    if (!adImg.trim()) return;
    await setDoc(doc(getDb(), 'adBanners', `ad_${Date.now()}`), { imageUrl: adImg.trim(), linkUrl: adLink.trim(), status: 'active' });
    setAdImg(''); setAdLink(''); await reloadAds();
  };
  const delAd = async (id: string) => { await deleteDoc(doc(getDb(), 'adBanners', id)); await reloadAds(); };
  const toggleAd = async (a: AdBanner) => { await setDoc(doc(getDb(), 'adBanners', a.id), { status: a.status === 'active' ? 'inactive' : 'active' }, { merge: true }); await reloadAds(); };
  const hideDefault = async (id: string, hide: boolean) => { // 조PD만
    if (hide) await setDoc(doc(getDb(), 'adHidden', id), { hidden: true });
    else await deleteDoc(doc(getDb(), 'adHidden', id));
    await reloadAds();
  };

  const totalDonated = customers.reduce((s, c) => s + (c.donated || 0), 0);
  const totalBalance = customers.reduce((s, c) => s + (c.balance || 0), 0);
  const activeMembers = customers.filter((c) => c.name).length;

  // NPO별 집계
  const byNpo = new Map<string, number>();
  donations.forEach((d) => byNpo.set(d.npoName || '기타', (byNpo.get(d.npoName || '기타') || 0) + (d.amount || 0)));

  return (
    <main className="mx-auto max-w-xl px-4 pb-24">
      <header className="px-1 pt-6">
        <h1 className="text-2xl font-black tracking-tight">본사 관리자</h1>
        <p className="mt-0.5 text-sm text-zinc-500">전 매장 기부 정산 대장·NPO 자금·회원을 원격 감시해요.</p>
      </header>

      {/* 탭 */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold ${tab === t.id ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{t.label}</button>
        ))}
      </div>

      {loading && <p className="mt-8 text-center text-sm text-zinc-400">집계 중…</p>}

      {!loading && tab === 'kpi' && (
        <div className="mt-4 space-y-3">
          <div className="ss-card bg-brand-600 p-5 text-white">
            <div className="text-xs font-semibold text-white/80">플랫폼 총 누적 기부액 💛</div>
            <div className="text-3xl font-black">${totalDonated.toFixed(2)}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="매장" value={stores.length} />
            <Kpi label="적립 활성 회원" value={activeMembers} />
            <Kpi label="미사용 적립금" value={`$${totalBalance.toFixed(0)}`} />
          </div>
          <div className="ss-card p-5">
            <h3 className="text-base font-extrabold">NPO별 기부 분포</h3>
            {byNpo.size === 0 ? <p className="mt-2 text-sm text-zinc-400">아직 기부 내역이 없어요.</p> : (
              <div className="mt-2 space-y-1.5">
                {[...byNpo.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => (
                  <div key={n} className="flex justify-between text-sm"><span className="text-zinc-600">{n}</span><span className="font-bold text-amber-600">${v.toFixed(2)}</span></div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && tab === 'stores' && (
        <div className="mt-4 space-y-2">
          {stores.map((s) => (
            <Link key={s.id} href={`/store/${s.slug}`} className="ss-card flex items-center justify-between p-4">
              <div><div className="font-bold">{s.name}</div><div className="text-xs text-zinc-500">{s.category}</div></div>
              <div className="text-sm font-bold text-brand-700">7개당 ${(s.pointRewardPer7Stamps ?? 5).toFixed(2)}</div>
            </Link>
          ))}
          {stores.length === 0 && <p className="text-center text-sm text-zinc-400">매장이 없어요.</p>}
        </div>
      )}

      {!loading && tab === 'npos' && (
        <div className="mt-4 space-y-2">
          {['푸드뱅크 (이웃 끼니)', '유기견 보호센터', '지역 아동센터'].map((n) => (
            <div key={n} className="ss-card flex items-center justify-between p-4">
              <span className="font-bold">{n}</span>
              <span className="text-sm font-bold text-amber-600">${(byNpo.get(n) || 0).toFixed(2)}</span>
            </div>
          ))}
          <p className="px-1 pt-1 text-[11px] text-zinc-400">NPO 등록/수정은 다음 단계에서 폼으로 붙어요.</p>
        </div>
      )}

      {!loading && tab === 'settlement' && (
        <div className="mt-4">
          <div className="ss-card p-5">
            <h3 className="text-base font-extrabold">매장 → NPO 정산 대장</h3>
            {donations.length === 0 ? <p className="mt-2 text-sm text-zinc-400">정산할 기부 내역이 없어요.</p> : (
              <div className="mt-2 divide-y divide-zinc-100">
                {donations.slice(0, 50).map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-zinc-600">{d.storeName ?? '매장'} → {d.npoName ?? '기부'}</span>
                    <span className="font-bold text-amber-600">${(d.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && tab === 'users' && (
        <div className="mt-4 space-y-2">
          {customers.filter((c) => c.name).map((c) => (
            <div key={c.id} className="ss-card flex items-center justify-between p-4">
              <div><div className="font-bold">{c.name}</div><div className="text-xs text-zinc-500">{c.phone || '—'}</div></div>
              <div className="text-right text-xs"><div className="font-bold text-rose-500">잔액 ${(c.balance || 0).toFixed(2)}</div><div className="text-amber-600">기부 ${(c.donated || 0).toFixed(2)}</div></div>
            </div>
          ))}
          {customers.filter((c) => c.name).length === 0 && <p className="text-center text-sm text-zinc-400">가입 회원이 없어요.</p>}
        </div>
      )}

      {!loading && tab === 'ads' && (
        <div className="mt-4 space-y-4">
          <div className="ss-card p-4">
            <h3 className="text-base font-extrabold">기본 보호 배너</h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">조PD만 숨김/복원할 수 있어요. {isAdmin ? '(조PD 로그인됨 ✓)' : '(/me에서 조PD로 로그인하면 제어 가능)'}</p>
            <div className="mt-2 space-y-2">
              {DEFAULT_ADS.map((a) => {
                const hidden = adHidden.has(a.id);
                return (
                  <div key={a.id} className="rounded-xl border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.title} className="w-full rounded-lg" style={{ aspectRatio: '16/4', objectFit: 'cover' }} />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold">{hidden ? '🚫 숨김' : '🟢 노출중'} <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">기본·보호</span></span>
                      {isAdmin && <button onClick={() => hideDefault(a.id, !hidden)} className="ss-chip">{hidden ? '복원' : '숨기기'}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ss-card p-4">
            <h3 className="text-base font-extrabold">광고 추가</h3>
            <label className="ss-label">이미지 URL (16:4 권장)</label>
            <input value={adImg} onChange={(e) => setAdImg(e.target.value)} className="ss-input" placeholder="https://..." />
            <label className="ss-label">클릭 링크 (선택)</label>
            <input value={adLink} onChange={(e) => setAdLink(e.target.value)} className="ss-input" placeholder="https://... 또는 /me" />
            <button onClick={addAd} className="ss-btn-primary mt-3 w-full">광고 등록</button>
          </div>

          <div className="ss-card p-4">
            <h3 className="text-base font-extrabold">등록된 광고</h3>
            {adCustoms.length === 0 ? <p className="mt-2 text-sm text-zinc-400">아직 등록한 광고가 없어요.</p> : (
              <div className="mt-2 space-y-2">
                {adCustoms.map((a) => (
                  <div key={a.id} className="rounded-xl border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt="ad" className="w-full rounded-lg" style={{ aspectRatio: '16/4', objectFit: 'cover' }} />
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold">{a.status === 'active' ? '🟢 노출중' : '⚪ 비활성'}</span>
                      <div className="flex gap-2">
                        <button onClick={() => toggleAd(a)} className="ss-chip">{a.status === 'active' ? '내리기' : '노출'}</button>
                        <button onClick={() => delAd(a.id)} className="text-xs font-bold text-red-500">삭제</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="ss-card bg-brand-50/60 p-3 text-center">
      <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
      <div className="text-xl font-black text-brand-700">{value}</div>
    </div>
  );
}
