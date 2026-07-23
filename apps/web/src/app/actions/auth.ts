'use server';

import { redirect } from 'next/navigation';

import { createMutableServerClient } from '../../auth/server-client';

class LogoutError extends Error {
  constructor() {
    super('Não foi possível encerrar a sessão. Tente novamente.');
    this.name = 'LogoutError';
  }
}

export async function logout(): Promise<never> {
  try {
    const client = await createMutableServerClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  } catch {
    console.error('Auth logout failed.');
    throw new LogoutError();
  }

  redirect('/login');
}
