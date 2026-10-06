import { createHash } from 'node:crypto';
import type { LegacySupabaseClient } from '@compra-car/adapter-supabase';
import {
  BrandConnectorSupabaseAdapter,
} from '@compra-car/adapter-supabase/brand-connectors';

type SnapshotRow = {
  id: string;
  http_status: number | null;
  etag: string | null;
  last_modified: string | null;
  content_sha256: string | null;
  normalized_sha256: string | null;
};

export interface SourceMonitorResult {
  readonly checked: number;
  readonly baselined: number;
  readonly changed: number;
  readonly unavailable: number;
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeHtml(input: string): string {
  return input
    .replace(new RegExp('<!--[\\s\\S]*?-->', 'gu'), ' ')
    .replace(new RegExp('<script\\b[^>]*>[\\s\\S]*?<\\/script>', 'giu'), ' ')
    .replace(new RegExp('<style\\b[^>]*>[\\s\\S]*?<\\/style>', 'giu'), ' ')
    .replace(new RegExp('<svg\\b[^>]*>[\\s\\S]*?<\\/svg>', 'giu'), ' ')
    .replace(new RegExp('<noscript\\b[^>]*>[\\s\\S]*?<\\/noscript>', 'giu'), ' ')
    .replace(
      new RegExp(
        '\\s(?:nonce|integrity|crossorigin|data-reactroot|data-reactid)=("[^"]*"|\\\'[^\\\']*\\\'|[^\\s>]+)',
        'giu',
      ),
      ' ',
    )
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&#39;/giu, "'")
    .replace(/&quot;/giu, '"')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function latestSnapshot(client: LegacySupabaseClient, market: string, url: string) {
  const { data, error } = await client
    .from('agent_source_snapshots')
    .select('id,http_status,etag,last_modified,content_sha256,normalized_sha256')
    .eq('market', market)
    .eq('source_url', url)
    .order('observed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('SOURCE_MONITOR_SNAPSHOT_READ_FAILED');
  return (data as SnapshotRow | null) ?? null;
}

function effectiveStatusForNotModified(previous: SnapshotRow): number {
  if (previous.http_status === 304 || previous.http_status === null) return 200;
  return previous.http_status;
}

function classifyChange(previous: SnapshotRow | null, current: SnapshotRow) {
  if (!previous) return 'FIRST_OBSERVATION' as const;

  // 304 is an explicit server assertion that the previously observed representation
  // is still current. Never treat 200 -> 304 as a content/status change.
  if (current.http_status === 304) return null;

  const previousAvailable =
    previous.http_status !== null &&
    previous.http_status >= 200 &&
    previous.http_status < 400;
  const currentAvailable =
    current.http_status !== null &&
    current.http_status >= 200 &&
    current.http_status < 400;

  if (!previousAvailable && currentAvailable) return 'SOURCE_RECOVERED' as const;
  if (previousAvailable && !currentAvailable) return 'SOURCE_UNAVAILABLE' as const;

  if (
    previous.normalized_sha256 &&
    current.normalized_sha256 &&
    previous.normalized_sha256 !== current.normalized_sha256
  )
    return 'CONTENT_CHANGED' as const;

  // HTTP status changes inside the successful 2xx/3xx family are not meaningful
  // enough by themselves to wake expensive AI agents.
  if (
    previous.http_status !== current.http_status &&
    (!previousAvailable || !currentAvailable)
  )
    return 'HTTP_STATUS_CHANGED' as const;

  // ETag/Last-Modified are useful cache validators, but CDNs can rotate them without
  // a semantic page change. Keep them as snapshot metadata; do not escalate on them alone.
  return null;
}

export async function monitorBrandSources(
  client: LegacySupabaseClient,
  brand: string,
  market = 'BR',
): Promise<SourceMonitorResult> {
  const repository = new BrandConnectorSupabaseAdapter(client);
  const identity = await repository.resolveBrandIdentity(brand, market);
  const canonicalBrand = identity?.canonicalName ?? brand;
  const connector =
    (await repository.getActiveConnector(canonicalBrand, market)) ??
    (identity
      ? (
          await Promise.all(
            identity.aliases.map((alias) => repository.getActiveConnector(alias, market)),
          )
        ).find(Boolean) ?? null
      : null);

  if (!connector) throw new Error('BRAND_CONNECTOR_REQUIRED');

  const entries = [...new Map(connector.sourceEntries.map((entry) => [entry.url, entry])).values()];
  let baselined = 0;
  let changed = 0;
  let unavailable = 0;

  for (const entry of entries) {
    const previous = await latestSnapshot(client, market, entry.url);
    const headers = new Headers({
      'user-agent': 'CompraCarSourceMonitor/1.0',
      accept: 'text/html,application/json,text/plain,application/pdf;q=0.5,*/*;q=0.1',
    });
    if (previous?.etag) headers.set('if-none-match', previous.etag);
    if (previous?.last_modified) headers.set('if-modified-since', previous.last_modified);

    let status = 599;
    let etag: string | null = null;
    let lastModified: string | null = null;
    let contentLength: number | null = null;
    let rawHash: string | null = null;
    let normalizedHash: string | null = null;

    try {
      const response = await fetch(entry.url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
      });
      status = response.status;
      etag = response.headers.get('etag');
      lastModified = response.headers.get('last-modified');
      const length = response.headers.get('content-length');
      contentLength = length && /^\d+$/u.test(length) ? Number(length) : null;

      if (status === 304 && previous) {
        // 304 means the representation did not change. Persist the effective
        // application status/hash, never the transport cache-validation status.
        status = effectiveStatusForNotModified(previous);
        rawHash = previous.content_sha256;
        normalizedHash = previous.normalized_sha256;
        etag = etag ?? previous.etag;
        lastModified = lastModified ?? previous.last_modified;
        contentLength = null;
      } else {
        const contentType = response.headers.get('content-type') ?? '';
        const bytes = new Uint8Array(await response.arrayBuffer());
        rawHash = sha256(bytes);
        if (/text|html|json|xml|javascript/iu.test(contentType)) {
          const text = new TextDecoder().decode(bytes);
          normalizedHash = sha256(normalizeHtml(text));
        } else {
          normalizedHash = rawHash;
        }
      }
    } catch {
      unavailable++;
    }

    const { data: inserted, error: insertError } = await client
      .from('agent_source_snapshots')
      .insert({
        market,
        brand_identity_id: identity?.id ?? null,
        brand: canonicalBrand,
        source_url: entry.url,
        source_type: entry.type,
        http_status: status,
        etag,
        last_modified: lastModified,
        content_length: contentLength,
        content_sha256: rawHash,
        normalized_sha256: normalizedHash,
      })
      .select('id,http_status,etag,last_modified,content_sha256,normalized_sha256')
      .single();
    if (insertError || !inserted) throw new Error('SOURCE_MONITOR_SNAPSHOT_WRITE_FAILED');

    const current = inserted as SnapshotRow;
    const changeType = classifyChange(previous, current);
    if (!changeType) continue;

    const { error: eventError } = await client.from('agent_source_change_events').insert({
      market,
      brand_identity_id: identity?.id ?? null,
      brand: canonicalBrand,
      source_url: entry.url,
      source_type: entry.type,
      change_type: changeType,
      previous_snapshot_id: previous?.id ?? null,
      current_snapshot_id: current.id,
    });
    if (eventError) throw new Error('SOURCE_MONITOR_EVENT_WRITE_FAILED');

    if (changeType === 'FIRST_OBSERVATION') baselined++;
    else changed++;
  }

  return { checked: entries.length, baselined, changed, unavailable };
}
