import { describe, expect, it } from 'vitest';

import { normalizeProductPriceToolV74Rows } from '../src/import/product-price-tool-v74';
import type { MatrixRow } from '../src/import/vehicle-specs-matrix-dry-run';

const row = (code: string, values: Readonly<Record<string, string | number>>): MatrixRow => ({
  code,
  ...values,
});

describe('Product Price Tool V.74 specs connector', () => {
  it('normalizes historical code semantics without changing canonical DB meaning', () => {
    const result = normalizeProductPriceToolV74Rows([
      row('SC_0001', { B: 'Car A', C: 'Car B', D: 'Car C' }),
      row('SC_0002', { B: 'Brand', C: 'Brand', D: 'Brand' }),
      row('SC_0003', { B: 'Model', C: 'Model', D: 'Model' }),
      row('SC_0004', { B: 'A', C: 'B', D: 'C' }),
      row('SC_0005', { B: 2526, C: 2526, D: 2627 }),
      row('PW_0016', { B: 'S', C: 0, D: 0 }),
      row('PW_0018', { B: 0, C: 'S', D: 0 }),
      row('EX_0030', { B: 'S', C: 'S', D: 0 }),
      row('EX_0031', { B: 0, C: 'S', D: 'S' }),
      row('SF_0034', { B: 'S', C: 'S', D: 0 }),
      row('SF_0035', { B: 0, C: 'S', D: 0 }),
      row('CO_0033', { B: 'Alert&Can be closed', C: 0, D: 'S' }),
      row('SF_0041', { B: 'USB', C: 0, D: 'S' }),
      row('PW_0012', { B: 300, C: 400, D: 500 }),
      row('PW_0013', { B: 30.6, C: 40.8, D: 51 }),
      row('CO_0056', { B: '', C: 'S', D: '' }),
    ]);

    const byCode = new Map(result.normalizedRows.map((item) => [String(item.code), item]));

    expect(byCode.get('SC_0005')?.B).toBe('25/26');
    expect(byCode.get('SC_0005')?.D).toBe('26/27');

    expect(byCode.has('PW_0016')).toBe(false);
    expect(byCode.get('PW_1045')?.B).toBe('S');

    expect(byCode.get('EX_0030')?.B).toBe('S');
    expect(byCode.get('EX_0031')?.C).toBe('S');
    expect(byCode.get('EX_1006')?.D).toBe('S');
    expect(byCode.get('EX_1012')?.B).toBeUndefined();

    expect(byCode.get('SF_0034')?.B).toBe('S');
    expect(byCode.get('SF_0034')?.C).toBe('0');
    expect(byCode.get('SF_0035')?.C).toBe('S');

    expect(byCode.get('CO_0033')?.B).toBe('S');
    expect(byCode.get('SF_0041')?.B).toBe('0');

    expect(byCode.has('PW_0013')).toBe(false);
    expect(byCode.get('PW_0012')?.B).toBe(300);
    expect(byCode.get('CO_0056')?.C).toBe('S');
  });

  it('reports redundant kgfm aliases only when they disagree materially with Nm', () => {
    const result = normalizeProductPriceToolV74Rows([
      row('SC_0001', { B: 'Car A', C: 'Car B' }),
      row('SC_0002', { B: 'Brand', C: 'Brand' }),
      row('SC_0003', { B: 'Model', C: 'Model' }),
      row('SC_0004', { B: 'A', C: 'B' }),
      row('SC_0005', { B: 2526, C: 2526 }),
      row('PW_0012', { B: 300, C: 629 }),
      row('PW_0013', { B: 30.6, C: 66.3 }),
    ]);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      category: 'ALIAS_CONVERSION_MISMATCH',
      sourceCode: 'PW_0013',
      targetCode: 'PW_0012',
      sourceColumn: 'C',
    });
  });
});
