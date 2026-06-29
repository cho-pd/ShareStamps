import type { Metadata } from 'next';

export const metadata: Metadata = { title: '본사 관리자' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
