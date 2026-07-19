import {
  isVehicleEligibleForPublicCatalog,
  type AvailableVehicleFilters,
  type ComparisonItem,
  type ComparisonRepository,
  type Vehicle,
  type VehicleComparisonValue,
  type VehicleId,
  type VehicleRepository,
} from '../../src';

function matchesFilters(vehicle: Vehicle, filters: AvailableVehicleFilters): boolean {
  return (
    (filters.brand === undefined || vehicle.brand === filters.brand) &&
    (filters.model === undefined || vehicle.model === filters.model)
  );
}

export class InMemoryVehicleRepository implements VehicleRepository {
  constructor(
    private readonly vehicles: readonly Vehicle[],
    private readonly comparisonItemCountByVehicle: Readonly<Record<string, number>> = {},
  ) {}

  async listAvailableBrands(): Promise<readonly string[]> {
    return [...new Set((await this.listPublicEligibleVehicles()).map((vehicle) => vehicle.brand))];
  }

  async listAvailableModels(brand: string): Promise<readonly string[]> {
    const vehicles = await this.listPublicEligibleVehicles({ brand });
    return [...new Set(vehicles.map((vehicle) => vehicle.model))];
  }

  async listAvailableVehicles(filters: AvailableVehicleFilters = {}): Promise<readonly Vehicle[]> {
    return this.vehicles.filter((vehicle) => vehicle.isActive && matchesFilters(vehicle, filters));
  }

  async getVehiclesByIds(ids: readonly VehicleId[]): Promise<readonly Vehicle[]> {
    const requestedIds = new Set(ids);
    return this.vehicles.filter((vehicle) => requestedIds.has(vehicle.id));
  }

  async listPublicEligibleVehicles(
    filters: AvailableVehicleFilters = {},
  ): Promise<readonly Vehicle[]> {
    return this.vehicles.filter(
      (vehicle) =>
        matchesFilters(vehicle, filters) &&
        isVehicleEligibleForPublicCatalog(
          vehicle,
          this.comparisonItemCountByVehicle[vehicle.id] ?? 0,
        ),
    );
  }
}

export class InMemoryComparisonRepository implements ComparisonRepository {
  constructor(
    private readonly items: readonly ComparisonItem[],
    private readonly values: readonly VehicleComparisonValue[],
  ) {}

  async getComparisonItemsByVehicleIds(): Promise<readonly ComparisonItem[]> {
    return this.items;
  }

  async getComparisonValuesByVehicleIds(
    vehicleIds: readonly VehicleId[],
  ): Promise<readonly VehicleComparisonValue[]> {
    const requestedIds = new Set(vehicleIds);
    return this.values.filter((value) => requestedIds.has(value.vehicleId));
  }
}
