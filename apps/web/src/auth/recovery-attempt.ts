import 'server-only';

export const RECOVERY_ATTEMPT_COOKIE = 'cc-recovery-attempt';
export const RECOVERY_ATTEMPT_MAX_AGE = 900;

export function validRecoveryAttempt(tokenHash: string | null, type: string | null): boolean {
  return Boolean(tokenHash && tokenHash.length <= 4096 && type === 'recovery');
}
