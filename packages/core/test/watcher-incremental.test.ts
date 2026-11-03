import { describe, expect, it } from 'vitest';
import {
  createWatcherArticleObservation,
  processWatcherIngestion,
  validateWatcherIngestionBatch,
  type WatcherSource,
  type WatcherArticleObservation,
  type WatcherIncrementalResult,
} from '../src/agents';
const source: WatcherSource = {
  id: 'rss-br',
  feedUrl: 'https://auto.example.br/rss',
  editorialMarket: 'BR',
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};
const observedAt = '2026-10-25T12:00:00Z';
const item = {
  sourceId: source.id,
  guid: 'one',
  url: 'https://auto.example.br/a',
  title: 'Lançamento internacional',
  excerpt: 'one two three four five six seven eight nine',
  publishedAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};
const observation = createWatcherArticleObservation(item, observedAt);
const checkpoint = {
  sourceId: source.id,
  etag: 'v1',
  lastModified: null,
  lastSuccessfulObservedAt: '2026-10-24T00:00:00.000Z',
};
function run(
  observations: readonly WatcherArticleObservation[],
  previous?: WatcherIncrementalResult,
  failures: unknown[] = [],
  time = observedAt,
) {
  return processWatcherIngestion({
    source,
    batch: validateWatcherIngestionBatch({
      schemaVersion: 'watcher-ingestion/1',
      sourceId: source.id,
      observedAt: time,
      observations,
      failures,
    }),
    checkpoint: previous?.checkpoint ?? checkpoint,
    history: previous?.history ?? [],
    current: previous?.current ?? [],
    proposedCheckpoint: { ...checkpoint, etag: 'v2', lastSuccessfulObservedAt: time },
  });
}
describe('deterministic incremental Watcher projection', () => {
  it('finds old newly observed publications without a publication cursor and replay is idempotent', () => {
    const first = run([observation]);
    expect(first.newItems).toHaveLength(1);
    expect(first.checkpointAdvanced).toBe(true);
    const replay = run([observation], first);
    expect(replay.newItems).toHaveLength(0);
    expect(replay.updatedItems).toHaveLength(0);
    expect(replay.unchangedItems).toHaveLength(1);
    expect(replay.history).toEqual(first.history);
    expect(replay.current).toEqual(first.current);
  });
  it('detects updates and reversions under stable GUID, preserving prior evidence', () => {
    const first = run([observation]);
    const changed = createWatcherArticleObservation(
      { ...item, title: 'Updated', url: 'https://auto.example.br/moved' },
      '2026-10-26T12:00:00Z',
    );
    const second = run([changed], first, [], '2026-10-26T12:00:00Z');
    expect(second.updatedItems).toHaveLength(1);
    expect(second.history).toHaveLength(2);
    const reverted = createWatcherArticleObservation(item, '2026-10-27T12:00:00Z');
    const third = run([reverted], second, [], '2026-10-27T12:00:00Z');
    expect(third.updatedItems).toHaveLength(1);
    expect(third.current[0].item.title).toBe(item.title);
    expect(third.history).toHaveLength(2);
    expect(run([reverted], third, [], '2026-10-27T12:00:00Z').unchangedItems).toHaveLength(1);
  });
  it('recognizes new fallback URLs and keeps GUID source-scoped', () => {
    const one = createWatcherArticleObservation({ ...item, guid: null }, observedAt);
    const two = createWatcherArticleObservation(
      { ...item, guid: null, url: item.url + '?page=2' },
      observedAt,
    );
    expect(run([one, two]).newItems).toHaveLength(2);
    expect(
      createWatcherArticleObservation({ ...item, sourceId: 'other' }, observedAt).itemKey,
    ).not.toBe(observation.itemKey);
  });
  it('freezes checkpoint on a rejection/truncation/failure while staging valid evidence for retry', () => {
    const failure = {
      sourceId: source.id,
      itemKey: null,
      observedAt,
      stage: 'PARSE',
      code: 'LIMIT_EXCEEDED',
      retryable: false,
    };
    const result = run([observation], undefined, [failure]);
    expect(result.checkpointAdvanced).toBe(false);
    expect(result.checkpoint).toEqual(checkpoint);
    expect(result.history).toHaveLength(1);
    const retry = run([observation], result);
    expect(retry.unchangedItems).toHaveLength(1);
    expect(retry.checkpointAdvanced).toBe(true);
  });
  it('reports same-GUID conflicting revisions within a batch without advancing checkpoint', () => {
    const revised = createWatcherArticleObservation(
      { ...item, title: 'Conflicting revision' },
      observedAt,
    );
    const result = run([observation, revised]);
    expect(result.history).toHaveLength(2);
    expect(result.conflictingItemKeys).toEqual([observation.itemKey]);
    expect(result.checkpointAdvanced).toBe(false);
    expect(run([revised, observation]).current).toEqual(result.current);
  });
  it('groups related sources without deleting origins or implicitly inferring models/BR availability', () => {
    const otherSource = { ...source, id: 'global', sourceRank: 5 };
    const other = createWatcherArticleObservation(
      { ...item, sourceId: otherSource.id, url: 'https://other.example.br/b' },
      observedAt,
    );
    const input = {
      source,
      batch: validateWatcherIngestionBatch({
        schemaVersion: 'watcher-ingestion/1',
        sourceId: source.id,
        observedAt,
        observations: [observation],
        failures: [],
      }),
      checkpoint,
      proposedCheckpoint: { ...checkpoint, lastSuccessfulObservedAt: observedAt },
      history: [other],
      current: [other],
      sources: [otherSource],
      classifications: {
        [observation.itemKey]: {
          category: 'PRODUCTS' as const,
          brand: 'Ford',
          model: 'Puma',
          brazilApplicability: 'NOT_APPLICABLE' as const,
        },
        [other.itemKey]: {
          category: 'PRODUCTS' as const,
          brand: 'Ford',
          model: 'Puma',
          brazilApplicability: 'NOT_APPLICABLE' as const,
        },
      },
    };
    const result = processWatcherIngestion(input);
    expect(result.related).toHaveLength(1);
    expect(result.related[0].representativeItemKey).toBe(observation.itemKey);
    expect(result.history).toHaveLength(2);
    expect(
      processWatcherIngestion({
        ...input,
        sources: [{ ...otherSource, editorialMarket: 'GLOBAL' }],
      }).related,
    ).toHaveLength(0);
    expect(processWatcherIngestion({ ...input, classifications: undefined }).related).toHaveLength(
      0,
    );
  });
  it('filters sponsored/irrelevant news but retains their evidence and undated observations', () => {
    const noDate = createWatcherArticleObservation(
      { ...item, guid: 'undated', publishedAt: null },
      observedAt,
    );
    const result = processWatcherIngestion({
      source,
      batch: validateWatcherIngestionBatch({
        schemaVersion: 'watcher-ingestion/1',
        sourceId: source.id,
        observedAt,
        observations: [observation, noDate],
        failures: [],
      }),
      history: [],
      current: [],
      checkpoint,
      proposedCheckpoint: { ...checkpoint, lastSuccessfulObservedAt: observedAt },
      classifications: { [observation.itemKey]: { category: 'PRODUCTS', isSponsored: true } },
    });
    expect(result.filteredItemKeys).toEqual([observation.itemKey]);
    expect(result.history).toHaveLength(2);
    expect(result.current.find((o) => o.itemKey === noDate.itemKey)?.item.publishedAt).toBeNull();
  });
  it('rejects invalid scope, stale checkpoints, inconsistent state and capacity overflow', () => {
    const input = {
      source,
      batch: validateWatcherIngestionBatch({
        schemaVersion: 'watcher-ingestion/1',
        sourceId: source.id,
        observedAt,
        observations: [],
        failures: [],
      }),
      history: [],
      current: [],
      checkpoint,
      proposedCheckpoint: { ...checkpoint, lastSuccessfulObservedAt: observedAt },
    };
    expect(() =>
      processWatcherIngestion({ ...input, source: { ...source, enabled: false } }),
    ).toThrow('WATCHER_INVALID_INCREMENTAL_SCOPE');
    expect(() =>
      processWatcherIngestion({
        ...input,
        proposedCheckpoint: { ...input.proposedCheckpoint, sourceId: 'other' },
      }),
    ).toThrow();
    expect(() =>
      processWatcherIngestion({
        ...input,
        checkpoint: { ...checkpoint, lastSuccessfulObservedAt: '2027-01-01T00:00:00Z' },
      }),
    ).toThrow();
    expect(() => processWatcherIngestion({ ...input, history: [observation] })).toThrow(
      'WATCHER_INVALID_CURRENT_STATE',
    );
    expect(() =>
      processWatcherIngestion({ ...input, history: Array(5001).fill(observation) }),
    ).toThrow('WATCHER_HISTORY_LIMIT');
  });
  it('caps relation output and freezes checkpoints instead of producing unbounded duplicate pairs', () => {
    const observations = Array.from({ length: 46 }, (_, i) =>
      createWatcherArticleObservation({ ...item, guid: 'id-' + i }, observedAt),
    );
    const result = run(observations);
    expect(result.related).toHaveLength(1000);
    expect(result.relationsTruncated).toBe(true);
    expect(result.checkpointAdvanced).toBe(false);
    expect(result.history).toHaveLength(46);
  });
  it('does not mutate input and produces deterministic results independent of batch order', () => {
    const two = createWatcherArticleObservation({ ...item, guid: 'two' }, observedAt);
    const before = JSON.stringify(observation);
    expect(run([observation, two])).toEqual(run([two, observation]));
    expect(JSON.stringify(observation)).toBe(before);
  });
});
