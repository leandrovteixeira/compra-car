'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { authFlowUsesSecureCookies, buildAuthFlowRedirect } from '@/auth/auth-flow-redirect';
import { INVITE_ATTEMPT_COOKIE } from '@/auth/invite-attempt';
import { verifyInviteToken } from '@/auth/verify-invite-token';

export async function confirmInviteAction() {
  const cookieStore = await cookies();
  const tokenHash = cookieStore.get(INVITE_ATTEMPT_COOKIE)?.value ?? null;
  const valid = await verifyInviteToken(tokenHash, 'invite');

  cookieStore.set(INVITE_ATTEMPT_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/auth/invite',
    sameSite: 'lax',
    secure: authFlowUsesSecureCookies('invite'),
  });
  if (valid) {
    cookieStore.set('cc-auth-flow', 'invite', {
      httpOnly: true,
      maxAge: 900,
      path: '/auth',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('invite'),
    });
  }

  redirect(buildAuthFlowRedirect('invite', valid).toString());
}
