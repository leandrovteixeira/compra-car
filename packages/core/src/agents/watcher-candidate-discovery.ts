import type { AgentReviewDecision } from '../agent-platform/types';
import type { WatcherCandidateDraft } from './watcher-persistence';
import { watcherDigest, watcherText } from './watcher-validation';
import { watcherKey } from './watcher-foundation';
import {
  analyzeWatcherRevision,
  WATCHER_INTELLIGENCE_LIMITS,
  type WatcherIntelligenceContext,
  type WatcherIntelligenceDocument,
  type WatcherIntelligenceSignal,
  type WatcherRevisionAnalysis,
} from './watcher-intelligence';

export type WatcherDiscoveryStatus =
  'NEW' | 'CORROBORATED' | 'INSUFFICIENT' | 'DISMISSED' | 'REVIEW_REQUIRED';
export type WatcherDiscoveryCandidate = Readonly<{
  key: string;
  fingerprint: string;
  status: WatcherDiscoveryStatus;
  /** Compatibility projection only; never silently write these richer event candidates through 24A RPCs. */
  legacyStatus: WatcherCandidateDraft['status'];
  identity: WatcherIntelligenceSignal['identity'];
  category: WatcherIntelligenceSignal['category'];
  evidence: readonly WatcherIntelligenceSignal[];
  activeSignalIds: readonly string[];
  quality: Readonly<{
    officialOrigins: number;
    independentOrigins: number;
    score: number;
    reasons: readonly string[];
  }>;
  applyAllowed: false;
}>;
export type WatcherDiscoveryReview = Readonly<{
  candidateKey: string;
  expectedFingerprint: string;
  decision: AgentReviewDecision;
  actorId: string;
  note: string;
}>;
export type WatcherDiscoverySnapshot = Readonly<{
  schemaVersion: 'watcher-discovery/1';
  fingerprint: string;
  analyses: readonly WatcherRevisionAnalysis[];
  candidates: readonly WatcherDiscoveryCandidate[];
  reviews: readonly WatcherDiscoveryReview[];
  report: Readonly<{
    articles: number;
    revisions: number;
    relevantArticles: number;
    irrelevantArticles: number;
    signals: number;
    activeSignals: number;
    uniqueCandidates: number;
    ambiguousCandidates: number;
    discardedCandidates: number;
    duplicatesAvoided: number;
    abstentions: number;
    aiCalls: 0;
    aiCostUsd: 0;
  }>;
}>;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const INVALID = 'WATCHER_INVALID_DISCOVERY';
function validateReviews(reviews: readonly WatcherDiscoveryReview[]) {
  if (!Array.isArray(reviews) || reviews.length > 500) throw new Error(INVALID);
  return reviews.map((r) => {
    if (!r || !['ACCEPT', 'REJECT', 'DEFER'].includes(r.decision)) throw new Error(INVALID);
    return {
      candidateKey: watcherText(r.candidateKey, 200, INVALID),
      expectedFingerprint: watcherText(r.expectedFingerprint, 200, INVALID),
      decision: r.decision,
      actorId: watcherText(r.actorId, 200, INVALID),
      note: watcherText(r.note, 1000, INVALID),
    };
  });
}

