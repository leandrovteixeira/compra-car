import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAuthFlowRedirect } from '../src/auth/auth-flow-redirect';
import { isPublicPath } from '../src/auth/route-policy';
import { verifyInviteToken } from '../src/auth/verify-invite-token';
import { verifyRecoveryToken } from '../src/auth/verify-recovery-token';
const source = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
describe('auth lifecycle callback routes', () => {
  it('keeps auth callbacks public while application routes remain protected', () => {
    expect(isPublicPath('/auth/callback/invite')).toBe(true);
    expect(isPublicPath('/auth/recovery')).toBe(true);
    expect(isPublicPath('/admin/users')).toBe(false);
  });
  it('uses token-hash verification for invite and recovery', () => {
    const invite = source('../src/app/auth/callback/invite/route.ts'),
      recovery = source('../src/app/auth/callback/recovery/route.ts');
    expect(invite).toContain("searchParams.get('token_hash')");
    expect(invite).toContain("searchParams.get('type')");
    expect(invite).toContain('verifyInviteToken');
    expect(invite).not.toContain('exchangeCodeForSession');
    expect(invite).not.toContain("searchParams.get('code')");
    expect(invite).not.toContain('access_token');
    expect(invite).not.toContain('refresh_token');
    expect(recovery).toContain("searchParams.get('token_hash')");
    expect(recovery).toContain("searchParams.get('type')");
    expect(recovery).toContain('verifyRecoveryToken');
    expect(recovery).not.toContain('exchangeAuthCode');
    expect(recovery).not.toContain('access_token');
    expect(recovery).not.toContain('refresh_token');
    for (const route of [invite, recovery]) {
      expect(route).not.toContain("searchParams.get('next')");
      expect(route).not.toContain('SUPABASE_SERVER_KEY');
      expect(route).not.toContain('request.url');
      expect(route).toContain('buildAuthFlowRedirect');
    }
  });
  it('verifies only recovery token hashes and maps expired/provider errors safely', async () => {
    const calls: unknown[] = [];
    const success = async (params: unknown) => {
      calls.push(params);
      return { error: null };
    };

    await expect(verifyRecoveryToken('recovery-hash', 'recovery', success)).resolves.toBe(true);
    expect(calls).toEqual([{ token_hash: 'recovery-hash', type: 'recovery' }]);
    await expect(verifyRecoveryToken(null, 'recovery', success)).resolves.toBe(false);
    await expect(verifyRecoveryToken('recovery-hash', 'invite', success)).resolves.toBe(false);
    expect(calls).toHaveLength(1);
    await expect(
      verifyRecoveryToken('recovery-hash', 'recovery', async () => ({
        error: new Error('expired'),
      })),
    ).resolves.toBe(false);
    await expect(
      verifyRecoveryToken('recovery-hash', 'recovery', async () => {
        throw new Error('provider');
      }),
    ).resolves.toBe(false);
  });
  it('verifies only a valid invite token hash and maps provider errors safely', async () => {
    const calls: unknown[] = [];
    const success = async (params: unknown) => {
      calls.push(params);
      return { error: null };
    };

    await expect(verifyInviteToken('hash-value', 'invite', success)).resolves.toBe(true);
    expect(calls).toEqual([{ token_hash: 'hash-value', type: 'invite' }]);
    await expect(verifyInviteToken(null, 'invite', success)).resolves.toBe(false);
    await expect(verifyInviteToken('hash-value', 'recovery', success)).resolves.toBe(false);
    expect(calls).toHaveLength(1);
    await expect(
      verifyInviteToken('hash-value', 'invite', async () => ({ error: new Error('expired') })),
    ).resolves.toBe(false);
    await expect(
      verifyInviteToken('hash-value', 'invite', async () => {
        throw new Error('provider');
      }),
    ).resolves.toBe(false);
  });
  it('distinguishes flows with short HttpOnly cookies', () => {
    for (const route of ['invite', 'recovery']) {
      const content = source(`../src/app/auth/callback/${route}/route.ts`);
      expect(content).toContain('httpOnly: true');
      expect(content).toContain('maxAge: 900');
      expect(content).toContain(`'${route}'`);
      expect(content).toContain('authFlowUsesSecureCookies');
    }
  });
  it('derives hosted redirects only from trusted configured callback URLs', () => {
    const redirects = source('../src/auth/auth-flow-redirect.ts');
    const previousInvite = process.env.AUTH_INVITE_REDIRECT_URL;
    const previousRecovery = process.env.AUTH_RECOVERY_REDIRECT_URL;
    process.env.AUTH_INVITE_REDIRECT_URL =
      'https://compra-carqa.up.railway.app/auth/callback/invite';
    process.env.AUTH_RECOVERY_REDIRECT_URL =
      'https://compra-carqa.up.railway.app/auth/callback/recovery';

    try {
      expect(buildAuthFlowRedirect('invite', true).toString()).toBe(
        'https://compra-carqa.up.railway.app/auth/invite',
      );
      expect(buildAuthFlowRedirect('invite', false).toString()).toBe(
        'https://compra-carqa.up.railway.app/auth/invite?error=invalid',
      );
      expect(buildAuthFlowRedirect('recovery', true).toString()).toBe(
        'https://compra-carqa.up.railway.app/auth/recovery',
      );
      expect(buildAuthFlowRedirect('recovery', false).toString()).toBe(
        'https://compra-carqa.up.railway.app/auth/recovery?error=invalid',
      );
    } finally {
      if (previousInvite === undefined) delete process.env.AUTH_INVITE_REDIRECT_URL;
      else process.env.AUTH_INVITE_REDIRECT_URL = previousInvite;
      if (previousRecovery === undefined) delete process.env.AUTH_RECOVERY_REDIRECT_URL;
      else process.env.AUTH_RECOVERY_REDIRECT_URL = previousRecovery;
    }

    expect(redirects).toContain('getAdminInviteRedirectUrl()');
    expect(redirects).toContain('getAdminRecoveryRedirectUrl()');
    expect(redirects).not.toContain('request.url');
    expect(redirects).not.toContain('headers()');
    expect(redirects).not.toContain('0.0.0.0');
    expect(redirects).not.toContain('localhost');
  });
  it('does not introduce public signup', () => {
    expect(source('../src/app/auth/invite/actions.ts')).not.toContain('signUp(');
    expect(source('../src/app/auth/recovery/actions.ts')).not.toContain('signUp(');
  });
});
