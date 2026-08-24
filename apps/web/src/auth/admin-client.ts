import 'server-only';

import { createAdminUserSupabaseClient } from '@compra-car/adapter-supabase';

export function createPrivilegedAdminClient() {
  return createAdminUserSupabaseClient({
    url: process.env.SUPABASE_URL ?? '',
    serverKey: process.env.SUPABASE_SERVER_KEY ?? '',
  });
}