/** Deterministic full projection of a bounded incremental revision journal. No persistence capability. */
export function discoverWatcherCandidates(input: {
  context: WatcherIntelligenceContext;
  documents: readonly WatcherIntelligenceDocument[];
  reviews?: readonly WatcherDiscoveryReview[];
  /** Authoritative pointers from 24A; required by persistence, including A-B-A reversions. */
  currentRevisionIds?: readonly string[];
}): WatcherDiscoverySnapshot {
  if (
    !input ||
    !Array.isArray(input.documents) ||
    input.documents.length > WATCHER_INTELLIGENCE_LIMITS.documents
  )
    throw new Error(INVALID);
  const revisions = new Map<string, WatcherRevisionAnalysis>();
  const revisionKeys = new Map<string, string>();
  let duplicateInputs = 0;
  for (const document of input.documents) {
    const analysis = analyzeWatcherRevision(document, input.context),
      previous = revisions.get(analysis.revision.id);
    const naturalKey = analysis.revision.feedItemId + '|' + analysis.revision.evidenceFingerprint;
    const existingId = revisionKeys.get(naturalKey);
    if (existingId && existingId !== analysis.revision.id)
      throw new Error('WATCHER_REVISION_ID_CONFLICT');
    revisionKeys.set(naturalKey, analysis.revision.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(analysis))
        throw new Error('WATCHER_REVISION_CONTENT_CONFLICT');
      duplicateInputs++;
    }
    revisions.set(analysis.revision.id, analysis);
  }
  const analyses = [...revisions.values()].sort((a, b) => compare(a.revision.id, b.revision.id));
  // Never collapse two feed origins of one canonical article. Each origin has its own revision journal.
  const latest = new Map<string, WatcherRevisionAnalysis>();
  const pointers =
    input.currentRevisionIds === undefined ? null : new Set(input.currentRevisionIds);
  if (
    pointers &&
    (!Array.isArray(input.currentRevisionIds) ||
      pointers.size !== input.currentRevisionIds!.length ||
      [...pointers].some((id) => !revisions.has(id)))
  )
    throw new Error('WATCHER_INVALID_CURRENT_REVISIONS');
  for (const a of analyses) {
    const key = a.revision.feedItemId,
      prior = latest.get(key);
    if (pointers && !pointers.has(a.revision.id)) continue;
    if (pointers && prior) throw new Error('WATCHER_INVALID_CURRENT_REVISIONS');
    if (
      prior &&
      (prior.revision.articleId !== a.revision.articleId ||
        prior.revision.item.sourceId !== a.revision.item.sourceId)
    )
      throw new Error('WATCHER_REVISION_ORIGIN_CONFLICT');
    if (
      prior &&
      prior.revision.firstObservedAt === a.revision.firstObservedAt &&
      prior.revision.id !== a.revision.id
    )
      throw new Error('WATCHER_REVISION_ORDER_AMBIGUOUS');
    if (
      !prior ||
      compare(
        a.revision.firstObservedAt + '|' + a.revision.id,
        prior.revision.firstObservedAt + '|' + prior.revision.id,
      ) > 0
    )
      latest.set(key, a);
  }
  if (pointers && latest.size !== new Set(analyses.map((a) => a.revision.feedItemId)).size)
    throw new Error('WATCHER_INVALID_CURRENT_REVISIONS');
  const activeIds = new Set(
    [...latest.values()].flatMap((a) => a.signals.map((s) => s.fingerprint)),
  );
  const reviews = validateReviews(input.reviews ?? []);
  const groups = new Map<string, WatcherIntelligenceSignal[]>();
  for (const a of analyses)
    for (const signal of a.signals) {
      // Unresolved mentions remain auditable signals, not invented candidate identities.
      if (!signal.identity.model || signal.identity.resolution === 'UNRESOLVED') continue;
      groups.set(signal.eventKey, [...(groups.get(signal.eventKey) ?? []), signal]);
    }
  const candidates = [...groups.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([key, signals]): WatcherDiscoveryCandidate => {
      const evidence = signals.sort((a, b) => compare(a.fingerprint, b.fingerprint));
      const active = evidence.filter(
        (s) => activeIds.has(s.fingerprint) && s.decision === 'REVIEW',
      );
      // Same literal information joins origin groups even if syndicated under different publisher IDs.
      const parent = new Map<string, string>();
      const root = (v: string): string => {
        let p = parent.get(v);
        if (!p) {
          parent.set(v, v);
          return v;
        }
        while (p !== parent.get(p)) p = parent.get(p)!;
        return p;
      };
      const copies = new Map<string, string>();
      for (const s of active) {
        const origin = s.evidence.official
          ? 'official:' + s.identity.brandId
          : (s.evidence.originGroup ?? 'UNVERIFIED');
        const copy = watcherKey(s.evidence.quote),
          other = copies.get(copy);
        if (other) {
          const roots = [root(origin), root(other)].sort(compare);
          parent.set(roots[1], roots[0]);
        } else {
          root(origin);
          copies.set(copy, origin);
        }
      }
      const origins = new Set(
        active.map((s) =>
          root(
            s.evidence.official
              ? 'official:' + s.identity.brandId
              : (s.evidence.originGroup ?? 'UNVERIFIED'),
          ),
        ),
      );
      const officialOrigins = new Set(
        active.filter((s) => s.evidence.official).map((s) => s.identity.brandId),
      ).size;
      // Unverified editorial origins never provide independent corroboration.
      const independentOrigins = [...origins].filter((o) => o !== 'UNVERIFIED').length;
      const score =
        active.length === 0 ? 0 : officialOrigins ? 80 : independentOrigins >= 2 ? 60 : 20;
      const qualityReasons =
        active.length === 0
          ? ['NO_CURRENT_SUPPORTED_SIGNAL']
          : officialOrigins
            ? ['OFFICIAL_LITERAL_EVIDENCE_REVIEW_REQUIRED']
            : independentOrigins >= 2
              ? ['REVIEWED_INDEPENDENT_ORIGINS']
              : ['SECONDARY_OR_UNVERIFIED_REVIEW_REQUIRED'];
      const fingerprint = watcherDigest('watcher-candidate-snapshot/1', [
        key,
        evidence.map((s) => s.fingerprint),
        active.map((s) => s.fingerprint),
        score,
        qualityReasons,
      ]);
      const reviewed = reviews
        .filter((r) => r.candidateKey === key && r.expectedFingerprint === fingerprint)
        .at(-1);
      let status: WatcherDiscoveryStatus = active.length
        ? officialOrigins || independentOrigins >= 2
          ? 'CORROBORATED'
          : 'NEW'
        : 'INSUFFICIENT';
      if (reviewed)
        status =
          reviewed.decision === 'REJECT'
            ? 'DISMISSED'
            : reviewed.decision === 'DEFER'
              ? 'INSUFFICIENT'
              : 'REVIEW_REQUIRED';
      return {
        key,
        fingerprint,
        status,
        legacyStatus: status === 'DISMISSED' ? 'DISMISSED' : 'OBSERVED',
        identity: evidence[0].identity,
        category: evidence[0].category,
        evidence,
        activeSignalIds: active.map((s) => s.fingerprint),
        quality: { officialOrigins, independentOrigins, score, reasons: qualityReasons },
        applyAllowed: false,
      };
    });
  const relevant = new Set(
    [...latest.values()].filter((a) => a.relevant).map((a) => a.revision.articleId),
  );
  const articles = new Set(analyses.map((a) => a.revision.articleId));
  const signals = analyses.flatMap((a) => a.signals);
  const report = {
    articles: articles.size,
    revisions: analyses.length,
    relevantArticles: relevant.size,
    irrelevantArticles: articles.size - relevant.size,
    signals: signals.length,
    activeSignals: signals.filter((s) => activeIds.has(s.fingerprint)).length,
    uniqueCandidates: candidates.length,
    ambiguousCandidates: candidates.filter((c) => c.status === 'INSUFFICIENT').length,
    discardedCandidates: candidates.filter((c) => c.status === 'DISMISSED').length,
    duplicatesAvoided:
      duplicateInputs +
      signals.filter((s) => s.identity.model && s.identity.resolution !== 'UNRESOLVED').length -
      candidates.length,
    abstentions: analyses.reduce(
      (n, a) => n + a.abstentions.length + a.signals.filter((s) => s.decision === 'ABSTAIN').length,
      0,
    ),
    aiCalls: 0 as const,
    aiCostUsd: 0 as const,
  };
  const fingerprint = watcherDigest('watcher-discovery-snapshot/1', [
    analyses.map((a) => [a.revision.id, a.documentFingerprint, a.contextFingerprint]),
    candidates,
    reviews,
  ]);
  return {
    schemaVersion: 'watcher-discovery/1',
    fingerprint,
    analyses,
    candidates,
    reviews,
    report,
  };
}

