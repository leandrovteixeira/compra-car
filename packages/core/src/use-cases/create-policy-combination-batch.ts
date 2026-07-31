import {
  validatePolicyCombinationBatch,
  type PolicyCombinationIssue,
  type PolicyCombinationRowInput,
} from '../admin/commercial-offer-builder';
import type {
  CommercialOfferBuilderRepository,
  PolicyCombinationBatchResult,
} from '../repositories/commercial-offer-builder-repository';

export type CreatePolicyCombinationBatchResult =
  | { readonly ok: true; readonly batch: PolicyCombinationBatchResult }
  | { readonly ok: false; readonly issues: readonly PolicyCombinationIssue[] };

export class CreatePolicyCombinationBatch {
  constructor(private readonly repository: CommercialOfferBuilderRepository) {}

  async execute(
    rows: readonly PolicyCombinationRowInput[],
    context: { readonly actorId: string; readonly correlationId: string },
  ): Promise<CreatePolicyCombinationBatchResult> {
    const [prices, policies] = await Promise.all([
      this.repository.listPublishedPrices(),
      this.repository.listAvailablePolicies(),
    ]);
    const validation = validatePolicyCombinationBatch(rows, prices, policies);
    if (!validation.ok) return validation;
    const drafts = await this.repository.listRecentDrafts();
    const duplicateIssues = validation.rows.flatMap((row) => {
      const fingerprint = [...row.policyIds].sort((a, b) => Number(a) - Number(b)).join(',');
      const duplicate = drafts.some(
        (draft) =>
          draft.status === 'draft' &&
          draft.productId === row.productId &&
          [...draft.policyIds].sort((a, b) => Number(a) - Number(b)).join(',') === fingerprint &&
          draft.validFrom === row.validFrom &&
          draft.validTo === row.validTo,
      );
      return duplicate
        ? [{ clientRowId: row.clientRowId, message: 'Uma oferta draft idêntica já existe.' }]
        : [];
    });
    if (duplicateIssues.length) return { ok: false, issues: duplicateIssues };
    return {
      ok: true,
      batch: await this.repository.createCombinationBatch({
        rows: validation.rows,
        ...context,
      }),
    };
  }
}
