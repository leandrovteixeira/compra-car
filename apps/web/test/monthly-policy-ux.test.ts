import type { ManualPolicyBatchRepository } from '@compra-car/core';
import { ManualPolicyRolloverDependencyError } from '@compra-car/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCopiedCommercialPeriodOffers,
  buildInitialManualPolicyRows,
  buildManualPolicyPreview,
  copyPolicyToGridRow,
  EMPTY_MANUAL_POLICY_BATCH_ROW,
  executeManualPolicyBatchCreation,
  resolveManualPolicyPredecessor,
} from '../src/application/admin/manual-policy-batch';

const row = (changes: Partial<typeof EMPTY_MANUAL_POLICY_BATCH_ROW>) => ({
  ...EMPTY_MANUAL_POLICY_BATCH_ROW,
  clientRowId: 'row-1',
  productId: '',
  startsOn: '2026-09-01',
  ...changes,
});
const prices = [
  {
    id: '22',
    productId: '616',
    amount: '189990.00',
    startsOn: '2026-07-29',
    endsOn: '2026-12-31',
  },
];
const references = [
  {
    id: '1',
    label: 'Referência 1',
    effectiveFrom: '2026-07-29',
    validTo: null,
    monthlyReferenceRate: '0.014458',
  },
];

afterEach(() => vi.restoreAllMocks());

