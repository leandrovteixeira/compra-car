import {
  validateWatcherRegistration,
  validateWatcherPersistInput,
  validateWatcherCandidate,
  validateWatcherCandidateEvidence,
  validateWatcherSource,
  validateWatcherFeedItem,
  createWatcherArticleObservation,
  fingerprintWatcherFeedItem,
  validateWatcherIngestionFailure,
  type WatcherStoredFeedItem,
  type WatcherStoredBatch,
  validateWatcherHint,
  watcherUuid,
  watcherVersion,
  type WatcherRepository,
  type WatcherSource,
  type WatcherSourceSettings,
  type WatcherStoredSource,
  type WatcherPersistentState,
  type WatcherLease,
  type WatcherPersistInput,
  type WatcherBatchReceipt,
  type WatcherStoredArticle,
  type WatcherStoredRevision,
  type WatcherCandidateDraft,
  type WatcherStoredCandidate,
  type WatcherCandidateEvidenceInput,
  type WatcherStoredCandidateEvidence,
  type WatcherStoredHint,
  validateWatcherIntelligenceCommit,
  validateWatcherIntelligenceReview,
  watcherIntelligenceFences,
  watcherIntelligenceScope,
  watcherIntelligenceCommitKey,
  type WatcherIntelligenceRepository,
  type WatcherIntelligenceCommit,
  type WatcherIntelligenceReceipt,
  type WatcherIntelligenceReviewCommand,
  type WatcherIntelligenceReviewReceipt,
  type WatcherIntelligenceQueryKind,
} from '@compra-car/core/agents';
import { assertLegacyServerRuntime } from './client';

export type WatcherPersistenceErrorCode =
  | 'PERSISTENCE_FAILED'
  | 'CONTENT_CONFLICT'
  | 'STALE_LEASE'
  | 'STALE_STATE'
  | 'SOURCE_BUSY'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_REFERENCE'
  | 'HINT_NOT_READY'
  | 'REVIEW_CONFLICT';
