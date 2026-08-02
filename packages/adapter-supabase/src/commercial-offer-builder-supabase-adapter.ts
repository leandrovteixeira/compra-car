import type {
  CommercialOfferBuilderPrice,
  CommercialOfferBuilderRepository,
  CommercialOfferDraftSummary,
  CommercialWorkspacePeriod,
  ManualPriceBatchProductOption,
  PolicyCombinationBatchResult,
  PolicyCombinationPolicy,
  PolicyCombinationRowInput,
  ValidatedCommercialOfferDraft,
} from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterMappingError, PricingAdapterQueryError } from './errors';
import { decimalString, moneyDecimalString } from './pricing-decimal';
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
  'id,product_id,policy_type,title,description,starts_on,ends_on,customer_benefit_amount,dealer_rebate_amount,status,lock_version,fixed_amount,annual_rate,coverage_years,remaining_months,offer_month,financed_principal,down_payment_percentage,term_months,customer_interest_rate_monthly,voucher_type,policy_parameters';

function optionalDecimal(value: unknown, field: string): string | null {
  return value == null ? null : decimalString(value, field);
}

function mapPolicy(row: Record<string, unknown>): PolicyCombinationPolicy {
  return {
    ...mapCommercialPolicyRow(row as never),
    fixedAmount: valueOrNull(row.fixed_amount, (value) => money(value, 'fixed_amount')),
    annualRate: optionalDecimal(row.annual_rate, 'annual_rate'),
    coverageYears: optionalDecimal(row.coverage_years, 'coverage_years'),
    remainingMonths: row.remaining_months == null ? null : Number(row.remaining_months),
    offerMonth: row.offer_month == null ? null : Number(row.offer_month),
    financedPrincipal: valueOrNull(row.financed_principal, (value) =>
      money(value, 'financed_principal'),
    ),
    downPaymentPercentage: optionalDecimal(row.down_payment_percentage, 'down_payment_percentage'),
    termMonths: row.term_months == null ? null : Number(row.term_months),
    customerInterestRateMonthly: optionalDecimal(
      row.customer_interest_rate_monthly,
      'customer_interest_rate_monthly',
    ),
    voucherType: row.voucher_type == null ? null : String(row.voucher_type),
    policyParameters:
      typeof row.policy_parameters === 'object' && row.policy_parameters !== null
        ? (row.policy_parameters as Readonly<Record<string, unknown>>)
        : {},
  };
}

