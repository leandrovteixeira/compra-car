import type { ImportProcessingRepository, ProductMatchCandidate } from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterQueryError } from './errors';

type Row = Record<string, unknown>;
const id = (value: unknown): string => String(value);
const result = (value: unknown) => {
  const row = value as Row;
  return {
    jobId: id(row.jobId),
    ...(row.batchId == null ? {} : { batchId: id(row.batchId) }),
    ...(row.attempt == null ? {} : { attempt: Number(row.attempt) }),
    ...(row.rowCount == null ? {} : { rowCount: Number(row.rowCount) }),
    idempotentReplay: row.idempotentReplay === true,
  };
};

export class ImportProcessingSupabaseAdapter implements ImportProcessingRepository {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw new PricingAdapterQueryError(`Falha na operação ${name}.`, { cause: error });
    return result(data);
  }
  enqueue(input: Parameters<ImportProcessingRepository['enqueue']>[0]) {
    return this.rpc('enqueue_import_processing_job', {
      p_batch_id: input.batchId,
      p_plugin_version: input.pluginVersion,
      p_provider_key: input.providerKey,
      p_provider_version: input.providerVersion,
      p_schema_version: input.schemaVersion,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
  }
  claim(input: Parameters<ImportProcessingRepository['claim']>[0]) {
    return this.rpc('claim_import_processing_job', {
      p_job_id: input.jobId,
      p_claim_token: input.claimToken,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
      p_lease_seconds: input.leaseSeconds,
    });
  }
  async downloadDocument(bucket: string, path: string) {
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error) throw new PricingAdapterQueryError('Falha ao ler PDF privado.', { cause: error });
    return new Uint8Array(await data.arrayBuffer());
  }
  async findMatchCandidates(
    input: Parameters<ImportProcessingRepository['findMatchCandidates']>[0],
  ): Promise<readonly ProductMatchCandidate[]> {
    const columns = 'id,brand,model,version,model_year,production_year';
    const exactQuery = this.client
      .from('products')
      .select(columns)
      .eq('is_active', true)
      .ilike('brand', input.brand.trim())
      .ilike('model', input.model.trim())
      .ilike('version', input.version.trim())
      .eq('model_year', input.modelYear || -1)
      .eq('production_year', input.productionYear || -1);
    const { data: exactData, error: exactError } = await exactQuery;
    if (exactError)
      throw new PricingAdapterQueryError('Falha ao carregar catálogo para matching.', {
        cause: exactError,
      });
    let rows = (exactData ?? []) as Row[];
    if (!rows.length) {
      const escapedModel = input.model.trim().replace(/[%_]/g, '\\$&');
      const { data, error } = await this.client
        .from('products')
        .select(columns)
        .eq('is_active', true)
        .ilike('brand', input.brand.trim())
        .ilike('model', `%${escapedModel}%`)
        .order('model_year', { ascending: false })
        .order('production_year', { ascending: false })
        .limit(50);
      if (error)
        throw new PricingAdapterQueryError('Falha ao carregar candidatos de Product.', {
          cause: error,
        });
      rows = (data ?? []) as Row[];
    }
    return rows.map((row) => ({
      id: id(row.id),
      brand: String(row.brand),
      model: String(row.model),
      version: String(row.version),
      modelYear: String(row.model_year),
      productionYear: String(row.production_year),
      externalCodes: [],
    }));
  }
  finalize(input: Parameters<ImportProcessingRepository['finalize']>[0]) {
    return this.rpc('finalize_import_processing_job', {
      p_job_id: input.jobId,
      p_claim_token: input.claimToken,
      p_rows: input.rows,
      p_provider_run_id: input.providerRunId,
      p_usage: input.usage,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
  }
  async fail(input: Parameters<ImportProcessingRepository['fail']>[0]) {
    const { error } = await this.client.rpc('fail_import_processing_job', {
      p_job_id: input.jobId,
      p_claim_token: input.claimToken,
      p_error_code: input.errorCode,
      p_error_message: input.errorMessage,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error)
      throw new PricingAdapterQueryError('Falha ao registrar erro do processamento.', {
        cause: error,
      });
  }
}
