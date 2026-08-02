import {
  normalizeManualPolicyBatchRow,
  validateManualPolicyBatch,
  type ManualPolicyBatchIssue,
  type ManualPolicyBatchRowInput,
} from '../admin/manual-policy-batch';
import type {
  CommercialPeriod,
  CommercialPeriodExpectedOffer,
  CommercialPeriodOfferRow,
} from '../admin/commercial-period';
import type {
  CommercialPeriodDraftResult,
  ManualPolicyBatchRepository,
} from '../repositories/manual-policy-batch-repository';

export type CreateCommercialPeriodDraftResult =
  | { readonly ok: true; readonly result: CommercialPeriodDraftResult }
  | { readonly ok: false; readonly issues: readonly ManualPolicyBatchIssue[] };

export class CreateCommercialPeriodDraft {
  constructor(private readonly repository: ManualPolicyBatchRepository) {}

  async execute(
    input: {
      readonly productId: string;
      readonly period: CommercialPeriod;
      readonly policyRows: readonly ManualPolicyBatchRowInput[];
      readonly offerRows: readonly CommercialPeriodOfferRow[];
      readonly expectedOffers: readonly CommercialPeriodExpectedOffer[];
    },
    context: { readonly actorId: string; readonly correlationId: string },
  ): Promise<CreateCommercialPeriodDraftResult> {
    const normalized = input.policyRows.map((row) =>
      normalizeManualPolicyBatchRow({
        ...row,
        productId: input.productId,
        startsOn: input.period.start,
        endsOn: input.period.end,
      }),
    );
    const references = await this.repository.resolveReferences(normalized);
    const validation = validateManualPolicyBatch(normalized, references);
    if (!validation.ok) return validation;

    const issues: ManualPolicyBatchIssue[] = [];
    const policyClientIds = new Set(validation.rows.map((row) => row.clientRowId));
    const offerClientIds = new Set<string>();
    for (const offer of input.offerRows) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(offer.clientRowId)) {
        issues.push({
          clientRowId: offer.clientRowId,
          field: 'row',
          message: 'Identificador local da Offer inválido.',
        });
      }
      if (offerClientIds.has(offer.clientRowId)) {
        issues.push({
          clientRowId: offer.clientRowId,
          field: 'row',
          message: 'A mesma Offer aparece mais de uma vez.',
        });
      }
      offerClientIds.add(offer.clientRowId);
      if (!offer.policyRefs.length) {
        issues.push({
          clientRowId: offer.clientRowId,
          field: 'row',
          message: 'Selecione ao menos uma Policy para a Offer.',
        });
      }
      for (const reference of offer.policyRefs) {
        if (
          typeof reference.policyClientRowId === 'string' &&
          !policyClientIds.has(reference.policyClientRowId)
        ) {
          issues.push({
            clientRowId: offer.clientRowId,
            field: 'row',
            message: 'A Offer referencia uma nova Policy inexistente.',
          });
        }
        if (typeof reference.policyId === 'string' && !/^\d+$/u.test(reference.policyId)) {
          issues.push({
            clientRowId: offer.clientRowId,
            field: 'row',
            message: 'A Offer referencia uma Policy persistida inválida.',
          });
        }
      }
    }
    if (issues.length) return { ok: false, issues: Object.freeze(issues) };

    return {
      ok: true,
      result: await this.repository.createCommercialPeriodDraft({
        productId: input.productId,
        period: input.period,
        policyRows: validation.rows,
        offerRows: input.offerRows,
        expectedOffers: input.expectedOffers,
        ...context,
      }),
    };
  }
}
