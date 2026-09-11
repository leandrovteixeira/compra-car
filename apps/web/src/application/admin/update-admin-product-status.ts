import type { UpdateAdministrativeVehicleStatusActionResultDto } from '@compra-car/contracts';
import {
  isValidAdministrativeVehicleStatusUpdate,
  UpdateAdministrativeVehicleStatus,
  type AdministrativeVehicleStatusRepository,
} from '@compra-car/core';

export interface UpdateAdminProductStatusDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createRepository: () => AdministrativeVehicleStatusRepository;
  readonly invalidateCatalog: () => void;
  readonly revalidate: (path: string) => void;
}

export async function executeAdminProductStatusUpdate(
  id: string,
  patch: unknown,
  dependencies: UpdateAdminProductStatusDependencies,
): Promise<UpdateAdministrativeVehicleStatusActionResultDto> {
  await dependencies.authorize();
  if (!isValidAdministrativeVehicleStatusUpdate(id, patch)) {
    return { status: 'error', message: 'ID ou status de veículo inválido.' };
  }
  try {
    const result = await new UpdateAdministrativeVehicleStatus(
      dependencies.createRepository(),
    ).execute(id, patch);
    if (!result.ok && result.code === 'PUBLICATION_REJECTED') {
      return {
        status: 'error',
        message: 'Veículo não encontrado ou inativo. Ative o veículo antes de publicá-lo.',
      };
    }
    if (!result.ok)
      return { status: 'error', message: 'Veículo não encontrado ou status inválido.' };
    if (Object.hasOwn(patch, 'isPublic') || patch.isActive === false)
      dependencies.invalidateCatalog();
    dependencies.revalidate('/admin/products');
    return { status: 'success' };
  } catch {
    return { status: 'error', message: 'Não foi possível salvar o status. Tente novamente.' };
  }
}
