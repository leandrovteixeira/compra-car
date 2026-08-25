import { NextRequest, NextResponse } from 'next/server';

import { authFlowUsesSecureCookies, buildAuthFlowRedirect } from '@/auth/auth-flow-redirect';
import { verifyRecoveryToken } from '@/auth/verify-recovery-token';

export async function GET(request: NextRequest) {
  const valid = await verifyRecoveryToken(
    request.nextUrl.searchParams.get('token_hash'),
    request.nextUrl.searchParams.get('type'),
  );
  const response = NextResponse.redirect(buildAuthFlowRedirect('recovery', valid));
  if (valid)
    response.cookies.set('cc-auth-flow', 'recovery', {
      httpOnly: true,
      maxAge: 900,
      path: '/auth',
      sameSite: 'lax',
      secure: authFlowUsesSecureCookies('recovery'),
    });
  return response;
}
