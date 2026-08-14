import type {
  ImportProcessingRepository,
  ProductMatchCandidate,
  ProductMatchInput,
} from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterQueryError } from './errors';

type Row = Record<string, unknown>;
export const IMPORT_MATCH_QUERY_CHUNK_SIZE = 10;
const COMPLETE_YEAR = /^\d{4}$/u;
const normalizeMatchText = (value: string): string => value.trim().replace(/\s+/g, ' ');
const matchKey = (input: ProductMatchInput): string =>
  [input.brand, input.model, input.version, input.modelYear, input.productionYear]
    .map((value) => normalizeMatchText(value).toLocaleLowerCase('pt-BR'))
    .join('\u001f');
const chunks = <T>(values: readonly T[], size: number): readonly (readonly T[])[] => {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    output.push(values.slice(index, index + size));
  return output;
};
const safeDiagnostic = (value: unknown): string =>
  String(value ?? '')
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/(authorization|apikey|service[_-]?role|bearer)\s*[:=]?\s*\S+/giu, '$1=[redacted]')
    .replace(/(["'])[^"']*\1/gu, '$1[redacted]$1')
    .slice(0, 160);
const reportMatchQueryFailure = (input: {
  operation: 'exact' | 'suggestion';
  mmvCount: number;
  batchSize: number;
  filter: string;
  error: unknown;
}): void => {
  if (process.env.OPENAI_IMPORT_DIAGNOSTICS !== '1' && process.env.NODE_ENV !== 'test') return;
  const error = (input.error ?? {}) as Record<string, unknown>;
  console.error('IMPORT_MATCH_QUERY_FAILURE', {
    operation: input.operation,
    mmvCount: input.mmvCount,
    batchSize: input.batchSize,
    filter: input.filter,
    status: typeof error.status === 'number' ? error.status : undefined,
    code: safeDiagnostic(error.code) || undefined,
    message: safeDiagnostic(error.message) || undefined,
  });
};
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
  private async queryMatchCandidates(
    input: ProductMatchInput,
    diagnosticContext: { readonly mmvCount: number; readonly batchSize: number },
  ): Promise<readonly ProductMatchCandidate[]> {
    const columns = 'id,brand,model,version,model_year,production_year';
    const brand = normalizeMatchText(input.brand);
    const model = normalizeMatchText(input.model);
    const version = normalizeMatchText(input.version);
    const hasCompleteYears =
      COMPLETE_YEAR.test(input.modelYear.trim()) && COMPLETE_YEAR.test(input.productionYear.trim());
    let rows: Row[] = [];
    if (hasCompleteYears) {
      const { data: exactData, error: exactError } = await this.client
        .from('products')
        .select(columns)
        .eq('is_active', true)
        .ilike('brand', brand)
        .ilike('model', model)
        .ilike('version', version)
        .eq('model_year', Number(input.modelYear))
        .eq('production_year', Number(input.productionYear));
      if (exactError) {
        reportMatchQueryFailure({
          operation: 'exact',
          mmvCount: diagnosticContext.mmvCount,
          batchSize: diagnosticContext.batchSize,
          filter: 'brand,model,version,model_year,production_year',
          error: exactError,
        });
        throw new PricingAdapterQueryError('Falha ao carregar catálogo para matching.', {
          cause: exactError,
        });
      }
      rows = (exactData ?? []) as Row[];
    }
    if (!rows.length) {
      const escapedModel = model.replace(/[%_]/g, '\\$&');
      const { data, error } = await this.client
        .from('products')
        .select(columns)
        .eq('is_active', true)
        .ilike('brand', brand)
        .ilike('model', `%${escapedModel}%`)
        .order('model_year', { ascending: false })
        .order('production_year', { ascending: false })
        .limit(50);
      if (error) {
        reportMatchQueryFailure({
          operation: 'suggestion',
          mmvCount: diagnosticContext.mmvCount,
          batchSize: diagnosticContext.batchSize,
          filter: 'brand,model',
          error,
        });
        throw new PricingAdapterQueryError('Falha ao carregar candidatos de Product.', {
          cause: error,
        });
      }
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
  findMatchCandidates(
    input: Parameters<ImportProcessingRepository['findMatchCandidates']>[0],
  ): Promise<readonly ProductMatchCandidate[]> {
    return this.queryMatchCandidates(input, { mmvCount: 1, batchSize: 1 });
  }
  async findMatchCandidatesBatch(
    inputs: readonly ProductMatchInput[],
  ): Promise<readonly (readonly ProductMatchCandidate[])[]> {
    const unique = new Map<string, ProductMatchInput>();
    for (const input of inputs) unique.set(matchKey(input), input);
    const entries = [...unique.entries()];
    const resolved = new Map<string, readonly ProductMatchCandidate[]>();
    for (const chunk of chunks(entries, IMPORT_MATCH_QUERY_CHUNK_SIZE)) {
      const results = await Promise.all(
        chunk.map(
          async ([key, input]) =>
            [
              key,
              await this.queryMatchCandidates(input, {
                mmvCount: entries.length,
                batchSize: chunk.length,
              }),
            ] as const,
        ),
      );
      for (const [key, candidates] of results) resolved.set(key, candidates);
    }
    return inputs.map((input) => resolved.get(matchKey(input)) ?? []);
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
