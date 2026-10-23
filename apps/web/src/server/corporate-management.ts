import 'server-only';

import { requireFeature23C } from '@/auth/account-tier-server';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export interface CorporateUpgradeRequest {
  readonly id: string;
  readonly company: string;
  readonly job_title: string;
  readonly contact_phone: string;
  readonly message: string | null;
  readonly created_at: string;
  readonly status: string;
}

export async function loadCorporateUpgradeRequests(): Promise<readonly CorporateUpgradeRequest[]> {
  await requireFeature23C('settings');
  const { data, error } = await createPrivilegedAdminClient()
    .from('account_upgrade_requests')
    .select('id,company,job_title,contact_phone,message,created_at,status')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('Não foi possível carregar solicitações Corporate.');
  return data ?? [];
}

export interface CorporateOrganization {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly created_at: string;
}

export async function loadCorporateOrganizations(): Promise<readonly CorporateOrganization[]> {
  await requireFeature23C('settings');
  const { data, error } = await createPrivilegedAdminClient()
    .from('account_organizations')
    .select('id,name,kind,status,created_at')
    .order('name')
    .limit(100);
  if (error) throw new Error('Não foi possível carregar organizações.');
  return data ?? [];
}
