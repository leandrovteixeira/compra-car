import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type {
  AdministrativeVehicleStatusPatchDto,
  UpdateAdministrativeVehicleStatusActionResultDto,
} from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import { executeAdminProductStatusUpdate } from '@/application/admin/update-admin-product-status';
import { requireRole } from '@/auth/authorization';
import { invalidateCatalog } from './catalog-cache';

export async function updateAdminProductStatus(
  id: string,
  patch: AdministrativeVehicleStatusPatchDto,
): Promise<UpdateAdministrativeVehicleStatusActionResultDto> {
  return executeAdminProductStatusUpdate(id, patch, {
    authorize: () => requireRole('admin'),
    createRepository: () => new LegacySupabaseAdapter(),
    invalidateCatalog,
    revalidate: revalidatePath,
  });
}
