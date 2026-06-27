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
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          color: '#1c1c1e',
          background: '#ffffff',
          lineHeight: 1.5,
        }}
      >
        {children}
      </body>
    </html>
  );
}
