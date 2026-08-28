import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { APP_METADATA, APP_VIEWPORT } from '@/config/app-metadata';

import './globals.css';

export const metadata: Metadata = APP_METADATA;

export const viewport: Viewport = APP_VIEWPORT;

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
