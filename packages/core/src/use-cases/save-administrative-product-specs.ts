import {
  convertUnit,
  parseAdministrativeNumeric,
  TORQUE_SPEC_CODES,
  type AdministrativeProductSpecsBatch,
  type AdministrativeProductSpecsRepository,
  type AdministrativeSpecSubmission,
} from '../admin/administrative-product-specs';

export class SaveAdministrativeProductSpecs {
  constructor(private readonly repository: AdministrativeProductSpecsRepository) {}

  async execute(
    productId: string,
    submissions: readonly AdministrativeSpecSubmission[],
  ): Promise<void> {
    const [catalog, conversions] = await Promise.all([
      this.repository.listActiveAdministrativeSpecs(),
      this.repository.listUnitConversions(),
    ]);
    const catalogById = new Map(catalog.map((spec) => [spec.id, spec]));
    const upserts: AdministrativeProductSpecsBatch['upserts'][number][] = [];
    const deleteSpecIds = new Set<string>();
    const submittedSpecIds = new Set<string>();

    for (const submission of submissions) {
      if (submission.kind === 'scale') {
        if (
          submission.selectedSpecId !== null &&
          !submission.specIds.includes(submission.selectedSpecId)
        ) {
          throw new Error('A opção selecionada não pertence ao conjunto informado.');
        }
        const scaleSpecs = submission.specIds.map((specId) => catalogById.get(specId));
        const logicalKeys = new Set(
          scaleSpecs.map((spec) =>
            spec ? [spec.groupName, spec.equipmentGroup, spec.specSet].join('\u001f') : '',
          ),
        );
        if (logicalKeys.size !== 1 || logicalKeys.has('')) {
          throw new Error('Conjunto scale inválido.');
        }
        for (const specId of submission.specIds) {
          if (submittedSpecIds.has(specId)) throw new Error('Spec enviado mais de uma vez.');
          submittedSpecIds.add(specId);
          const spec = catalogById.get(specId);
          if (!spec || spec.type !== 'scale') throw new Error('Opção scale inválida.');
          if (specId === submission.selectedSpecId) {
            upserts.push({ specId, value: null, isPresent: true, inputUnit: null });
          } else {
            deleteSpecIds.add(specId);
          }
        }
        continue;
      }

      const spec = catalogById.get(submission.specId);
      if (!spec || spec.type !== submission.kind) throw new Error('Spec inválido ou inativo.');
      if (submittedSpecIds.has(spec.id)) throw new Error('Spec enviado mais de uma vez.');
      submittedSpecIds.add(spec.id);
      if (submission.kind === 'binary') {
        if (submission.present === null) {
          deleteSpecIds.add(spec.id);
          continue;
        }
        upserts.push({
          specId: spec.id,
          value: null,
          isPresent: submission.present,
          inputUnit: null,
        });
        continue;
      }

      const parsed = parseAdministrativeNumeric(submission.value);
      if (parsed === null) {
        deleteSpecIds.add(spec.id);
        continue;
      }
      const requestedUnit = submission.inputUnit ?? spec.unit;
      let canonicalValue = parsed;
      if (requestedUnit !== spec.unit) {
        const isTorque =
          TORQUE_SPEC_CODES.includes(spec.code as (typeof TORQUE_SPEC_CODES)[number]) &&
          spec.unit === 'Nm' &&
          requestedUnit === 'kgfm';
        if (!isTorque || !spec.unit) throw new Error('Unidade de entrada não permitida.');
        canonicalValue = convertUnit(parsed, requestedUnit, spec.unit, conversions);
      }
      upserts.push({
        specId: spec.id,
        value: canonicalValue,
        isPresent: null,
        inputUnit: spec.unit,
      });
    }

    for (const upsert of upserts) deleteSpecIds.delete(upsert.specId);
    await this.repository.saveAdministrativeProductSpecs(productId, {
      upserts,
      deleteSpecIds: [...deleteSpecIds],
    });
  }
}
