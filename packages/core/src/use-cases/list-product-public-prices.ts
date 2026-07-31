import type {
  ProductPublicPricePage,
  ProductPublicPriceRepository,
  ProductPublicPriceSort,
  SortDirection,
} from '../repositories/product-public-price-repository';

export const DEFAULT_PRODUCT_PUBLIC_PRICE_PAGE_SIZE = 25;
export const MAX_PRODUCT_PUBLIC_PRICE_PAGE_SIZE = 100;

export interface ListProductPublicPricesInput {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: ProductPublicPriceSort;
  readonly direction?: SortDirection;
}

export interface ListProductPublicPricesResult extends ProductPublicPricePage {
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly sort: ProductPublicPriceSort;
  readonly direction: SortDirection;
}

function positiveInteger(value: number | undefined, fallback: number, maximum?: number): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 1) return fallback;
  return maximum === undefined ? value : Math.min(value, maximum);
}

export class ListProductPublicPrices {
  constructor(private readonly repository: ProductPublicPriceRepository) {}

  async execute(input: ListProductPublicPricesInput = {}): Promise<ListProductPublicPricesResult> {
    const page = positiveInteger(input.page, 1);
    const pageSize = positiveInteger(
      input.pageSize,
      DEFAULT_PRODUCT_PUBLIC_PRICE_PAGE_SIZE,
      MAX_PRODUCT_PUBLIC_PRICE_PAGE_SIZE,
    );
    const result = await this.repository.listProductPublicPrices({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: input.sort ?? 'updatedAt',
      direction: input.direction ?? 'desc',
    });

    return {
      ...result,
      page,
      pageSize,
      pageCount: Math.ceil(result.total / pageSize),
      sort: input.sort ?? 'updatedAt',
      direction: input.direction ?? 'desc',
    };
  }
}
