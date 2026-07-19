import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { LegacyAdapterConfigurationError, LegacyAdapterServerOnlyError } from './errors';

export interface LegacySupabaseClientConfig {
  readonly url: string;
  readonly serverKey: string;
}

export function assertLegacyServerRuntime(): void {
  if (typeof window !== 'undefined') {
    throw new LegacyAdapterServerOnlyError(
      'O LegacySupabaseAdapter só pode ser criado em runtime de servidor.',
    );
  }
}

function requiredSecret(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new LegacyAdapterConfigurationError(`Variável de ambiente obrigatória ausente: ${name}.`);
  }

  return value.trim();
}

export function createLegacySupabaseClient(config: LegacySupabaseClientConfig): SupabaseClient {
  assertLegacyServerRuntime();

  const url = requiredSecret(config.url, 'SUPABASE_URL');
  const serverKey = requiredSecret(config.serverKey, 'SUPABASE_SERVER_KEY');

  return createClient(url, serverKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createLegacySupabaseClientFromEnv(): SupabaseClient {
  return createLegacySupabaseClient({
    url: process.env.SUPABASE_URL ?? '',
    serverKey: process.env.SUPABASE_SERVER_KEY ?? '',
  });
}
