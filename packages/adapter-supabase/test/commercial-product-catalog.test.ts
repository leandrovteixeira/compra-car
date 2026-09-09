import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { LegacySupabaseAdapter } from '../src/legacy-supabase-adapter';

const row = (id: number) => ({
  id,
  brand: 'Jeep',
  model: 'Compass',
  version: 'Longitude',
  production_year: 2026,
  model_year: 2026,
  is_active: false,
  is_public: false,
});
const years = [{ productionYear: 2026, modelYear: 2026 }];

function fake(
  pages: readonly {
    data: readonly unknown[] | null;
    count: number | null;
    error: { message: string } | null;
  }[],
) {
  const calls: { table: string; operations: string[] }[] = [];
  const write = vi.fn(() => {
    throw new Error('Write forbidden');
  });
  const client = {
    rpc: write,
    from: (table: string) => {
      const call = { table, operations: [] as string[] };
      calls.push(call);
      const response = pages[calls.length - 1];
      const query = {
        select: (columns: string, options: { count: string }) => {
          call.operations.push(`select:${columns}:${options.count}`);
          return query;
        },
        in: (column: string, values: readonly number[]) => {
          call.operations.push(`in:${column}:${values.join(',')}`);
          return query;
        },
        gt: (column: string, id: number) => {
          call.operations.push(`gt:${column}:${id}`);
          return query;
        },
        order: (column: string) => {
          call.operations.push(`order:${column}`);
          return query;
        },
        limit: (limit: number) => {
          call.operations.push(`limit:${limit}`);
          return query;
        },
        abortSignal: () => Promise.resolve(response),
        insert: write,
        update: write,
        upsert: write,
        delete: write,
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { adapter: new LegacySupabaseAdapter(client), calls, write };
}

describe('read-only commercial catalog batch', () => {
  it('reuses bounded SELECT pagination for operator fallback without year filters or writes', async () => {
    const { adapter, calls, write } = fake([
      { data: [row(1)], count: 2, error: null },
      { data: [{ ...row(2), production_year: 2025 }], count: 1, error: null },
    ]);
    expect(await adapter.listOperatorMatchingProducts()).toHaveLength(2);
    expect(
      calls.every(
        (call) => call.table === 'products' && !call.operations.some((op) => op.startsWith('in:')),
      ),
    ).toBe(true);
    expect(calls[1]?.operations).toContain('gt:id:1');
    expect(write).not.toHaveBeenCalled();
  });
  it('reads only products once for a small scope and preserves duplicate identities and visibility flags', async () => {
    const { adapter, calls, write } = fake([{ data: [row(1), row(2)], count: 2, error: null }]);
    expect(await adapter.listCommercialResolutionProducts([...years, ...years])).toEqual(
      [1, 2].map((id) => ({
        id: String(id),
        brand: 'Jeep',
        model: 'Compass',
        version: 'Longitude',
        productionYear: 2026,
        modelYear: 2026,
        isActive: false,
        isPublic: false,
      })),
    );
    expect(calls).toEqual([
      {
        table: 'products',
        operations: [
          'select:id,brand,model,version,model_year,production_year,is_active,is_public:exact',
          'in:production_year:2026',
          'in:model_year:2026',
          'gt:id:-1',
          'order:id',
          'limit:500',
        ],
      },
    ]);
    expect(write).not.toHaveBeenCalled();
  });
  it('continues after a server-capped page using the last ID and exact remaining count', async () => {
    const { adapter, calls } = fake([
      { data: [row(1)], count: 2, error: null },
      { data: [row(2)], count: 1, error: null },
    ]);
    expect(await adapter.listCommercialResolutionProducts(years)).toHaveLength(2);
    expect(calls[1]?.operations).toContain('gt:id:1');
  });
  it('skips the database for empty year scope', async () => {
    const { adapter, calls } = fake([]);
    expect(await adapter.listCommercialResolutionProducts([])).toEqual([]);
    expect(calls).toEqual([]);
  });
  it.each([
    [{ data: [], count: null, error: null }],
    [{ data: [], count: 10001, error: null }],
    [{ data: [], count: 2, error: null }],
    [{ data: null, count: null, error: { message: 'unavailable' } }],
    [
      { data: [row(1)], count: 2, error: null },
      { data: [], count: 0, error: null },
    ],
    [
      { data: [row(1)], count: 2, error: null },
      { data: [row(1)], count: 1, error: null },
    ],
    [{ data: [{ ...row(1), brand: null }], count: 1, error: null }],
  ])('fails closed instead of returning a partial catalog: %j', async (...pages) => {
    const { adapter } = fake(pages);
    await expect(adapter.listCommercialResolutionProducts(years)).rejects.toThrow();
  });
});
