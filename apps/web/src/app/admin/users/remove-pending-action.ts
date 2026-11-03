'use server';

import { revalidatePath } from 'next/cache';

import { requireFeature23C } from '@/auth/account-tier-server';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export interface PendingAccountRemovalState {
  readonly status: 'idle' | 'error' | 'success';
  readonly message?: string;
}

/** Only never-used pending QA accounts may be deleted; never delete a privileged account. */
export async function removeUnusedPendingAccount(
  _previous: PendingAccountRemovalState,
  form: FormData,
): Promise<PendingAccountRemovalState> {
  await requireFeature23C('settings');
  if (process.env.APP_ENV !== 'qa') {
    return { status: 'error', message: 'Exclusão de contas pendentes está disponível apenas no QA.' };
  }
  const userId = form.get('userId');
  const confirmation = form.get('confirmation');
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId) || confirmation !== 'EXCLUIR') {
    return { status: 'error', message: 'Confirme a exclusão digitando EXCLUIR.' };
  }
  const client = createPrivilegedAdminClient();
  const [{ data: profile, error: profileError }, { data: grant, error: grantError }] = await Promise.all([
    client.from('profiles').select('status,accepted_at').eq('id', userId).maybeSingle(),
    client.from('account_access_grants').select('access_tier').eq('user_id', userId).maybeSingle(),
  ]);
  if (profileError || grantError || !profile || profile.status !== 'pending' || profile.accepted_at || grant) {
    return { status: 'error', message: 'Conta não elegível: somente pendentes sem ativação nem concessões podem ser excluídos.' };
  }
  const { data: memberships, error: membershipError } = await client.from('account_organization_memberships').select('id').eq('user_id', userId).limit(1);
  const { data: requests, error: requestError } = await client.from('account_upgrade_requests').select('id').eq('user_id', userId).limit(1);
  if (membershipError || requestError || (memberships?.length ?? 0) || (requests?.length ?? 0)) {
    return { status: 'error', message: 'A conta possui vínculos ou solicitações; não pode ser excluída.' };
  }
  const { data: authUser, error: authError } = await client.auth.admin.getUserById(userId);
  if (authError || !authUser.user || authUser.user.last_sign_in_at || authUser.user.email_confirmed_at) {
    return { status: 'error', message: 'A conta já foi utilizada ou confirmada. Utilize Desativar acesso.' };
  }
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) return { status: 'error', message: 'Não foi possível excluir a conta. Verifique os vínculos no banco.' };
  revalidatePath('/admin/users');
  return { status: 'success', message: 'Conta pendente excluída do Auth e da listagem.' };
}
