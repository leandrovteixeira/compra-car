import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { MmvBodyModelResolutionProposal } from './mmv-discovery-contract';
import type { OfficialProductCandidate } from './new-product-check-types';
import { deduplicateProductEvidence } from './official-product-candidate-deduplication';

/** Aggregate variant observations before mapping review-only findings to persistence. */
export function aggregateBodyModelProposals(
  proposals: readonly MmvBodyModelResolutionProposal[],
): readonly MmvBodyModelResolutionProposal[] {
  const grouped = new Map<string, MmvBodyModelResolutionProposal>();
  for (const proposal of proposals) {
    const identity = JSON.stringify([
      key(proposal.currentModel),
      key(proposal.bodyStyle),
      key(proposal.proposedModel),
    ]);
    const existing = grouped.get(identity);
    grouped.set(identity, {
      ...(existing ?? proposal),
      evidence: deduplicateProductEvidence([...(existing?.evidence ?? []), ...proposal.evidence]),
    });
  }
  return [...grouped.values()];
}

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
    evidence: candidate.evidence,
  };
}
