import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  AdminUserSupabaseAdapter,
  createAdminUserSupabaseClient,
  mapAdminUser,
} from '../src/admin-user-supabase-adapter';
import {
  AdminUserAdapterConfigurationError,
  AdminUserAdapterQueryError,
  AdminUserAdapterRecoveryRateLimitError,
} from '../src/errors';

function authUser(overrides: Partial<User> = {}): User {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-01T10:00:00.000Z',
    email: 'pessoa@example.com',
    last_sign_in_at: '2026-08-20T12:00:00.000Z',
    ...overrides,
  };
}

describe('admin user Supabase adapter', () => {
  it('falha claramente quando a configuração privilegiada está ausente', () => {
    expect(() => createAdminUserSupabaseClient({ url: '', serverKey: '' })).toThrow(
      AdminUserAdapterConfigurationError,
    );
  });

  it('combina Auth user e profile no contrato administrativo', () => {
    expect(
      mapAdminUser(authUser(), {
        id: '10000000-0000-4000-8000-000000000001',
        full_name: 'Pessoa Admin',
        role: 'admin',
        status: 'active',
      }),
    ).toEqual({
      id: '10000000-0000-4000-8000-000000000001',
      email: 'pessoa@example.com',
      fullName: 'Pessoa Admin',
      role: 'admin',
      status: 'active',
      profileState: 'valid',
      passwordRecoveryRequestedAt: null,
      createdAt: '2026-08-01T10:00:00.000Z',
      lastSignInAt: '2026-08-20T12:00:00.000Z',
    });
  });

  it('preserva campos opcionais ausentes como null', () => {
    expect(
      mapAdminUser(authUser({ email: undefined, last_sign_in_at: undefined }), {
        id: '10000000-0000-4000-8000-000000000001',
        full_name: null,
        role: 'seller',
        status: 'pending',
      }),
    ).toMatchObject({ email: null, fullName: null, lastSignInAt: null });
  });

  it('expõe profile ausente ou inválido sem conceder role/status implícitos', () => {
    expect(mapAdminUser(authUser(), undefined)).toMatchObject({
      role: null,
      status: null,
      profileState: 'missing',
    });
    expect(
      mapAdminUser(authUser(), {
        id: '10000000-0000-4000-8000-000000000001',
        full_name: 'Registro inconsistente',
        role: 'owner',
        status: 'active',
      }),
    ).toMatchObject({
      fullName: 'Registro inconsistente',
      role: null,
      status: null,
      profileState: 'invalid',
    });
  });

  it('pagina Auth users e consulta profiles uma vez por lote', async () => {
    const first = authUser();
    const second = authUser({
      id: '20000000-0000-4000-8000-000000000002',
      email: 'segunda@example.com',
    });
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: [first], nextPage: 2 }, error: null })
      .mockResolvedValueOnce({ data: { users: [second], nextPage: null }, error: null });
    const profileRows = new Map([
      [first.id, { id: first.id, full_name: 'Primeira', role: 'admin', status: 'active' }],
      [second.id, { id: second.id, full_name: 'Segunda', role: 'seller', status: 'active' }],
    ]);
    const profileIn = vi.fn(async (_field: string, ids: readonly string[]) => ({
      data: ids.map((id) => profileRows.get(id)),
      error: null,
    }));
    const query = { select: () => query, in: profileIn };
    const client = {
      auth: { admin: { listUsers } },
      from: vi.fn(() => query),
    } as unknown as SupabaseClient;

    const result = await new AdminUserSupabaseAdapter(client).listAdminUsers();

    expect(result.map((user) => user.id)).toEqual([first.id, second.id]);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
    expect(profileIn).toHaveBeenCalledTimes(2);
  });

  it('sanitiza falhas do Auth Admin e da consulta de profiles', async () => {
    const authFailure = {
      auth: {
        admin: {
          listUsers: vi.fn(async () => ({ data: { users: [] }, error: new Error('secret auth') })),
        },
      },
    } as unknown as SupabaseClient;
    await expect(new AdminUserSupabaseAdapter(authFailure).listAdminUsers()).rejects.toMatchObject({
      name: AdminUserAdapterQueryError.name,
      message: 'Não foi possível listar usuários do Supabase Auth.',
    });

    const query = {
      select: () => query,
      in: vi.fn(async () => ({ data: null, error: new Error('secret database') })),
    };
    const profileFailure = {
      auth: {
        admin: {
          listUsers: vi.fn(async () => ({
            data: { users: [authUser()], nextPage: null },
            error: null,
          })),
        },
      },
      from: () => query,
    } as unknown as SupabaseClient;
    await expect(
      new AdminUserSupabaseAdapter(profileFailure).listAdminUsers(),
    ).rejects.toMatchObject({
      name: AdminUserAdapterQueryError.name,
      message: 'Não foi possível listar profiles administrativos.',
    });
  });

  it('convida pelo Auth e configura o profile criado pelo trigger como pending', async () => {
    const invited = authUser();
    const single = vi.fn(async () => ({ data: { id: invited.id }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const inviteUserByEmail = vi.fn(async () => ({ data: { user: invited }, error: null }));
    const client = {
      auth: { admin: { inviteUserByEmail } },
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient;

    await expect(
      new AdminUserSupabaseAdapter(client).inviteAdminUser({
        email: 'pessoa@example.com',
        fullName: 'Pessoa Admin',
        invitedBy: 'actor-id',
        redirectTo: 'https://app.example.com/invite',
        role: 'admin',
      }),
    ).resolves.toBe(invited.id);
    expect(inviteUserByEmail).toHaveBeenCalledWith('pessoa@example.com', {
      data: { full_name: 'Pessoa Admin' },
      redirectTo: 'https://app.example.com/invite',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Pessoa Admin',
        invited_by: 'actor-id',
        role: 'admin',
        status: 'pending',
      }),
    );
  });

  it('solicita recovery e marca/limpa o tracking sem alterar status', async () => {
    const resetPasswordForEmail = vi
      .fn()
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('provider detail') });
    const single = vi.fn(async () => ({ data: { id: authUser().id }, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const adapter = new AdminUserSupabaseAdapter({
      auth: { resetPasswordForEmail },
      from: vi.fn(() => ({ update })),
    } as unknown as SupabaseClient);
    await adapter.requestPasswordRecovery(
      authUser().id,
      'pessoa@example.com',
      'https://app.example.com/recovery',
    );
    expect(resetPasswordForEmail).toHaveBeenCalledWith('pessoa@example.com', {
      redirectTo: 'https://app.example.com/recovery',
    });
    expect(update).toHaveBeenCalledWith({
      password_recovery_requested_at: expect.any(String),
    });
    await adapter.clearPasswordRecoveryRequested(authUser().id);
    expect(update).toHaveBeenLastCalledWith({ password_recovery_requested_at: null });
    await adapter.requestPasswordRecovery(
      authUser().id,
      'pessoa@example.com',
      'https://app.example.com/recovery',
    );
    expect(update).toHaveBeenLastCalledWith({
      password_recovery_requested_at: expect.any(String),
    });
    await expect(
      adapter.requestPasswordRecovery(
        authUser().id,
        'pessoa@example.com',
        'https://app.example.com/recovery',
      ),
    ).rejects.toMatchObject({
      name: 'AdminUserAdapterRecoveryError',
      message: 'Password recovery request failed.',
    });
  });

  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
    'maps %s without falsely updating recovery tracking',
    async (code) => {
      const resetPasswordForEmail = vi.fn(async () => ({ data: null, error: { code } }));
      const update = vi.fn();
      const adapter = new AdminUserSupabaseAdapter({
        auth: { resetPasswordForEmail },
        from: vi.fn(() => ({ update })),
      } as unknown as SupabaseClient);

      await expect(
        adapter.requestPasswordRecovery(
          authUser().id,
          'pessoa@example.com',
          'https://app.example.com/recovery',
        ),
      ).rejects.toBeInstanceOf(AdminUserAdapterRecoveryRateLimitError);
      expect(update).not.toHaveBeenCalled();
    },
  );
});
