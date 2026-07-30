import {
  createServerAuthClient,
  getVerifiedAuthUser,
  type AuthCookie,
  type AuthCookieStore,
} from '@compra-car/adapter-supabase';
import { type NextRequest, NextResponse } from 'next/server';

import { getAuthClientConfig } from './config';
import { requiresAuthentication } from './route-policy';

function devTiming(label: string, startedAt: number): void {
  if (process.env.NODE_ENV === 'development') {
    console.info(`[timing] ${label}: ${Math.round(performance.now() - startedAt)} ms`);
  }
}

function destinationFor(request: NextRequest): string {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const pendingCookies = new Map<string, AuthCookie>();

  function cookieKey(cookie: AuthCookie): string {
    return `${cookie.name}\u0000${cookie.options?.domain ?? ''}\u0000${cookie.options?.path ?? ''}`;
  }

  function preserveAuthCookies(target: NextResponse): NextResponse {
    pendingCookies.forEach(({ name, value, options }) => {
      target.cookies.set(name, value, options);
    });
    return target;
  }

  const cookieStore: AuthCookieStore = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet: readonly AuthCookie[]) => {
      cookiesToSet.forEach((cookie) => {
        request.cookies.set(cookie.name, cookie.value);
        pendingCookies.set(cookieKey(cookie), cookie);
      });
      response = NextResponse.next({ request });
    },
  };

  const client = createServerAuthClient(getAuthClientConfig(), cookieStore);
  const authStartedAt = performance.now();
  const user = await getVerifiedAuthUser(client);
  devTiming('auth.middleware.getUser', authStartedAt);
  if (process.env.NODE_ENV === 'development') {
    console.info(`[auth] middleware user: ${user ? 'found' : 'not found'}`);
  }

  if (!user && requiresAuthentication(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', destinationFor(request));
    return preserveAuthCookies(NextResponse.redirect(loginUrl));
  }

  return preserveAuthCookies(response);
}
