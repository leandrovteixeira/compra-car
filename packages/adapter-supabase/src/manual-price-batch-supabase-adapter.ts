import type {
  ManualPriceBatchProductOption,
  ManualPriceBatchRepository,
  ManualPriceBatchResult,
  NormalizedManualPriceBatchRow,
} from '@compra-car/core';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import {
  ManualPriceBatchAuthorizationError,
  ManualPriceBatchConflictError,
  PricingAdapterMappingError,
  PricingAdapterQueryError,
} from './errors';

interface ProductOptionRow {
  readonly id: unknown;
  readonly brand: unknown;
  readonly model: unknown;
  readonly version: unknown;
  readonly model_year: unknown;
  readonly production_year: unknown;
  readonly is_active: unknown;
  readonly is_public: unknown;
}

interface BatchRowResultData {
  readonly clientRowId: unknown;
  readonly importRowId: unknown;
  readonly priceId: unknown;
}

interface BatchResultData {
  readonly batchId: unknown;
  readonly createdCount: unknown;
  readonly priceIds: readonly unknown[];
  readonly rows: readonly BatchRowResultData[];
}

const PRODUCT_OPTION_COLUMNS =
  'id,brand,model,version,model_year,production_year,is_active,is_public';

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PricingAdapterMappingError(`Resposta inválida do batch manual: ${field}.`);
  }
  return value.trim();
}

function identifier(value: unknown, field: string): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || !String(value).trim()) {
    throw new PricingAdapterMappingError(`Identificador inválido do batch manual: ${field}.`);
  }
  return String(value);
}

function safeInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new PricingAdapterMappingError(`Contagem inválida do batch manual: ${field}.`);
  }
  return parsed;
}

function mapProductOption(row: ProductOptionRow): ManualPriceBatchProductOption {
  const modelYear = Number(row.model_year);
  const productionYear = Number(row.production_year);
  if (!Number.isSafeInteger(modelYear) || !Number.isSafeInteger(productionYear)) {
    throw new PricingAdapterMappingError('Ano inválido em Product administrativo.');
  }
  return Object.freeze({
    id: identifier(row.id, 'product.id'),
    brand: requiredString(row.brand, 'product.brand'),
    model: requiredString(row.model, 'product.model'),
    version: requiredString(row.version, 'product.version'),
    modelYear: String(modelYear),
    productionYear: String(productionYear),
    isActive: row.is_active === true,
    isPublic: row.is_public === true,
  });
}

function mapBatchResult(data: BatchResultData): ManualPriceBatchResult {
  const rows = (data.rows ?? []).map((row) =>
    Object.freeze({
      clientRowId: requiredString(row.clientRowId, 'row.clientRowId'),
      importRowId: identifier(row.importRowId, 'row.importRowId'),
      priceId: identifier(row.priceId, 'row.priceId'),
    }),
  );
  const priceIds = (data.priceIds ?? []).map((id) => identifier(id, 'priceId'));
  const createdCount = safeInteger(data.createdCount, 'createdCount');
  if (createdCount !== rows.length || createdCount !== priceIds.length) {
    throw new PricingAdapterMappingError('Contagens divergentes no resultado do batch manual.');
  }
  return Object.freeze({
    batchId: identifier(data.batchId, 'batchId'),
    createdCount,
    priceIds: Object.freeze(priceIds),
    rows: Object.freeze(rows),
  });
}

function rpcError(error: PostgrestError): Error {
  if (error.code === '23505') {
    let clientRowIds: readonly string[] = [];
    try {
      const details: unknown = error.details ? JSON.parse(error.details) : [];
      if (Array.isArray(details)) {
        clientRowIds = details.filter((value): value is string => typeof value === 'string');
      }
    } catch {
      clientRowIds = [];
    }
    return new ManualPriceBatchConflictError(
      'Já existe preço para veículo e início informados.',
      clientRowIds,
      { cause: error },
    );
  }
  if (error.code === '42501') {
    return new ManualPriceBatchAuthorizationError('Usuário não autorizado para o batch manual.', {
      cause: error,
    });
  }
  return new PricingAdapterQueryError('Não foi possível salvar o lote de preços.', {
    cause: error,
  });
}

export class ManualPriceBatchSupabaseAdapter implements ManualPriceBatchRepository {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }

  async listProductOptions(): Promise<readonly ManualPriceBatchProductOption[]> {
    const { data, error } = await this.client
      .from('products')
      .select(PRODUCT_OPTION_COLUMNS)
      .order('brand')
      .order('model')
      .order('version')
      .order('model_year', { ascending: false })
      .order('production_year', { ascending: false });
    if (error)
      throw new PricingAdapterQueryError('Não foi possível carregar os veículos.', {
        cause: error,
      });
    return Object.freeze(((data ?? []) as unknown as ProductOptionRow[]).map(mapProductOption));
  }

  async createManualPriceBatch(input: {
    readonly rows: readonly NormalizedManualPriceBatchRow[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ManualPriceBatchResult> {
    const { data, error } = await this.client.rpc('create_manual_price_batch', {
      p_rows: input.rows,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error) throw rpcError(error);
    return mapBatchResult(data as unknown as BatchResultData);
  }
}
