import type {
  CommercialOfferBuilderPrice,
  CommercialOfferBuilderRepository,
  CommercialOfferDraftSummary,
  CommercialPolicy,
  ManualPriceBatchProductOption,
  ValidatedCommercialOfferDraft,
} from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterMappingError, PricingAdapterQueryError } from './errors';
import { moneyDecimalString } from './pricing-decimal';
import { mapCommercialPolicyRow } from './commercial-pricing-supabase-adapter';
const records = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    : [];
const id = (value: unknown) => String(value);
const required = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value)
    throw new PricingAdapterMappingError(`Campo inválido no Offer Builder: ${field}.`);
  return value;
};
const money = moneyDecimalString;
const policyColumns =
  'id,product_id,policy_type,title,description,starts_on,ends_on,customer_benefit_amount,status,lock_version';
export class CommercialOfferBuilderSupabaseAdapter implements CommercialOfferBuilderRepository {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }
  async listProductOptions(): Promise<readonly ManualPriceBatchProductOption[]> {
    const { data, error } = await this.client
      .from('products')
      .select('id,brand,model,version,model_year,production_year,is_active,is_public')
      .order('brand')
      .order('model')
      .order('version');
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar os veículos.', {
        cause: error,
      });
    return records(data).map((r) => ({
      id: id(r.id),
      brand: required(r.brand, 'brand'),
      model: required(r.model, 'model'),
      version: required(r.version, 'version'),
      modelYear: id(r.model_year),
      productionYear: id(r.production_year),
      isActive: r.is_active === true,
      isPublic: r.is_public === true,
    }));
  }
  async listPublishedPrices(): Promise<readonly CommercialOfferBuilderPrice[]> {
    const { data, error } = await this.client
      .from('product_public_prices')
      .select('id,product_id,amount,starts_on,ends_on,status')
      .eq('status', 'published')
      .eq('currency_code', 'BRL')
      .eq('price_type', 'msrp')
      .gt('amount', 0)
      .order('starts_on', { ascending: false });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar os preços publicados.', {
        cause: error,
      });
    return records(data).map((r) => ({
      id: id(r.id),
      productId: id(r.product_id),
      amount: money(r.amount, 'amount'),
      startsOn: required(r.starts_on, 'starts_on'),
      endsOn: r.ends_on == null ? null : required(r.ends_on, 'ends_on'),
      status: 'published',
    }));
  }
  async listAvailablePolicies(): Promise<readonly CommercialPolicy[]> {
    const { data, error } = await this.client
      .from('commercial_policies')
      .select(policyColumns)
      .in('status', ['draft', 'needs_review', 'published'])
      .order('policy_type')
      .order('title')
      .order('id');
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar as políticas comerciais.', {
        cause: error,
      });
    return records(data).map((row) => mapCommercialPolicyRow(row as never));
  }
  async getPrice(value: string) {
    const prices = await this.listPublishedPrices();
    return prices.find((price) => price.id === value) ?? null;
  }
  async getPolicies(ids: readonly string[]) {
    if (!ids.length) return [];
    const { data, error } = await this.client
      .from('commercial_policies')
      .select(policyColumns)
      .in('id', ids.map(Number));
    if (error)
      throw new PricingAdapterQueryError('Não foi possível recarregar as políticas selecionadas.', {
        cause: error,
      });
    return records(data).map((row) => mapCommercialPolicyRow(row as never));
  }
  async createOfferDraft(input: {
    readonly offer: ValidatedCommercialOfferDraft;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<CommercialOfferDraftSummary> {
    const { data, error } = await this.client.rpc('create_commercial_offer_with_policies', {
      p_product_id: Number(input.offer.productId),
      p_public_price_id: Number(input.offer.publicPriceId),
      p_valid_from: input.offer.validFrom,
      p_valid_to: input.offer.validTo,
      p_policy_ids: input.offer.policyIds.map(Number),
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível salvar a oferta comercial.', {
        cause: error,
      });
    return this.mapSummary(data);
  }
  async listRecentDrafts(): Promise<readonly CommercialOfferDraftSummary[]> {
    const { data, error } = await this.client
      .from('commercial_offers')
      .select(
        'id,product_id,public_price_id,valid_from,valid_to,status,lock_version,public_price:product_public_prices!commercial_offers_public_price_id_fkey(amount),memberships:commercial_offer_policies!commercial_offer_policies_offer_id_fkey(commercial_policy_id,policy:commercial_policies!commercial_offer_policies_policy_id_fkey(customer_benefit_amount))',
      )
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar as ofertas recentes.', {
        cause: error,
      });
    return records(data).map((row) => this.mapQuerySummary(row));
  }
  private mapSummary(value: unknown): CommercialOfferDraftSummary {
    if (typeof value !== 'object' || value === null)
      throw new PricingAdapterMappingError('Resposta inválida do Offer Builder.');
    const r = value as Record<string, unknown>;
    return {
      id: id(r.offerId),
      productId: id(r.productId),
      publicPriceId: id(r.publicPriceId),
      publicPriceAmount: money(r.publicPriceAmount, 'publicPriceAmount'),
      validFrom: required(r.validFrom, 'validFrom'),
      validTo: required(r.validTo, 'validTo'),
      status: 'draft',
      policyIds: Array.isArray(r.policyIds) ? r.policyIds.map(id) : [],
      lockVersion: Number(r.lockVersion),
      benefitAmount: money(r.benefitAmount, 'benefitAmount'),
      transactionalPrice: money(r.transactionalPrice, 'transactionalPrice'),
    };
  }
  private mapQuerySummary(r: Record<string, unknown>): CommercialOfferDraftSummary {
    const price =
      records(r.public_price)[0] ??
      (typeof r.public_price === 'object' && r.public_price !== null
        ? (r.public_price as Record<string, unknown>)
        : {});
    const memberships = records(r.memberships);
    const amounts = memberships.map((m) => {
      const policy =
        records(m.policy)[0] ??
        (typeof m.policy === 'object' && m.policy !== null
          ? (m.policy as Record<string, unknown>)
          : {});
      return money(policy.customer_benefit_amount, 'benefit');
    });
    const cents = (value: string) => BigInt(value.replace('.', ''));
    const benefit = amounts.reduce((sum, value) => sum + cents(value), 0n);
    const priceCents = cents(money(price.amount, 'price'));
    const formatMoney = (value: bigint) =>
      `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
    return {
      id: id(r.id),
      productId: id(r.product_id),
      publicPriceId: id(r.public_price_id),
      publicPriceAmount: formatMoney(priceCents),
      validFrom: required(r.valid_from, 'validFrom'),
      validTo: required(r.valid_to, 'validTo'),
      status: 'draft',
      policyIds: memberships.map((m) => id(m.commercial_policy_id)),
      lockVersion: Number(r.lock_version),
      benefitAmount: formatMoney(benefit),
      transactionalPrice: formatMoney(priceCents - benefit),
    };
  }
}
