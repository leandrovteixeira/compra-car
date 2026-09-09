import {
  administrativeVehicleIdentity,
  type AdministrativeVehicle,
} from '../admin/administrative-vehicle';
import type { CommercialImportProductV1 } from './commercial-import-contract';

export type CommercialProductYearPair = Pick<AdministrativeVehicle, 'productionYear' | 'modelYear'>;

/** Read-only catalog port. Returned identities must include all candidates in the requested years. */
export interface CommercialProductCatalogReader {
  listCommercialResolutionProducts(
    years: readonly CommercialProductYearPair[],
  ): Promise<readonly AdministrativeVehicle[]>;
}

interface ProductResolutionSource {
  readonly productExternalKey: string | null;
  readonly source: CommercialImportProductV1;
}

export type CommercialProductResolution = ProductResolutionSource &
  (
    | {
        readonly status: 'MATCHED';
        readonly reasonCode: 'PRODUCT_MATCHED_EXACT';
        readonly resolvedProductId: string;
        readonly matchedProduct: AdministrativeVehicle;
      }
    | { readonly status: 'NOT_FOUND'; readonly reasonCode: 'PRODUCT_NOT_FOUND' }
    | {
        readonly status: 'AMBIGUOUS';
        readonly reasonCode: 'PRODUCT_MATCH_AMBIGUOUS';
        readonly candidates: readonly AdministrativeVehicle[];
      }
    | {
        readonly status: 'NEEDS_OPERATOR_DECISION';
        readonly reasonCode:
          | 'PRODUCT_YEAR_PAIR_MISSING'
          | 'PRODUCT_YEAR_PAIR_INCOMPLETE'
          | 'PRODUCT_IDENTITY_INCOMPLETE';
      }
  );

export interface CommercialProductResolutionSummary {
  readonly status: 'PRODUCT_RESOLUTION_COMPLETE' | 'PRODUCT_REVIEW_REQUIRED';
  readonly products: readonly CommercialProductResolution[];
  readonly counts: Readonly<Record<CommercialProductResolution['status'], number>>;
}

export function commercialProductResolutionYears(
  products: readonly CommercialImportProductV1[],
): readonly CommercialProductYearPair[] {
  const pairs = new Map<string, CommercialProductYearPair>();
  for (const product of products) {
    if (product.productionYear !== null && product.modelYear !== null) {
      pairs.set(`${product.productionYear}/${product.modelYear}`, {
        productionYear: product.productionYear,
        modelYear: product.modelYear,
      });
    }
  }
  return [...pairs.values()].sort(
    (a, b) => a.productionYear - b.productionYear || a.modelYear - b.modelYear,
  );
}

/** Exact identity only: documentary IDs, MVS, confidence and supplied resolution fields have no authority. */
export function resolveCommercialProducts(
  sources: readonly CommercialImportProductV1[],
  catalog: readonly AdministrativeVehicle[],
): CommercialProductResolutionSummary {
  const index = new Map<string, AdministrativeVehicle[]>();
  const ids = new Set<string>();
  for (const product of catalog) {
    if (
      !product.id ||
      ids.has(product.id) ||
      !product.brand.trim() ||
      !product.model.trim() ||
      !product.version.trim() ||
      !Number.isSafeInteger(product.productionYear) ||
      !Number.isSafeInteger(product.modelYear) ||
      product.productionYear < 1900 ||
      product.modelYear < 1900
    ) {
      throw new Error('Catalog identity is incomplete or duplicated by ID.');
    }
    ids.add(product.id);
    const key = administrativeVehicleIdentity(product);
    const candidates = index.get(key) ?? [];
    candidates.push(product);
    index.set(key, candidates);
  }
  for (const candidates of index.values())
    candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const products = sources.map((source): CommercialProductResolution => {
    const base = { productExternalKey: source.productExternalKey, source };
    if (source.productionYear === null && source.modelYear === null)
      return {
        ...base,
        status: 'NEEDS_OPERATOR_DECISION',
        reasonCode: 'PRODUCT_YEAR_PAIR_MISSING',
      };
    if (source.productionYear === null || source.modelYear === null)
      return {
        ...base,
        status: 'NEEDS_OPERATOR_DECISION',
        reasonCode: 'PRODUCT_YEAR_PAIR_INCOMPLETE',
      };
    if (
      !source.brand?.trim() ||
      !source.model?.trim() ||
      !source.version?.trim() ||
      !Number.isSafeInteger(source.productionYear) ||
      !Number.isSafeInteger(source.modelYear)
    )
      return {
        ...base,
        status: 'NEEDS_OPERATOR_DECISION',
        reasonCode: 'PRODUCT_IDENTITY_INCOMPLETE',
      };
    const key = administrativeVehicleIdentity({
      brand: source.brand,
      model: source.model,
      version: source.version,
      productionYear: source.productionYear,
      modelYear: source.modelYear,
    });
    const candidates = index.get(key) ?? [];
    if (candidates.length > 1)
      return { ...base, status: 'AMBIGUOUS', reasonCode: 'PRODUCT_MATCH_AMBIGUOUS', candidates };
    const matchedProduct = candidates[0];
    if (!matchedProduct) return { ...base, status: 'NOT_FOUND', reasonCode: 'PRODUCT_NOT_FOUND' };
    return {
      ...base,
      status: 'MATCHED',
      reasonCode: 'PRODUCT_MATCHED_EXACT',
      resolvedProductId: matchedProduct.id,
      matchedProduct,
    };
  });
  const counts = { MATCHED: 0, NOT_FOUND: 0, AMBIGUOUS: 0, NEEDS_OPERATOR_DECISION: 0 };
  for (const product of products) counts[product.status]++;
  return {
    status:
      counts.MATCHED === products.length
        ? 'PRODUCT_RESOLUTION_COMPLETE'
        : 'PRODUCT_REVIEW_REQUIRED',
    products,
    counts,
  };
}
