import './globals.css';
import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/stores';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'ShareStamps', template: '%s · ShareStamps' },
  description: 'Turn local visits into AI-discoverable stores and stamp rewards.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ShareStamps' },
};

export const viewport: Viewport = {
  themeColor: '#6d28d9',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-dvh font-sans text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
