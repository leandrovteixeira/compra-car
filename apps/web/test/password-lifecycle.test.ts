import type { AuthProfile, AuthUser } from '@compra-car/adapter-supabase';
import { describe, expect, it, vi } from 'vitest';
import {
  completeInvitedUserOnboarding,
  completePasswordRecovery,
  type PasswordLifecycleDependencies,
} from '../src/application/auth/password-lifecycle';
const user = { id: 'user-id' } as AuthUser;
const profile = (status: AuthProfile['status']): AuthProfile => ({
  id: user.id,
  fullName: 'Pessoa',
  role: 'seller',
  status,
});
const data = (password = 'valid123', confirmation = password) => {
  const f = new FormData();
  f.set('password', password);
  f.set('confirmation', confirmation);
  return f;
};
function deps(
  status: AuthProfile['status'] | 'missing' = 'pending',
): PasswordLifecycleDependencies {
  return {
    identity: vi.fn(async () => ({ user, profile: status === 'missing' ? null : profile(status) })),
    updatePassword: vi.fn(async () => true),
    activatePending: vi.fn(async () => true),
  };
}
describe('password lifecycle', () => {
  it('updates password then activates a pending invite', async () => {
    const d = deps();
    expect(await completeInvitedUserOnboarding(data(), d)).toMatchObject({
      status: 'success',
      destination: '/',
    });
    expect(d.updatePassword).toHaveBeenCalledWith('valid123');
    expect(d.activatePending).toHaveBeenCalledWith(user.id);
  });
  it('rejects short/mismatched passwords before identity or provider calls', async () => {
    const d = deps();
    expect(await completeInvitedUserOnboarding(data('short'), d)).toMatchObject({
      status: 'error',
    });
    expect(await completeInvitedUserOnboarding(data('valid123', 'different'), d)).toMatchObject({
      status: 'error',
    });
    expect(d.updatePassword).not.toHaveBeenCalled();
  });
  it('rejects missing session/profile and disabled invite without activation', async () => {
    const missingSession = { ...deps(), identity: vi.fn(async () => null) };
    expect(await completeInvitedUserOnboarding(data(), missingSession)).toMatchObject({
      message: expect.stringContaining('não é mais válido'),
    });
    for (const state of ['missing', 'disabled'] as const) {
      const d = deps(state);
      expect(await completeInvitedUserOnboarding(data(), d)).toMatchObject({ status: 'error' });
      expect(d.updatePassword).not.toHaveBeenCalled();
    }
  });
  it('treats active invite completion as idempotent', async () => {
    const d = deps('active');
    expect(await completeInvitedUserOnboarding(data(), d)).toMatchObject({
      status: 'success',
      message: 'Cadastro já concluído.',
    });
    expect(d.updatePassword).not.toHaveBeenCalled();
  });
  it('reports password success plus activation failure explicitly and permits retry', async () => {
    const d = deps();
    vi.mocked(d.activatePending).mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce(true);
    expect(await completeInvitedUserOnboarding(data(), d)).toMatchObject({
      message: expect.stringContaining('senha foi definida'),
    });
    expect(await completeInvitedUserOnboarding(data(), d)).toMatchObject({ status: 'success' });
  });
  it('maps provider password errors safely', async () => {
    const d = deps();
    vi.mocked(d.updatePassword).mockResolvedValue(false);
    expect(await completeInvitedUserOnboarding(data(), d)).toMatchObject({ status: 'error' });
  });
  it.each(['active', 'disabled', 'pending'] as const)(
    'recovery updates password and preserves %s profile',
    async (status) => {
      const d = deps(status);
      const result = await completePasswordRecovery(data(), d);
      expect(result.status).toBe('success');
      expect(d.activatePending).not.toHaveBeenCalled();
      expect(d.identity).toHaveBeenCalled();
    },
  );
  it('recovery rejects missing session/profile and invalid password', async () => {
    expect(
      await completePasswordRecovery(data(), { ...deps(), identity: vi.fn(async () => null) }),
    ).toMatchObject({ status: 'error' });
    expect(await completePasswordRecovery(data(), deps('missing'))).toMatchObject({
      status: 'error',
    });
    expect(await completePasswordRecovery(data('tiny'), deps('active'))).toMatchObject({
      status: 'error',
    });
  });
  it('recovery maps provider failure without status mutation', async () => {
    const d = deps('disabled');
    vi.mocked(d.updatePassword).mockResolvedValue(false);
    expect(await completePasswordRecovery(data(), d)).toMatchObject({ status: 'error' });
    expect(d.activatePending).not.toHaveBeenCalled();
  });
});
