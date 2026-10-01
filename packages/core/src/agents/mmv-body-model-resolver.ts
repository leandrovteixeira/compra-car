import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { MmvBodyModelResolutionProposal } from './mmv-discovery-contract';
import type { OfficialProductCandidate } from './new-product-check-types';

function bodyAlreadyInModel(model: string, bodyStyle: string): boolean {
  const normalizedModel = key(model);
  const normalizedBody = key(bodyStyle);
  return (
    normalizedModel === normalizedBody ||
    normalizedModel.startsWith(normalizedBody + ' ') ||
    normalizedModel.endsWith(' ' + normalizedBody) ||
    normalizedModel.includes(' ' + normalizedBody + ' ')
  );
}

/**
 * Produces a review-only model/body split proposal.
 * It never mutates the candidate or asserts that the proposed label is canonical.
 */
export function proposeBodyModelResolution(
  candidate: OfficialProductCandidate,
): MmvBodyModelResolutionProposal | null {
  const bodyStyle = candidate.bodyStyle?.trim();
  if (!bodyStyle || bodyAlreadyInModel(candidate.model, bodyStyle)) return null;

  return {
    reasonCode: 'POSSIBLE_BODY_SPLIT',
    currentModel: candidate.model,
    bodyStyle,
    proposedModel: (candidate.model + ' ' + bodyStyle).trim(),
    requiresReview: true,
  };
}
