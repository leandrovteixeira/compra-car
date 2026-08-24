import { NextRequest, NextResponse } from 'next/server';
import { exchangeAuthCode } from '@/auth/exchange-auth-code';
export async function GET(request: NextRequest) {
  const valid = await exchangeAuthCode(request.nextUrl.searchParams.get('code'));
  const response = NextResponse.redirect(
    new URL(valid ? '/auth/recovery' : '/auth/recovery?error=invalid', request.url),
  );
  if (valid)
    response.cookies.set('cc-auth-flow', 'recovery', {
      httpOnly: true,
      maxAge: 900,
      path: '/auth',
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    });
  return response;
}
