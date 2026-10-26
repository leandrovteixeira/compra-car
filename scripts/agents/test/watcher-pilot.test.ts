import { describe, expect, it, vi } from 'vitest';
import { WatcherFeedTransportError } from '../watcher-feed-transport';
import type {
  WatcherRepository,
  WatcherPersistentState,
  WatcherStoredSource,
  WatcherStoredBatch,
  WatcherStoredFeedItem,
} from '@compra-car/core/agents';
import {
  WATCHER_PILOT,
  WATCHER_PILOT_URL,
  runWatcherPilotOnce,
  validateWatcherPilotFeed,
} from '../watcher-pilot';

const at = '2026-10-26T18:00:00.000Z';
const id = '11111111-1111-4111-8111-111111111111';
const rss = (
  items = '<item><guid>one</guid><title>Fiat Pulse</title><link>https://motor1.uol.com.br/news/one/</link></item>',
) =>
  `<rss version="2.0"><channel><title>Fixture</title><link>https://motor1.uol.com.br/</link><description>Test</description>${items}</channel></rss>`;
function setup(xml = rss()) {
  let source: WatcherStoredSource | undefined;
  let state: WatcherPersistentState | null = null;
  const batches: WatcherStoredBatch[] = [],
    items: WatcherStoredFeedItem[] = [];
  const repository = {
    listSources: vi.fn<WatcherRepository['listSources']>(async () => (source ? [source] : [])),
    listBatches: vi.fn<WatcherRepository['listBatches']>(async () => batches),
    listSourceItems: vi.fn<WatcherRepository['listSourceItems']>(async () => items),
    getSourceState: vi.fn<WatcherRepository['getSourceState']>(async () => state),
    registerSource: vi.fn<WatcherRepository['registerSource']>(async () => {
      source = { ...WATCHER_PILOT, configVersion: 1, createdAt: at, updatedAt: at };
      state = {
        sourceId: WATCHER_PILOT.source.id,
        stateVersion: 0,
        configVersion: 1,
        checkpoint: {
          sourceId: WATCHER_PILOT.source.id,
          etag: null,
          lastModified: null,
          lastSuccessfulObservedAt: null,
        },
        lease: null,
        consecutiveFailures: 0,
        lastFailureCode: null,
        lastAttemptAt: null,
      };
      return source;
    }),
    claimLease: vi.fn<WatcherRepository['claimLease']>(async () => {
      const lease = {
        sourceId: WATCHER_PILOT.source.id,
        token: id,
        owner: 'watcher-24a5-manual',
        expiresAt: '2026-10-26T18:02:00.000Z',
        configVersion: 1,
        stateVersion: 0,
      };
      state = { ...state!, lease };
      return lease;
    }),
    persistBatch: vi.fn<WatcherRepository['persistBatch']>(async (input) => {
      const receipt = {
        batchId: input.batchId,
        sourceId: WATCHER_PILOT.source.id,
        status: 'COMMITTED' as const,
        stateVersion: 1,
        checkpointAdvanced: true,
        replayed: false,
      };
      batches.push({
        ...receipt,
        sourceSnapshot: source!,
        observedAt: input.batch.observedAt,
        committedAt: at,
        failures: [],
        diagnostics: input.diagnostics,
      });
      for (const observation of input.batch.observations)
        items.push({
          id,
          sourceId: WATCHER_PILOT.source.id,
          itemKey: observation.itemKey,
          articleId: id,
          currentRevisionId: id,
          currentObservation: observation,
          firstSeenAt: at,
          lastSeenAt: at,
        });
      state = { ...state!, stateVersion: 1, lease: null, checkpoint: input.checkpoint };
      return receipt;
    }),
    releaseLease: vi.fn<WatcherRepository['releaseLease']>(async () => true),
  };
  const transport = {
    fetchFeed: vi.fn(async () => ({
      status: 'OK' as const,
      xml,
      etag: 'fixture',
      lastModified: null,
    })),
  };
  const validation = {
    schemaVersion: 'watcher-pilot-validation/1' as const,
    url: WATCHER_PILOT_URL,
    sourceId: WATCHER_PILOT.source.id,
    checkedAt: at,
    httpStatus: 200 as const,
    format: 'RSS' as const,
    received: 1,
    valid: 1,
    rejected: 0 as const,
    truncated: false as const,
  };
  return {
    repository,
    transport,
    validation,
    batches,
    items,
    run: () => runWatcherPilotOnce({ repository, transport, batchId: id, now: () => at }),
  };
}
describe('manual Watcher pilot glue - mocks only', () => {
  it('stops after a network timeout and releases the lease without retry', async () => {
    const x = setup();
    x.transport.fetchFeed.mockRejectedValue(new WatcherFeedTransportError('TIMEOUT'));
    expect(await x.run()).toMatchObject({ status: 'FAIL', fetches: 1, persistAttempted: false });
    expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
    expect(x.repository.persistBatch).not.toHaveBeenCalled();
    expect(x.repository.releaseLease).toHaveBeenCalledTimes(1);
  });
  it('does not retry a persistence failure or duplicate batch rejection', async () => {
    for (const message of ['persistence unavailable', 'duplicate batch']) {
      const x = setup();
      x.repository.persistBatch.mockRejectedValue(new Error(message));
      expect(await x.run()).toMatchObject({
        status: 'FAIL',
        code: 'PERSISTENCE_OUTCOME_UNCERTAIN',
        observedBatchStatus: 'NOT_OBSERVED',
      });
      expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
      expect(x.repository.persistBatch).toHaveBeenCalledTimes(1);
      expect(x.repository.releaseLease).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects a committed batch whose checkpoint validators were not stored', async () => {
    const x = setup();
    const read = x.repository.getSourceState.getMockImplementation()!;
    x.repository.getSourceState.mockImplementation(async (...args) => {
      const state = await read(...args);
      return state && state.stateVersion > 0
        ? { ...state, checkpoint: { ...state.checkpoint, etag: 'wrong' } }
        : state;
    });
    expect(await x.run()).toMatchObject({
      status: 'FAIL',
      code: 'READBACK_NOT_CONFIRMED',
      observedBatchStatus: 'COMMITTED',
    });
    expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
    expect(x.repository.persistBatch).toHaveBeenCalledTimes(1);
  });
  it('counts valid duplicate RSS entries while persisting only normalized evidence', async () => {
    const item =
      '<item><guid>one</guid><title>Fiat Pulse</title><link>https://motor1.uol.com.br/news/one/</link></item>';
    const x = setup(rss(item + item));
    expect(await x.run()).toMatchObject({
      status: 'PASS',
      received: 2,
      valid: 2,
      duplicates: 1,
      persistedArticles: 1,
    });
    expect(x.repository.persistBatch.mock.calls[0][0].batch.observations).toHaveLength(1);
    expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
  });
  it('does not accept a readback with matching counts but different persisted evidence', async () => {
    const x = setup();
    x.repository.listSourceItems.mockImplementation(async () =>
      x.items.map((item) => ({ ...item, itemKey: 'different' })),
    );
    expect(await x.run()).toMatchObject({
      status: 'FAIL',
      code: 'READBACK_NOT_CONFIRMED',
      observedBatchStatus: 'COMMITTED',
    });
    expect(x.repository.persistBatch).toHaveBeenCalledTimes(1);
    expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
  });
  it('validates the authorized feed through the existing parser with no writes', async () => {
    const { repository, transport } = setup();
    const result = await validateWatcherPilotFeed(repository, transport, at);
    expect(result).toMatchObject({
      url: WATCHER_PILOT_URL,
      format: 'RSS',
      received: 1,
      valid: 1,
      rejected: 0,
    });
    expect(transport.fetchFeed).toHaveBeenCalledExactlyOnceWith(
      WATCHER_PILOT_URL,
      null,
      Date.parse(at),
    );
    expect(repository.registerSource).not.toHaveBeenCalled();
    expect(repository.persistBatch).not.toHaveBeenCalled();
  });
  it('uses one existing ingestion fetch and one transactional persist, then reads results', async () => {
    const x = setup();
    const result = await x.run();
    expect(result).toMatchObject({
      status: 'PASS',
      batchId: id,
      batchStatus: 'COMMITTED',
      received: 1,
      valid: 1,
      persistedArticles: 1,
      fetches: 1,
      persistAttempts: 1,
      aiCalls: 0,
      aiCost: 0,
    });
    expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
    expect(x.repository.persistBatch).toHaveBeenCalledTimes(1);
    expect(x.repository.registerSource).toHaveBeenCalledExactlyOnceWith(
      WATCHER_PILOT.source,
      WATCHER_PILOT.settings,
    );
  });
  it('persists exactly one batch even when a valid feed has zero articles', async () => {
    const x = setup(rss(''));
    const result = await x.run();
    expect(result).toMatchObject({ status: 'PASS', received: 0, valid: 0, persistedArticles: 0 });
    expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
    expect(x.repository.persistBatch).toHaveBeenCalledTimes(1);
  });
  it('blocks a second cycle before network or new writes when a batch already exists', async () => {
    const x = setup();
    await x.run();
    x.transport.fetchFeed.mockClear();
    x.repository.registerSource.mockClear();
    await expect(x.run()).rejects.toThrow('WATCHER_PILOT_PREVIOUS_ATTEMPT_OR_DATA');
    expect(x.transport.fetchFeed).not.toHaveBeenCalled();
    expect(x.repository.registerSource).not.toHaveBeenCalled();
    expect(x.repository.persistBatch).toHaveBeenCalledTimes(1);
  });
  it('rejects another URL or invalid time before writes', async () => {
    const x = setup();
    for (const patch of [
      { requestUrl: 'https://other.invalid/rss', now: () => at },
      { requestUrl: WATCHER_PILOT_URL, now: () => 'invalid' },
    ])
      await expect(
        runWatcherPilotOnce({
          repository: x.repository,
          transport: x.transport,
          batchId: id,
          ...patch,
        }),
      ).rejects.toThrow('WATCHER_PILOT_INVALID_REQUEST');
    expect(x.repository.registerSource).not.toHaveBeenCalled();
    expect(x.transport.fetchFeed).not.toHaveBeenCalled();
  });
  it('does not refetch or persist when the lease is busy', async () => {
    const x = setup();
    x.repository.claimLease.mockResolvedValue(null);
    await expect(x.run()).rejects.toThrow('WATCHER_PILOT_LEASE_BUSY');
    expect(x.transport.fetchFeed).not.toHaveBeenCalled();
    expect(x.repository.persistBatch).not.toHaveBeenCalled();
  });
  it('does not persist invalid XML and releases the lease without another fetch', async () => {
    const x = setup('<html>Not RSS</html>');
    expect(await x.run()).toMatchObject({
      status: 'FAIL',
      code: 'INGESTION_ABORTED',
      fetches: 1,
      persistAttempted: false,
    });
    expect(x.repository.persistBatch).not.toHaveBeenCalled();
    expect(x.repository.releaseLease).toHaveBeenCalledTimes(1);
  });
  it('reconciles a lost persist response using reads only, never resubmits', async () => {
    const x = setup(),
      persist = x.repository.persistBatch.getMockImplementation()!;
    x.repository.persistBatch.mockImplementation(async (input) => {
      await persist(input);
      throw new Error('sensitive transport failure');
    });
    const result = await x.run();
    expect(result).toMatchObject({
      status: 'FAIL',
      code: 'PERSISTENCE_OUTCOME_UNCERTAIN',
      observedBatchStatus: 'COMMITTED',
    });
    expect(JSON.stringify(result)).not.toContain('sensitive');
    expect(JSON.stringify(result)).not.toContain('token');
    expect(x.repository.persistBatch).toHaveBeenCalledTimes(1);
    expect(x.transport.fetchFeed).toHaveBeenCalledTimes(1);
  });
  it('blocks conflicting source definitions without updating them', async () => {
    const x = setup();
    x.repository.listSources.mockResolvedValue([
      {
        ...WATCHER_PILOT,
        source: { ...WATCHER_PILOT.source, feedUrl: 'https://other.invalid/rss' },
        configVersion: 1,
        createdAt: at,
        updatedAt: at,
      },
    ]);
    await expect(x.run()).rejects.toThrow('WATCHER_PILOT_SOURCE_CONFLICT');
    expect(x.repository.registerSource).not.toHaveBeenCalled();
    expect(x.transport.fetchFeed).not.toHaveBeenCalled();
  });
  it('rejects a partial parser result during preparation without registering a source', async () => {
    const x = setup(rss('<item><title>Missing link</title></item>'));
    await expect(validateWatcherPilotFeed(x.repository, x.transport, at)).rejects.toThrow(
      'WATCHER_PILOT_FEED_NOT_READY',
    );
    expect(x.repository.registerSource).not.toHaveBeenCalled();
  });
});
