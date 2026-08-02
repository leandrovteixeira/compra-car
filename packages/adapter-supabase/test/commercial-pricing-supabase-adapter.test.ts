import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  CommercialPricingSupabaseAdapter,
  mapCommercialOfferRow,
  mapCommercialPolicyRow,
} from '../src/commercial-pricing-supabase-adapter';
import { PricingAdapterMappingError, PricingAdapterQueryError } from '../src/errors';

const context = {
  actorId: 'a9000000-0000-4000-8000-000000000001',
  correlationId: 'c9000000-0000-4000-8000-000000000001',
};

describe('Commercial Pricing Supabase adapter', () => {
  it('maps a Policy that belongs directly to a Product', () => {
    expect(
      mapCommercialPolicyRow({
        id: 11,
        product_id: 22,
        policy_type: 'free_maintenance',
        title: 'Maintenance',
        description: null,
        starts_on: '2026-08-01',
        ends_on: '2026-08-31',
        customer_benefit_amount: '3000.00',
        dealer_rebate_amount: '500.00',
        status: 'published',
        lock_version: 2,
      }),
    ).toEqual({
      id: '11',
      productId: '22',
      policyType: 'free_maintenance',
      title: 'Maintenance',
      description: null,
      startsOn: '2026-08-01',
      endsOn: '2026-08-31',
      customerBenefitAmount: '3000.00',
      dealerRebateAmount: '500.00',
      status: 'published',
      lockVersion: 2,
    });
  });

  it('maps an Offer with N:N memberships in deterministic order', () => {
    expect(
      mapCommercialOfferRow({
        id: 31,
        product_id: 22,
        public_price_id: 41,
        valid_from: '2026-08-01',
        valid_to: '2026-08-31',
        status: 'draft',
        lock_version: 3,
        public_price: { amount: '200000.00' },
        memberships: [{ commercial_policy_id: 13 }, { commercial_policy_id: 12 }],
      }),
    ).toMatchObject({
      id: '31',
      productId: '22',
      publicPriceAmount: '200000.00',
      policyIds: ['12', '13'],
      lockVersion: 3,
    });
  });

  it('links a Policy through the audited RPC with optimistic Offer locking', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        commercial_offer_id: 31,
        commercial_policy_id: 12,
        created_at: '2026-07-28T12:00:00.000Z',
        created_by: context.actorId,
      },
      error: null,
    }));
    const adapter = new CommercialPricingSupabaseAdapter({ rpc } as unknown as SupabaseClient);

    await expect(
      adapter.linkPolicyToOffer({
        offerId: '31',
        policyId: '12',
        expectedOfferLockVersion: 3,
        context,
      }),
    ).resolves.toMatchObject({ commercialOfferId: '31', commercialPolicyId: '12' });
    expect(rpc).toHaveBeenCalledWith('link_commercial_offer_policy', {
      p_offer_id: 31,
      p_policy_id: 12,
      p_actor_id: context.actorId,
      p_expected_offer_lock_version: 3,
      p_correlation_id: context.correlationId,
    });
  });

  it('publishes a Policy independently and maps the RPC snapshot', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        policy: {
          id: 12,
          product_id: 22,
          policy_type: 'retail_bonus',
          title: 'Bonus',
          description: null,
          starts_on: '2026-08-01',
          ends_on: '2026-08-31',
          customer_benefit_amount: '12000.00',
          status: 'published',
          lock_version: 2,
        },
      },
      error: null,
    }));
    const adapter = new CommercialPricingSupabaseAdapter({ rpc } as unknown as SupabaseClient);

    await expect(
      adapter.publishCommercialPolicy({ policyId: '12', expectedLockVersion: 1, context }),
    ).resolves.toMatchObject({ id: '12', status: 'published', lockVersion: 2 });
  });

  it('rejects invalid monetary rows and translates private RPC failures', async () => {
    expect(() =>
      mapCommercialPolicyRow({
        id: 11,
        product_id: 22,
        policy_type: 'retail_bonus',
        title: 'Bonus',
        description: null,
        starts_on: '2026-08-01',
        ends_on: null,
        customer_benefit_amount: '0.00',
        status: 'draft',
        lock_version: 1,
      }),
    ).toThrow(PricingAdapterMappingError);

    const rpc = vi.fn(async () => ({ data: null, error: { message: 'private database detail' } }));
    const adapter = new CommercialPricingSupabaseAdapter({ rpc } as unknown as SupabaseClient);
    await expect(
      adapter.unlinkPolicyFromOffer({
        offerId: '31',
        policyId: '12',
        expectedOfferLockVersion: 3,
        context,
      }),
    ).rejects.toBeInstanceOf(PricingAdapterQueryError);
  });
});
