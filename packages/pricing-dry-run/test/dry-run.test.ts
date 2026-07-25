import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { logicalFingerprint, logicalHash } from '../src/canonical.js';
import {
  classifyAccumulatorSuggestions,
  classifyPolicies,
  classifyPublicPrices,
  validateCandidateMoney,
} from '../src/classification.js';
import { validateLocalDatabaseUrl } from '../src/database.js';
import { decimal, money } from '../src/money.js';
import { stableCsv } from '../src/reports.js';
import { runDryRun } from '../src/runner.js';
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
      policies.find((policy) => policy.proposedPolicyType === 'subsidized_financing')?.issueCodes,
    ).toContain('UNPUBLISHED_FINANCIAL_PARAMETER_SET');
    expect(policies.some((policy) => policy.evidence.includes('total_customer_benefit'))).toBe(
      false,
    );
  });

  it('does not convert rebates and flags incomplete financing and missing descriptions', () => {
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
    expect(policies.some((policy) => policy.issueCodes.includes('UNSUPPORTED_REBATE_FIELD'))).toBe(
      true,
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

    expect(suggestions[0]?.andOrClassification).toBe('ambiguous_text');
    expect(suggestions[0]?.automaticallyPublishable).toBe(false);
    expect(suggestions[0]?.issueCodes).toContain('AMBIGUOUS_AND_OR_RELATION');
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
      first.reconciliation.some((row) => row.issueCodes.includes('LEGACY_TOTAL_MISMATCH')),
    ).toBe(true);
    expect(first.needsReview.length).toBeGreaterThan(0);
    expect(first.summary.comparisonHash).toBe(second.summary.comparisonHash);
    expect(first.viewCoverage.find((row) => row.productId === '102')?.eligibleForV2).toBe(false);
  });
});
