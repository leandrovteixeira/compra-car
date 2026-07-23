import type { ReactNode } from 'react';

import { requireRole } from '@/auth/authorization';
import { AdminShell } from '@/components/admin/admin-shell';

interface AdminLayoutProps {
  readonly children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const { profile } = await requireRole('admin');
  const displayName = profile.fullName?.trim() || 'Administrador';

  return <AdminShell displayName={displayName}>{children}</AdminShell>;
}
