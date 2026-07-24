import {
  formatAdministrativeVehicleName,
  validateAdministrativeVehicle,
  type AdministrativeVehicleFieldErrors,
  type AdministrativeVehicleInput,
} from '../admin/administrative-vehicle';
import type { AdministrativeVehicleRepository } from '../repositories/administrative-vehicle-repository';

export type UpdateAdministrativeVehicleResult =
  | { readonly ok: true; readonly data: AdministrativeVehicleInput }
  | {
      readonly ok: false;
      readonly code: 'VALIDATION_ERROR';
      readonly fieldErrors: AdministrativeVehicleFieldErrors;
    }
  | { readonly ok: false; readonly code: 'DUPLICATE'; readonly message: string }
  | { readonly ok: false; readonly code: 'NOT_FOUND' };

export class UpdateAdministrativeVehicle {
  constructor(private readonly repository: AdministrativeVehicleRepository) {}

  async execute(
    id: string,
    input: AdministrativeVehicleInput,
  ): Promise<UpdateAdministrativeVehicleResult> {
    const validation = validateAdministrativeVehicle(input);
    if (!validation.ok) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        fieldErrors: validation.fieldErrors,
      };
    }

    const normalized = validation.data;
    if (await this.repository.findAdministrativeVehicleDuplicate(normalized, id)) {
      return this.duplicateResult(normalized);
    }

    const update = await this.repository.updateAdministrativeVehicle(id, normalized);
    if (update.status === 'duplicate') return this.duplicateResult(normalized);
    if (update.status === 'not_found') return { ok: false, code: 'NOT_FOUND' };
    return { ok: true, data: normalized };
  }

  private duplicateResult(
    input: AdministrativeVehicleInput,
  ): Extract<UpdateAdministrativeVehicleResult, { code: 'DUPLICATE' }> {
    return {
      ok: false,
      code: 'DUPLICATE',
      message: `Já existe um veículo ${formatAdministrativeVehicleName(input)} cadastrado.`,
    };
  }
}
