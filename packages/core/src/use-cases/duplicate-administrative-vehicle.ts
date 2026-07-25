import type {
  AdministrativeVehicleFieldErrors,
  AdministrativeVehicleInput,
} from '../admin/administrative-vehicle';
import type { AdministrativeProductDuplicationRepository } from '../repositories/administrative-vehicle-repository';
import { CreateAdministrativeVehicle } from './create-administrative-vehicle';

export type DuplicateAdministrativeVehicleResult =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly code: 'VALIDATION_ERROR';
      readonly fieldErrors: AdministrativeVehicleFieldErrors;
    }
  | { readonly ok: false; readonly code: 'DUPLICATE'; readonly message: string }
  | { readonly ok: false; readonly code: 'SOURCE_NOT_FOUND'; readonly message: string }
  | {
      readonly ok: false;
      readonly code: 'SPEC_COPY_FAILED';
      readonly message: string;
      readonly incompleteProductId?: string;
    };

export class DuplicateAdministrativeVehicle {
  constructor(private readonly repository: AdministrativeProductDuplicationRepository) {}

  async execute(
    sourceProductId: string,
    input: AdministrativeVehicleInput,
  ): Promise<DuplicateAdministrativeVehicleResult> {
    const source = await this.repository.getAdministrativeVehicleById(sourceProductId);
    if (!source) {
      return {
        ok: false,
        code: 'SOURCE_NOT_FOUND',
        message: 'O veículo de origem não está mais disponível para duplicação.',
      };
    }

    const creation = await new CreateAdministrativeVehicle(this.repository).execute(input);
    if (!creation.ok) return creation;

    try {
      const sourceSpecs =
        await this.repository.listAdministrativeProductSpecValues(sourceProductId);
      if (sourceSpecs.length > 0) {
        await this.repository.saveAdministrativeProductSpecs(creation.id, {
          upserts: sourceSpecs.map((spec) => ({
            specId: spec.specId,
            value: spec.value,
            isPresent: spec.isPresent,
            inputUnit: spec.inputUnit,
          })),
          deleteSpecIds: [],
        });
      }
      return { ok: true, id: creation.id };
    } catch {
      try {
        await this.repository.rollbackAdministrativeVehicleDuplication(creation.id);
        return {
          ok: false,
          code: 'SPEC_COPY_FAILED',
          message:
            'Não foi possível copiar a ficha técnica. O novo veículo foi removido com segurança; tente novamente.',
        };
      } catch {
        return {
          ok: false,
          code: 'SPEC_COPY_FAILED',
          message:
            'Não foi possível copiar a ficha técnica nem remover completamente o novo veículo. O cadastro ficou incompleto e requer revisão administrativa.',
          incompleteProductId: creation.id,
        };
      }
    }
  }
}
