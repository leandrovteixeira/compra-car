import type { ReactNode } from 'react';

import { requireRole } from '@/auth/authorization';
import { getAccountTier } from '@/auth/account-tier-server';
import { AdminShell } from '@/components/admin/admin-shell';

interface AdminLayoutProps {
  readonly children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const { profile } = await requireRole('admin');
  const displayName = profile.fullName?.trim() || 'Administrador';
  const tier = await getAccountTier();

  return (
    <AdminShell displayName={displayName} profile={profile} tier={tier}>
      {children}
    </AdminShell>
  );
}
