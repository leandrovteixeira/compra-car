import {
  validateManualPolicyBatch,
  normalizeManualPolicyBatchRow,
  type ManualPolicyBatchRowInput,
  type ManualPolicyBatchIssue,
} from '../admin/manual-policy-batch';
import type {
  ManualPolicyBatchRepository,
  ManualPolicyBatchResult,
} from '../repositories/manual-policy-batch-repository';

export type CreateManualPolicyBatchResult =
  | { readonly ok: true; readonly batch: ManualPolicyBatchResult }
  | { readonly ok: false; readonly issues: readonly ManualPolicyBatchIssue[] };
export class CreateManualPolicyBatch {
  constructor(private readonly repository: ManualPolicyBatchRepository) {}
  async execute(
    rows: readonly ManualPolicyBatchRowInput[],
    context: { readonly actorId: string; readonly correlationId: string },
  ): Promise<CreateManualPolicyBatchResult> {
    const normalizedInput = rows.map(normalizeManualPolicyBatchRow);
    const references = await this.repository.resolveReferences(normalizedInput);
    const validation = validateManualPolicyBatch(normalizedInput, references);
    if (!validation.ok) return validation;
    return {
      ok: true,
      batch: await this.repository.createManualPolicyBatch({ rows: validation.rows, ...context }),
    };
  }
}
