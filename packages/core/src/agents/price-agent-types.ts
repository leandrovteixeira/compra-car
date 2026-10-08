import type { AgentFindingBundle, AgentReview, AgentRun } from '../agent-platform/types';
import type { ProductPublicPrice } from '../entities/product-public-price';
import type { BrandConnector } from './brand-connector-types';

export type PriceSourceKind =
  | 'OFFICIAL_PRICE_LIST'
  | 'OFFICIAL_MODEL_PAGE'
  | 'OFFICIAL_CONFIGURATOR'
  | 'OFFICIAL_OFFER_PAGE'
  | 'OFFICIAL_STRUCTURED_DATA';

export interface PriceTarget {
  readonly productId: string;
  readonly mmvIdentity: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: number;
  readonly currentPrice: Pick<ProductPublicPrice, 'id' | 'money' | 'startsOn' | 'status'> | null;
  readonly knownPriceAliases?: readonly string[];
}

export interface PriceEvidence {
  readonly sourceUrl: string;
  readonly sourceKind: PriceSourceKind;
  readonly contentHash: string;
  readonly locator: string;
  readonly excerpt: string;
  readonly capturedAt: string;
}

export interface PriceObservation {
  readonly target: PriceTarget;
  readonly currencyCode: 'BRL';
  readonly msrpAmount: string | null;
  readonly publicOfferAmount: string | null;
  readonly retailBonusAmount: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly confidence: number;
  readonly ambiguityReasons: readonly string[];
  readonly evidence: readonly PriceEvidence[];
}

export interface PriceSourceSnapshot {
  readonly sourceUrl: string;
  readonly finalUrl: string;
  readonly sourceKind: PriceSourceKind;
  readonly fetchedAt: string;
  readonly contentType: string;
  readonly contentHash: string;
  readonly targetKey: string;
  readonly body: string;
  /** Cache lineage supplied by an upstream agent. No refetch/LLM is needed when reusable=true. */
  readonly reusedFromAgentRunId?: string | null;
  readonly reusable?: boolean;
}

export interface PriceAiUsage {
  readonly model: string;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly webSearchCount: number;
  readonly estimatedCostUsd: number;
}

export interface PriceIdentityMapping {
  readonly productId: string;
  readonly observedLabel: string;
  readonly confidence: number;
  readonly sourceUrl: string;
  readonly modelUsed: string;
}

export interface PriceReconciliationProvider {
  reconcile(
    targets: readonly PriceTarget[],
    connector: BrandConnector,
    budgetUsd: number,
  ): Promise<{
    readonly observations: readonly PriceObservation[];
    readonly mappings: readonly PriceIdentityMapping[];
    readonly usage: readonly PriceAiUsage[];
  }>;
}

export interface PriceResearchResult {
  readonly observations: readonly PriceObservation[];
  readonly snapshots: readonly PriceSourceSnapshot[];
  readonly mappings?: readonly PriceIdentityMapping[];
  readonly usage?: readonly PriceAiUsage[];
  readonly diagnostics?: readonly {
    readonly target: string;
    readonly sourceUrl: string;
    readonly reason: 'TARGET_MISS' | 'PRICE_PATTERN_MISS';
    readonly sample: string;
  }[];
  readonly metrics: Readonly<{
    sourcesConsidered: number;
    cacheHits: number;
    networkFetches: number;
    deterministicExtractions: number;
    documentIntelligenceCalls: number;
    llmCalls?: number;
    llmInputTokens?: number;
    llmCachedInputTokens?: number;
    llmOutputTokens?: number;
    llmReasoningTokens?: number;
    webSearchCount?: number;
    targetMisses: number;
    pricePatternMisses: number;
    modelSourceSkips: number;
    uniqueNetworkUrls: number;
    solEscalations: number;
    estimatedCostUsd: number;
  }>;
}

export interface PriceResearchProvider {
  beginRun?(): void;
  researchPrices(
    targets: readonly PriceTarget[],
    connector: BrandConnector,
  ): Promise<PriceResearchResult>;
}

export interface PriceCatalogReader {
  readPriceTargets(brand: string, market: string): Promise<readonly PriceTarget[]>;
}

export interface PricePriorAgentCache {
  readonly run: AgentRun;
  readonly findings: readonly (AgentFindingBundle & { readonly latestReview: AgentReview | null })[];
}
