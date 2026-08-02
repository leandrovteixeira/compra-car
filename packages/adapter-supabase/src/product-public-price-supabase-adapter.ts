import type {
  ListProductPublicPricesQuery,
  ProductPublicPricePage,
  ProductPublicPrice,
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
    const ascending = query.direction === 'asc';
    let request = this.client
      .from('product_public_prices')
      .select(PRICE_LIST_COLUMNS, { count: 'exact' });
    if (query.sort === 'vehicle') {
      request = request
        .order('brand', { ascending, referencedTable: 'product' })
        .order('model', { ascending, referencedTable: 'product' })
        .order('version', { ascending, referencedTable: 'product' })
        .order('model_year', { ascending, referencedTable: 'product' });
    } else {
      const column = {
        amount: 'amount',
        startsOn: 'starts_on',
        status: 'status',
        publishedAt: 'published_at',
        updatedAt: 'updated_at',
      }[query.sort];
      request = request.order(column, { ascending, nullsFirst: false });
    }
    const { data, error, count } = await request
      .order('id', { ascending })
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

  async publishProductPublicPrice(input: {
    readonly id: string;
    readonly expectedLockVersion: number;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ProductPublicPrice> {
    const { data: currentData, error: currentError } = await this.client
      .from('product_public_prices')
      .select(PRICE_LIST_COLUMNS)
      .eq('id', Number(input.id))
      .maybeSingle();
    if (currentError) throw queryError(currentError);
    if (!currentData) throw new PricingAdapterQueryError('Preço público não encontrado.');
    const currentRow = currentData as unknown as ProductPublicPriceRow;
    mapProductPublicPriceRow(currentRow);

    const { data, error } = await this.client.rpc('publish_product_public_price', {
      p_price_id: Number(input.id),
      p_actor_id: input.actorId,
      p_expected_lock_version: input.expectedLockVersion,
      p_correlation_id: input.correlationId,
    });
    if (error) throw queryError(error);
    return mapProductPublicPriceRow({
      ...(data as unknown as ProductPublicPriceRow),
      product: currentRow.product,
    });
  }
}
