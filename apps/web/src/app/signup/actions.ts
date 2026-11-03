'use server';

import { createMutableServerClient } from '@/auth/server-client';

export type SignUpState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly message: string };

export async function signUp(_: SignUpState, form: FormData): Promise<SignUpState> {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');

  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return { status: 'error', message: 'Informe nome e e-mail válidos.' };
  }
  if (password.length < 8 || password !== confirmPassword) {
    return { status: 'error', message: 'As senhas devem coincidir e ter pelo menos 8 caracteres.' };
  }

  try {
    const client = await createMutableServerClient();
    const { error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) {
      console.error('Public signup failed', { code: error.code });
      return { status: 'error', message: 'Não foi possível criar a conta. Tente novamente mais tarde.' };
    }
    return {
      status: 'success',
      message: 'Verifique seu e-mail para confirmar o cadastro. Confira também a pasta de spam.',
    };
  } catch {
    return { status: 'error', message: 'Não foi possível criar a conta agora.' };
  }
}
