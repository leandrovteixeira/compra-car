import type { ReactNode } from 'react';
import { logout } from '@/app/actions/auth';
import { getAccountTier } from '@/auth/account-tier-server';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function AccountLayout({ children }: { readonly children: ReactNode }) {
  const tier = await getAccountTier();
  return (
    <div className="min-h-dvh bg-canvas text-text-primary lg:flex">
      <AdminSidebar displayName="Minha conta" logoutAction={logout} tier={tier} />
      <div className="cc-mobile-page min-w-0 flex-1">{children}</div>
    </div>
  );
}
