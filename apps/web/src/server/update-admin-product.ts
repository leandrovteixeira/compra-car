import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type { UpdateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import {
  executeAdminProductUpdate as executeUpdate,
  type UpdateAdminProductDependencies,
} from '@/application/admin/update-admin-product';
import { requireFeatureIdentity23C } from '@/auth/account-tier-server';
import { invalidateCatalog } from './catalog-cache';

const defaultDependencies: UpdateAdminProductDependencies = {
  authorize: () => requireFeatureIdentity23C('vehicle-administration', 'write'),
  createRepository: () => new LegacySupabaseAdapter(),
  revalidate: revalidatePath,
  invalidateCatalog,
};

export async function executeAdminProductUpdate(
  id: string,
  formData: FormData,
): Promise<UpdateAdministrativeVehicleActionStateDto> {
  return executeUpdate(id, formData, defaultDependencies);
}
