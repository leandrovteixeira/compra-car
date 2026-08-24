import type { AdminUserDto } from '@compra-car/contracts';
import { describe, expect, it, vi } from 'vitest';

import { loadAdminUsers, type AdminUserReader } from '../src/application/admin/load-admin-users';

const user: AdminUserDto = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'admin@example.com',
  fullName: 'Admin',
  role: 'admin',
  status: 'active',
  profileState: 'valid',
  createdAt: '2026-08-01T10:00:00.000Z',
  lastSignInAt: null,
};

describe('admin user application foundation', () => {
  it('autoriza admin antes de criar o reader privilegiado e listar usuários', async () => {
    const calls: string[] = [];
    const reader: AdminUserReader = {
      listAdminUsers: vi.fn(async () => {
        calls.push('read');
        return [user];
      }),
    };

    await expect(
      loadAdminUsers({
        authorize: vi.fn(async () => {
          calls.push('authorize');
        }),
        createReader: () => reader,
      }),
    ).resolves.toEqual([user]);
    expect(calls).toEqual(['authorize', 'read']);
  });

  it('não cria cliente privilegiado nem lê usuários quando autorização falha', async () => {
    const createReader = vi.fn<() => AdminUserReader>();
    const denied = new Error('redirect/non-admin');

    await expect(
      loadAdminUsers({
        authorize: vi.fn(async () => Promise.reject(denied)),
        createReader,
      }),
    ).rejects.toBe(denied);
    expect(createReader).not.toHaveBeenCalled();
  });

  it('propaga falha controlada do adapter para a futura boundary de UI', async () => {
    const unavailable = new Error('admin user list unavailable');
    await expect(
      loadAdminUsers({
        authorize: vi.fn(async () => undefined),
        createReader: () => ({ listAdminUsers: vi.fn(async () => Promise.reject(unavailable)) }),
      }),
    ).rejects.toBe(unavailable);
  });
});
