import type { VehicleRepository } from '../repositories/vehicle-repository';

export class ListAvailableBrands {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  execute(): Promise<readonly string[]> {
    return this.vehicleRepository.listAvailableBrands();
  }
}
