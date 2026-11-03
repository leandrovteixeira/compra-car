import {
  canonicalArticleUrl,
  validateWatcherRegistration,
  type WatcherSourceSettings,
  processWatcherIngestion,
  validateWatcherIngestionBatch,
  validateWatcherSource,
  createWatcherArticleObservation,
  type WatcherArticleObservation,
  type WatcherSource,
  type WatcherSourceCheckpoint,
  type WatcherIngestionFailure,
  type WatcherArticleClassification,
} from '@compra-car/core/agents';
import {
  parseWatcherFeed,
  WatcherFeedParseError,
  type WatcherFeedParseOptions,
  type FeedDiagnostic,
  type WatcherFeedParseResult,
} from './watcher-feed-parser';
import { WatcherFeedTransportError, type WatcherFeedFetchResult } from './watcher-feed-transport';

export interface WatcherFeedTransport {
  fetchFeed(
    url: string,
    checkpoint: WatcherSourceCheckpoint | null,
    nowMs: number,
  ): Promise<WatcherFeedFetchResult>;
}
/** Explicit callable service only; no CLI, scheduler, remote store, Brand Connector or provider. */
export async function ingestWatcherFeed(input: {
  source: WatcherSource;
  /** Exact approved HTTP URL, distinct from canonical identity. */
  requestUrl?: string;
  settings?: WatcherSourceSettings;
  observedAt: string;
  history: readonly WatcherArticleObservation[];
  current: readonly WatcherArticleObservation[];
  checkpoint: WatcherSourceCheckpoint | null;
  transport: WatcherFeedTransport;
  parserOptions?: WatcherFeedParseOptions;
  classifications?: Readonly<Record<string, WatcherArticleClassification>>;
  sources?: readonly WatcherSource[];
}) {
  const source = validateWatcherSource(input.source);
  // Preserve caller-approved path/query/trailing slash; canonicalization is identity only.
  const registration = input.settings ? validateWatcherRegistration(source, input.settings) : null;
  const requestUrl = registration?.settings.requestUrl ?? input.requestUrl ?? input.source.feedUrl;
  if (registration && input.requestUrl !== undefined && input.requestUrl !== requestUrl)
    throw new Error('WATCHER_INVALID_REQUEST_URL');
  if (!requestUrl.startsWith('https://') || canonicalArticleUrl(requestUrl) !== source.feedUrl)
    throw new Error('WATCHER_INVALID_REQUEST_URL');
  // Validate caller data before any network dispatch (including scope, timestamps and stale checkpoint).
  const empty = validateWatcherIngestionBatch({
    schemaVersion: 'watcher-ingestion/1',
    sourceId: source.id,
    observedAt: input.observedAt,
    observations: [],
    failures: [],
  });
  const proposed = {
    sourceId: source.id,
    etag: null,
    lastModified: null,
    lastSuccessfulObservedAt: empty.observedAt,
  };
  processWatcherIngestion({ ...input, source, batch: empty, proposedCheckpoint: proposed });
  const failures: WatcherIngestionFailure[] = [],
    diagnostics: FeedDiagnostic[] = [];
  let parserSummary:
    | (Pick<WatcherFeedParseResult, 'format' | 'received' | 'rejected' | 'truncated'> & {
        valid: number;
      })
    | null = null;
  let observations: WatcherArticleObservation[] = [],
    checkpoint: WatcherSourceCheckpoint = proposed;
  let status: 'OK' | 'NOT_MODIFIED' | 'RETRY' | 'PARTIAL' | 'FAILED' = 'FAILED',
    retryAfterMs: number | null = null;
  const fail = (
    stage: WatcherIngestionFailure['stage'],
    code: WatcherIngestionFailure['code'],
    retryable: boolean,
  ) =>
    failures.push({
      sourceId: source.id,
      itemKey: null,
      observedAt: empty.observedAt,
      stage,
      code,
      retryable,
    });
  try {
    const response = await input.transport.fetchFeed(
      requestUrl,
      input.checkpoint,
      Date.parse(empty.observedAt),
    );
    status = response.status;
    if (response.status === 'RETRY') {
      retryAfterMs = response.retryAfterMs;
      fail('FETCH', 'UNAVAILABLE', true);
    } else {
      checkpoint = {
        sourceId: source.id,
        etag: response.etag,
        lastModified: response.lastModified,
        lastSuccessfulObservedAt: empty.observedAt,
      };
      if (response.status === 'OK') {
        const parsed = parseWatcherFeed(
          response.xml,
          { ...source, feedUrl: requestUrl },
          input.parserOptions,
        );
        diagnostics.push(...parsed.diagnostics);
        parserSummary = {
          format: parsed.format,
          received: parsed.received,
          valid: parsed.items.length,
          rejected: parsed.rejected,
          truncated: parsed.truncated,
        };
        observations = parsed.items.map((item) =>
          createWatcherArticleObservation(item, empty.observedAt),
        );
        if (parsed.rejected) fail('NORMALIZE', 'INVALID_ITEM', false);
        if (parsed.truncated) fail('PARSE', 'LIMIT_EXCEEDED', false);
      }
    }
  } catch (error) {
    status = 'FAILED';
    if (error instanceof WatcherFeedParseError)
      fail('PARSE', error.code === 'LIMIT_EXCEEDED' ? 'LIMIT_EXCEEDED' : 'INVALID_FEED', false);
    else if (error instanceof WatcherFeedTransportError)
      fail(
        'FETCH',
        error.code === 'TIMEOUT'
          ? 'TIMEOUT'
          : error.code === 'LIMIT_EXCEEDED'
            ? 'LIMIT_EXCEEDED'
            : 'UNAVAILABLE',
        ['TIMEOUT', 'UNAVAILABLE'].includes(error.code),
      );
    else fail('FETCH', 'UNAVAILABLE', false);
  }
  const batch = validateWatcherIngestionBatch({ ...empty, observations, failures });
  const result = processWatcherIngestion({
    ...input,
    source,
    batch,
    proposedCheckpoint: checkpoint,
  });
  if (status === 'OK' && !result.checkpointAdvanced) status = 'PARTIAL';
  return { status, retryAfterMs, diagnostics, parserSummary, batch, ...result };
}
