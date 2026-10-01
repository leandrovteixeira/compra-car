import type { AgentFindingDetail, AgentObject } from '../agent-platform/types';
import type { MmvDiscoveryReasonCode } from './mmv-discovery-contract';

export const MMV_DIRECT_APPLY_REASON_CODES = [
  'NEW_MODEL',
  'NEW_COMMERCIAL_VARIANT',
  'SAME_LABEL_DISTINCT_POWERTRAIN',
] as const satisfies readonly MmvDiscoveryReasonCode[];

export const MMV_REVIEW_ONLY_REASON_CODES = [
  'POSSIBLE_RENAME',
  'DESCRIPTOR_ONLY_VARIATION',
  'POSSIBLE_BODY_SPLIT',
  'POSSIBLE_SUCCESSOR',
  'POSSIBLE_DISCONTINUATION',
  'NON_MMV_PACKAGE',
  'AMBIGUOUS_IDENTITY',
] as const satisfies readonly MmvDiscoveryReasonCode[];

export type MmvApplyEligibility =
  | {
      readonly eligible: true;
      readonly reasonCode: (typeof MMV_DIRECT_APPLY_REASON_CODES)[number];
      readonly proposal: AgentObject;
      readonly findingFingerprint: string;
      readonly runId: string;
    }
  | {
      readonly eligible: false;
      readonly code:
        | 'RUN_NOT_COMPLETED'
        | 'REVIEW_NOT_ACCEPTED'
        | 'MISSING_REASON_CODE'
        | 'REVIEW_ONLY_REASON'
        | 'MISSING_PROPOSAL'
        | 'STALE_PROPOSAL'
        | 'UNSUPPORTED_FINDING';
    };

function object(value: unknown): AgentObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as AgentObject)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function mmvApplyEligibility(
  detail: AgentFindingDetail,
  options: { readonly expectedFingerprint?: string | null } = {},
): MmvApplyEligibility {
  if (detail.run.status !== 'COMPLETED') return { eligible: false, code: 'RUN_NOT_COMPLETED' };
  if (detail.latestReview?.decision !== 'ACCEPT')
    return { eligible: false, code: 'REVIEW_NOT_ACCEPTED' };
  if (!['NEW_MODEL', 'NEW_VERSION'].includes(detail.finding.findingType))
    return { eligible: false, code: 'UNSUPPORTED_FINDING' };

  const reasonCode = text(detail.finding.payload.reasonCode) as MmvDiscoveryReasonCode | null;
  if (!reasonCode) return { eligible: false, code: 'MISSING_REASON_CODE' };
  if (
    !MMV_DIRECT_APPLY_REASON_CODES.includes(
      reasonCode as (typeof MMV_DIRECT_APPLY_REASON_CODES)[number],
    )
  )
    return { eligible: false, code: 'REVIEW_ONLY_REASON' };

  const proposal = object(detail.finding.proposal);
  if (!proposal) return { eligible: false, code: 'MISSING_PROPOSAL' };
  if (options.expectedFingerprint && options.expectedFingerprint !== detail.finding.fingerprint)
    return { eligible: false, code: 'STALE_PROPOSAL' };

  return {
    eligible: true,
    reasonCode: reasonCode as (typeof MMV_DIRECT_APPLY_REASON_CODES)[number],
    proposal,
    findingFingerprint: detail.finding.fingerprint,
    runId: detail.run.id,
  };
}

/**
 * Sprint 20E intentionally does not create a products row.
 * The current canonical product record requires PY/MY, which belongs to Sprint 21.
 */
export const MMV_PRODUCT_APPLY_BLOCKED_UNTIL_PRODUCT_YEAR = true as const;


export interface CanonicalMmv {
  readonly id: string;
  readonly market: string;
  readonly identityKey: string;
  readonly brand: string;
  readonly model: string;
  readonly officialVersionLabel: string;
  readonly bodyStyle: string | null;
  readonly powertrainLabel: string | null;
  readonly propulsion: string | null;
  readonly engineDisplacement: number | null;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly visibility: 'PRIVATE' | 'PUBLIC';
  readonly sourceFindingId: string;
  readonly lastConfirmedFindingId: string;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CanonicalMmvFilters {
  readonly market?: string;
  readonly brand?: string;
  readonly status?: CanonicalMmv['status'];
  readonly visibility?: CanonicalMmv['visibility'];
}

export interface CanonicalMmvRepository {
  listCanonicalMmvs(filters?: CanonicalMmvFilters): Promise<readonly CanonicalMmv[]>;
  applyAcceptedProposal(input: {
    readonly findingId: string;
    readonly actor: string;
    readonly proposal: AgentObject;
    readonly expectedFingerprint: string;
  }): Promise<readonly CanonicalMmv[]>;
}

