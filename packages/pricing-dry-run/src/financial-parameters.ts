import Decimal from 'decimal.js';

import type { FinancialParameterSet } from './types.js';

export function equivalentMonthlyRate(annualEffectiveRate: string): string {
  return new Decimal(1)
    .plus(annualEffectiveRate)
    .pow(new Decimal(1).div(12))
    .minus(1)
    .toDecimalPlaces(12, Decimal.ROUND_HALF_UP)
    .toFixed(12);
}

export const LEGACY_CDI_PARAMETER_SET: FinancialParameterSet = Object.freeze({
  id: 'cdi-legacy-migration-reference-v1',
  version: 1,
  name: 'CDI legacy migration reference',
  annualReferenceRate: '0.147800000000',
  monthlyReferenceRate: equivalentMonthlyRate('0.1478'),
  monthlySpreadRate: '0.003000000000',
  monthlyCombinedReferenceRate: new Decimal(equivalentMonthlyRate('0.1478'))
    .plus('0.003')
    .toFixed(12),
  rateType: 'CDI',
  validFrom: '2000-01-01',
  validTo: null,
  status: 'published',
  publishedAt: '2026-07-26T00:00:00.000Z',
  calculationMethod: 'effective_annual_to_monthly_compound',
  notes:
    'Provisional CDI reference for legacy migration dry-runs; replace through governed backoffice or automated source.',
});

export function validFinancialParameterSet(
  sets: FinancialParameterSet[],
  offerMonth: string | null,
): FinancialParameterSet | null {
  if (offerMonth === null) return null;
  return (
    [...sets]
      .filter(
        (set) =>
          set.status === 'published' &&
          set.validFrom <= offerMonth &&
          (set.validTo === null || set.validTo >= offerMonth),
      )
      .sort((left, right) => right.version - left.version)[0] ?? null
  );
}
