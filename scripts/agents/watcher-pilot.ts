import { isDeepStrictEqual } from 'node:util';
import {
  validateWatcherRegistration,
  watcherUuid,
  type WatcherRepository,
} from '@compra-car/core/agents';
import { ingestWatcherFeed, type WatcherFeedTransport } from './watcher-feed-ingestion';
import { parseWatcherFeed } from './watcher-feed-parser';

export const WATCHER_PILOT_URL = 'https://motor1.uol.com.br/rss/news/all/';
export const WATCHER_PILOT = validateWatcherRegistration(
  {
    id: 'motor1-br-pilot',
    feedUrl: WATCHER_PILOT_URL,
    editorialMarket: 'BR',
    language: 'pt-BR',
    sourceRank: 1,
    enabled: true,
  },
  {
    requestUrl: WATCHER_PILOT_URL,
    allowedHosts: ['motor1.uol.com.br'],
    allowedArticleHosts: ['motor1.uol.com.br'],
    allowRelativeUrls: false,
    pollIntervalSeconds: 3600,
  },
);
type Repository = Pick<
  WatcherRepository,
  | 'listSources'
  | 'getSourceState'
  | 'listBatches'
  | 'listSourceItems'
  | 'registerSource'
  | 'claimLease'
  | 'persistBatch'
  | 'releaseLease'
>;
export type WatcherPilotValidation = Readonly<{
  schemaVersion: 'watcher-pilot-validation/1';
  url: string;
  sourceId: string;
  checkedAt: string;
  httpStatus: 200;
  format: 'RSS' | 'ATOM';
  received: number;
  valid: number;
  rejected: 0;
  truncated: false;
}>;
const fail = (code: string): never => {
  throw new Error('WATCHER_PILOT_' + code);
};
const sourceId = WATCHER_PILOT.source.id;

async function assertFirstBatch(repository: Repository) {
  const sources = await repository.listSources(100, 0);
  if (sources.length === 100) return fail('SOURCE_INVENTORY_INCOMPLETE');
  for (const item of sources) {
    if (
      (item.source.id === sourceId || item.source.feedUrl === WATCHER_PILOT.source.feedUrl) &&
      (item.source.id !== sourceId ||
        !isDeepStrictEqual(item.source, WATCHER_PILOT.source) ||
        !isDeepStrictEqual(item.settings, WATCHER_PILOT.settings))
    )
      return fail('SOURCE_CONFLICT');
  }
  const batches = await repository.listBatches(sourceId, 1, 0);
  const state = await repository.getSourceState(sourceId);
  const items = await repository.listSourceItems(sourceId, 1, 0);
  if (
    batches.length ||
    items.length ||
    state?.lease ||
    (state &&
      (state.stateVersion !== 0 ||
        state.lastAttemptAt !== null ||
        state.checkpoint.lastSuccessfulObservedAt !== null))
  )
    return fail('PREVIOUS_ATTEMPT_OR_DATA');
}

/** Preparation only: one feed GET and the existing parser, no remote mutation. */
export async function validateWatcherPilotFeed(
  repository: Repository,
  transport: WatcherFeedTransport,
  now: string,
): Promise<WatcherPilotValidation> {
  if (!Number.isFinite(Date.parse(now))) return fail('INVALID_TIME');
  await assertFirstBatch(repository);
  const response = await transport.fetchFeed(WATCHER_PILOT_URL, null, Date.parse(now));
  if (response.status !== 'OK') return fail('FEED_UNAVAILABLE');
  const parsed = parseWatcherFeed(
    response.xml,
    { ...WATCHER_PILOT.source, feedUrl: WATCHER_PILOT_URL },
    {
      allowedArticleHosts: WATCHER_PILOT.settings.allowedArticleHosts,
      allowRelativeUrls: false,
    },
  );
  if (
    parsed.rejected ||
    parsed.truncated ||
    parsed.diagnostics.some((d) => d.code !== 'MISSING_DATE')
  )
    return fail('FEED_NOT_READY');
  return {
    schemaVersion: 'watcher-pilot-validation/1',
    url: WATCHER_PILOT_URL,
    sourceId,
    checkedAt: now,
    httpStatus: 200,
    format: parsed.format,
    received: parsed.received,
    valid: parsed.items.length,
    rejected: 0,
    truncated: false,
  };
}

