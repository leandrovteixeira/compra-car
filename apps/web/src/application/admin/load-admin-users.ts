import 'server-only';

import { AdminUserSupabaseAdapter } from '@compra-car/adapter-supabase';
import type { AdminUserDto } from '@compra-car/contracts';

import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { requireFeatureIdentity23C } from '@/auth/account-tier-server';

export interface AdminUserReader {
  listAdminUsers(): Promise<readonly AdminUserDto[]>;
}

interface LoadAdminUsersDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createReader: () => AdminUserReader;
}

const DEFAULT_DEPENDENCIES: LoadAdminUsersDependencies = {
  authorize: () => requireFeatureIdentity23C('settings', 'write'),
  createReader: () => new AdminUserSupabaseAdapter(createPrivilegedAdminClient()),
};

export async function loadAdminUsers(
  dependencies: LoadAdminUsersDependencies = DEFAULT_DEPENDENCIES,
): Promise<readonly AdminUserDto[]> {
  await dependencies.authorize();
  const users = await dependencies.createReader().listAdminUsers();
  if (dependencies !== DEFAULT_DEPENDENCIES || users.length === 0) return users;

  const client = createPrivilegedAdminClient();
  const { data: grants, error: grantsError } = await client
    .from('account_access_grants')
    .select('user_id,access_tier,organization_id')
    .in('user_id', users.map((user) => user.id));
  if (grantsError) throw new Error('Não foi possível carregar os perfis de acesso.');

  const organizationIds = [
    ...new Set((grants ?? []).map((grant) => grant.organization_id).filter(Boolean)),
  ] as string[];
  const organizations = organizationIds.length
    ? await client.from('account_organizations').select('id,name').in('id', organizationIds)
    : { data: [], error: null };
  if (organizations.error) throw new Error('Não foi possível carregar as organizações.');

  const grantByUser = new Map((grants ?? []).map((grant) => [grant.user_id as string, grant]));
  const organizationById = new Map(
    (organizations.data ?? []).map((organization) => [organization.id as string, organization.name as string]),
  );

  return users.map((user) => {
    const grant = grantByUser.get(user.id);
    const accessTier =
      grant?.access_tier === 'corporate' ||
      grant?.access_tier === 'admin' ||
      grant?.access_tier === 'master' ||
      grant?.access_tier === 'public'
        ? grant.access_tier
        : 'public';
    return {
      ...user,
      accessTier,
      organizationName: grant?.organization_id
        ? organizationById.get(grant.organization_id as string) ?? null
        : null,
    };
  });
}
