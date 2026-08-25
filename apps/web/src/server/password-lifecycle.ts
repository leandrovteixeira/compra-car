import 'server-only';
import {
  AdminUserSupabaseAdapter,
  getAuthProfile,
  getVerifiedAuthUser,
} from '@compra-car/adapter-supabase';
import {
  completeInvitedUserOnboarding,
  completePasswordRecovery,
  type PasswordLifecycleDependencies,
  type PasswordLifecycleState,
} from '@/application/auth/password-lifecycle';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { createMutableServerClient } from '@/auth/server-client';
import { cookies } from 'next/headers';
async function dependencies(flow: 'invite' | 'recovery'): Promise<PasswordLifecycleDependencies> {
  const client = await createMutableServerClient();
  return {
    identity: async () => {
      if ((await cookies()).get('cc-auth-flow')?.value !== flow) return null;
      const user = await getVerifiedAuthUser(client);
      return user ? { user, profile: await getAuthProfile(client, user.id) } : null;
    },
    updatePassword: async (password) => {
      const { error } = await client.auth.updateUser({ password });
      return !error;
    },
    activatePending: (id) =>
      new AdminUserSupabaseAdapter(createPrivilegedAdminClient()).activatePendingUser(id),
    clearRecoveryRequested: (id) =>
      new AdminUserSupabaseAdapter(createPrivilegedAdminClient()).clearPasswordRecoveryRequested(
        id,
      ),
  };
}
export async function completeInviteAction(_: PasswordLifecycleState, data: FormData) {
  return completeInvitedUserOnboarding(data, await dependencies('invite'));
}
export async function completeRecoveryAction(_: PasswordLifecycleState, data: FormData) {
  return completePasswordRecovery(data, await dependencies('recovery'));
}
export async function loadPasswordFlowIdentity(flow: 'invite' | 'recovery') {
  return (await dependencies(flow)).identity();
}
