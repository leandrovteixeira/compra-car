'use server';

import type { CreateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';

import { executeAdminProductDuplication } from '@/server/duplicate-admin-product';

export async function duplicateAdminProductAction(
  sourceProductId: string,
  _previousState: CreateAdministrativeVehicleActionStateDto,
  formData: FormData,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  return executeAdminProductDuplication(sourceProductId, formData);
}
