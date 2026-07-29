import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  ManualPriceBatchAuthorizationError,
  ManualPriceBatchConflictError,
  PricingAdapterMappingError,
  PricingAdapterQueryError,
} from '../src/errors';
import { ManualPriceBatchSupabaseAdapter } from '../src/manual-price-batch-supabase-adapter';

function rpcClient(result: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn(async () => result),
  } as unknown as SupabaseClient;
}

function listClient(result: { data: unknown; error: unknown }) {
  let orderCalls = 0;
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => {
      orderCalls += 1;
      return orderCalls === 5 ? Promise.resolve(result) : query;
    }),
  };
  return { supabase: { from: vi.fn(() => query) } as unknown as SupabaseClient, query };
}

const request = {
  rows: [
    {
      clientRowId: 'row-1',
      productId: '42',
      amount: '200000.07',
      startsOn: '2026-08-01',
      endsOn: null,
    },
  ],
  actorId: 'server-actor',
  correlationId: 'server-correlation',
};

describe('ManualPriceBatch Supabase adapter', () => {
  it('sends the explicit string-money payload only through the approved RPC and maps string IDs', async () => {
    const supabase = rpcClient({
      data: {
        batchId: 90,
        createdCount: 1,
        priceIds: [100],
        rows: [{ clientRowId: 'row-1', importRowId: 95, priceId: 100 }],
      },
      error: null,
    });
    await expect(
      new ManualPriceBatchSupabaseAdapter(supabase).createManualPriceBatch(request),
    ).resolves.toEqual({
      batchId: '90',
      createdCount: 1,
      priceIds: ['100'],
      rows: [{ clientRowId: 'row-1', importRowId: '95', priceId: '100' }],
    });
    expect(supabase.rpc).toHaveBeenCalledWith('create_manual_price_batch', {
      p_rows: request.rows,
      p_actor_id: 'server-actor',
      p_correlation_id: 'server-correlation',
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(typeof request.rows[0]!.amount).toBe('string');
    expect(request.rows[0]!.endsOn).toBeNull();
  });

  it('lists every administrative Product with a narrow mapping and no visibility filter', async () => {
    const target = listClient({
      data: [
        {
          id: 42,
          brand: 'BYD',
          model: 'Dolphin',
          version: 'GS',
          model_year: 2027,
          production_year: 2026,
          is_active: false,
          is_public: false,
        },
      ],
      error: null,
    });
    await expect(
      new ManualPriceBatchSupabaseAdapter(target.supabase).listProductOptions(),
    ).resolves.toEqual([
      {
        id: '42',
        brand: 'BYD',
        model: 'Dolphin',
        version: 'GS',
        modelYear: '2027',
        productionYear: '2026',
        isActive: false,
        isPublic: false,
      },
    ]);
    expect(target.supabase.from).toHaveBeenCalledWith('products');
    expect(target.query.select).toHaveBeenCalledWith(
      'id,brand,model,version,model_year,production_year,is_active,is_public',
    );
    expect(target.query).not.toHaveProperty('eq');
  });

  it('maps conflict row details and authorization failures without leaking raw errors', async () => {
    const conflict = rpcClient({
      data: null,
      error: { code: '23505', message: 'internal', details: '["row-1"]', hint: null },
    });
    const conflictResult = new ManualPriceBatchSupabaseAdapter(conflict).createManualPriceBatch(
      request,
    );
    await expect(conflictResult).rejects.toMatchObject({
      name: 'ManualPriceBatchConflictError',
      clientRowIds: ['row-1'],
    });
    await expect(conflictResult).rejects.toBeInstanceOf(ManualPriceBatchConflictError);

    const unauthorized = rpcClient({
      data: null,
      error: { code: '42501', message: 'profile detail', details: '', hint: null },
    });
    await expect(
      new ManualPriceBatchSupabaseAdapter(unauthorized).createManualPriceBatch(request),
    ).rejects.toBeInstanceOf(ManualPriceBatchAuthorizationError);
  });

  it('sanitizes unexpected RPC errors and rejects inconsistent result counts', async () => {
    const failed = rpcClient({
      data: null,
      error: { code: 'XX000', message: 'database secret detail', details: '', hint: null },
    });
    const failure = new ManualPriceBatchSupabaseAdapter(failed).createManualPriceBatch(request);
    await expect(failure).rejects.toBeInstanceOf(PricingAdapterQueryError);
    await expect(failure).rejects.not.toThrow('database secret detail');

    const inconsistent = rpcClient({
      data: {
        batchId: 1,
        createdCount: 2,
        priceIds: [2],
        rows: [{ clientRowId: 'row-1', importRowId: 3, priceId: 2 }],
      },
      error: null,
    });
    await expect(
      new ManualPriceBatchSupabaseAdapter(inconsistent).createManualPriceBatch(request),
    ).rejects.toBeInstanceOf(PricingAdapterMappingError);
  });
});
