import type { AccountTier } from '@/auth/entitlements-23c';
import type { AuthProfile } from '@compra-car/adapter-supabase';
import type { ReactNode } from 'react';

import { logout } from '../../app/actions/auth';
import { AdminSidebar } from './admin-sidebar';

interface AdminShellProps {
  readonly children: ReactNode;
  readonly displayName: string;
  readonly profile: AuthProfile;
  readonly tier: AccountTier;
}

export function AdminShell({ children, displayName, tier }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-canvas text-text-primary">
      <div className="lg:flex lg:items-start">
        <AdminSidebar displayName={displayName} logoutAction={logout} tier={tier} />
        <main className="cc-mobile-page min-w-0 w-full flex-1 px-5 py-5 sm:px-6 lg:w-0 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
