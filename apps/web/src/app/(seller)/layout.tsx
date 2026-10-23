import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { getAccountTier } from '@/auth/account-tier-server';
import { AuthDrawer } from '@/components/auth-drawer';
import { PublicNavigation } from '@/components/public-navigation';

export default async function PublicAreaLayout({ children }: { readonly children: ReactNode }) {
  const tier = await getAccountTier();
  return (
    <div className="min-h-dvh bg-canvas text-text-primary">
      <PublicNavigation tier={tier} />
      <Suspense fallback={null}><AuthDrawer /></Suspense>
      {children}
    </div>
  );
}
