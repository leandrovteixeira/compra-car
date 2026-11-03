import {
  canonicalArticleUrl,
  validateWatcherHint,
  watcherKey,
  type WatcherBrandHint,
} from './watcher-foundation';
import {
  validateWatcherIngestionBatch,
  validateWatcherSource,
  validateWatcherSourceCheckpoint,
  type WatcherIngestionBatch,
  type WatcherSource,
  type WatcherSourceCheckpoint,
  type WatcherFeedItem,
  type WatcherArticleObservation,
  type WatcherIngestionFailure,
} from './watcher-ingestion-contract';
import { watcherDigest, watcherRecord, watcherText, watcherTimestamp } from './watcher-validation';

export type WatcherSourceSettings = Readonly<{
  requestUrl: string;
  allowedHosts: readonly string[];
  allowedArticleHosts: readonly string[];
  allowRelativeUrls: boolean;
  pollIntervalSeconds: number;
}>;
export type WatcherStoredSource = Readonly<{
  source: WatcherSource;
  settings: WatcherSourceSettings;
  configVersion: number;
  createdAt: string;
  updatedAt: string;
}>;
export type WatcherLease = Readonly<{
  sourceId: string;
  token: string;
  owner: string;
  expiresAt: string;
  configVersion: number;
  stateVersion: number;
}>;
export type WatcherPersistentState = Readonly<{
  sourceId: string;
  configVersion: number;
  stateVersion: number;
  checkpoint: WatcherSourceCheckpoint;
  lease: WatcherLease | null;
  consecutiveFailures: number;
  lastFailureCode: string | null;
  lastAttemptAt: string | null;
}>;
export type WatcherPersistInput = Readonly<{
  batchId: string;
  lease: WatcherLease;
  batch: WatcherIngestionBatch;
  checkpoint: WatcherSourceCheckpoint;
  advanceCheckpoint: boolean;
  checkpointBlockedReason: 'CONFLICT' | 'LIMIT_EXCEEDED' | null;
  diagnostics: readonly {
    code:
      'MISSING_DATE' | 'INVALID_DATE' | 'INVALID_ITEM' | 'EXCERPT_TRUNCATED' | 'ITEMS_TRUNCATED';
    itemIndex: number | null;
  }[];
}>;
export type WatcherBatchReceipt = Readonly<{
  batchId: string;
  sourceId: string;
  status: 'COMMITTED' | 'PARTIAL' | 'FAILED';
  stateVersion: number;
  checkpointAdvanced: boolean;
  replayed: boolean;
}>;
export type WatcherStoredArticle = Readonly<{
  id: string;
  canonicalUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
}>;
export type WatcherStoredRevision = Readonly<{
  id: string;
  articleId: string;
  feedItemId: string;
  evidenceFingerprint: string;
  item: WatcherFeedItem;
  firstObservedAt: string;
  createdAt: string;
}>;
export type WatcherStoredFeedItem = Readonly<{
  id: string;
  sourceId: string;
  itemKey: string;
  articleId: string;
  currentRevisionId: string;
  currentObservation: WatcherArticleObservation;
  firstSeenAt: string;
  lastSeenAt: string;
}>;
export type WatcherStoredBatch = WatcherBatchReceipt &
  Readonly<{
    sourceSnapshot: WatcherStoredSource;
    observedAt: string;
    committedAt: string;
    failures: readonly WatcherIngestionFailure[];
    diagnostics: WatcherPersistInput['diagnostics'];
  }>;
export type WatcherCandidateDraft = Readonly<{
  id: string;
  brand: string;
  modelHint: string | null;
  projectCode: string | null;
  aliases: readonly string[];
  status: 'OBSERVED' | 'EXPECTED_BR' | 'DISMISSED';
}>;
export type WatcherStoredCandidate = WatcherCandidateDraft &
  Readonly<{ identityKey: string; version: number; createdAt: string; updatedAt: string }>;
export type WatcherCandidateEvidenceInput = Readonly<{
  candidateId: string;
  candidateVersion: number;
  revisionId: string;
  assertion: 'MENTION' | 'BR_EXPECTED' | 'BR_CONFIRMED';
  actorId: string | null;
  note: string;
}>;
export type WatcherStoredCandidateEvidence = WatcherCandidateEvidenceInput &
  Readonly<{ id: string; createdAt: string; candidateSnapshot: WatcherStoredCandidate }>;
