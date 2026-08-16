import type { CommercialDocumentExtractionV1 } from './commercial-document-extraction';
import type {
  CommercialDocumentMapV1,
  CommercialExtractionUnit,
  CommercialExtractionUnitPlanV1,
} from './commercial-document-map';

export const SEGMENTED_EXTRACTION_PROMPT_VERSION = '1' as const;
export const SEGMENTED_EXTRACTION_SCHEMA_VERSION = 'CommercialDocumentExtraction/1' as const;

export const SEGMENTED_EXTRACTION_LIMITS = Object.freeze({
  defaultConcurrency: 2,
  minConcurrency: 1,
  maxConcurrency: 4,
  defaultUnitTimeoutMs: 120_000,
  minUnitTimeoutMs: 10,
  maxUnitTimeoutMs: 300_000,
  defaultTotalTimeoutMs: 480_000,
  minTotalTimeoutMs: 20,
  maxTotalTimeoutMs: 600_000,
  recommendedRunnerCleanupMarginMs: 30_000,
} as const);

export interface SegmentedExtractionSourceDocument {
  readonly documentId: string;
  readonly ordinal: number;
  readonly bytes: Uint8Array;
}

export interface SegmentedExtractionSource {
  readonly documents: readonly SegmentedExtractionSourceDocument[];
}

export interface StructuredExtractionUsage {
  readonly inputUnits: number;
  readonly outputUnits: number;
  readonly totalUnits: number;
}

export interface StructuredExtractionRequest {
  readonly instructions: string;
  readonly schemaName: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly signal: AbortSignal;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface StructuredExtractionResponse {
  readonly output: unknown;
  readonly providerRunId: string;
  readonly usage: StructuredExtractionUsage;
}

export interface StructuredExtractionSourceSession {
  extractStructured(request: StructuredExtractionRequest): Promise<StructuredExtractionResponse>;
  close(): Promise<void>;
}

export interface StructuredExtractionProvider {
  openSource(
    source: SegmentedExtractionSource,
    options: { readonly signal: AbortSignal; readonly correlationId: string },
  ): Promise<StructuredExtractionSourceSession>;
}

export interface SegmentedExtractionUnitContext {
  readonly unit: CommercialExtractionUnit;
  readonly sourceDocument: CommercialDocumentMapV1['documents'][number];
  readonly primaryPages: readonly CommercialDocumentMapV1['pages'][number][];
  readonly contextOnlyPages: readonly CommercialDocumentMapV1['pages'][number][];
  readonly tables: readonly CommercialDocumentMapV1['tables'][number][];
  readonly notes: readonly CommercialDocumentMapV1['notes'][number][];
  readonly contextEdges: readonly CommercialDocumentMapV1['contextEdges'][number][];
  readonly inheritedHeaderBlockIds: readonly string[];
}

export type SegmentedExtractionErrorCode =
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_FAILURE'
  | 'INVALID_STRUCTURED_OUTPUT'
  | 'CANONICAL_VALIDATION_FAILED'
  | 'ORCHESTRATION_TIMEOUT'
  | 'ABORTED_SIBLING';

export interface SegmentedExtractionUnitSuccess {
  readonly status: 'succeeded';
  readonly unitId: string;
  readonly ordinal: number;
  readonly artifact: CommercialDocumentExtractionV1;
  readonly providerRunId: string;
  readonly usage: StructuredExtractionUsage;
  readonly durationMs: number;
}

export interface SegmentedExtractionUnitFailure {
  readonly status: 'failed';
  readonly unitId: string;
  readonly ordinal: number;
  readonly code: SegmentedExtractionErrorCode;
  readonly durationMs: number;
}

export type SegmentedExtractionUnitResult =
  SegmentedExtractionUnitSuccess | SegmentedExtractionUnitFailure;

export interface SegmentedExtractionOperationalResult {
  readonly correlationId: string;
  readonly schemaVersion: typeof SEGMENTED_EXTRACTION_SCHEMA_VERSION;
  readonly promptVersion: typeof SEGMENTED_EXTRACTION_PROMPT_VERSION;
  readonly unitResults: readonly SegmentedExtractionUnitResult[];
  readonly cleanup: 'succeeded' | 'failed';
}

export interface SegmentedExtractionInput {
  readonly documentMap: CommercialDocumentMapV1;
  readonly unitPlan: CommercialExtractionUnitPlanV1;
  readonly source: SegmentedExtractionSource;
  readonly correlationId: string;
}
