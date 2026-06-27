import type { MetadataRoute } from 'next';
import { getAllStores, SITE_URL } from '@/lib/stores';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stores = await getAllStores();
  const storeUrls: MetadataRoute.Sitemap = stores.map((s) => ({
    url: `${SITE_URL}/store/${s.slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));
  return [{ url: SITE_URL, changeFrequency: 'weekly', priority: 1 }, ...storeUrls];
}
