import type {
  ManualPolicyBatchRowInput,
  ManualPolicyReferenceData,
  NormalizedManualPolicyBatchRow,
} from '../admin/manual-policy-batch';
import type { ManualPriceBatchProductOption } from './manual-price-batch-repository';

export interface ManualPolicyBasePrice {
  readonly id: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}
export interface ManualPolicyFinancialReference {
  readonly id: string;
  readonly version: number;
  readonly effectiveFrom: string;
  readonly validTo: string | null;
  readonly cdiMonthlyPercentage: string;
  readonly spreadMonthlyPercentage: string;
  readonly monthlyReferenceRate: string;
}
export interface ManualPolicyBatchResult {
  readonly batchId: string;
  readonly createdCount: number;
  readonly policyIds: readonly string[];
}
export interface ManualPolicyBatchRepository {
  listProductOptions(): Promise<readonly ManualPriceBatchProductOption[]>;
  listBasePrices(): Promise<readonly ManualPolicyBasePrice[]>;
  listFinancialReferences(): Promise<readonly ManualPolicyFinancialReference[]>;
  resolveReferences(
    rows: readonly ManualPolicyBatchRowInput[],
  ): Promise<Readonly<Record<string, ManualPolicyReferenceData>>>;
  createManualPolicyBatch(input: {
    readonly rows: readonly NormalizedManualPolicyBatchRow[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ManualPolicyBatchResult>;
}
