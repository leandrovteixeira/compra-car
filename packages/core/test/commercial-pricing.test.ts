import { describe, expect, it } from 'vitest';

import {
  calculateCommercialOfferBenefit,
  calculateTransactionalPrice,
  validateCommercialOfferComposition,
  validateCommercialPolicyInput,
} from '../src';

const common = {
  productId: '42',
  title: 'Policy',
  startsOn: '2026-08-01',
  endsOn: '2026-08-31',
};

describe('Pricing Domain V2', () => {
  it('validates discriminated fixed inputs and rejects non-applicable fields', () => {
    expect(
      validateCommercialPolicyInput({
        ...common,
        policyType: 'free_wallbox',
        amount: '4000.00',
      }),
    ).toEqual({ ok: true, errors: [], customerBenefitAmount: '4000.00' });
    expect(
      validateCommercialPolicyInput({
        ...common,
        policyType: 'free_wallbox',
        amount: '4000.00',
        termMonths: 24,
      }),
    ).toMatchObject({ ok: false, errors: [expect.stringContaining('termMonths')] });
  });

  it('requires monetary maintenance and other policies', () => {
    expect(
      validateCommercialPolicyInput({ ...common, policyType: 'free_maintenance' }),
    ).toMatchObject({ ok: false });
    expect(
      validateCommercialPolicyInput({ ...common, policyType: 'other', amount: '1000.00' }),
    ).toMatchObject({ ok: false });
    expect(
      validateCommercialPolicyInput({
        ...common,
        policyType: 'other',
        description: 'Documented benefit',
        amount: '1000.00',
      }),
    ).toMatchObject({ ok: true, customerBenefitAmount: '1000.00' });
  });

  it('derives registration at exactly one percent without a manual amount field', () => {
    expect(
      validateCommercialPolicyInput({
        ...common,
        policyType: 'free_registration',
        calculationBasePriceId: '10',
        basePriceAmount: '200000.00',
      }),
    ).toEqual({ ok: true, errors: [], customerBenefitAmount: '2000.00' });
    expect(
      validateCommercialPolicyInput({
        ...common,
        policyType: 'free_registration',
        calculationBasePriceId: '10',
        basePriceAmount: '200000.00',
        amount: '1.00',
      }),
    ).toMatchObject({ ok: false, errors: [expect.stringContaining('amount')] });
  });

  it('calculates only explicit offer combinations using exact decimal strings', () => {
    const rate = { id: 'p1', productId: '42', customerBenefitAmount: '12000.00' };
    const tradeIn = { id: 'p2', productId: '42', customerBenefitAmount: '10000.00' };
    const insurance = { id: 'p3', productId: '42', customerBenefitAmount: '4000.00' };

    expect(calculateCommercialOfferBenefit([rate, insurance], '42')).toBe('16000.00');
    expect(calculateTransactionalPrice('200000.00', [rate, insurance], '42')).toBe('184000.00');
    expect(calculateTransactionalPrice('200000.00', [tradeIn, insurance], '42')).toBe('186000.00');
    expect(calculateTransactionalPrice('200000.00', [rate, tradeIn], '42')).toBe('178000.00');
  });

  it('rejects cross-product, duplicate and negative transactional compositions', () => {
    const policy = { id: 'p1', productId: '42', customerBenefitAmount: '12000.00' };
    expect(() => calculateCommercialOfferBenefit([policy, policy], '42')).toThrow(/twice/u);
    expect(() =>
      calculateCommercialOfferBenefit(
        [policy, { id: 'p2', productId: '99', customerBenefitAmount: '1.00' }],
        '42',
      ),
    ).toThrow(/one product/u);
    expect(() => calculateTransactionalPrice('100.00', [policy], '42')).toThrow(/exceed/u);
  });

  it('validates independent policy lifecycle, product and full-period coverage', () => {
    const offer = { productId: '42', validFrom: '2026-08-01', validTo: '2026-08-31' };
    expect(
      validateCommercialOfferComposition(offer, [
        {
          id: 'p1',
          productId: '42',
          startsOn: '2026-07-01',
          endsOn: null,
          status: 'published',
          customerBenefitAmount: '1.00',
        },
      ]),
    ).toEqual([]);
    expect(
      validateCommercialOfferComposition(offer, [
        {
          id: 'p2',
          productId: '99',
          startsOn: '2026-08-02',
          endsOn: '2026-08-30',
          status: 'draft',
          customerBenefitAmount: '1.00',
        },
      ]),
    ).toHaveLength(3);
  });
});
