import type { AdministrativeVehicleFilters } from '@compra-car/contracts';

export interface AdminProductFilterValues {
  readonly vehicle: string;
  readonly brand: string;
  readonly version: string;
  readonly active: '' | 'true' | 'false';
  readonly public: '' | 'true' | 'false';
}

export type AdminProductSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

function firstValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function booleanFilter(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function booleanValue(value: string): '' | 'true' | 'false' {
  return value === 'true' || value === 'false' ? value : '';
}

export function parseAdminProductFilters(searchParams: AdminProductSearchParams): {
  readonly filters: AdministrativeVehicleFilters;
  readonly values: AdminProductFilterValues;
  readonly hasFilters: boolean;
} {
  const vehicle = firstValue(searchParams.vehicle);
  const brand = firstValue(searchParams.brand);
  const version = firstValue(searchParams.version);
  const active = booleanValue(firstValue(searchParams.active));
  const publicValue = booleanValue(firstValue(searchParams.public));
  const filters: AdministrativeVehicleFilters = {
    ...(vehicle ? { model: vehicle } : {}),
    ...(brand ? { brand } : {}),
    ...(version ? { version } : {}),
    ...(active ? { isActive: booleanFilter(active) } : {}),
    ...(publicValue ? { isPublic: booleanFilter(publicValue) } : {}),
  };

  return {
    filters,
    values: { vehicle, brand, version, active, public: publicValue },
    hasFilters: Object.keys(filters).length > 0,
  };
}
