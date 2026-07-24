'use server';

import type { UpdateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';

import { executeAdminProductUpdate } from '@/server/update-admin-product';

export async function updateAdminProductAction(
  id: string,
  _previousState: UpdateAdministrativeVehicleActionStateDto,
  formData: FormData,
): Promise<UpdateAdministrativeVehicleActionStateDto> {
  return executeAdminProductUpdate(id, formData);
}
