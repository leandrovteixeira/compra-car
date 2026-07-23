'use server';

import { getAuthProfile } from '@compra-car/adapter-supabase';
import { redirect } from 'next/navigation';

import { getSafeInternalDestination, isAdminDestination } from '@/auth/safe-redirect';
import { createMutableServerClient } from '@/auth/server-client';

const GENERIC_LOGIN_ERROR = 'invalid';

function loginErrorDestination(rawNext: FormDataEntryValue | null): string {
  const next = typeof rawNext === 'string' ? getSafeInternalDestination(rawNext, '') : '';
  const params = new URLSearchParams({ error: GENERIC_LOGIN_ERROR });
  if (next) params.set('next', next);
  return `/login?${params.toString()}`;
}

export async function login(formData: FormData): Promise<never> {
  const emailValue = formData.get('email');
  const passwordValue = formData.get('password');
  const nextValue = formData.get('next');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';

  if (!email || !password) redirect(loginErrorDestination(nextValue));

  const client = await createMutableServerClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(loginErrorDestination(nextValue));

  const profile = await getAuthProfile(client, data.user.id);
  if (!profile || profile.status !== 'active') {
    await client.auth.signOut();
    redirect(loginErrorDestination(nextValue));
  }

  const roleDestination = profile.role === 'admin' ? '/admin' : '/';
  const requestedDestination =
    typeof nextValue === 'string'
      ? getSafeInternalDestination(nextValue, roleDestination)
      : roleDestination;

  if (profile.role === 'seller' && isAdminDestination(requestedDestination)) {
    redirect('/');
  }

  redirect(requestedDestination);
}
