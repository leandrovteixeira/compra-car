import type { ProductPublicPrice } from '../entities/product-public-price';
import type { ProductPublicPriceWriteInput } from '../admin/product-public-price';

export interface ListProductPublicPricesQuery {
  readonly limit: number;
  readonly offset: number;
  readonly sort: ProductPublicPriceSort;
  readonly direction: SortDirection;
}

export type ProductPublicPriceSort =
  'vehicle' | 'amount' | 'startsOn' | 'status' | 'publishedAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface ProductPublicPricePage {
  readonly items: readonly ProductPublicPrice[];
  readonly total: number;
}

export interface ProductPublicPriceRepository {
  listProductPublicPrices(query: ListProductPublicPricesQuery): Promise<ProductPublicPricePage>;
  createProductPublicPrice(
    input: ProductPublicPriceWriteInput & { readonly actorId: string },
  ): Promise<ProductPublicPrice>;
  updateProductPublicPrice(
    input: Pick<ProductPublicPriceWriteInput, 'amount' | 'startsOn' | 'endsOn'> & {
      readonly id: string;
      readonly expectedLockVersion: number;
      readonly actorId: string;
    },
  ): Promise<ProductPublicPriceUpdateResult>;
  publishProductPublicPrice(input: {
    readonly id: string;
    readonly expectedLockVersion: number;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ProductPublicPrice>;
}

export type ProductPublicPriceUpdateResult =
  | { readonly status: 'updated'; readonly price: ProductPublicPrice }
  | { readonly status: 'not_found' | 'not_editable' | 'conflict' };
