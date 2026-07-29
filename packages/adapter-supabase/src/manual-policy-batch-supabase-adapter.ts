import type {
  ManualPolicyBatchRepository,
  ManualPolicyBatchRowInput,
  ManualPolicyBatchResult,
  ManualPolicyBasePrice,
  ManualPolicyFinancialReference,
  ManualPolicyReferenceData,
  NormalizedManualPolicyBatchRow,
  ManualPriceBatchProductOption,
} from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterMappingError, PricingAdapterQueryError } from './errors';

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
      amount: string(r.amount, 'amount'),
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
      cdiMonthlyPercentage: string(r.cdi_monthly_percentage, 'cdi'),
      spreadMonthlyPercentage: string(r.spread_monthly_percentage, 'spread'),
      monthlyReferenceRate: string(r.monthly_reference_rate, 'reference'),
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
      rows.map((row) => {
        const price = prices.find(
          (p) =>
            p.id === row.calculationBasePriceId &&
            p.productId === row.productId &&
            p.startsOn <= row.startsOn &&
            (p.endsOn == null || (row.endsOn != null && p.endsOn >= row.endsOn)),
        );
        const matches = parameters.filter(
          (p) =>
            p.effectiveFrom <= row.startsOn &&
            (p.validTo == null || (row.endsOn != null && p.validTo >= row.endsOn)),
        );
        const parameter = matches.length === 1 ? matches[0] : undefined;
        return [
          row.clientRowId,
          {
            basePriceAmount: price?.amount,
            financialParameterSetId: parameter?.id,
            monthlyReferenceRate: parameter?.monthlyReferenceRate,
          },
        ];
      }),
    );
  }
  async createManualPolicyBatch(input: {
    readonly rows: readonly NormalizedManualPolicyBatchRow[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ManualPolicyBatchResult> {
    const { data, error } = await this.client.rpc('create_manual_policy_batch', {
      p_rows: input.rows,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
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
    };
  }
}
