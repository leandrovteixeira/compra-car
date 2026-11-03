import { describe, expect, it, vi } from 'vitest';
import {
  readWatcherCanonicalContext,
  type WatcherCanonicalReader,
} from '../src/watcher-intelligence-context-reader';

const brand = {
  id: 'id-1', market: 'BR', canonical_name: 'Volkswagen',
  canonical_key: 'volkswagen', status: 'ACTIVE',
};
const alias = {
  brand_identity_id: 'id-1', market: 'BR', alias: 'VW', status: 'CONFIRMED',
};
const mmv = {
  id: 'mmv-1', market: 'BR', brand: 'Volkswagen', model: 'Nivus',
  official_version_label: 'Sense', status: 'ACTIVE',
};
function client(tables: Record<string, unknown[]>, failing?: string) {
  const select = vi.fn();
  const eq = vi.fn();
  const from = vi.fn((name: string) => ({
    select: (columns: string) => {
      select(name, columns);
      return {
        eq: (column: string, value: string) => {
          eq(name, column, value);
          return Promise.resolve({
            data: tables[name] ?? [],
            error: name === failing ? { message: 'denied' } : null,
          });
        },
      };
    },
  }));
  return { reader: { from } as WatcherCanonicalReader, from, select, eq };
}
describe('Watcher canonical context QA reader', () => {
  it('reads approved identities, aliases and MMVs without write access', async () => {
    const { reader, eq, from } = client({
      brand_identities: [brand],
      brand_aliases: [alias],
      catalog_mmvs: [mmv],
    });
    const result = await readWatcherCanonicalContext(reader);
    expect(result.brands).toEqual([{
      id: 'id-1', market: 'BR', canonicalName: 'Volkswagen',
      canonicalKey: 'volkswagen', aliases: ['VW'],
    }]);
    expect(result.mmvs).toEqual([{
      id: 'mmv-1', market: 'BR', brand: 'Volkswagen',
      model: 'Nivus', officialVersionLabel: 'Sense',
    }]);
    expect(from).toHaveBeenCalledTimes(3);
    expect(eq).toHaveBeenCalledWith('brand_identities', 'status', 'ACTIVE');
    expect(eq).toHaveBeenCalledWith('brand_aliases', 'status', 'CONFIRMED');
    expect(eq).toHaveBeenCalledWith('catalog_mmvs', 'status', 'ACTIVE');
  });
  it('rejects query failure instead of accepting partial context', async () => {
    const { reader } = client({brand_identities: [brand]}, 'brand_aliases');
    await expect(readWatcherCanonicalContext(reader)).rejects.toThrow('WATCHER_CONTEXT_READ_FAILED');
  });
  it('rejects unresolvable confirmed aliases', async () => {
    const { reader } = client({brand_identities: [],brand_aliases: [alias]});
    await expect(readWatcherCanonicalContext(reader)).rejects.toThrow('WATCHER_CONTEXT_ORPHAN_ALIAS');
  });
  it('does not silently accept a potentially truncated result set', async () => {
    const { reader } = client({brand_identities: Array.from({length: 200},(_,i)=>({...brand,id:'id-'+i}))});
    await expect(readWatcherCanonicalContext(reader)).rejects.toThrow('WATCHER_CONTEXT_LIMIT_UNCERTAIN');
  });
  it('rejects malformed rows', async () => {
    const { reader } = client({brand_identities: [null]});
    await expect(readWatcherCanonicalContext(reader)).rejects.toThrow('WATCHER_CONTEXT_INVALID_ROWS');
  });
});
