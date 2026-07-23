import 'server-only';

import { createServerAuthClient } from '@compra-car/adapter-supabase';
import { cookies } from 'next/headers';

import { getAuthClientConfig } from './config';
import { createServerAuthCookieStore } from './server-cookie-store';

async function createNextServerClient(cookieWrites: 'read-only' | 'mutable') {
  const nextCookieStore = await cookies();
  const authCookieStore = createServerAuthCookieStore(nextCookieStore, cookieWrites);

  return createServerAuthClient(getAuthClientConfig(), authCookieStore);
}

export function createReadOnlyServerClient() {
  return createNextServerClient('read-only');
}

export function createMutableServerClient() {
  return createNextServerClient('mutable');
}
