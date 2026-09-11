import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVehicleId } from '@compra-car/core';

type Row = Record<string, unknown>;
type QueryCall = { table: string; filters: [string, unknown][]; payload?: Row };
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  calls: [] as QueryCall[],
  writeError: false,
  beforeWrite: undefined as (() => void) | undefined,
  authorize: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cache: new Map<string, { tags: string[]; value: unknown }>(),
  client: {} as { from: (table: string) => unknown },
}));

// Execute the real adapter and application against a deterministic, in-memory query boundary.
class Query {
  private predicates: ((row: Row) => boolean)[] = [];
  private call: QueryCall;
  private embeddedEligibility = false;
  private offset = 0;
  private pageSize = 1000;
  constructor(private table: string) {
    this.call = { table, filters: [] };
    state.calls.push(this.call);
  }
  select(columns: string) {
    this.embeddedEligibility = columns.includes('specs!inner(id)');
    return this;
  }
  range(from: number, to: number) {
    this.offset = from;
    this.pageSize = Math.min(1000, to - from + 1);
    return this;
  }
  order() {
    return this;
  }
  eq(field: string, value: unknown) {
    this.call.filters.push([field, value]);
    this.predicates.push((row) => {
      if (field === 'specs.is_active') {
        return (
          this.embeddedEligibility &&
          (state.tables.specs ?? []).some(
            (spec) => spec.id === row.equipment_id && spec.is_active === value,
          )
        );
      }
      return row[field] === value;
    });
    return this;
  }
  neq(field: string, value: unknown) {
    this.predicates.push((row) => row[field] !== value);
    return this;
  }
  in(field: string, values: unknown[]) {
    this.predicates.push((row) => values.includes(row[field]));
    return this;
  }
  update(payload: Row) {
    this.call.payload = payload;
    return this;
  }
  private result() {
    if (this.call.payload) state.beforeWrite?.();
    const data = (state.tables[this.table] ?? []).filter((row) =>
      this.predicates.every((test) => test(row)),
    );
    if (this.call.payload && state.writeError)
      return { data: null, error: { code: 'XX000', message: 'private database detail' } };
    if (this.call.payload) for (const row of data) Object.assign(row, this.call.payload);
    return { data: data.slice(this.offset, this.offset + this.pageSize), error: null };
  }
  async maybeSingle() {
    const result = this.result();
    return { ...result, data: result.data?.[0] ?? null };
  }
  then(resolve: (value: ReturnType<Query['result']>) => unknown) {
    return Promise.resolve(this.result()).then(resolve);
  }
}

vi.mock('@compra-car/adapter-supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@compra-car/adapter-supabase')>();
  return {
    ...actual,
    createLegacySupabaseClientFromEnv: () => state.client,
    LegacySupabaseAdapter: class extends actual.LegacySupabaseAdapter {
      constructor() {
        super(state.client as never);
      }
    },
  };
});
vi.mock('../src/auth/authorization', () => ({ requireRole: state.authorize }));
vi.mock('next/cache', () => ({
  revalidatePath: state.revalidatePath,
  revalidateTag: state.revalidateTag,
  unstable_cache:
    (read: (...args: unknown[]) => Promise<unknown>, key: string[], options: { tags: string[] }) =>
    async (...args: unknown[]) => {
      const cacheKey = JSON.stringify([key, args]);
      const cached = state.cache.get(cacheKey);
      if (cached) return cached.value;
      const value = await read(...args);
      state.cache.set(cacheKey, { tags: options.tags, value });
      return value;
    },
}));

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import {
  getCachedCatalogVehicles,
  getCachedVehicles,
  CATALOG_CACHE_TAGS,
} from '../src/server/catalog-cache';
import { loadSellerModelScore } from '../src/server/seller-model-score-service';
import { updateAdminProductStatusAction } from '../src/app/admin/products/actions';
import { executeAdminProductUpdate } from '../src/server/update-admin-product';

