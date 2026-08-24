import 'server-only';

import { createMutableServerClient } from './server-client';

interface InviteOtpResult {
  readonly error: unknown;
}

export type InviteOtpVerifier = (params: {
  readonly token_hash: string;
  readonly type: 'invite';
}) => Promise<InviteOtpResult>;

export async function verifyInviteToken(
  tokenHash: string | null,
  type: string | null,
  verifier?: InviteOtpVerifier,
): Promise<boolean> {
  if (!tokenHash || tokenHash.length > 4096 || type !== 'invite') return false;

  const verifyOtp =
    verifier ??
    (async (params) => {
      const client = await createMutableServerClient();
      return client.auth.verifyOtp(params);
    });

  try {
    const { error } = await verifyOtp({ token_hash: tokenHash, type: 'invite' });
    return !error;
  } catch {
    return false;
  }
}
