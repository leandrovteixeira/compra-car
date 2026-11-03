import { describe, expect, it } from 'vitest';
import { classifyPriceCheck, reconcilePriceObservations } from '../src/agents/price-agent';
import type { PriceObservation, PriceTarget } from '../src/agents/price-agent-types';

const target = {
  productId: 'example-product', mmvIdentity: 'mmv-1',
  brand: 'Kia', model: 'Niro', version: 'EX', modelYear: 2027,
  currentPrice: null,
} as PriceTarget;
const observation = (amount: string | null, bonus: string | null = null) => ({
  target, currencyCode: 'BRL', msrpAmount: amount,
  publicOfferAmount: null, retailBonusAmount: bonus,
  validFrom: null, validTo: null, confidence: 0.8,
  ambiguityReasons: [],
  evidence: [{ sourceUrl: 'https://www.kia.com.br/niro',
    sourceKind: 'OFFICIAL_MODEL_PAGE', contentHash: 'hash',
    locator: 'test', excerpt: 'official pricing', capturedAt: '2026-11-01T00:00:00Z' }],
}) as PriceObservation;

describe('Sprint 26C price check classification', () => {
  it('records not_found without valid evidence', () => {
    expect(classifyPriceCheck(target, null)).toBe('not_found');
    expect(classifyPriceCheck(target, observation(null))).toBe('not_found');
  });
  it('rejects promotional bonus mistaken for MSRP', () => {
    const invalid = observation('20000.00', '20000.00');
    expect(classifyPriceCheck(target, invalid)).toBe('not_found');
    expect(reconcilePriceObservations([invalid]).accepted).toHaveLength(0);
  });
  it('distinguishes unchanged published MSRP from new prices', () => {
    const withPrice = {...target, currentPrice: {id:'price-1',
      money:{amount:'194990.00',currencyCode:'BRL'},
      startsOn:'2026-11-01',status:'PUBLISHED'}} as unknown as PriceTarget;
    expect(classifyPriceCheck(withPrice, {...observation('194990.00'),target:withPrice}))
      .toBe('unchanged');
    expect(classifyPriceCheck(withPrice, {...observation('199990.00'),target:withPrice}))
      .toBe('new_price');
    expect(classifyPriceCheck(target, observation('194990.00'))).toBe('new_price');
  });
});
