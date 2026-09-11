'use server';

import type {
  AdministrativeVehicleStatusPatchDto,
  UpdateAdministrativeVehicleStatusActionResultDto,
} from '@compra-car/contracts';
import { updateAdminProductStatus } from '@/server/update-admin-product-status';

export async function updateAdminProductStatusAction(
  id: string,
  patch: AdministrativeVehicleStatusPatchDto,
): Promise<UpdateAdministrativeVehicleStatusActionResultDto> {
  return updateAdminProductStatus(id, patch);
}
