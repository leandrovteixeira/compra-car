import { DomainValidationError } from '../errors/domain-errors';

declare const vehicleIdBrand: unique symbol;

export type VehicleId = string & { readonly [vehicleIdBrand]: 'VehicleId' };

export function createVehicleId(value: string): VehicleId {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError('VehicleId não pode ser vazio.');
  }

  return normalized as VehicleId;
}
