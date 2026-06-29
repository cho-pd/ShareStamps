'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/firebase';
import { SITE_URL } from '@/lib/stores';
import { doc, setDoc, onSnapshot, getDocs, query, collection, where, limit } from 'firebase/firestore';

// 태블릿 QR 적립 키오스크 — 옛 src/views/TabletKiosk 흐름 포팅(디자인 새로 다듬음).
// 영수증 촬영 → 동적 QR 생성 → 고객 폰 스캔(/claim) → 토큰 claimed 감지 → 적립 완료 → 카메라 복귀.

type Phase = 'camera' | 'analyzing' | 'qr' | 'success' | 'expired';
type Store = { id: string; name: string; slug: string; kioskPin?: string };

const QR_TTL = 20; // 동적 QR 유효시간(초)
const DEFAULT_PIN = '1234';

export default function OwnerScanPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [phase, setPhase] = useState<Phase>('camera');
  const [token, setToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [shot, setShot] = useState<string | null>(null);
  const [camError, setCamError] = useState(false);
  const [idleSaver, setIdleSaver] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinIn, setPinIn] = useState(''); const [pinErr, setPinErr] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastActivity = useRef(Date.now());
  const tapRef = useRef(0); const tapTimer = useRef<number | null>(null);

  // 매장 로드 (?store=slug → localStorage)
  useEffect(() => {
    let slug = '';
    try { slug = new URLSearchParams(window.location.search).get('store') || localStorage.getItem('ss_owner_store') || ''; } catch {}
    if (!slug) { setNotFound(true); return; }
    (async () => {
      try {
        const snap = await getDocs(query(collection(getDb(), 'stores'), where('slug', '==', slug), limit(1)));
        if (snap.empty) { setNotFound(true); return; }
        const d = snap.docs[0];
        setStore({ id: d.id, name: (d.data().name as string) || slug, slug, kioskPin: (d.data().kioskPin as string) || DEFAULT_PIN });
      } catch { setNotFound(true); }
    })();
  }, []);

  // 카메라 라이프사이클: camera 단계에서만 ON
  useEffect(() => {
    let cancelled = false;
    const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
    const start = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (cancelled) { ms.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = ms; setCamError(false);
        if (videoRef.current) videoRef.current.srcObject = ms;
      } catch { setCamError(true); }
    };
    if (phase === 'camera') start(); else stop();
    return () => { cancelled = true; stop(); };
  }, [phase]);

  // 영수증 촬영 → 분석 → 토큰/QR 생성
  const capture = async () => {
    if (!store) return;
    try {
      const v = videoRef.current;
      if (v && streamRef.current) {
        const c = document.createElement('canvas');
        c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
        setShot(c.toDataURL('image/jpeg', 0.6));
      }
    } catch {}
    setPhase('analyzing');
    window.setTimeout(async () => {
      try {
        const tk = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        await setDoc(doc(getDb(), 'stores', store.id, 'scanTokens', tk), {
          stamps: 1, status: 'pending', createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + QR_TTL * 1000).toISOString(),
        });
        setToken(tk); setShot(null); setPhase('qr'); setCountdown(QR_TTL);
      } catch { reset(); }
    }, 2200);
  };

  // QR 카운트다운
  useEffect(() => {
    if (phase !== 'qr') return;
    if (countdown <= 0) { setPhase('expired'); return; }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, countdown]);

  // 토큰 claimed 실시간 감지
  useEffect(() => {
    if (phase !== 'qr' || !token || !store) return;
    const unsub = onSnapshot(doc(getDb(), 'stores', store.id, 'scanTokens', token), (snap) => {
      if (snap.exists() && snap.data().status === 'claimed') setPhase('success');
    });
    return () => unsub();
  }, [phase, token, store]);

  // success/expired → 자동 복귀
  useEffect(() => {
    if (phase !== 'success' && phase !== 'expired') return;
    const t = window.setTimeout(() => reset(), phase === 'success' ? 3200 : 4000);
    return () => window.clearTimeout(t);
  }, [phase]);

  const reset = () => { setToken(null); setCountdown(0); setShot(null); setPhase('camera'); };

  // 활동 감지 → 유휴 타이머 리셋
  useEffect(() => {
    const onAct = () => { lastActivity.current = Date.now(); };
    window.addEventListener('pointerdown', onAct); window.addEventListener('mousemove', onAct); window.addEventListener('touchstart', onAct);
    return () => { window.removeEventListener('pointerdown', onAct); window.removeEventListener('mousemove', onAct); window.removeEventListener('touchstart', onAct); };
  }, []);
  // 카메라 단계 30초 유휴 → 스크린세이버
  useEffect(() => {
    if (phase !== 'camera') { setIdleSaver(false); return; }
    const iv = window.setInterval(() => { if (Date.now() - lastActivity.current >= 30000) setIdleSaver(true); }, 1000);
    return () => window.clearInterval(iv);
  }, [phase]);
  // 전체화면 상태 동기화
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFs = () => {
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); } catch {}
  };
  // 매장명 3연타 → 사장모드 PIN
  const tapTitle = () => {
    tapRef.current += 1;
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => { tapRef.current = 0; }, 1200);
    if (tapRef.current >= 3) { tapRef.current = 0; setPinIn(''); setPinErr(false); setPinOpen(true); }
  };
  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinIn === (store?.kioskPin || DEFAULT_PIN)) window.location.href = `/owner/dashboard?store=${store?.slug ?? ''}`;
    else setPinErr(true);
  };

  const claimUrl = token && store ? `${SITE_URL}/claim?s=${store.slug}&t=${token}` : '';
  const qrImg = claimUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(claimUrl)}` : '';

  if (notFound) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center text-white">
        <p className="text-lg font-bold">매장을 찾지 못했어요.</p>
        <p className="text-sm text-zinc-400">사장 페이지에서 QR 스캔 모드로 진입해 주세요.</p>
        <Link href="/owner/dashboard" className="mt-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold">← 점주 대시보드</Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-zinc-950 text-white">
      {/* 상단 바 — 키오스크 잠금: 나가기는 매장명 3연타 → PIN */}
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={toggleFs} title="전체화면" className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-bold text-zinc-300 hover:text-white">{isFs ? '⤢ 종료' : '⤢ 전체화면'}</button>
        <div className="text-center">
          <div onClick={tapTitle} className="cursor-pointer select-none text-lg font-black tracking-tight" title="사장님: 3번 탭하면 나가기">{store?.name ?? '…'}</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-brand-400">QR 적립 키오스크</div>
        </div>
        <div className="w-20 text-right text-[10px] text-zinc-600">{phase === 'camera' ? '● 카메라' : phase === 'qr' ? '● QR' : ''}</div>
      </div>

      {/* 본문 카드 */}
      <div className="relative mx-auto mb-6 flex w-full max-w-md flex-1 items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-black">
        {/* 카메라 영상 / 캡처 이미지 (배경) */}
        {phase === 'camera' && !camError && <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />}
        {(phase === 'analyzing') && shot && <img src={shot} alt="receipt" className="absolute inset-0 h-full w-full object-cover opacity-70" />}

        {/* CAMERA */}
        {phase === 'camera' && (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-between p-6">
            <div className="rounded-2xl bg-black/70 px-5 py-3 text-center backdrop-blur">
              <h3 className="text-base font-extrabold">영수증을 비춰 주세요</h3>
              <p className="mt-0.5 text-xs text-zinc-300">촬영하면 적립용 QR이 생성돼요.</p>
            </div>
            {/* 뷰파인더 */}
            <div className="relative flex w-[78%] flex-1 items-center justify-center" style={{ margin: '14px 0' }}>
              <div className="absolute inset-0 rounded-3xl border-2 border-dashed border-white/40" />
              <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-2xl border-l-4 border-t-4 border-brand-500" />
              <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-2xl border-r-4 border-t-4 border-brand-500" />
              <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-2xl border-b-4 border-l-4 border-brand-500" />
              <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-2xl border-b-4 border-r-4 border-brand-500" />
              {camError ? (
                <p className="px-6 text-center text-sm text-zinc-400">카메라를 열 수 없어요.<br />아래 버튼으로 바로 QR을 생성하세요.</p>
              ) : (
                <span className="rounded-lg bg-black/50 px-2 py-1 text-xs font-bold text-white/80">영수증을 사각형에 맞춰주세요</span>
              )}
            </div>
            <button onClick={capture} className="w-full max-w-xs rounded-2xl bg-brand-600 py-4 text-base font-extrabold shadow-lg active:scale-[0.98]">📷 영수증 촬영 &amp; 스탬프 적립</button>
          </div>
        )}

        {/* ANALYZING */}
        {phase === 'analyzing' && (
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-500/30 border-t-brand-500" />
            <p className="rounded-lg bg-black/60 px-3 py-1.5 text-sm font-bold backdrop-blur">영수증 분석 중…</p>
          </div>
        )}

        {/* QR */}
        {phase === 'qr' && (
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-8 text-center">
            <div className="rounded-3xl border-[10px] border-zinc-900 bg-white p-3 shadow-2xl">
              {qrImg && <img src={qrImg} alt="적립 QR" width={240} height={240} className="block h-60 w-60" />}
            </div>
            <div>
              <h4 className="text-xl font-black text-emerald-400">스탬프 1개 적립 가능!</h4>
              <p className="mt-1 text-sm text-zinc-300">휴대폰 카메라로 위 QR을 스캔하세요.</p>
            </div>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full bg-rose-500 transition-all duration-1000 ease-linear" style={{ width: `${(countdown / QR_TTL) * 100}%` }} />
            </div>
            <span className="text-sm font-bold text-rose-400">남은 시간 {countdown}초</span>
            <div className="mt-1 flex items-center gap-3">
              <button onClick={reset} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300">↺ 처음으로</button>
              <a href={claimUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400">폰 스캔 시뮬레이션</a>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {phase === 'success' && (
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-5xl">✅</div>
            <h3 className="text-2xl font-black text-emerald-400">적립 완료!</h3>
            <p className="text-sm text-zinc-300">스탬프가 적립되었습니다.<br />따뜻한 하루 되세요 🐝</p>
          </div>
        )}

        {/* EXPIRED */}
        {phase === 'expired' && (
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
            <div className="text-5xl">⌛</div>
            <h3 className="text-lg font-bold">QR 유효시간이 지났어요</h3>
            <button onClick={reset} className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold">다시 스캔하기</button>
          </div>
        )}
      </div>

      {/* 유휴 스크린세이버 (30초) */}
      {idleSaver && (
        <div onClick={() => { setIdleSaver(false); lastActivity.current = Date.now(); }} className="absolute inset-0 z-[9000] flex cursor-pointer items-center justify-center overflow-hidden bg-zinc-950">
          <div className="flex flex-col items-center gap-3 px-8 text-center" style={{ animation: 'ssfloat 8s ease-in-out infinite' }}>
            <div className="text-6xl">🐝</div>
            <div className="text-3xl font-black text-brand-400">ShareStamps</div>
            <div className="text-sm font-bold text-amber-400">버려지는 스탬프로 따뜻한 기부를</div>
            <div className="mt-2 animate-pulse text-base font-bold text-white">화면을 터치해 영수증을 스캔하세요</div>
            <div className="text-xs text-zinc-500">스캔 즉시 생성되는 QR을 폰으로 찍으면 적립돼요</div>
          </div>
          <style>{`@keyframes ssfloat{0%,100%{transform:translate(-44px,-30px)}25%{transform:translate(46px,22px)}50%{transform:translate(32px,-26px)}75%{transform:translate(-30px,32px)}}`}</style>
        </div>
      )}

      {/* 사장모드 PIN (키오스크 잠금 해제) */}
      {pinOpen && (
        <div className="absolute inset-0 z-[9500] flex items-center justify-center bg-black/80 p-6">
          <form onSubmit={submitPin} className="w-full max-w-xs rounded-3xl bg-white p-7 text-center text-zinc-900">
            <div className="text-base font-extrabold">🔒 사장님 모드 인증</div>
            <p className="mt-1 text-xs text-zinc-500">키오스크를 나가려면 PIN을 입력하세요.</p>
            <input value={pinIn} onChange={(e) => { setPinIn(e.target.value.replace(/[^0-9]/g, '')); setPinErr(false); }} inputMode="numeric" maxLength={6} type="password" placeholder="••••" autoFocus className="mt-4 w-32 rounded-xl border-2 border-zinc-200 px-3 py-2 text-center text-2xl font-black tracking-widest outline-none focus:border-brand-500" />
            {pinErr && <p className="mt-2 text-xs font-bold text-rose-500">PIN이 올바르지 않아요.</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPinOpen(false)} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-bold text-zinc-500">취소</button>
              <button type="submit" className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white">확인</button>
            </div>
            <p className="mt-3 text-[10px] text-zinc-300">기본 PIN 1234 · 매장 설정에서 변경 예정</p>
          </form>
        </div>
      )}
    </div>
  );
}
