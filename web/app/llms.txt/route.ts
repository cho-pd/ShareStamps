import { getAllStores, SITE_URL } from '@/lib/stores';

// AI 에이전트 전용 요약본 (/llms.txt). 사이트 개요 + 매장 목록을 저비용으로 제공 → 인용확률↑.
export const dynamic = 'force-static';

export async function GET() {
  const stores = await getAllStores();
  const lines = [
    '# ShareStamps',
    '',
    '> AI-discoverable local store pages with loyalty stamps and AI-assisted reviews.',
    '> Each store page exposes machine-readable schema.org (LocalBusiness/Restaurant, Menu, Review, FAQ).',
    '',
    '## Stores',
    ...stores.map((s) => {
      const where = s.address?.city ? ` in ${s.address.city}, ${s.address.region ?? ''}`.trimEnd() : '';
      return `- [${s.name}](${SITE_URL}/store/${s.slug}): ${s.category}${where}. ${s.description.slice(0, 140)}`;
    }),
    '',
    '## Key pages',
    `- Sitemap: ${SITE_URL}/sitemap.xml`,
    `- Owner onboarding: ${SITE_URL}/owner/new`,
  ];
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
