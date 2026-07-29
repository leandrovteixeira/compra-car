import { describe, expect, it, vi } from 'vitest';
import {
  CreateCommercialOfferDraft,
  type CommercialOfferBuilderRepository,
  type CommercialOfferBuilderPrice,
  type CommercialPolicy,
  validateCommercialOfferDraft,
} from '../src';
const price: CommercialOfferBuilderPrice = {
  id: '10',
  productId: '42',
  amount: '200000.00',
  startsOn: '2026-07-01',
  endsOn: '2026-12-31',
  status: 'published',
};
const policy = (
  id: string,
  amount: string,
  overrides: Partial<CommercialPolicy> = {},
): CommercialPolicy => ({
  id,
  productId: '42',
  policyType: 'retail_bonus',
  title: `Policy ${id}`,
  description: null,
  startsOn: '2026-07-01',
  endsOn: '2026-12-31',
  customerBenefitAmount: amount,
  status: 'draft',
  lockVersion: 1,
  ...overrides,
});
const input = {
  productId: '42',
  publicPriceId: '10',
  validFrom: '2026-08-01',
  validTo: '2026-08-31',
  policyIds: ['1', '2'],
};
describe('commercial offer builder', () => {
  it('calculates only explicitly selected policies without floating point', () => {
    expect(
      validateCommercialOfferDraft(input, price, [
        policy('1', '10000.01'),
        policy('2', '5000.02'),
        policy('3', '999.99'),
      ]),
    ).toMatchObject({
      ok: true,
      value: { benefitAmount: '15000.03', transactionalPrice: '184999.97' },
    });
  });
  it('accepts draft and published policies but rejects deprecated, cross-product and invalid periods', () => {
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [policy('1', '1.00')]).ok,
    ).toBe(true);
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [
        policy('1', '1.00', { status: 'published' }),
      ]).ok,
    ).toBe(true);
    for (const bad of [
      policy('1', '1.00', { productId: '99' }),
      policy('1', '1.00', { policyType: 'registration' }),
      policy('1', '1.00', { startsOn: '2026-08-02' }),
      policy('1', '1.00', { status: 'archived' }),
    ])
      expect(validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [bad]).ok).toBe(
        false,
      );
  });
  it('rejects zero, duplicate, missing policies and benefit above MSRP', () => {
    expect(validateCommercialOfferDraft({ ...input, policyIds: [] }, price, []).ok).toBe(false);
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1', '1'] }, price, [
        policy('1', '1.00'),
      ]).ok,
    ).toBe(false);
    expect(validateCommercialOfferDraft(input, price, [policy('1', '1.00')]).ok).toBe(false);
    expect(
      validateCommercialOfferDraft({ ...input, policyIds: ['1'] }, price, [
        policy('1', '200000.01'),
      ]).ok,
    ).toBe(false);
  });
  it('reloads trusted objects and passes only validated totals to atomic repository', async () => {
    const createOfferDraft = vi.fn(async ({ offer }) => ({
      id: '90',
      productId: '42',
      publicPriceId: '10',
      publicPriceAmount: '200000.00',
      validFrom: offer.validFrom,
      validTo: offer.validTo,
      status: 'draft' as const,
      policyIds: offer.policyIds,
      lockVersion: 1,
      benefitAmount: offer.benefitAmount,
      transactionalPrice: offer.transactionalPrice,
    }));
    const repository = {
      getPrice: vi.fn(async () => price),
      getPolicies: vi.fn(async () => [policy('1', '10000.00'), policy('2', '5000.00')]),
      createOfferDraft,
    } as unknown as CommercialOfferBuilderRepository;
    await expect(
      new CreateCommercialOfferDraft(repository).execute(input, {
        actorId: 'actor',
        correlationId: 'correlation',
      }),
    ).resolves.toMatchObject({ ok: true, offer: { transactionalPrice: '185000.00' } });
    expect(createOfferDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor',
        correlationId: 'correlation',
        offer: expect.objectContaining({ benefitAmount: '15000.00' }),
      }),
    );
  });
});
