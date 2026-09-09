import { describe, expect, it } from 'vitest';
import {
  resolveCommercialProducts,
  commercialProductResolutionYears,
} from '../src/import/commercial-product-resolution';
import { validateCommercialImportContractV1 } from '../src/import/commercial-import-structural-validator';
import { validContract } from './fixtures/import/structured-commercial-fixture';
import type { AdministrativeVehicle } from '../src/admin/administrative-vehicle';

const source = () => validContract().products[0]!;
const target = (overrides: Partial<AdministrativeVehicle> = {}): AdministrativeVehicle => ({
  id: '1',
  brand: 'Jeep',
  model: 'Compass',
  version: 'Longitude',
  productionYear: 2026,
  modelYear: 2026,
  isActive: false,
  isPublic: false,
  ...overrides,
});

describe('commercial exact product resolution', () => {
  it('matches one existing identity, preserving source and real catalog identity', () => {
    const documentary = {
      ...source(),
      resolvedProductId: 'untrusted-id',
      sourceMvs: 'untrusted-code',
    };
    const result = resolveCommercialProducts([documentary], [target()]);
    expect(result.status).toBe('PRODUCT_RESOLUTION_COMPLETE');
    expect(result.counts).toEqual({
      MATCHED: 1,
      NOT_FOUND: 0,
      AMBIGUOUS: 0,
      NEEDS_OPERATOR_DECISION: 0,
    });
    expect(result.products[0]).toEqual({
      status: 'MATCHED',
      reasonCode: 'PRODUCT_MATCHED_EXACT',
      source: documentary,
      productExternalKey: documentary.productExternalKey,
      resolvedProductId: '1',
      matchedProduct: target(),
    });
  });
  it('reuses administrative whitespace and case normalization', () => {
    expect(
      resolveCommercialProducts(
        [{ ...source(), brand: '  JEEP ', model: ' comPASS ', version: '  Longitude   T270 ' }],
        [target({ version: 'longitude T270' })],
      ).products[0]?.status,
    ).toBe('MATCHED');
  });
  it.each([
    { version: 'Longitude T270' },
    { brand: 'Jeep2' },
    { model: 'Cômpass' },
    { version: 'Longi-tude' },
    { productionYear: 2025 },
    { modelYear: 2027 },
  ])('does not approximate identities %j', (overrides) => {
    expect(resolveCommercialProducts([source()], [target(overrides)]).products[0]?.status).toBe(
      'NOT_FOUND',
    );
  });
  it('returns all ambiguous candidates ordered independently of catalog input order', () => {
    const catalog = [target({ id: '2', version: ' LONGITUDE ' }), target()];
    const result = resolveCommercialProducts([source()], catalog);
    expect(result).toEqual(resolveCommercialProducts([source()], [...catalog].reverse()));
    expect(result.products[0]).toMatchObject({
      status: 'AMBIGUOUS',
      reasonCode: 'PRODUCT_MATCH_AMBIGUOUS',
      candidates: [target(), catalog[0]],
    });
    expect(result.status).toBe('PRODUCT_REVIEW_REQUIRED');
  });
  it('requires operator decisions for absent years and never uses the only nearby product', () => {
    const product = { ...source(), productionYear: null, modelYear: null };
    expect(resolveCommercialProducts([product], [target()]).products[0]).toMatchObject({
      status: 'NEEDS_OPERATOR_DECISION',
      reasonCode: 'PRODUCT_YEAR_PAIR_MISSING',
    });
    expect(commercialProductResolutionYears([product])).toEqual([]);
  });
  it.each(['productionYear', 'modelYear'] as const)(
    'blocks a partial year pair structurally: %s',
    (field) => {
      const product = { ...source(), [field]: null };
      const validation = validateCommercialImportContractV1({
        ...validContract(),
        products: [product],
      });
      expect(validation.ok).toBe(false);
      expect(validation.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_VALUE',
          sheet: 'Products',
          column: field === 'productionYear' ? 'production_year' : 'model_year',
        }),
      );
      expect(resolveCommercialProducts([product], [target()]).products[0]?.status).toBe(
        'NEEDS_OPERATOR_DECISION',
      );
    },
  );
  it('does not repair incomplete documentary text', () => {
    expect(
      resolveCommercialProducts([{ ...source(), brand: null }], [target()]).products[0],
    ).toMatchObject({
      status: 'NEEDS_OPERATOR_DECISION',
      reasonCode: 'PRODUCT_IDENTITY_INCOMPLETE',
    });
  });
  it('derives stable batch years without repeated lookups', () => {
    expect(
      commercialProductResolutionYears([source(), source(), { ...source(), productionYear: 2025 }]),
    ).toEqual([
      { productionYear: 2025, modelYear: 2026 },
      { productionYear: 2026, modelYear: 2026 },
    ]);
  });
  it('fails closed on invalid or repeated catalog IDs', () => {
    expect(() => resolveCommercialProducts([source()], [target(), target()])).toThrow();
    expect(() =>
      resolveCommercialProducts([source()], [target({ productionYear: NaN })]),
    ).toThrow();
  });
});
