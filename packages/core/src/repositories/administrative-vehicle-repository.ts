import type { AdministrativeVehicleInput } from '../admin/administrative-vehicle';

export type AdministrativeVehicleCreation =
  { readonly status: 'created'; readonly id: string } | { readonly status: 'duplicate' };

export interface AdministrativeVehicleRepository {
  findAdministrativeVehicleDuplicate(input: AdministrativeVehicleInput): Promise<boolean>;
  createAdministrativeVehicle(
    input: AdministrativeVehicleInput,
  ): Promise<AdministrativeVehicleCreation>;
}
