import type { AuthProfile } from '@compra-car/adapter-supabase';
import type { ReactNode } from 'react';
import { BrandSlot } from './brand-slot';
import { ContextSwitcher } from './context-switcher';
import type { AuthenticatedArea } from './authenticated-navigation-policy';
import { UserMenu } from './user-menu';

interface ApplicationTopbarProps {
  readonly area: AuthenticatedArea;
  readonly displayName: string;
  readonly logoutAction: () => Promise<never>;
  readonly mobileNavigation?: ReactNode;
  readonly profile: AuthProfile;
  readonly secondaryNavigation?: ReactNode;
}

export function ApplicationTopbar({
  area,
  displayName,
  logoutAction,
  mobileNavigation,
  profile,
  secondaryNavigation,
}: ApplicationTopbarProps) {
  return (
    <header className="sticky top-0 z-40 h-[var(--app-topbar-height)] border-b border-border bg-surface-elevated">
      <div className="mx-auto grid h-full w-full max-w-[100rem] grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-1 px-2 min-[23rem]:gap-1.5 min-[23rem]:px-3 sm:flex sm:gap-4 sm:px-5 lg:px-6">
        <BrandSlot href={area === 'admin' ? '/admin' : '/'} />
        <ContextSwitcher area={area} profile={profile} />
        <div className="ml-auto hidden items-center gap-2 sm:flex">{secondaryNavigation}</div>
        <div className="flex shrink-0 justify-self-end sm:ml-0">{mobileNavigation}</div>
        <UserMenu
          displayName={displayName}
          logoutAction={logoutAction}
          roleLabel={profile.role === 'admin' ? 'Administrador' : 'Vendedor'}
        />
      </div>
    </header>
  );
}
