import 'server-only';

import { createMutableServerClient } from './server-client';

interface RecoveryOtpResult {
  readonly error: unknown;
}

export type RecoveryOtpVerifier = (params: {
  readonly token_hash: string;
  readonly type: 'recovery';
}) => Promise<RecoveryOtpResult>;

export async function verifyRecoveryToken(
  tokenHash: string | null,
  type: string | null,
  verifier?: RecoveryOtpVerifier,
): Promise<boolean> {
  if (!tokenHash || tokenHash.length > 4096 || type !== 'recovery') return false;

  const verifyOtp =
    verifier ??
    (async (params) => {
      const client = await createMutableServerClient();
      return client.auth.verifyOtp(params);
    });

  try {
    const { error } = await verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    return !error;
  } catch {
    return false;
  }
}
