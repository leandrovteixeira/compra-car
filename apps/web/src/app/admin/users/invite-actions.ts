'use server';
import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import {
  approveInviteRequestAction as approve,
  rejectInviteRequestAction as reject,
} from '@/server/invite-requests';
export async function approveInviteRequestAction(state: AdminUserActionState, data: FormData) {
  return approve(state, data);
}
export async function rejectInviteRequestAction(state: AdminUserActionState, data: FormData) {
  return reject(state, data);
}
