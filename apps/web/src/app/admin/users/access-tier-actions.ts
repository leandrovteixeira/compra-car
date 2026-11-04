'use server';

import { revalidatePath } from 'next/cache';

import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import { requireFeatureIdentity23C } from '@/auth/account-tier-server';
import { createMutableServerClient } from '@/auth/server-client';

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

  const client = await createMutableServerClient();
  const { data, error } = await client.rpc('promote_internal_admin_23c', {
    p_user: userId,
  });
  if (error) {
    return { status: 'error', message: 'Não foi possível promover o usuário para Admin.' };
  }
  if (data !== true) {
    return { status: 'error', message: 'A promoção não foi aplicada.' };
  }

  revalidatePath('/admin/users');
  return { status: 'success', message: 'Usuário promovido para Admin do Compra Car.' };
}
