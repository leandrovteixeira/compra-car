import type { ManualPolicyRolloverDependencyError } from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { ManualPolicyBatchSupabaseAdapter } from '../src';

describe('ManualPolicyBatch Supabase adapter', () => {
  it('sends Policy and Offer successors to the single commercial period RPC', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: {
          periodKind: 'special',
          periodStart: '2026-09-10',
          periodEnd: '2026-09-20',
          policyBatch: {
            batchId: 'batch-1',
            createdCount: 1,
            policyIds: [71],
            rolloverCount: 1,
          },
          closedOfferIds: [26],
          createdOfferCount: 1,
          offers: [{ offerId: 81 }],
        },
        error: null,
      })),
    } as unknown as SupabaseClient;
    const result = await new ManualPolicyBatchSupabaseAdapter(client).createCommercialPeriodDraft({
      productId: '616',
      period: {
        competence: '2026-09',
        kind: 'special',
        start: '2026-09-10',
        end: '2026-09-20',
      },
      policyRows: [
        {
          clientRowId: 'policy-1',
          productId: '616',
          policyType: 'retail_bonus',
          title: 'Bônus varejo',
          description: '',
          startsOn: '2026-09-10',
          endsOn: '2026-09-20',
          amount: '1000.00',
          rebateAmount: '250.00',
          customerBenefitAmount: '1000.00',
          expectedPredecessorId: '66',
          expectedPredecessorLockVersion: '3',
        },
      ],
      offerRows: [{ clientRowId: 'offer-1', policyRefs: [{ policyClientRowId: 'policy-1' }] }],
      expectedOffers: [{ offerId: '26', expectedLockVersion: 4 }],
      actorId: 'actor',
      correlationId: 'correlation',
    });
    expect(result).toMatchObject({
      batchId: 'batch-1',
      createdPolicyIds: ['71'],
      closedOfferIds: ['26'],
      createdOfferIds: ['81'],
    });
    expect(client.rpc).toHaveBeenCalledWith(
      'create_commercial_period_draft',
      expect.objectContaining({
        p_product_id: 616,
        p_period_start: '2026-09-10',
        p_period_end: '2026-09-20',
        p_period_kind: 'special',
        p_policy_rows: [
          expect.objectContaining({
            policyType: 'retail_bonus',
            rebateAmount: '250.00',
          }),
        ],
        p_expected_offers: [{ offerId: 26, expectedLockVersion: 4 }],
      }),
    );
  });

  it('maps a blocked rollover and resolves the non-archived dependent Offer IDs', async () => {
    const membershipQuery = {
      select: vi.fn(() => membershipQuery),
      in: vi.fn(async () => ({
        data: [
          { commercial_offer_id: 26, commercial_policy_id: 66 },
          { commercial_offer_id: 28, commercial_policy_id: 66 },
        ],
        error: null,
      })),
    };
    const offerQuery = {
      select: vi.fn(() => offerQuery),
      in: vi.fn(() => offerQuery),
      neq: vi.fn(async () => ({
        data: [
          { id: 26, status: 'draft', valid_to: '2026-12-31' },
          { id: 28, status: 'draft', valid_to: '2026-12-31' },
        ],
        error: null,
      })),
    };
    const client = {
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          code: '55000',
          message: 'policy rollover would invalidate a non-archived commercial offer',
          details: '',
          hint: '',
        },
      })),
      from: vi.fn((table: string) =>
        table === 'commercial_offer_policies' ? membershipQuery : offerQuery,
      ),
    } as unknown as SupabaseClient;

    await expect(
      new ManualPolicyBatchSupabaseAdapter(client).createManualPolicyBatch({
        actorId: 'actor',
        correlationId: 'correlation',
        rows: [
          {
            clientRowId: 'row-1',
            productId: '616',
            policyType: 'subsidized_financing',
            title: 'Financiamento subsidiado',
            description: '',
            startsOn: '2026-09-01',
            endsOn: null,
            calculationBasePriceId: '22',
            financialParameterSetId: '1',
            termMonths: '24',
            customerInterestRateMonthly: '0.49',
            downPaymentPercentage: '60',
            financedPrincipal: '75996.00',
            customerBenefitAmount: '8186.01',
            expectedPredecessorId: '66',
            expectedPredecessorLockVersion: '1',
          },
        ],
      }),
    ).rejects.toMatchObject({
      name: 'ManualPolicyRolloverDependencyError',
      offerIds: ['26', '28'],
      policyTypes: ['subsidized_financing'],
    } satisfies Partial<ManualPolicyRolloverDependencyError>);
  });
});
