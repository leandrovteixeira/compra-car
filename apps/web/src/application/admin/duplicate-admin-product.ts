import type { CreateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import {
  DuplicateAdministrativeVehicle,
  type AdministrativeProductDuplicationRepository,
} from '@compra-car/core';

import {
  readAdministrativeVehicleForm,
  toAdministrativeVehicleInput,
} from './administrative-vehicle-form';

const SAFE_FAILURE_MESSAGE =
  'Não foi possível duplicar o veículo. Nenhuma ficha técnica foi copiada; tente novamente.';

export interface DuplicateAdminProductDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createRepository: () => AdministrativeProductDuplicationRepository;
  readonly revalidate: (path: string) => void;
}

export async function executeAdminProductDuplication(
  sourceProductId: string,
  formData: FormData,
  dependencies: DuplicateAdminProductDependencies,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  await dependencies.authorize();
  const repository = dependencies.createRepository();
  const values = readAdministrativeVehicleForm(formData);

  try {
    const result = await new DuplicateAdministrativeVehicle(repository).execute(
      sourceProductId,
      toAdministrativeVehicleInput(values),
    );

    if (!result.ok) {
      return result.code === 'VALIDATION_ERROR'
        ? {
            status: 'error',
            values,
            fieldErrors: result.fieldErrors,
          }
        : {
            status: 'error',
            values,
            fieldErrors: {},
            message:
              result.code === 'SPEC_COPY_FAILED' && result.incompleteProductId
                ? `${result.message} Identificador: ${result.incompleteProductId}.`
                : result.message,
          };
    }

    dependencies.revalidate('/admin/products');
    dependencies.revalidate(`/admin/products/${result.id}/specs`);
    return { status: 'success', id: result.id, values, fieldErrors: {} };
  } catch {
    console.error('Administrative vehicle duplication failed.');
    return {
      status: 'error',
      values,
      fieldErrors: {},
      message: SAFE_FAILURE_MESSAGE,
    };
  }
}
