import type { AuthProfile } from '@compra-car/adapter-supabase';
import type { ReactNode } from 'react';

import { logout } from '../../app/actions/auth';
import { ApplicationTopbar } from '../application-topbar';
import type { NavigationLink } from '../authenticated-navigation-policy';
import { AdminSidebar } from './admin-sidebar';
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
      <div className="lg:flex lg:items-start">
        <AdminSidebar />
        <main className="min-w-0 w-full flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
