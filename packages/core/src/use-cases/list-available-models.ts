import { DomainValidationError } from '../errors/domain-errors';
import type { VehicleRepository } from '../repositories/vehicle-repository';

export interface ListAvailableModelsInput {
  readonly brand: string;
}

export class ListAvailableModels {
  constructor(private readonly vehicleRepository: VehicleRepository) {}

  execute(input: ListAvailableModelsInput): Promise<readonly string[]> {
    const brand = input.brand.trim();
    if (brand.length === 0) {
      throw new DomainValidationError('brand não pode ser vazia.');
    }

    return this.vehicleRepository.listAvailableModels(brand);
  }
}
