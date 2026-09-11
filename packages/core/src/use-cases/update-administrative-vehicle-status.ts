import { isValidAdministrativeVehicleStatusUpdate } from '../admin/administrative-vehicle';
import type { AdministrativeVehicleStatusRepository } from '../repositories/administrative-vehicle-repository';

export type UpdateAdministrativeVehicleStatusResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'INVALID_STATUS_UPDATE' | 'NOT_FOUND' };

export class UpdateAdministrativeVehicleStatus {
  constructor(private readonly repository: AdministrativeVehicleStatusRepository) {}

  async execute(id: string, patch: unknown): Promise<UpdateAdministrativeVehicleStatusResult> {
    if (!isValidAdministrativeVehicleStatusUpdate(id, patch)) {
      return { ok: false, code: 'INVALID_STATUS_UPDATE' };
    }
    const result = await this.repository.updateAdministrativeVehicleStatus(id, patch);
    return result.status === 'updated' ? { ok: true } : { ok: false, code: 'NOT_FOUND' };
  }
}
