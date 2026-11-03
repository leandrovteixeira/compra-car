import {
  compareWatcherArticles,
  isNewsEligible,
  preferredWatcherArticle,
  validateWatcherArticle,
  watcherKey,
  type WatcherArticle,
  type WatcherBrazilApplicability,
  type WatcherCategory,
} from './watcher-foundation';
import {
  validateWatcherArticleObservation,
  validateWatcherIngestionBatch,
  validateWatcherSource,
  validateWatcherSourceCheckpoint,
  type WatcherArticleObservation,
  type WatcherIngestionBatch,
  type WatcherSource,
  type WatcherSourceCheckpoint,
} from './watcher-ingestion-contract';

export type WatcherArticleClassification = Readonly<{
  category: WatcherCategory;
  brazilApplicability?: WatcherBrazilApplicability;
  brand?: string;
  model?: string;
  isSponsored?: boolean;
}>;
export type WatcherRelatedArticles = Readonly<{
  leftItemKey: string;
  rightItemKey: string;
  representativeItemKey: string;
  reason: 'SAME_URL' | 'SAME_TEXT';
}>;
export type WatcherIncrementalResult = Readonly<{
  newItems: readonly WatcherArticleObservation[];
  updatedItems: readonly WatcherArticleObservation[];
  unchangedItems: readonly WatcherArticleObservation[];
  filteredItemKeys: readonly string[];
  related: readonly WatcherRelatedArticles[];
  history: readonly WatcherArticleObservation[];
  current: readonly WatcherArticleObservation[];
  conflictingItemKeys: readonly string[];
  relationsTruncated: boolean;
  checkpoint: WatcherSourceCheckpoint | null;
  checkpointAdvanced: boolean;
}>;

/** Pure in-memory projection. History retains evidence revisions and all source origins; nothing is suppressed/deleted.
 * A failure freezes the checkpoint, but valid evidence can still be staged for the next retry.
 */
