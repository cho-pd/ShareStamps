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

  // 샤비가 손님 메모/별점으로 AEO 친화적 리뷰 초안을 다듬어준다 (구체성·브랜드명·밀도·유창성).
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

      // 매장 연동 SNS 채널에 자동 게시 (best-effort, 실패해도 리뷰 등록은 유지)
      const sns = await postReviewToSns({
        storeId,
        content: `${comment.trim()}\n\n📍 ${storeName}`,
        networks: [],
      });
      if (sns.success && sns.postedNetworks.length) {
        setSnsMsg(`매장 SNS(${sns.postedNetworks.join(', ')})에도 게시됐어요.`);
      }
      setDone(true);
    } catch {
      setError('등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p style={{ marginTop: 12, padding: 12, background: '#ecfdf5', borderRadius: 10, color: '#065f46', fontWeight: 700 }}>
        리뷰가 등록됐어요! 🎉 곧 매장 페이지·AI 검색에 반영됩니다.
        {snsMsg ? <><br />{snsMsg}</> : null}
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ marginTop: 12, padding: '10px 16px', border: '1px solid #6d28d9', borderRadius: 999, background: '#fff', color: '#6d28d9', fontWeight: 800, cursor: 'pointer' }}>
        ✍️ 리뷰 쓰기
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12, padding: 14, border: '1px solid #eee', borderRadius: 12 }}>
      <div style={{ fontSize: 22, cursor: 'pointer' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} onClick={() => setRating(n)}>{n <= rating ? '⭐' : '☆'}</span>
        ))}
      </div>
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="이름(선택)" style={inp} />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="어떤 점이 좋았나요? (키워드만 적어도 샤비가 다듬어줘요)" style={{ ...inp, minHeight: 70 }} />
      <button type="button" onClick={assistDraft} disabled={assisting} style={{ marginTop: 6, padding: '8px 12px', border: '1px solid #e2c878', borderRadius: 8, background: '#fffdf5', color: '#7c2d12', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        {assisting ? '샤비가 쓰는 중… 🐝' : '✨ 샤비가 리뷰 다듬어줄게요'}
      </button>
      {error && <p style={{ color: '#c00', fontSize: 13, marginTop: 6 }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ width: '100%', padding: 12, border: 'none', borderRadius: 10, background: '#6d28d9', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '등록 중…' : '리뷰 등록'}
      </button>
    </form>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginTop: 8, boxSizing: 'border-box' };
