export class DomainValidationError extends Error {
  override readonly name: string = 'DomainValidationError';
}

export class ComparisonVehicleCountError extends DomainValidationError {
  override readonly name = 'ComparisonVehicleCountError';

  constructor(readonly actualCount: number) {
    super(`A comparação exige pelo menos 2 veículos; foram recebidos ${actualCount}.`);
  }
}

export class DuplicateVehicleSelectionError extends DomainValidationError {
  override readonly name = 'DuplicateVehicleSelectionError';

  constructor() {
    super('A comparação não aceita veículos duplicados.');
  }
}

export class VehicleNotFoundError extends DomainValidationError {
  override readonly name = 'VehicleNotFoundError';

  constructor(readonly vehicleId: string) {
    super(`Veículo não encontrado: ${vehicleId}.`);
  }
}

export class VehicleNotEligibleError extends DomainValidationError {
  override readonly name = 'VehicleNotEligibleError';

  constructor(readonly vehicleId: string) {
    super(`Veículo não elegível para comparação: ${vehicleId}.`);
  }
}

export class DuplicateComparisonItemCodeError extends DomainValidationError {
  override readonly name = 'DuplicateComparisonItemCodeError';

  constructor(readonly itemCode: string) {
    super(`Código de item de comparação duplicado: ${itemCode}.`);
  }
}

export class InvalidComparisonDataError extends DomainValidationError {
  override readonly name = 'InvalidComparisonDataError';
}
