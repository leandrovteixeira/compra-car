import { DomainValidationError } from '../errors/domain-errors';
import {
  createVehicleDisplayName,
  type VehicleDisplayName,
} from '../value-objects/vehicle-display-name';
import { createVehicleId, type VehicleId } from '../value-objects/vehicle-id';

export interface Vehicle {
  readonly id: VehicleId;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly displayName: VehicleDisplayName;
  readonly isActive: boolean;
  readonly isPublic: boolean;
}

export interface CreateVehicleInput {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly displayName?: string;
  readonly isActive: boolean;
  readonly isPublic: boolean;
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError(`${field} não pode ser vazio.`);
  }

  return normalized;
}

export function createVehicle(input: CreateVehicleInput): Vehicle {
  const brand = requiredText(input.brand, 'brand');
  const model = requiredText(input.model, 'model');
  const version = requiredText(input.version, 'version');
  const modelYear = requiredText(input.modelYear, 'modelYear');
  const productionYear = requiredText(input.productionYear, 'productionYear');
  const derivedDisplayName = [brand, model, version, modelYear, productionYear].join(' ');

  return Object.freeze({
    id: createVehicleId(input.id),
    brand,
    model,
    version,
    modelYear,
    productionYear,
    displayName: createVehicleDisplayName(input.displayName ?? derivedDisplayName),
    isActive: input.isActive,
    isPublic: input.isPublic,
  });
}

export function isVehicleEligibleForPublicCatalog(
  vehicle: Vehicle,
  comparisonItemCount: number,
): boolean {
  return vehicle.isActive && vehicle.isPublic && comparisonItemCount > 0;
}
