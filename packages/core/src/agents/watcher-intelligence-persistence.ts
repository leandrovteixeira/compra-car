import { canonicalAgentJson } from '../agent-platform/rules';
import type { AgentReviewDecision } from '../agent-platform/types';
import { watcherDigest, watcherText, watcherTimestamp } from './watcher-validation';
import {
  watcherUuid,
  watcherVersion,
  validateWatcherCandidate,
  type WatcherLease,
} from './watcher-persistence';
import {
  WATCHER_INTELLIGENCE_VERSION,
  validateWatcherIntelligenceContext,
  type WatcherIntelligenceContext,
  type WatcherIntelligenceDocument,
  type WatcherRevisionAnalysis,
} from './watcher-intelligence';
import {
  discoverWatcherCandidates,
  type WatcherDiscoveryCandidate,
} from './watcher-candidate-discovery';

const INVALID = 'WATCHER_INVALID_INTELLIGENCE_COMMIT';
export const WATCHER_INTELLIGENCE_PAYLOAD_BYTES = 2_097_152;
export type WatcherIntelligenceGuard = Readonly<{
  key: string;
  version: number;
  reviewVersion: number;
}>;
export type WatcherIntelligencePayload = Readonly<{
  schemaVersion: 'watcher-intelligence-commit/1';
  scope: string;
  engineVersion: string;
  contextFingerprint: string;
  context: WatcherIntelligenceContext;
  currentRevisionIds: readonly string[];
  currentPointers: readonly Readonly<{
    feedItemId: string;
    revisionId: string;
    observedAt: string;
  }>[];
  units: readonly Readonly<{
    key: string;
    document: WatcherIntelligenceDocument;
    analysis: WatcherRevisionAnalysis;
  }>[];
  candidates: readonly Readonly<{
    snapshot: WatcherDiscoveryCandidate;
    rootIdentityKey: string;
    expectedVersion: number;
    expectedReviewVersion: number;
  }>[];
}>;
export type WatcherIntelligenceCommit = Readonly<{
  commitId: string;
  leases: readonly WatcherLease[];
  payload: WatcherIntelligencePayload;
}>;
export type WatcherIntelligenceReceipt = Readonly<{
  commitId: string;
  commitKey: string;
  scope: string;
  scopeVersion: number;
  unitKeys: readonly string[];
  candidateVersions: readonly WatcherIntelligenceGuard[];
  sourceVersions: readonly Readonly<{ sourceId: string; stateVersion: number }>[];
  replayed: boolean;
}>;
export type WatcherIntelligenceReviewCommand = Readonly<{
  reviewId: string;
  scope: string;
  scopeVersion: number;
  eventKey: string;
  expectedVersion: number;
  expectedReviewVersion: number;
  snapshotFingerprint: string;
  decision: AgentReviewDecision;
  actorId: string;
  note: string;
}>;
export type WatcherIntelligenceReviewReceipt = Readonly<{
  reviewId: string;
  scope: string;
  scopeVersion: number;
  eventKey: string;
  candidateVersion: number;
  reviewVersion: number;
  sourceVersions: WatcherIntelligenceReceipt['sourceVersions'];
  replayed: boolean;
}>;
export type WatcherIntelligenceQueryKind = 'RECEIPTS' | 'UNITS' | 'CANDIDATES' | 'REVIEWS';
export interface WatcherIntelligenceRepository {
  persistIntelligence(input: WatcherIntelligenceCommit): Promise<WatcherIntelligenceReceipt>;
  reviewIntelligence(
    leases: readonly WatcherLease[],
    command: WatcherIntelligenceReviewCommand,
  ): Promise<WatcherIntelligenceReviewReceipt>;
  queryIntelligence(
    kind: WatcherIntelligenceQueryKind,
    scope: string,
    filter?: string | null,
    limit?: number,
    offset?: number,
  ): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
export function watcherIntelligenceScope(value: unknown): string {
  const scope = watcherText(value, 200, INVALID);
  if (!/^[a-z0-9][a-z0-9_:/.-]*$/u.test(scope)) throw new Error(INVALID);
  return scope;
}
export function watcherIntelligenceFences(leases: readonly WatcherLease[]) {
  if (!Array.isArray(leases) || !leases.length || leases.length > 100) throw new Error(INVALID);
  const fences = Array.from(leases, (l) => {
    if (!/^[a-z0-9][a-z0-9_-]{0,199}$/u.test(watcherText(l.sourceId, 200, INVALID)))
      throw new Error(INVALID);
    watcherTimestamp(l.expiresAt);
    watcherText(l.owner, 200, INVALID);
    return {
      sourceId: l.sourceId,
      token: watcherUuid(l.token),
      configVersion: watcherVersion(l.configVersion),
      stateVersion: watcherVersion(l.stateVersion, true),
    };
  }).sort((a, b) => (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0));
  if (new Set(fences.map((f) => f.sourceId)).size !== fences.length) throw new Error(INVALID);
  return fences;
}
export function prepareWatcherIntelligenceCommit(input: {
  commitId: string;
  scope: string;
  leases: readonly WatcherLease[];
  context: WatcherIntelligenceContext;
  documents: readonly WatcherIntelligenceDocument[];
  currentRevisionIds: readonly string[];
  currentPointers: WatcherIntelligencePayload['currentPointers'];
  expectedCandidates?: readonly WatcherIntelligenceGuard[];
}): WatcherIntelligenceCommit {
  const scope = watcherIntelligenceScope(input.scope),
    fences = watcherIntelligenceFences(input.leases);
  const { context, fingerprint } = validateWatcherIntelligenceContext(input.context);
  const currentRevisionIds = [...input.currentRevisionIds].map(watcherUuid).sort();
  if (!Array.isArray(input.currentPointers) || input.currentPointers.length > 100)
    throw new Error(INVALID);
  const currentPointers = input.currentPointers
    .map((p) => ({
      feedItemId: watcherUuid(p.feedItemId),
      revisionId: watcherUuid(p.revisionId),
      observedAt: watcherTimestamp(p.observedAt),
    }))
    .sort((a, b) => (a.feedItemId < b.feedItemId ? -1 : a.feedItemId > b.feedItemId ? 1 : 0));
  if (
    new Set(currentPointers.map((p) => p.feedItemId)).size !== currentPointers.length ||
    canonicalAgentJson(currentPointers.map((p) => p.revisionId).sort()) !==
      canonicalAgentJson(currentRevisionIds)
  )
    throw new Error(INVALID);
  const projection = discoverWatcherCandidates({
    context,
    documents: input.documents,
    currentRevisionIds,
  });
  const guards = input.expectedCandidates ?? [];
  for (const pointer of currentPointers) {
    const r = projection.analyses.find((a) => a.revision.id === pointer.revisionId)?.revision;
    if (!r || r.feedItemId !== pointer.feedItemId || r.firstObservedAt > pointer.observedAt)
      throw new Error(INVALID);
  }
  if (
    !Array.isArray(guards) ||
    guards.length > 1000 ||
    new Set(guards.map((g) => g.key)).size !== guards.length
  )
    throw new Error(INVALID);
  for (const guard of guards) {
    watcherVersion(guard.version, true);
    watcherVersion(guard.reviewVersion, true);
    if (!projection.candidates.some((c) => c.key === guard.key)) throw new Error(INVALID);
  }
  const sources = new Set(fences.map((f) => f.sourceId));
  const units = projection.analyses
    .map((analysis) => {
      const r = analysis.revision;
      if (!sources.has(r.item.sourceId)) throw new Error(INVALID);
      const original = input.documents.find((d) => d.revision.id === r.id)!;
      const document = {
        revision: r,
        content: original.content ?? null,
        originGroup:
          original.originGroup == null ? null : watcherText(original.originGroup, 200, INVALID),
      };
      return {
        key: watcherDigest('watcher-intelligence-unit/1', [
          r.articleId,
          r.id,
          WATCHER_INTELLIGENCE_VERSION,
          scope,
          fingerprint,
        ]),
        document,
        analysis,
      };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const candidates = projection.candidates.map((snapshot) => {
    const root = validateWatcherCandidate({
      id: '00000000-0000-4000-8000-000000000001',
      brand: snapshot.identity.brand,
      modelHint: snapshot.identity.model,
      projectCode: null,
      aliases: [],
      status: 'OBSERVED',
    });
    const expected = guards.find((g) => g.key === snapshot.key);
    return {
      snapshot,
      rootIdentityKey: root.identityKey,
      expectedVersion: expected?.version ?? 0,
      expectedReviewVersion: expected?.reviewVersion ?? 0,
    };
  });
  const payload: WatcherIntelligencePayload = {
    schemaVersion: 'watcher-intelligence-commit/1',
    scope,
    engineVersion: WATCHER_INTELLIGENCE_VERSION,
    contextFingerprint: fingerprint,
    context,
    currentRevisionIds,
    currentPointers,
    units,
    candidates,
  };
  if (
    candidates.length > 1000 ||
    Buffer.byteLength(JSON.stringify(payload), 'utf8') > WATCHER_INTELLIGENCE_PAYLOAD_BYTES
  )
    throw new Error(INVALID);
  return {
    commitId: watcherUuid(input.commitId),
    leases: input.leases.map((l) => ({ ...l })),
    payload,
  };
}
export function validateWatcherIntelligenceCommit(
  input: WatcherIntelligenceCommit,
): WatcherIntelligenceCommit {
  const p = input.payload;
  const rebuilt = prepareWatcherIntelligenceCommit({
    commitId: input.commitId,
    scope: p.scope,
    leases: input.leases,
    context: p.context,
    documents: p.units.map((u) => u.document),
    currentRevisionIds: p.currentRevisionIds,
    currentPointers: p.currentPointers,
    expectedCandidates: p.candidates.map((c) => ({
      key: c.snapshot.key,
      version: c.expectedVersion,
      reviewVersion: c.expectedReviewVersion,
    })),
  });
  if (canonicalAgentJson(rebuilt.payload) !== canonicalAgentJson(p)) throw new Error(INVALID);
  return rebuilt;
}

export function watcherIntelligenceCommitKey(input: WatcherIntelligenceCommit): string {
  return watcherDigest('watcher-intelligence-commit/1', [
    input.payload.scope,
    input.payload.engineVersion,
    input.payload.contextFingerprint,
    watcherIntelligenceFences(input.leases)
      .map((f) => f.sourceId)
      .join('\u001f'),
    input.payload.units
      .map((u) => u.key)
      .sort()
      .join('\u001f'),
    input.payload.currentPointers
      .map((p) =>
        watcherDigest('watcher-intelligence-pointer/1', [p.feedItemId, p.revisionId, p.observedAt]),
      )
      .join('\u001f'),
  ]);
}
export function validateWatcherIntelligenceReview(command: WatcherIntelligenceReviewCommand) {
  if (
    !['ACCEPT', 'REJECT', 'DEFER'].includes(command.decision) ||
    !/^watcher-event\/1:sha256:[a-f0-9]{64}$/u.test(command.eventKey) ||
    !/^watcher-candidate-snapshot\/1:sha256:[a-f0-9]{64}$/u.test(command.snapshotFingerprint)
  )
    throw new Error(INVALID);
  return {
    ...command,
    reviewId: watcherUuid(command.reviewId),
    scope: watcherIntelligenceScope(command.scope),
    scopeVersion: watcherVersion(command.scopeVersion),
    expectedVersion: watcherVersion(command.expectedVersion),
    expectedReviewVersion: watcherVersion(command.expectedReviewVersion, true),
    actorId: watcherUuid(command.actorId),
    note: watcherText(command.note, 1000, INVALID),
  };
}
