import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { getAuthProfile, getVerifiedAuthUser } from '../src/auth';
import { AuthVerificationError } from '../src/errors';

function profileClient(data: unknown, error: unknown = null): SupabaseClient {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data, error }),
  };

  return {
    from: () => query,
  } as unknown as SupabaseClient;
}

describe('Supabase Auth adapter', () => {
  it('valida o usuário com Auth em vez de confiar na sessão local', async () => {
    const getUser = async () => ({ data: { user: { id: 'user-id' } }, error: null });
    const client = { auth: { getUser } } as unknown as SupabaseClient;

    await expect(getVerifiedAuthUser(client)).resolves.toEqual({ id: 'user-id' });
  });

  it('retorna null somente quando a sessão realmente não existe', async () => {
    const error = Object.assign(new Error('Auth session missing'), {
      name: 'AuthSessionMissingError',
    });
    const getUser = async () => ({ data: { user: null }, error });
    const client = { auth: { getUser } } as unknown as SupabaseClient;

    await expect(getVerifiedAuthUser(client)).resolves.toBeNull();
  });

  it('propaga erro técnico sanitizado em vez de simular logout', async () => {
    const getUser = async () => ({ data: { user: null }, error: new Error('network failed') });
    const client = { auth: { getUser } } as unknown as SupabaseClient;

    await expect(getVerifiedAuthUser(client)).rejects.toBeInstanceOf(AuthVerificationError);
  });

  it('aceita somente profile com role e status conhecidos', async () => {
    await expect(
      getAuthProfile(
        profileClient({
          id: 'user-id',
          full_name: 'Pessoa',
          role: 'admin',
          status: 'active',
        }),
        'user-id',
      ),
    ).resolves.toEqual({
      id: 'user-id',
      fullName: 'Pessoa',
      role: 'admin',
      status: 'active',
    });

    await expect(
      getAuthProfile(
        profileClient({
          id: 'user-id',
          full_name: null,
          role: 'unexpected',
          status: 'active',
        }),
        'user-id',
      ),
    ).resolves.toBeNull();
  });

  it('diferencia profile ausente de falha tÃ©cnica da consulta', async () => {
    await expect(getAuthProfile(profileClient(null), 'user-id')).resolves.toBeNull();
    await expect(
      getAuthProfile(profileClient(null, new Error('network failed')), 'user-id'),
    ).rejects.toBeInstanceOf(AuthVerificationError);
  });
});
