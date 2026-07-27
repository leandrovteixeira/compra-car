import type {
  ListProductPublicPricesQuery,
  ProductPublicPricePage,
  ProductPublicPriceRepository,
} from '@compra-car/core';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterQueryError } from './errors';
import type { ProductPublicPriceRow } from './pricing-dtos';
import { mapProductPublicPriceRow } from './pricing-mappers';

const PRICE_LIST_COLUMNS =
  'id,product_id,amount,currency_code,starts_on,ends_on,status,published_at,created_at,updated_at,product:products!product_public_prices_product_id_fkey(id,brand,model,version,model_year)';

function queryError(error: PostgrestError): PricingAdapterQueryError {
  return new PricingAdapterQueryError('Falha ao consultar preços públicos.', { cause: error });
}

export class ProductPublicPriceSupabaseAdapter implements ProductPublicPriceRepository {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }

  async listProductPublicPrices(
    query: ListProductPublicPricesQuery,
  ): Promise<ProductPublicPricePage> {
    const { data, error, count } = await this.client
      .from('product_public_prices')
      .select(PRICE_LIST_COLUMNS, { count: 'exact' })
      .order('starts_on', { ascending: false })
      .order('id', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) throw queryError(error);

    return Object.freeze({
      items: Object.freeze(
        ((data ?? []) as unknown as ProductPublicPriceRow[]).map(mapProductPublicPriceRow),
      ),
      total: count ?? 0,
    });
  }
}
