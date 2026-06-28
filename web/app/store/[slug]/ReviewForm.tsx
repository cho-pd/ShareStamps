'use client';

import { useState } from 'react';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { postReviewToSns } from '@/lib/snsApi';

export default function ReviewForm({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [done, setDone] = useState(false);
  const [snsMsg, setSnsMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assistDraft = async () => {
    setAssisting(true);
    setError(null);
    try {
      const prompt = `당신은 "샤비", 손님의 리뷰를 자연스럽고 구체적으로 다듬어주는 도우미예요.
매장: ${storeName}. 손님 별점: ${rating}/5. 손님 메모: "${comment.trim() || '(메모 없음)'}".
위 정보로 1인칭 한국어 리뷰를 2~3문장으로 써주세요.
규칙: 구체적인 메뉴/디테일을 살리고(없으면 자연스러운 일반 표현), 과장된 수식어는 줄이며, 매장 이름을 한 번 자연스럽게 넣으세요. 리뷰 본문만 출력하세요.`;
      const res = await fetch('/api/sharbee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data?.text) setComment(String(data.text).trim());
      else setError('샤비가 잠시 바빠요. 직접 적거나 다시 시도해 주세요.');
    } catch {
      setError('샤비 호출에 실패했어요.');
    } finally {
      setAssisting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (comment.trim().length < 10) return setError('리뷰는 10자 이상 적어 주세요.');
    setBusy(true);
    try {
      const db = getDb();
      const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(collection(db, 'stores', storeId, 'reviews'), id), {
        author: author.trim() || '방문자',
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      });
      const sns = await postReviewToSns({ storeId, content: `${comment.trim()}\n\n📍 ${storeName}`, networks: [] });
      if (sns.success && sns.postedNetworks.length) setSnsMsg(`매장 SNS(${sns.postedNetworks.join(', ')})에도 게시됐어요.`);
      setDone(true);
    } catch {
      setError('등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-3 rounded-xl bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-700">
        리뷰가 등록됐어요! 🎉 곧 매장 페이지·AI 검색에 반영됩니다.
        {snsMsg ? <><br />{snsMsg}</> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="ss-btn-soft mt-3">
        ✍️ 리뷰 쓰기
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-zinc-100 p-4">
      <div className="text-2xl leading-none">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} className="transition active:scale-90">
            {n <= rating ? '⭐' : '☆'}
          </button>
        ))}
      </div>
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="이름(선택)" className="ss-input mt-3" />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="어떤 점이 좋았나요? (키워드만 적어도 샤비가 다듬어줘요)"
        className="ss-input mt-2 min-h-[72px]"
      />
      <button type="button" onClick={assistDraft} disabled={assisting} className="ss-chip mt-2 cursor-pointer border-honey bg-honey/20 text-honey-ink disabled:opacity-60">
        {assisting ? '샤비가 쓰는 중… 🐝' : '✨ 샤비가 리뷰 다듬어줄게요'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="ss-btn-primary mt-3 w-full">
        {busy ? '등록 중…' : '리뷰 등록'}
      </button>
    </form>
  );
}
