import type { Vehicle } from '../entities/vehicle';
import { VehicleNotFoundError } from '../errors/domain-errors';
import type { VehicleRepository } from '../repositories/vehicle-repository';
import { createVehicleId } from '../value-objects/vehicle-id';

export interface GetVehiclesByIdsInput {
  readonly vehicleIds: readonly string[];
}

export class GetVehiclesByIds {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  async execute(input: GetVehiclesByIdsInput): Promise<readonly Vehicle[]> {
    const ids = input.vehicleIds.map(createVehicleId);
    const found = await this.vehicleRepository.getVehiclesByIds(ids);
    const vehiclesById = new Map(found.map((vehicle) => [vehicle.id, vehicle]));

    return ids.map((id) => {
      const vehicle = vehiclesById.get(id);
      if (!vehicle) {
        throw new VehicleNotFoundError(id);
      }
      return vehicle;
    });
  }
}
