import { describe, expect, it } from 'vitest';

import { decimalString, moneyDecimalString } from '../src/pricing-decimal';

describe('pricing decimal boundary', () => {
  it('canonicaliza numeric realista do PostgREST sem fazer cÃ¡lculo float', () => {
    expect(decimalString(1.1458, 'cdi')).toBe('1.1458');
    expect(decimalString(0.3, 'spread')).toBe('0.3');
    expect(decimalString(0.014458, 'reference')).toBe('0.014458');
    expect(decimalString(1e-7, 'small')).toBe('0.0000001');
  });

  it('normaliza amount numeric e rejeita precisÃ£o monetÃ¡ria incompatÃ­vel', () => {
    expect(moneyDecimalString(159990, 'amount')).toBe('159990.00');
    expect(moneyDecimalString('249990.5', 'amount')).toBe('249990.50');
    expect(() => moneyDecimalString(10.123, 'amount')).toThrow();
  });
});
