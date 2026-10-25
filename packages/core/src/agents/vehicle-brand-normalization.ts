import { vehicleTextComparisonKey } from '../admin/vehicle-text-normalization';

const CANONICAL_BRAND_ALIASES: Readonly<Record<string, string>> = {
  vw: 'Volkswagen',
};

export function canonicalVehicleBrand(value: string): string {
  const normalized = vehicleTextComparisonKey(value);
  return CANONICAL_BRAND_ALIASES[normalized] ?? value.trim();
}

export function vehicleBrandComparisonKey(value: string): string {
  return vehicleTextComparisonKey(canonicalVehicleBrand(value));
}

export function sameVehicleBrand(left: string, right: string): boolean {
  return vehicleBrandComparisonKey(left) === vehicleBrandComparisonKey(right);
}

export function vehicleBrandAliases(value: string): readonly string[] {
  const canonical = canonicalVehicleBrand(value);
  return canonical === 'Volkswagen' ? ['Volkswagen', 'VW'] : [canonical];
}
