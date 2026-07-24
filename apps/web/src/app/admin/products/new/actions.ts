'use server';

import type { CreateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';

import { executeAdminProductCreation } from '@/server/create-admin-product';

export async function createAdminProductAction(
  _previousState: CreateAdministrativeVehicleActionStateDto,
  formData: FormData,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  return executeAdminProductCreation(formData);
}
