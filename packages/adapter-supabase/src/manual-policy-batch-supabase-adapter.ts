import type {
  CommercialPeriod,
  CommercialPeriodExpectedOffer,
  CommercialPeriodOfferRow,
  ManualPolicyBatchRepository,
  ManualPolicyBatchRowInput,
  ManualPolicyBatchResult,
  ManualPolicyBasePrice,
  ManualPolicyFinancialReference,
  CommercialPeriodDraftResult,
  ManualPolicyReferenceData,
  NormalizedManualPolicyBatchRow,
  ManualPriceBatchProductOption,
} from '@compra-car/core';
import {
  CommercialPeriodPersistenceError,
  ManualPolicyRolloverDependencyError,
  resolveManualPolicyReferenceData,
} from '@compra-car/core';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterMappingError, PricingAdapterQueryError } from './errors';
import { decimalString, moneyDecimalString } from './pricing-decimal';

const productColumns = 'id,brand,model,version,model_year,production_year,is_active,is_public';
const id = (value: unknown) => String(value);
const string = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value)
    throw new PricingAdapterMappingError(`Campo inválido: ${field}.`);
  return value;
};
const records = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    : [];

export class ManualPolicyBatchSupabaseAdapter implements ManualPolicyBatchRepository {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }
  async listProductOptions(): Promise<readonly ManualPriceBatchProductOption[]> {
    const { data, error } = await this.client
      .from('products')
      .select(productColumns)
      .order('brand')
      .order('model')
      .order('version');
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar os veículos.', {
        cause: error,
      });
    return records(data).map((r) => ({
      id: id(r.id),
      brand: string(r.brand, 'brand'),
      model: string(r.model, 'model'),
      version: string(r.version, 'version'),
      modelYear: id(r.model_year),
      productionYear: id(r.production_year),
      isActive: r.is_active === true,
      isPublic: r.is_public === true,
    }));
  }
  async listBasePrices(): Promise<readonly ManualPolicyBasePrice[]> {
    const { data, error } = await this.client
      .from('product_public_prices')
      .select('id,product_id,amount,starts_on,ends_on')
      .eq('status', 'published')
      .eq('currency_code', 'BRL')
      .eq('price_type', 'msrp')
      .gt('amount', 0)
      .order('starts_on', { ascending: false });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar os preços-base.', {
        cause: error,
      });
    return records(data).map((r) => ({
      id: id(r.id),
      productId: id(r.product_id),
      amount: moneyDecimalString(r.amount, 'amount'),
      startsOn: string(r.starts_on, 'starts_on'),
      endsOn: r.ends_on == null ? null : string(r.ends_on, 'ends_on'),
    }));
  }
  async listFinancialReferences(): Promise<readonly ManualPolicyFinancialReference[]> {
    const { data, error } = await this.client
      .from('financial_parameter_sets')
      .select(
        'id,version,effective_from,valid_to,cdi_monthly_percentage,spread_monthly_percentage,monthly_reference_rate',
      )
      .eq('status', 'published')
      .order('effective_from', { ascending: false });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar a referência financeira.', {
        cause: error,
      });
    return records(data).map((r) => ({
      id: id(r.id),
      version: Number(r.version),
      effectiveFrom: string(r.effective_from, 'effective_from'),
      validTo: r.valid_to == null ? null : string(r.valid_to, 'valid_to'),
      cdiMonthlyPercentage: decimalString(r.cdi_monthly_percentage, 'cdi'),
      spreadMonthlyPercentage: decimalString(r.spread_monthly_percentage, 'spread'),
      monthlyReferenceRate: decimalString(r.monthly_reference_rate, 'reference'),
    }));
  }
  async resolveReferences(
    rows: readonly ManualPolicyBatchRowInput[],
  ): Promise<Readonly<Record<string, ManualPolicyReferenceData>>> {
    const [prices, parameters] = await Promise.all([
      this.listBasePrices(),
      this.listFinancialReferences(),
    ]);
    return Object.fromEntries(
      rows.map((row) => [
        row.clientRowId,
        resolveManualPolicyReferenceData(row, prices, parameters),
      ]),
    );
  }
  async createManualPolicyBatch(input: {
    readonly rows: readonly NormalizedManualPolicyBatchRow[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ManualPolicyBatchResult> {
    const { data, error } = await this.client.rpc('create_manual_policy_batch_with_rollover', {
      p_rows: input.rows,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error && this.isRolloverDependencyError(error)) {
      const offerIds = await this.findDependentOfferIds(input.rows);
      throw new ManualPolicyRolloverDependencyError(
        offerIds,
        [...new Set(input.rows.map((row) => row.policyType))],
        { cause: error },
      );
    }
    if (error)
      throw new PricingAdapterQueryError('Não foi possível salvar o lote de policies.', {
        cause: error,
      });
    const result = data as unknown as Record<string, unknown>;
    if (!result || !Array.isArray(result.policyIds))
      throw new PricingAdapterMappingError('Resposta inválida do lote de policies.');
    return {
      batchId: id(result.batchId),
      createdCount: Number(result.createdCount),
      policyIds: result.policyIds.map(id),
      rolloverCount: Number(result.rolloverCount ?? 0),
    };
  }

  async createCommercialPeriodDraft(input: {
    readonly productId: string;
    readonly period: CommercialPeriod;
    readonly policyRows: readonly NormalizedManualPolicyBatchRow[];
    readonly offerRows: readonly CommercialPeriodOfferRow[];
    readonly expectedOffers: readonly CommercialPeriodExpectedOffer[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<CommercialPeriodDraftResult> {
    const { data, error } = await this.client.rpc('create_commercial_period_draft', {
      p_product_id: Number(input.productId),
      p_period_start: input.period.start,
      p_period_end: input.period.end,
      p_period_kind: input.period.kind,
      p_policy_rows: input.policyRows,
      p_offer_rows: input.offerRows.map((row) => ({
        clientRowId: row.clientRowId,
        policyRefs: row.policyRefs.map((reference) =>
          'policyId' in reference
            ? { policyId: Number(reference.policyId) }
            : { policyClientRowId: reference.policyClientRowId },
        ),
      })),
      p_expected_offers: input.expectedOffers.map((offer) => ({
        offerId: Number(offer.offerId),
        expectedLockVersion: offer.expectedLockVersion,
      })),
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error) {
      const knownMessages = new Set([
        'commercial period rollover requires predecessor lock version',
        'commercial period predecessor changed by another operator',
        'commercial period is missing an affected Offer lock',
        'commercial period requires every affected Offer lock version',
        'affected Offer changed by another operator',
        'affected Offer is not eligible for temporal closing',
        'commercial Offer cannot end before its valid_from',
        'retroactive closing of a published Offer is not allowed for a monthly period',
        'every Offer Policy must cover the complete commercial period',
        'no published MSRP covers the complete commercial period',
        'more than one published MSRP covers the commercial period',
        'commercial period Offer benefit exceeds MSRP',
      ]);
      if (knownMessages.has(error.message)) {
        throw new CommercialPeriodPersistenceError(error.code, error.message, { cause: error });
      }
      throw new PricingAdapterQueryError('Não foi possível salvar o período comercial.', {
        cause: error,
      });
    }
    if (typeof data !== 'object' || data === null)
      throw new PricingAdapterMappingError('Resposta inválida do período comercial.');
    const result = data as Record<string, unknown>;
    const batch =
      typeof result.policyBatch === 'object' && result.policyBatch !== null
        ? (result.policyBatch as Record<string, unknown>)
        : {};
    const offers = records(result.offers);
    return {
      period: input.period,
      batchId: batch.batchId == null ? '' : id(batch.batchId),
      createdPolicyCount: Number(batch.createdCount ?? 0),
      createdPolicyIds: Array.isArray(batch.policyIds) ? batch.policyIds.map(id) : [],
      rolloverCount: Number(batch.rolloverCount ?? 0),
      closedOfferIds: Array.isArray(result.closedOfferIds) ? result.closedOfferIds.map(id) : [],
      createdOfferCount: Number(result.createdOfferCount ?? 0),
      createdOfferIds: offers.map((offer) => id(offer.offerId)),
    };
  }

  private isRolloverDependencyError(error: PostgrestError): boolean {
    return (
      error.code === '55000' &&
      error.message === 'policy rollover would invalidate a non-archived commercial offer'
    );
  }

  private async findDependentOfferIds(
    rows: readonly NormalizedManualPolicyBatchRow[],
  ): Promise<readonly string[]> {
    const predecessors = rows.flatMap((row) =>
      row.expectedPredecessorId ? [{ id: row.expectedPredecessorId, startsOn: row.startsOn }] : [],
    );
    if (!predecessors.length) return [];
    const predecessorStarts = new Map(predecessors.map((row) => [row.id, row.startsOn]));
    const { data: memberships, error: membershipError } = await this.client
      .from('commercial_offer_policies')
      .select('commercial_offer_id,commercial_policy_id')
      .in(
        'commercial_policy_id',
        predecessors.map((row) => Number(row.id)),
      );
    if (membershipError) return [];
    const membershipRows = records(memberships);
    const offerIds = [...new Set(membershipRows.map((row) => id(row.commercial_offer_id)))];
    if (!offerIds.length) return [];
    const { data: offers, error: offerError } = await this.client
      .from('commercial_offers')
      .select('id,status,valid_to')
      .in('id', offerIds.map(Number))
      .neq('status', 'archived');
    if (offerError) return [];
    const offerRows = records(offers);
    return offerRows
      .filter((offer) => {
        const offerId = id(offer.id);
        return membershipRows.some((membership) => {
          if (id(membership.commercial_offer_id) !== offerId) return false;
          const startsOn = predecessorStarts.get(id(membership.commercial_policy_id));
          return Boolean(
            startsOn && (offer.valid_to == null || String(offer.valid_to) >= startsOn),
          );
        });
      })
      .map((offer) => id(offer.id))
      .sort((left, right) => Number(left) - Number(right));
  }
}
