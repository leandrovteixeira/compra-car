'use server';
import type { PasswordLifecycleState } from '@/application/auth/password-lifecycle';
import { completeRecoveryAction as complete } from '@/server/password-lifecycle';
export async function completeRecoveryAction(state: PasswordLifecycleState, data: FormData) {
  return complete(state, data);
}
