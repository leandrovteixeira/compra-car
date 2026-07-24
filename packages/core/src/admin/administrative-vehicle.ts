import { normalizeVehicleText, vehicleTextComparisonKey } from './vehicle-text-normalization';

export interface AdministrativeVehicleInput {
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: number;
  readonly productionYear: number;
  readonly isActive: boolean;
  readonly isPublic: boolean;
}

export interface AdministrativeVehicle extends AdministrativeVehicleInput {
  readonly id: string;
}

export interface AdministrativeVehicleFilters {
  readonly brand?: string;
  readonly model?: string;
  readonly version?: string;
  readonly isActive?: boolean;
  readonly isPublic?: boolean;
}

export type AdministrativeVehicleField =
  'brand' | 'model' | 'version' | 'modelYear' | 'productionYear' | 'isActive' | 'isPublic';

export type AdministrativeVehicleFieldErrors = Partial<
  Readonly<Record<AdministrativeVehicleField, readonly string[]>>
>;

export type AdministrativeVehicleValidationResult =
  | { readonly ok: true; readonly data: AdministrativeVehicleInput }
  | { readonly ok: false; readonly fieldErrors: AdministrativeVehicleFieldErrors };

function addError(
  errors: Record<string, string[]>,
  field: AdministrativeVehicleField,
  message: string,
): void {
  (errors[field] ??= []).push(message);
}

function isFourDigitInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1000 && value <= 9999;
}

export function normalizeAdministrativeVehicleInput(
  input: AdministrativeVehicleInput,
): AdministrativeVehicleInput {
  return {
    ...input,
    brand: normalizeVehicleText(input.brand),
    model: normalizeVehicleText(input.model),
    version: normalizeVehicleText(input.version),
  };
}

export function validateAdministrativeVehicle(
  input: AdministrativeVehicleInput,
): AdministrativeVehicleValidationResult {
  const data = normalizeAdministrativeVehicleInput(input);
  const errors: Record<string, string[]> = {};

  if (!data.brand) addError(errors, 'brand', 'Informe a marca.');
  if (!data.model) addError(errors, 'model', 'Informe o modelo.');
  if (!data.version) addError(errors, 'version', 'Informe a versão.');

  if (!isFourDigitInteger(data.modelYear) || data.modelYear <= 2000) {
    addError(errors, 'modelYear', 'O ano modelo deve ser maior que 2000.');
  }
  if (!isFourDigitInteger(data.productionYear) || data.productionYear <= 2000) {
    addError(errors, 'productionYear', 'O ano de produção deve ser maior que 2000.');
  } else if (
    isFourDigitInteger(data.modelYear) &&
    data.productionYear !== data.modelYear &&
    data.productionYear !== data.modelYear - 1
  ) {
    addError(
      errors,
      'productionYear',
      'O ano de produção deve ser igual ao ano modelo ou um ano menor.',
    );
  }

  if (data.isPublic && !data.isActive) {
    addError(errors, 'isPublic', 'Um veículo público precisa estar ativo.');
  }

  return Object.keys(errors).length === 0 ? { ok: true, data } : { ok: false, fieldErrors: errors };
}

export function administrativeVehicleIdentity(input: AdministrativeVehicleInput): string {
  return [
    vehicleTextComparisonKey(input.brand),
    vehicleTextComparisonKey(input.model),
    vehicleTextComparisonKey(input.version),
    input.modelYear,
    input.productionYear,
  ].join('\u001f');
}

export function formatAdministrativeVehicleName(input: AdministrativeVehicleInput): string {
  return `${input.brand} ${input.model} ${input.version} ${input.modelYear}/${input.productionYear}`;
}
