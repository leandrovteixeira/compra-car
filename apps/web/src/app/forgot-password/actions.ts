'use server';

import { AdminUserSupabaseAdapter } from '@compra-car/adapter-supabase';

import {
  requestPasswordRecovery,
  type PasswordRecoveryRequestState,
} from '@/application/auth/request-password-recovery';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { getAdminRecoveryRedirectUrl } from '@/auth/admin-user-redirects';

export async function requestPasswordRecoveryAction(
  _: PasswordRecoveryRequestState,
  data: FormData,
) {
  return requestPasswordRecovery(data, {
    createRequester: () => new AdminUserSupabaseAdapter(createPrivilegedAdminClient()),
    recoveryRedirectUrl: getAdminRecoveryRedirectUrl,
  });
}
