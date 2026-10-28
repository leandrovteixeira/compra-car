/** Sprint 26: operator-facing contract. No persistence or browser permissions here. */
export const REVIEW_STATUSES = ['WAITING', 'APPROVED', 'REJECTED', 'POSTPONED'] as const;
export const REVIEW_ACTIONS = ['APPROVE', 'MERGE', 'REJECT', 'POSTPONE'] as const;
export const REVIEW_CASE_KINDS = [
  'BRAND_NEW',
  'BRAND_AMBIGUOUS',
  'CONNECTOR_NEW',
  'CONNECTOR_UPDATE',
  'MMV_NEW',
  'MMV_AMBIGUOUS',
  'MMV_MATCHED',
  'MODEL_YEAR_NEW',
  'MODEL_YEAR_MATCHED',
  'PRICE_NEW',
  'PRICE_CHANGE',
  'SPEC_NEW',
  'SPEC_AMBIGUOUS',
  'SPEC_MATCHED',
  'WATCHER_SIGNAL',
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];
export type ReviewCaseKind = (typeof REVIEW_CASE_KINDS)[number];
export type ReviewDomain = 'BRAND' | 'SOURCE' | 'MMV' | 'MODEL_YEAR' | 'PRICE' | 'SPEC' | 'NEWS';
export type CanonicalKind = 'BRAND' | 'MMV' | 'SPEC_FIELD' | 'SCALE_OPTION';

/**
 * Business disposition is separate from publication/visibility. APPROVE commits the
 * canonical change where eligible. It never means "accepted; click Apply later".
 */
export type DecisionEffect =
  | 'CREATE_BRAND'
  | 'ACTIVATE_CONNECTOR'
  | 'CREATE_MMV'
  | 'CREATE_MODEL_YEAR'
  | 'WRITE_PRICE_HISTORY'
  | 'CREATE_SPEC'
  | 'LINK_ALIAS'
  | 'CONFIRM_SIGNAL'
  | 'NONE';

export type ReviewCasePolicy = Readonly<{
  domain: ReviewDomain;
  actions: readonly ReviewAction[];
  approveEffect: DecisionEffect;
  mergeTarget: CanonicalKind | null;
  /** A completed canonical form must be supplied before APPROVE can commit. */
  approvalRequiresInput: boolean;
  /** Normally false: useful events are not automatically operator decisions. */
  showInReviewQueue: boolean;
}>;

const shared = ['REJECT', 'POSTPONE'] as const;
const base = (domain: ReviewDomain, approveEffect: DecisionEffect): ReviewCasePolicy => ({
  domain, actions: ['APPROVE', ...shared], approveEffect,
  mergeTarget: null, approvalRequiresInput: false, showInReviewQueue: true,
});
const mergeable = (
  domain: ReviewDomain, approveEffect: DecisionEffect, mergeTarget: CanonicalKind,
  approvalRequiresInput = false,
): ReviewCasePolicy => ({
  domain, actions: ['APPROVE', 'MERGE', ...shared], approveEffect,
  mergeTarget, approvalRequiresInput, showInReviewQueue: true,
});
const info = (domain: ReviewDomain): ReviewCasePolicy => ({
  domain, actions: [], approveEffect: 'NONE', mergeTarget: null,
  approvalRequiresInput: false, showInReviewQueue: false,
});

/** Pure policy registry. Agent-specific outputs are mapped to these case kinds by adapters. */
export const REVIEW_CASE_POLICIES: Readonly<Record<ReviewCaseKind, ReviewCasePolicy>> = {
  BRAND_NEW: base('BRAND', 'CREATE_BRAND'),
  BRAND_AMBIGUOUS: mergeable('BRAND', 'CREATE_BRAND', 'BRAND'),
  CONNECTOR_NEW: base('SOURCE', 'ACTIVATE_CONNECTOR'),
  CONNECTOR_UPDATE: base('SOURCE', 'ACTIVATE_CONNECTOR'),
  MMV_NEW: base('MMV', 'CREATE_MMV'),
  MMV_AMBIGUOUS: mergeable('MMV', 'CREATE_MMV', 'MMV', true),
  MMV_MATCHED: info('MMV'),
  MODEL_YEAR_NEW: base('MODEL_YEAR', 'CREATE_MODEL_YEAR'),
  MODEL_YEAR_MATCHED: info('MODEL_YEAR'),
  PRICE_NEW: base('PRICE', 'WRITE_PRICE_HISTORY'),
  PRICE_CHANGE: base('PRICE', 'WRITE_PRICE_HISTORY'),
  SPEC_NEW: mergeable('SPEC', 'CREATE_SPEC', 'SPEC_FIELD', true),
  SPEC_AMBIGUOUS: mergeable('SPEC', 'CREATE_SPEC', 'SPEC_FIELD', true),
  SPEC_MATCHED: info('SPEC'),
  WATCHER_SIGNAL: base('NEWS', 'CONFIRM_SIGNAL'),
};

