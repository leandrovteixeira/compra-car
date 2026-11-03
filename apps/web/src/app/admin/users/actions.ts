'use server';

import { requireFeature23C } from '@/auth/account-tier-server';
import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import {
  sendAdminUserPasswordRecoveryAction as recover,
  setAdminUserStatusAction as setStatus,
} from '@/server/admin-user-management';

export async function inviteAdminUserAction(_state: AdminUserActionState, _data: FormData): Promise<AdminUserActionState> {
  await requireFeature23C('settings');
  return { status: 'error', message: 'Convites legados desativados. Use o fluxo Corporate com organização.' };
}

export async function setAdminUserStatusAction(state: AdminUserActionState, data: FormData) {
  await requireFeature23C('settings');
  return setStatus(state, data);
}

export async function setAdminUserRoleAction(_state: AdminUserActionState, _data: FormData) {
  await requireFeature23C('settings');
  return { status: 'error' as const, message: 'Mudança de perfil legado desativada. Use concessões de acesso Corporate.' };
}

export async function sendAdminUserPasswordRecoveryAction(
  state: AdminUserActionState,
  data: FormData,
) {
  await requireFeature23C('settings');
  return recover(state, data);
}
