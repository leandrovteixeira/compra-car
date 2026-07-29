import type { NormalizedManualPriceBatchRow } from '../admin/manual-price-batch';

export interface ManualPriceBatchProductOption {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly isActive: boolean;
  readonly isPublic: boolean;
}

export interface ManualPriceBatchRowResult {
  readonly clientRowId: string;
  readonly importRowId: string;
  readonly priceId: string;
}

export interface ManualPriceBatchResult {
  readonly batchId: string;
  readonly createdCount: number;
  readonly priceIds: readonly string[];
  readonly rows: readonly ManualPriceBatchRowResult[];
}

export interface ManualPriceBatchRepository {
  listProductOptions(): Promise<readonly ManualPriceBatchProductOption[]>;
  createManualPriceBatch(input: {
    readonly rows: readonly NormalizedManualPriceBatchRow[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ManualPriceBatchResult>;
}