function product(id: number, overrides: Row = {}): Row {
  return {
    id,
    brand: 'BYD',
    model: 'Dolphin',
    version: `V${id}`,
    production_year: 2026,
    model_year: 2027,
    is_active: true,
    is_public: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  state.calls = [];
  state.cache.clear();
  state.writeError = false;
  state.beforeWrite = undefined;
  state.client = { from: (table) => new Query(table) };
  state.tables = {
    products: [
      product(1),
      product(2),
      product(3, { is_public: false }),
      product(4, { is_active: false, is_public: false }),
    ],
    vw_current_product_public_prices: [1, 2, 3, 4].map((id) => ({
      product_id: id,
      amount: 100000,
    })),
    product_specs: [1, 2, 3, 4].map((id) => ({
      product_id: id,
      equipment_id: 10,
      value: null,
      is_present: true,
      input_unit: null,
    })),
    specs: [
      {
        id: 10,
        code: 'SF_0001',
        type: 'binary',
        group_name: 'Safety',
        equipment_group: 'Safety',
        spec_set: 'Safety',
        detail: 'Safety',
        unit: null,
        value_direction: null,
        is_active: true,
      },
    ],
    vw_product_value_by_category: [1, 2, 3, 4].map((id) => ({
      product_id: id,
      category: 'Performance',
      perceived_value: id * 100,
    })),
  };
  state.revalidateTag.mockImplementation((tag: string) => {
    for (const [key, entry] of state.cache) if (entry.tags.includes(tag)) state.cache.delete(key);
  });
});

describe('seller publication and generation boundaries', () => {
  it('Compare includes both public states and rejects both private states, including direct URLs', async () => {
    // Read-side defense: visibility stays Public-only even if old inconsistent data is supplied.
    state.tables.products![1]!.is_active = false;
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1', '2']);
    expect(
      (
        await new LegacySupabaseAdapter().getVehiclesByIds(
          [1, 2, 3, 4].map((id) => createVehicleId(String(id))),
        )
      ).map((p) => p.id),
    ).toEqual(['1', '2']);
    for (const query of state.calls.filter((call) => call.table === 'products')) {
      expect(query.filters).toContainEqual(['is_public', true]);
      expect(query.filters).not.toContainEqual(['is_active', true]);
    }
  });

  it('Compare still requires an association with an active spec', async () => {
    state.tables.specs![0]!.is_active = false;
    expect(await getCachedCatalogVehicles()).toEqual([]);
  });

  it('Compare applies latest after active-spec eligibility and does not require a price', async () => {
    state.tables.products = [
      product(1, { version: 'GS' }),
      product(2, { version: 'GS', model_year: 2028, production_year: 2027 }),
    ];
    state.tables.product_specs = [{ product_id: 1, equipment_id: 10 }];
    state.tables.vw_current_product_public_prices = [];
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1']);
    expect((await getCachedVehicles('BYD', 'Dolphin')).map((p) => p.id)).toEqual(['1']);
  });

  it('Ver Modelo uses Public for options, selected product and peer scores, keeping current prices', async () => {
    const result = await loadSellerModelScore(2, 5);
    expect(result.options.map((p) => p.id)).toEqual([1, 2]);
    expect(result.selected?.id).toBe(2);
    expect(result.peerCount).toBe(2);
    expect(result.categories.find((c) => c.key === 'Performance')?.score).toBe(10);
    for (const id of [3, 4]) expect((await loadSellerModelScore(id, 5)).selected).toBeNull();
    const query = state.calls.find((call) => call.table === 'products')!;
    expect(query.filters).toContainEqual(['is_public', true]);
    expect(query.filters).not.toContainEqual(['is_active', true]);
    state.tables.vw_current_product_public_prices = [];
    expect((await loadSellerModelScore(1, 5)).options).toEqual([]);
  });

  it('keeps public Dolphin GS 2026/2027 when the 2027/2028 generation is private in both seller screens', async () => {
    state.tables.products = [
      product(1, { version: 'GS' }),
      product(2, { version: 'GS', production_year: 2027, model_year: 2028, is_public: false }),
    ];
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1']);
    expect((await getCachedVehicles('BYD', 'Dolphin')).map((p) => p.id)).toEqual(['1']);
    expect((await loadSellerModelScore(1, 5)).options.map((p) => p.id)).toEqual([1]);
  });

  it('Ver Modelo filters current prices before choosing the latest public generation', async () => {
    state.tables.products = [
      product(1, { version: 'GS' }),
      product(2, { version: 'GS', production_year: 2027, model_year: 2028 }),
    ];
    state.tables.vw_current_product_public_prices = [{ product_id: 1, amount: 100000 }];
    expect((await loadSellerModelScore(1, 5)).options.map((p) => p.id)).toEqual([1]);
  });
});

