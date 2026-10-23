import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { logout } from '@/app/actions/auth';
import { getAccountTier } from '@/auth/account-tier-server';
import { AuthDrawer } from '@/components/auth-drawer';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export default async function PublicAreaLayout({ children }: { readonly children: ReactNode }) {
  const tier = await getAccountTier();
  return <div className="min-h-dvh bg-canvas text-text-primary lg:flex">
    <AdminSidebar displayName="Minha conta" logoutAction={logout} tier={tier} />
    <main className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="font-bold tracking-widest">COMPRA CAR</span>
        <a href="/?auth=login" className="text-sm text-[#EF7732]">Entrar / Conta</a>
      </div>
      {children}
    </main>
    <Suspense fallback={null}><AuthDrawer /></Suspense>
  </div>;
}
