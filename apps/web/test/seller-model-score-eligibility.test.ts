import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadSellerModelScore } from '../src/server/seller-model-score-service';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@compra-car/adapter-supabase', () => ({
  createLegacySupabaseClientFromEnv: () => ({ from: fromMock }),
}));

const products: Array<Record<string, unknown>> = [
  { id: 10, brand: 'GWM', model: 'Ora 5', version: 'BEV', production_year: 2025, model_year: 2026, is_active: true, is_public: true },
  { id: 11, brand: 'GWM', model: 'Ora 5', version: 'BEV', production_year: 2026, model_year: 2027, is_active: true, is_public: true },
  { id: 12, brand: 'BYD', model: 'Atto 2', version: 'GS', production_year: 2026, model_year: 2027, is_active: true, is_public: true },
  { id: 13, brand: 'GWM', model: 'Tank', version: '300', production_year: 2026, model_year: 2027, is_active: false, is_public: true },
  { id: 14, brand: 'Jaecoo', model: '7', version: 'Elite', production_year: 2026, model_year: 2027, is_active: true, is_public: false },
];

function prepareDatabase() {
  const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
    products,
    vw_product_value_by_category: [
      { product_id: 11, category: 'Conforto', perceived_value: 50 },
      { product_id: 12, category: 'Conforto', perceived_value: 100 },
    ],
    specs: [],
  };

  fromMock.mockImplementation((table: string) => {
    if (!(table in rowsByTable)) throw new Error('Unexpected database table: ' + table);
    const filters: Array<[string, unknown]> = [];
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => {
        filters.push([field, value]);
        return query;
      },
      order: () => query,
      in: () => query,
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        const data = rowsByTable[table]!.filter(row => filters.every(([field, value]) => row[field] === value));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  });
}

describe('Compare Models catalog eligibility', () => {
  beforeEach(() => {
    fromMock.mockReset();
    prepareDatabase();
  });

  it('lists every active public latest version without querying prices', async () => {
    const result = await loadSellerModelScore(null, 5);

    expect(result.options.map(option => option.id)).toEqual([11, 12]);
    expect(result.selected).toBeNull();
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(['products']);
  });

  it('compares an unpriced vehicle using all eligible public peers', async () => {
    const result = await loadSellerModelScore(11, 5);

    expect(result.selected).toEqual({ id: 11, label: 'GWM Ora 5 BEV 2027' });
    expect(result.peerCount).toBe(2);
    expect(result.categories.find(category => category.key === 'Conforto')?.score).toBe(5);
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual([
      'products',
      'vw_product_value_by_category',
      'specs',
    ]);
  });

  it('never exposes inactive or private models in its public options', async () => {
    const result = await loadSellerModelScore(null, 5);

    expect(result.options.map(option => option.id)).not.toContain(13);
    expect(result.options.map(option => option.id)).not.toContain(14);
  });
});
