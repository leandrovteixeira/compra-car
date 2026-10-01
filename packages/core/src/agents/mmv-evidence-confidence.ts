import type {
  MmvDiscoveryMaturityMode,
  MmvDiscoveryReasonCode,
  MmvDiscoverySourceKind,
} from './mmv-discovery-contract';
import type { ExtractionWarning } from './new-product-check-types';

export const MMV_SOURCE_AUTHORITY = {
  MANUFACTURER: 'PRIMARY_COMMERCIAL',
  FIPE: 'PRIMARY_MARKET_REFERENCE',
  SECONDARY: 'LEAD_ONLY',
} as const;

export type MmvSourceAuthority =
  (typeof MMV_SOURCE_AUTHORITY)[keyof typeof MMV_SOURCE_AUTHORITY];

export interface MmvEvidenceSourceObservation {
  readonly kind: MmvDiscoverySourceKind;
  /** Stable provenance key such as hostname, FIPE code family or source adapter id. */
  readonly sourceKey: string;
}

export type MmvCorroborationLevel =
  | 'SINGLE_PRIMARY'
  | 'MULTI_SOURCE_SAME_KIND'
  | 'CROSS_PRIMARY'
  | 'SECONDARY_ONLY'
  | 'NO_EVIDENCE';

export interface MmvEvidenceAssessment {
  readonly reasonCode: MmvDiscoveryReasonCode;
  readonly extractionConfidence: number;
  readonly sourceKinds: readonly MmvDiscoverySourceKind[];
  readonly distinctSources: number;
  readonly corroborationLevel: MmvCorroborationLevel;
  readonly warnings: readonly ExtractionWarning[];
  /** Evidence readiness only; never a calibrated probability of truth or novelty. */
  readonly readiness: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly maturity: MmvDiscoveryMaturityMode;
  /** Sprint 20D is validation-only regardless of readiness. */
  readonly automationEligible: false;
}

const highRiskReasons = new Set<MmvDiscoveryReasonCode>([
  'POSSIBLE_RENAME',
  'POSSIBLE_BODY_SPLIT',
  'POSSIBLE_SUCCESSOR',
  'POSSIBLE_DISCONTINUATION',
  'AMBIGUOUS_IDENTITY',
]);

export function mmvCorroborationLevel(
  sources: readonly MmvEvidenceSourceObservation[],
): MmvCorroborationLevel {
  if (!sources.length) return 'NO_EVIDENCE';
  const kinds = new Set(sources.map((source) => source.kind));
  const sourceKeys = new Set(sources.map((source) => source.kind + ':' + source.sourceKey));
  const hasManufacturer = kinds.has('MANUFACTURER');
  const hasFipe = kinds.has('FIPE');
  if (hasManufacturer && hasFipe) return 'CROSS_PRIMARY';
  if (!hasManufacturer && !hasFipe) return 'SECONDARY_ONLY';
  if (sourceKeys.size > 1) return 'MULTI_SOURCE_SAME_KIND';
  return 'SINGLE_PRIMARY';
}

export function assessMmvEvidence(input: {
  readonly reasonCode: MmvDiscoveryReasonCode;
  readonly extractionConfidence: number;
  readonly sources: readonly MmvEvidenceSourceObservation[];
  readonly warnings?: readonly ExtractionWarning[];
}): MmvEvidenceAssessment {
  const confidence = Number.isFinite(input.extractionConfidence)
    ? Math.max(0, Math.min(1, input.extractionConfidence))
    : 0;
  const warnings = [...new Set(input.warnings ?? [])];
  const corroborationLevel = mmvCorroborationLevel(input.sources);
  const blockingWarning = warnings.some((warning) =>
    ['CONFLICTING_SOURCES', 'INSUFFICIENT_EVIDENCE'].includes(warning),
  );
  let readiness: MmvEvidenceAssessment['readiness'] = 'LOW';

  if (!blockingWarning && corroborationLevel !== 'NO_EVIDENCE' && corroborationLevel !== 'SECONDARY_ONLY') {
    const crossPrimary = corroborationLevel === 'CROSS_PRIMARY';
    const strongExtraction = confidence >= 0.9;
    const acceptableExtraction = confidence >= 0.75;
    if (crossPrimary && strongExtraction && !highRiskReasons.has(input.reasonCode)) readiness = 'HIGH';
    else if (crossPrimary && acceptableExtraction) readiness = 'MEDIUM';
    else if (strongExtraction && !highRiskReasons.has(input.reasonCode)) readiness = 'MEDIUM';
  }

  return {
    reasonCode: input.reasonCode,
    extractionConfidence: confidence,
    sourceKinds: [...new Set(input.sources.map((source) => source.kind))],
    distinctSources: new Set(input.sources.map((source) => source.kind + ':' + source.sourceKey)).size,
    corroborationLevel,
    warnings,
    readiness,
    maturity: 'VALIDATION',
    automationEligible: false,
  };
}
