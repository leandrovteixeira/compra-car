import type { CommercialOperatorCatalogReader } from '../import/commercial-operator-matching';
import type { AgentMarketScope, ProductCatalogReader } from './new-product-check-types';
import { sameVehicleBrand } from './vehicle-brand-normalization';

/** Reuses the paginated, complete administrative read contract; no mutation capability. */
export class AdministrativeProductCatalogReader implements ProductCatalogReader {
  constructor(private readonly repository: CommercialOperatorCatalogReader) {}
  async readProducts(scope: AgentMarketScope) {
    return (await this.repository.listOperatorMatchingProducts()).filter(
      (product) => sameVehicleBrand(product.brand, scope.brand),
    );
  }
}
