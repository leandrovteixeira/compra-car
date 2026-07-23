import type { AuthClientConfig } from '@compra-car/adapter-supabase';

export function getAuthClientConfig(): AuthClientConfig {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  };
}
