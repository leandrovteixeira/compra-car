import { NextRequest, NextResponse } from 'next/server';

import { authFlowUsesSecureCookies, buildAuthFlowRedirect } from '@/auth/auth-flow-redirect';
import { exchangeAuthCode } from '@/auth/exchange-auth-code';

export async function GET(request: NextRequest) {
  const valid = await exchangeAuthCode(request.nextUrl.searchParams.get('code'));
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
