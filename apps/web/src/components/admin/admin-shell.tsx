import type { AuthProfile } from '@compra-car/adapter-supabase';
import type { ReactNode } from 'react';

import { logout } from '../../app/actions/auth';
import { ApplicationTopbar } from '../application-topbar';
import { AdminNav } from './admin-nav';

interface AdminShellProps {
  readonly children: ReactNode;
  readonly displayName: string;
  readonly profile: AuthProfile;
}

export function AdminShell({ children, displayName, profile }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-canvas text-text-primary">
      <ApplicationTopbar
        area="admin"
        displayName={displayName}
        logoutAction={logout}
        mobileNavigation={
          <details className="relative ml-auto lg:hidden">
            <summary className="ui-button ui-button--secondary ui-button--compact cursor-pointer list-none">
              Menu
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-2 shadow-lg">
              <AdminNav />
            </div>
          </details>
        }
        profile={profile}
      />
      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-[var(--app-topbar-height)] lg:block lg:h-[calc(100dvh-var(--app-topbar-height))] lg:p-3">
          <p className="mb-2 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
            Administração
          </p>
          <AdminNav />
        </aside>
        <main className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-5 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
