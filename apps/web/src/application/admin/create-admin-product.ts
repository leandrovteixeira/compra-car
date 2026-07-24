import type {
  AdministrativeVehicleFormValuesDto,
  CreateAdministrativeVehicleActionStateDto,
} from '@compra-car/contracts';
import {
  CreateAdministrativeVehicle,
  type AdministrativeVehicleRepository,
} from '@compra-car/core';

const SAFE_FAILURE_MESSAGE =
  'Não foi possível cadastrar o veículo. Revise os dados e tente novamente.';

export interface CreateAdminProductDependencies {
  readonly authorize: () => Promise<unknown>;
  readonly createRepository: () => AdministrativeVehicleRepository;
  readonly revalidate: (path: string) => void;
}

function formValues(formData: FormData): AdministrativeVehicleFormValuesDto {
  return {
    brand: String(formData.get('brand') ?? ''),
    model: String(formData.get('model') ?? ''),
    version: String(formData.get('version') ?? ''),
    modelYear: String(formData.get('modelYear') ?? ''),
    productionYear: String(formData.get('productionYear') ?? ''),
    isActive: formData.get('isActive') === 'true',
    isPublic: formData.get('isPublic') === 'true',
  };
}

export async function executeAdminProductCreation(
  formData: FormData,
  dependencies: CreateAdminProductDependencies,
): Promise<CreateAdministrativeVehicleActionStateDto> {
  await dependencies.authorize();
  const repository = dependencies.createRepository();
  const values = formValues(formData);

  try {
    const result = await new CreateAdministrativeVehicle(repository).execute({
      brand: values.brand,
      model: values.model,
      version: values.version,
      modelYear: Number(values.modelYear),
      productionYear: Number(values.productionYear),
      isActive: values.isActive,
      isPublic: values.isPublic,
    });

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
