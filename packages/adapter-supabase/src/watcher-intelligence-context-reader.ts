import type { WatcherIntelligenceContext } from '@compra-car/core/agents';

/** Read-only, bounded Supabase data API capability; caller must inject a QA-guarded server client. */
export interface WatcherCanonicalReader {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): PromiseLike<{
        data: unknown;
        error: unknown;
      }>;
    };
  };
}
type RecordRow = Record<string, unknown>;
const MAX = { brands: 200, aliases: 1000, mmvs: 2000 };
function records(value: unknown, max: number): RecordRow[] {
  if (!Array.isArray(value) || value.length > max ||
      value.some((v) => !v || typeof v !== 'object' || Array.isArray(v)))
    throw new Error('WATCHER_CONTEXT_INVALID_ROWS');
  return value as RecordRow[];
}
function nonempty(value: unknown): string {
  if (typeof value !== 'string' || value.trim() !== value || !value)
    throw new Error('WATCHER_CONTEXT_INVALID_VALUE');
  return value;
}
async function read(
  client: WatcherCanonicalReader,
  table: 'brand_identities' | 'brand_aliases' | 'catalog_mmvs',
  columns: string,
  predicate: string,
  value: string,
  max: number,
) {
  const { data, error } = await client.from(table).select(columns).eq(predicate, value);
  if (error) throw new Error('WATCHER_CONTEXT_READ_FAILED');
  const rows = records(data, max);
  // No pagination available on this narrow capability. A full page may hide further rows.
  if (rows.length === max) throw new Error('WATCHER_CONTEXT_LIMIT_UNCERTAIN');
  return rows;
}

/**
 * Creates a reviewed-data-only context fragment, never an inferred brand/model.
 * SQL/API access and staging identity checks remain the caller's responsibility.
 * Source registrations must come from the Watcher repository, not this reader.
 */
export async function readWatcherCanonicalContext(
  client: WatcherCanonicalReader,
): Promise<Pick<WatcherIntelligenceContext, 'brands' | 'mmvs'>> {
  const [brands, aliases, mmvs] = await Promise.all([
    read(client, 'brand_identities', 'id,market,canonical_name,canonical_key,status', 'status', 'ACTIVE', MAX.brands),
    read(client, 'brand_aliases', 'brand_identity_id,market,alias,status', 'status', 'CONFIRMED', MAX.aliases),
    read(client, 'catalog_mmvs', 'id,market,brand,model,official_version_label,status', 'status', 'ACTIVE', MAX.mmvs),
  ]);
  const canonicalBrands = brands.filter((r) => r.market === 'BR').map((r) => ({
    id: nonempty(r.id),
    market: 'BR',
    canonicalName: nonempty(r.canonical_name),
    canonicalKey: nonempty(r.canonical_key),
    aliases: [] as string[],
  }));
  const byId = new Map(canonicalBrands.map((b) => [b.id, b]));
  if (byId.size !== canonicalBrands.length) throw new Error('WATCHER_CONTEXT_DUPLICATE_ID');
  for (const alias of aliases) {
    if (alias.market !== 'BR') continue;
    const brand = byId.get(nonempty(alias.brand_identity_id));
    if (!brand) throw new Error('WATCHER_CONTEXT_ORPHAN_ALIAS');
    brand.aliases.push(nonempty(alias.alias));
  }
  return {
    brands: canonicalBrands.map((b) => ({...b, aliases: [...new Set(b.aliases)].sort()})),
    mmvs: mmvs.filter((r) => r.market === 'BR').map((r) => ({
      id: nonempty(r.id),
      market: 'BR',
      brand: nonempty(r.brand),
      model: nonempty(r.model),
      officialVersionLabel: nonempty(r.official_version_label),
    })),
  };
}
