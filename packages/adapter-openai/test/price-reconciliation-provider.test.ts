import { describe, expect, it } from 'vitest';
import { priceAiCost } from '../src/price-reconciliation-provider';

describe('price AI cost', () => {
  it('prices Luna token usage plus web search calls', () => {
    expect(
      priceAiCost('gpt-5.6-luna', {
        inputTokens: 5000,
        cachedInputTokens: 0,
        outputTokens: 500,
        webSearchCount: 1,
      }),
    ).toBeCloseTo(0.0116, 6);
  });

  it('applies cached-input pricing separately', () => {
    expect(
      priceAiCost('gpt-5.6-terra', {
        inputTokens: 10000,
        cachedInputTokens: 8000,
        outputTokens: 1000,
        webSearchCount: 0,
      }),
    ).toBeCloseTo(0.0176, 6);
  });

  it('rejects impossible usage', () => {
    expect(() =>
      priceAiCost('gpt-5.6-sol', {
        inputTokens: 100,
        cachedInputTokens: 101,
        outputTokens: 0,
        webSearchCount: 0,
      }),
    ).toThrow('PRICE_MODEL_USAGE_INVALID');
  });
});
