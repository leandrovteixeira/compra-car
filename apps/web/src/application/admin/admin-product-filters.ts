import type { AdministrativeVehicleFilters } from '@compra-car/contracts';

export interface AdminProductFilterValues {
  readonly search: string;
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
  const search = firstValue(searchParams.search);
  const active = booleanValue(firstValue(searchParams.active));
  const publicValue = booleanValue(firstValue(searchParams.public));
  const filters: AdministrativeVehicleFilters = {
    ...(active ? { isActive: booleanFilter(active) } : {}),
    ...(publicValue ? { isPublic: booleanFilter(publicValue) } : {}),
  };

  return {
    filters,
    values: { search, active, public: publicValue },
    hasFilters: Boolean(search) || Object.keys(filters).length > 0,
  };
}
