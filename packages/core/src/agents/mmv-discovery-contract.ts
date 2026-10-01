import type { ProductEvidence, ProductPropulsion } from './new-product-check-types';

export const MMV_DISCOVERY_MATURITY_MODES = ['VALIDATION', 'ASSISTED', 'AUTO'] as const;
export type MmvDiscoveryMaturityMode = (typeof MMV_DISCOVERY_MATURITY_MODES)[number];

export const MMV_DISCOVERY_SOURCE_KINDS = ['MANUFACTURER', 'FIPE', 'SECONDARY'] as const;
export type MmvDiscoverySourceKind = (typeof MMV_DISCOVERY_SOURCE_KINDS)[number];

export const MMV_DISCOVERY_REASON_CODES = [
  'NEW_MODEL',
  'NEW_COMMERCIAL_VARIANT',
  'POSSIBLE_RENAME',
  'DESCRIPTOR_ONLY_VARIATION',
  'SAME_LABEL_DISTINCT_POWERTRAIN',
  'POSSIBLE_BODY_SPLIT',
  'POSSIBLE_SUCCESSOR',
  'POSSIBLE_DISCONTINUATION',
  'NON_MMV_PACKAGE',
  'AMBIGUOUS_IDENTITY',
] as const;
export type MmvDiscoveryReasonCode = (typeof MMV_DISCOVERY_REASON_CODES)[number];

export const MMV_DISCOVERY_CONSECUTIVE_MISS_RANGE = {
  min: 7,
  max: 10,
} as const;

/**
 * Evidence-layer observation. bodyStyle may help resolve the marketed model name,
 * but must not silently rewrite canonical model identity.
 */
export interface MmvBodyObservation {
  readonly bodyStyle: string;
  readonly sourceKind: MmvDiscoverySourceKind;
  readonly sourceUrl: string;
}

/**
 * Internal discriminator for commercial variants that can share the same visible
 * version label. It never replaces or synthesizes the official display label.
 */
export interface MmvCommercialVariantDiscriminator {
  readonly commercialPowertrainLabel: string | null;
  readonly propulsion: ProductPropulsion | null;
  readonly engineDisplacement: number | null;
  readonly engineLabel: string | null;
  readonly transmission: string | null;
  readonly drivetrain: string | null;
}

/**
 * Cross-source discovery identity. officialVersionLabel remains presentation-authoritative.
 * discriminator exists only to keep distinct commercial variants distinct internally.
 */
export interface MmvDiscoveryIdentity {
  readonly brand: string;
  readonly model: string;
  readonly officialVersionLabel: string;
  readonly bodyStyle: string | null;
  readonly discriminator: MmvCommercialVariantDiscriminator;
}

/**
 * Decision maturity is configured per class. There is intentionally no single global
 * confidence switch that can promote every identity decision to AUTO.
 */
export interface MmvDiscoveryDecisionPolicy {
  readonly reasonCode: MmvDiscoveryReasonCode;
  readonly maturity: MmvDiscoveryMaturityMode;
  readonly minimumConfidence: number | null;
  readonly requireMultipleIndependentSources: boolean;
}

export interface MmvBodyModelResolutionProposal {
  readonly reasonCode: 'POSSIBLE_BODY_SPLIT';
  readonly currentModel: string;
  readonly bodyStyle: string;
  readonly proposedModel: string;
  readonly requiresReview: true;
  readonly evidence: readonly ProductEvidence[];
}
