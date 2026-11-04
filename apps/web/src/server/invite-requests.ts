import 'server-only';
import {
  AdminUserSupabaseAdapter,
  InviteRequestSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import { revalidatePath } from 'next/cache';
import {
  createInviteRequest,
  approveInviteRequest,
  rejectInviteRequest,
  type InviteRequestDependencies,
} from '@/application/invite-requests';
import { requireActiveProfile, requireRole } from '@/auth/authorization';
import { createReadOnlyServerClient } from '@/auth/server-client';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import {
  getAdminInviteRedirectUrl,
  getAdminRecoveryRedirectUrl,
} from '@/auth/admin-user-redirects';
const deps: InviteRequestDependencies = {
  authorizeActive: requireActiveProfile,
  authorizeAdmin: () => requireFeatureIdentity23C('settings', 'write'),
  repository: () => new InviteRequestSupabaseAdapter(createPrivilegedAdminClient()),
  users: () => new AdminUserSupabaseAdapter(createPrivilegedAdminClient()),
  adminInviteDependencies: {
    authorize: () => requireFeatureIdentity23C('settings', 'write'),
    createManager: () => new AdminUserSupabaseAdapter(createPrivilegedAdminClient()),
    inviteRedirectUrl: getAdminInviteRedirectUrl,
    recoveryRedirectUrl: getAdminRecoveryRedirectUrl,
    revalidate: revalidatePath,
  },
  revalidate: revalidatePath,
};
async function userRepo() {
  return new InviteRequestSupabaseAdapter(await createReadOnlyServerClient());
}
export async function loadMyInviteRequests() {
  const { user } = await requireActiveProfile();
  return (await userRepo()).listMine(user.id);
}
export async function loadAdminInviteRequests() {
  await requireFeatureIdentity23C('settings', 'write');
  return new InviteRequestSupabaseAdapter(createPrivilegedAdminClient()).listPending();
}
export async function createInviteRequestAction(
  _: import('@/application/admin/admin-user-management').AdminUserActionState,
  data: FormData,
) {
  return createInviteRequest(data, deps);
}
export const approveInviteRequestAction = (_: unknown, data: FormData) =>
  approveInviteRequest(data, deps);
export const rejectInviteRequestAction = (_: unknown, data: FormData) =>
  rejectInviteRequest(data, deps);
