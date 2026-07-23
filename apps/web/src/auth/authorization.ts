import 'server-only';

import {
  getAuthProfile,
  getVerifiedAuthUser,
  type AppRole,
  type AuthProfile,
  type AuthUser,
} from '@compra-car/adapter-supabase';
import { redirect } from 'next/navigation';

import { hasRole } from './access-control';
import { createReadOnlyServerClient } from './server-client';

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

export async function requireActiveProfile(): Promise<ActiveIdentity> {
  const client = await createReadOnlyServerClient();
  const user = await getVerifiedAuthUser(client);
  if (!user) redirect('/login');

  const profile = await getAuthProfile(client, user.id);
  if (!profile || profile.status !== 'active') redirect('/login?error=access');
  return { user, profile };
}

export async function requireRole(requiredRole: AppRole): Promise<ActiveIdentity> {
  const identity = await requireActiveProfile();
  if (!hasRole(identity.profile, requiredRole)) redirect('/');
  return identity;
}
