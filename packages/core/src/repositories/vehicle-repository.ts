import type { Vehicle } from '../entities/vehicle';
import type { VehicleId } from '../value-objects/vehicle-id';

export interface AvailableVehicleFilters {
  readonly brand?: string;
  readonly model?: string;
}

export interface VehicleRepository {
  listAvailableBrands(): Promise<readonly string[]>;
  listAvailableModels(brand: string): Promise<readonly string[]>;
  listAvailableVehicles(filters?: AvailableVehicleFilters): Promise<readonly Vehicle[]>;
  getVehiclesByIds(ids: readonly VehicleId[]): Promise<readonly Vehicle[]>;
  listPublicEligibleVehicles(filters?: AvailableVehicleFilters): Promise<readonly Vehicle[]>;
}
