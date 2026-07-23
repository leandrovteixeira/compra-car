import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { getAuthProfile, getVerifiedAuthUser } from '../src/auth';

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

  it('retorna null quando a validação do usuário falha', async () => {
    const getUser = async () => ({ data: { user: null }, error: new Error('expired') });
    const client = { auth: { getUser } } as unknown as SupabaseClient;

    await expect(getVerifiedAuthUser(client)).resolves.toBeNull();
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
});
