import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import { normalizePowertrainComponents } from './product-component-normalization';
import type { MmvDiscoveryReasonCode } from './mmv-discovery-contract';
import type { OfficialProductCandidate } from './new-product-check-types';

export interface MmvVersionChangeClassification {
  readonly reasonCode: Extract<
    MmvDiscoveryReasonCode,
    | 'NEW_COMMERCIAL_VARIANT'
    | 'POSSIBLE_RENAME'
    | 'DESCRIPTOR_ONLY_VARIATION'
    | 'SAME_LABEL_DISTINCT_POWERTRAIN'
  >;
  readonly requiresReview: true;
  readonly explanation: string;
}

function label(candidate: OfficialProductCandidate): string {
  return candidate.officialVersionLabel ?? candidate.trim ?? '';
}

function stripTransmissionDescriptor(value: string): string {
  return key(value)
    .replace(/\b(?:at\d*|cvt|mt\d*|dht)\b/gu, ' ')
    .replace(/\b(?:automatic[ao]|manual)(?:\s+de\s+\d+\s+(?:marchas|velocidades))?\b/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function explicitPowertrainSignature(candidate: OfficialProductCandidate): string {
  const parsed = normalizePowertrainComponents(candidate.powertrainLabel);
  return JSON.stringify([
    parsed.code,
    parsed.propulsion ?? candidate.propulsion,
    parsed.displacement ?? candidate.engineDisplacement,
  ]);
}

function hasExplicitPowertrainIdentity(candidate: OfficialProductCandidate): boolean {
  const parsed = normalizePowertrainComponents(candidate.powertrainLabel);
  return (
    parsed.code !== null ||
    parsed.propulsion !== null ||
    parsed.displacement !== null ||
    candidate.propulsion !== null ||
    candidate.engineDisplacement !== null
  );
}

/**
 * Conservative comparison used only to explain a proposal. It never merges or creates catalog data.
 */
export function classifyMmvVersionChange(
  previous: OfficialProductCandidate,
  next: OfficialProductCandidate,
): MmvVersionChangeClassification {
  const previousLabel = label(previous);
  const nextLabel = label(next);
  const sameVisibleLabel = key(previousLabel) === key(nextLabel);
  const powertrainChanged =
    explicitPowertrainSignature(previous) !== explicitPowertrainSignature(next);

  if (sameVisibleLabel && powertrainChanged &&
      hasExplicitPowertrainIdentity(previous) && hasExplicitPowertrainIdentity(next)) {
    return {
      reasonCode: 'SAME_LABEL_DISTINCT_POWERTRAIN',
      requiresReview: true,
      explanation: 'Same commercial version label, but explicit powertrain identity differs.',
    };
  }

  const previousWithoutTransmission = stripTransmissionDescriptor(previousLabel);
  const nextWithoutTransmission = stripTransmissionDescriptor(nextLabel);
  const labelChanged = key(previousLabel) !== key(nextLabel);
  if (
    labelChanged &&
    previousWithoutTransmission &&
    previousWithoutTransmission === nextWithoutTransmission &&
    !powertrainChanged
  ) {
    return {
      reasonCode: 'DESCRIPTOR_ONLY_VARIATION',
      requiresReview: true,
      explanation: 'Visible naming differs only by a transmission-style technical descriptor.',
    };
  }

  if (powertrainChanged && hasExplicitPowertrainIdentity(next)) {
    return {
      reasonCode: 'NEW_COMMERCIAL_VARIANT',
      requiresReview: true,
      explanation: 'Explicit commercial powertrain identity changed between observations.',
    };
  }


  return {
    reasonCode: 'POSSIBLE_RENAME',
    requiresReview: true,
    explanation: 'Naming changed, but available structured evidence does not prove a new commercial variant.',
  };
}
