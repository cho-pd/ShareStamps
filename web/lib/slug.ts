// 매장 slug 생성: 이름(+도시)을 URL 안전한 소문자 하이픈 형태로. /store/{slug} 에 쓰임 — 고정 식별자.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // 발음기호 제거
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function storeSlug(name: string, city?: string): string {
  const base = city ? `${name}-${city}` : name;
  const s = slugify(base);
  return s || `store-${Date.now()}`;
}
