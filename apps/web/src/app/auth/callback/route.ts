import { NextRequest, NextResponse } from 'next/server';

import { exchangeAuthCode } from '@/auth/exchange-auth-code';

// Supabase PKCE email-confirmation callback. Avoid open redirects.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const success = await exchangeAuthCode(code);
  const destination = new URL('/', request.nextUrl.origin);
  if (success) destination.searchParams.set('auth', 'confirmed');
  else destination.searchParams.set('auth_error', 'invalid_confirmation');
  return NextResponse.redirect(destination);
}