describe('admin status persistence and catalog invalidation', () => {
  it('recomputes latest immediately when the future generation is published and made private again', async () => {
    state.tables.products = [
      product(1, { version: 'GS' }),
      product(2, {
        version: 'GS',
        production_year: 2027,
        model_year: 2028,
        is_active: true,
        is_public: false,
      }),
    ];
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1']);
    await updateAdminProductStatusAction('2', { isPublic: true });
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['2']);
    expect((await loadSellerModelScore(2, 5)).options.map((p) => p.id)).toEqual([2]);
    await updateAdminProductStatusAction('2', { isPublic: false });
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1']);
    expect((await loadSellerModelScore(1, 5)).options.map((p) => p.id)).toEqual([1]);
    expect(state.tables.products[1]!.is_active).toBe(true);
  });

  it.each([
    [true, true, { isActive: false }, { is_active: false, is_public: false }],
    [true, false, { isActive: false }, { is_active: false, is_public: false }],
    [false, false, { isActive: true }, { is_active: true }],
    [true, false, { isPublic: true }, { is_public: true }],
    [true, true, { isPublic: false }, { is_public: false }],
  ] as const)(
    'atomically transitions Active=%s Public=%s with intent %j',
    async (isActive, isPublic, patch, persisted) => {
      state.tables.products![0] = product(1, { is_active: isActive, is_public: isPublic });
      const before = { ...state.tables.products![0] };
      expect(await updateAdminProductStatusAction('1', patch)).toEqual({ status: 'success' });
      const writes = state.calls.filter((call) => call.payload);
      expect(writes).toEqual([
        {
          table: 'products',
          filters:
            'isPublic' in patch && patch.isPublic
              ? [
                  ['id', 1],
                  ['is_active', true],
                ]
              : [['id', 1]],
          payload: { ...persisted, updated_at: expect.any(String) },
        },
      ]);
      expect(state.tables.products![0]).toEqual({
        ...before,
        ...persisted,
        updated_at: expect.any(String),
      });
      expect(state.authorize).toHaveBeenCalledExactlyOnceWith('admin');
      expect(state.revalidatePath).toHaveBeenCalledExactlyOnceWith('/admin/products');
      expect(state.revalidateTag).toHaveBeenCalledTimes(
        'isPublic' in patch || patch.isActive === false ? 1 : 0,
      );
    },
  );

  it('immediately removes and restores a public active product in warmed seller catalogs', async () => {
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1', '2']);
    expect((await getCachedVehicles('BYD', 'Dolphin')).map((p) => p.id)).toEqual(['1', '2']);
    await updateAdminProductStatusAction('2', { isPublic: false });
    expect(state.revalidateTag).toHaveBeenCalledWith(CATALOG_CACHE_TAGS.all);
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1']);
    expect((await getCachedVehicles('BYD', 'Dolphin')).map((p) => p.id)).toEqual(['1']);
    expect((await loadSellerModelScore(2, 5)).selected).toBeNull();
    await updateAdminProductStatusAction('2', { isPublic: true });
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1', '2']);
    expect((await loadSellerModelScore(2, 5)).selected?.id).toBe(2);
  });

  it.each(['already inactive', 'concurrently deactivated'])(
    'rejects publication when %s at write time',
    async (mode) => {
      state.tables.products![0] = product(1, {
        is_active: mode !== 'already inactive',
        is_public: false,
      });
      if (mode === 'concurrently deactivated')
        state.beforeWrite = () => {
          state.tables.products![0]!.is_active = false;
        };
      const result = await updateAdminProductStatusAction('1', { isPublic: true });
      expect(result).toMatchObject({
        status: 'error',
        message: expect.stringContaining('Ative o veículo antes de publicá-lo.'),
      });
      expect(state.tables.products![0]).toEqual(product(1, { is_active: false, is_public: false }));
      expect(state.calls).toHaveLength(1);
      expect(state.calls[0]!.filters).toContainEqual(['is_active', true]);
      expect(state.revalidateTag).not.toHaveBeenCalled();
      expect(state.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it('deactivation immediately unpublishes from warmed catalogs and reactivation never republishes', async () => {
    await getCachedCatalogVehicles();
    await getCachedVehicles('BYD', 'Dolphin');
    expect(await updateAdminProductStatusAction('2', { isActive: false })).toEqual({
      status: 'success',
    });
    expect(state.revalidateTag).toHaveBeenCalledExactlyOnceWith(CATALOG_CACHE_TAGS.all);
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1']);
    expect((await getCachedVehicles('BYD', 'Dolphin')).map((p) => p.id)).toEqual(['1']);
    expect((await loadSellerModelScore(2, 5)).selected).toBeNull();
    await updateAdminProductStatusAction('2', { isActive: true });
    expect(state.tables.products![1]).toMatchObject({ is_active: true, is_public: false });
    expect((await getCachedCatalogVehicles()).map((p) => p.id)).toEqual(['1']);
  });

  it.each([false, true])('full edit expires the same catalog for Public=%s', async (isPublic) => {
    await getCachedCatalogVehicles();
    const form = new FormData();
    for (const [key, value] of Object.entries({
      brand: 'BYD',
      model: 'Dolphin',
      version: 'V1',
      productionYear: '2026',
      modelYear: '2027',
      isActive: String(isPublic),
      isPublic: String(isPublic),
    }))
      form.set(key, value);
    expect((await executeAdminProductUpdate('1', form)).status).toBe('success');
    expect(state.revalidateTag).toHaveBeenCalledExactlyOnceWith(CATALOG_CACHE_TAGS.all);
    expect((await getCachedCatalogVehicles()).some((p) => p.id === '1')).toBe(isPublic);
  });

  it('requires admin before any database access', async () => {
    state.authorize.mockRejectedValue(new Error('forbidden'));
    await expect(updateAdminProductStatusAction('1', { isPublic: true })).rejects.toThrow(
      'forbidden',
    );
    expect(state.calls).toEqual([]);
    expect(state.revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    ['bad', { isPublic: true }],
    ['1', { isPublic: 'true' }],
    ['1', { isPublic: true, isActive: false }],
    ['1', { brand: 'changed' }],
  ])('rejects invalid requests without writing', async (id, patch) => {
    expect((await updateAdminProductStatusAction(id as string, patch as never)).status).toBe(
      'error',
    );
    expect(state.calls).toEqual([]);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(['missing', 'error'])(
    'reports %s without pretending success or expiring the catalog',
    async (mode) => {
      const before = structuredClone(state.tables.products);
      state.writeError = mode === 'error';
      const result = await updateAdminProductStatusAction(mode === 'missing' ? '999' : '1', {
        isPublic: false,
      });
      expect(result.status).toBe('error');
      expect(JSON.stringify(result)).not.toContain('private database detail');
      expect(state.tables.products).toEqual(before);
      expect(state.revalidateTag).not.toHaveBeenCalled();
      expect(state.revalidatePath).not.toHaveBeenCalled();
    },
  );
});
