export const AGENT_TYPES = [
  'BRAND_CONNECTOR',
  'MMV_DISCOVERY',
  'PRODUCT_YEAR',
  'SPEC_INTELLIGENCE',
  'PRICE_INTELLIGENCE',
] as const;
export const AGENT_RUN_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export const AGENT_FINDING_TYPES = [
  'MMV_MATCHED',
  'NEW_MODEL',
  'NEW_VERSION',
  'AMBIGUOUS_MMV',
  'NEW_BRAND_CONNECTOR',
  'CONNECTOR_HEALTHY',
  'CONNECTOR_DRIFT',
  'NEW_PRODUCT_YEAR',
  'UNMATCHED_SPEC',
  'SPEC_CHANGE',
  'NEW_PRICE',
  'PRICE_CHANGE',
] as const;
export const AGENT_REVIEW_DECISIONS = ['ACCEPT', 'REJECT', 'DEFER'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];
export type AgentFindingType = (typeof AGENT_FINDING_TYPES)[number];
export type AgentReviewDecision = (typeof AGENT_REVIEW_DECISIONS)[number];
export type AgentReviewFilter = 'OPEN' | AgentReviewDecision | 'ALL';
export type AgentJson =
  null | boolean | number | string | readonly AgentJson[] | { readonly [key: string]: AgentJson };
export type AgentObject = { readonly [key: string]: AgentJson };
export interface AgentRun {
  readonly id: string;
  readonly agentType: AgentType;
  readonly status: AgentRunStatus;
  readonly market: string | null;
  readonly brand: string | null;
  readonly provider: string | null;
  readonly runMode: string | null;
  readonly schemaVersion: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly input: AgentObject;
  readonly summary: AgentObject;
  readonly configSnapshot: AgentObject;
  readonly error: AgentObject | null;
  readonly sourceCommitSha: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface AgentFinding {
  readonly id: string;
  readonly runId: string;
  readonly findingType: AgentFindingType;
  readonly fingerprint: string;
  readonly subjectKey: string | null;
  readonly title: string;
  readonly summary: string | null;
  readonly confidence: number | null;
  readonly requiresReview: boolean;
  readonly subject: AgentObject;
  readonly proposal: AgentObject | null;
  readonly payload: AgentObject;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface AgentEvidence {
  readonly id: string;
  readonly findingId: string;
  readonly sourceType: string;
  readonly sourceUrl: string;
  readonly sourceDomain: string | null;
  readonly title: string | null;
  readonly excerpt: string | null;
  readonly evidenceFingerprint: string;
  readonly metadata: AgentObject;
  readonly capturedAt: string | null;
  readonly createdAt: string;
}
export interface AgentReview {
  readonly id: string;
  readonly findingId: string;
  readonly decision: AgentReviewDecision;
  readonly note: string | null;
  readonly reviewedBy: string | null;
  readonly createdAt: string;
}
export interface AgentFindingBundle {
  readonly finding: AgentFinding;
  readonly evidence: readonly AgentEvidence[];
}
export interface AgentRunBundle {
  readonly run: AgentRun;
  readonly findings: readonly AgentFindingBundle[];
}
export interface AgentFindingDetail extends AgentFindingBundle {
  readonly run: AgentRun;
  readonly reviews: readonly AgentReview[];
  readonly latestReview: AgentReview | null;
}
export interface AgentFindingListItem {
  readonly finding: AgentFinding;
  readonly run: AgentRun;
  readonly latestReview: AgentReview | null;
}
export interface AgentRunListItem {
  readonly run: AgentRun;
  readonly counts: {
    readonly total: number;
    readonly reviewRequired: number;
    readonly accepted: number;
    readonly rejected: number;
    readonly deferred: number;
  };
}
export interface AgentListOptions {
  readonly offset?: number;
  readonly limit?: number;
  readonly agentType?: AgentType;
}
export interface AgentFindingListOptions extends AgentListOptions {
  readonly runId?: string;
  readonly review?: AgentReviewFilter;
  readonly requiresReview?: boolean;
}
export interface AgentPage<T> {
  readonly items: readonly T[];
  readonly total: number;
}
export interface AgentPlatformRepository {
  createRun(run: AgentRun): Promise<AgentRun>;
  completeRun(id: string, summary: AgentObject, completedAt: string): Promise<AgentRun>;
  failRun(id: string, error: AgentObject): Promise<void>;
  persistFinding(finding: AgentFinding): Promise<AgentFinding>;
  persistEvidence(evidence: AgentEvidence): Promise<AgentEvidence>;
  persistRunBundle(bundle: AgentRunBundle): Promise<void>;
  getRun(id: string): Promise<AgentRunBundle | null>;
  listRuns(options?: AgentListOptions): Promise<AgentPage<AgentRunListItem>>;
  listFindings(options?: AgentFindingListOptions): Promise<AgentPage<AgentFindingListItem>>;
  getFinding(id: string): Promise<AgentFindingDetail | null>;
  addReview(
    input: Pick<AgentReview, 'findingId' | 'decision' | 'note' | 'reviewedBy'>,
  ): Promise<AgentReview>;
  getLatestReview(findingId: string): Promise<AgentReview | null>;
}
