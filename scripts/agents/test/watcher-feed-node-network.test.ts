import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), lookup: vi.fn() }));
vi.mock('node:https', () => ({ request: mocks.request }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
import { createWatcherFeedTransport, nodeWatcherFeedNetwork } from '../watcher-feed-transport';
describe('production network adapter with mocked Node I/O', () => {
  it('pins TCP lookup and TLS/SNI to distinct, appropriate values without a second DNS resolution', async () => {
    mocks.lookup
      .mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }])
      .mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    mocks.request.mockImplementation((target, options, callback) => {
      expect(target.hostname).toBe('auto.example.br');
      expect(options.servername).toBe(target.hostname);
      expect(options.rejectUnauthorized).toBe(true);
      expect(options.agent).toBe(false);
      expect(options.family).toBe(4);
      const resolve = vi.fn();
      options.lookup('ignored-rebinding.example.org', {}, resolve);
      expect(resolve).toHaveBeenCalledWith(null, '8.8.8.8', 4);
      const req = new EventEmitter() as EventEmitter & { end: () => void };
      req.end = () =>
        callback(
          Object.assign(Readable.from([Buffer.from('<rss/>')]), {
            statusCode: 200,
            headers: { 'content-type': 'application/rss+xml' },
          }),
        );
      return req;
    });
    const network = nodeWatcherFeedNetwork();
    const result = await createWatcherFeedTransport(network, {
      allowedHosts: ['auto.example.br'],
    }).fetchFeed('https://auto.example.br/rss', null, Date.parse('2026-10-25T00:00:00Z'));
    expect(result.status).toBe('OK');
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
});
