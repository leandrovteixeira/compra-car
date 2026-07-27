import type {
  ListProductPublicPricesQuery,
  ProductPublicPricePage,
  ProductPublicPriceRepository,
  ProductPublicPriceUpdateResult,
  ProductPublicPriceWriteInput,
} from '@compra-car/core';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterQueryError } from './errors';
import type { ProductPublicPriceRow, ProductPublicPriceStateRow } from './pricing-dtos';
import { mapProductPublicPriceRow } from './pricing-mappers';

const PRICE_LIST_COLUMNS =
  'id,product_id,amount,currency_code,starts_on,ends_on,status,published_at,created_at,updated_at,lock_version,product:products!product_public_prices_product_id_fkey(id,brand,model,version,model_year)';
const EDITABLE_STATUSES = ['draft', 'needs_review', 'rejected'] as const;

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

  async createProductPublicPrice(
    input: ProductPublicPriceWriteInput & { readonly actorId: string },
  ) {
    const { data, error } = await this.client
      .from('product_public_prices')
      .insert({
        product_id: Number(input.productId),
        amount: input.amount,
        currency_code: 'BRL',
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        status: 'draft',
        source_type: 'manual',
        source_snapshot: {},
        price_type: 'msrp',
        created_by: input.actorId,
        updated_by: input.actorId,
      })
      .select(PRICE_LIST_COLUMNS)
      .single();
    if (error) throw queryError(error);
    return mapProductPublicPriceRow(data as unknown as ProductPublicPriceRow);
  }

  async updateProductPublicPrice(
    input: Pick<ProductPublicPriceWriteInput, 'amount' | 'startsOn' | 'endsOn'> & {
      readonly id: string;
      readonly expectedLockVersion: number;
      readonly actorId: string;
    },
  ): Promise<ProductPublicPriceUpdateResult> {
    const { data, error } = await this.client
      .from('product_public_prices')
      .update({
        amount: input.amount,
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        updated_by: input.actorId,
      })
      .eq('id', Number(input.id))
      .eq('lock_version', input.expectedLockVersion)
      .in('status', [...EDITABLE_STATUSES])
      .select(PRICE_LIST_COLUMNS)
      .maybeSingle();
    if (error) throw queryError(error);
    if (data) {
      return {
        status: 'updated',
        price: mapProductPublicPriceRow(data as unknown as ProductPublicPriceRow),
      };
    }

    const state = await this.loadPriceState(input.id);
    if (!state) return { status: 'not_found' };
    if (!EDITABLE_STATUSES.includes(state.status as (typeof EDITABLE_STATUSES)[number])) {
      return { status: 'not_editable' };
    }
    return { status: 'conflict' };
  }

  private async loadPriceState(id: string): Promise<ProductPublicPriceStateRow | null> {
    const { data, error } = await this.client
      .from('product_public_prices')
      .select('status,lock_version')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) throw queryError(error);
    return data as ProductPublicPriceStateRow | null;
  }
}
