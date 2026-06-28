// 매장 사진이 없을 때 쓰는 샘플 대문 이미지 (디자인 완성도용 임시 — 점주가 언제든 교체).
// 카테고리/슬러그에 따라 결정적으로 골라 매장마다 일관되되 다양하게 보이게 한다.
const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;

const FOOD = [
  U('1504674900247-0877df9cc836'), // plated food
  U('1498654896293-37aacf113fd9'), // food spread
  U('1414235077428-338989a2e8c0'), // restaurant table
  U('1517248135467-4c7edcad34c4'), // restaurant interior
];
const CAFE = [
  U('1554118811-1e0d58224f24'), // cafe seating
  U('1495474472287-4d71bcdd2085'), // coffee
  U('1559925393-8be0ec4767c8'), // latte
];
const KOREAN = [
  U('1583224964978-2257b960c3d3'), // korean dishes
  U('1590301157890-4810ed352733'), // bibimbap-ish
  U('1498654896293-37aacf113fd9'),
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function sampleHero(category: string, slug: string): string {
  const c = category.toLowerCase();
  const set = c.includes('cafe') || c.includes('coffee') ? CAFE : c.includes('korean') ? KOREAN : FOOD;
  return set[hash(slug) % set.length];
}
