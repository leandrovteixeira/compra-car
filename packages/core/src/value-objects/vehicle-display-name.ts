import { DomainValidationError } from '../errors/domain-errors';

declare const vehicleDisplayNameBrand: unique symbol;

export type VehicleDisplayName = string & {
  readonly [vehicleDisplayNameBrand]: 'VehicleDisplayName';
};

export function createVehicleDisplayName(value: string): VehicleDisplayName {
  const normalized = value.trim().replaceAll(/\s+/g, ' ');

  if (normalized.length === 0) {
    throw new DomainValidationError('VehicleDisplayName não pode ser vazio.');
  }

  return normalized as VehicleDisplayName;
}
