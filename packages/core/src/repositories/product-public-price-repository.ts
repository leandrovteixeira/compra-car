import type { ProductPublicPrice } from '../entities/product-public-price';

export interface ListProductPublicPricesQuery {
  readonly limit: number;
  readonly offset: number;
}

export interface ProductPublicPricePage {
  readonly items: readonly ProductPublicPrice[];
  readonly total: number;
}

export interface ProductPublicPriceRepository {
  listProductPublicPrices(query: ListProductPublicPricesQuery): Promise<ProductPublicPricePage>;
}
