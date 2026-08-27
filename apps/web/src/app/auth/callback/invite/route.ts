import { NextRequest, NextResponse } from 'next/server';

import {
  authFlowUsesSecureCookies,
  buildAuthFlowConfirmationRedirect,
} from '@/auth/auth-flow-redirect';
import {
  INVITE_ATTEMPT_COOKIE,
  INVITE_ATTEMPT_MAX_AGE,
  validInviteAttempt,
} from '@/auth/invite-attempt';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const valid = validInviteAttempt(tokenHash, request.nextUrl.searchParams.get('type'));
  const response = NextResponse.redirect(buildAuthFlowConfirmationRedirect('invite', valid));
  if (valid)
    response.cookies.set(INVITE_ATTEMPT_COOKIE, tokenHash!, {
      httpOnly: true,
      maxAge: INVITE_ATTEMPT_MAX_AGE,
      path: '/auth/invite',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('invite'),
    });
  else
    response.cookies.set(INVITE_ATTEMPT_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      path: '/auth/invite',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('invite'),
    });
  return response;
}
