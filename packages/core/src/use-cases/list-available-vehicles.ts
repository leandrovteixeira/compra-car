import type { Vehicle } from '../entities/vehicle';
import type {
  AvailableVehicleFilters,
  VehicleRepository,
} from '../repositories/vehicle-repository';

export type ListAvailableVehiclesInput = AvailableVehicleFilters;

export class ListAvailableVehicles {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  execute(input: ListAvailableVehiclesInput = {}): Promise<readonly Vehicle[]> {
    return this.vehicleRepository.listPublicEligibleVehicles(input);
  }
}
