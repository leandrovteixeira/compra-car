import { NextRequest, NextResponse } from 'next/server';

import { exchangeAuthCode } from '@/auth/exchange-auth-code';
import { getAdminRecoveryRedirectUrl } from '@/auth/admin-user-redirects';

// Supabase PKCE email-confirmation callback. Avoid open redirects.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const success = await exchangeAuthCode(code);
  // Railway's internal request origin can be 0.0.0.0:8080. Always use the configured public QA origin.
  const destination = new URL('/', getAdminRecoveryRedirectUrl());
  destination.searchParams.set('auth', 'login');
  if (success) destination.searchParams.set('confirmed', '1');
  else destination.searchParams.set('auth_error', 'invalid_confirmation');
  return NextResponse.redirect(destination);
}
