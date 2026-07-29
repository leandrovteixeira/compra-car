import {
  calculateManualPolicyBenefit,
  validateManualPolicyBatch,
  type ManualPolicyBatchRowInput,
} from '../src';
import { describe, expect, it } from 'vitest';
const base: ManualPolicyBatchRowInput = {
  clientRowId: 'row-1',
  productId: '1',
  policyType: 'retail_bonus',
  title: 'Bônus',
  description: '',
  startsOn: '2026-07-29',
  endsOn: null,
  amount: '5.000,00',
};
describe('manual policy batch', () => {
  it('normalizes fixed policies and rejects deprecated and duplicate fingerprints', () => {
    expect(validateManualPolicyBatch([base], {})).toMatchObject({
      ok: true,
      rows: [{ customerBenefitAmount: '5000.00' }],
    });
    expect(validateManualPolicyBatch([{ ...base, policyType: 'registration' }], {}).ok).toBe(false);
    expect(validateManualPolicyBatch([base, { ...base, clientRowId: 'row-2' }], {}).ok).toBe(false);
  });
  it('calculates registration, IPVA and insurance with decimal arithmetic', () => {
    const ref = { basePriceAmount: '200000.00' };
    expect(
      calculateManualPolicyBenefit(
        { ...base, policyType: 'free_registration', calculationBasePriceId: '1' },
        ref,
      ),
    ).toMatchObject({ customerBenefitAmount: '2000.00' });
    expect(
      calculateManualPolicyBenefit(
        {
          ...base,
          policyType: 'free_ipva',
          calculationBasePriceId: '1',
          annualRate: '0.04',
          offerMonth: '7',
        },
        ref,
      ),
    ).toEqual({ customerBenefitAmount: '4000.00', remainingMonths: 6 });
    expect(
      calculateManualPolicyBenefit(
        {
          ...base,
          policyType: 'free_insurance',
          calculationBasePriceId: '1',
          annualRate: '0.05',
          coverageYears: '2',
        },
        ref,
      ),
    ).toMatchObject({ customerBenefitAmount: '20000.00' });
  });
  it('derives financing from the persisted reference rate', () => {
    expect(
      calculateManualPolicyBenefit(
        {
          ...base,
          policyType: 'subsidized_financing',
          calculationBasePriceId: '1',
          termMonths: '24',
          customerInterestRateMonthly: '0.5',
          downPaymentPercentage: '20',
        },
        {
          basePriceAmount: '200000.00',
          financialParameterSetId: '7',
          monthlyReferenceRate: '0.014458',
        },
      ),
    ).toMatchObject({
      financialParameterSetId: '7',
      financedPrincipal: '160000.00',
      customerBenefitAmount: expect.stringMatching(/^\d+\.\d{2}$/u),
    });
  });
  it('supports all current fixed variants and validates specialized fields', () => {
    for (const policyType of [
      'retail_bonus',
      'trade_in_bonus',
      'free_wallbox',
      'free_maintenance',
      'fuel_or_recharge_voucher',
      'other',
    ]) {
      const row = {
        ...base,
        policyType,
        description: policyType === 'other' ? 'Detalhe' : '',
        voucherType: policyType === 'fuel_or_recharge_voucher' ? 'fuel' : undefined,
      };
      expect(validateManualPolicyBatch([row], {}).ok).toBe(true);
    }
    expect(
      validateManualPolicyBatch([{ ...base, policyType: 'other', description: '' }], {}).ok,
    ).toBe(false);
  });
  it('enforces empty and 100 row boundaries', () => {
    expect(validateManualPolicyBatch([], {}).ok).toBe(false);
    const rows = Array.from({ length: 100 }, (_, i) => ({
      ...base,
      clientRowId: `row-${i + 1}`,
      title: `Bônus ${i}`,
    }));
    expect(validateManualPolicyBatch(rows, {}).ok).toBe(true);
    expect(
      validateManualPolicyBatch([...rows, { ...base, clientRowId: 'row-101', title: 'extra' }], {})
        .ok,
    ).toBe(false);
  });
});
