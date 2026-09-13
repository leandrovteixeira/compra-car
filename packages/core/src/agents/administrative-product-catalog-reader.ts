import type { CommercialOperatorCatalogReader } from '../import/commercial-operator-matching';
import { vehicleTextComparisonKey } from '../admin/vehicle-text-normalization';
import type { AgentMarketScope, ProductCatalogReader } from './new-product-check-types';

/** Reuses the paginated, complete administrative read contract; no mutation capability. */
export class AdministrativeProductCatalogReader implements ProductCatalogReader {
  constructor(private readonly repository: CommercialOperatorCatalogReader) {}
  async readProducts(scope: AgentMarketScope) {
    return (await this.repository.listOperatorMatchingProducts()).filter(
      (product) =>
        vehicleTextComparisonKey(product.brand) === vehicleTextComparisonKey(scope.brand),
    );
  }
}
