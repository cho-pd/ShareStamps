import Link from 'next/link';
import { getAllStores } from '@/lib/stores';

export const revalidate = 3600;

export default async function HomePage() {
  const stores = await getAllStores();
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>ShareStamps</h1>
      <p style={{ color: '#555' }}>AI-discoverable store pages + stamp loyalty.</p>
      <h2 style={{ fontSize: 18, marginTop: 28 }}>Stores</h2>
      <ul>
        {stores.map((s) => (
          <li key={s.id}>
            <Link href={`/store/${s.slug}`}>{s.name}</Link> — {s.category}
          </li>
        ))}
      </ul>
    </main>
  );
}
