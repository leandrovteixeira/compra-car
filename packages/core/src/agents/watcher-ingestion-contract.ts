import {
  canonicalArticleUrl,
  WATCHER_CANONICALIZATION_VERSION,
  type WatcherMarket,
} from './watcher-foundation';
import {
  watcherDigest,
  watcherEvidenceFingerprint,
  watcherRank,
  watcherRecord,
  watcherText,
  watcherTimestamp,
} from './watcher-validation';

/** Editorial scope says nothing about a model's availability in Brazil. */
export type WatcherSource = Readonly<{
  id: string;
  feedUrl: string;
  editorialMarket: WatcherMarket;
  language: string;
  sourceRank: number;
  enabled: boolean;
}>;
/** Publication metadata only: no inferred model candidate, full article or image. */
export type WatcherFeedItem = Readonly<{
  sourceId: string;
  guid: string | null;
  url: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}>;
/** Evidence identity excludes observedAt so replaying an unchanged item is idempotent. */
export type WatcherArticleObservation = Readonly<{
  item: WatcherFeedItem;
  itemKey: string;
  evidenceFingerprint: string;
  observedAt: string;
}>;
export type WatcherIngestionFailure = Readonly<{
  sourceId: string;
  itemKey: string | null;
  observedAt: string;
  stage: 'FETCH' | 'PARSE' | 'NORMALIZE' | 'PERSIST';
  code: 'UNAVAILABLE' | 'TIMEOUT' | 'LIMIT_EXCEEDED' | 'INVALID_FEED' | 'INVALID_ITEM' | 'CONFLICT';
  retryable: boolean;
}>;
/** Proposed checkpoint data only. No function here advances or persists it. */
export type WatcherSourceCheckpoint = Readonly<{
  sourceId: string;
  etag: string | null;
  lastModified: string | null;
  lastSuccessfulObservedAt: string | null;
}>;
export type WatcherIngestionBatch = Readonly<{
  schemaVersion: 'watcher-ingestion/1';
  sourceId: string;
  observedAt: string;
  observations: readonly WatcherArticleObservation[];
  failures: readonly WatcherIngestionFailure[];
}>;
const INVALID = 'WATCHER_INVALID_INGESTION';
const text = (value: unknown, max = 200) => watcherText(value, max, INVALID);
const nullableDate = (value: unknown) => (value === null ? null : watcherTimestamp(value));
const nullableText = (value: unknown, max: number) => (value === null ? null : text(value, max));

