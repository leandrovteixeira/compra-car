'use server';

import { revalidatePath } from 'next/cache';

import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { requireFeatureIdentity23C } from '@/auth/account-tier-server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function promoteUserToAdmin(
  _state: AdminUserActionState,
  form: FormData,
): Promise<AdminUserActionState> {
  const actor = await requireFeatureIdentity23C('settings', 'write');
  const userId = form.get('userId');
  if (typeof userId !== 'string' || !UUID.test(userId)) {
    return { status: 'error', message: 'Usuário inválido.' };
  }
  if (userId === actor.user.id) {
    return { status: 'error', message: 'Sua conta já possui acesso superior.' };
  }

  const client = createPrivilegedAdminClient();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id,status')
    .eq('id', userId)
    .maybeSingle();
  if (profileError || !profile || profile.status !== 'active') {
    return { status: 'error', message: 'Usuário não está ativo.' };
  }

  const { data: currentGrant, error: grantError } = await client
    .from('account_access_grants')
    .select('access_tier')
    .eq('user_id', userId)
    .maybeSingle();
  if (grantError) return { status: 'error', message: 'Não foi possível verificar o perfil atual.' };
  if (currentGrant?.access_tier === 'master') {
    return { status: 'error', message: 'Master não pode ser alterado por esta ação.' };
  }
  if (currentGrant?.access_tier === 'admin') {
    return { status: 'success', message: 'Usuário já é Admin.' };
  }

  const now = new Date().toISOString();
  const { error: membershipError } = await client
    .from('account_organization_memberships')
    .update({ status: 'revoked', updated_at: now })
    .eq('user_id', userId)
    .eq('status', 'active');
  if (membershipError) {
    return { status: 'error', message: 'Não foi possível encerrar o vínculo Corporate atual.' };
  }

  const { error: upsertError } = await client
    .from('account_access_grants')
    .upsert({
      user_id: userId,
      access_tier: 'admin',
      organization_id: null,
      valid_until: null,
      granted_by: actor.profile.id,
      updated_at: now,
    }, { onConflict: 'user_id' });
  if (upsertError) {
    return { status: 'error', message: 'Não foi possível promover o usuário para Admin.' };
  }

  revalidatePath('/admin/users');
  return { status: 'success', message: 'Usuário promovido para Admin do Compra Car.' };
}
