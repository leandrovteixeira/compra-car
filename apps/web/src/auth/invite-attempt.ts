import 'server-only';

export const INVITE_ATTEMPT_COOKIE = 'cc-invite-attempt';
export const INVITE_ATTEMPT_MAX_AGE = 900;

export function validInviteAttempt(tokenHash: string | null, type: string | null): boolean {
  return Boolean(tokenHash && tokenHash.length <= 4096 && type === 'invite');
}
