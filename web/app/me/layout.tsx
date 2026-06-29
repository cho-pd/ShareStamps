import type { Metadata } from 'next';

export const metadata: Metadata = { title: '내 스탬프' };

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
