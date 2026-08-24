'use server';

import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import {
  inviteAdminUserAction as invite,
  sendAdminUserPasswordRecoveryAction as recover,
  setAdminUserRoleAction as setRole,
  setAdminUserStatusAction as setStatus,
} from '@/server/admin-user-management';

export async function inviteAdminUserAction(state: AdminUserActionState, data: FormData) {
  return invite(state, data);
}

export async function setAdminUserStatusAction(state: AdminUserActionState, data: FormData) {
  return setStatus(state, data);
}

export async function setAdminUserRoleAction(state: AdminUserActionState, data: FormData) {
  return setRole(state, data);
}

export async function sendAdminUserPasswordRecoveryAction(
  state: AdminUserActionState,
  data: FormData,
) {
  return recover(state, data);
}
