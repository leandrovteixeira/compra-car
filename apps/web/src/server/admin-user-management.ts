import 'server-only';

import { AdminUserSupabaseAdapter } from '@compra-car/adapter-supabase';
import { revalidatePath } from 'next/cache';

import {
  inviteAdminUser,
  sendAdminUserPasswordRecovery,
  setAdminUserRole,
  setAdminUserStatus,
  type AdminUserActionState,
  type AdminUserManagementDependencies,
} from '@/application/admin/admin-user-management';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import {
  getAdminInviteRedirectUrl,
  getAdminRecoveryRedirectUrl,
} from '@/auth/admin-user-redirects';
import { requireRole } from '@/auth/authorization';

const dependencies: AdminUserManagementDependencies = {
  authorize: () => requireRole('admin'),
  createManager: () => new AdminUserSupabaseAdapter(createPrivilegedAdminClient()),
  inviteRedirectUrl: getAdminInviteRedirectUrl,
  recoveryRedirectUrl: getAdminRecoveryRedirectUrl,
  revalidate: revalidatePath,
};

export const inviteAdminUserAction = (_: AdminUserActionState, data: FormData) =>
  inviteAdminUser(data, dependencies);
export const setAdminUserStatusAction = (_: AdminUserActionState, data: FormData) =>
  setAdminUserStatus(data, dependencies);
export const setAdminUserRoleAction = (_: AdminUserActionState, data: FormData) =>
  setAdminUserRole(data, dependencies);
export const sendAdminUserPasswordRecoveryAction = (_: AdminUserActionState, data: FormData) =>
  sendAdminUserPasswordRecovery(data, dependencies);
