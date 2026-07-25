import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type { CreateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import {
  executeAdminProductDuplication as executeDuplication,
  type DuplicateAdminProductDependencies,
} from '@/application/admin/duplicate-admin-product';
import { requireRole } from '@/auth/authorization';

const defaultDependencies: DuplicateAdminProductDependencies = {
  authorize: () => requireRole('admin'),
  createRepository: () => new LegacySupabaseAdapter(),
  revalidate: revalidatePath,
};

export async function executeAdminProductDuplication(
  sourceProductId: string,
  formData: FormData,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  return executeDuplication(sourceProductId, formData, defaultDependencies);
}
