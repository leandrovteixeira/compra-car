import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AuthDrawer } from '@/components/auth-drawer';

import { getAccountTier } from '@/auth/account-tier-server';
import { getActiveProfile } from '@/auth/authorization';
import { AppAuthenticatedNavigation } from '@/components/authenticated-navigation';
import { PublicNavigation } from '@/components/public-navigation';
import { getAuthenticatedNavigationModel } from '@/components/authenticated-navigation-policy';
import { SellerNav } from '@/components/seller-nav';

interface SellerLayoutProps {
  readonly children: ReactNode;
}

export default async function SellerLayout({ children }: SellerLayoutProps) {
  const profile = await getActiveProfile();
  const tier = profile ? await getAccountTier() : 'visitor' as const;
  const links = profile
    ? getAuthenticatedNavigationModel(profile, 'seller').localLinks
    : [{ href: '/ver-modelo', label: 'Fichas Técnicas' }, { href: '/', label: 'Comparar Modelos' }];

  return (
    <div className="min-h-dvh bg-canvas text-text-primary">
      {profile ? (
        <AppAuthenticatedNavigation
          area="seller"
          displayName={profile.fullName ?? 'Usuário'}
          profile={profile}
          tier={tier}
        />
      ) : (
        <PublicNavigation />
      )}
      <Suspense fallback={null}><AuthDrawer /></Suspense>
      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-[var(--app-topbar-height)] lg:block lg:h-[calc(100dvh-var(--app-topbar-height))] lg:p-3">
          <p className="mb-2 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
            Veículos
          </p>
          <SellerNav links={links} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
