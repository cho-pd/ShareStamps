'use client';

import { useState } from 'react';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

export default function ReviewForm({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="어떤 점이 좋았나요?" style={{ ...inp, minHeight: 70 }} />
      {error && <p style={{ color: '#c00', fontSize: 13 }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ width: '100%', padding: 12, border: 'none', borderRadius: 10, background: '#6d28d9', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '등록 중…' : '리뷰 등록'}
      </button>
    </form>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginTop: 8, boxSizing: 'border-box' };
