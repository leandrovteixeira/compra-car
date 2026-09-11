import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { LegacySupabaseAdapter } from '../src/legacy-supabase-adapter';

type Row = Record<string, unknown>;

function cappedApi(tables: Record<string, Row[]>) {
  const calls: URL[] = [];
  const returnedAssociations: number[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const table = url.pathname.split('/').at(-1)!;
    const params = url.searchParams;
    let rows = tables[table] ?? [];
    for (const [field, filter] of params) {
      if (filter.startsWith('eq.') && !field.includes('.')) {
        rows = rows.filter((row) => String(row[field]) === filter.slice(3));
      }
      if (filter.startsWith('in.(')) {
        const values = filter.slice(4, -1).split(',');
        rows = rows.filter((row) => values.includes(String(row[field])));
      }
    }
    if (table === 'products' && params.get('select')?.includes('product_specs!inner')) {
      return new Response(
        JSON.stringify({
          code: 'PGRST200',
          message: 'No relationship from products to product_specs',
        }),
        { status: 400 },
      );
    }
    if (table === 'product_specs' && params.get('select')?.includes('specs!inner')) {
      const activeFilter = params.get('specs.is_active');
      rows = rows.flatMap((row) => {
        // Only equipment_id -> specs.id exists in the current database schema.
        const spec = tables.specs!.find(
          (item) =>
            item.id === row.equipment_id &&
            (!activeFilter || String(item.is_active) === activeFilter.slice(3)),
        );
        return spec ? [{ ...row, specs: { id: spec.id } }] : [];
      });
    }
    const order =
      params
        .get('order')
        ?.split(',')
        .map((column) => column.split('.')[0]!) ?? [];
    if (order.length)
      rows = [...rows].sort((a, b) => {
        for (const column of order) {
          const difference = Number(a[column]) - Number(b[column]);
          if (difference) return difference;
        }
        return 0;
      });
    // A plain product_specs query really truncates; the old implementation loses late products.
    const offset = Number(params.get('offset') ?? 0);
    const limit = Math.min(1000, Number(params.get('limit') ?? 1000));
    rows = rows.slice(offset, offset + limit);
    if (table === 'product_specs') returnedAssociations.push(rows.length);
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return {
    calls,
    returnedAssociations,
    client: createClient('https://catalog.test', 'test-key', {
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

function product(id: number, overrides: Row = {}): Row {
  return {
    id,
    brand: 'Toyota',
    model: 'Corolla Cross',
    version: `V${id}`,
    model_year: 2027,
    production_year: 2026,
    is_active: true,
    is_public: true,
    ...overrides,
  };
}

describe('Compare eligibility through the installed Supabase client with a 1000-row API cap', () => {
  it('returns late eligible products without a products relationship or a query per product', async () => {
    const tables = {
      products: [
        product(1),
        ...[615, 895, 896, 897].map((id) => product(id)),
        product(2, { is_public: false }),
        product(3),
        product(4),
      ],
      product_specs: [
        ...Array.from({ length: 1100 }, (_, i) => ({ product_id: 1, equipment_id: i + 1 })),
        ...[615, 895, 896, 897, 2].map((id) => ({ product_id: id, equipment_id: 1100 })),
        { product_id: 3, equipment_id: 1 },
      ],
      specs: Array.from({ length: 1100 }, (_, i) => ({ id: i + 1, is_active: i === 1099 })),
    };
    const api = cappedApi(tables);
    const truncated = await api.client.from('product_specs').select('product_id,equipment_id');
    expect(truncated.data).toHaveLength(1000);
    expect(truncated.data?.some((row) => row.product_id === 897)).toBe(false);
    api.calls.length = 0;
    api.returnedAssociations.length = 0;

    const result = await new LegacySupabaseAdapter(api.client).listPublicEligibleVehicles({
      brand: 'Toyota',
      model: 'Corolla Cross',
    });
    expect(result.map((row) => row.id)).toEqual(['1', '615', '895', '896', '897']);
    expect(api.calls).toHaveLength(2);
    expect(api.calls[0]!.pathname).toBe('/rest/v1/products');
    expect(api.calls[1]!.searchParams.get('select')).toBe('product_id,specs!inner(id)');
    expect(api.calls[1]!.searchParams.get('specs.is_active')).toBe('eq.true');
    expect(api.calls[1]!.searchParams.get('order')).toBe('product_id.asc,equipment_id.asc');
    expect(api.calls.every((url) => url.searchParams.get('limit') === '500')).toBe(true);
    expect(api.calls[0]!.searchParams.has('is_active')).toBe(false);
    expect(api.returnedAssociations).toEqual([5]);
  });

  it('pages all active associations and keeps the product beyond the first 2009 rows', async () => {
    const api = cappedApi({
      products: [product(1), product(2)],
      product_specs: [
        ...Array.from({ length: 2009 }, (_, i) => ({ product_id: 1, equipment_id: i + 1 })),
        { product_id: 2, equipment_id: 2009 },
      ],
      specs: Array.from({ length: 2009 }, (_, i) => ({ id: i + 1, is_active: true })),
    });
    expect(
      (await new LegacySupabaseAdapter(api.client).listPublicEligibleVehicles()).map(
        (row) => row.id,
      ),
    ).toEqual(['1', '2']);
    expect(api.calls).toHaveLength(6);
    expect(api.returnedAssociations).toEqual([500, 500, 500, 500, 10]);
    expect(api.calls.slice(1).map((url) => url.searchParams.get('offset'))).toEqual([
      '0',
      '500',
      '1000',
      '1500',
      '2000',
    ]);
    expect(
      api.calls.slice(1).every((url) => url.searchParams.get('product_id') === 'in.(1,2)'),
    ).toBe(true);
  });

  it('also pages public products beyond 1000 and bounds each IN batch', async () => {
    const api = cappedApi({
      products: Array.from({ length: 1001 }, (_, i) => product(i + 1)),
      product_specs: Array.from({ length: 1001 }, (_, i) => ({
        product_id: i + 1,
        equipment_id: 1,
      })),
      specs: [{ id: 1, is_active: true }],
    });
    const result = await new LegacySupabaseAdapter(api.client).listPublicEligibleVehicles();
    expect(result).toHaveLength(1001);
    expect(result.at(-1)!.id).toBe('1001');
    expect(api.calls).toHaveLength(6);
    expect(
      api.calls
        .filter((url) => url.pathname.endsWith('/products'))
        .map((url) => url.searchParams.get('offset')),
    ).toEqual(['0', '500', '1000']);
    expect(api.returnedAssociations).toEqual([500, 500, 1]);
    expect(
      api.calls
        .filter((url) => url.pathname.endsWith('/product_specs'))
        .every((url) => url.searchParams.get('product_id')!.split(',').length <= 500),
    ).toBe(true);
  });
});
