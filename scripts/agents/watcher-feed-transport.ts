import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import type { Readable, Transform } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import ipaddr from 'ipaddr.js';
import {
  canonicalArticleUrl,
  validateWatcherSourceCheckpoint,
  type WatcherSourceCheckpoint,
} from '@compra-car/core/agents';
import { FEED_MAX_BYTES } from './watcher-feed-parser';

export type WatcherFeedResponse = Readonly<{
  status: number;
  headers: Readonly<Record<string, string | undefined>>;
  body: Readable;
}>;
export interface WatcherFeedNetwork {
  resolve(host: string, signal: AbortSignal): Promise<readonly string[]>;
  /** MUST connect to address, preserve URL hostname for TLS/SNI and never follow redirects. */
  request(
    url: string,
    options: { address: string; headers: Readonly<Record<string, string>>; signal: AbortSignal },
  ): Promise<WatcherFeedResponse>;
}
export type WatcherFeedFetchResult =
  | Readonly<{ status: 'OK'; xml: string; etag: string | null; lastModified: string | null }>
  | Readonly<{ status: 'NOT_MODIFIED'; etag: string | null; lastModified: string | null }>
  | Readonly<{ status: 'RETRY'; httpStatus: number; retryAfterMs: number | null }>;
export class WatcherFeedTransportError extends Error {
  constructor(
    public readonly code:
      | 'UNSAFE_URL'
      | 'PRIVATE_DNS'
      | 'REDIRECT'
      | 'TIMEOUT'
      | 'LIMIT_EXCEEDED'
      | 'INVALID_RESPONSE'
      | 'UNAVAILABLE',
  ) {
    super('WATCHER_FEED_' + code);
  }
}
export function isPublicWatcherAddress(value: string): boolean {
  try {
    if (!isIP(value) || value.includes('%')) return false;
    const address = ipaddr.parse(value);
    // Exclude all library-classified special ranges, mapped/translated IPs and IPv6 outside global unicast.
    return (
      address.range() === 'unicast' &&
      (address.kind() === 'ipv4' || (address as ipaddr.IPv6).match(ipaddr.IPv6.parse('2000::'), 3))
    );
  } catch {
    return false;
  }
}

