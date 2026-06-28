'use client';

import { useState } from 'react';
import { storeSlug } from '@/lib/slug';
import { getDb } from '@/lib/firebase';
import { doc, setDoc, collection } from 'firebase/firestore';

type MenuRow = { name: string; price: string; description: string; signature: boolean };

const emptyMenuRow = (): MenuRow => ({ name: '', price: '', description: '', signature: false });

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ddd',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
};
const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#333', display: 'block', margin: '14px 0 4px' };

export default function NewStorePage() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Korean Restaurant');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('11:00 AM - 10:00 PM');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [priceRange, setPriceRange] = useState('$$');
  const [reward, setReward] = useState('5');
  const [sellingPoints, setSellingPoints] = useState('');
  const [menu, setMenu] = useState<MenuRow[]>([emptyMenuRow()]);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateMenu = (i: number, patch: Partial<MenuRow>) =>
    setMenu((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('매장 이름을 입력해 주세요.');
    setSaving(true);
    try {
      const slug = storeSlug(name.trim(), city.trim() || undefined);
      const id = `store_${slug}`.slice(0, 80);
      const db = getDb();

      const storeDoc: Record<string, unknown> = {
        slug,
        name: name.trim(),
        category: category.trim(),
        currency,
        description: description.trim(),
        hours: hours.trim(),
        phone: phone.trim() || null,
        priceRange,
        pointRewardPer7Stamps: parseFloat(reward) || 5,
        sellingPoints: sellingPoints.split(',').map((s) => s.trim()).filter(Boolean),
        address: {
          street: street.trim() || null,
          city: city.trim() || null,
          region: region.trim() || null,
          postalCode: postalCode.trim() || null,
          country: 'US',
        },
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'stores', id), storeDoc);

      const rows = menu.filter((m) => m.name.trim());
      for (let i = 0; i < rows.length; i++) {
        const m = rows[i];
        await setDoc(doc(collection(db, 'stores', id, 'menuItems'), `m_${i}_${storeSlug(m.name)}`), {
          name: m.name.trim(),
          price: parseFloat(m.price) || 0,
          description: m.description.trim() || null,
          signature: m.signature,
        });
      }
      try { localStorage.setItem('ss_owner_store', slug); } catch {}
      setResult({ slug });
    } catch (err) {
      setError((err as Error)?.message || '저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>등록됐어요! 🎉</h1>
        <p>매장 페이지가 생성됐습니다:</p>
        <p>
          <a href={`/store/${result.slug}`} style={{ color: '#6d28d9', fontWeight: 700 }}>
            /store/{result.slug}
          </a>
        </p>
        <p>
          <a href="/owner/dashboard" style={{ color: '#6d28d9', fontWeight: 700 }}>→ 점주 대시보드로</a>
        </p>
        <p style={{ color: '#666', fontSize: 13 }}>
          (정적 배포 환경에서는 새 매장 페이지가 다음 빌드/배포 후 공개됩니다. SSR 전환 시 즉시 반영.)
        </p>
        <button onClick={() => { setResult(null); setName(''); setMenu([emptyMenuRow()]); }} style={{ ...input, width: 'auto', padding: '10px 16px', cursor: 'pointer', marginTop: 16 }}>
          매장 하나 더 등록
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>매장 등록 (점주)</h1>
      <p style={{ color: '#666', fontSize: 13 }}>입력한 정보는 AI 검색에 최적화된 매장 페이지로 즉시 구조화됩니다.</p>
      <form onSubmit={handleSubmit}>
        <label style={label}>매장 이름 *</label>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="LOVELETTER" />

        <label style={label}>카테고리</label>
        <input style={input} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Korean Restaurant" />

        <label style={label}>소개</label>
        <textarea style={{ ...input, minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="매장 소개, 대표 메뉴, 분위기 등" />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>영업시간</label>
            <input style={input} value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>전화</label>
            <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={label}>도시</label>
            <input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Fullerton" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>주(州)</label>
            <input style={input} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="CA" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 2 }}>
            <label style={label}>주소</label>
            <input style={input} value={street} onChange={(e) => setStreet(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>우편번호</label>
            <input style={input} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>통화</label>
            <input style={input} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>가격대</label>
            <input style={input} value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder="$$" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>7개당 보상</label>
            <input style={input} value={reward} onChange={(e) => setReward(e.target.value)} />
          </div>
        </div>

        <label style={label}>셀링포인트 (쉼표로 구분, AEO 키워드)</label>
        <input style={input} value={sellingPoints} onChange={(e) => setSellingPoints(e.target.value)} placeholder="fresh daily, soondubu, family friendly" />

        <h2 style={{ fontSize: 16, marginTop: 24 }}>메뉴</h2>
        {menu.map((row, i) => (
          <div key={i} style={{ border: '1px solid #eee', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...input, flex: 2 }} value={row.name} onChange={(e) => updateMenu(i, { name: e.target.value })} placeholder="메뉴명" />
              <input style={{ ...input, flex: 1 }} value={row.price} onChange={(e) => updateMenu(i, { price: e.target.value })} placeholder="가격" />
            </div>
            <input style={{ ...input, marginTop: 6 }} value={row.description} onChange={(e) => updateMenu(i, { description: e.target.value })} placeholder="설명" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <label style={{ fontSize: 13 }}>
                <input type="checkbox" checked={row.signature} onChange={(e) => updateMenu(i, { signature: e.target.checked })} /> 시그니처
              </label>
              {menu.length > 1 && (
                <button type="button" onClick={() => setMenu((m) => m.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 13 }}>삭제</button>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setMenu((m) => [...m, emptyMenuRow()])} style={{ ...input, width: 'auto', padding: '8px 14px', cursor: 'pointer' }}>+ 메뉴 추가</button>

        {error && <p style={{ color: '#c00', marginTop: 14 }}>{error}</p>}

        <button type="submit" disabled={saving} style={{ width: '100%', marginTop: 20, padding: 14, border: 'none', borderRadius: 10, background: '#6d28d9', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? '저장 중…' : '매장 등록'}
        </button>
      </form>
    </main>
  );
}
