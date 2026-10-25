import { redirect } from 'next/navigation';
import { requireRole } from '@/auth/authorization';

/** Preserve old deep links but use the canonical inline creation workflow. */
export default async function NewAdminProductPage() {
  await requireRole('admin');
  redirect('/admin/products?new=1');
}
