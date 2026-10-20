import 'server-only';

import { getAuthProfile, getVerifiedAuthUser } from '@compra-car/adapter-supabase';

import {
  canExecuteFeature,
  type AccountTier,
  type Feature23C,
} from './entitlements-23c';
import { createReadOnlyServerClient } from './server-client';

/**
 * Derive privilege from a server-verified identity and database-owned grant.
 * A missing or expired grant never inherits admin access from user metadata.
 */
export async function getAccountTier(): Promise<AccountTier> {
  const client = await createReadOnlyServerClient();
  const user = await getVerifiedAuthUser(client);
  if (!user) return 'visitor';
  const profile = await getAuthProfile(client, user.id);
  if (!profile || profile.status !== 'active') return 'visitor';

  const { data, error } = await client
    .from('account_access_grants')
    .select('access_tier, valid_until, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error('Não foi possível verificar as permissões da conta.');
  if (!data) return 'public';

  const grant = data as {
    access_tier: AccountTier;
    valid_until: string | null;
    organization_id: string | null;
  };
  if (grant.valid_until && Date.parse(grant.valid_until) <= Date.now()) return 'public';
  if (grant.access_tier === 'corporate') {
    if (!grant.organization_id) return 'public';
    const { data: membership, error: memberError } = await client
      .from('account_organization_memberships')
      .select('status, valid_until')
      .eq('user_id', user.id)
      .eq('organization_id', grant.organization_id)
      .maybeSingle();
    if (memberError) throw new Error('Não foi possível verificar a organização.');
    if (!membership || membership.status !== 'active') return 'public';
    if (membership.valid_until && Date.parse(membership.valid_until) <= Date.now()) return 'public';
  }
  return ['public', 'corporate', 'admin', 'master'].includes(grant.access_tier)
    ? grant.access_tier
    : 'public';
}

export async function requireFeature23C(feature: Feature23C): Promise<AccountTier> {
  const tier = await getAccountTier();
  if (!canExecuteFeature(tier, feature)) {
    throw new Error('Acesso não autorizado.');
  }
  return tier;
}
