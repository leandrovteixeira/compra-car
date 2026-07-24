import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type { UpdateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import {
  executeAdminProductUpdate as executeUpdate,
  type UpdateAdminProductDependencies,
} from '@/application/admin/update-admin-product';
import { requireRole } from '@/auth/authorization';

const defaultDependencies: UpdateAdminProductDependencies = {
  authorize: () => requireRole('admin'),
  createRepository: () => new LegacySupabaseAdapter(),
  revalidate: revalidatePath,
};

export async function executeAdminProductUpdate(
  id: string,
  formData: FormData,
): Promise<UpdateAdministrativeVehicleActionStateDto> {
  return executeUpdate(id, formData, defaultDependencies);
}
