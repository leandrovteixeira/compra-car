import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET as inviteLanding } from '../src/app/auth/callback/invite/route';
import { GET as recoveryLanding } from '../src/app/auth/callback/recovery/route';
import {
  buildAuthFlowConfirmationRedirect,
  buildAuthFlowRedirect,
} from '../src/auth/auth-flow-redirect';
import { INVITE_ATTEMPT_COOKIE, validInviteAttempt } from '../src/auth/invite-attempt';
import { RECOVERY_ATTEMPT_COOKIE, validRecoveryAttempt } from '../src/auth/recovery-attempt';
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
  it('makes both Auth e-mail landing GETs non-consuming', () => {
    const invite = source('../src/app/auth/callback/invite/route.ts'),
      recovery = source('../src/app/auth/callback/recovery/route.ts');
    expect(invite).toContain("searchParams.get('token_hash')");
    expect(invite).toContain("searchParams.get('type')");
    expect(invite).toContain('validInviteAttempt');
    expect(invite).toContain('INVITE_ATTEMPT_COOKIE');
    expect(invite).not.toContain('verifyInviteToken');
    expect(invite).not.toContain('exchangeCodeForSession');
    expect(invite).not.toContain("searchParams.get('code')");
    expect(invite).not.toContain('access_token');
    expect(invite).not.toContain('refresh_token');
    expect(recovery).toContain("searchParams.get('token_hash')");
    expect(recovery).toContain("searchParams.get('type')");
    expect(recovery).toContain('validRecoveryAttempt');
    expect(recovery).toContain('RECOVERY_ATTEMPT_COOKIE');
    expect(recovery).not.toContain('verifyRecoveryToken');
    expect(recovery).not.toContain('exchangeAuthCode');
    expect(recovery).not.toContain('access_token');
    expect(recovery).not.toContain('refresh_token');
    for (const route of [invite, recovery]) {
      expect(route).not.toContain("searchParams.get('next')");
      expect(route).not.toContain('SUPABASE_SERVER_KEY');
      expect(route).not.toContain('request.url');
    }
    expect(invite).toContain('buildAuthFlowConfirmationRedirect');
    expect(recovery).toContain('buildAuthFlowConfirmationRedirect');
  });
  it('stores a protected invite attempt and redirects a safe GET to confirmation', async () => {
    const previousInvite = process.env.AUTH_INVITE_REDIRECT_URL;
    process.env.AUTH_INVITE_REDIRECT_URL =
      'https://compra-carqa.up.railway.app/auth/callback/invite';
    try {
      const response = await inviteLanding(
        new NextRequest(
          'https://internal.invalid/auth/callback/invite?token_hash=invite-hash&type=invite',
        ),
      );
      expect(response.headers.get('location')).toBe(
        'https://compra-carqa.up.railway.app/auth/invite/confirm',
      );
      expect(response.cookies.get(INVITE_ATTEMPT_COOKIE)).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        value: 'invite-hash',
      });
      expect(response.headers.get('set-cookie')).toContain('Max-Age=900');
      expect(response.headers.get('set-cookie')).toContain('Path=/auth/invite');
      expect(response.headers.get('set-cookie')).not.toContain('cc-auth-flow');
    } finally {
      if (previousInvite === undefined) delete process.env.AUTH_INVITE_REDIRECT_URL;
      else process.env.AUTH_INVITE_REDIRECT_URL = previousInvite;
    }
  });
  it('stores a protected short-lived attempt and redirects a safe GET to confirmation', async () => {
    const previousRecovery = process.env.AUTH_RECOVERY_REDIRECT_URL;
    process.env.AUTH_RECOVERY_REDIRECT_URL =
      'https://compra-carqa.up.railway.app/auth/callback/recovery';
    try {
      const response = await recoveryLanding(
        new NextRequest(
          'https://internal.invalid/auth/callback/recovery?token_hash=recovery-hash&type=recovery',
        ),
      );
      expect(response.headers.get('location')).toBe(
        'https://compra-carqa.up.railway.app/auth/recovery/confirm',
      );
      expect(response.cookies.get(RECOVERY_ATTEMPT_COOKIE)).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        value: 'recovery-hash',
      });
      expect(response.headers.get('set-cookie')).toContain('Max-Age=900');
      expect(response.headers.get('set-cookie')).toContain('Path=/auth/recovery');
    } finally {
      if (previousRecovery === undefined) delete process.env.AUTH_RECOVERY_REDIRECT_URL;
      else process.env.AUTH_RECOVERY_REDIRECT_URL = previousRecovery;
    }
  });
  it('leaves the OTP untouched across landing and confirmation GETs until explicit verification', async () => {
    const calls: unknown[] = [];
    const verifier = async (params: unknown) => {
      calls.push(params);
      return { error: null };
    };
    expect(validRecoveryAttempt('recovery-hash', 'recovery')).toBe(true);
    const confirmation = source('../src/app/auth/recovery/confirm/page.tsx');
    expect(confirmation).not.toContain('verifyRecoveryToken');
    expect(confirmation).not.toContain('token_hash');
    expect(calls).toHaveLength(0);
    await expect(verifyRecoveryToken('recovery-hash', 'recovery', verifier)).resolves.toBe(true);
    expect(calls).toHaveLength(1);
  });
  it('simulates invite scanner GETs without verifying until explicit acceptance', async () => {
    const calls: unknown[] = [];
    const verifier = async (params: unknown) => {
      calls.push(params);
      return { error: null };
    };
    expect(validInviteAttempt('invite-hash', 'invite')).toBe(true);
    const confirmation = source('../src/app/auth/invite/confirm/page.tsx');
    expect(confirmation).not.toContain('verifyInviteToken');
    expect(confirmation).not.toContain('token_hash');
    expect(calls).toHaveLength(0);
    await expect(verifyInviteToken('invite-hash', 'invite', verifier)).resolves.toBe(true);
    expect(calls).toEqual([{ token_hash: 'invite-hash', type: 'invite' }]);
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
    const inviteLandingSource = source('../src/app/auth/callback/invite/route.ts');
    const inviteConfirmationAction = source('../src/app/auth/invite/confirm/actions.ts');
    const recoveryLandingSource = source('../src/app/auth/callback/recovery/route.ts');
    const confirmationAction = source('../src/app/auth/recovery/confirm/actions.ts');
    for (const content of [
      inviteLandingSource,
      inviteConfirmationAction,
      recoveryLandingSource,
      confirmationAction,
    ]) {
      expect(content).toContain('httpOnly: true');
      expect(content).toContain('authFlowUsesSecureCookies');
    }
    expect(recoveryLandingSource).toContain('RECOVERY_ATTEMPT_MAX_AGE');
    expect(confirmationAction).toContain("cookieStore.set(RECOVERY_ATTEMPT_COOKIE, ''");
    expect(confirmationAction).toContain("path: '/auth/recovery'");
    expect(confirmationAction).toContain('maxAge: 0');
    expect(confirmationAction).toContain("cookieStore.set('cc-auth-flow', 'recovery'");
    expect(inviteLandingSource).toContain('INVITE_ATTEMPT_MAX_AGE');
    expect(inviteConfirmationAction).toContain("cookieStore.set(INVITE_ATTEMPT_COOKIE, ''");
    expect(inviteConfirmationAction).toContain("path: '/auth/invite'");
    expect(inviteConfirmationAction).toContain('maxAge: 0');
    expect(inviteConfirmationAction).toContain("cookieStore.set('cc-auth-flow', 'invite'");
  });
  it('validates missing/wrong token state and keeps confirmation errors controlled', () => {
    expect(validRecoveryAttempt(null, 'recovery')).toBe(false);
    expect(validRecoveryAttempt('hash', 'invite')).toBe(false);
    expect(validRecoveryAttempt('x'.repeat(4097), 'recovery')).toBe(false);
    expect(validInviteAttempt(null, 'invite')).toBe(false);
    expect(validInviteAttempt('hash', 'recovery')).toBe(false);
    expect(validInviteAttempt('x'.repeat(4097), 'invite')).toBe(false);
    const confirmation = source('../src/app/auth/recovery/confirm/page.tsx');
    const action = source('../src/app/auth/recovery/confirm/actions.ts');
    expect(confirmation).toContain('Este link de recuperação não é mais válido.');
    expect(action).not.toContain('SUPABASE_SERVER_KEY');
    expect(action).not.toContain('service_role');
    expect(action).not.toContain('console.');
    const inviteConfirmation = source('../src/app/auth/invite/confirm/page.tsx');
    const inviteAction = source('../src/app/auth/invite/confirm/actions.ts');
    expect(inviteConfirmation).toContain('Este convite não é mais válido.');
    expect(inviteAction).not.toContain('SUPABASE_SERVER_KEY');
    expect(inviteAction).not.toContain('service_role');
    expect(inviteAction).not.toContain('console.');
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
      expect(buildAuthFlowConfirmationRedirect('recovery', true).toString()).toBe(
        'https://compra-carqa.up.railway.app/auth/recovery/confirm',
      );
      expect(buildAuthFlowConfirmationRedirect('invite', true).toString()).toBe(
        'https://compra-carqa.up.railway.app/auth/invite/confirm',
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
