'use server';
import type { PasswordLifecycleState } from '@/application/auth/password-lifecycle';
import { completeInviteAction as complete } from '@/server/password-lifecycle';
export async function completeInviteAction(state: PasswordLifecycleState, data: FormData) {
  return complete(state, data);
}
