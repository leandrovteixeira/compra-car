import 'server-only';

import {
  getAuthProfile,
  getVerifiedAuthUser,
  type AppRole,
  type AuthProfile,
  type AuthUser,
} from '@compra-car/adapter-supabase';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { hasRole } from './access-control';
import { createReadOnlyServerClient } from './server-client';
import { withDevTiming } from '@/server/dev-timing';

export interface ActiveIdentity {
  readonly user: AuthUser;
  readonly profile: AuthProfile;
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  return getVerifiedAuthUser(await createReadOnlyServerClient());
}

export async function getActiveProfile(): Promise<AuthProfile | null> {
  const client = await createReadOnlyServerClient();
  const user = await getVerifiedAuthUser(client);
  if (!user) return null;

  const profile = await getAuthProfile(client, user.id);
  return profile?.status === 'active' ? profile : null;
}

export async function requireAuthenticatedUser(): Promise<AuthUser> {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');
  return user;
}

type ActiveIdentityResult =
  | { readonly status: 'active'; readonly identity: ActiveIdentity }
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'profile-denied' };

const loadActiveIdentity = cache(async (): Promise<ActiveIdentityResult> => {
  const client = await createReadOnlyServerClient();
  const user = await withDevTiming('auth.getUser', () => getVerifiedAuthUser(client));
  if (!user) {
    if (process.env.NODE_ENV === 'development') console.info('[auth] user: not found');
    return { status: 'unauthenticated' };
  }
  if (process.env.NODE_ENV === 'development') console.info('[auth] user: found');

  const profile = await withDevTiming('auth.profile', () => getAuthProfile(client, user.id));
  if (process.env.NODE_ENV === 'development') {
    console.info(`[auth] profile: ${profile?.status ?? 'missing'}`);
  }
  if (!profile || profile.status !== 'active') return { status: 'profile-denied' };
  return { status: 'active', identity: { user, profile } };
});

export async function requireActiveProfile(): Promise<ActiveIdentity> {
  const result = await withDevTiming('auth.requireActiveProfile', loadActiveIdentity);
  if (result.status === 'unauthenticated') redirect('/login');
  if (result.status === 'profile-denied') redirect('/login?error=access');
  return result.identity;
}

export async function requireRole(requiredRole: AppRole): Promise<ActiveIdentity> {
  const identity = await requireActiveProfile();
  if (!hasRole(identity.profile, requiredRole)) redirect('/');
  return identity;
}
