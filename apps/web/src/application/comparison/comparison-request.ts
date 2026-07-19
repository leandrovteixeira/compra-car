import type { ComparisonPageErrorDto } from '@compra-car/contracts';

export type ParsedComparisonRequest =
  | { readonly ok: true; readonly vehicleIds: readonly string[] }
  | { readonly ok: false; readonly error: ComparisonPageErrorDto };

const ERRORS = Object.freeze({
  missing: {
    code: 'MISSING_VEHICLES',
    message: 'Selecione pelo menos dois veículos para comparar.',
  },
  tooFew: {
    code: 'TOO_FEW_VEHICLES',
    message: 'Selecione pelo menos dois veículos para comparar.',
  },
  duplicate: {
    code: 'DUPLICATE_VEHICLES',
    message: 'Os veículos selecionados devem ser diferentes.',
  },
  invalid: {
    code: 'INVALID_VEHICLE_IDS',
    message: 'A seleção contém identificadores de veículos inválidos.',
  },
}) satisfies Readonly<Record<string, ComparisonPageErrorDto>>;

function isCompatibleVehicleId(value: string): boolean {
  if (!/^[1-9]\d*$/.test(value)) return false;
  return Number.isSafeInteger(Number(value));
}

export function parseComparisonRequest(
  rawVehicles: string | readonly string[] | undefined,
): ParsedComparisonRequest {
  if (rawVehicles === undefined) return { ok: false, error: ERRORS.missing };
  if (typeof rawVehicles !== 'string') return { ok: false, error: ERRORS.invalid };

  const vehicleIds = rawVehicles.split(',').map((id) => id.trim());
  if (vehicleIds.length < 2) return { ok: false, error: ERRORS.tooFew };
  if (vehicleIds.some((id) => !isCompatibleVehicleId(id))) {
    return { ok: false, error: ERRORS.invalid };
  }
  if (new Set(vehicleIds).size !== vehicleIds.length) {
    return { ok: false, error: ERRORS.duplicate };
  }

  return { ok: true, vehicleIds: Object.freeze(vehicleIds) };
}
