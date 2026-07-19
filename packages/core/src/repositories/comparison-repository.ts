import type { ComparisonItem } from '../entities/comparison-item';
import type { VehicleComparisonValue } from '../entities/comparison';
import type { VehicleId } from '../value-objects/vehicle-id';

export interface ComparisonRepository {
  getComparisonItemsByVehicleIds(
    vehicleIds: readonly VehicleId[],
  ): Promise<readonly ComparisonItem[]>;
  getComparisonValuesByVehicleIds(
    vehicleIds: readonly VehicleId[],
  ): Promise<readonly VehicleComparisonValue[]>;
}