/** Glue only: existing ingestion + existing RPC repository. One fetch, one persist attempt, no retry. */
export async function runWatcherPilotOnce(input: {
  repository: Repository;
  transport: WatcherFeedTransport;
  requestUrl?: string;
  batchId: string;
  now: () => string;
}) {
  const { repository, transport, now } = input;
  const batchId = watcherUuid(input.batchId),
    time = Date.parse(now());
  if (
    (input.requestUrl !== undefined && input.requestUrl !== WATCHER_PILOT_URL) ||
    !Number.isFinite(time)
  )
    return fail('INVALID_REQUEST');
  await assertFirstBatch(repository);
  const registered = await repository.registerSource(WATCHER_PILOT.source, WATCHER_PILOT.settings);
  const state = await repository.getSourceState(sourceId);
  const lease = await repository.claimLease(sourceId, 'watcher-24a5-manual', 120);
  if (!lease) return fail('LEASE_BUSY');
  let fetches = 0,
    persistAttempted = false,
    committed = false;
  let ingestionEvidence: unknown = null;
  try {
    if (
      lease.configVersion !== registered.configVersion ||
      lease.stateVersion !== (state?.stateVersion ?? 0)
    )
      return fail('STALE_LEASE');
    const result = await ingestWatcherFeed({
      source: registered.source,
      settings: registered.settings,
      observedAt: now(),
      history: [],
      current: [],
      checkpoint: state?.checkpoint ?? null,
      transport: {
        fetchFeed(...args) {
          if (++fetches !== 1) return fail('SECOND_FETCH_REJECTED');
          return transport.fetchFeed(...args);
        },
      },
      parserOptions: {
        allowedArticleHosts: WATCHER_PILOT.settings.allowedArticleHosts,
        allowRelativeUrls: false,
      },
    });
    ingestionEvidence = {
      status: result.status,
      parser: result.parserSummary,
      failures: result.batch.failures.map((failure) => ({
        stage: failure.stage,
        code: failure.code,
      })),
      diagnostics: result.diagnostics.map((diagnostic) => diagnostic.code),
    };
    if (
      result.status !== 'OK' ||
      !result.checkpointAdvanced ||
      result.batch.failures.length ||
      !result.parserSummary
    )
      return fail('INGESTION_INCOMPLETE');
    persistAttempted = true;
    const receipt = await repository.persistBatch({
      batchId,
      lease,
      batch: result.batch,
      checkpoint: result.checkpoint!,
      advanceCheckpoint: result.checkpointAdvanced,
      checkpointBlockedReason: null,
      diagnostics: result.diagnostics,
    });
    committed = true;
    const batches = await repository.listBatches(sourceId, 100, 0);
    const stored = await repository.listSourceItems(sourceId, 100, 0);
    const finalState = await repository.getSourceState(sourceId);
    const expectedItems = new Map(
      result.batch.observations.map((o) => [o.itemKey, o.evidenceFingerprint]),
    );
    if (
      receipt.batchId !== batchId ||
      receipt.sourceId !== sourceId ||
      receipt.status !== 'COMMITTED' ||
      receipt.replayed ||
      !receipt.checkpointAdvanced ||
      batches.length !== 1 ||
      batches[0].batchId !== batchId ||
      stored.length !== result.batch.observations.length ||
      stored.some(
        (item) =>
          item.sourceId !== sourceId ||
          expectedItems.get(item.itemKey) !== item.currentObservation.evidenceFingerprint,
      ) ||
      !finalState ||
      finalState.sourceId !== sourceId ||
      finalState.lease !== null ||
      finalState.stateVersion !== receipt.stateVersion ||
      !isDeepStrictEqual(finalState.checkpoint, result.checkpoint)
    )
      return fail('READBACK_MISMATCH');
    return {
      status: 'PASS' as const,
      sourceId,
      url: WATCHER_PILOT_URL,
      observedAt: result.batch.observedAt,
      httpStatus: 200,
      format: result.parserSummary.format,
      received: result.parserSummary.received,
      valid: result.parserSummary.valid,
      rejected: result.parserSummary.rejected,
      duplicates:
        result.unchangedItems.length +
        result.parserSummary.valid -
        result.batch.observations.length,
      revisions: result.updatedItems.length,
      persistedArticles: new Set(stored.map((i) => i.articleId)).size,
      batchId,
      batchStatus: receipt.status,
      checkpoint: finalState.checkpoint,
      fetches,
      persistAttempts: 1,
      aiCalls: 0,
      aiCost: 0,
      sample: stored.slice(0, 10).map((i) => ({
        title: i.currentObservation.item.title,
        url: i.currentObservation.item.url,
        brand: null,
        model: null,
      })),
    };
  } catch {
    // A timeout is not evidence of rollback: read back only, never resubmit or refetch.
    let outcome = 'UNKNOWN';
    try {
      const found = (await repository.listBatches(sourceId, 100, 0)).find(
        (b) => b.batchId === batchId,
      );
      outcome = found?.status ?? 'NOT_OBSERVED';
    } catch {
      /* keep UNKNOWN */
    }
    return {
      status: 'FAIL' as const,
      code: committed
        ? 'READBACK_NOT_CONFIRMED'
        : persistAttempted
          ? 'PERSISTENCE_OUTCOME_UNCERTAIN'
          : 'INGESTION_ABORTED',
      sourceId,
      url: WATCHER_PILOT_URL,
      batchId,
      persistAttempted,
      observedBatchStatus: outcome,
      ingestionEvidence,
      fetches,
      aiCalls: 0,
      aiCost: 0,
    };
  } finally {
    if (!committed)
      try {
        await repository.releaseLease(sourceId, lease.token, 'PERSISTENCE_FAILED');
      } catch {
        /* no retry; lease expires */
      }
  }
}
