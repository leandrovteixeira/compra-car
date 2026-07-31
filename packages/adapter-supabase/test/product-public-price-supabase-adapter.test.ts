import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { PricingAdapterMappingError, PricingAdapterQueryError } from '../src/errors';
import type { ProductPublicPriceRow } from '../src/pricing-dtos';
import { mapProductPublicPriceRow } from '../src/pricing-mappers';
import { ProductPublicPriceSupabaseAdapter } from '../src/product-public-price-supabase-adapter';

function row(overrides: Partial<ProductPublicPriceRow> = {}): ProductPublicPriceRow {
  return {
    id: 10,
    product_id: 20,
    amount: '159990.00',
    currency_code: 'BRL',
    starts_on: '2026-07-01',
    ends_on: null,
    status: 'published',
    published_at: '2026-07-01T12:00:00.000Z',
    created_at: '2026-06-30T12:00:00.000Z',
    updated_at: '2026-07-01T12:00:00.000Z',
    lock_version: 1,
    product: { id: 20, brand: 'Toyota', model: 'Corolla', version: 'XRX', model_year: 2026 },
    ...overrides,
  };
}

function client(result: { data: unknown; error: unknown; count: number | null }) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => result),
  };
  return { supabase: { from: vi.fn(() => query) } as unknown as SupabaseClient, query };
}

function writeClient(results: readonly { data: unknown; error: unknown }[]) {
  let terminal = 0;
  const query = {
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    single: vi.fn(async () => results[terminal++]),
    maybeSingle: vi.fn(async () => results[terminal++]),
  };
  return { supabase: { from: vi.fn(() => query) } as unknown as SupabaseClient, query };
}

describe('ProductPublicPrice Supabase adapter', () => {
  it('maps the physical row into the domain contract', () => {
    expect(mapProductPublicPriceRow(row())).toEqual({
      id: '10',
      product: { id: '20', brand: 'Toyota', model: 'Corolla', version: 'XRX', modelYear: '2026' },
      money: { amount: '159990.00', currencyCode: 'BRL' },
      startsOn: '2026-07-01',
      endsOn: null,
      status: 'published',
      publishedAt: '2026-07-01T12:00:00.000Z',
      createdAt: '2026-06-30T12:00:00.000Z',
      updatedAt: '2026-07-01T12:00:00.000Z',
      lockVersion: 1,
    });
  });

  it('creates a manual MSRP draft with server-owned actors', async () => {
    const target = writeClient([
      { data: row({ status: 'draft', published_at: null }), error: null },
    ]);
    await new ProductPublicPriceSupabaseAdapter(target.supabase).createProductPublicPrice({
      productId: '20',
      amount: '159990.00',
      startsOn: '2026-07-01',
      endsOn: null,
      actorId: 'actor-id',
    });
    expect(target.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 20,
        amount: '159990.00',
        status: 'draft',
        source_type: 'manual',
        price_type: 'msrp',
        created_by: 'actor-id',
        updated_by: 'actor-id',
      }),
    );
  });

  it('updates atomically by id, lock version and editable status', async () => {
    const target = writeClient([{ data: row({ status: 'draft', lock_version: 2 }), error: null }]);
    await expect(
      new ProductPublicPriceSupabaseAdapter(target.supabase).updateProductPublicPrice({
        id: '10',
        amount: '249990.50',
        startsOn: '2026-08-01',
        endsOn: null,
        expectedLockVersion: 1,
        actorId: 'actor-id',
      }),
    ).resolves.toMatchObject({ status: 'updated', price: { lockVersion: 2 } });
    expect(target.query.update).toHaveBeenCalledWith({
      amount: '249990.50',
      starts_on: '2026-08-01',
      ends_on: null,
      updated_by: 'actor-id',
    });
    expect(target.query.eq).toHaveBeenCalledWith('id', 10);
    expect(target.query.eq).toHaveBeenCalledWith('lock_version', 1);
    expect(target.query.in).toHaveBeenCalledWith('status', ['draft', 'needs_review', 'rejected']);
  });

  it('classifies zero-row updates without overwriting conflicts or terminal records', async () => {
    const conflict = writeClient([
      { data: null, error: null },
      { data: { status: 'draft', lock_version: 3 }, error: null },
    ]);
    await expect(
      new ProductPublicPriceSupabaseAdapter(conflict.supabase).updateProductPublicPrice({
        id: '10',
        amount: '1.00',
        startsOn: '2026-08-01',
        endsOn: null,
        expectedLockVersion: 1,
        actorId: 'actor-id',
      }),
    ).resolves.toEqual({ status: 'conflict' });
    const terminal = writeClient([
      { data: null, error: null },
      { data: { status: 'published', lock_version: 3 }, error: null },
    ]);
    await expect(
      new ProductPublicPriceSupabaseAdapter(terminal.supabase).updateProductPublicPrice({
        id: '10',
        amount: '1.00',
        startsOn: '2026-08-01',
        endsOn: null,
        expectedLockVersion: 1,
        actorId: 'actor-id',
      }),
    ).resolves.toEqual({ status: 'not_editable' });
  });

  it('rejects an absent or inconsistent related product', () => {
    expect(() => mapProductPublicPriceRow(row({ product: null }))).toThrow(
      PricingAdapterMappingError,
    );
  });

  it('lists a page with exact count and deterministic range', async () => {
    const target = client({ data: [row()], error: null, count: 1 });
    await expect(
      new ProductPublicPriceSupabaseAdapter(target.supabase).listProductPublicPrices({
        limit: 25,
        offset: 25,
        sort: 'updatedAt',
        direction: 'desc',
      }),
    ).resolves.toEqual({ items: [mapProductPublicPriceRow(row())], total: 1 });
    expect(target.supabase.from).toHaveBeenCalledWith('product_public_prices');
    expect(target.query.select).toHaveBeenCalledWith(expect.stringContaining('product:products!'), {
      count: 'exact',
    });
    expect(target.query.range).toHaveBeenCalledWith(25, 49);
  });

  it('returns an empty page and translates query failures', async () => {
    const empty = client({ data: [], error: null, count: 0 });
    await expect(
      new ProductPublicPriceSupabaseAdapter(empty.supabase).listProductPublicPrices({
        limit: 25,
        offset: 0,
        sort: 'updatedAt',
        direction: 'desc',
      }),
    ).resolves.toEqual({ items: [], total: 0 });
    const failed = client({ data: null, error: { message: 'private detail' }, count: null });
    await expect(
      new ProductPublicPriceSupabaseAdapter(failed.supabase).listProductPublicPrices({
        limit: 25,
        offset: 0,
        sort: 'updatedAt',
        direction: 'desc',
      }),
    ).rejects.toBeInstanceOf(PricingAdapterQueryError);
  });
});
