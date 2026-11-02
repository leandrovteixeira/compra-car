'use server';

import { requireFeature23C } from '@/auth/account-tier-server';
import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import {
  sendAdminUserPasswordRecoveryAction as recover,
  setAdminUserRoleAction as setRole,
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

export async function setAdminUserRoleAction(state: AdminUserActionState, data: FormData) {
  await requireFeature23C('settings');
  return setRole(state, data);
}

export async function sendAdminUserPasswordRecoveryAction(
  state: AdminUserActionState,
  data: FormData,
) {
  await requireFeature23C('settings');
  return recover(state, data);
}