describe('monthly policy UX', () => {
  it('formats copied money in pt-BR and resolves August memberships by source ID', () => {
    const augustPolicy = {
      id: '82',
      productId: '616',
      policyType: 'retail_bonus' as const,
      title: 'Bônus varejo',
      description: null,
      startsOn: '2026-08-01',
      endsOn: '2026-08-31',
      customerBenefitAmount: '10000.00',
      dealerRebateAmount: '2500.00',
      fixedAmount: '10000.00',
      status: 'draft' as const,
      lockVersion: 1,
    };
    const copied = copyPolicyToGridRow(augustPolicy, 'copied-1');
    expect(copied).toMatchObject({
      sourcePolicyId: '82',
      amount: '10.000,00',
      rebateAmount: '2.500,00',
    });
    const resolved = buildCopiedCommercialPeriodOffers(
      [
        {
          id: '35',
          productId: '616',
          publicPriceAmount: '189990.00',
          validFrom: '2026-08-01',
          validTo: '2026-08-31',
          status: 'draft',
          policyCount: 1,
          benefitAmount: '10000.00',
          transactionalPrice: '179990.00',
          policyIds: ['82'],
          lockVersion: 1,
        },
      ],
      [augustPolicy],
      [copied],
      '2026-09-01',
      '2026-09-30',
    );
    expect(resolved).toEqual({
      unresolvedMembershipCount: 0,
      rows: [
        {
          clientRowId: 'copied-offer-1',
          policyRefs: [{ policyClientRowId: 'copied-1' }],
        },
      ],
    });
  });

  it('never falls back to an expired August Policy ID', () => {
    const resolved = buildCopiedCommercialPeriodOffers(
      [
        {
          id: '35',
          productId: '616',
          publicPriceAmount: '189990.00',
          validFrom: '2026-08-01',
          validTo: '2026-08-31',
          status: 'draft',
          policyCount: 1,
          benefitAmount: '10000.00',
          transactionalPrice: '179990.00',
          policyIds: ['82'],
          lockVersion: 1,
        },
      ],
      [],
      [],
      '2026-09-01',
      '2026-09-30',
    );
    expect(resolved.unresolvedMembershipCount).toBe(1);
    expect(resolved.rows[0]?.policyRefs).toEqual([]);
  });

  it('selects the copied predecessor when a special period replaces its Policy', () => {
    const predecessor = {
      id: '90',
      productId: '616',
      policyType: 'subsidized_financing' as const,
      title: 'Taxa antiga',
      description: null,
      startsOn: '2026-09-01',
      endsOn: '2026-09-30',
      customerBenefitAmount: '9503.80',
      status: 'draft' as const,
      lockVersion: 4,
    };
    const replacement = copyPolicyToGridRow(predecessor, 'special-rate');
    expect(resolveManualPolicyPredecessor(replacement, [predecessor], '616', '2026-09-20')).toEqual(
      predecessor,
    );
    expect(buildInitialManualPolicyRows([predecessor], 'special')).toEqual([]);
    expect(buildInitialManualPolicyRows([predecessor], 'monthly')).toHaveLength(1);
  });

  it('rewires a copied Offer to a manually replaced Policy in a special period', () => {
    const predecessor = {
      id: '90',
      productId: '616',
      policyType: 'subsidized_financing' as const,
      title: 'Taxa antiga',
      description: null,
      startsOn: '2026-09-01',
      endsOn: '2026-09-30',
      customerBenefitAmount: '9503.80',
      status: 'draft' as const,
      lockVersion: 4,
    };
    const replacement = row({
      clientRowId: 'special-rate',
      productId: '616',
      policyType: 'subsidized_financing',
      expectedPredecessorId: '90',
      expectedPredecessorLockVersion: '4',
    });
    expect(
      buildCopiedCommercialPeriodOffers(
        [
          {
            id: '45',
            productId: '616',
            publicPriceAmount: '189990.00',
            validFrom: '2026-09-01',
            validTo: '2026-09-30',
            status: 'draft',
            policyCount: 1,
            benefitAmount: '9503.80',
            transactionalPrice: '180486.20',
            policyIds: ['90'],
            lockVersion: 2,
          },
        ],
        [predecessor],
        [replacement],
        '2026-09-20',
        '2026-09-30',
      ),
    ).toEqual({
      unresolvedMembershipCount: 0,
      rows: [
        {
          clientRowId: 'copied-offer-1',
          policyRefs: [{ policyClientRowId: 'special-rate' }],
        },
      ],
    });
  });

  it('calculates financing immediately with the Product fixed by the workspace', () => {
    const preview = buildManualPolicyPreview(
      row({
        policyType: 'subsidized_financing',
        termMonths: '24',
        customerInterestRateMonthly: '0,49',
        downPaymentPercentage: '60',
      }),
      '616',
      '2026-09-01',
      prices,
      references,
    );
    expect(preview.normalized.productId).toBe('616');
    expect(preview.reference).toMatchObject({
      calculationBasePriceId: '22',
      financialParameterSetId: '1',
    });
    expect(preview.benefit).toMatchObject({ customerBenefitAmount: '8186.01' });
  });

  it.each([
    ['free_ipva', {}, '2533.20'],
    ['free_insurance', { termMonths: '12' }, '5699.70'],
    ['free_registration', {}, '1899.90'],
    ['trade_in_bonus', { amount: '1.000,00' }, '1000.00'],
  ])('previews %s without persistence', (policyType, changes, expected) => {
    expect(
      buildManualPolicyPreview(
        row({ policyType, ...changes }),
        '616',
        '2026-09-01',
        prices,
        references,
      ).benefit,
    ).toMatchObject({ customerBenefitAmount: expected });
  });

  it('returns the dependent Offers and correlation ID for a blocked rollover', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const repository: ManualPolicyBatchRepository = {
      listProductOptions: async () => [],
      listBasePrices: async () => [],
      listFinancialReferences: async () => [],
      resolveReferences: async () => ({
        'row-1': {
          calculationBasePriceId: '22',
          basePriceAmount: '189990.00',
          financialParameterSetId: '1',
          monthlyReferenceRate: '0.014458',
        },
      }),
      createManualPolicyBatch: async () => {
        throw new ManualPolicyRolloverDependencyError(['26', '28'], ['subsidized_financing']);
      },
      createCommercialPeriodDraft: async () => {
        throw new ManualPolicyRolloverDependencyError(['26', '28'], ['subsidized_financing']);
      },
    };
    const policy = row({
      productId: '616',
      policyType: 'subsidized_financing',
      termMonths: '24',
      customerInterestRateMonthly: '0,49',
      downPaymentPercentage: '60',
      expectedPredecessorId: '66',
      expectedPredecessorLockVersion: '1',
    });
    const formData = new FormData();
    formData.set('competence', '2026-09');
    formData.set('periodKind', 'monthly');
    formData.set('offerRows', '[]');
    formData.set('expectedOffers', '[]');
    formData.set('rows', JSON.stringify([policy]));
    const result = await executeManualPolicyBatchCreation(formData, {
      authorize: async () => ({ actorId: 'actor' }),
      createRepository: () => repository,
      createCorrelationId: () => 'correlation-9h1',
      revalidate: vi.fn(),
    });
    expect(result).toMatchObject({ status: 'error', rows: [policy] });
    if (result.status !== 'error') throw new Error('Expected an error result.');
    expect(result.message).toContain('A Taxa vigente está sendo usada por ofertas ativas');
    expect(result.message).toContain('#26, #28');
    expect(result.message).toContain('correlation-9h1');
    expect(result.rowErrors['row-1']?.row).toEqual([
      'A Taxa vigente está vinculada a uma oferta ativa e não pode ser encerrada.',
    ]);
  });
});
