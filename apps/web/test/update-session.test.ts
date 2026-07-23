import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  cookies: [] as Array<{
    name: string;
    value: string;
    options?: { maxAge?: number; path?: string; sameSite?: 'lax' };
  }>,
  user: null as { id: string } | null,
}));

vi.mock('@compra-car/adapter-supabase', async (importOriginal) => {
  const original = await importOriginal<typeof import('@compra-car/adapter-supabase')>();
  return {
    ...original,
    createServerAuthClient: (
      _config: unknown,
      cookieStore: { setAll(cookies: typeof authState.cookies): void },
    ) => ({ cookieStore }),
    getVerifiedAuthUser: async (client: {
      cookieStore: { setAll(cookies: typeof authState.cookies): void };
    }) => {
      client.cookieStore.setAll(authState.cookies);
      return authState.user;
    },
  };
});

import { updateSession } from '../src/auth/update-session';

describe('updateSession', () => {
  beforeEach(() => {
    authState.cookies = [];
    authState.user = null;
  });

  it('preserva cookies renovados na resposta normal de usuário autenticado', async () => {
    authState.user = { id: 'user-id' };
    authState.cookies = [
      {
        name: 'sb-access-token',
        value: 'renewed',
        options: { path: '/', sameSite: 'lax' },
      },
    ];

    const response = await updateSession(new NextRequest('http://localhost/comparar'));

    expect(response.status).toBe(200);
    expect(response.cookies.get('sb-access-token')).toMatchObject({
      value: 'renewed',
      path: '/',
      sameSite: 'lax',
    });
  });

  it('preserva cookies removidos no redirect de usuário não autenticado', async () => {
    authState.cookies = [
      {
        name: 'sb-access-token',
        value: '',
        options: { maxAge: 0, path: '/' },
      },
    ];

    const response = await updateSession(new NextRequest('http://localhost/comparar?vehicles=1,2'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?next=%2Fcomparar%3Fvehicles%3D1%2C2',
    );
    expect(response.cookies.get('sb-access-token')).toMatchObject({
      value: '',
      path: '/',
    });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('mantém /login acessível sem sessão e preserva cookies de limpeza', async () => {
    authState.cookies = [
      { name: 'sb-refresh-token', value: '', options: { maxAge: 0, path: '/' } },
    ];

    const response = await updateSession(new NextRequest('http://localhost/login'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=');
  });

  it('volta a bloquear a rota protegida depois que a sessão deixa de existir', async () => {
    authState.user = { id: 'user-id' };
    const authenticatedResponse = await updateSession(new NextRequest('http://localhost/'));
    expect(authenticatedResponse.status).toBe(200);

    authState.user = null;
    const loggedOutResponse = await updateSession(new NextRequest('http://localhost/'));
    expect(loggedOutResponse.status).toBe(307);
    expect(loggedOutResponse.headers.get('location')).toBe('http://localhost/login?next=%2F');
  });
});
