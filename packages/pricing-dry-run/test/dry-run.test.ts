import { readFile } from 'node:fs/promises';

import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { logicalFingerprint, logicalHash } from '../src/canonical.js';
import { reconcileDealerRebates } from '../src/analysis.js';
import { allocateDealerRebates } from '../src/dealer-rebate.js';
import {
  classifyAccumulatorSuggestions,
  classifyPolicies,
  classifyPublicPrices,
  linkOfferAggregate,
  validateCandidateMoney,
} from '../src/classification.js';
import { validateLocalDatabaseUrl } from '../src/database.js';
import { equivalentMonthlyRate, LEGACY_CDI_PARAMETER_SET } from '../src/financial-parameters.js';
import { decimal, money } from '../src/money.js';
import {
  evaluateNewPolicy,
  isRebateEligiblePolicy,
  monetaryPolicyTotal,
  REBATE_ELIGIBLE_POLICY_TYPES,
} from '../src/policy-rules.js';
import { reconcileOffers } from '../src/reconciliation.js';
import { stableCsv } from '../src/reports.js';
import { runDryRun } from '../src/runner.js';
import { buildValidationSamples } from '../src/samples.js';
import type { LegacyOffer, PolicyCandidate, SourceSnapshot } from '../src/types.js';

const emptyOffer: LegacyOffer = {
  id: '1',
  productId: '101',
  offerMonth: '2026-01-01',
  publicPrice: '100.00',
  retailBonus: '0',
  retailRebate: '0',
  tradeInBonus: '0',
  tradeInRebate: '0',
  subsidizedRateMonthly: null,
  downPaymentPercent: null,
  installments: null,
  rateRebate: '0',
  insuranceYears: '0',
  ipvaIncluded: false,
  othersBonus: '0',
  totalCustomerBenefit: null,
  totalDealerRebate: null,
  notes: null,
  isActive: true,
};

