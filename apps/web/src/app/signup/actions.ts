'use server';

import { headers } from 'next/headers';

import { createMutableServerClient } from '@/auth/server-client';

export type SignUpState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly message: string };

const SENT_MESSAGE = 'Se o endereço puder ser cadastrado, enviaremos um e-mail de confirmação. Verifique também a pasta de spam.';

export async function signUp(_: SignUpState, form: FormData): Promise<SignUpState> {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');

  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 254) {
    return { status: 'error', message: 'Informe nome e e-mail válidos.' };
  }
  if (password.length < 8 || password.length > 128 || password !== confirmPassword) {
    return { status: 'error', message: 'As senhas devem ser iguais e conter entre 8 e 128 caracteres.' };
  }

  // Next.js Server Actions enforce Origin/Host consistency. Never use a user-supplied redirect field.
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  if (!origin) return { status: 'error', message: 'Não foi possível identificar o endereço da aplicação.' };
  let emailRedirectTo: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
      throw new Error('Invalid origin');
    }
    emailRedirectTo = new URL('/auth/callback', url).toString();
  } catch {
    return { status: 'error', message: 'Endereço de confirmação inválido.' };
  }

  try {
    const client = await createMutableServerClient();
    const { error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo },
    });
    if (error) {
      if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
        return { status: 'error', message: 'Muitas solicitações. Tente novamente mais tarde.' };
      }
      console.error('Public signup error', { code: error.code });
      return { status: 'error', message: 'Não foi possível criar a conta agora. Tente novamente.' };
    }
    return { status: 'success', message: SENT_MESSAGE };
  } catch {
    return { status: 'error', message: 'Não foi possível criar a conta agora. Tente novamente.' };
  }
}
