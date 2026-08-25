'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { authFlowUsesSecureCookies, buildAuthFlowRedirect } from '@/auth/auth-flow-redirect';
import { RECOVERY_ATTEMPT_COOKIE } from '@/auth/recovery-attempt';
import { verifyRecoveryToken } from '@/auth/verify-recovery-token';

export async function confirmRecoveryAction() {
  const cookieStore = await cookies();
  const tokenHash = cookieStore.get(RECOVERY_ATTEMPT_COOKIE)?.value ?? null;
  const valid = await verifyRecoveryToken(tokenHash, 'recovery');

  cookieStore.set(RECOVERY_ATTEMPT_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/auth/recovery',
    sameSite: 'lax',
    secure: authFlowUsesSecureCookies('recovery'),
  });
  if (valid) {
    cookieStore.set('cc-auth-flow', 'recovery', {
      httpOnly: true,
      maxAge: 900,
      path: '/auth',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('recovery'),
    });
  }

  redirect(buildAuthFlowRedirect('recovery', valid).toString());
}
