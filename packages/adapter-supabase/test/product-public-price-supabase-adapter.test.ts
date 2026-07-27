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
    });
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
      }),
    ).resolves.toEqual({ items: [], total: 0 });
    const failed = client({ data: null, error: { message: 'private detail' }, count: null });
    await expect(
      new ProductPublicPriceSupabaseAdapter(failed.supabase).listProductPublicPrices({
        limit: 25,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(PricingAdapterQueryError);
  });
});
