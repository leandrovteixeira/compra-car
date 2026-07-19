import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  applicationName: 'Compra Car',
  description: 'Seleção mobile-first de veículos para comparação no Compra Car.',
  icons: {
    icon: '/icons/icon-192.svg',
  },
  manifest: '/manifest.webmanifest',
  title: {
    default: 'Compra Car',
    template: '%s | Compra Car',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0f172a',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