/** Real network adapter: connect only to validated address; normal certificate checks use the source hostname. */
export function nodeWatcherFeedNetwork(): WatcherFeedNetwork {
  return {
    async resolve(host) {
      return (await lookup(host, { all: true })).map((r) => r.address);
    },
    request(url, options) {
      return new Promise((resolve, reject) => {
        const target = new URL(url);
        if (target.protocol !== 'https:' || !isPublicWatcherAddress(options.address)) {
          reject(new WatcherFeedTransportError('UNSAFE_URL'));
          return;
        }
        const req = request(
          target,
          {
            method: 'GET',
            agent: false,
            family: isIP(options.address),
            signal: options.signal,
            servername: target.hostname,
            rejectUnauthorized: true,
            lookup: (_host, _options, callback) =>
              callback(null, options.address, isIP(options.address)),
            headers: options.headers,
          },
          (response) => {
            const headers: Record<string, string | undefined> = {};
            for (const [name, value] of Object.entries(response.headers))
              headers[name] = Array.isArray(value) ? value.join(',') : value;
            // Limit response headers at the Node HTTP parser too (default maxHeaderSize stays enabled).
            resolve({ status: response.statusCode ?? 0, headers, body: response });
          },
        );
        req.on('error', () =>
          reject(new WatcherFeedTransportError(options.signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE')),
        );
        req.end();
      });
    },
  };
}

/** Shared by calls using the same transport instance; timeout includes queueing, DNS, connect and body. */
export function createWatcherFeedTransport(
  network: WatcherFeedNetwork,
  options: {
    allowedHosts: readonly string[];
    timeoutMs?: number;
    maxBytes?: number;
    maxConcurrencyPerHost?: number;
  },
) {
  const maxBytes = options.maxBytes ?? FEED_MAX_BYTES,
    timeoutMs = options.timeoutMs ?? 15_000,
    concurrency = options.maxConcurrencyPerHost ?? 1;
  if (
    !Number.isInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > FEED_MAX_BYTES ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30_000 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 4 ||
    !options.allowedHosts.length
  )
    throw new Error('WATCHER_INVALID_TRANSPORT_OPTIONS');
  const hosts = new Set(
    options.allowedHosts.map((host) => {
      if (
        typeof host !== 'string' ||
        host !== host.toLowerCase() ||
        new URL(canonicalArticleUrl('https://' + host + '/')).hostname !== host
      )
        throw new Error('WATCHER_INVALID_HOST_ALLOWLIST');
      return host;
    }),
  );
  const active = new Map<string, number>(),
    queues = new Map<string, Array<() => void>>();
  const acquire = async (host: string, signal: AbortSignal) => {
    if ((active.get(host) ?? 0) >= concurrency) {
      await new Promise<void>((resolve, reject) => {
        const queue = queues.get(host) ?? [];
        const grant = () => {
          signal.removeEventListener('abort', abort);
          resolve();
        };
        const abort = () => {
          const index = queue.indexOf(grant);
          if (index >= 0) queue.splice(index, 1);
          reject(new WatcherFeedTransportError('TIMEOUT'));
        };
        if (queue.length >= 100) {
          reject(new WatcherFeedTransportError('LIMIT_EXCEEDED'));
          return;
        }
        queue.push(grant);
        queues.set(host, queue);
        signal.addEventListener('abort', abort, { once: true });
      });
    } else active.set(host, (active.get(host) ?? 0) + 1);
    return () => {
      const next = queues.get(host)?.shift();
      if (next) next();
      else {
        active.set(host, (active.get(host) ?? 1) - 1);
        if (!active.get(host)) {
          active.delete(host);
          queues.delete(host);
        }
      }
    };
  };
  return {
    async fetchFeed(
      url: string,
      checkpoint: WatcherSourceCheckpoint | null = null,
      nowMs: number,
    ): Promise<WatcherFeedFetchResult> {
      let canonical: string;
      try {
        canonical = canonicalArticleUrl(url);
      } catch {
        throw new WatcherFeedTransportError('UNSAFE_URL');
      }
      if (!canonical.startsWith('https://') || !hosts.has(new URL(canonical).hostname))
        throw new WatcherFeedTransportError('UNSAFE_URL');
      if (!Number.isFinite(nowMs)) throw new Error('WATCHER_INVALID_NOW');
      const requestUrl = new URL(url);
      requestUrl.hostname = new URL(canonical).hostname;
      requestUrl.hash = '';
      const saved = checkpoint ? validateWatcherSourceCheckpoint(checkpoint) : null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: WatcherFeedResponse | undefined, decoded: Readable | undefined;
      let release: (() => void) | undefined;
      const aborted = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => reject(new WatcherFeedTransportError('TIMEOUT')),
          { once: true },
        );
      });
      const operation = async (): Promise<WatcherFeedFetchResult> => {
        release = await acquire(new URL(canonical).hostname, controller.signal);
        if (controller.signal.aborted) throw new WatcherFeedTransportError('TIMEOUT');
        const addresses = await network.resolve(new URL(canonical).hostname, controller.signal);
        if (controller.signal.aborted) throw new WatcherFeedTransportError('TIMEOUT');
        if (!addresses.length || addresses.some((address) => !isPublicWatcherAddress(address)))
          throw new WatcherFeedTransportError('PRIVATE_DNS');
        const headers: Record<string, string> = {
          accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml',
          'accept-encoding': 'gzip,deflate,br',
          'user-agent': 'CompraCarWatcher/1.0',
        };
        if (saved?.etag) headers['if-none-match'] = saved.etag;
        if (saved?.lastModified) headers['if-modified-since'] = saved.lastModified;
        response = await network.request(requestUrl.toString(), {
          address: addresses[0],
          headers,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          response.body.destroy();
          throw new WatcherFeedTransportError('TIMEOUT');
        }
        const get = (name: string) => response!.headers[name];
        const validators = validateWatcherSourceCheckpoint({
          sourceId: saved?.sourceId ?? 'transport',
          etag: get('etag') ?? null,
          lastModified: get('last-modified') ?? null,
          lastSuccessfulObservedAt: null,
        });
        if (response.status === 304) {
          if (!saved?.lastSuccessfulObservedAt || (!saved.etag && !saved.lastModified))
            throw new WatcherFeedTransportError('INVALID_RESPONSE');
          return {
            status: 'NOT_MODIFIED',
            etag: validators.etag ?? saved.etag,
            lastModified: validators.lastModified ?? saved.lastModified,
          };
        }
        if (response.status >= 300 && response.status < 400)
          throw new WatcherFeedTransportError('REDIRECT');
        if (response.status === 429 || (response.status >= 500 && response.status <= 599))
          return {
            status: 'RETRY',
            httpStatus: response.status,
            retryAfterMs: watcherRetryAfter(get('retry-after'), nowMs),
          };
        if (response.status !== 200) throw new WatcherFeedTransportError('UNAVAILABLE');
        if (
          !/^(?:application\/(?:rss\+xml|atom\+xml|xml)|text\/xml)(?:\s*;|$)/iu.test(
            get('content-type') ?? '',
          )
        )
          throw new WatcherFeedTransportError('INVALID_RESPONSE');
        const charset = /charset\s*=\s*["']?([^;"'\s]+)/iu.exec(get('content-type') ?? '')?.[1];
        if (charset && !['utf-8', 'utf8', 'us-ascii'].includes(charset.toLowerCase()))
          throw new WatcherFeedTransportError('INVALID_RESPONSE');
        const encoding = get('content-encoding')?.trim().toLowerCase() ?? 'identity';
        decoded =
          encoding === 'identity'
            ? response.body
            : encoding === 'gzip'
              ? createGunzip()
              : encoding === 'deflate'
                ? createInflate()
                : encoding === 'br'
                  ? createBrotliDecompress()
                  : undefined;
        if (!decoded) throw new WatcherFeedTransportError('INVALID_RESPONSE');
        let compressedBytes = 0;
        const count = (chunk: Buffer) => {
          compressedBytes += chunk.length;
          if (compressedBytes > FEED_MAX_BYTES)
            decoded!.destroy(new WatcherFeedTransportError('LIMIT_EXCEEDED'));
        };
        response.body.on('data', count);
        if (decoded !== response.body) {
          response.body.on('error', (error) => decoded?.destroy(error));
          response.body.pipe(decoded as Transform);
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of decoded) {
          bytes += (chunk as Buffer).length;
          if (bytes > maxBytes) throw new WatcherFeedTransportError('LIMIT_EXCEEDED');
          chunks.push(Buffer.from(chunk));
        }
        if (!bytes) throw new WatcherFeedTransportError('INVALID_RESPONSE');
        return {
          status: 'OK',
          xml: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
          etag: validators.etag,
          lastModified: validators.lastModified,
        };
      };
      try {
        return await Promise.race([operation(), aborted]);
      } catch (error) {
        if (error instanceof WatcherFeedTransportError) throw error;
        throw new WatcherFeedTransportError(response ? 'INVALID_RESPONSE' : 'UNAVAILABLE');
      } finally {
        clearTimeout(timer);
        response?.body.destroy();
        decoded?.destroy();
        release?.();
      }
    },
  };
}
/** Retry metadata only, never automatic retry/sleep. Upper bound prevents unbounded scheduling. */
export function watcherRetryAfter(value: string | undefined, nowMs: number): number | null {
  if (!Number.isFinite(nowMs) || !value || value.length > 128) return null;
  if (/^\d+$/u.test(value)) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? Math.min(seconds * 1000, 86_400_000) : null;
  }
  if (
    !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/u.test(value)
  )
    return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.min(Math.max(0, time - nowMs), 86_400_000) : null;
}
