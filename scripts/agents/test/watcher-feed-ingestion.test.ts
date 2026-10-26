import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ingestWatcherFeed } from '../watcher-feed-ingestion';
import { WatcherFeedTransportError } from '../watcher-feed-transport';
const source = {
  id: 'rss',
  feedUrl: 'https://auto.example.br/rss',
  editorialMarket: 'BR' as const,
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};
const xml = readFileSync(new URL('./fixtures/watcher/rss.xml', import.meta.url), 'utf8');
const checkpoint = {
  sourceId: source.id,
  etag: 'v0',
  lastModified: null,
  lastSuccessfulObservedAt: '2026-10-24T12:00:00.000Z',
};
const base = {
  source,
  observedAt: '2026-10-25T12:00:00Z',
  history: [],
  current: [],
  checkpoint,
  parserOptions: { allowRelativeUrls: true },
};
const ok = { status: 'OK' as const, xml, etag: 'v1', lastModified: null };
describe('offline feed orchestration', () => {
  it('collects, replays and stages old items without calling external providers', async () => {
    const transport = { fetchFeed: vi.fn(async () => ok) };
    const first = await ingestWatcherFeed({ ...base, transport });
    expect(first.newItems).toHaveLength(2);
    expect(first.checkpointAdvanced).toBe(true);
    expect(first.batch.failures).toHaveLength(0);
    const second = await ingestWatcherFeed({
      ...base,
      transport,
      ...first,
      observedAt: '2026-10-26T12:00:00Z',
    });
    expect(second.unchangedItems).toHaveLength(2);
    expect(second.history).toEqual(first.history);
    expect(second.current).toEqual(first.current);
  });
  it('handles 304 without parsing and preserves history', async () => {
    const first = await ingestWatcherFeed({ ...base, transport: { fetchFeed: async () => ok } });
    const result = await ingestWatcherFeed({
      ...base,
      ...first,
      observedAt: '2026-10-26T12:00:00Z',
      transport: {
        fetchFeed: async () => ({ status: 'NOT_MODIFIED', etag: 'v1', lastModified: null }),
      },
    });
    expect(result.status).toBe('NOT_MODIFIED');
    expect(result.history).toEqual(first.history);
    expect(result.checkpointAdvanced).toBe(true);
  });
  it.each([
    new WatcherFeedTransportError('TIMEOUT'),
    new WatcherFeedTransportError('REDIRECT'),
    new Error('SECRET'),
  ])('freezes checkpoint and sanitizes transport failures', async (error) => {
    const result = await ingestWatcherFeed({
      ...base,
      transport: {
        fetchFeed: async () => {
          throw error;
        },
      },
    });
    expect(result.checkpoint).toEqual(checkpoint);
    expect(result.checkpointAdvanced).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result.status).toBe('FAILED');
  });
  it('returns retry scheduling metadata without advancing checkpoint', async () => {
    const result = await ingestWatcherFeed({
      ...base,
      transport: {
        fetchFeed: async () => ({ status: 'RETRY', httpStatus: 429, retryAfterMs: 60_000 }),
      },
    });
    expect(result.retryAfterMs).toBe(60_000);
    expect(result.checkpointAdvanced).toBe(false);
  });
  it.each(['<broken', xml.replace('Tue, 20 Oct 2026 09:00:00 -0300', 'bad-date')])(
    'freezes checkpoint on parser/item failure',
    async (body) => {
      const result = await ingestWatcherFeed({
        ...base,
        transport: { fetchFeed: async () => ({ ...ok, xml: body }) },
      });
      expect(result.checkpointAdvanced).toBe(false);
      expect(result.checkpoint).toEqual(checkpoint);
      expect(result.batch.failures.length).toBeGreaterThan(0);
    },
  );
  it('stages valid truncated items but freezes validators so a retry cannot skip them with 304', async () => {
    const result = await ingestWatcherFeed({
      ...base,
      parserOptions: { allowRelativeUrls: true, maxItems: 1 },
      transport: { fetchFeed: async () => ok },
    });
    expect(result.newItems).toHaveLength(1);
    expect(result.checkpoint).toEqual(checkpoint);
    expect(result.diagnostics.some((d) => d.code === 'ITEMS_TRUNCATED')).toBe(true);
  });
  it('preserves actual feed retrieval path/query and its relative document base', async () => {
    const feedUrl = source.feedUrl + '/?utm_source=required';
    const transport = {
      fetchFeed: vi.fn(async () => ({
        ...ok,
        xml: '<rss version="2.0"><channel><item><title>A</title><link>relative</link></item></channel></rss>',
      })),
    };
    const result = await ingestWatcherFeed({ ...base, source: { ...source, feedUrl }, transport });
    expect(transport.fetchFeed).toHaveBeenCalledWith(feedUrl, checkpoint, expect.any(Number));
    expect(result.newItems[0].item.url).toBe('https://auto.example.br/rss/relative');
  });
  it('rejects invalid caller scope before any network dispatch', async () => {
    const transport = { fetchFeed: vi.fn(async () => ok) };
    await expect(
      ingestWatcherFeed({ ...base, source: { ...source, enabled: false }, transport }),
    ).rejects.toThrow();
    await expect(
      ingestWatcherFeed({ ...base, observedAt: 'invalid', transport }),
    ).rejects.toThrow();
    expect(transport.fetchFeed).not.toHaveBeenCalled();
  });
  it('uses exact approved request URL with canonical stored identity and relative document base', async () => {
    const requestUrl = source.feedUrl + '/?utm_source=required';
    const transport = {
      fetchFeed: vi.fn(async () => ({
        ...ok,
        xml: '<rss version="2.0"><channel><item><title>A</title><link>relative</link></item></channel></rss>',
      })),
    };
    const result = await ingestWatcherFeed({ ...base, requestUrl, transport });
    expect(transport.fetchFeed).toHaveBeenCalledWith(requestUrl, checkpoint, expect.any(Number));
    expect(result.newItems[0].item.url).toBe('https://auto.example.br/rss/relative');
  });
  it('rejects a request URL with another identity before transport dispatch', async () => {
    const transport = { fetchFeed: vi.fn(async () => ok) };
    await expect(
      ingestWatcherFeed({ ...base, requestUrl: 'https://other.example.br/rss/', transport }),
    ).rejects.toThrow('WATCHER_INVALID_REQUEST_URL');
    expect(transport.fetchFeed).not.toHaveBeenCalled();
  });
  it('uses stored source settings and rejects competing request overrides before dispatch', async () => {
    const settings = {
      requestUrl: source.feedUrl + '/',
      allowedHosts: ['auto.example.br'],
      allowedArticleHosts: ['auto.example.br'],
      allowRelativeUrls: true,
      pollIntervalSeconds: 3600,
    };
    const transport = { fetchFeed: vi.fn(async () => ok) };
    await ingestWatcherFeed({ ...base, settings, transport });
    expect(transport.fetchFeed).toHaveBeenCalledWith(
      settings.requestUrl,
      checkpoint,
      expect.any(Number),
    );
    transport.fetchFeed.mockClear();
    await expect(
      ingestWatcherFeed({ ...base, settings, requestUrl: source.feedUrl, transport }),
    ).rejects.toThrow();
    expect(transport.fetchFeed).not.toHaveBeenCalled();
  });
});
