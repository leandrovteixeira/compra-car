import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  profile: null as null | { role: 'admin' | 'seller'; status: 'active' | 'pending' | 'disabled' },
  signInError: null as Error | null,
  user: null as null | { id: string },
  signOut: vi.fn(async () => ({ error: null })),
}));

vi.mock('@compra-car/adapter-supabase', () => ({
  getAuthProfile: vi.fn(async () => state.profile),
}));
vi.mock('@/auth/server-client', () => ({
  createMutableServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: state.user },
        error: state.signInError,
      }),
      signOut: state.signOut,
    },
  })),
}));
vi.mock('@/auth/safe-redirect', () => ({
  getSafeInternalDestination: (value: string, fallback: string) =>
    value.startsWith('/') && !value.startsWith('//') ? value : fallback,
  isAdminDestination: (value: string) => value === '/admin' || value.startsWith('/admin/'),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));

import { login } from '../src/app/login/actions';

function credentials(next = ''): FormData {
  const form = new FormData();
  form.set('email', 'admin@example.test');
  form.set('password', 'not-a-real-password');
  if (next) form.set('next', next);
  return form;
}

describe('login action', () => {
  beforeEach(() => {
    state.profile = null;
    state.signInError = null;
    state.user = null;
    state.signOut.mockClear();
  });

  it('redireciona login admin válido para o destino autorizado', async () => {
    state.user = { id: 'user-id' };
    state.profile = { role: 'admin', status: 'active' };
    await expect(login(credentials('/admin/prices'))).rejects.toThrow('REDIRECT:/admin/prices');
  });

  it('usa feedback genérico para credencial inválida', async () => {
    state.signInError = new Error('invalid credentials');
    await expect(login(credentials())).rejects.toThrow('REDIRECT:/login?error=invalid');
  });

  it.each([null, 'pending', 'disabled'] as const)(
    'encerra a sessão quando o profile é ausente ou não ativo: %s',
    async (status) => {
      state.user = { id: 'user-id' };
      state.profile = status ? { role: 'admin', status } : null;
      await expect(login(credentials())).rejects.toThrow('REDIRECT:/login?error=invalid');
      expect(state.signOut).toHaveBeenCalledOnce();
    },
  );
});
