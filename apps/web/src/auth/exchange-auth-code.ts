import 'server-only';
import { createMutableServerClient } from './server-client';
export async function exchangeAuthCode(code: string | null): Promise<boolean> {
  if (!code || code.length > 2048) return false;
  const client = await createMutableServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  return !error;
}
