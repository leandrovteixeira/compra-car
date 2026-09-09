import { describe, expect, it } from 'vitest';
import {
  confirmOperatorProduct,
  effectiveCommercialResolution,
  initialOperatorCandidates,
} from '../src/import/commercial-operator-matching';
import { resolveCommercialProducts } from '../src/import/commercial-product-resolution';
import type { AdministrativeVehicle } from '../src/admin/administrative-vehicle';
import { validContract } from './fixtures/import/structured-commercial-fixture';

const source = () => validContract().products[0]!;
const candidate = (overrides: Partial<AdministrativeVehicle> = {}): AdministrativeVehicle => ({
  id: 'real-1',
  brand: 'Jeep',
  model: 'Compass',
  version: 'Longitude 1.3 TGDI AT',
  productionYear: 2026,
  modelYear: 2026,
  isActive: true,
  isPublic: false,
  ...overrides,
});

describe('operator product matching', () => {
  it.each(['NOT_FOUND', 'AMBIGUOUS', 'NEEDS_OPERATOR_DECISION'] as const)(
    'confirms %s explicitly, preserving source and previous status',
    (status) => {
      const documentary = {
        ...source(),
        ...(status === 'NEEDS_OPERATOR_DECISION' ? { productionYear: null, modelYear: null } : {}),
      };
      const catalog =
        status === 'AMBIGUOUS'
          ? [candidate({ version: 'Longitude' }), candidate({ id: 'real-2', version: 'Longitude' })]
          : [];
      const product = resolveCommercialProducts([documentary], catalog).products[0]!;
      expect(product.status).toBe(status);
      const before = structuredClone(product);
      const decision = confirmOperatorProduct(product, 'real-1', [candidate()]);
      expect(decision).toMatchObject({
        status: 'OPERATOR_MATCHED',
        previousResolutionStatus: status,
        resolutionMethod: 'OPERATOR',
        reasonCode: 'PRODUCT_MATCHED_BY_OPERATOR',
        resolvedProductId: 'real-1',
        matchedProduct: candidate(),
      });
      expect(decision.source).toBe(documentary);
      expect(product).toEqual(before);
      if (status === 'NEEDS_OPERATOR_DECISION') {
        expect(decision.source.modelYear).toBeNull();
        expect(decision.matchedProduct.modelYear).toBe(2026);
      }
    },
  );
  it('preserves automatic MATCHED and rejects operator replacement', () => {
    const product = resolveCommercialProducts([source()], [candidate({ version: 'Longitude' })])
      .products[0]!;
    expect(() => confirmOperatorProduct(product, 'real-1', [candidate()])).toThrow();
    expect(effectiveCommercialResolution([product], {}).products[0]).toBe(product);
  });
  it('narrows by canonical brand/model and exact year pair, never version', () => {
    const product = resolveCommercialProducts(
      [{ ...source(), brand: ' JEEP ', model: '  ComPASS ' }],
      [],
    ).products[0]!;
    const options = [
      candidate(),
      candidate({ id: 'two', version: 'Completely different' }),
      candidate({ id: 'other-brand', brand: 'Fiat' }),
      candidate({ id: 'other-model', model: 'Renegade' }),
      candidate({ id: 'other-py', productionYear: 2025 }),
      candidate({ id: 'other-my', modelYear: 2027 }),
    ];
    expect(initialOperatorCandidates(product, options).map((p) => p.id)).toEqual(['real-1', 'two']);
    expect(effectiveCommercialResolution([product], {}).counts.OPERATOR_MATCHED).toBe(0);
  });
  it('presents the original exact candidates for AMBIGUOUS', () => {
    const catalog = [
      candidate({ version: 'Longitude' }),
      candidate({ id: 'two', version: 'Longitude' }),
    ];
    const product = resolveCommercialProducts([source()], catalog).products[0]!;
    expect(initialOperatorCandidates(product, [])).toEqual(catalog);
  });
  it('permits explicit fallback selection outside the initial scope without changing the document', () => {
    const product = resolveCommercialProducts([source()], []).products[0]!;
    const fallback = candidate({ id: 'other', model: 'Different model', productionYear: 2025 });
    expect(initialOperatorCandidates(product, [fallback])).toEqual([]);
    const decision = confirmOperatorProduct(product, 'other', [fallback]);
    expect(decision.source.model).toBe('Compass');
    expect(decision.matchedProduct).toEqual(fallback);
  });
  it('rejects missing and duplicate candidate IDs', () => {
    const product = resolveCommercialProducts([source()], []).products[0]!;
    expect(() => confirmOperatorProduct(product, 'unknown', [candidate()])).toThrow();
    expect(() => confirmOperatorProduct(product, 'real-1', [candidate(), candidate()])).toThrow();
  });
  it('counts pending and allows the same real Product for distinct unchanged documentary variants', () => {
    const sources = ['Blackhawk Hurricane', 'Blackhawk Flex', 'Sport + Pack Tech'].map(
      (version, i) => ({ ...source(), productExternalKey: `source-${i}`, version }),
    );
    const products = resolveCommercialProducts(sources, []).products;
    const first = confirmOperatorProduct(products[0]!, 'real-1', [candidate()]);
    expect(
      effectiveCommercialResolution(products, { [first.productExternalKey]: first }).counts,
    ).toMatchObject({ OPERATOR_MATCHED: 1, PENDING: 2 });
    const decisions = Object.fromEntries(
      products.map((p) => [
        p.productExternalKey!,
        confirmOperatorProduct(p, 'real-1', [candidate()]),
      ]),
    );
    const summary = effectiveCommercialResolution(products, decisions);
    expect(summary).toMatchObject({
      status: 'PRODUCTS_RESOLVED',
      counts: { MATCHED: 0, OPERATOR_MATCHED: 3, PENDING: 0 },
    });
    expect(summary.products.map((p) => p.source.version)).toEqual(sources.map((p) => p.version));
    expect(effectiveCommercialResolution(products, {}).counts.PENDING).toBe(3);
    expect(
      effectiveCommercialResolution(
        resolveCommercialProducts(structuredClone(sources), []).products,
        decisions,
      ).counts.PENDING,
    ).toBe(3);
  });
});
