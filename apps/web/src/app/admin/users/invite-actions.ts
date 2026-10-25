'use server';
import { requireFeature23C } from '@/auth/account-tier-server';
import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import {
  approveInviteRequestAction as approve,
  rejectInviteRequestAction as reject,
} from '@/server/invite-requests';
export async function approveInviteRequestAction(state: AdminUserActionState, data: FormData) {
  await requireFeature23C('settings');
  return approve(state, data);
}
export async function rejectInviteRequestAction(state: AdminUserActionState, data: FormData) {
  await requireFeature23C('settings');
  return reject(state, data);
}
