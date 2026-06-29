import type { Metadata } from 'next';

export const metadata: Metadata = { title: '점주 대시보드' };

export default function OwnerDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