async function fixture(): Promise<SourceSnapshot> {
  const url = new URL('./fixtures/legacy-snapshot.json', import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')) as SourceSnapshot;
}

describe('pricing legacy dry-run', () => {
  it.each([
    ['retail only', { retailBonus: '8000' }, ['retail_bonus']],
    ['trade-in only', { tradeInBonus: '2000' }, ['trade_in_bonus']],
    [
      'financing only',
      {
        publicPrice: '100000',
        subsidizedRateMonthly: '0',
        downPaymentPercent: '60',
        installments: 24,
      },
      ['subsidized_financing'],
    ],
    [
      'retail and trade-in',
      { retailBonus: '8000', tradeInBonus: '2000' },
      ['retail_bonus', 'trade_in_bonus'],
    ],
    [
      'retail and financing',
      {
        retailBonus: '8000',
        publicPrice: '100000',
        subsidizedRateMonthly: '0',
        downPaymentPercent: '60',
        installments: 24,
      },
      ['retail_bonus', 'subsidized_financing'],
    ],
    [
      'trade-in and financing',
      {
        tradeInBonus: '2000',
        publicPrice: '100000',
        subsidizedRateMonthly: '0',
        downPaymentPercent: '60',
        installments: 24,
      },
      ['trade_in_bonus', 'subsidized_financing'],
    ],
    [
      'all eligible policies',
      {
        retailBonus: '8000',
        tradeInBonus: '2000',
        publicPrice: '100000',
        subsidizedRateMonthly: '0',
        downPaymentPercent: '60',
        installments: 24,
      },
      ['retail_bonus', 'trade_in_bonus', 'subsidized_financing'],
    ],
  ])(
    'allocates an aggregate dealer rebate deterministically: %s',
    (_name, fields, expectedTypes) => {
      const offer = { ...emptyOffer, ...fields, totalDealerRebate: '5000' } as LegacyOffer;
      const result = allocateDealerRebates([offer], classifyPolicies([offer], null));
      const allocated = result.policies.filter((policy) => policy.dealerRebateAmount !== null);
      expect(result.rows.map((row) => row.policyType)).toEqual(expectedTypes);
      expect(
        allocated
          .reduce((sum, policy) => sum.plus(policy.dealerRebateAmount ?? 0), new Decimal(0))
          .toFixed(2),
      ).toBe('5000.00');
      expect(
        allocated.every(
          (policy) => policy.dealerRebateAllocationMethod === 'proportional_legacy_total',
        ),
      ).toBe(true);
    },
  );

  it('uses customer benefit as the proportional base and gives a single eligible policy 100 percent', () => {
    const offer = {
      ...emptyOffer,
      retailBonus: '8000',
      tradeInBonus: '2000',
      ipvaIncluded: true,
      publicPrice: '100000',
      totalDealerRebate: '5000',
    };
    const result = allocateDealerRebates([offer], classifyPolicies([offer], null));
    const retail = result.policies.find((policy) => policy.proposedPolicyType === 'retail_bonus');
    const trade = result.policies.find((policy) => policy.proposedPolicyType === 'trade_in_bonus');
    const ipva = result.policies.find((policy) => policy.proposedPolicyType === 'free_ipva');
    expect(retail).toMatchObject({
      dealerRebateAmount: '4000.00',
      dealerRebateAllocationPercentage: '80.000000',
    });
    expect(trade).toMatchObject({
      dealerRebateAmount: '1000.00',
      dealerRebateAllocationPercentage: '20.000000',
    });
    expect(ipva?.dealerRebateAmount).toBeNull();

    const single = { ...emptyOffer, retailBonus: '1', totalDealerRebate: '99.99' };
    expect(
      allocateDealerRebates([single], classifyPolicies([single], null)).policies[0],
    ).toMatchObject({
      dealerRebateAmount: '99.99',
      dealerRebateAllocationPercentage: '100.000000',
    });
  });

  it.each([
    'free_ipva',
    'free_insurance',
    'free_wallbox',
    'free_registration',
    'free_maintenance',
    'fuel_or_recharge_voucher',
    'other',
  ] as const)('excludes %s from aggregate dealer rebate allocation', (excludedType) => {
    const offer = { ...emptyOffer, retailBonus: '100', totalDealerRebate: '50' };
    const base = classifyPolicies([offer], null)[0]!;
    const excluded: PolicyCandidate = {
      ...base,
      candidatePolicyId: `excluded-${excludedType}`,
      proposedPolicyType: excludedType,
      proposedMonetaryValue: excludedType === 'free_maintenance' ? null : '10000.00',
      dealerRebateAmount: null,
      dealerRebateAllocationMethod: null,
    };
    const result = allocateDealerRebates([offer], [base, excluded]);
    expect(
      result.policies.find((policy) => policy.candidatePolicyId === base.candidatePolicyId)
        ?.dealerRebateAmount,
    ).toBe('50.00');
    expect(
      result.policies.find((policy) => policy.candidatePolicyId === excluded.candidatePolicyId)
        ?.dealerRebateAmount,
    ).toBeNull();
    expect(isRebateEligiblePolicy(excludedType)).toBe(false);
  });

  it('applies rounding residue to the last deterministic policy and preserves the exact total', () => {
    const offer = { ...emptyOffer, retailBonus: '1', totalDealerRebate: '100' };
    const base = classifyPolicies([offer], null)[0]!;
    const policies = REBATE_ELIGIBLE_POLICY_TYPES.map((type, index) => ({
      ...base,
      candidatePolicyId: `policy-${index}`,
      proposedPolicyType: type,
      proposedMonetaryValue: '1.00',
    }));
    const result = allocateDealerRebates([offer], policies);
    const allocated = result.policies.filter((policy) => policy.dealerRebateAmount !== null);
    expect(allocated.map((policy) => policy.proposedPolicyType)).toEqual(
      REBATE_ELIGIBLE_POLICY_TYPES,
    );
    expect(allocated.map((policy) => policy.dealerRebateAmount)).toEqual([
      '33.33',
      '33.33',
      '33.34',
    ]);
    expect(allocated.at(-1)?.dealerRebateRoundingResidual).toBe('0.01');
  });

  it('keeps explicit legacy components authoritative and never redistributes them', () => {
    const offer = {
      ...emptyOffer,
      retailBonus: '100',
      tradeInBonus: '900',
      retailRebate: '25',
      tradeInRebate: '0',
      totalDealerRebate: '25',
    };
    const result = allocateDealerRebates([offer], classifyPolicies([offer], null));
    expect(
      result.policies.find((policy) => policy.proposedPolicyType === 'retail_bonus'),
    ).toMatchObject({
      dealerRebateAmount: '25.00',
      dealerRebateAllocationMethod: 'explicit_legacy_component',
    });
    expect(
      result.policies.find((policy) => policy.proposedPolicyType === 'trade_in_bonus')
        ?.dealerRebateAmount,
    ).toBe('0.00');
  });

  it.each([
    ['no eligible policy', [] as PolicyCandidate[]],
    [
      'zero benefit',
      [
        {
          ...classifyPolicies([{ ...emptyOffer, retailBonus: '1' }], null)[0]!,
          proposedMonetaryValue: '0.00',
        },
      ],
    ],
    [
      'null benefit',
      [
        {
          ...classifyPolicies([{ ...emptyOffer, retailBonus: '1' }], null)[0]!,
          proposedMonetaryValue: null,
        },
      ],
    ],
    [
      'blocked economic policy',
      [
        {
          ...classifyPolicies([{ ...emptyOffer, retailBonus: '1' }], null)[0]!,
          classification: 'needs_review' as const,
          issueCodes: ['NEGATIVE_ECONOMIC_VALUE' as const],
        },
      ],
    ],
  ])('marks aggregate rebate unallocated when %s', (_name, policies) => {
    const offer = { ...emptyOffer, totalDealerRebate: '100' };
    const result = allocateDealerRebates([offer], policies);
    expect(result.rows[0]).toMatchObject({
      allocationMethod: 'unallocated_legacy_total',
      classification: 'needs_review',
    });
    expect(result.rows[0]?.issueCodes).toContain('UNALLOCATED_LEGACY_DEALER_REBATE');
  });

  it('removes false rebate mismatch after allocation and retains a real explicit mismatch', () => {
    const aggregate = { ...emptyOffer, retailBonus: '100', totalDealerRebate: '50' };
    const allocation = allocateDealerRebates([aggregate], classifyPolicies([aggregate], null));
    expect(reconcileDealerRebates([aggregate], allocation.rows)[0]?.issueCodes).not.toContain(
      'DEALER_REBATE_TOTAL_MISMATCH',
    );
    const explicit = {
      ...emptyOffer,
      retailBonus: '100',
      retailRebate: '10',
      totalDealerRebate: '11',
    };
    const explicitAllocation = allocateDealerRebates(
      [explicit],
      classifyPolicies([explicit], null),
    );
    expect(reconcileDealerRebates([explicit], explicitAllocation.rows)[0]?.issueCodes).toContain(
      'DEALER_REBATE_TOTAL_MISMATCH',
    );
  });

  it('supports future policy types without inferring them from legacy others_bonus', () => {
    expect(evaluateNewPolicy({ policyType: 'free_wallbox' })).toMatchObject({
      calculationMethod: 'fixed_amount',
      customerBenefitAmount: '4000.00',
      publishable: true,
    });
    expect(
      evaluateNewPolicy({ policyType: 'free_wallbox', fixedAmount: '4500' }).customerBenefitAmount,
    ).toBe('4500.00');
    expect(
      evaluateNewPolicy({ policyType: 'free_registration', publicPrice: '100000' }),
    ).toMatchObject({
      calculationMethod: 'percentage_of_msrp',
      percentageRate: '0.010000',
      customerBenefitAmount: '1000.00',
      publishable: true,
    });
    expect(evaluateNewPolicy({ policyType: 'free_registration', publicPrice: '0' })).toMatchObject({
      customerBenefitAmount: null,
      publishable: false,
      issueCodes: ['REGISTRATION_NON_POSITIVE_PUBLIC_PRICE'],
    });
    expect(
      evaluateNewPolicy({
        policyType: 'free_maintenance',
        description: 'Three scheduled services',
      }),
    ).toMatchObject({
      calculationMethod: 'non_monetized',
      customerBenefitAmount: null,
      publishable: true,
      qualitativeBenefit: true,
    });
    expect(
      evaluateNewPolicy({
        policyType: 'free_maintenance',
        parameters: { maintenance_count: 3 },
      }).publishable,
    ).toBe(true);
    expect(
      evaluateNewPolicy({
        policyType: 'free_maintenance',
        parameters: { unrelated: true },
      }),
    ).toMatchObject({
      customerBenefitAmount: null,
      publishable: false,
      issueCodes: ['MISSING_POLICY_DESCRIPTION'],
    });
    expect(
      evaluateNewPolicy({
        policyType: 'fuel_or_recharge_voucher',
        fixedAmount: '500',
        voucherType: 'fuel',
      }),
    ).toMatchObject({ customerBenefitAmount: '500.00', publishable: true });
    expect(
      evaluateNewPolicy({ policyType: 'fuel_or_recharge_voucher', fixedAmount: '500' }),
    ).toMatchObject({ voucherType: 'unspecified', publishable: true });
    expect(
      evaluateNewPolicy({
        policyType: 'fuel_or_recharge_voucher',
        fixedAmount: '500',
        voucherType: 'electric_recharge',
      }),
    ).toMatchObject({ customerBenefitAmount: '500.00', publishable: true });
    expect(
      evaluateNewPolicy({ policyType: 'fuel_or_recharge_voucher', fixedAmount: null }),
    ).toMatchObject({ customerBenefitAmount: null, publishable: false });
    const legacy = classifyPolicies([{ ...emptyOffer, othersBonus: '4000', notes: null }], null);
    expect(legacy).toHaveLength(1);
    expect(legacy[0]?.proposedPolicyType).toBe('other');
  });

  it('keeps non-monetized benefits qualitative and out of monetary totals', () => {
    const base = classifyPolicies([{ ...emptyOffer, retailBonus: '100' }], null)[0]!;
    const maintenance: PolicyCandidate = {
      ...base,
      candidatePolicyId: 'maintenance',
      proposedPolicyType: 'free_maintenance',
      calculationMethod: 'non_monetized',
      proposedMonetaryValue: null,
    };
    const wallbox: PolicyCandidate = {
      ...base,
      candidatePolicyId: 'wallbox',
      proposedPolicyType: 'free_wallbox',
      proposedMonetaryValue: '4000.00',
    };
    expect(monetaryPolicyTotal([base, maintenance, wallbox])).toBe('4100.00');
    expect(maintenance.proposedMonetaryValue).toBeNull();
  });
  it('classifies positive, zero and negative public prices without binary money', () => {
    const offers = [
      emptyOffer,
      { ...emptyOffer, id: '2', productId: '102', publicPrice: '0' },
      { ...emptyOffer, id: '3', productId: '103', publicPrice: '-0.01' },
    ];
    const result = classifyPublicPrices(offers, new Set(['101', '102', '103']));

    expect(result.candidates.map((candidate) => candidate.classification)).toEqual([
      'auto_classifiable',
      'needs_review',
      'needs_review',
    ]);
    expect(result.candidates[1]?.issueCodes).toContain('ZERO_PUBLIC_PRICE');
    expect(result.candidates[2]?.issueCodes).toContain('NEGATIVE_ECONOMIC_VALUE');
    expect(money(decimal('0.1')!.plus('0.2'))).toBe('0.30');
  });

  it('deduplicates equal prices and never selects a conflicting winner', () => {
    const offers = [
      emptyOffer,
      { ...emptyOffer, id: '2', publicPrice: '100.00' },
      { ...emptyOffer, id: '3', offerMonth: '2026-02-01', publicPrice: '110' },
      { ...emptyOffer, id: '4', offerMonth: '2026-02-01', publicPrice: '120' },
    ];
    const result = classifyPublicPrices(offers, new Set(['101']));

    expect(result.candidates[0]?.classification).toBe('classifiable_with_reconciliation');
    expect(result.candidates[0]?.sourceIds).toEqual(['1', '2']);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.automaticWinner).toBeNull();
  });

  it('creates one draft commercial offer per legacy row and links its versioned price and policies', () => {
    const offers = [
      {
        ...emptyOffer,
        id: '7',
        offerMonth: '2026-02-14',
        publicPrice: '100000',
        retailBonus: '1000',
        ipvaIncluded: true,
      },
    ];
    const prices = classifyPublicPrices(offers, new Set(['101'])).candidates;
    const policies = classifyPolicies(offers, null);
    const candidates = linkOfferAggregate(offers, prices, policies);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      candidateOfferId: 'offer-7',
      legacySourceId: '7',
      validFrom: '2026-02-01',
      validTo: '2026-02-28',
      status: 'draft',
      policyCount: 2,
    });
    expect(policies.every((policy) => policy.commercialOfferId === 'offer-7')).toBe(true);
    expect(
      policies.find((policy) => policy.proposedPolicyType === 'free_ipva')?.calculationBasePriceId,
    ).toBe(prices[0]?.candidatePriceId);
    expect(policies.some((policy) => policy.proposedPolicyType === null)).toBe(false);
  });

  it('retains an auditable offer with no policy and never turns price into a policy', () => {
    const prices = classifyPublicPrices([emptyOffer], new Set(['101'])).candidates;
    const policies = classifyPolicies([emptyOffer], null);
    const offers = linkOfferAggregate([emptyOffer], prices, policies);
    expect(policies).toEqual([]);
    expect(offers[0]).toMatchObject({ policyCount: 0, accumulatorCandidateId: null });
    expect(offers[0]?.publicPriceCandidateId).toBe(prices[0]?.candidatePriceId);
  });

  it('classifies every supported legacy policy component and keeps totals out of policies', () => {
    const offer: LegacyOffer = {
      ...emptyOffer,
      publicPrice: '100000',
      retailBonus: '1000',
      tradeInBonus: '2000',
      subsidizedRateMonthly: '0.99',
      downPaymentPercent: '40',
      installments: 24,
      insuranceYears: '1',
      ipvaIncluded: true,
      othersBonus: '500',
      totalCustomerBenefit: '9999',
      notes: 'Manual benefit',
    };
    const policies = classifyPolicies([offer], '3');

    expect(policies.map((policy) => policy.proposedPolicyType)).toEqual([
      'free_insurance',
      'free_ipva',
      'other',
      'retail_bonus',
      'subsidized_financing',
      'trade_in_bonus',
    ]);
    expect(
      policies.find((policy) => policy.proposedPolicyType === 'free_insurance')
        ?.proposedMonetaryValue,
    ).toBe('3000.00');
    expect(
      policies.find((policy) => policy.proposedPolicyType === 'subsidized_financing')
        ?.financialParameterSetId,
    ).toBe(LEGACY_CDI_PARAMETER_SET.id);
    expect(policies.some((policy) => policy.evidence.includes('total_customer_benefit'))).toBe(
      false,
    );
  });

  it('maps supported rebates and flags incomplete financing and missing descriptions', () => {
    const policies = classifyPolicies(
      [
        {
          ...emptyOffer,
          subsidizedRateMonthly: '0.5',
          retailRebate: '10',
          othersBonus: '20',
        },
      ],
      null,
    );
    expect(policies.find((policy) => policy.proposedPolicyType === 'retail_bonus')).toMatchObject({
      proposedMonetaryValue: null,
      dealerRebateAmount: '10.00',
      dealerRebateAllocationMethod: 'explicit_legacy_component',
      classification: 'needs_review',
    });
    expect(policies.some((policy) => policy.issueCodes.includes('UNSUPPORTED_REBATE_FIELD'))).toBe(
      false,
    );
    expect(
      policies.some((policy) => policy.issueCodes.includes('INCOMPLETE_FINANCING_TERMS')),
    ).toBe(true);
    expect(
      policies.some((policy) => policy.issueCodes.includes('MISSING_POLICY_DESCRIPTION')),
    ).toBe(true);
  });

  it('supports all monetary consistency issue codes', () => {
    const candidate: PolicyCandidate = {
      candidatePolicyId: 'policy-1',
      commercialOfferId: 'offer-1',
      calculationBasePriceId: null,
      sourceId: '1',
      productId: '1',
      proposedPolicyType: 'retail_bonus',
      calculationMethod: 'fixed_amount',
      inputMonetaryValue: '10.00',
      proposedMonetaryValue: '11.00',
      startsOn: '2026-01-01',
      classification: 'needs_review',
      issueCodes: [],
      evidence: '',
      fingerprint: '',
      dealerRebateAmount: null,
      dealerRebateAllocationMethod: null,
      dealerRebateAllocationBase: null,
      dealerRebateAllocationPercentage: null,
      dealerRebateRoundingResidual: null,
      legacyPolicySource: null,
      legacySourceColumn: null,
      legacyDealerRebateValue: null,
      fixedAmount: null,
      percentageRate: null,
      voucherType: null,
      policyParameters: {},
      annualRate: null,
      coverageYears: null,
      remainingMonths: null,
      financedPrincipal: null,
      promotionalPayment: null,
      promotionalTotalPaid: null,
      referencePayment: null,
      referenceTotalPaid: null,
      promotionalPresentValue: null,
      referencePresentValue: null,
      totalPaidBenefit: null,
      financialParameterSetId: null,
      financialParameterSetVersion: null,
      financialCalculationMethod: null,
    };
    expect(validateCandidateMoney(candidate)).toContain('INPUT_ECONOMIC_VALUE_MISMATCH');
    expect(validateCandidateMoney({ ...candidate, inputMonetaryValue: null })).toContain(
      'MISSING_INPUT_MONETARY_VALUE',
    );
    expect(
      validateCandidateMoney({
        ...candidate,
        calculationMethod: 'percentage_of_msrp',
        inputMonetaryValue: '10',
      }),
    ).toContain('UNEXPECTED_INPUT_MONETARY_VALUE');
  });

  it('marks AND/OR combinations as suggestions that can never auto-publish', () => {
    const offer = {
      ...emptyOffer,
      retailBonus: '100',
      tradeInBonus: '200',
      notes: 'Retail OU trade-in / alternative',
    };
    const policies = classifyPolicies([offer], null);
    const suggestions = classifyAccumulatorSuggestions([offer], policies);

    expect(suggestions[0]?.relationType).toBe('OR');
    expect(suggestions[0]?.relationOrigin).toBe('legacy_default');
    expect(suggestions[0]?.status).toBe('draft');
    expect(suggestions[0]?.automaticallyPublishable).toBe(false);
    expect(suggestions[0]?.issueCodes).not.toContain('AMBIGUOUS_AND_OR_RELATION');
  });

  it('links retail, trade-in and rate rebates without changing customer benefits', () => {
    const offer = {
      ...emptyOffer,
      publicPrice: '100000',
      retailBonus: '15000',
      retailRebate: '5000',
      tradeInBonus: '8000',
      tradeInRebate: '2000',
      subsidizedRateMonthly: '0',
      downPaymentPercent: '40',
      installments: 24,
      rateRebate: '1000',
    };
    const policies = classifyPolicies([offer], null);
    const retail = policies.find((policy) => policy.proposedPolicyType === 'retail_bonus');
    const tradeIn = policies.find((policy) => policy.proposedPolicyType === 'trade_in_bonus');
    const financing = policies.find(
      (policy) => policy.proposedPolicyType === 'subsidized_financing',
    );
    expect(retail).toMatchObject({
      proposedMonetaryValue: '15000.00',
      dealerRebateAmount: '5000.00',
    });
    expect(tradeIn).toMatchObject({
      proposedMonetaryValue: '8000.00',
      dealerRebateAmount: '2000.00',
    });
    expect(financing?.dealerRebateAmount).toBe('1000.00');
    expect(retail?.proposedMonetaryValue).not.toBe('20000.00');
  });

  it('preserves dealer rebate zero and null distinctly', () => {
    const policies = classifyPolicies(
      [
        { ...emptyOffer, id: '1', retailBonus: '100', retailRebate: '0' },
        { ...emptyOffer, id: '2', retailBonus: '100', retailRebate: null },
      ],
      null,
    );
    expect(policies.find((policy) => policy.sourceId === '1')?.dealerRebateAmount).toBe('0.00');
    expect(policies.find((policy) => policy.sourceId === '2')?.dealerRebateAmount).toBeNull();
  });

  it('reconciles dealer rebate totals and emits only real mismatches', () => {
    const rows = reconcileDealerRebates([
      {
        ...emptyOffer,
        id: '1',
        retailRebate: '10',
        tradeInRebate: '20',
        rateRebate: '5',
        totalDealerRebate: '35',
      },
      {
        ...emptyOffer,
        id: '2',
        retailRebate: '10',
        tradeInRebate: '20',
        rateRebate: '5',
        totalDealerRebate: '36',
      },
    ]);
    expect(rows[0]?.issueCodes).toEqual([]);
    expect(rows[1]).toMatchObject({
      structuredTotal: '35.00',
      legacyTotal: '36',
      absoluteDifference: '1.00',
    });
    expect(rows[1]?.issueCodes).toContain('DEALER_REBATE_TOTAL_MISMATCH');
  });

  it.each([
    ['2026-01-01', 12, '4000.00'],
    ['2026-02-01', 11, '3666.67'],
    ['2026-07-01', 6, '2000.00'],
    ['2026-12-01', 1, '333.33'],
  ])('calculates proportional IPVA for %s', (offerMonth, remainingMonths, expected) => {
    const policy = classifyPolicies(
      [{ ...emptyOffer, offerMonth, publicPrice: '100000', ipvaIncluded: true }],
      null,
    ).find((candidate) => candidate.proposedPolicyType === 'free_ipva');
    expect(policy).toMatchObject({
      calculationMethod: 'proportional_ipva',
      annualRate: '0.040000',
      remainingMonths,
      proposedMonetaryValue: expected,
      issueCodes: [],
    });
  });

  it('reports specific IPVA issues for zero, null and invalid month', () => {
    const policies = classifyPolicies(
      [
        { ...emptyOffer, id: '1', publicPrice: '0', ipvaIncluded: true },
        { ...emptyOffer, id: '2', publicPrice: null, ipvaIncluded: true },
        { ...emptyOffer, id: '3', offerMonth: '2026-13-01', ipvaIncluded: true },
      ],
      null,
    ).filter((policy) => policy.proposedPolicyType === 'free_ipva');
    expect(policies.find((policy) => policy.sourceId === '1')?.issueCodes).toContain(
      'IPVA_NON_POSITIVE_PUBLIC_PRICE',
    );
    expect(policies.find((policy) => policy.sourceId === '2')?.issueCodes).toContain(
      'IPVA_MISSING_PUBLIC_PRICE',
    );
    expect(policies.find((policy) => policy.sourceId === '3')?.issueCodes).toContain(
      'IPVA_INVALID_OFFER_MONTH',
    );
    expect(policies.some((policy) => policy.issueCodes.includes('SUSPICIOUS_IPVA_FLAG'))).toBe(
      false,
    );
  });

  it('uses a published, versioned CDI parameter set and compounded monthly conversion', () => {
    expect(LEGACY_CDI_PARAMETER_SET).toMatchObject({
      annualReferenceRate: '0.147800000000',
      status: 'published',
      version: 1,
      calculationMethod: 'effective_annual_to_monthly_compound',
    });
    expect(equivalentMonthlyRate('0.1478')).toBe(LEGACY_CDI_PARAMETER_SET.monthlyReferenceRate);
    expect(LEGACY_CDI_PARAMETER_SET.monthlyReferenceRate).not.toBe(
      new Decimal('0.1478').div(12).toFixed(12),
    );
  });

  it('preserves zero financing terms and calculates the official present-value subsidy', () => {
    const policy = classifyPolicies(
      [
        {
          ...emptyOffer,
          publicPrice: '100000',
          subsidizedRateMonthly: '0.00',
          downPaymentPercent: '0.00',
          installments: 24,
          rateRebate: '0.00',
        },
      ],
      null,
    ).find((candidate) => candidate.proposedPolicyType === 'subsidized_financing');
    expect(policy).toMatchObject({
      financedPrincipal: '100000.00',
      dealerRebateAmount: '0.00',
      financialParameterSetId: LEGACY_CDI_PARAMETER_SET.id,
      classification: 'classifiable_with_reconciliation',
      issueCodes: [],
    });
    expect(Number(policy?.proposedMonetaryValue)).toBeGreaterThan(0);
    expect(Number(policy?.totalPaidBenefit)).toBeGreaterThan(0);
  });

  it('distinguishes null financing inputs and a missing parameter set', () => {
    const incomplete = classifyPolicies(
      [{ ...emptyOffer, subsidizedRateMonthly: '0', downPaymentPercent: null, installments: 24 }],
      null,
    )[0];
    expect(incomplete?.issueCodes).toContain('INCOMPLETE_FINANCING_TERMS');
    const noParameter = classifyPolicies(
      [
        {
          ...emptyOffer,
          publicPrice: '100000',
          subsidizedRateMonthly: '0',
          downPaymentPercent: '40',
          installments: 24,
        },
      ],
      null,
      undefined,
      [],
    )[0];
    expect(noParameter?.issueCodes).toContain('UNPUBLISHED_FINANCIAL_PARAMETER_SET');
  });

  it('treats NULL/NULL/NULL and 0/0/0 as absence of financing without issues', () => {
    const policies = classifyPolicies(
      [
        {
          ...emptyOffer,
          id: '1',
          subsidizedRateMonthly: null,
          downPaymentPercent: null,
          installments: null,
        },
        {
          ...emptyOffer,
          id: '2',
          subsidizedRateMonthly: '0',
          downPaymentPercent: '0',
          installments: 0,
        },
      ],
      null,
    );
    expect(policies).toEqual([]);
  });

  it('uses CDI monthly plus a 0.30 percentage-point spread as the reference rate', () => {
    expect(LEGACY_CDI_PARAMETER_SET.monthlyReferenceRate).toBe('0.011553487442');
    expect(LEGACY_CDI_PARAMETER_SET.monthlySpreadRate).toBe('0.003000000000');
    expect(LEGACY_CDI_PARAMETER_SET.monthlyCombinedReferenceRate).toBe('0.014553487442');
  });

  it('calculates insurance as years times 3 percent of the linked MSRP', () => {
    const policies = classifyPolicies(
      [
        { ...emptyOffer, id: '1', publicPrice: '100000', insuranceYears: '1' },
        { ...emptyOffer, id: '2', publicPrice: '100000', insuranceYears: '2' },
        { ...emptyOffer, id: '3', publicPrice: '0', insuranceYears: '1' },
      ],
      null,
    ).filter((policy) => policy.proposedPolicyType === 'free_insurance');
    expect(policies.find((policy) => policy.sourceId === '1')).toMatchObject({
      proposedMonetaryValue: '3000.00',
      annualRate: '0.030000',
    });
    expect(policies.find((policy) => policy.sourceId === '2')?.proposedMonetaryValue).toBe(
      '6000.00',
    );
    expect(policies.find((policy) => policy.sourceId === '3')?.issueCodes).toContain(
      'INSURANCE_NON_POSITIVE_PUBLIC_PRICE',
    );
  });

  it('treats null rate as missing while retaining an explicitly zero down payment', () => {
    const policy = classifyPolicies(
      [
        {
          ...emptyOffer,
          publicPrice: '100000',
          subsidizedRateMonthly: null,
          downPaymentPercent: '0.00',
          installments: 24,
        },
      ],
      null,
    )[0];
    expect(policy?.issueCodes).toContain('INCOMPLETE_FINANCING_TERMS');
    expect(policy?.evidence).toContain('rate=NULL;down_payment=0.00');
  });

  it('calculates positive-rate financing and rejects invalid terms or negative economic value', () => {
    const positive = classifyPolicies(
      [
        {
          ...emptyOffer,
          publicPrice: '100000',
          subsidizedRateMonthly: '0.99',
          downPaymentPercent: '40',
          installments: 24,
        },
      ],
      null,
    )[0];
    expect(positive).toMatchObject({
      financedPrincipal: '60000.00',
      classification: 'classifiable_with_reconciliation',
    });

    const invalid = classifyPolicies(
      [{ ...emptyOffer, subsidizedRateMonthly: '0', downPaymentPercent: '40', installments: 0 }],
      null,
    )[0];
    expect(invalid?.issueCodes).toContain('INCOMPLETE_FINANCING_TERMS');

    const negative = classifyPolicies(
      [
        {
          ...emptyOffer,
          publicPrice: '100000',
          subsidizedRateMonthly: '5',
          downPaymentPercent: '40',
          installments: 24,
        },
      ],
      null,
    )[0];
    expect(negative?.issueCodes).toContain('NEGATIVE_ECONOMIC_VALUE');
    expect(negative?.proposedMonetaryValue).toBeNull();
  });

  it('reconciles OR policies by maximum, includes calculable IPVA and excludes rebate', () => {
    const offer = {
      ...emptyOffer,
      publicPrice: '100000',
      retailBonus: '1000',
      retailRebate: '9000',
      tradeInBonus: '2000',
      ipvaIncluded: true,
      totalCustomerBenefit: '4000',
    };
    const prices = classifyPublicPrices([offer], new Set(['101'])).candidates;
    const policies = classifyPolicies([offer], null);
    const row = reconcileOffers([offer], prices, policies)[0];
    expect(row).toMatchObject({
      maximumAlternativePolicyValue: '4000.00',
      sumOfAllPolicyValues: '7000.00',
      comparableTotal: '4000.00',
      status: 'MATCH',
    });
    expect(row?.componentsExcluded).toContain('dealer_rebate=9000.00');
  });

  it('separates real mismatch, partial and not-comparable reconciliation', () => {
    const mismatchOffer = { ...emptyOffer, retailBonus: '100', totalCustomerBenefit: '90' };
    const partialOffer = {
      ...emptyOffer,
      id: '2',
      retailBonus: '100',
      subsidizedRateMonthly: '0',
      totalCustomerBenefit: '100',
    };
    const empty = { ...emptyOffer, id: '3', totalCustomerBenefit: '1' };
    const offers = [mismatchOffer, partialOffer, empty];
    const rows = reconcileOffers(
      offers,
      classifyPublicPrices(offers, new Set(['101'])).candidates,
      classifyPolicies(offers, null),
    );
    expect(rows.find((row) => row.sourceId === '1')?.informationalIssueCodes).toContain(
      'LEGACY_CALCULATION_METHOD_DIFFERENCE',
    );
    expect(rows.find((row) => row.sourceId === '2')?.status).toBe('PARTIAL');
    expect(rows.find((row) => row.sourceId === '3')?.status).toBe('NOT_COMPARABLE');
  });

  it('includes a calculable financing benefit in reconciliation', () => {
    const offer = {
      ...emptyOffer,
      publicPrice: '100000',
      subsidizedRateMonthly: '0',
      downPaymentPercent: '40',
      installments: 24,
    };
    const policies = classifyPolicies([offer], null);
    const financing = policies.find(
      (policy) => policy.proposedPolicyType === 'subsidized_financing',
    );
    const row = reconcileOffers(
      [{ ...offer, totalCustomerBenefit: financing?.proposedMonetaryValue ?? null }],
      classifyPublicPrices([offer], new Set(['101'])).candidates,
      policies,
    )[0];
    expect(row?.status).toBe('MATCH');
    expect(row?.componentsIncluded).toContain('subsidized_financing=');
  });

  it('builds deterministic, traceable validation sample categories without database writes', async () => {
    const snapshot = await fixture();
    const result = runDryRun(snapshot, {
      algorithmVersion: '2.0.0',
      cutoffDate: null,
      insurancePercentage: '3',
      executedAt: '2026-07-26T20:00:00.000Z',
      excludeExecutedAtFromHash: true,
      failOnSourceChange: false,
    });
    const rebuilt = buildValidationSamples({
      offers: snapshot.offers,
      prices: result.publicPriceCandidates,
      policies: result.policyCandidates,
      accumulators: result.accumulatorCandidates,
      rebates: result.dealerRebateReconciliation,
      financing: result.financingAnalysis,
      reconciliation: result.reconciliation,
    });
    expect(rebuilt.rows).toEqual(result.validationSamples);
    expect(
      result.validationSamples.every(
        (row) => row.source_id !== '' && row.source_table === 'public.product_price_offers',
      ),
    ).toBe(true);
    expect(Object.keys(result.validationSampleSummary)).toEqual(
      expect.arrayContaining(['free_ipva', 'multiple_policies_or']),
    );
    expect(result.validationSampleSummary).toMatchObject({
      insurance_two_years: expect.any(Number),
      financing_zero_down_payment: expect.any(Number),
      promotional_rate_equals_reference: expect.any(Number),
    });
  });

  it('produces deterministic fingerprints, logical hashes and CSV', () => {
    expect(logicalHash({ b: 2, a: 1 })).toBe(logicalHash({ a: 1, b: 2 }));
    expect(logicalFingerprint('x', { b: 2, a: 1 })).toBe(logicalFingerprint('x', { a: 1, b: 2 }));
    expect(
      stableCsv(
        [{ id: '1', note: 'a,b' }],
        [
          { header: 'id', value: (row) => row.id },
          { header: 'note', value: (row) => row.note },
        ],
      ),
    ).toBe('id,note\n1,"a,b"\n');
  });

  it('rejects remote, wrong-port and malformed database URLs without exposing credentials', () => {
    expect(() => validateLocalDatabaseUrl('postgresql://user:secret@example.com:5432/db')).toThrow(
      'Remote database hosts are disabled',
    );
    expect(() => validateLocalDatabaseUrl('postgresql://user:secret@127.0.0.1:5432/db')).toThrow(
      'local Supabase port 54322',
    );
    expect(() =>
      validateLocalDatabaseUrl('postgresql://user:secret@127.0.0.1:54322/db?host=example.com'),
    ).toThrow('query parameters are disabled');
    expect(
      validateLocalDatabaseUrl('postgresql://user:secret@127.0.0.1:54322/db').sanitizedIdentity,
    ).toBe('127.0.0.1:54322/db');
  });

  it('runs the complete fixture with conflicts, reconciliation and view coverage', async () => {
    const first = runDryRun(await fixture(), {
      algorithmVersion: 'test-v1',
      cutoffDate: null,
      insurancePercentage: '3',
      executedAt: '2026-07-25T20:00:00.000Z',
      excludeExecutedAtFromHash: true,
      failOnSourceChange: false,
    });
    const second = runDryRun(await fixture(), {
      algorithmVersion: 'test-v1',
      cutoffDate: null,
      insurancePercentage: '3',
      executedAt: '2026-07-26T20:00:00.000Z',
      excludeExecutedAtFromHash: true,
      failOnSourceChange: false,
    });

    expect(first.publicPriceConflicts).toHaveLength(1);
    expect(
      first.publicPriceCandidates.some((candidate) =>
        candidate.issueCodes.includes('ZERO_PUBLIC_PRICE'),
      ),
    ).toBe(true);
    expect(
      first.reconciliation.some((row) =>
        row.informationalIssueCodes.includes('LEGACY_CALCULATION_METHOD_DIFFERENCE'),
      ),
    ).toBe(true);
    expect(first.needsReview.length).toBeGreaterThan(0);
    expect(first.summary.comparisonHash).toBe(second.summary.comparisonHash);
    expect(first.viewCoverage.find((row) => row.productId === '102')?.eligibleForV2).toBe(false);
  });
});
