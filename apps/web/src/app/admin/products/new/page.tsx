import { redirect } from 'next/navigation';
import { requireFeatureWrite23C } from '@/auth/account-tier-server';

/** Preserve old deep links but use the canonical inline creation workflow. */
export default async function NewAdminProductPage() {
  await requireFeatureWrite23C('vehicle-administration');
  redirect('/admin/products?new=1');
}