/** Pure optimistic review command. ACCEPT only routes to review; there is no apply/publication transition. */
export function reviewWatcherDiscovery(
  snapshot: WatcherDiscoverySnapshot,
  expectedSnapshot: string,
  command: WatcherDiscoveryReview,
): readonly WatcherDiscoveryReview[] {
  if (snapshot.fingerprint !== expectedSnapshot)
    throw new Error('WATCHER_STALE_DISCOVERY_SNAPSHOT');
  const [review] = validateReviews([command]);
  const candidate = snapshot.candidates.find((c) => c.key === review.candidateKey);
  if (!candidate || candidate.fingerprint !== review.expectedFingerprint)
    throw new Error('WATCHER_STALE_CANDIDATE');
  if (snapshot.reviews.some((r) => JSON.stringify(r) === JSON.stringify(review)))
    return snapshot.reviews;
  return [...snapshot.reviews, review];
}

/** Append-only local journal. Reuses CPU-only projection; no durable cursor/receipt claimed. */
export function appendWatcherIntelligenceJournal(input: {
  context: WatcherIntelligenceContext;
  journal: readonly WatcherIntelligenceDocument[];
  updates: readonly WatcherIntelligenceDocument[];
  reviews?: readonly WatcherDiscoveryReview[];
}) {
  for (const values of [input.journal, input.updates])
    if (!Array.isArray(values) || values.length > WATCHER_INTELLIGENCE_LIMITS.documents)
      throw new Error(INVALID);
  const documents = new Map<string, WatcherIntelligenceDocument>();
  const fingerprints = new Map<string, string>();
  let replayedRevisions = 0;
  for (const document of [...input.journal, ...input.updates]) {
    const analyzed = analyzeWatcherRevision(document, input.context);
    const prior = fingerprints.get(analyzed.revision.id);
    if (prior && prior !== analyzed.documentFingerprint)
      throw new Error('WATCHER_REVISION_CONTENT_CONFLICT');
    if (prior) replayedRevisions++;
    fingerprints.set(analyzed.revision.id, analyzed.documentFingerprint);
    documents.set(analyzed.revision.id, {
      revision: analyzed.revision,
      content: document.content ?? null,
      originGroup:
        document.originGroup == null ? null : watcherText(document.originGroup, 200, INVALID),
    });
  }
  const journal = [...documents.values()].sort((a, b) => compare(a.revision.id, b.revision.id));
  const projection = discoverWatcherCandidates({
    context: input.context,
    documents: journal,
    reviews: input.reviews,
  });
  return { journal, projection, replayedRevisions };
}
