'use client';

import { useEffect, useRef, useState } from 'react';
import { getDb } from '@/lib/firebase';
import { doc, getDoc, setDoc, runTransaction, getDocs, query, collection, where, limit } from 'firebase/firestore';

// 고객 폰: 태블릿 동적 QR(/claim?s=slug&t=token)을 찍으면 들어와 +1 스탬프 자동 적립.
// · 1회용(원자적 트랜잭션 — 2명이 같은 QR 스캔 불가) · 스캔 즉시 "스캔되었습니다" 안내
// · 처음 온 고객이면 닉네임·전화 받고 → 해당 매장 고객페이지(/me?store=slug)로 이동

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('ss_device_id');
    if (!id) { id = crypto.randomUUID?.() ?? `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`; localStorage.setItem('ss_device_id', id); }
    return id;
  } catch { return `dev_${Date.now()}`; }
}
const normPhone = (p: string) => p.replace(/[^0-9]/g, '');

type State = 'working' | 'signup' | 'done' | 'expired' | 'used' | 'error' | 'nostore';

export default function ClaimPage() {
  const [state, setState] = useState<State>('working');
  const [info, setInfo] = useState<{ storeName: string; slug: string; total: number; stamps: number } | null>(null);
  const [nameIn, setNameIn] = useState(''); const [phoneIn, setPhoneIn] = useState(''); const [busy, setBusy] = useState(false);
  const slugRef = useRef('');
  const ran = useRef(false);

  useEffect(() => { if (ran.current) return; ran.current = true; run(); }, []);

  const goCustomer = (slug: string) => { setState('done'); window.setTimeout(() => { window.location.href = `/me?store=${slug}`; }, 1300); };

  const run = async () => {
    try {
      const p = new URLSearchParams(window.location.search);
      const slug = p.get('s') || ''; const token = p.get('t') || '';
      if (!slug || !token) { setState('error'); return; }
      slugRef.current = slug;
      const db = getDb();
      const ss = await getDocs(query(collection(db, 'stores'), where('slug', '==', slug), limit(1)));
      if (ss.empty) { setState('nostore'); return; }
      const sd = ss.docs[0]; const storeId = sd.id;
      const st = sd.data() as { name?: string; currency?: string; pointRewardPer7Stamps?: number; earningIntervalMinutes?: number };
      const id = getDeviceId(); const now = new Date().toISOString();
      const tRef = doc(db, 'stores', storeId, 'scanTokens', token);
      const cardRef = doc(db, 'customers', id, 'cards', storeId);
      const mirrorRef = doc(db, 'stores', storeId, 'stampCards', id);

      let total = 0; let stamps = 1;
      try {
        total = await runTransaction(db, async (tx) => {
          const tSnap = await tx.get(tRef);
          if (!tSnap.exists()) throw new Error('error');
          const t = tSnap.data() as { status?: string; stamps?: number; expiresAt?: string };
          if (t.status === 'claimed') throw new Error('used'); // 이미 다른 폰이 적립함 → 2개 스캔 불가
          if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now()) throw new Error('expired');
          stamps = t.stamps || 1;
          const cardSnap = await tx.get(cardRef);
          const cur = cardSnap.exists() ? ((cardSnap.data().currentStamps as number) || 0) : 0;
          const next = cur + stamps;
          tx.set(cardRef, { storeId, storeName: st.name || slug, slug, currentStamps: next, reward: st.pointRewardPer7Stamps ?? 5, currency: st.currency || 'USD', interval: st.earningIntervalMinutes ?? 60, updatedAt: now }, { merge: true });
          tx.set(mirrorRef, { deviceId: id, currentStamps: next, updatedAt: now }, { merge: true });
          tx.set(tRef, { status: 'claimed', claimedBy: id, claimedAt: now }, { merge: true });
          return next;
        });
      } catch (e) {
        const m = (e as Error).message;
        setState(m === 'used' ? 'used' : m === 'expired' ? 'expired' : 'error');
        return;
      }

      setInfo({ storeName: st.name || slug, slug, total, stamps });
      // 처음 온 고객? (customers/{id}.name 없으면 신규)
      const prof = await getDoc(doc(db, 'customers', id));
      if (prof.exists() && prof.data().name) { goCustomer(slug); return; }
      setState('signup');
    } catch { setState('error'); }
  };

  const submitSignup = async () => {
    if (!nameIn.trim() || normPhone(phoneIn).length < 8) return;
    setBusy(true);
    try {
      const db = getDb(); const id = getDeviceId(); const phone = normPhone(phoneIn);
      await setDoc(doc(db, 'customers', id), { name: nameIn.trim(), phone, role: 'customer' }, { merge: true });
      await setDoc(doc(db, 'phoneIndex', phone), { deviceId: id, name: nameIn.trim() }, { merge: true });
      goCustomer(slugRef.current);
    } catch { setBusy(false); }
  };

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center" style={{ background: '#F2F3F6' }}>{children}</main>
  );

  // 스캔 즉시 안내
  if (state === 'working') return (
    <Wrap>
      <div className="ss-card w-full max-w-sm p-7">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">📷</div>
        <h1 className="mt-4 text-xl font-black text-brand-700">스캔되었습니다!</h1>
        <div className="mx-auto mt-4 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-3 text-sm text-zinc-500">스탬프를 적립하고 있어요…</p>
      </div>
    </Wrap>
  );

  if (state === 'done' && info) {
    const filled = Math.min(info.total, 7);
    return (
      <Wrap>
        <div className="ss-card w-full max-w-sm p-7">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-5xl">🎉</div>
          <h1 className="mt-4 text-2xl font-black text-emerald-600">스탬프 +{info.stamps} 적립!</h1>
          <p className="mt-1 text-sm text-zinc-500">{info.storeName}</p>
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < filled ? 'bg-brand-600 text-white' : 'bg-zinc-200 text-zinc-400'}`}>{i < filled ? '★' : ''}</span>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-zinc-400">고객 페이지로 이동 중…</p>
        </div>
      </Wrap>
    );
  }

  if (state === 'signup' && info) {
    return (
      <Wrap>
        <div className="ss-card w-full max-w-sm p-7">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✅</div>
          <h1 className="mt-3 text-lg font-black text-zinc-800">{info.storeName} 스탬프 +{info.stamps} 적립!</h1>
          <p className="mt-1 text-sm text-zinc-500">처음 오셨네요 🐝 카드를 만들어 드릴게요.</p>
          <div className="mt-5 space-y-3 text-left">
            <div>
              <label className="ss-label">닉네임</label>
              <input value={nameIn} onChange={(e) => setNameIn(e.target.value)} className="ss-input" placeholder="홍길동" autoFocus />
            </div>
            <div>
              <label className="ss-label">전화번호</label>
              <input value={phoneIn} onChange={(e) => setPhoneIn(e.target.value)} className="ss-input" placeholder="000-000-0000" inputMode="tel" />
            </div>
          </div>
          <button onClick={submitSignup} disabled={busy} className="ss-btn-primary mt-5 block w-full py-3 text-center">{busy ? '…' : '카드 만들고 시작하기'}</button>
        </div>
      </Wrap>
    );
  }

  const msg: Record<'expired' | 'used' | 'nostore' | 'error', { icon: string; title: string; desc: string }> = {
    expired: { icon: '⌛', title: 'QR 유효시간이 지났어요', desc: '매장 태블릿에서 다시 영수증을 스캔해 주세요.' },
    used: { icon: '🙅', title: '이미 사용된 QR이에요', desc: '이 QR은 한 번만 적립돼요. 새 QR을 받아 주세요.' },
    nostore: { icon: '🏪', title: '매장을 찾지 못했어요', desc: 'QR을 다시 확인해 주세요.' },
    error: { icon: '⚠️', title: '적립할 수 없어요', desc: 'QR이 올바르지 않거나 만료됐어요. 다시 스캔해 주세요.' },
  };
  const m = msg[state as 'expired' | 'used' | 'nostore' | 'error'];
  return (
    <Wrap>
      <div className="ss-card w-full max-w-sm p-7">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-4xl">{m.icon}</div>
        <h1 className="mt-4 text-lg font-black text-zinc-800">{m.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{m.desc}</p>
        <a href="/me" className="ss-btn-soft mt-6 block w-full py-3 text-center">내 스탬프 카드로</a>
      </div>
    </Wrap>
  );
}
