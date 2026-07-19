import type { CatalogVehicleDto } from '@compra-car/contracts';

function lastTwoDigits(year: string): string {
  const normalizedYear = year.trim();
  const numericYear = Number(normalizedYear);

  if (normalizedYear && Number.isInteger(numericYear)) {
    return String(Math.abs(numericYear) % 100).padStart(2, '0');
  }

  return normalizedYear.slice(-2).padStart(2, '0');
}

export function formatModelProductionYears(modelYear: string, productionYear: string): string {
  return `${lastTwoDigits(modelYear)}/${lastTwoDigits(productionYear)}`;
}

export function formatCompactVehicleName(vehicle: CatalogVehicleDto): string {
  const identity = [vehicle.brand, vehicle.model, vehicle.version]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');

  return `${identity} · ${formatModelProductionYears(vehicle.modelYear, vehicle.productionYear)}`;
}

export function formatVehicleVersionOption(vehicle: CatalogVehicleDto): string {
  return `${vehicle.version} · ${formatModelProductionYears(
    vehicle.modelYear,
    vehicle.productionYear,
  )}`;
}