export class WatcherPersistenceError extends Error {
  constructor(public readonly code: WatcherPersistenceErrorCode) {
    super('WATCHER_' + code);
  }
}
/** Narrow injected capability: no environment loading, credentials or canonical table access. */
export interface WatcherRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
type Row = Record<string, unknown>;
const row = (v: unknown): Row => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
  return v as Row;
};
const text = (v: unknown): string => {
  if (typeof v !== 'string') throw new Error();
  return v;
};
const instant = (v: unknown): string => {
  const time = Date.parse(text(v));
  if (!Number.isFinite(time)) throw new Error();
  return new Date(time).toISOString();
};
const nullableInstant = (v: unknown) => (v === null ? null : instant(v));
const nullableText = (v: unknown) => (v === null ? null : text(v));
function lease(v: unknown): WatcherLease {
  const r = row(v);
  return {
    sourceId: text(r.source_id),
    token: watcherUuid(r.token),
    owner: text(r.owner),
    expiresAt: instant(r.expires_at),
    configVersion: watcherVersion(Number(r.config_version)),
    stateVersion: watcherVersion(Number(r.state_version), true),
  };
}
function source(v: unknown): WatcherStoredSource {
  const r = row(v),
    valid = validateWatcherRegistration(
      validateWatcherSource(r.definition),
      r.settings as WatcherSourceSettings,
    );
  return {
    ...valid,
    configVersion: watcherVersion(Number(r.config_version)),
    createdAt: instant(r.created_at),
    updatedAt: instant(r.updated_at),
  };
}
function candidate(v: unknown): WatcherStoredCandidate {
  const r = row(v),
    valid = validateWatcherCandidate({
      id: text(r.id),
      brand: text(r.brand),
      modelHint: nullableText(r.model_hint),
      projectCode: nullableText(r.project_code),
      aliases: r.aliases as string[],
      status: r.status as WatcherCandidateDraft['status'],
    });
  if (valid.identityKey !== r.identity_key) throw new Error();
  return {
    ...valid,
    version: watcherVersion(Number(r.version)),
    createdAt: instant(r.created_at),
    updatedAt: instant(r.updated_at),
  };
}
function evidence(v: unknown): WatcherStoredCandidateEvidence {
  const r = row(v),
    valid = validateWatcherCandidateEvidence({
      candidateId: text(r.candidate_id),
      candidateVersion: Number(r.candidate_version),
      revisionId: text(r.revision_id),
      assertion: r.assertion as WatcherCandidateEvidenceInput['assertion'],
      actorId: nullableText(r.actor_id),
      note: text(r.note),
    });
  return {
    ...valid,
    id: watcherUuid(r.id),
    createdAt: instant(r.created_at),
    candidateSnapshot: candidate(r.candidate_snapshot),
  };
}
function revision(v: unknown): WatcherStoredRevision {
  const r = row(v),
    item = validateWatcherFeedItem(r.item_payload);
  if (fingerprintWatcherFeedItem(item) !== r.evidence_fingerprint) throw new Error();
  return {
    id: watcherUuid(r.id),
    articleId: watcherUuid(r.article_id),
    feedItemId: watcherUuid(r.feed_item_id),
    evidenceFingerprint: text(r.evidence_fingerprint),
    item,
    firstObservedAt: instant(r.first_observed_at),
    createdAt: instant(r.created_at),
  };
}
function sourceId(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200)
    throw new WatcherPersistenceError('INVALID_INPUT');
  return value;
}
/** Every mutation is one server transaction; Supabase access remains confined to this adapter. */
export class WatcherSupabaseAdapter implements WatcherRepository, WatcherIntelligenceRepository {
  constructor(private readonly client: WatcherRpcClient) {
    assertLegacyServerRuntime();
  }
  private async call<T>(
    name: string,
    args: Record<string, unknown>,
    decode: (value: unknown) => T,
  ): Promise<T> {
    try {
      const { data, error } = await this.client.rpc(name, args);
      if (error) {
        const e = row(error),
          message = typeof e.message === 'string' ? e.message : '';
        const known = [
          'CONTENT_CONFLICT',
          'STALE_LEASE',
          'STALE_STATE',
          'SOURCE_BUSY',
          'HINT_NOT_READY',
          'NOT_FOUND',
          'REVIEW_CONFLICT',
        ] as const;
        const code = known.find((c) => message === 'WATCHER_' + c);
        throw new WatcherPersistenceError(
          code ??
            (e.code === '23505'
              ? 'CONTENT_CONFLICT'
              : e.code === '23503'
                ? 'INVALID_REFERENCE'
                : e.code === 'P0002'
                  ? 'NOT_FOUND'
                  : e.code === '23514' ||
                      e.code === '23502' ||
                      message.startsWith('WATCHER_INVALID_') ||
                      message === 'WATCHER_CHECKPOINT_BLOCKED' ||
                      message === 'WATCHER_BATCH_CONFLICT'
                    ? 'INVALID_INPUT'
                    : 'PERSISTENCE_FAILED'),
        );
      }
      return decode(data);
    } catch (error) {
      if (error instanceof WatcherPersistenceError) throw error;
      throw new WatcherPersistenceError('PERSISTENCE_FAILED');
    }
  }
  private intelligenceSources(
    value: unknown,
    leases: readonly WatcherLease[],
    replayed: boolean,
  ): WatcherIntelligenceReceipt['sourceVersions'] {
    if (!Array.isArray(value) || value.length !== leases.length) throw new Error();
    const expected = watcherIntelligenceFences(leases);
    return value.map((v, i) => {
      const r = row(v),
        stateVersion = watcherVersion(r.stateVersion);
      if (
        r.sourceId !== expected[i].sourceId ||
        (!replayed && stateVersion !== expected[i].stateVersion + 1)
      )
        throw new Error();
      return { sourceId: text(r.sourceId), stateVersion };
    });
  }
  persistIntelligence(input: WatcherIntelligenceCommit) {
    const valid = validateWatcherIntelligenceCommit(input),
      fences = watcherIntelligenceFences(valid.leases);
    return this.call(
      'watcher_commit_intelligence',
      { p_commit_id: valid.commitId, p_fences: fences, p_payload: valid.payload },
      (value): WatcherIntelligenceReceipt => {
        const r = row(value);
        if (
          typeof r.replayed !== 'boolean' ||
          r.scope !== valid.payload.scope ||
          r.commitKey !== watcherIntelligenceCommitKey(valid) ||
          !Array.isArray(r.unitKeys) ||
          JSON.stringify(r.unitKeys) !== JSON.stringify(valid.payload.units.map((u) => u.key)) ||
          !Array.isArray(r.candidateVersions) ||
          r.candidateVersions.length !== valid.payload.candidates.length
        )
          throw new Error();
        const commitId = watcherUuid(r.commitId);
        if (!r.replayed && commitId !== valid.commitId) throw new Error();
        const candidateVersions = r.candidateVersions.map((v, i) => {
          const c = row(v),
            expected = valid.payload.candidates[i];
          if (
            c.key !== expected.snapshot.key ||
            (!r.replayed &&
              (c.version !== expected.expectedVersion + 1 ||
                c.reviewVersion !== expected.expectedReviewVersion))
          )
            throw new Error();
          return {
            key: text(c.key),
            version: watcherVersion(c.version),
            reviewVersion: watcherVersion(c.reviewVersion, true),
          };
        });
        return {
          commitId,
          commitKey: text(r.commitKey),
          scope: text(r.scope),
          scopeVersion: watcherVersion(r.scopeVersion),
          unitKeys: r.unitKeys.map(text),
          candidateVersions,
          sourceVersions: this.intelligenceSources(r.sourceVersions, valid.leases, r.replayed),
          replayed: r.replayed,
        };
      },
    );
  }
  reviewIntelligence(leases: readonly WatcherLease[], command: WatcherIntelligenceReviewCommand) {
    const fences = watcherIntelligenceFences(leases),
      review = validateWatcherIntelligenceReview(command);
    return this.call(
      'watcher_review_intelligence',
      { p_fences: fences, p_review: review },
      (value): WatcherIntelligenceReviewReceipt => {
        const r = row(value);
        if (
          typeof r.replayed !== 'boolean' ||
          r.reviewId !== review.reviewId ||
          r.scope !== review.scope ||
          r.scopeVersion !== review.scopeVersion ||
          r.eventKey !== review.eventKey ||
          r.candidateVersion !== review.expectedVersion ||
          r.reviewVersion !== review.expectedReviewVersion + 1
        )
          throw new Error();
        return {
          reviewId: watcherUuid(r.reviewId),
          scope: text(r.scope),
          scopeVersion: watcherVersion(r.scopeVersion),
          eventKey: text(r.eventKey),
          candidateVersion: watcherVersion(r.candidateVersion),
          reviewVersion: watcherVersion(r.reviewVersion),
          sourceVersions: this.intelligenceSources(r.sourceVersions, leases, r.replayed),
          replayed: r.replayed,
        };
      },
    );
  }
  queryIntelligence(
    kind: WatcherIntelligenceQueryKind,
    scope: string,
    filter: string | null = null,
    limit = 25,
    offset = 0,
  ) {
    watcherIntelligenceScope(scope);
    if (
      !['RECEIPTS', 'UNITS', 'CANDIDATES', 'REVIEWS'].includes(kind) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000 ||
      (filter !== null && (typeof filter !== 'string' || filter.length > 200))
    )
      throw new WatcherPersistenceError('INVALID_INPUT');
    return this.call(
      'watcher_intelligence_query',
      { p_kind: kind, p_scope: scope, p_filter: filter, p_limit: limit, p_offset: offset },
      (value) => {
        if (!Array.isArray(value) || value.length > limit) throw new Error();
        return value.map(row);
      },
    );
  }
  private query<T>(
    kind: string,
    filter: string | null,
    limit: number,
    offset: number,
    decode: (v: unknown) => T,
  ) {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000
    )
      throw new WatcherPersistenceError('INVALID_INPUT');
    return this.call(
      'watcher_query',
      { p_kind: kind, p_filter: filter, p_limit: limit, p_offset: offset },
      (v) => {
        if (!Array.isArray(v)) throw new Error();
        return v.map(decode);
      },
    );
  }
  registerSource(input: WatcherSource, settings: WatcherSourceSettings, expectedVersion?: number) {
    const valid = validateWatcherRegistration(input, settings);
    return this.call(
      'watcher_register_source',
      {
        p_source: valid.source,
        p_settings: valid.settings,
        p_expected_version: expectedVersion === undefined ? null : watcherVersion(expectedVersion),
      },
      source,
    );
  }
  listSources(limit = 25, offset = 0) {
    return this.query('SOURCES', null, limit, offset, source);
  }
  async getSourceState(sourceId: string): Promise<WatcherPersistentState | null> {
    if (typeof sourceId !== 'string' || !sourceId.trim() || sourceId.length > 200)
      throw new WatcherPersistenceError('INVALID_INPUT');
    const result = await this.query('STATE', sourceId, 1, 0, (v) => {
      const r = row(v),
        stateVersion = watcherVersion(Number(r.state_version), true),
        configVersion = watcherVersion(Number(r.config_version));
      return {
        sourceId: text(r.source_id),
        stateVersion,
        configVersion,
        checkpoint: {
          sourceId: text(r.source_id),
          etag: nullableText(r.etag),
          lastModified: nullableText(r.last_modified),
          lastSuccessfulObservedAt: nullableInstant(r.last_successful_observed_at),
        },
        lease:
          r.lease_token === null
            ? null
            : lease({
                ...r,
                token: r.lease_token,
                owner: r.lease_owner,
                expires_at: r.lease_expires_at,
              }),
        consecutiveFailures: watcherVersion(Number(r.consecutive_failures), true),
        lastFailureCode: nullableText(r.last_failure_code),
        lastAttemptAt: nullableInstant(r.last_attempt_at),
      };
    });
    return result[0] ?? null;
  }
  claimLease(sourceId: string, owner: string, ttlSeconds = 60) {
    if (
      typeof sourceId !== 'string' ||
      !sourceId.trim() ||
      sourceId.length > 200 ||
      typeof owner !== 'string' ||
      !owner.trim() ||
      owner.length > 200 ||
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds < 1 ||
      ttlSeconds > 300
    )
      throw new WatcherPersistenceError('INVALID_INPUT');
    return this.call(
      'watcher_claim_source',
      { p_source_id: sourceId, p_owner: owner, p_ttl_seconds: ttlSeconds },
      (v) => (v === null ? null : lease(v)),
    );
  }
  releaseLease(
    sourceId: string,
    token: string,
    failureCode?: 'PERSISTENCE_FAILED' | 'UNAVAILABLE' | 'TIMEOUT',
  ) {
    if (
      typeof sourceId !== 'string' ||
      !sourceId.trim() ||
      sourceId.length > 200 ||
      (failureCode !== undefined &&
        !['PERSISTENCE_FAILED', 'UNAVAILABLE', 'TIMEOUT'].includes(failureCode))
    )
      throw new WatcherPersistenceError('INVALID_INPUT');
    return this.call(
      'watcher_release_source',
      { p_source_id: sourceId, p_token: watcherUuid(token), p_failure_code: failureCode ?? null },
      (v) => {
        if (typeof v !== 'boolean') throw new Error();
        return v;
      },
    );
  }
  persistBatch(input: WatcherPersistInput) {
    const p = validateWatcherPersistInput(input);
    return this.call(
      'watcher_persist_batch',
      {
        p_batch_id: p.batchId,
        p_token: p.lease.token,
        p_config_version: p.lease.configVersion,
        p_state_version: p.lease.stateVersion,
        p_payload: {
          batch: p.batch,
          checkpoint: p.checkpoint,
          advanceCheckpoint: p.advanceCheckpoint,
          checkpointBlockedReason: p.checkpointBlockedReason,
          diagnostics: p.diagnostics,
        },
      },
      (v): WatcherBatchReceipt => {
        const r = row(v);
        if (
          !['COMMITTED', 'PARTIAL', 'FAILED'].includes(r.status as string) ||
          typeof r.checkpoint_advanced !== 'boolean' ||
          typeof r.replayed !== 'boolean'
        )
          throw new Error();
        return {
          batchId: watcherUuid(r.batch_id),
          sourceId: text(r.source_id),
          status: r.status as WatcherBatchReceipt['status'],
          stateVersion: watcherVersion(Number(r.state_version)),
          checkpointAdvanced: r.checkpoint_advanced,
          replayed: r.replayed,
        };
      },
    );
  }
  listArticles(limit = 25, offset = 0) {
    return this.query('ARTICLES', null, limit, offset, (v): WatcherStoredArticle => {
      const r = row(v);
      return {
        id: watcherUuid(r.id),
        canonicalUrl: text(r.canonical_url),
        firstSeenAt: instant(r.first_seen_at),
        lastSeenAt: instant(r.last_seen_at),
      };
    });
  }
  listRevisions(articleId: string, limit = 25, offset = 0) {
    return this.query('REVISIONS', watcherUuid(articleId), limit, offset, revision);
  }
  listSourceRevisions(id: string, limit = 25, offset = 0) {
    return this.query('SOURCE_REVISIONS', sourceId(id), limit, offset, revision);
  }
  listSourceItems(id: string, limit = 25, offset = 0) {
    return this.query('SOURCE_ITEMS', sourceId(id), limit, offset, (v): WatcherStoredFeedItem => {
      const r = row(v),
        observation = createWatcherArticleObservation(
          validateWatcherFeedItem(r.item_payload),
          instant(r.current_observed_at),
        );
      if (
        observation.itemKey !== r.item_key ||
        observation.evidenceFingerprint !== r.evidence_fingerprint
      )
        throw new Error();
      return {
        id: watcherUuid(r.id),
        sourceId: text(r.source_id),
        itemKey: text(r.item_key),
        articleId: watcherUuid(r.article_id),
        currentRevisionId: watcherUuid(r.current_revision_id),
        currentObservation: observation,
        firstSeenAt: instant(r.first_seen_at),
        lastSeenAt: instant(r.last_seen_at),
      };
    });
  }
  listBatches(id: string, limit = 25, offset = 0) {
    return this.query('BATCHES', sourceId(id), limit, offset, (v): WatcherStoredBatch => {
      const r = row(v);
      if (
        !['COMMITTED', 'PARTIAL', 'FAILED'].includes(r.status as string) ||
        typeof r.checkpoint_advanced !== 'boolean' ||
        !Array.isArray(r.failures) ||
        !Array.isArray(r.diagnostics)
      )
        throw new Error();
      return {
        batchId: watcherUuid(r.id),
        sourceId: text(r.source_id),
        status: r.status as WatcherBatchReceipt['status'],
        stateVersion: watcherVersion(Number(r.state_version)),
        checkpointAdvanced: r.checkpoint_advanced,
        replayed: false,
        sourceSnapshot: source(r.source_snapshot),
        observedAt: instant(r.observed_at),
        committedAt: instant(r.committed_at),
        failures: r.failures.map(validateWatcherIngestionFailure),
        diagnostics: r.diagnostics as WatcherPersistInput['diagnostics'],
      };
    });
  }
  stageCandidate(input: WatcherCandidateDraft, expectedVersion?: number) {
    return this.call(
      'watcher_stage_candidate',
      {
        p_candidate: validateWatcherCandidate(input),
        p_expected_version: expectedVersion === undefined ? null : watcherVersion(expectedVersion),
      },
      candidate,
    );
  }
  listCandidates(limit = 25, offset = 0) {
    return this.query('CANDIDATES', null, limit, offset, candidate);
  }
  attachCandidateEvidence(input: WatcherCandidateEvidenceInput) {
    return this.call(
      'watcher_attach_evidence',
      { p_evidence: validateWatcherCandidateEvidence(input) },
      evidence,
    );
  }
  listCandidateEvidence(candidateId: string, limit = 25, offset = 0) {
    return this.query('EVIDENCE', watcherUuid(candidateId), limit, offset, evidence);
  }
  prepareHint(candidateId: string, evidenceId: string, expectedVersion: number) {
    return this.call(
      'watcher_prepare_hint',
      {
        p_candidate_id: watcherUuid(candidateId),
        p_evidence_id: watcherUuid(evidenceId),
        p_expected_version: watcherVersion(expectedVersion),
      },
      (v): WatcherStoredHint => {
        const r = row(v);
        return {
          id: watcherUuid(r.id),
          candidateId: watcherUuid(r.candidate_id),
          candidateVersion: watcherVersion(Number(r.candidate_version)),
          evidenceId: watcherUuid(r.evidence_id),
          payload: validateWatcherHint(r.payload),
          preparedAt: instant(r.prepared_at),
        };
      },
    );
  }
}
