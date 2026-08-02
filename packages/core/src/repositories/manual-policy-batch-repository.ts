import type {
  ManualPolicyBatchRowInput,
  ManualPolicyReferenceData,
  NormalizedManualPolicyBatchRow,
} from '../admin/manual-policy-batch';
import type { ManualPriceBatchProductOption } from './manual-price-batch-repository';
import type {
  CommercialPeriod,
  CommercialPeriodExpectedOffer,
  CommercialPeriodOfferRow,
} from '../admin/commercial-period';

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
  readonly rolloverCount: number;
}
export interface CommercialPeriodDraftResult {
  readonly period: CommercialPeriod;
  readonly batchId: string;
  readonly createdPolicyCount: number;
  readonly createdPolicyIds: readonly string[];
  readonly rolloverCount: number;
  readonly closedOfferIds: readonly string[];
  readonly createdOfferCount: number;
  readonly createdOfferIds: readonly string[];
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
  createCommercialPeriodDraft(input: {
    readonly productId: string;
    readonly period: CommercialPeriod;
    readonly policyRows: readonly NormalizedManualPolicyBatchRow[];
    readonly offerRows: readonly CommercialPeriodOfferRow[];
    readonly expectedOffers: readonly CommercialPeriodExpectedOffer[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<CommercialPeriodDraftResult>;
}
