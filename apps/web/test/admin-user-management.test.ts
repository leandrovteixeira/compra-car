import type { AdminUserDto } from '@compra-car/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  inviteAdminUser,
  sendAdminUserPasswordRecovery,
  setAdminUserRole,
  setAdminUserStatus,
  type AdminUserManagementDependencies,
  type AdminUserManager,
} from '../src/application/admin/admin-user-management';

const healthy = (overrides: Partial<AdminUserDto> = {}): AdminUserDto => ({
  createdAt: '2026-08-24T00:00:00Z',
  email: 'user@example.com',
  fullName: 'User',
  id: 'target',
  lastSignInAt: null,
  passwordRecoveryRequestedAt: null,
  profileState: 'valid',
  role: 'seller',
  status: 'active',
  ...overrides,
});
const form = (values: Record<string, string>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};

describe('admin user management rules', () => {
  let manager: AdminUserManager;
  let dependencies: AdminUserManagementDependencies;

  beforeEach(() => {
    manager = {
      countActiveAdmins: vi.fn(async () => 2),
      findAdminUserByEmail: vi.fn(async () => null),
      getAdminUser: vi.fn(async () => healthy()),
      inviteAdminUser: vi.fn(async () => 'new-id'),
      requestPasswordRecovery: vi.fn(async () => undefined),
      setAdminUserRole: vi.fn(async () => undefined),
      setAdminUserStatus: vi.fn(async () => undefined),
    };
    dependencies = {
      authorize: vi.fn(async () => ({ user: { id: 'actor' } })),
      createManager: () => manager,
      inviteRedirectUrl: () => 'https://app.example.com/invite',
      recoveryRedirectUrl: () => 'https://app.example.com/recovery',
      revalidate: vi.fn(),
    };
  });

  it('invites a normalized seller as pending through the adapter', async () => {
    const result = await inviteAdminUser(
      form({ fullName: '  Maria   Silva ', email: ' MARIA@EXAMPLE.COM ', role: 'seller' }),
      dependencies,
    );
    expect(result).toEqual({ status: 'success', message: 'Convite enviado.' });
    expect(manager.inviteAdminUser).toHaveBeenCalledWith({
      email: 'maria@example.com',
      fullName: 'Maria Silva',
      invitedBy: 'actor',
      redirectTo: 'https://app.example.com/invite',
      role: 'seller',
    });
    expect(dependencies.revalidate).toHaveBeenCalledWith('/admin/users');
  });

  it.each([
    [{ fullName: '', email: 'a@b.com', role: 'seller' }],
    [{ fullName: 'Maria', email: 'invalid', role: 'seller' }],
    [{ fullName: 'Maria', email: 'a@b.com', role: 'owner' }],
  ])('rejects invalid invitation input', async (values) => {
    expect(await inviteAdminUser(form(values), dependencies)).toMatchObject({ status: 'error' });
    expect(manager.inviteAdminUser).not.toHaveBeenCalled();
  });

  it('does not invite an existing email', async () => {
    vi.mocked(manager.findAdminUserByEmail).mockResolvedValue(healthy());
    const result = await inviteAdminUser(
      form({ fullName: 'Maria', email: 'a@b.com', role: 'admin' }),
      dependencies,
    );
    expect(result).toEqual({ status: 'error', message: 'Já existe um usuário com este e-mail.' });
  });

  it('reports Auth failure without any application-side profile creation', async () => {
    vi.mocked(manager.inviteAdminUser).mockRejectedValue(new Error('auth failed'));
    expect(
      await inviteAdminUser(
        form({ fullName: 'Maria', email: 'a@b.com', role: 'seller' }),
        dependencies,
      ),
    ).toMatchObject({ status: 'error' });
  });

  it('reports the explicit partial failure after Auth invitation', async () => {
    const error = new Error('profile failed');
    error.name = 'AdminUserAdapterProfileUpdateError';
    vi.mocked(manager.inviteAdminUser).mockRejectedValue(error);
    const result = await inviteAdminUser(
      form({ fullName: 'Maria', email: 'a@b.com', role: 'seller' }),
      dependencies,
    );
    expect(result).toMatchObject({
      status: 'error',
      message: expect.stringContaining('convite foi enviado'),
    });
  });

  it.each([
    ['active', 'disabled'],
    ['disabled', 'active'],
  ] as const)('changes %s access to %s', async (current, next) => {
    vi.mocked(manager.getAdminUser).mockResolvedValue(healthy({ status: current }));
    expect(
      await setAdminUserStatus(form({ userId: 'target', status: next }), dependencies),
    ).toMatchObject({ status: 'success' });
    expect(manager.setAdminUserStatus).toHaveBeenCalledWith('target', next, 'actor');
  });

  it('blocks self-disable, pending activation, inconsistent profile and last admin disable', async () => {
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(healthy({ id: 'actor', role: 'admin' }));
    expect(
      await setAdminUserStatus(form({ userId: 'actor', status: 'disabled' }), dependencies),
    ).toMatchObject({ status: 'error' });
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(healthy({ status: 'pending' }));
    expect(
      await setAdminUserStatus(form({ userId: 'target', status: 'active' }), dependencies),
    ).toMatchObject({ status: 'error' });
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(
      healthy({ profileState: 'invalid', role: null, status: null }),
    );
    expect(
      await setAdminUserStatus(form({ userId: 'target', status: 'disabled' }), dependencies),
    ).toMatchObject({ status: 'error' });
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(healthy({ role: 'admin' }));
    vi.mocked(manager.countActiveAdmins).mockResolvedValue(1);
    expect(
      await setAdminUserStatus(form({ userId: 'target', status: 'disabled' }), dependencies),
    ).toMatchObject({ message: expect.stringContaining('último administrador') });
  });

  it('changes valid roles and rejects arbitrary roles', async () => {
    expect(
      await setAdminUserRole(form({ userId: 'target', role: 'admin' }), dependencies),
    ).toMatchObject({ status: 'success' });
    expect(manager.setAdminUserRole).toHaveBeenCalledWith('target', 'admin');
    expect(
      await setAdminUserRole(form({ userId: 'target', role: 'owner' }), dependencies),
    ).toMatchObject({ status: 'error' });
  });

  it('blocks self-demotion, last-admin demotion and inconsistent profile role changes', async () => {
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(healthy({ id: 'actor', role: 'admin' }));
    expect(
      await setAdminUserRole(form({ userId: 'actor', role: 'seller' }), dependencies),
    ).toMatchObject({ status: 'error' });
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(healthy({ role: 'admin' }));
    vi.mocked(manager.countActiveAdmins).mockResolvedValue(1);
    expect(
      await setAdminUserRole(form({ userId: 'target', role: 'seller' }), dependencies),
    ).toMatchObject({ message: expect.stringContaining('último administrador') });
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(
      healthy({ profileState: 'missing', role: null, status: null }),
    );
    expect(
      await setAdminUserRole(form({ userId: 'target', role: 'seller' }), dependencies),
    ).toMatchObject({ status: 'error' });
  });

  it('sends recovery to the authoritative email and handles missing users/errors', async () => {
    expect(
      await sendAdminUserPasswordRecovery(form({ userId: 'target' }), dependencies),
    ).toMatchObject({ status: 'success' });
    expect(manager.requestPasswordRecovery).toHaveBeenCalledWith(
      'target',
      'user@example.com',
      'https://app.example.com/recovery',
    );
    expect(dependencies.revalidate).toHaveBeenCalledWith('/admin/users');
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(null);
    expect(
      await sendAdminUserPasswordRecovery(form({ userId: 'unknown' }), dependencies),
    ).toMatchObject({ status: 'error' });
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(healthy({ email: null }));
    expect(
      await sendAdminUserPasswordRecovery(form({ userId: 'target' }), dependencies),
    ).toMatchObject({ status: 'error' });
    vi.mocked(manager.getAdminUser).mockResolvedValueOnce(healthy());
    vi.mocked(manager.requestPasswordRecovery).mockRejectedValue(new Error('provider'));
    expect(
      await sendAdminUserPasswordRecovery(form({ userId: 'target' }), dependencies),
    ).toMatchObject({ status: 'error' });
  });

  it('authorizes before every privileged operation', async () => {
    const denied = {
      ...dependencies,
      authorize: vi.fn(async () => {
        throw new Error('denied');
      }),
    };
    await expect(
      inviteAdminUser(form({ fullName: 'Maria', email: 'a@b.com', role: 'seller' }), denied),
    ).rejects.toThrow('denied');
    await expect(
      setAdminUserStatus(form({ userId: 'target', status: 'disabled' }), denied),
    ).rejects.toThrow('denied');
    await expect(
      setAdminUserRole(form({ userId: 'target', role: 'admin' }), denied),
    ).rejects.toThrow('denied');
    await expect(sendAdminUserPasswordRecovery(form({ userId: 'target' }), denied)).rejects.toThrow(
      'denied',
    );
  });
});
