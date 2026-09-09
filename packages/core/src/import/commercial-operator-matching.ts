import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import { vehicleTextComparisonKey } from '../admin/vehicle-text-normalization';
import type { CommercialProductResolution } from './commercial-product-resolution';

export interface CommercialOperatorCatalogReader {
  listOperatorMatchingProducts(): Promise<readonly AdministrativeVehicle[]>;
}
export type PendingCommercialProduct = Exclude<CommercialProductResolution, { status: 'MATCHED' }>;
export interface OperatorMatchedCommercialProduct {
  readonly status: 'OPERATOR_MATCHED';
  readonly productExternalKey: string;
  readonly source: CommercialProductResolution['source'];
  readonly previousResolutionStatus: PendingCommercialProduct['status'];
  readonly resolvedProductId: string;
  readonly matchedProduct: AdministrativeVehicle;
  readonly resolutionMethod: 'OPERATOR';
  readonly reasonCode: 'PRODUCT_MATCHED_BY_OPERATOR';
}
export type EffectiveCommercialProductResolution =
  CommercialProductResolution | OperatorMatchedCommercialProduct;
export type CommercialOperatorDecisions = Readonly<
  Record<string, OperatorMatchedCommercialProduct>
>;

/** Candidate narrowing only, never a selection or similarity ranking. */
export function initialOperatorCandidates(
  product: CommercialProductResolution,
  catalog: readonly AdministrativeVehicle[],
): readonly AdministrativeVehicle[] {
  if (product.status === 'MATCHED') return [];
  if (product.status === 'AMBIGUOUS') return product.candidates;
  const source = product.source;
  if (!source.brand || !source.model || source.productionYear === null || source.modelYear === null)
    return [];
  return catalog.filter(
    (candidate) =>
      vehicleTextComparisonKey(candidate.brand) === vehicleTextComparisonKey(source.brand!) &&
      vehicleTextComparisonKey(candidate.model) === vehicleTextComparisonKey(source.model!) &&
      candidate.productionYear === source.productionYear &&
      candidate.modelYear === source.modelYear,
  );
}

/** Explicit operator intent: only an ID from the presented real catalog can be confirmed. */
export function confirmOperatorProduct(
  product: CommercialProductResolution,
  productId: string,
  candidates: readonly AdministrativeVehicle[],
): OperatorMatchedCommercialProduct {
  if (product.status === 'MATCHED' || !product.productExternalKey)
    throw new Error('Product is not eligible for operator matching.');
  const found = candidates.filter((candidate) => candidate.id === productId);
  if (found.length !== 1) throw new Error('Choose exactly one existing catalog Product.');
  return {
    status: 'OPERATOR_MATCHED',
    productExternalKey: product.productExternalKey,
    source: product.source,
    previousResolutionStatus: product.status,
    resolvedProductId: productId,
    matchedProduct: found[0]!,
    resolutionMethod: 'OPERATOR',
    reasonCode: 'PRODUCT_MATCHED_BY_OPERATOR',
  };
}

export function effectiveCommercialResolution(
  products: readonly CommercialProductResolution[],
  decisions: CommercialOperatorDecisions,
) {
  const effective: readonly EffectiveCommercialProductResolution[] = products.map((product) => {
    if (product.status === 'MATCHED' || !product.productExternalKey) return product;
    const decision = decisions[product.productExternalKey];
    // Decisions belong to the current preview source, not a reusable external key.
    return decision?.source === product.source ? decision : product;
  });
  const counts = {
    MATCHED: 0,
    OPERATOR_MATCHED: 0,
    NOT_FOUND: 0,
    AMBIGUOUS: 0,
    NEEDS_OPERATOR_DECISION: 0,
    PENDING: 0,
  };
  for (const product of effective) counts[product.status]++;
  counts.PENDING = counts.NOT_FOUND + counts.AMBIGUOUS + counts.NEEDS_OPERATOR_DECISION;
  return {
    products: effective,
    counts,
    status:
      counts.PENDING === 0 ? ('PRODUCTS_RESOLVED' as const) : ('PRODUCT_REVIEW_REQUIRED' as const),
  };
}
