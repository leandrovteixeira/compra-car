import {
  validateManualPriceBatch,
  type CreateManualPriceBatchInput,
  type ManualPriceBatchValidationIssue,
} from '../admin/manual-price-batch';
import type {
  ManualPriceBatchRepository,
  ManualPriceBatchResult,
} from '../repositories/manual-price-batch-repository';

export type CreateManualPriceBatchResult =
  | { readonly ok: true; readonly batch: ManualPriceBatchResult }
  | {
      readonly ok: false;
      readonly code: 'EMPTY_BATCH' | 'BATCH_LIMIT_EXCEEDED' | 'INVALID_ROWS';
      readonly issues: readonly ManualPriceBatchValidationIssue[];
    };

export class CreateManualPriceBatch {
  constructor(private readonly repository: ManualPriceBatchRepository) {}

  async execute(
    input: CreateManualPriceBatchInput,
    context: { readonly actorId: string; readonly correlationId: string },
  ): Promise<CreateManualPriceBatchResult> {
    const validation = validateManualPriceBatch(input);
    if (!validation.ok) return validation;
    return {
      ok: true,
      batch: await this.repository.createManualPriceBatch({ rows: validation.rows, ...context }),
    };
  }
}
