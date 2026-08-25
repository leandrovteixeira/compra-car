import type { AdminUserDto } from '@compra-car/contracts';
import { AdminUserAdapterRecoveryRateLimitError } from '@compra-car/adapter-supabase';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  PASSWORD_RECOVERY_NEUTRAL_MESSAGE,
  requestPasswordRecovery,
  type PasswordRecoveryRequestDependencies,
  type PasswordRecoveryRequester,
} from '../src/application/auth/request-password-recovery';
import { isPublicPath } from '../src/auth/route-policy';

const knownUser: AdminUserDto = {
  createdAt: '2026-08-25T10:00:00.000Z',
  email: 'pessoa@example.com',
  fullName: 'Pessoa',
  id: 'user-id',
  lastSignInAt: null,
  passwordRecoveryRequestedAt: null,
  profileState: 'valid',
  role: 'seller',
  status: 'active',
};

function form(email: string): FormData {
  const data = new FormData();
  data.set('email', email);
  return data;
}

function dependencies(user: AdminUserDto | null): {
  readonly dependencies: PasswordRecoveryRequestDependencies;
  readonly requester: PasswordRecoveryRequester;
} {
  const requester: PasswordRecoveryRequester = {
    findAdminUserByEmail: vi.fn(async () => user),
    requestPasswordRecovery: vi.fn(async () => undefined),
  };
  return {
    requester,
    dependencies: {
      createRequester: () => requester,
      recoveryRedirectUrl: () => 'https://app.example.com/auth/callback/recovery',
    },
  };
}

describe('public forgot password', () => {
  it('links the login UX to a focused public form without exposing privileged configuration', () => {
    const login = readFileSync(resolve(__dirname, '../src/app/login/page.tsx'), 'utf8');
    const formSource = readFileSync(
      resolve(__dirname, '../src/components/forgot-password-form.tsx'),
      'utf8',
    );

    expect(login).toContain('Esqueci minha senha');
    expect(login).toContain('href="/forgot-password"');
    expect(formSource).toContain('Enviar instruções');
    expect(formSource).not.toContain('SUPABASE_SERVER_KEY');
    expect(formSource).not.toContain('auth.admin');
  });
  it('keeps the page public and initiates recovery for a normalized existing email', async () => {
    const setup = dependencies(knownUser);
    const result = await requestPasswordRecovery(form(' PESSOA@EXAMPLE.COM '), setup.dependencies);

    expect(isPublicPath('/forgot-password')).toBe(true);
    expect(result).toEqual({ status: 'success', message: PASSWORD_RECOVERY_NEUTRAL_MESSAGE });
    expect(setup.requester.findAdminUserByEmail).toHaveBeenCalledWith('pessoa@example.com');
    expect(setup.requester.requestPasswordRecovery).toHaveBeenCalledWith(
      'user-id',
      'pessoa@example.com',
      'https://app.example.com/auth/callback/recovery',
    );
  });

  it('returns the same neutral response for an unknown email without creating tracking', async () => {
    const known = dependencies(knownUser);
    const unknown = dependencies(null);
    const knownResult = await requestPasswordRecovery(
      form('pessoa@example.com'),
      known.dependencies,
    );
    const unknownResult = await requestPasswordRecovery(
      form('unknown@example.com'),
      unknown.dependencies,
    );

    expect(unknownResult).toEqual(knownResult);
    expect(unknown.requester.requestPasswordRecovery).not.toHaveBeenCalled();
  });

  it('rejects malformed input and safely permits repeated requests', async () => {
    const setup = dependencies(knownUser);
    await expect(
      requestPasswordRecovery(form('invalid'), setup.dependencies),
    ).resolves.toMatchObject({
      status: 'error',
    });
    await requestPasswordRecovery(form('pessoa@example.com'), setup.dependencies);
    await requestPasswordRecovery(form('pessoa@example.com'), setup.dependencies);
    expect(setup.requester.requestPasswordRecovery).toHaveBeenCalledTimes(2);
  });

  it('maps unexpected infrastructure failure without exposing provider details', async () => {
    const setup = dependencies(knownUser);
    vi.mocked(setup.requester.requestPasswordRecovery).mockRejectedValue(
      new Error('secret detail'),
    );
    await expect(
      requestPasswordRecovery(form('pessoa@example.com'), setup.dependencies),
    ).resolves.toEqual({
      status: 'error',
      message: 'Não foi possível concluir a solicitação. Tente novamente.',
    });
  });

  it('keeps provider rate limits anti-enumeration safe', async () => {
    const setup = dependencies(knownUser);
    vi.mocked(setup.requester.requestPasswordRecovery).mockRejectedValue(
      new AdminUserAdapterRecoveryRateLimitError('provider rate limit'),
    );
    await expect(
      requestPasswordRecovery(form('pessoa@example.com'), setup.dependencies),
    ).resolves.toEqual({ status: 'success', message: PASSWORD_RECOVERY_NEUTRAL_MESSAGE });
  });
});
