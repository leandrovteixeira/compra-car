import { Readable } from 'node:stream';
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import {
  createWatcherFeedTransport,
  isPublicWatcherAddress,
  watcherRetryAfter,
  type WatcherFeedNetwork,
  type WatcherFeedResponse,
} from '../watcher-feed-transport';
const url = 'https://auto.example.br/rss';
const now = Date.parse('2026-10-25T12:00:00Z');
const response = (
  status = 200,
  content: string | Buffer = '<rss/>',
  headers: Record<string, string | undefined> = {},
): WatcherFeedResponse => ({
  status,
  headers: { 'content-type': 'application/rss+xml; charset=utf-8', ...headers },
  body: Readable.from([Buffer.from(content)]),
});
const network = (request = vi.fn(async () => response())): WatcherFeedNetwork => ({
  resolve: vi.fn(async () => ['8.8.8.8']),
  request,
});
const transport = (net: WatcherFeedNetwork, options = {}) =>
  createWatcherFeedTransport(net, { allowedHosts: ['auto.example.br'], ...options });
const saved = {
  sourceId: 'source',
  etag: 'W/"version-1"',
  lastModified: 'Tue, 20 Oct 2026 12:00:00 GMT',
  lastSuccessfulObservedAt: '2026-10-20T12:00:00Z',
};
describe('offline feed HTTP safety', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '192.0.2.1',
    '198.51.100.2',
    '203.0.113.1',
    '198.18.1.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808',
    '2001:db8::1',
    '2001::1',
    '2002:0808:0808::1',
    'ff02::1',
    '3fff::1',
    '2001:20::1',
    'fe80::1%lo',
    'garbage',
  ])('blocks nonpublic DNS answer %s', async (address) => {
    expect(isPublicWatcherAddress(address)).toBe(false);
    const net = network();
    net.resolve = vi.fn(async () => [address]);
    await expect(transport(net).fetchFeed(url, null, now)).rejects.toThrow(
      'WATCHER_FEED_PRIVATE_DNS',
    );
    expect(net.request).not.toHaveBeenCalled();
  });
  it('accepts public v4/v6 and pins the selected address without a second DNS lookup', async () => {
    expect(isPublicWatcherAddress('192.1.1.1')).toBe(true);
    expect(isPublicWatcherAddress('2606:4700:4700::1111')).toBe(true);
    const net = network();
    const feed = transport(net);
    expect(await feed.fetchFeed(url, null, now)).toMatchObject({ status: 'OK', xml: '<rss/>' });
    expect(net.resolve).toHaveBeenCalledTimes(1);
    expect(net.request).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ address: '8.8.8.8', signal: expect.any(AbortSignal) }),
    );
  });
  it('blocks mixed DNS results and empty resolutions', async () => {
    for (const addresses of [[], ['8.8.8.8', '127.0.0.1']]) {
      const net = network();
      net.resolve = vi.fn(async () => addresses);
      await expect(transport(net).fetchFeed(url, null, now)).rejects.toThrow(
        'WATCHER_FEED_PRIVATE_DNS',
      );
      expect(net.request).not.toHaveBeenCalled();
    }
  });
  it.each([
    'http://auto.example.br/rss',
    'https://evil.example.org/rss',
    'https://sub.auto.example.br/rss',
    'https://u:p@auto.example.br/rss',
    'https://auto.example.br:8443/rss',
    'https://127.0.0.1/rss',
    'https://localhost/rss',
    'https://auto.example.br/r\nss',
  ])('rejects unsafe or nonallowlisted URL %s', async (unsafe) => {
    const net = network();
    await expect(transport(net).fetchFeed(unsafe, null, now)).rejects.toThrow(
      'WATCHER_FEED_UNSAFE_URL',
    );
    expect(net.resolve).not.toHaveBeenCalled();
  });
  it('preserves actual retrieval path/query rather than using article identity canonicalization', async () => {
    const net = network();
    await transport(net).fetchFeed(url + '/?utm_source=required&key=1#anchor', null, now);
    expect(net.request).toHaveBeenCalledWith(
      url + '/?utm_source=required&key=1',
      expect.anything(),
    );
  });
  it.each([301, 302, 307, 308])('does not follow redirect %i', async (status) => {
    const net = network(vi.fn(async () => response(status, '', { location: 'http://127.0.0.1/' })));
    await expect(transport(net).fetchFeed(url, null, now)).rejects.toThrow('WATCHER_FEED_REDIRECT');
    expect(net.request).toHaveBeenCalledTimes(1);
  });
  it('sends conditionals, accepts 304 without reading body and retains missing validators', async () => {
    const res = response(304, '', { etag: 'W/"v2"' });
    const net = network(vi.fn(async () => res));
    expect(await transport(net).fetchFeed(url, saved, now)).toEqual({
      status: 'NOT_MODIFIED',
      etag: 'W/"v2"',
      lastModified: saved.lastModified,
    });
    expect(net.request).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: expect.objectContaining({
          'if-none-match': saved.etag,
          'if-modified-since': saved.lastModified,
        }),
      }),
    );
    expect(res.body.destroyed).toBe(true);
  });
  it('rejects 304 without a previously successful conditional checkpoint', async () => {
    const net = network(vi.fn(async () => response(304)));
    await expect(transport(net).fetchFeed(url, null, now)).rejects.toThrow(
      'WATCHER_FEED_INVALID_RESPONSE',
    );
    await expect(
      transport(net).fetchFeed(url, { ...saved, lastSuccessfulObservedAt: null }, now),
    ).rejects.toThrow('WATCHER_FEED_INVALID_RESPONSE');
  });
  it.each([429, 500, 503])(
    'returns bounded retry metadata without retrying HTTP %i',
    async (status) => {
      const net = network(vi.fn(async () => response(status, '', { 'retry-after': '60' })));
      expect(await transport(net).fetchFeed(url, null, now)).toEqual({
        status: 'RETRY',
        httpStatus: status,
        retryAfterMs: 60_000,
      });
      expect(net.request).toHaveBeenCalledTimes(1);
    },
  );
  it('parses Retry-After seconds/dates and clamps past or excessive waits', () => {
    expect(watcherRetryAfter('Sun, 25 Oct 2026 12:01:00 GMT', now)).toBe(60_000);
    expect(watcherRetryAfter('Sun, 25 Oct 2026 11:00:00 GMT', now)).toBe(0);
    expect(watcherRetryAfter('99999999999999', now)).toBe(86_400_000);
    expect(watcherRetryAfter('garbage', now)).toBeNull();
  });
  it.each(['gzip', 'deflate', 'br'])(
    'decodes %s and enforces decompressed bounds',
    async (encoding) => {
      const compress =
        encoding === 'gzip' ? gzipSync : encoding === 'br' ? brotliCompressSync : deflateSync;
      const net = network(
        vi.fn(async () =>
          response(200, compress(Buffer.from('<rss/>')), { 'content-encoding': encoding }),
        ),
      );
      expect(await transport(net).fetchFeed(url, null, now)).toMatchObject({ xml: '<rss/>' });
      const bomb = network(
        vi.fn(async () =>
          response(200, compress(Buffer.from('x'.repeat(2 * 1024 * 1024 + 1))), {
            'content-encoding': encoding,
          }),
        ),
      );
      await expect(transport(bomb).fetchFeed(url, null, now)).rejects.toThrow(
        'WATCHER_FEED_LIMIT_EXCEEDED',
      );
    },
  );
  it('enforces uncompressed streaming limits independent of Content-Length', async () => {
    const net = network(vi.fn(async () => response(200, '12345', { 'content-length': '1' })));
    expect(await transport(net, { maxBytes: 5 }).fetchFeed(url, null, now)).toMatchObject({
      xml: '12345',
    });
    await expect(transport(net, { maxBytes: 4 }).fetchFeed(url, null, now)).rejects.toThrow(
      'WATCHER_FEED_LIMIT_EXCEEDED',
    );
  });
  it('times out queue, DNS, response and stalled body, even when injected I/O ignores cancellation', async () => {
    for (const phase of ['DNS', 'RESPONSE', 'BODY']) {
      const net = network();
      if (phase === 'DNS') net.resolve = () => new Promise(() => undefined);
      if (phase === 'RESPONSE') net.request = () => new Promise(() => undefined);
      if (phase === 'BODY')
        net.request = async () => ({ ...response(), body: new Readable({ read() {} }) });
      await expect(transport(net, { timeoutMs: 10 }).fetchFeed(url, null, now)).rejects.toThrow(
        'WATCHER_FEED_TIMEOUT',
      );
    }
  });
  it('limits per-host concurrency and includes queue waiting in the global timeout', async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const net = network(
        vi.fn(async () => {
          await blocked;
          return response();
        }),
      );
      const feed = transport(net, { timeoutMs: 20 });
      const one = expect(feed.fetchFeed(url, null, now)).rejects.toThrow('WATCHER_FEED_TIMEOUT');
      const two = expect(feed.fetchFeed(url, null, now)).rejects.toThrow('WATCHER_FEED_TIMEOUT');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(net.request).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(20);
      await Promise.all([one, two]);
      expect(net.request).toHaveBeenCalledTimes(1);
      release();
      await expect(feed.fetchFeed(url, null, now)).resolves.toMatchObject({ status: 'OK' });
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([
    { 'content-type': 'text/html' },
    { 'content-type': 'application/xml; charset=iso-8859-1' },
    { 'content-encoding': 'unknown' },
  ])('rejects unsupported representation %j', async (headers) => {
    await expect(
      transport(network(vi.fn(async () => response(200, '<rss/>', headers)))).fetchFeed(
        url,
        null,
        now,
      ),
    ).rejects.toThrow('WATCHER_FEED_INVALID_RESPONSE');
  });
  it('normalizes bad UTF-8, compression errors and raw network errors without leaking secrets', async () => {
    for (const res of [
      response(200, Buffer.from([0xff])),
      response(200, 'not-gzip', { 'content-encoding': 'gzip' }),
    ]) {
      await expect(
        transport(network(vi.fn(async () => res))).fetchFeed(url, null, now),
      ).rejects.toThrow('WATCHER_FEED_INVALID_RESPONSE');
    }
    const net = network();
    net.request = async () => {
      throw new Error('secret-key');
    };
    await expect(transport(net).fetchFeed(url, null, now)).rejects.toThrow(
      'WATCHER_FEED_UNAVAILABLE',
    );
  });
  it('preserves a slash-required endpoint and still refuses its redirect without following', async () => {
    const exact = url + '/';
    const request = vi.fn(async (received: string) =>
      received === exact ? response() : response(301, '', { location: exact }),
    );
    const feed = transport({ resolve: vi.fn(async () => ['8.8.8.8']), request });
    expect(await feed.fetchFeed(exact, null, now)).toMatchObject({ status: 'OK' });
    await expect(feed.fetchFeed(url, null, now)).rejects.toThrow('WATCHER_FEED_REDIRECT');
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map((args) => args[0])).toEqual([exact, url]);
  });
});
