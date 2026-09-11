import type { ReactNode } from 'react';

import { requireRole } from '@/auth/authorization';
import { AppAuthenticatedNavigation } from '@/components/authenticated-navigation';
import { getAuthenticatedNavigationModel } from '@/components/authenticated-navigation-policy';
import { SellerNav } from '@/components/seller-nav';

interface SellerLayoutProps {
  readonly children: ReactNode;
}

export default async function SellerLayout({ children }: SellerLayoutProps) {
  const { profile, user } = await requireRole('seller');
  const displayName = profile.fullName ?? user.email ?? 'Usuário';
  const { localLinks } = getAuthenticatedNavigationModel(profile, 'seller');

  return (
    <div className="min-h-dvh bg-canvas text-text-primary">
      <AppAuthenticatedNavigation area="seller" displayName={displayName} profile={profile} />
      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-[var(--app-topbar-height)] lg:block lg:h-[calc(100dvh-var(--app-topbar-height))] lg:p-3">
          <p className="mb-2 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
            Vendedor
          </p>
          <SellerNav links={localLinks} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
