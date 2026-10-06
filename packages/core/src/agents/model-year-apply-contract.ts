import type { AgentFindingDetail, AgentObject } from '../agent-platform/types';

export type ModelYearApplyEligibility =
  | {
      readonly eligible: true;
      readonly proposal: AgentObject;
      readonly findingFingerprint: string;
      readonly runId: string;
    }
  | {
      readonly eligible: false;
      readonly code:
        | 'RUN_NOT_COMPLETED'
        | 'REVIEW_NOT_ACCEPTED'
        | 'UNSUPPORTED_FINDING'
        | 'MISSING_PROPOSAL'
        | 'INVALID_PROPOSAL'
        | 'STALE_PROPOSAL';
    };

function object(value: unknown): AgentObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as AgentObject)
    : null;
}

export function modelYearApplyEligibility(
  detail: AgentFindingDetail,
  options: { readonly expectedFingerprint?: string | null } = {},
): ModelYearApplyEligibility {
  if (detail.run.status !== 'COMPLETED') return { eligible: false, code: 'RUN_NOT_COMPLETED' };
  if (detail.latestReview?.decision !== 'ACCEPT')
    return { eligible: false, code: 'REVIEW_NOT_ACCEPTED' };
  if (detail.run.agentType !== 'PRODUCT_YEAR' || detail.finding.findingType !== 'NEW_PRODUCT_YEAR')
    return { eligible: false, code: 'UNSUPPORTED_FINDING' };

  const proposal = object(detail.finding.proposal);
  if (!proposal) return { eligible: false, code: 'MISSING_PROPOSAL' };
  if (
    proposal.action !== 'STAGE_PRODUCT_YEAR' ||
    typeof proposal.mmvId !== 'string' ||
    typeof proposal.modelYear !== 'number' ||
    (proposal.productionYear !== null && typeof proposal.productionYear !== 'number')
  )
    return { eligible: false, code: 'INVALID_PROPOSAL' };
  if (options.expectedFingerprint && options.expectedFingerprint !== detail.finding.fingerprint)
    return { eligible: false, code: 'STALE_PROPOSAL' };

  return {
    eligible: true,
    proposal,
    findingFingerprint: detail.finding.fingerprint,
    runId: detail.run.id,
  };
}
