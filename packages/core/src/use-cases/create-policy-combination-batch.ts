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
    return {
      ok: true,
      batch: await this.repository.createCombinationBatch({
        rows: validation.rows,
        ...context,
      }),
    };
  }
}