export function processWatcherIngestion(input: {
  source: WatcherSource;
  batch: WatcherIngestionBatch;
  history: readonly WatcherArticleObservation[];
  current: readonly WatcherArticleObservation[];
  checkpoint: WatcherSourceCheckpoint | null;
  proposedCheckpoint: WatcherSourceCheckpoint;
  classifications?: Readonly<Record<string, WatcherArticleClassification>>;
  /** Source metadata for historical observations enables cross-source grouping without guessing editorial scope. */
  sources?: readonly WatcherSource[];
}): WatcherIncrementalResult {
  const source = validateWatcherSource(input.source),
    batch = validateWatcherIngestionBatch(input.batch);
  const checkpoint = input.checkpoint ? validateWatcherSourceCheckpoint(input.checkpoint) : null;
  const proposed = validateWatcherSourceCheckpoint(input.proposedCheckpoint);
  if (
    !source.enabled ||
    batch.sourceId !== source.id ||
    proposed.sourceId !== source.id ||
    (checkpoint && checkpoint.sourceId !== source.id) ||
    proposed.lastSuccessfulObservedAt !== batch.observedAt ||
    (checkpoint?.lastSuccessfulObservedAt && checkpoint.lastSuccessfulObservedAt > batch.observedAt)
  )
    throw new Error('WATCHER_INVALID_INCREMENTAL_SCOPE');
  const sources = new Map(
    (input.sources ?? []).map((s) => {
      const valid = validateWatcherSource(s);
      return [valid.id, valid] as const;
    }),
  );
  sources.set(source.id, source);
  if (input.history.length > 5000 || input.current.length > 5000)
    throw new Error('WATCHER_HISTORY_LIMIT');
  const prior = input.history.map(validateWatcherArticleObservation);
  if (prior.some((o) => o.observedAt > batch.observedAt))
    throw new Error('WATCHER_HISTORY_FROM_FUTURE');
  const history = new Map<string, WatcherArticleObservation>(),
    identities = new Set<string>(),
    seen = new Set<string>();
  const key = (o: WatcherArticleObservation) => o.itemKey + ':' + o.evidenceFingerprint;
  const retain = (o: WatcherArticleObservation) => {
    const previous = history.get(key(o));
    if (!previous || o.observedAt < previous.observedAt) history.set(key(o), o);
  };
  for (const observation of prior) {
    retain(observation);
    identities.add(observation.itemKey);
    seen.add(key(observation));
  }
  const latest = new Map<string, WatcherArticleObservation>();
  for (const raw of input.current) {
    const o = validateWatcherArticleObservation(raw);
    if (o.observedAt > batch.observedAt || !seen.has(key(o)) || latest.has(o.itemKey))
      throw new Error('WATCHER_INVALID_CURRENT_STATE');
    latest.set(o.itemKey, o);
  }
  if (identities.size !== latest.size) throw new Error('WATCHER_INVALID_CURRENT_STATE');
  const newItems: WatcherArticleObservation[] = [],
    updatedItems: WatcherArticleObservation[] = [],
    unchangedItems: WatcherArticleObservation[] = [];
  const conflicting = new Set<string>(),
    incoming = new Map<string, string>();
  for (const observation of batch.observations) {
    const previous = latest.get(observation.itemKey);
    const first = incoming.get(observation.itemKey);
    if (first && first !== observation.evidenceFingerprint) conflicting.add(observation.itemKey);
    incoming.set(observation.itemKey, observation.evidenceFingerprint);
    if (previous?.evidenceFingerprint === observation.evidenceFingerprint)
      unchangedItems.push(observation);
    else if (identities.has(observation.itemKey)) updatedItems.push(observation);
    else newItems.push(observation);
    retain(observation);
    seen.add(key(observation));
    identities.add(observation.itemKey);
    if (
      !previous ||
      (previous.evidenceFingerprint !== observation.evidenceFingerprint &&
        (!first || observation.evidenceFingerprint < previous.evidenceFingerprint))
    )
      latest.set(observation.itemKey, observation);
  }
  if (history.size > 5000) throw new Error('WATCHER_HISTORY_LIMIT');
  const sortedHistory = [...history.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, o]) => o);
  const current = [...latest.values()].sort((a, b) =>
    a.itemKey < b.itemKey ? -1 : a.itemKey > b.itemKey ? 1 : 0,
  );
  const articles: Array<{ observation: WatcherArticleObservation; article: WatcherArticle }> = [];
  const filtered = new Set<string>();
  for (const o of current) {
    const metadata = sources.get(o.item.sourceId);
    if (!metadata) continue; // Cannot assume a historical source's scope or authority.
    const classification = input.classifications?.[o.itemKey] ?? {
      category: 'MARKET' as const,
      brazilApplicability: 'UNKNOWN' as const,
    };
    if (classification.isSponsored || classification.category === 'IRRELEVANT') {
      filtered.add(o.itemKey);
      continue;
    }
    if (!o.item.publishedAt) continue; // Preserve undated evidence without substituting observedAt.
    const article = validateWatcherArticle({
      ...classification,
      id: o.itemKey,
      url: o.item.url,
      title: o.item.title,
      ...(o.item.excerpt ? { excerpt: o.item.excerpt } : {}),
      publishedAt: o.item.publishedAt,
      sourceId: metadata.id,
      sourceRank: metadata.sourceRank,
      market: metadata.editorialMarket,
    });
    if (isNewsEligible(article)) articles.push({ observation: o, article });
  }
  // Index exact URLs and fuzzy identity scopes; unrelated models never incur text comparison.
  const byUrl = new Map<string, typeof articles>(),
    byIdentity = new Map<string, typeof articles>();
  const identityKey = (a: WatcherArticle) =>
    a.brand && a.model
      ? JSON.stringify([
          a.market,
          a.brazilApplicability ?? 'UNKNOWN',
          watcherKey(a.brand),
          watcherKey(a.model),
        ])
      : null;
  for (const candidate of articles) {
    const urlBucket = byUrl.get(candidate.article.url) ?? [];
    urlBucket.push(candidate);
    byUrl.set(candidate.article.url, urlBucket);
    const identity = identityKey(candidate.article);
    if (identity) {
      const identityBucket = byIdentity.get(identity) ?? [];
      identityBucket.push(candidate);
      byIdentity.set(identity, identityBucket);
    }
  }
  const related: WatcherRelatedArticles[] = [];
  // Compare bounded changed items against indexed candidates with a date prefilter; no transitive merges.
  const changed = new Set([...newItems, ...updatedItems].map((o) => o.itemKey));
  let relationsTruncated = false;
  pairs: for (const changedArticle of articles.filter((a) => changed.has(a.observation.itemKey))) {
    const identity = identityKey(changedArticle.article);
    const candidates = new Map(
      [
        ...(byUrl.get(changedArticle.article.url) ?? []),
        ...(identity ? (byIdentity.get(identity) ?? []) : []),
      ].map((a) => [a.observation.itemKey, a] as const),
    );
    for (const otherArticle of candidates.values()) {
      if (changedArticle.observation.itemKey === otherArticle.observation.itemKey) continue;
      const [a, b] =
        changedArticle.observation.itemKey < otherArticle.observation.itemKey
          ? [changedArticle, otherArticle]
          : [otherArticle, changedArticle];
      if (
        changed.has(otherArticle.observation.itemKey) &&
        changedArticle.observation.itemKey > otherArticle.observation.itemKey
      )
        continue;
      if (
        a.article.url !== b.article.url &&
        Math.abs(Date.parse(a.article.publishedAt) - Date.parse(b.article.publishedAt)) >
          7 * 86_400_000
      )
        continue;
      const decision = compareWatcherArticles(a.article, b.article);
      if (decision.duplicate && related.length >= 1000) {
        relationsTruncated = true;
        break pairs;
      }
      if (decision.duplicate && (decision.reason === 'SAME_URL' || decision.reason === 'SAME_TEXT'))
        related.push({
          leftItemKey: a.observation.itemKey,
          rightItemKey: b.observation.itemKey,
          representativeItemKey: preferredWatcherArticle(a.article, b.article).id,
          reason: decision.reason,
        });
    }
  }
  related.sort((a, b) =>
    a.leftItemKey < b.leftItemKey
      ? -1
      : a.leftItemKey > b.leftItemKey
        ? 1
        : a.rightItemKey < b.rightItemKey
          ? -1
          : 1,
  );
  const checkpointAdvanced =
    batch.failures.length === 0 && conflicting.size === 0 && !relationsTruncated;
  return {
    newItems,
    updatedItems,
    unchangedItems,
    filteredItemKeys: [...filtered].sort(),
    related,
    history: sortedHistory,
    current,
    conflictingItemKeys: [...conflicting].sort(),
    relationsTruncated,
    checkpoint: checkpointAdvanced ? proposed : checkpoint,
    checkpointAdvanced,
  };
}
