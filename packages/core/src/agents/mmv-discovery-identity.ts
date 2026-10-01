import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import { powertrainComparisonKey } from './product-component-normalization';
import type {
  MmvCommercialVariantDiscriminator,
  MmvDiscoveryIdentity,
} from './mmv-discovery-contract';
import type { OfficialProductCandidate } from './new-product-check-types';

function normalizedOptional(value: string | null): string | null {
  return value === null ? null : key(value);
}

export function mmvCommercialVariantDiscriminator(
  candidate: OfficialProductCandidate,
): MmvCommercialVariantDiscriminator {
  return {
    commercialPowertrainLabel: candidate.powertrainLabel,
    propulsion: candidate.propulsion,
    engineDisplacement: candidate.engineDisplacement,
    engineLabel: candidate.engineLabel,
    transmission: candidate.transmission,
    drivetrain: candidate.drivetrain,
  };
}

/**
 * Project a resolved current-discovery candidate into a commercial identity proposal.
 *
 * The official label remains untouched for presentation. The internal discriminator
 * exists only because distinct products can share the same visible version label.
 */
export function projectMmvDiscoveryIdentity(
  candidate: OfficialProductCandidate,
): MmvDiscoveryIdentity {
  const officialVersionLabel = candidate.officialVersionLabel ?? candidate.trim;
  if (!officialVersionLabel?.trim()) throw new Error('MMV_RESOLVED_VARIANT_REQUIRED');

  return {
    brand: candidate.brand,
    model: candidate.model,
    officialVersionLabel,
    bodyStyle: null,
    discriminator: mmvCommercialVariantDiscriminator(candidate),
  };
}

/**
 * Stable proposal key for current discovery.
 *
 * Transmission and drivetrain are intentionally not identity-forming here: in Sprint 20
 * they are evidence/attributes unless a future reviewed rule explicitly promotes them.
 * This avoids creating new MMVs from descriptors such as AT/AT6 alone.
 */
export function mmvDiscoveryIdentityKey(candidate: OfficialProductCandidate): string {
  const identity = projectMmvDiscoveryIdentity(candidate);
  const powertrain =
    identity.discriminator.commercialPowertrainLabel === null
      ? null
      : powertrainComparisonKey(identity.discriminator.commercialPowertrainLabel);

  return JSON.stringify([
    'mmv-current:v1',
    key(identity.brand),
    key(identity.model),
    key(identity.officialVersionLabel),
    normalizedOptional(identity.bodyStyle),
    powertrain,
    identity.discriminator.propulsion,
    identity.discriminator.engineDisplacement,
    normalizedOptional(identity.discriminator.engineLabel),
  ]);
}
