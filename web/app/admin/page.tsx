'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, collectionGroup } from 'firebase/firestore';

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
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>('kpi');
  const [stores, setStores] = useState<Store[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

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
      } catch { /* noop */ }
      finally { setLoading(false); }
    })();
  }, []);

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
