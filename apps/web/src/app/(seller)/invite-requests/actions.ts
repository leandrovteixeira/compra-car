'use server';
import type { AdminUserActionState } from '@/application/admin/admin-user-management';
import { createInviteRequestAction as create } from '@/server/invite-requests';
export async function createInviteRequestAction(state: AdminUserActionState, data: FormData) {
  return create(state, data);
}
