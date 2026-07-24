import {
  formatAdministrativeVehicleName,
  validateAdministrativeVehicle,
  type AdministrativeVehicleFieldErrors,
  type AdministrativeVehicleInput,
} from '../admin/administrative-vehicle';
import type { AdministrativeVehicleRepository } from '../repositories/administrative-vehicle-repository';

export type CreateAdministrativeVehicleResult =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly code: 'VALIDATION_ERROR';
      readonly fieldErrors: AdministrativeVehicleFieldErrors;
    }
  | { readonly ok: false; readonly code: 'DUPLICATE'; readonly message: string };

export class CreateAdministrativeVehicle {
  constructor(private readonly repository: AdministrativeVehicleRepository) {}

  async execute(input: AdministrativeVehicleInput): Promise<CreateAdministrativeVehicleResult> {
    const validation = validateAdministrativeVehicle(input);
    if (!validation.ok) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        fieldErrors: validation.fieldErrors,
      };
    }

    const normalized = validation.data;
    if (await this.repository.findAdministrativeVehicleDuplicate(normalized)) {
      return this.duplicateResult(normalized);
    }

    const creation = await this.repository.createAdministrativeVehicle(normalized);
    if (creation.status === 'duplicate') return this.duplicateResult(normalized);
    return { ok: true, id: creation.id };
  }

  private duplicateResult(
    input: AdministrativeVehicleInput,
  ): Extract<CreateAdministrativeVehicleResult, { code: 'DUPLICATE' }> {
    return {
      ok: false,
      code: 'DUPLICATE',
      message: `Já existe um veículo ${formatAdministrativeVehicleName(input)} cadastrado.`,
    };
  }
}
