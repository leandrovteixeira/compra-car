import type { AdministrativeVehicle } from '../admin/administrative-vehicle';

export interface AgentMarketScope {
  readonly country: 'BR';
  readonly brand: string;
}
export interface OfficialBrandSource extends AgentMarketScope {
  readonly allowedDomains: readonly string[];
  readonly allowedHosts: readonly string[];
  readonly searchHints: readonly string[];
}
export type OfficialEvidenceType =
  | 'TECHNICAL_SHEET'
  | 'VERSION_DOCUMENT'
  | 'PRICE_LIST'
  | 'CONFIGURATOR'
  | 'MODEL_PAGE'
  | 'PRESS_RELEASE'
  | 'OTHER_OFFICIAL';
export interface ProductEvidence {
  readonly url: string;
  readonly title: string | null;
  readonly excerpt: string | null;
  readonly evidenceType: OfficialEvidenceType | null;
}
export type ExtractionWarning =
  'POSSIBLE_ALIAS' | 'POSSIBLE_PACKAGE' | 'CONFLICTING_SOURCES' | 'INSUFFICIENT_EVIDENCE';
export type OfficialProductTaxonomy =
  'MODEL' | 'VARIANT' | 'POWERTRAIN' | 'LANDING_PAGE' | 'UNKNOWN';
export type ProductPropulsion = 'ICE' | 'MHEV' | 'HEV' | 'PHEV' | 'BEV';
export interface OfficialProductCandidate {
  readonly brand: string;
  /** Manufacturer's base model, never inferred from a URL slug. */
  readonly model: string;
  readonly taxonomy: OfficialProductTaxonomy;
  /** Preserve published spelling; never compose from trim/engine/transmission. */
  readonly officialVersionLabel: string | null;
  readonly trim: string | null;
  readonly powertrainLabel: string | null;
  /** Litres, only when explicitly published. */
  readonly engineDisplacement: number | null;
  readonly engineLabel: string | null;
  readonly propulsion: ProductPropulsion | null;
  readonly transmission: string | null;
  readonly drivetrain: string | null;
  readonly productionYear: number | null;
  readonly modelYear: number | null;
  /** Confidence in extraction, never in novelty. */
  readonly confidence: number;
  readonly evidence: readonly ProductEvidence[];
  readonly extractionWarnings?: readonly ExtractionWarning[];
}
export type ProductMatchMode = 'EXACT_OFFICIAL' | 'LEGACY_NAMING';
export type NewProductFindingType =
  'NEW_MODEL' | 'NEW_VERSION' | 'POSSIBLE_YEAR_CHANGE' | 'AMBIGUOUS';
export interface NewProductFinding {
  /** Deduplicated official variants for a model-level finding; empty for other types. */
  readonly variants: readonly OfficialProductCandidate[];
  readonly warnings: readonly ExtractionWarning[];
  readonly fingerprint: string;
  readonly type: NewProductFindingType;
  readonly candidate: OfficialProductCandidate;
  readonly matchedProductIds: readonly string[];
  /** Possible correspondences for ambiguity; reconciled record for year change. */
  readonly matchedProducts: readonly AdministrativeVehicle[];
  readonly matchMode: ProductMatchMode | null;
  readonly reason: string;
}
export interface ResearchMetadata {
  readonly provider: string;
  readonly model?: string;
  readonly responseId?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly webSearchCount?: number;
}
export interface ProductResearchProvider {
  /** Discovery then resolution, in one structured response or multiple provider calls. */
  researchProducts(scope: AgentMarketScope): Promise<{
    readonly candidates: readonly OfficialProductCandidate[];
    readonly metadata: ResearchMetadata;
  }>;
}
export interface ProductCatalogReader {
  readProducts(scope: AgentMarketScope): Promise<readonly AdministrativeVehicle[]>;
}
export interface MatchedProductCandidate {
  readonly candidate: OfficialProductCandidate;
  readonly matchedProductIds: readonly string[];
  readonly matchedProducts: readonly AdministrativeVehicle[];
  readonly matchMode: ProductMatchMode;
  readonly reason: string;
}
export interface RejectedProductCandidate {
  readonly candidateIndex: number;
  readonly reason: 'INVALID_CANDIDATE' | 'OUT_OF_SCOPE' | 'NO_OFFICIAL_EVIDENCE';
}
export interface NewProductCheckResult {
  readonly schemaVersion: '19A.2';
  readonly runId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly brand: string;
  readonly market: 'BR';
  readonly researchedCandidates: number;
  readonly acceptedCandidates: number;
  readonly modelsDiscovered: number;
  readonly variantsResolved: number;
  readonly knownProducts: number;
  readonly matchedCandidates: readonly MatchedProductCandidate[];
  readonly findings: readonly NewProductFinding[];
  readonly rejectedCandidates: readonly RejectedProductCandidate[];
  readonly rejectedExternalSources: number;
  readonly researchMetadata: ResearchMetadata;
}
export interface ReportWriter {
  write(result: NewProductCheckResult): Promise<void>;
}
