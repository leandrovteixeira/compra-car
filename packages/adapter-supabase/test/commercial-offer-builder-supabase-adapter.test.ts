import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { CommercialOfferBuilderSupabaseAdapter } from '../src';

describe('CommercialOfferBuilder Supabase adapter', () => {
  it('persists all combinations with one atomic batch RPC call', async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: { createdCount: 0, offers: [] }, error: null })),
    } as unknown as SupabaseClient;
    await expect(
      new CommercialOfferBuilderSupabaseAdapter(client).createCombinationBatch({
        rows: [{ clientRowId: 'row-1', productId: '42', policyIds: ['1', '2'] }],
        actorId: 'actor',
        correlationId: 'corr',
      }),
    ).resolves.toEqual({ createdCount: 0, offers: [] });
    expect(client.rpc).toHaveBeenCalledWith('create_commercial_offer_batch_at_reference', {
      p_rows: [
        { clientRowId: 'row-1', productId: 42, policyIds: [1, 2], referenceDate: undefined },
      ],
      p_actor_id: 'actor',
      p_correlation_id: 'corr',
    });
  });
  it('deserializes an open-ended draft without inventing a date', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: {
          createdCount: 1,
          offers: [
            {
              offerId: 91,
              productId: 42,
              publicPriceId: 10,
              publicPriceAmount: '200000.00',
              validFrom: '2026-08-01',
              validTo: null,
              status: 'draft',
              policyIds: [1, 2],
              lockVersion: 1,
              benefitAmount: '1000.00',
              transactionalPrice: '199000.00',
            },
          ],
        },
        error: null,
      })),
    } as unknown as SupabaseClient;
    await expect(
      new CommercialOfferBuilderSupabaseAdapter(client).createCombinationBatch({
        rows: [{ clientRowId: 'row-1', productId: '42', policyIds: ['1', '2'] }],
        actorId: 'actor',
        correlationId: 'corr',
      }),
    ).resolves.toMatchObject({ offers: [{ validTo: null }] });
  });
  it('uses the commercial period RPC for an exact single-product interval', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: {
          createdOfferCount: 1,
          offers: [
            {
              offerId: 92,
              productId: 42,
              publicPriceId: 10,
              publicPriceAmount: '200000.00',
              validFrom: '2026-08-10',
              validTo: '2026-08-20',
              status: 'draft',
              policyIds: [1],
              lockVersion: 1,
              benefitAmount: '1000.00',
              transactionalPrice: '199000.00',
            },
          ],
        },
        error: null,
      })),
    } as unknown as SupabaseClient;
    await expect(
      new CommercialOfferBuilderSupabaseAdapter(client).createCombinationBatch({
        rows: [
          {
            clientRowId: 'row-1',
            productId: '42',
            policyIds: ['1'],
            referenceDate: '2026-08-10',
            periodEnd: '2026-08-20',
            periodKind: 'special',
          },
        ],
        actorId: 'actor',
        correlationId: 'corr',
      }),
    ).resolves.toMatchObject({ createdCount: 1, offers: [{ id: '92', validTo: '2026-08-20' }] });
    expect(client.rpc).toHaveBeenCalledWith('create_commercial_period_draft', {
      p_product_id: 42,
      p_period_start: '2026-08-10',
      p_period_end: '2026-08-20',
      p_period_kind: 'special',
      p_policy_rows: [],
      p_offer_rows: [{ clientRowId: 'row-1', policyRefs: [{ policyId: 1 }] }],
      p_expected_offers: [],
      p_actor_id: 'actor',
      p_correlation_id: 'corr',
    });
  });
  it('persists a validated draft only through the atomic domain RPC', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: {
          offerId: 90,
          productId: 42,
          publicPriceId: 10,
          publicPriceAmount: '200000.00',
          validFrom: '2026-08-01',
          validTo: '2026-08-31',
          status: 'draft',
          policyIds: [1, 2],
          lockVersion: 1,
          benefitAmount: '15000.03',
          transactionalPrice: '184999.97',
        },
        error: null,
      })),
    } as unknown as SupabaseClient;
    const adapter = new CommercialOfferBuilderSupabaseAdapter(client);
    await expect(
      adapter.createOfferDraft({
        actorId: 'actor',
        correlationId: 'correlation',
        offer: {
          productId: '42',
          publicPriceId: '10',
          validFrom: '2026-08-01',
          validTo: '2026-08-31',
          policyIds: ['1', '2'],
          benefitAmount: '15000.03',
          transactionalPrice: '184999.97',
        },
      }),
    ).resolves.toMatchObject({ id: '90', policyIds: ['1', '2'], status: 'draft' });
    expect(client.rpc).toHaveBeenCalledWith('create_commercial_offer_with_policies', {
      p_product_id: 42,
      p_public_price_id: 10,
      p_valid_from: '2026-08-01',
      p_valid_to: '2026-08-31',
      p_policy_ids: [1, 2],
      p_actor_id: 'actor',
      p_correlation_id: 'correlation',
    });
    expect(client).not.toHaveProperty('from');
  });

  it('normalizes numeric PostgREST money while listing published MSRP prices', async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      gt: vi.fn(() => query),
      order: vi.fn(async () => ({
        data: [
          {
            id: 10,
            product_id: 42,
            amount: 200000,
            starts_on: '2026-08-01',
            ends_on: null,
            status: 'published',
          },
        ],
        error: null,
      })),
    };
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;
    await expect(
      new CommercialOfferBuilderSupabaseAdapter(client).listPublishedPrices(),
    ).resolves.toEqual([
      {
        id: '10',
        productId: '42',
        amount: '200000.00',
        startsOn: '2026-08-01',
        endsOn: null,
        status: 'published',
      },
    ]);
  });
});
