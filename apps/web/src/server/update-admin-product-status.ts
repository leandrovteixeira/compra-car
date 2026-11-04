import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type {
  AdministrativeVehicleStatusPatchDto,
  UpdateAdministrativeVehicleStatusActionResultDto,
} from '@compra-car/contracts';
import { revalidatePath } from 'next/cache';

import { executeAdminProductStatusUpdate } from '@/application/admin/update-admin-product-status';
import { requireFeatureIdentity23C } from '@/auth/account-tier-server';
import { invalidateCatalog } from './catalog-cache';

export async function updateAdminProductStatus(
  id: string,
  patch: AdministrativeVehicleStatusPatchDto,
): Promise<UpdateAdministrativeVehicleStatusActionResultDto> {
  return executeAdminProductStatusUpdate(id, patch, {
    authorize: () => requireFeatureIdentity23C('vehicle-administration', 'write'),
    createRepository: () => new LegacySupabaseAdapter(),
    invalidateCatalog,
    revalidate: revalidatePath,
  });
}
