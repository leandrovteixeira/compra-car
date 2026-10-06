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

function classifyChange(previous: SnapshotRow | null, current: SnapshotRow) {
  if (!previous) return 'FIRST_OBSERVATION' as const;
  if ((previous.http_status ?? 0) >= 400 && (current.http_status ?? 0) < 400)
    return 'SOURCE_RECOVERED' as const;
  if ((previous.http_status ?? 0) < 400 && (current.http_status ?? 0) >= 400)
    return 'SOURCE_UNAVAILABLE' as const;
  if (previous.http_status !== current.http_status)
    return 'HTTP_STATUS_CHANGED' as const;
  if (
    previous.normalized_sha256 &&
    current.normalized_sha256 &&
    previous.normalized_sha256 !== current.normalized_sha256
  )
    return 'CONTENT_CHANGED' as const;
  if (previous.etag && current.etag && previous.etag !== current.etag)
    return 'ETAG_CHANGED' as const;
  if (
    previous.last_modified &&
    current.last_modified &&
    previous.last_modified !== current.last_modified
  )
    return 'LAST_MODIFIED_CHANGED' as const;
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
      contentLength = length && /^d+$/u.test(length) ? Number(length) : null;

      if (status === 304 && previous) {
        rawHash = previous.content_sha256;
        normalizedHash = previous.normalized_sha256;
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
