import type {
  AdministrativeVehicleFormValuesDto,
  AdministrativeVehicleInput,
} from '@compra-car/contracts';

export function readAdministrativeVehicleForm(
  formData: FormData,
): AdministrativeVehicleFormValuesDto {
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

export function toAdministrativeVehicleInput(
  values: AdministrativeVehicleFormValuesDto,
): AdministrativeVehicleInput {
  return {
    brand: values.brand,
    model: values.model,
    version: values.version,
    modelYear: Number(values.modelYear),
    productionYear: Number(values.productionYear),
    isActive: values.isActive,
    isPublic: values.isPublic,
  };
}

export function toAdministrativeVehicleFormValues(
  input: AdministrativeVehicleInput,
): AdministrativeVehicleFormValuesDto {
  return {
    brand: input.brand,
    model: input.model,
    version: input.version,
    modelYear: String(input.modelYear),
    productionYear: String(input.productionYear),
    isActive: input.isActive,
    isPublic: input.isPublic,
  };
}
