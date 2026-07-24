import type {
  AdministrativeVehicle,
  AdministrativeVehicleInput,
} from '../admin/administrative-vehicle';

export type AdministrativeVehicleCreation =
  { readonly status: 'created'; readonly id: string } | { readonly status: 'duplicate' };

export type AdministrativeVehicleUpdate =
  | { readonly status: 'updated' }
  | { readonly status: 'not_found' }
  | { readonly status: 'duplicate' };

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
