import type { SupabaseClient } from '@supabase/supabase-js';
import {
  catalogMmvIdentityId,
  type PriceCatalogReader,
  type PriceTarget,
} from '@compra-car/core/agents';

type ProductRow = {
  id: number;
  brand: string;
  model: string;
  version: string;
  model_year: number;
  is_active: boolean;
};

type CurrentPriceRow = {
  id: number;
  product_id: number;
  amount: string | number;
  currency_code: string;
  starts_on: string;
};

export class PriceAgentSupabaseCatalogReader implements PriceCatalogReader {
  constructor(private readonly client: SupabaseClient) {}

  async readPriceTargets(brand: string, market: string): Promise<readonly PriceTarget[]> {
    if (market !== 'BR') throw new Error('PRICE_MARKET_UNSUPPORTED');

    const { data: productsData, error: productsError } = await this.client
      .from('products')
      .select('id,brand,model,version,model_year,is_active')
      .eq('is_active', true)
      .ilike('brand', brand)
      .limit(5000);
    if (productsError) throw new Error('PRICE_PRODUCTS_READ_FAILED');

    const products = (productsData ?? []) as ProductRow[];
    if (!products.length) return [];

    const ids = products.map((row) => row.id);
    const { data: pricesData, error: pricesError } = await this.client
      .from('vw_current_product_public_prices')
      .select('id,product_id,amount,currency_code,starts_on')
      .in('product_id', ids);
    if (pricesError) throw new Error('PRICE_CURRENT_READ_FAILED');

    const current = new Map(
      ((pricesData ?? []) as CurrentPriceRow[]).map((row) => [row.product_id, row]),
    );

    return products.map((row) => {
      const price = current.get(row.id);
      return {
        productId: String(row.id),
        mmvIdentity: catalogMmvIdentityId(row),
        brand: row.brand,
        model: row.model,
        version: row.version,
        modelYear: row.model_year,
        currentPrice:
          price && price.currency_code === 'BRL'
            ? {
                id: String(price.id),
                money: { amount: Number(price.amount).toFixed(2), currencyCode: 'BRL' as const },
                startsOn: price.starts_on,
                status: 'published' as const,
              }
            : null,
      };
    });
  }
}
