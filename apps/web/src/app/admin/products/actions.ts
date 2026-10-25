'use server';

import type {
  AdministrativeVehicleStatusPatchDto,
  UpdateAdministrativeVehicleStatusActionResultDto,
} from '@compra-car/contracts';
import { updateAdminProductStatus } from '@/server/update-admin-product-status';
import { executeAdminProductUpdate } from '@/server/update-admin-product';
import { executeAdminProductDuplication } from '@/server/duplicate-admin-product';

export async function updateAdminProductStatusAction(
  id: string,
  patch: AdministrativeVehicleStatusPatchDto,
): Promise<UpdateAdministrativeVehicleStatusActionResultDto> {
  return updateAdminProductStatus(id, patch);
}

/** Validated server mutations shared with the existing edit and duplicate pages. */
export async function updateAdminProductInlineAction(id: string, data: FormData) {
  return executeAdminProductUpdate(id, data);
}

export async function duplicateAdminProductInlineAction(id: string, data: FormData) {
  return executeAdminProductDuplication(id, data);
}
