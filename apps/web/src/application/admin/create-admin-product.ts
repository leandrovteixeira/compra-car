import type { CreateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import {
  CreateAdministrativeVehicle,
  type AdministrativeVehicleRepository,
} from '@compra-car/core';

import {
  readAdministrativeVehicleForm,
  toAdministrativeVehicleInput,
} from './administrative-vehicle-form';

const SAFE_FAILURE_MESSAGE =
  'Não foi possível cadastrar o veículo. Revise os dados e tente novamente.';

export interface CreateAdminProductDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createRepository: () => AdministrativeVehicleRepository;
  readonly revalidate: (path: string) => void;
}

export async function executeAdminProductCreation(
  formData: FormData,
  dependencies: CreateAdminProductDependencies,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  await dependencies.authorize();
  const repository = dependencies.createRepository();
  const values = readAdministrativeVehicleForm(formData);

  try {
    const result = await new CreateAdministrativeVehicle(repository).execute(
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
            message: result.message,
          };
    }

    dependencies.revalidate('/admin/products');
    return { status: 'success', id: result.id, values, fieldErrors: {} };
  } catch {
    console.error('Administrative vehicle creation failed.');
    return {
      status: 'error',
      values,
      fieldErrors: {},
      message: SAFE_FAILURE_MESSAGE,
    };
  }
}
