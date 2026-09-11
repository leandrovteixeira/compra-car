import type {
  AdministrativeVehicle,
  AdministrativeVehicleInput,
  AdministrativeVehicleStatusPatch,
} from '../admin/administrative-vehicle';
import type { AdministrativeProductSpecsRepository } from '../admin/administrative-product-specs';

export type AdministrativeVehicleCreation =
  { readonly status: 'created'; readonly id: string } | { readonly status: 'duplicate' };

export type AdministrativeVehicleUpdate =
  | { readonly status: 'updated' }
  | { readonly status: 'not_found' }
  | { readonly status: 'duplicate' };

export interface AdministrativeVehicleStatusRepository {
  updateAdministrativeVehicleStatus(
    id: string,
    patch: AdministrativeVehicleStatusPatch,
  ): Promise<{ readonly status: 'updated' | 'not_found' }>;
}

export interface AdministrativeVehicleRepository {
  findAdministrativeVehicleDuplicate(
    input: AdministrativeVehicleInput,
    excludeId?: string,
  ): Promise<boolean>;
  getAdministrativeVehicleById(id: string): Promise<AdministrativeVehicle | null>;
  createAdministrativeVehicle(
    input: AdministrativeVehicleInput,
  ): Promise<AdministrativeVehicleCreation>;
  updateAdministrativeVehicle(
    id: string,
    input: AdministrativeVehicleInput,
  ): Promise<AdministrativeVehicleUpdate>;
}

export interface AdministrativeProductDuplicationRepository
  extends
    AdministrativeVehicleRepository,
    Pick<
      AdministrativeProductSpecsRepository,
      'listAdministrativeProductSpecValues' | 'saveAdministrativeProductSpecs'
    > {
  rollbackAdministrativeVehicleDuplication(productId: string): Promise<void>;
}
