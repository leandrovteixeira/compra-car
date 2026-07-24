import type { UpdateAdministrativeVehicleActionStateDto } from '@compra-car/contracts';
import {
  UpdateAdministrativeVehicle,
  type AdministrativeVehicleRepository,
} from '@compra-car/core';

import {
  readAdministrativeVehicleForm,
  toAdministrativeVehicleFormValues,
  toAdministrativeVehicleInput,
} from './administrative-vehicle-form';

const SAFE_FAILURE_MESSAGE =
  'Não foi possível salvar as alterações. Revise os dados e tente novamente.';
const NOT_FOUND_MESSAGE = 'O veículo que você tentou editar não foi encontrado.';

export interface UpdateAdminProductDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createRepository: () => AdministrativeVehicleRepository;
  readonly revalidate: (path: string) => void;
}

export async function executeAdminProductUpdate(
  id: string,
  formData: FormData,
  dependencies: UpdateAdminProductDependencies,
): Promise<UpdateAdministrativeVehicleActionStateDto> {
  await dependencies.authorize();
  const repository = dependencies.createRepository();
  const values = readAdministrativeVehicleForm(formData);

  try {
    const result = await new UpdateAdministrativeVehicle(repository).execute(
      id,
      toAdministrativeVehicleInput(values),
    );

    if (!result.ok) {
      if (result.code === 'VALIDATION_ERROR') {
        return { status: 'error', values, fieldErrors: result.fieldErrors };
      }
      return {
        status: 'error',
        values,
        fieldErrors: {},
        message: result.code === 'NOT_FOUND' ? NOT_FOUND_MESSAGE : result.message,
      };
    }

    dependencies.revalidate('/admin/products');
    dependencies.revalidate(`/admin/products/${id}/edit`);
    return {
      status: 'success',
      id,
      values: toAdministrativeVehicleFormValues(result.data),
      fieldErrors: {},
      message: 'Veículo atualizado com sucesso.',
    };
  } catch {
    console.error('Administrative vehicle update failed.');
    return {
      status: 'error',
      values,
      fieldErrors: {},
      message: SAFE_FAILURE_MESSAGE,
    };
  }
}
