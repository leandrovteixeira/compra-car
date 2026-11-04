import 'server-only';

import { AdminUserSupabaseAdapter } from '@compra-car/adapter-supabase';
import type { AdminUserDto } from '@compra-car/contracts';

import { createPrivilegedAdminClient } from '@/auth/admin-client';
import { requireFeatureIdentity23C } from '@/auth/account-tier-server';

export interface AdminUserReader {
  listAdminUsers(): Promise<readonly AdminUserDto[]>;
}

interface LoadAdminUsersDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createReader: () => AdminUserReader;
}

const DEFAULT_DEPENDENCIES: LoadAdminUsersDependencies = {
  authorize: () => requireFeatureIdentity23C('settings', 'write'),
  createReader: () => new AdminUserSupabaseAdapter(createPrivilegedAdminClient()),
};

export async function loadAdminUsers(
  dependencies: LoadAdminUsersDependencies = DEFAULT_DEPENDENCIES,
): Promise<readonly AdminUserDto[]> {
  await dependencies.authorize();
  return dependencies.createReader().listAdminUsers();
}
