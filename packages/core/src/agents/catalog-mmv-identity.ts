import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import type { CanonicalMmv } from './mmv-apply-contract';
import {
  parseLegacyProductVersion,
  type LegacyParsedProduct,
} from './legacy-product-version-parser';

export interface CatalogMmvIdentity {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly canonicalVersionLabel: string;
  readonly normalizedBrand: string;
  readonly normalizedModel: string;
  readonly normalizedVersion: string;
  readonly parsedLegacyComponents: Omit<LegacyParsedProduct, 'product'>;
  /** Every occurrence, including its original label, PY/MY and visibility. */
  readonly productRows: readonly AdministrativeVehicle[];
}
export function catalogMmvIdentityId(
  product: Pick<AdministrativeVehicle, 'brand' | 'model' | 'version'>,
): string {
  return JSON.stringify([
    'catalog-mmv:v1',
    key(product.brand),
    key(product.model),
    key(product.version),
  ]);
}
export function projectCatalogMmvIdentities(
  products: readonly AdministrativeVehicle[],
): readonly CatalogMmvIdentity[] {
  const groups = new Map<string, AdministrativeVehicle[]>();
  for (const product of products) {
    const id = catalogMmvIdentityId(product);
    groups.set(id, [...(groups.get(id) ?? []), product]);
  }
  return [...groups.entries()].map(([id, rows]) => {
    // Ordering is for display only, never used to select an MMV by year.
    const productRows = [...rows].sort(
      (a, b) =>
        a.productionYear - b.productionYear ||
        a.modelYear - b.modelYear ||
        a.id.localeCompare(b.id),
    );
    const representative = productRows[0]!;
    const { product: _product, ...parsedLegacyComponents } =
      parseLegacyProductVersion(representative);
    void _product;
    return {
      id,
      brand: representative.brand,
      model: representative.model,
      canonicalVersionLabel: representative.version,
      normalizedBrand: key(representative.brand),
      normalizedModel: key(representative.model),
      normalizedVersion: key(representative.version),
      parsedLegacyComponents,
      productRows,
    };
  });
}


export function projectCanonicalMmvIdentities(
  mmvs: readonly CanonicalMmv[],
): readonly CatalogMmvIdentity[] {
  return mmvs.map((mmv) => {
    const synthetic: AdministrativeVehicle = {
      id: 'mmv:' + mmv.id,
      brand: mmv.brand,
      model: mmv.model,
      version: mmv.officialVersionLabel,
      productionYear: 2001,
      modelYear: 2001,
      isActive: mmv.status === 'ACTIVE',
      isPublic: mmv.visibility === 'PUBLIC',
    };
    const { product: _product, ...parsedLegacyComponents } =
      parseLegacyProductVersion(synthetic);
    void _product;
    return {
      id: mmv.id,
      brand: mmv.brand,
      model: mmv.model,
      canonicalVersionLabel: mmv.officialVersionLabel,
      normalizedBrand: key(mmv.brand),
      normalizedModel: key(mmv.model),
      normalizedVersion: key(mmv.officialVersionLabel),
      parsedLegacyComponents: {
        ...parsedLegacyComponents,
        powertrainLabel: mmv.powertrainLabel ?? parsedLegacyComponents.powertrainLabel,
        propulsion:
          (mmv.propulsion as LegacyParsedProduct['propulsion']) ??
          parsedLegacyComponents.propulsion,
        engineDisplacement:
          mmv.engineDisplacement ?? parsedLegacyComponents.engineDisplacement,
      },
      productRows: [],
    };
  });
}
