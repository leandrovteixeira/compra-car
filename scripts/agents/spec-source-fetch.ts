import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import {
  officialEvidenceUrl,
  classifyDocumentSource,
  specTargetKey,
  type OfficialBrandSource,
  type SourceSnapshot,
  type SpecSourceTarget,
  type SpecSourceKind,
} from '@compra-car/core/agents';
export const SPEC_EXTRACTOR_VERSION = '21.4.0';
export interface SpecFetchAudit {
  url: string;
  status: number | null;
  finalHostname: string;
  contentType: string | null;
  bytes: number;
  redirect: string | null;
  error: string | null;
}
export function specOfficialUrl(raw: string, source: OfficialBrandSource): string | null {
  const safe = officialEvidenceUrl(raw, source);
  if (!safe) return null;
  const url = new URL(safe);
  if (
    isIP(url.hostname.replace(/^\[|\]$/gu, '')) ||
    url.hostname === 'localhost' ||
    /(?:^|[./_-])(media|press|imprensa|newsroom|dealer|concessionarias?)(?:[./_-]|$)/iu.test(
      url.hostname + url.pathname,
    ) ||
    [...url.searchParams.keys()].some(
      (key) => !['model', 'modelYear', 'year', 'version', 'trim', 'carline'].includes(key),
    )
  )
    return null;
  return safe;
}
/** Plain public GET. No retries, cookies, browser execution, login or challenge handling. */
export class SpecOfficialFetcher {
  readonly audit: SpecFetchAudit[] = [];
  constructor(
    private readonly transport: typeof fetch = fetch,
    private readonly timeoutMs = 10000,
    private readonly maxBytes = 2_000_000,
    private readonly maxPdfBytes = 25_000_000,
  ) {
    if (
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 15000 ||
      !Number.isInteger(maxBytes) ||
      maxBytes < 1 ||
      maxBytes > 4_000_000 ||
      !Number.isInteger(maxPdfBytes) ||
      maxPdfBytes < 1 ||
      maxPdfBytes > 25_000_000
    )
      throw new Error('INVALID_FETCH_LIMITS');
  }
  async fetch(
    raw: string,
    source: OfficialBrandSource,
    target: SpecSourceTarget,
    kind: SpecSourceKind = 'OFFICIAL_HTML',
  ) {
    if (classifyDocumentSource(raw) === 'OWNER_MANUAL') throw new Error('SOURCE_KIND_EXCLUDED');
    const initialUrl = specOfficialUrl(raw, source);
    if (!initialUrl) throw new Error('SOURCE_URL_NOT_ALLOWED');
    let url: string = initialUrl;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      for (let redirects = 0; redirects <= 2; redirects++) {
        if (classifyDocumentSource(url) === 'OWNER_MANUAL') throw new Error('SOURCE_KIND_EXCLUDED');
        const row: SpecFetchAudit = {
          url,
          status: null,
          finalHostname: new URL(url).hostname,
          contentType: null,
          bytes: 0,
          redirect: null,
          error: null,
        };
        this.audit.push(row);
        try {
          const response: Response = await this.transport(url, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: { Accept: 'text/html,application/json,application/pdf;q=0.8' },
          });
          row.status = response.status;
          row.contentType =
            response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? null;
          if (response.url && response.url !== url)
            throw new Error('UNEXPECTED_TRANSPORT_REDIRECT');
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            await response.body?.cancel();
            const location = response.headers.get('location');
            const next: string | null = location
              ? specOfficialUrl(new URL(location, url).href, source)
              : null;
            if (!next || redirects === 2) throw new Error('UNSAFE_REDIRECT');
            row.redirect = next;
            url = next;
            continue;
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new Error(
              [403, 429].includes(response.status)
                ? 'STRUCTURED_SOURCE_UNAVAILABLE'
                : 'SOURCE_HTTP_ERROR',
            );
          }
          if (
            ![
              'text/html',
              'application/xhtml+xml',
              'application/json',
              'application/ld+json',
              'application/pdf',
            ].includes(row.contentType ?? '')
          ) {
            await response.body?.cancel();
            throw new Error('UNSUPPORTED_CONTENT_TYPE');
          }
          const sizeLimit =
            row.contentType === 'application/pdf' ? this.maxPdfBytes : this.maxBytes;
          if (Number(response.headers.get('content-length') ?? 0) > sizeLimit) {
            await response.body?.cancel();
            throw new Error('SOURCE_TOO_LARGE');
          }
          const reader = response.body?.getReader();
          if (!reader) throw new Error('EMPTY_SOURCE');
          const chunks: Uint8Array[] = [];
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              row.bytes += value.byteLength;
              if (row.bytes > sizeLimit) throw new Error('SOURCE_TOO_LARGE');
              chunks.push(value);
            }
          } finally {
            await reader.cancel().catch(() => undefined);
            reader.releaseLock();
          }
          const bytes = Buffer.concat(chunks),
            body = bytes.toString('utf8');
          if (
            row.contentType !== 'application/pdf' &&
            /captcha|cf-chl-|verify you are human|access denied|akamai bot/iu.test(body)
          )
            throw new Error('STRUCTURED_SOURCE_UNAVAILABLE');
          const snapshot: SourceSnapshot = {
            sourceUrl: raw,
            finalUrl: url,
            sourceKind:
              row.contentType === 'application/pdf'
                ? kind === 'OFFICIAL_MANUAL'
                  ? 'OFFICIAL_MANUAL'
                  : 'OFFICIAL_PDF'
                : row.contentType?.includes('json')
                  ? 'OFFICIAL_JSON'
                  : kind,
            fetchedAt: new Date().toISOString(),
            contentType: row.contentType!,
            contentHash: createHash('sha256').update(bytes).digest('hex'),
            extractorVersion: SPEC_EXTRACTOR_VERSION,
            targetKey: specTargetKey(target),
          };
          return { snapshot, body, bytes };
        } catch (error) {
          row.error = controller.signal.aborted
            ? 'SOURCE_TIMEOUT'
            : error instanceof Error && /^[A-Z_]+$/u.test(error.message)
              ? error.message
              : 'SOURCE_FETCH_FAILED';
          throw new Error(row.error);
        }
      }
      throw new Error('UNSAFE_REDIRECT');
    } finally {
      clearTimeout(timer);
    }
  }
}
