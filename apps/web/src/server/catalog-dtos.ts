import type { CatalogOptionDto, CatalogVehicleDto, VehicleDto } from '@compra-car/contracts';

export function toCatalogOption(value: string): CatalogOptionDto {
  return Object.freeze({ value, label: value });
}

export function toCatalogVehicle(vehicle: VehicleDto): CatalogVehicleDto {
  return Object.freeze({
    id: String(vehicle.id),
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    modelYear: vehicle.modelYear,
    productionYear: vehicle.productionYear,
    displayName: String(vehicle.displayName),
  });
}
