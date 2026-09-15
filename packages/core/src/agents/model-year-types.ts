import type { AgentFindingBundle, AgentReview, AgentRun } from '../agent-platform/types';
import type {
  AgentMarketScope,
  OfficialBrandSource,
  ProductEvidence,
} from './new-product-check-types';
export interface ModelYearResearchTarget {
  readonly targetKey: string;
  readonly mmvIdentity: string;
  readonly canonicalCatalogIdentity: {
    readonly brand: string;
    readonly model: string;
    readonly version: string;
  };
  readonly officialIdentity: {
    readonly brand: string;
    readonly model: string;
    readonly officialVersionLabel: string;
  };
  readonly structuredIdentity: {
    readonly trim: string | null;
    readonly powertrainLabel: string | null;
    readonly engineDisplacement: number | null;
    readonly engineLabel: string | null;
    readonly propulsion: string | null;
    readonly transmission: string | null;
    readonly drivetrain: string | null;
  };
  readonly knownAliases: readonly string[];
  readonly knownModelYears: readonly number[];
  readonly discoveryEvidence: readonly ProductEvidence[];
}
export interface ModelYearObservation {
  readonly targetKey: string;
  readonly modelYear: number;
  readonly confidence: number;
  readonly applicability: 'EXACT_VERSION' | 'MODEL_LINE';
  readonly evidence: readonly ModelYearEvidence[];
  readonly sourceTier?: ModelYearSourceTier;
  readonly sourceKind?: ModelYearSourceKind;
  readonly structuredRow?: StructuredModelYearRow;
  readonly fipeCodeCandidates?: readonly FipeCodeCandidate[];
  readonly dealer?: { readonly name: string; readonly domain: string } | null;
  readonly requestedTargetKey?: string;
}
export interface ModelYearResearchProvider {
  researchModelYears(
    targets: readonly ModelYearResearchTarget[],
    source: OfficialBrandSource,
  ): Promise<readonly ModelYearObservation[] | ModelYearResearchResult>;
}
export interface MmvDiscoveryContext {
  readonly run: AgentRun;
  readonly findings: readonly (AgentFindingBundle & {
    readonly latestReview: AgentReview | null;
  })[];
}
export interface MmvDiscoveryReader {
  latestCompleted(scope: AgentMarketScope): Promise<MmvDiscoveryContext | null>;
}

export const MODEL_YEAR_SOURCE_TIERS = [
  'STRUCTURED_AUTOMOTIVE_DATA',
  'MANUFACTURER_OFFICIAL',
  'AUTHORIZED_DEALER',
] as const;
export type ModelYearSourceTier = (typeof MODEL_YEAR_SOURCE_TIERS)[number];

export interface ModelYearEvidence extends ProductEvidence {
  readonly role?: 'MY_ASSERTION' | 'TARGET_APPLICABILITY' | 'DEALER_AUTHORIZATION';
  /** Identifies one contiguous block within one canonical page; never a whole-page synthetic collage. */
  readonly contextId?: string | null;
  readonly contextText?: string | null;
  readonly yearSemantics?: 'EXPLICIT_MY' | 'VEHICLE_MODEL_YEAR' | null;
}
export const MODEL_YEAR_REJECTION_CODES = [
  'NO_EXPLICIT_MY',
  'MODEL_NOT_BOUND',
  'VERSION_NOT_BOUND',
  'MODEL_LINE_NOT_BOUND',
  'APPLICABILITY_NOT_PROVEN',
  'INVALID_EVIDENCE_CONTEXT',
  'EXTERNAL_SOURCE_NOT_APPROVED',
  'DEALER_AUTHORIZATION_NOT_PROVEN',
  'STRUCTURED_VERSION_NOT_MATCHED',
  'STRUCTURED_VERSION_AMBIGUOUS',
  'STRUCTURED_YEAR_PAGE_INVALID',
  'STRUCTURED_SOURCE_UNAVAILABLE',
  'FIPE_CODE_INVALID',
  'INVALID_YEAR',
  'INVALID_TARGET',
  'INVALID_CONFIDENCE',
  'DUPLICATE_OBSERVATION',
] as const;
export type ModelYearRejectionCode = (typeof MODEL_YEAR_REJECTION_CODES)[number];
export interface RejectedModelYearObservation {
  readonly sourceKind?: ModelYearSourceKind;
  readonly observedVersionLabel?: string;
  readonly targetKey: string;
  readonly requestedTargetKey: string | null;
  readonly catalogIdentity: ModelYearResearchTarget['canonicalCatalogIdentity'] | null;
  readonly officialIdentity: ModelYearResearchTarget['officialIdentity'] | null;
  readonly proposedModelYear: number | null;
  readonly sourceTier: string;
  readonly sourceUrl: string | null;
  readonly sourceDomain: string | null;
  readonly applicability: string;
  readonly reasonCode: ModelYearRejectionCode;
}
export interface ModelYearSearchAttempt {
  readonly targetKey: string;
  readonly stage: ModelYearSourceTier;
  readonly status: 'COMPLETED' | 'FAILED';
  readonly webSearchCount: number;
  readonly errorCode: string | null;
}
export interface ModelYearResearchResult {
  readonly strategy?: {
    readonly mode: ModelYearMode;
    readonly allowDealer: boolean;
    readonly maxOpenAiModelGroups: number;
  };
  readonly rejections?: readonly RejectedModelYearObservation[];
  readonly metrics?: Readonly<Record<string, number>>;
  readonly observations: readonly ModelYearObservation[];
  readonly searchAttempts: readonly ModelYearSearchAttempt[];
}

export const MODEL_YEAR_SOURCE_KINDS = [
  'FIPE_OFFICIAL',
  'WEBMOTORS_FIPE',
  'WEBMOTORS_CATALOG',
  'CARROSNAWEB',
  'MANUFACTURER_OFFICIAL',
  'AUTHORIZED_DEALER',
] as const;
export type ModelYearSourceKind = (typeof MODEL_YEAR_SOURCE_KINDS)[number];
export type ModelYearMode = 'MONITOR' | 'BASELINE';
export interface FipeCodeCandidate {
  readonly code: string;
  readonly sourceKind: ModelYearSourceKind;
  readonly sourceUrl: string;
  readonly modelYear: number;
  readonly observedVersionLabel: string;
}
export interface StructuredModelYearRow {
  readonly brand: string;
  readonly model: string;
  readonly modelYear: number;
  readonly versionLabel: string;
  readonly fipeCode?: string | null;
  readonly sourceKind: ModelYearSourceKind;
  readonly sourceUrl: string;
}
export interface ModelYearGroup {
  readonly key: string;
  readonly brand: string;
  readonly model: string;
  readonly targets: readonly ModelYearResearchTarget[];
}
export interface StructuredModelYearProvider {
  /** New request-scoped cache per run; no persistent catalog cache. */
  beginRun?(): void;
  discover(
    group: ModelYearGroup,
    mode: ModelYearMode,
  ): Promise<{
    rows: readonly StructuredModelYearRow[];
    issues: readonly {
      reasonCode: ModelYearRejectionCode;
      sourceUrl: string | null;
      modelYear: number | null;
    }[];
    metrics: Readonly<Record<string, number>>;
  }>;
}
