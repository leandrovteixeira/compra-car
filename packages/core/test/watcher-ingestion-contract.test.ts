import { describe, expect, it, vi } from 'vitest';
import {
  createWatcherArticleObservation,
  fingerprintWatcherFeedItem,
  validateWatcherArticleObservation,
  validateWatcherFeedItem,
  validateWatcherIngestionBatch,
  validateWatcherIngestionFailure,
  validateWatcherSource,
  validateWatcherSourceCheckpoint,
  watcherFeedItemIdentity,
  type WatcherFeedItem,
} from '../src/agents/watcher-ingestion-contract';

const item: WatcherFeedItem = {
  sourceId: 'rss-br',
  guid: 'opaque-guid',
  url: 'https://auto.example.br/article',
  title: 'Lançamento na Europa',
  excerpt: null,
  publishedAt: '2026-10-20T12:00:00Z',
  updatedAt: null,
};
const observedAt = '2026-10-25T12:00:00Z';
const observation = createWatcherArticleObservation(item, observedAt);
const failure = {
  sourceId: item.sourceId,
  itemKey: null,
  observedAt,
  stage: 'PARSE',
  code: 'INVALID_FEED',
  retryable: false,
};
const batch = {
  schemaVersion: 'watcher-ingestion/1',
  sourceId: item.sourceId,
  observedAt,
  observations: [observation],
  failures: [],
};
const source = {
  id: item.sourceId,
  feedUrl: 'https://auto.example.br/rss',
  editorialMarket: 'BR',
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};

