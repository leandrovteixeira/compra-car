import type { AuthProfile } from '@compra-car/adapter-supabase';
import type { ReactNode } from 'react';

import { logout } from '../../app/actions/auth';
import { ApplicationTopbar } from '../application-topbar';
import type { NavigationLink } from '../authenticated-navigation-policy';
import { AdminNav } from './admin-nav';
import { adminNavigationItems } from './admin-navigation';

interface AdminShellProps {
  readonly children: ReactNode;
  readonly displayName: string;
  readonly profile: AuthProfile;
}

const mobileAdminLinks: readonly NavigationLink[] = adminNavigationItems.flatMap((item) => {
  if (item.children) {
    return item.children
      .filter((child) => child.status === 'active' && child.href)
      .map((child) => ({ href: child.href!, label: child.label }));
  }
  return item.status === 'active' && item.href ? [{ href: item.href, label: item.label }] : [];
});

export function AdminShell({ children, displayName, profile }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-canvas text-text-primary">
      <ApplicationTopbar
        area="admin"
        displayName={displayName}
        logoutAction={logout}
        navigationLinks={mobileAdminLinks}
        profile={profile}
      />
      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-[var(--app-topbar-height)] lg:block lg:h-[calc(100dvh-var(--app-topbar-height))] lg:p-3">
          <p className="mb-2 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
            Administração
          </p>
          <AdminNav />
        </aside>
        <main className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-5 lg:px-6 lg:pb-8 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