function valueOrNull<T>(value: unknown, map: (value: unknown) => T): T | null {
  return value == null ? null : map(value);
}
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
  async listAvailablePolicies(
    period?: CommercialWorkspacePeriod,
  ): Promise<readonly PolicyCombinationPolicy[]> {
    let currentQuery = this.client
      .from('commercial_policies')
      .select(policyColumns)
      .order('policy_type')
      .order('title')
      .order('id');
    if (period) {
      currentQuery = currentQuery
        .eq('product_id', Number(period.productId))
        .lte('starts_on', period.lastDay)
        .or(`ends_on.is.null,ends_on.gte.${period.firstDay}`);
    }
    const { data, error } = await currentQuery;
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar as políticas comerciais.', {
        cause: error,
      });
    const current = records(data).map(mapPolicy);
    if (!period) return current;
    const { data: historyData, error: historyError } = await this.client
      .from('commercial_policies')
      .select(policyColumns)
      .eq('product_id', Number(period.productId))
      .lt('ends_on', period.firstDay)
      .order('ends_on', { ascending: false })
      .limit(period.historyLimit ?? 50);
    if (historyError)
      throw new PricingAdapterQueryError('Não foi possível carregar o histórico de políticas.', {
        cause: historyError,
      });
    return [...current, ...records(historyData).map(mapPolicy)];
  }

  async updatePolicyDraft(input: {
    readonly policyId: string;
    readonly expectedLockVersion: number;
    readonly changes: Readonly<Record<string, string>>;
    readonly actorId: string;
    readonly correlationId: string;
  }) {
    const { data, error } = await this.client.rpc('update_commercial_policy_draft', {
      p_policy_id: Number(input.policyId),
      p_expected_lock_version: input.expectedLockVersion,
      p_changes: input.changes,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível atualizar a política.', {
        cause: error,
      });
    return mapCommercialPolicyRow(data as never);
  }

  async archivePolicy(input: {
    readonly policyId: string;
    readonly expectedLockVersion: number;
    readonly actorId: string;
    readonly correlationId: string;
  }) {
    const { data, error } = await this.client.rpc('archive_commercial_policy', {
      p_policy_id: Number(input.policyId),
      p_expected_lock_version: input.expectedLockVersion,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível arquivar a política.', { cause: error });
    return mapCommercialPolicyRow(data as never);
  }

  async replaceOfferDraft(input: {
    readonly offerId: string;
    readonly expectedLockVersion: number;
    readonly policyIds: readonly string[];
    readonly actorId: string;
    readonly correlationId: string;
  }) {
    const { data, error } = await this.client.rpc('replace_commercial_offer_draft', {
      p_offer_id: Number(input.offerId),
      p_expected_lock_version: input.expectedLockVersion,
      p_policy_ids: input.policyIds.map(Number),
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível atualizar a combinação.', {
        cause: error,
      });
    return this.mapSummary(data);
  }

  async archiveOffer(input: {
    readonly offerId: string;
    readonly expectedLockVersion: number;
    readonly actorId: string;
    readonly correlationId: string;
  }) {
    const { error } = await this.client.rpc('archive_commercial_offer', {
      p_offer_id: Number(input.offerId),
      p_expected_lock_version: input.expectedLockVersion,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível arquivar a combinação.', {
        cause: error,
      });
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
  async getPolicyDetails(ids: readonly string[]): Promise<readonly PolicyCombinationPolicy[]> {
    if (!ids.length) return [];
    const { data, error } = await this.client
      .from('commercial_policies')
      .select(policyColumns)
      .in('id', ids.map(Number));
    if (error)
      throw new PricingAdapterQueryError('Não foi possível completar as Policies das Offers.', {
        cause: error,
      });
    return records(data).map(mapPolicy);
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
  async createCombinationBatch(input: {
    readonly rows: readonly PolicyCombinationRowInput[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<PolicyCombinationBatchResult> {
    const first = input.rows[0];
    const exactPeriod =
      first?.referenceDate !== undefined &&
      first.periodEnd !== undefined &&
      first.periodKind !== undefined &&
      input.rows.every(
        (row) =>
          row.productId === first.productId &&
          row.referenceDate === first.referenceDate &&
          row.periodEnd === first.periodEnd &&
          row.periodKind === first.periodKind,
      );
    if (exactPeriod) {
      const { data, error } = await this.client.rpc('create_commercial_period_draft', {
        p_product_id: Number(first.productId),
        p_period_start: first.referenceDate,
        p_period_end: first.periodEnd,
        p_period_kind: first.periodKind,
        p_policy_rows: [],
        p_offer_rows: input.rows.map((row) => ({
          clientRowId: row.clientRowId,
          policyRefs: row.policyIds.map((policyId) => ({ policyId: Number(policyId) })),
        })),
        p_expected_offers: [],
        p_actor_id: input.actorId,
        p_correlation_id: input.correlationId,
      });
      if (error)
        throw new PricingAdapterQueryError('Não foi possível salvar as ofertas do período.', {
          cause: error,
        });
      if (typeof data !== 'object' || data === null)
        throw new PricingAdapterMappingError('Resposta inválida das ofertas do período.');
      const result = data as Record<string, unknown>;
      return {
        createdCount: Number(result.createdOfferCount),
        offers: records(result.offers).map((offer) => this.mapSummary(offer)),
      };
    }
    const { data, error } = await this.client.rpc('create_commercial_offer_batch_at_reference', {
      p_rows: input.rows.map((row) => ({
        clientRowId: row.clientRowId,
        productId: Number(row.productId),
        policyIds: row.policyIds.map(Number),
        referenceDate: row.referenceDate,
      })),
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível salvar o lote de combinações.', {
        cause: error,
      });
    if (typeof data !== 'object' || data === null)
      throw new PricingAdapterMappingError('Resposta inválida do lote de combinações.');
    const result = data as Record<string, unknown>;
    return {
      createdCount: Number(result.createdCount),
      offers: records(result.offers).map((offer) => this.mapSummary(offer)),
    };
  }
  async listRecentDrafts(
    period?: CommercialWorkspacePeriod,
  ): Promise<readonly CommercialOfferDraftSummary[]> {
    let currentQuery = this.client
      .from('commercial_offers')
      .select(
        'id,product_id,public_price_id,valid_from,valid_to,status,lock_version,public_price:product_public_prices!commercial_offers_public_price_id_fkey(amount),memberships:commercial_offer_policies!commercial_offer_policies_offer_id_fkey(commercial_policy_id,policy:commercial_policies!commercial_offer_policies_policy_id_fkey(customer_benefit_amount))',
      )
      .order('created_at', { ascending: false });
    if (period) {
      currentQuery = currentQuery
        .eq('product_id', Number(period.productId))
        .lte('valid_from', period.lastDay)
        .or(`valid_to.is.null,valid_to.gte.${period.firstDay}`);
    }
    const { data, error } = await currentQuery;
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar as ofertas recentes.', {
        cause: error,
      });
    const current = records(data).map((row) => this.mapQuerySummary(row));
    if (!period) return current;
    const { data: historyData, error: historyError } = await this.client
      .from('commercial_offers')
      .select(
        'id,product_id,public_price_id,valid_from,valid_to,status,lock_version,public_price:product_public_prices!commercial_offers_public_price_id_fkey(amount),memberships:commercial_offer_policies!commercial_offer_policies_offer_id_fkey(commercial_policy_id,policy:commercial_policies!commercial_offer_policies_policy_id_fkey(customer_benefit_amount))',
      )
      .eq('product_id', Number(period.productId))
      .lt('valid_to', period.firstDay)
      .order('valid_to', { ascending: false })
      .limit(period.historyLimit ?? 50);
    if (historyError)
      throw new PricingAdapterQueryError('Não foi possível carregar o histórico de ofertas.', {
        cause: historyError,
      });
    return [...current, ...records(historyData).map((row) => this.mapQuerySummary(row))];
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
      validTo: r.validTo == null ? null : required(r.validTo, 'validTo'),
      status: r.status === 'published' || r.status === 'archived' ? r.status : 'draft',
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
    const amounts = memberships.flatMap((m) => {
      const policy =
        records(m.policy)[0] ??
        (typeof m.policy === 'object' && m.policy !== null
          ? (m.policy as Record<string, unknown>)
          : {});
      return policy.customer_benefit_amount == null
        ? []
        : [money(policy.customer_benefit_amount, 'benefit')];
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
      validTo: r.valid_to == null ? null : required(r.valid_to, 'validTo'),
      status: r.status === 'published' || r.status === 'archived' ? r.status : 'draft',
      policyIds: memberships.map((m) => id(m.commercial_policy_id)),
      lockVersion: Number(r.lock_version),
      benefitAmount: formatMoney(benefit),
      transactionalPrice: formatMoney(priceCents - benefit),
    };
  }
}
