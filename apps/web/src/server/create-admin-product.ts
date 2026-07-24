import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type { CreateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import {
  executeAdminProductCreation as executeCreation,
  type CreateAdminProductDependencies,
} from '@/application/admin/create-admin-product';
import { requireRole } from '@/auth/authorization';

const defaultDependencies: CreateAdminProductDependencies = {
  authorize: () => requireRole('admin'),
  createRepository: () => new LegacySupabaseAdapter(),
  revalidate: revalidatePath,
};

export async function executeAdminProductCreation(
  formData: FormData,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  return executeCreation(formData, defaultDependencies);
}
