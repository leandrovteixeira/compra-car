import type { ReactNode } from 'react';

import { requireRole } from '@/auth/authorization';
import { AppAuthenticatedNavigation } from '@/components/authenticated-navigation';

interface SellerLayoutProps {
  readonly children: ReactNode;
}

export default async function SellerLayout({ children }: SellerLayoutProps) {
  const { profile, user } = await requireRole('seller');
  const displayName = profile.fullName ?? user.email ?? 'Usuário';

  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <AppAuthenticatedNavigation area="seller" displayName={displayName} profile={profile} />
      {children}
    </div>
  );
}
