'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';

// 점주 시작 — 매장은 본사가 사전 등록(영업 시). 사장은 자기 매장을 찾아 이름·비번으로 신청 → 본사 승인 → 입장.
// (매장 등록 폼은 본사 콘솔로 이동. 여기선 등록하지 않는다.)

type S = { id: string; name: string; slug: string; ownerStatus?: string; ownerName?: string; ownerPassword?: string };

export default function OwnerStartPage() {
  const [stores, setStores] = useState<S[]>([]);
  const [mode, setMode] = useState<'claim' | 'login'>('claim');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<S | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'form' | 'waiting' | 'approved'>('form');

  useEffect(() => {
    (async () => {
      try { const snap = await getDocs(collection(getDb(), 'stores')); setStores(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as S))); } catch {}
    })();
  }, []);

  const reset = () => { setPicked(null); setQ(''); setOwnerName(''); setPw(''); setPw2(''); setErr(''); };
  const switchMode = (m: 'claim' | 'login') => { setMode(m); reset(); };

  // 검색 풀: 신청=사장 미지정 매장만, 로그인=승인된 매장만
  const pool = stores.filter((s) => (mode === 'claim' ? !s.ownerStatus : s.ownerStatus === 'approved'));
  const results = !picked && q.trim() ? pool.filter((s) => (s.name || '').toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];

  // 승인 실시간 감지
  useEffect(() => {
    if (stage !== 'waiting' || !picked) return;
    const unsub = onSnapshot(doc(getDb(), 'stores', picked.id), (snap) => {
      if (snap.exists() && snap.data().ownerStatus === 'approved') setStage('approved');
    });
    return () => unsub();
  }, [stage, picked]);

  const enter = (slug: string) => { try { localStorage.setItem('ss_owner_store', slug); } catch {} window.location.href = `/owner/dashboard?store=${slug}`; };

  const submitClaim = async () => {
    setErr('');
    if (!picked) { setErr('매장을 선택해 주세요.'); return; }
    if (!ownerName.trim()) { setErr('사장님 이름을 입력해 주세요.'); return; }
    if (pw.length < 4) { setErr('비밀번호는 4자 이상이에요.'); return; }
    if (pw !== pw2) { setErr('비밀번호가 일치하지 않아요.'); return; }
    setBusy(true);
    try {
      await setDoc(doc(getDb(), 'stores', picked.id), {
        ownerName: ownerName.trim(), ownerPassword: pw, ownerStatus: 'pending', ownerVerified: false, ownerClaimedAt: new Date().toISOString(),
      }, { merge: true });
      try { localStorage.setItem('ss_owner_pending', picked.slug); } catch {}
      setStage('waiting');
    } catch { setErr('신청에 실패했어요. 다시 시도해 주세요.'); } finally { setBusy(false); }
  };

  const submitLogin = () => {
    setErr('');
    if (!picked) { setErr('매장을 선택해 주세요.'); return; }
    const s = stores.find((x) => x.id === picked.id);
    if (!s || s.ownerStatus !== 'approved') { setErr('아직 본사 승인 전이에요.'); return; }
    if ((s.ownerPassword || '') !== pw) { setErr('비밀번호가 올바르지 않아요.'); return; }
    enter(s.slug);
  };

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10" style={{ background: '#F2F3F6' }}>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );

  // 승인 대기 / 승인 완료
  if (stage === 'waiting') return (
    <Wrap>
      <div className="ss-card p-7 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">⏳</div>
        <h1 className="mt-4 text-xl font-black">본사 승인 대기 중</h1>
        <p className="mt-2 text-sm text-zinc-500"><b className="text-zinc-700">{picked?.name}</b> 매장 신청이 본사로 전달됐어요.<br />승인되면 자동으로 다음 단계로 넘어가요.</p>
        <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
        <p className="mt-5 text-xs text-zinc-400">이 창을 열어두셔도 되고, 승인 후 다시 점주 로그인 하셔도 돼요.</p>
      </div>
    </Wrap>
  );
  if (stage === 'approved') return (
    <Wrap>
      <div className="ss-card p-7 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-5xl">🎉</div>
        <h1 className="mt-4 text-2xl font-black text-emerald-600">승인 완료!</h1>
        <p className="mt-2 text-sm text-zinc-500"><b className="text-zinc-700">{picked?.name}</b> 점주로 인증됐어요.</p>
        <button onClick={() => enter(picked!.slug)} className="ss-btn-primary mt-6 block w-full py-3 text-center">사장 페이지로 입장 →</button>
      </div>
    </Wrap>
  );

  return (
    <Wrap>
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-black tracking-tight">👨‍🍳 점주 시작하기</h1>
        <p className="mt-1 text-sm text-zinc-500">본사에 등록된 매장을 찾아 점주 인증을 받으세요.</p>
      </div>

      {/* 모드 토글 */}
      <div className="mb-4 flex rounded-full bg-zinc-200/70 p-1 text-sm font-bold">
        <button onClick={() => switchMode('claim')} className={`flex-1 rounded-full py-2 ${mode === 'claim' ? 'bg-white text-brand-700 shadow' : 'text-zinc-500'}`}>매장 신청</button>
        <button onClick={() => switchMode('login')} className={`flex-1 rounded-full py-2 ${mode === 'login' ? 'bg-white text-brand-700 shadow' : 'text-zinc-500'}`}>점주 로그인</button>
      </div>

      <div className="ss-card p-6">
        {/* 매장 검색/선택 */}
        <label className="ss-label">매장 이름</label>
        {picked ? (
          <div className="mt-1 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
            <span className="font-bold text-brand-700">🏪 {picked.name}</span>
            <button onClick={() => { setPicked(null); setQ(''); }} className="text-xs font-bold text-zinc-400 hover:text-zinc-600">변경</button>
          </div>
        ) : (
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} className="ss-input" placeholder="첫 글자만 입력해도 검색돼요 (한/영)" autoFocus />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                {results.map((s) => (
                  <button key={s.id} onClick={() => { setPicked(s); setErr(''); }} className="block w-full px-3 py-2.5 text-left text-sm font-semibold hover:bg-zinc-50">🏪 {s.name}</button>
                ))}
              </div>
            )}
            {q.trim() && results.length === 0 && (
              <p className="mt-1.5 text-xs text-zinc-400">{mode === 'claim' ? '검색 결과 없음 — 본사 사전 등록 매장만 신청할 수 있어요. (이미 점주가 지정된 매장은 안 보여요)' : '승인된 매장이 없어요.'}</p>
            )}
          </div>
        )}

        {/* 신청 폼 */}
        {mode === 'claim' && (
          <>
            <label className="ss-label mt-4">사장님 이름</label>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="ss-input" placeholder="홍길동" />
            <label className="ss-label mt-4">비밀번호</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="ss-input" placeholder="4자 이상" />
            <label className="ss-label mt-4">비밀번호 확인</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="ss-input" placeholder="다시 입력" />
            {err && <p className="mt-3 text-sm font-semibold text-rose-500">{err}</p>}
            <button onClick={submitClaim} disabled={busy} className="ss-btn-primary mt-5 block w-full py-3 text-center">{busy ? '신청 중…' : '점주 인증 신청'}</button>
            <p className="mt-2 text-center text-[11px] text-zinc-400">제출하면 본사에 승인 요청이 전달돼요.</p>
          </>
        )}

        {/* 로그인 폼 */}
        {mode === 'login' && (
          <>
            <label className="ss-label mt-4">비밀번호</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="ss-input" placeholder="점주 비밀번호" onKeyDown={(e) => { if (e.key === 'Enter') submitLogin(); }} />
            {err && <p className="mt-3 text-sm font-semibold text-rose-500">{err}</p>}
            <button onClick={submitLogin} className="ss-btn-primary mt-5 block w-full py-3 text-center">사장 페이지 입장</button>
          </>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-zinc-400">매장이 아직 등록 안 됐나요? <Link href="/" className="font-bold text-brand-600">본사에 문의</Link></p>
    </Wrap>
  );
}
