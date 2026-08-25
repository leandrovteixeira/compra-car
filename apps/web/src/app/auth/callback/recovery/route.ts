import { NextRequest, NextResponse } from 'next/server';

import {
  authFlowUsesSecureCookies,
  buildRecoveryConfirmationRedirect,
} from '@/auth/auth-flow-redirect';
import {
  RECOVERY_ATTEMPT_COOKIE,
  RECOVERY_ATTEMPT_MAX_AGE,
  validRecoveryAttempt,
} from '@/auth/recovery-attempt';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const valid = validRecoveryAttempt(tokenHash, request.nextUrl.searchParams.get('type'));
  const response = NextResponse.redirect(buildRecoveryConfirmationRedirect(valid));
  if (valid)
    response.cookies.set(RECOVERY_ATTEMPT_COOKIE, tokenHash!, {
      httpOnly: true,
      maxAge: RECOVERY_ATTEMPT_MAX_AGE,
      path: '/auth/recovery',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('recovery'),
    });
  else
    response.cookies.set(RECOVERY_ATTEMPT_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      path: '/auth/recovery',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('recovery'),
    });
  return response;
}