export function validateWatcherSource(value: unknown): WatcherSource {
  const s = watcherRecord(value, INVALID);
  if (
    !['BR', 'GLOBAL'].includes(s.editorialMarket as string) ||
    typeof s.enabled !== 'boolean' ||
    typeof s.language !== 'string' ||
    !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(s.language) ||
    s.language.length > 35
  )
    throw new Error(INVALID);
  return {
    id: text(s.id),
    feedUrl: canonicalArticleUrl(s.feedUrl as string),
    editorialMarket: s.editorialMarket as WatcherMarket,
    language: s.language,
    sourceRank: watcherRank(s.sourceRank),
    enabled: s.enabled,
  };
}
// GUIDs are opaque: validate bounds without case-folding, trimming or Unicode folding.
function opaqueGuid(value: unknown): string {
  text(value, 2048);
  return value as string;
}
export function validateWatcherFeedItem(value: unknown): WatcherFeedItem {
  const f = watcherRecord(value, INVALID);
  const publishedAt = nullableDate(f.publishedAt),
    updatedAt = nullableDate(f.updatedAt);
  if (publishedAt && updatedAt && updatedAt < publishedAt) throw new Error(INVALID);
  return {
    sourceId: text(f.sourceId),
    guid: f.guid === null ? null : opaqueGuid(f.guid),
    url: canonicalArticleUrl(f.url as string),
    title: text(f.title, 500),
    excerpt: nullableText(f.excerpt, 1000),
    publishedAt,
    updatedAt,
  };
}
/** GUID is opaque and source-scoped. Empty/missing GUID must be mapped to null before validation. */
export function watcherFeedItemIdentity(value: WatcherFeedItem): string {
  const item = validateWatcherFeedItem(value);
  return watcherDigest('watcher-item/1', [
    item.sourceId,
    item.guid === null ? 'URL' : 'GUID',
    item.guid ?? item.url,
  ]);
}
export function fingerprintWatcherFeedItem(value: WatcherFeedItem): string {
  const item = validateWatcherFeedItem(value);
  return watcherDigest('watcher-evidence/1', [
    WATCHER_CANONICALIZATION_VERSION,
    watcherFeedItemIdentity(item),
    item.url,
    item.title,
    item.excerpt,
    item.publishedAt,
    item.updatedAt,
  ]);
}
export function createWatcherArticleObservation(
  value: WatcherFeedItem,
  observedAt: string,
): WatcherArticleObservation {
  const item = validateWatcherFeedItem(value);
  return {
    item,
    itemKey: watcherFeedItemIdentity(item),
    evidenceFingerprint: fingerprintWatcherFeedItem(item),
    observedAt: watcherTimestamp(observedAt),
  };
}
export function validateWatcherArticleObservation(value: unknown): WatcherArticleObservation {
  const o = watcherRecord(value, INVALID);
  const observation = createWatcherArticleObservation(
    validateWatcherFeedItem(o.item),
    watcherTimestamp(o.observedAt),
  );
  if (
    o.itemKey !== observation.itemKey ||
    watcherEvidenceFingerprint(o.evidenceFingerprint) !== observation.evidenceFingerprint
  )
    throw new Error(INVALID);
  return observation;
}
export function validateWatcherSourceCheckpoint(value: unknown): WatcherSourceCheckpoint {
  const c = watcherRecord(value, INVALID);
  // HTTP validators are opaque, not publication timestamps. Never infer a cursor from them.
  return {
    sourceId: text(c.sourceId),
    etag: nullableText(c.etag, 1024),
    lastModified: nullableText(c.lastModified, 128),
    lastSuccessfulObservedAt: nullableDate(c.lastSuccessfulObservedAt),
  };
}
export function validateWatcherIngestionFailure(value: unknown): WatcherIngestionFailure {
  const f = watcherRecord(value, INVALID);
  if (
    !['FETCH', 'PARSE', 'NORMALIZE', 'PERSIST'].includes(f.stage as string) ||
    ![
      'UNAVAILABLE',
      'TIMEOUT',
      'LIMIT_EXCEEDED',
      'INVALID_FEED',
      'INVALID_ITEM',
      'CONFLICT',
    ].includes(f.code as string) ||
    typeof f.retryable !== 'boolean' ||
    (f.itemKey !== null &&
      (typeof f.itemKey !== 'string' || !/^watcher-item\/1:sha256:[a-f0-9]{64}$/u.test(f.itemKey)))
  )
    throw new Error(INVALID);
  return {
    sourceId: text(f.sourceId),
    itemKey: f.itemKey as string | null,
    observedAt: watcherTimestamp(f.observedAt),
    stage: f.stage as WatcherIngestionFailure['stage'],
    code: f.code as WatcherIngestionFailure['code'],
    retryable: f.retryable,
  };
}
/** Canonical, bounded batch. Repeated evidence retains its earliest observation, independent of input order.
 * Distinct revisions of the same item remain separate. No checkpoint/commit decision is made here.
 */
export function validateWatcherIngestionBatch(value: unknown): WatcherIngestionBatch {
  const b = watcherRecord(value, INVALID);
  if (
    b.schemaVersion !== 'watcher-ingestion/1' ||
    !Array.isArray(b.observations) ||
    b.observations.length > 100 ||
    !Array.isArray(b.failures) ||
    b.failures.length > 100
  )
    throw new Error(INVALID);
  const sourceId = text(b.sourceId),
    observedAt = watcherTimestamp(b.observedAt);
  const observations = new Map<string, WatcherArticleObservation>();
  for (const raw of b.observations) {
    const o = validateWatcherArticleObservation(raw);
    if (o.item.sourceId !== sourceId || o.observedAt > observedAt) throw new Error(INVALID);
    const key = o.itemKey + o.evidenceFingerprint;
    const previous = observations.get(key);
    if (!previous || o.observedAt < previous.observedAt) observations.set(key, o);
  }
  const failures = new Map<string, WatcherIngestionFailure>();
  for (const raw of b.failures) {
    const f = validateWatcherIngestionFailure(raw);
    if (f.sourceId !== sourceId || f.observedAt > observedAt) throw new Error(INVALID);
    failures.set(JSON.stringify(f), f);
  }
  return {
    schemaVersion: 'watcher-ingestion/1',
    sourceId,
    observedAt,
    observations: [...observations.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, o]) => o),
    failures: [...failures.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, f]) => f),
  };
}