/** Common compact queue projection. Evidence and proposal details live in the drawer. */
export type ReviewQueueItem = Readonly<{
  caseId: string;
  caseKind: ReviewCaseKind;
  sourceAgent: string;
  sourceFindingType: string;
  businessKey: string;
  title: string;
  shortDescription: string;
  recommendation: string;
  confidence: number | null;
  evidenceCount: number;
  primaryEvidenceUrl: string | null;
  observedAt: string;
  status: ReviewStatus;
  snapshotFingerprint: string;
  caseVersion: number;
}>;

export type ReviewDecisionCommand = Readonly<{
  caseId: string;
  action: ReviewAction;
  expectedCaseVersion: number;
  expectedSnapshotFingerprint: string;
  idempotencyKey: string;
  /** Authenticated server identity; never trusted from browser input alone. */
  actorId: string;
  note?: string | null;
  canonicalTargetId?: string | null;
  /** Reviewed canonical definition, never unvalidated raw agent JSON. */
  canonicalInput?: unknown;
}>;

export class ReviewContractError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'ReviewContractError'; }
}

export function reviewPolicy(kind: ReviewCaseKind): ReviewCasePolicy {
  const result = REVIEW_CASE_POLICIES[kind];
  if (!result) throw new ReviewContractError('UNKNOWN_REVIEW_CASE_KIND');
  return result;
}

export function assertReviewQueueItem(item: ReviewQueueItem): ReviewQueueItem {
  if (!item || !item.caseId?.trim() || !item.businessKey?.trim() ||
      !item.sourceAgent?.trim() || !item.title?.trim() ||
      !item.shortDescription?.trim() || !item.recommendation?.trim() ||
      !item.snapshotFingerprint?.trim() ||
      !Number.isSafeInteger(item.caseVersion) || item.caseVersion < 0 ||
      !REVIEW_STATUSES.includes(item.status) ||
      (item.confidence !== null &&
        (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1)) ||
      !Number.isSafeInteger(item.evidenceCount) || item.evidenceCount < 0 ||
      !Number.isFinite(Date.parse(item.observedAt)))
    throw new ReviewContractError('INVALID_REVIEW_CASE');
  reviewPolicy(item.caseKind);
  return item;
}

export function validateReviewDecision(
  item: ReviewQueueItem,
  command: ReviewDecisionCommand,
): Readonly<{ action: ReviewAction; effect: DecisionEffect; target: string | null }> {
  assertReviewQueueItem(item);
  const policy = reviewPolicy(item.caseKind);
  if (item.status !== 'WAITING' ||
      !command || !REVIEW_ACTIONS.includes(command.action) ||
      !policy.actions.includes(command.action) ||
      item.caseId !== command.caseId ||
      item.caseVersion !== command.expectedCaseVersion ||
      item.snapshotFingerprint !== command.expectedSnapshotFingerprint)
    throw new ReviewContractError('STALE_OR_INVALID_DECISION');
  if (!command.idempotencyKey?.trim() || !command.actorId?.trim() ||
      (command.note?.length ?? 0) > 4000)
    throw new ReviewContractError('INVALID_DECISION_META');
  if (command.action === 'MERGE') {
    if (!policy.mergeTarget || !command.canonicalTargetId?.trim() ||
        command.canonicalInput !== undefined)
      throw new ReviewContractError('INVALID_MERGE_TARGET');
    return { action: command.action, effect: 'LINK_ALIAS', target: command.canonicalTargetId };
  }
  if (command.canonicalTargetId !== undefined && command.canonicalTargetId !== null)
    throw new ReviewContractError('UNEXPECTED_MERGE_TARGET');
  if (command.action === 'APPROVE') {
    if (policy.approvalRequiresInput && (command.canonicalInput === null ||
        command.canonicalInput === undefined))
      throw new ReviewContractError('CANONICAL_INPUT_REQUIRED');
    return { action: command.action, effect: policy.approveEffect, target: null };
  }
  if (command.canonicalInput !== undefined)
    throw new ReviewContractError('UNEXPECTED_CANONICAL_INPUT');
  return { action: command.action, effect: 'NONE', target: null };
}

/** Status is updated ONLY after the server transaction succeeds. */
export function committedReviewStatus(action: ReviewAction): ReviewStatus {
  if (action === 'REJECT') return 'REJECTED';
  if (action === 'POSTPONE') return 'POSTPONED';
  return 'APPROVED';
}
