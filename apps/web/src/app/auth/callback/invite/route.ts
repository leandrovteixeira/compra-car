import { NextRequest, NextResponse } from 'next/server';

import { authFlowUsesSecureCookies, buildAuthFlowRedirect } from '@/auth/auth-flow-redirect';
import { verifyInviteToken } from '@/auth/verify-invite-token';

export async function GET(request: NextRequest) {
  const valid = await verifyInviteToken(
    request.nextUrl.searchParams.get('token_hash'),
    request.nextUrl.searchParams.get('type'),
  );
  const response = NextResponse.redirect(buildAuthFlowRedirect('invite', valid));
  if (valid)
    response.cookies.set('cc-auth-flow', 'invite', {
      httpOnly: true,
      maxAge: 900,
      path: '/auth',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('invite'),
    });
  return response;
}