export type WatcherStoredHint = Readonly<{
  id: string;
  candidateId: string;
  candidateVersion: number;
  evidenceId: string;
  payload: WatcherBrandHint;
  preparedAt: string;
}>;
export interface WatcherRepository {
  registerSource(
    source: WatcherSource,
    settings: WatcherSourceSettings,
    expectedVersion?: number,
  ): Promise<WatcherStoredSource>;
  listSources(limit?: number, offset?: number): Promise<readonly WatcherStoredSource[]>;
  getSourceState(sourceId: string): Promise<WatcherPersistentState | null>;
  claimLease(sourceId: string, owner: string, ttlSeconds?: number): Promise<WatcherLease | null>;
  releaseLease(
    sourceId: string,
    token: string,
    failureCode?: 'PERSISTENCE_FAILED' | 'UNAVAILABLE' | 'TIMEOUT',
  ): Promise<boolean>;
  persistBatch(input: WatcherPersistInput): Promise<WatcherBatchReceipt>;
  listArticles(limit?: number, offset?: number): Promise<readonly WatcherStoredArticle[]>;
  listRevisions(
    articleId: string,
    limit?: number,
    offset?: number,
  ): Promise<readonly WatcherStoredRevision[]>;
  listSourceItems(
    sourceId: string,
    limit?: number,
    offset?: number,
  ): Promise<readonly WatcherStoredFeedItem[]>;
  listSourceRevisions(
    sourceId: string,
    limit?: number,
    offset?: number,
  ): Promise<readonly WatcherStoredRevision[]>;
  listBatches(
    sourceId: string,
    limit?: number,
    offset?: number,
  ): Promise<readonly WatcherStoredBatch[]>;
  stageCandidate(
    input: WatcherCandidateDraft,
    expectedVersion?: number,
  ): Promise<WatcherStoredCandidate>;
  listCandidates(limit?: number, offset?: number): Promise<readonly WatcherStoredCandidate[]>;
  attachCandidateEvidence(
    input: WatcherCandidateEvidenceInput,
  ): Promise<WatcherStoredCandidateEvidence>;
  listCandidateEvidence(
    candidateId: string,
    limit?: number,
    offset?: number,
  ): Promise<readonly WatcherStoredCandidateEvidence[]>;
  prepareHint(
    candidateId: string,
    evidenceId: string,
    expectedVersion: number,
  ): Promise<WatcherStoredHint>;
}
const INVALID = 'WATCHER_INVALID_PERSISTENCE_INPUT';
export function watcherUuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  )
    throw new Error(INVALID);
  return value.toLowerCase();
}
export function watcherVersion(value: unknown, zero = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (zero ? 0 : 1))
    throw new Error(INVALID);
  return value;
}
export function validateWatcherRegistration(
  source: WatcherSource,
  settings: WatcherSourceSettings,
) {
  const valid = validateWatcherSource(source),
    s = watcherRecord(settings, INVALID);
  if (
    typeof s.requestUrl !== 'string' ||
    !s.requestUrl.startsWith('https://') ||
    canonicalArticleUrl(s.requestUrl) !== valid.feedUrl ||
    typeof s.allowRelativeUrls !== 'boolean' ||
    typeof s.pollIntervalSeconds !== 'number' ||
    !Number.isInteger(s.pollIntervalSeconds) ||
    s.pollIntervalSeconds < 60 ||
    s.pollIntervalSeconds > 86400
  )
    throw new Error(INVALID);
  const hosts = (value: unknown): string[] => {
    if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error(INVALID);
    return [
      ...new Set(
        Array.from(value, (host) => {
          if (
            typeof host !== 'string' ||
            host.length > 253 ||
            host !== new URL(canonicalArticleUrl('https://' + host + '/')).hostname
          )
            throw new Error(INVALID);
          return host;
        }),
      ),
    ].sort();
  };
  const allowedHosts = hosts(s.allowedHosts),
    allowedArticleHosts = hosts(s.allowedArticleHosts);
  if (!allowedHosts.includes(new URL(s.requestUrl).hostname)) throw new Error(INVALID);
  const requestUrl = new URL(s.requestUrl);
  requestUrl.hostname = new URL(valid.feedUrl).hostname;
  requestUrl.hash = '';
  return {
    source: valid,
    settings: {
      requestUrl: requestUrl.toString(),
      allowedHosts,
      allowedArticleHosts,
      allowRelativeUrls: s.allowRelativeUrls,
      pollIntervalSeconds: s.pollIntervalSeconds,
    },
  };
}
export function validateWatcherPersistInput(input: WatcherPersistInput): WatcherPersistInput {
  const batch = validateWatcherIngestionBatch(input.batch),
    checkpoint = validateWatcherSourceCheckpoint(input.checkpoint);
  const lease: WatcherLease = {
    expiresAt: watcherTimestamp(input.lease.expiresAt),
    sourceId: watcherText(input.lease.sourceId, 200, INVALID),
    token: watcherUuid(input.lease.token),
    owner: watcherText(input.lease.owner, 200, INVALID),
    configVersion: watcherVersion(input.lease.configVersion),
    stateVersion: watcherVersion(input.lease.stateVersion, true),
  };
  if (
    lease.sourceId !== batch.sourceId ||
    checkpoint.sourceId !== batch.sourceId ||
    typeof input.advanceCheckpoint !== 'boolean' ||
    ![null, 'CONFLICT', 'LIMIT_EXCEEDED'].includes(input.checkpointBlockedReason) ||
    !Array.isArray(input.diagnostics) ||
    input.diagnostics.length > 301
  )
    throw new Error(INVALID);
  const diagnostics = Array.from(input.diagnostics, (d) => {
    if (
      !d ||
      ![
        'MISSING_DATE',
        'INVALID_DATE',
        'INVALID_ITEM',
        'EXCERPT_TRUNCATED',
        'ITEMS_TRUNCATED',
      ].includes(d.code) ||
      (d.itemIndex !== null &&
        (!Number.isInteger(d.itemIndex) || d.itemIndex < 0 || d.itemIndex > 99))
    )
      throw new Error(INVALID);
    return { code: d.code, itemIndex: d.itemIndex };
  });
  if (
    input.advanceCheckpoint &&
    (batch.failures.length ||
      input.checkpointBlockedReason !== null ||
      diagnostics.some((d) => d.code !== 'MISSING_DATE') ||
      checkpoint.lastSuccessfulObservedAt !== batch.observedAt)
  )
    throw new Error(INVALID);
  if (!input.advanceCheckpoint && !batch.failures.length && input.checkpointBlockedReason === null)
    throw new Error(INVALID);
  if (batch.observations.some((o) => !o.item.url.startsWith('https://'))) throw new Error(INVALID);
  return {
    batchId: watcherUuid(input.batchId),
    lease,
    batch,
    checkpoint,
    diagnostics,
    advanceCheckpoint: input.advanceCheckpoint,
    checkpointBlockedReason: input.checkpointBlockedReason,
  };
}
export function validateWatcherCandidate(input: WatcherCandidateDraft) {
  const hint = validateWatcherHint({
    ...input,
    watcherCandidateId: watcherUuid(input.id),
    schemaVersion: 'watcher-brand-hint/1',
    market: 'BR',
    evidenceFingerprint: 'watcher-evidence/1:sha256:' + '0'.repeat(64),
  });
  if (!['OBSERVED', 'EXPECTED_BR', 'DISMISSED'].includes(input.status)) throw new Error(INVALID);
  return {
    id: hint.watcherCandidateId,
    brand: hint.brand,
    modelHint: hint.modelHint,
    projectCode: hint.projectCode,
    aliases: hint.aliases,
    status: input.status,
    identityKey: watcherDigest('watcher-candidate/1', [
      'BR',
      watcherKey(hint.brand),
      hint.modelHint ? watcherKey(hint.modelHint) : null,
      hint.projectCode ? watcherKey(hint.projectCode) : null,
    ]),
  };
}
export function validateWatcherCandidateEvidence(
  input: WatcherCandidateEvidenceInput,
): WatcherCandidateEvidenceInput {
  if (
    !['MENTION', 'BR_EXPECTED', 'BR_CONFIRMED'].includes(input.assertion) ||
    (input.assertion === 'BR_CONFIRMED' && !input.actorId)
  )
    throw new Error(INVALID);
  return {
    candidateId: watcherUuid(input.candidateId),
    candidateVersion: watcherVersion(input.candidateVersion),
    revisionId: watcherUuid(input.revisionId),
    assertion: input.assertion,
    actorId: input.actorId === null ? null : watcherUuid(input.actorId),
    note: watcherText(input.note, 1000, INVALID),
  };
}
