import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type { AdministrativeVehicleFilters, Vehicle } from '@compra-car/contracts';

export interface AdminProductListItem {
  readonly brand: string;
  readonly id: string;
  readonly isActive: boolean;
  readonly isPublic: boolean;
  readonly model: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly version: string;
}

export type AdminProductListResult =
  { readonly ok: true; readonly data: readonly AdminProductListItem[] } | { readonly ok: false };

export interface AdminProductReader {
  listAdministrativeVehicles(filters?: AdministrativeVehicleFilters): Promise<readonly Vehicle[]>;
}

function toAdminProductListItem(vehicle: Vehicle): AdminProductListItem {
  return Object.freeze({
    id: String(vehicle.id),
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    modelYear: vehicle.modelYear,
    productionYear: vehicle.productionYear,
    isActive: vehicle.isActive,
    isPublic: vehicle.isPublic,
  });
}

export async function loadAdminProducts(
  filters: AdministrativeVehicleFilters = {},
  reader: AdminProductReader = new LegacySupabaseAdapter(),
): Promise<AdminProductListResult> {
  try {
    const vehicles = await reader.listAdministrativeVehicles(filters);
    return {
      ok: true,
      data: vehicles
        .map(toAdminProductListItem)
        .sort(
          (left, right) =>
            left.brand.localeCompare(right.brand, 'pt-BR') ||
            left.model.localeCompare(right.model, 'pt-BR') ||
            left.version.localeCompare(right.version, 'pt-BR'),
        ),
    };
  } catch {
    console.error('Admin product list could not be loaded.');
    return { ok: false };
  }
}
