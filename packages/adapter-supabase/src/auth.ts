import { createBrowserClient, createServerClient, type CookieOptions } from '@supabase/ssr';
import {
  APP_ROLES,
  USER_STATUSES,
  type AppRole,
  type AuthProfile,
  type UserStatus,
} from '@compra-car/contracts';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { LegacyAdapterConfigurationError } from './errors';

export { APP_ROLES, USER_STATUSES };
export type { AppRole, AuthProfile, UserStatus };
export type AuthUser = User;

export interface AuthClientConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export interface AuthCookie {
  readonly name: string;
  readonly value: string;
  readonly options?: CookieOptions;
}

export interface AuthCookieStore {
  getAll(): readonly Pick<AuthCookie, 'name' | 'value'>[];
  setAll(cookies: readonly AuthCookie[]): void;
}

function requiredPublicConfig(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new LegacyAdapterConfigurationError(`Variável de ambiente obrigatória ausente: ${name}.`);
  }

  return value.trim();
}

function normalizedAuthConfig(config: AuthClientConfig): AuthClientConfig {
  return {
    url: requiredPublicConfig(config.url, 'NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: requiredPublicConfig(
      config.publishableKey,
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    ),
  };
}

export function createBrowserAuthClient(config: AuthClientConfig): SupabaseClient {
  const normalized = normalizedAuthConfig(config);
  return createBrowserClient(normalized.url, normalized.publishableKey);
}

export function createServerAuthClient(
  config: AuthClientConfig,
  cookieStore: AuthCookieStore,
): SupabaseClient {
  const normalized = normalizedAuthConfig(config);
  return createServerClient(normalized.url, normalized.publishableKey, {
    cookies: {
      getAll: () => [...cookieStore.getAll()],
      setAll: (cookies) => cookieStore.setAll(cookies),
    },
  });
}

export async function getVerifiedAuthUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function getAuthProfile(
  client: SupabaseClient,
  userId: string,
): Promise<AuthProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('id,full_name,role,status')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  if (!APP_ROLES.includes(data.role as AppRole)) return null;
  if (!USER_STATUSES.includes(data.status as UserStatus)) return null;

  return Object.freeze({
    id: String(data.id),
    fullName: typeof data.full_name === 'string' ? data.full_name : null,
    role: data.role as AppRole,
    status: data.status as UserStatus,
  });
}
