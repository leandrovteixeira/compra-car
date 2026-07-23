import { beforeEach, describe, expect, it, vi } from 'vitest';

const logoutState = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock('../src/auth/server-client', () => ({
  createMutableServerClient: async () => ({
    auth: { signOut: logoutState.signOut },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

import { logout } from '../src/app/actions/auth';

describe('logout', () => {
  beforeEach(() => {
    logoutState.signOut.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('redireciona para login somente após logout bem-sucedido', async () => {
    logoutState.signOut.mockResolvedValue({ error: null });

    await expect(logout()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(logoutState.signOut).toHaveBeenCalledOnce();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('trata sessão já inexistente como logout idempotente', async () => {
    logoutState.signOut.mockResolvedValue({ error: null });

    await expect(logout()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('não afirma sucesso quando signOut retorna erro', async () => {
    logoutState.signOut.mockResolvedValue({ error: new Error('internal detail') });

    await expect(logout()).rejects.toMatchObject({
      name: 'LogoutError',
      message: 'Não foi possível encerrar a sessão. Tente novamente.',
    });
    expect(console.error).toHaveBeenCalledWith('Auth logout failed.');
  });

  it('torna falha de escrita de cookies observável sem registrar detalhes', async () => {
    logoutState.signOut.mockRejectedValue(new Error('cookie with sensitive value'));

    await expect(logout()).rejects.toMatchObject({
      name: 'LogoutError',
      message: 'Não foi possível encerrar a sessão. Tente novamente.',
    });
    expect(console.error).toHaveBeenCalledWith('Auth logout failed.');
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('sensitive'));
  });
});