describe('Watcher pure incremental contracts', () => {
  it('keeps editorial market separate from publication/evidence/model candidates', () => {
    expect(validateWatcherSource(source).editorialMarket).toBe('BR');
    expect(
      validateWatcherSource({ ...source, editorialMarket: 'GLOBAL', language: 'en' })
        .editorialMarket,
    ).toBe('GLOBAL');
    const normalized = validateWatcherFeedItem({
      ...item,
      model: 'invented',
      confirmedBrazil: true,
      image: 'https://x',
      content: 'full article',
    });
    expect(normalized).not.toHaveProperty('model');
    expect(normalized).not.toHaveProperty('confirmedBrazil');
    expect(normalized).not.toHaveProperty('content');
    expect(normalized).not.toHaveProperty('image');
    expect(observation.observedAt).not.toBe(observation.item.publishedAt);
  });
  it('uses GUID scoped to source, falling back to canonical URL only without GUID', () => {
    expect(watcherFeedItemIdentity(item)).toBe(
      watcherFeedItemIdentity({ ...item, url: 'https://auto.example.br/new' }),
    );
    expect(watcherFeedItemIdentity(item)).not.toBe(
      watcherFeedItemIdentity({ ...item, sourceId: 'another-source' }),
    );
    expect(watcherFeedItemIdentity({ ...item, guid: null })).toBe(
      watcherFeedItemIdentity({ ...item, guid: null, url: item.url + '/?utm_source=rss#x' }),
    );
    expect(watcherFeedItemIdentity({ ...item, guid: null })).not.toBe(
      watcherFeedItemIdentity({ ...item, guid: null, url: item.url + '?page=2' }),
    );
    expect(watcherFeedItemIdentity({ ...item, guid: null })).not.toBe(
      watcherFeedItemIdentity({ ...item, guid: item.url }),
    );
  });
  it('pins the v1 identity and evidence fingerprints to stable vectors', () => {
    expect(watcherFeedItemIdentity(item)).toBe(
      'watcher-item/1:sha256:e330ebae73b4f55df2623bda86f90990d75b82be0f739d1bae579334c5cda0ff',
    );
    expect(fingerprintWatcherFeedItem(item)).toBe(
      'watcher-evidence/1:sha256:2a7c93993f02a368b22281d79c000ae79f1698e67b9ded364991ed96ae7bef03',
    );
  });
  it('preserves case and Unicode distinctions in opaque GUIDs', () => {
    expect(watcherFeedItemIdentity({ ...item, guid: 'AbC' })).not.toBe(
      watcherFeedItemIdentity({ ...item, guid: 'abc' }),
    );
    expect(watcherFeedItemIdentity({ ...item, guid: '\u00e9' })).not.toBe(
      watcherFeedItemIdentity({ ...item, guid: 'e\u0301' }),
    );
  });
  it('creates reproducible evidence, preserves revisions and excludes observation time', () => {
    expect(createWatcherArticleObservation(item, observedAt)).toEqual(observation);
    expect(createWatcherArticleObservation(item, '2026-10-26T12:00:00Z').evidenceFingerprint).toBe(
      observation.evidenceFingerprint,
    );
    expect(fingerprintWatcherFeedItem({ ...item, title: 'Correction' })).not.toBe(
      observation.evidenceFingerprint,
    );
    expect(fingerprintWatcherFeedItem({ ...item, url: item.url + '?utm_source=rss' })).toBe(
      observation.evidenceFingerprint,
    );
    expect(
      fingerprintWatcherFeedItem(
        Object.fromEntries(Object.entries(item).reverse()) as WatcherFeedItem,
      ),
    ).toBe(observation.evidenceFingerprint);
    expect(validateWatcherArticleObservation(observation)).toEqual(observation);
  });
  it('normalizes repeated observations idempotently, independent of input order', () => {
    const earlier = createWatcherArticleObservation(item, '2026-10-24T12:00:00Z');
    const revised = createWatcherArticleObservation({ ...item, title: 'Updated' }, observedAt);
    const a = validateWatcherIngestionBatch({
      ...batch,
      observations: [observation, earlier, revised, observation],
      failures: [failure, failure],
    });
    const b = validateWatcherIngestionBatch({
      ...batch,
      observations: [revised, earlier, observation],
      failures: [failure],
    });
    expect(a).toEqual(b);
    expect(a.observations).toHaveLength(2);
    expect(
      a.observations.find((o) => o.evidenceFingerprint === observation.evidenceFingerprint)
        ?.observedAt,
    ).toBe(earlier.observedAt);
    expect(validateWatcherIngestionBatch(a)).toEqual(a);
  });
  it('allows missing publication dates without inferring them from observation time', () => {
    const o = createWatcherArticleObservation({ ...item, publishedAt: null }, observedAt);
    expect(o.item.publishedAt).toBeNull();
    expect(
      validateWatcherSourceCheckpoint({
        sourceId: item.sourceId,
        etag: 'W/"opaque"',
        lastModified: 'Wed, 21 Oct 2026 07:28:00 GMT',
        lastSuccessfulObservedAt: null,
      }),
    ).toEqual({
      sourceId: item.sourceId,
      etag: 'W/"opaque"',
      lastModified: 'Wed, 21 Oct 2026 07:28:00 GMT',
      lastSuccessfulObservedAt: null,
    });
  });
  it.each([
    null,
    [],
    {},
    { ...source, enabled: 'yes' },
    { ...source, editorialMarket: 'EU' },
    { ...source, language: 'not a language' },
    { ...source, sourceRank: -1 },
  ])('rejects invalid source %j', (v) => {
    expect(() => validateWatcherSource(v)).toThrow();
  });
  it.each([
    {},
    { ...item, guid: '' },
    { ...item, title: 'a'.repeat(501) },
    { ...item, excerpt: 'a'.repeat(1001) },
    { ...item, publishedAt: '2026-02-30T12:00:00Z' },
    { ...item, updatedAt: '2026-10-19T12:00:00Z' },
    { ...item, url: 'https://127.0.0.1/' },
    { ...item, guid: 'a'.repeat(2049) },
  ])('rejects invalid feed item %j', (v) => {
    expect(() => validateWatcherFeedItem(v)).toThrow();
  });
  it('accepts text limits and never truncates silently', () => {
    const boundary = {
      ...item,
      title: 'a'.repeat(500),
      excerpt: 'b'.repeat(1000),
      guid: 'c'.repeat(2048),
    };
    expect(validateWatcherFeedItem(boundary).excerpt).toHaveLength(1000);
    expect(() =>
      validateWatcherFeedItem({ ...boundary, excerpt: boundary.excerpt + 'x' }),
    ).toThrow();
  });
  it('rejects tampered identities and fingerprints', () => {
    expect(() => validateWatcherArticleObservation({ ...observation, itemKey: 'wrong' })).toThrow();
    expect(() =>
      validateWatcherArticleObservation({
        ...observation,
        evidenceFingerprint: observation.evidenceFingerprint.toUpperCase(),
      }),
    ).toThrow();
    expect(() =>
      validateWatcherArticleObservation({ ...observation, item: { ...item, title: 'tampered' } }),
    ).toThrow();
  });
  it.each([
    { ...batch, observations: Array(101).fill(observation) },
    { ...batch, failures: Array(101).fill(failure) },
    { ...batch, sourceId: 'other' },
    { ...batch, observations: null },
    { ...batch, schemaVersion: 'unknown' },
    { ...batch, observedAt: '2026-10-24T00:00:00Z' },
    { ...batch, failures: [{ ...failure, sourceId: 'other' }] },
  ])('rejects invalid batches %j', (v) => {
    expect(() => validateWatcherIngestionBatch(v)).toThrow();
  });
  it('validates failures without returning raw errors or provider payloads', () => {
    expect(validateWatcherIngestionFailure({ ...failure, message: 'secret' })).not.toHaveProperty(
      'message',
    );
    expect(() =>
      validateWatcherIngestionFailure({ ...failure, code: 'raw-error-secret' }),
    ).toThrow();
    expect(() => validateWatcherIngestionFailure({ ...failure, retryable: 1 })).toThrow();
    expect(() => validateWatcherIngestionFailure({ ...failure, itemKey: 'bad' })).toThrow();
    expect(() =>
      validateWatcherSourceCheckpoint({
        sourceId: item.sourceId,
        etag: 'x\r\ninjected',
        lastModified: null,
        lastSuccessfulObservedAt: null,
      }),
    ).toThrow();
  });
  it('runs without clock, randomness or external calls and leaves input untouched', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('NETWORK_FORBIDDEN');
    });
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('CLOCK_FORBIDDEN');
    });
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('RANDOM_FORBIDDEN');
    });
    const before = JSON.stringify(batch);
    try {
      expect(validateWatcherIngestionBatch(batch)).toEqual(validateWatcherIngestionBatch(batch));
      expect(JSON.stringify(batch)).toBe(before);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(nowSpy).not.toHaveBeenCalled();
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      nowSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });
});
