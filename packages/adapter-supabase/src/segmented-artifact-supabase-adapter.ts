import {
  hashSegmentedArtifactBytes,
  publishSegmentedArtifact,
  SEGMENTED_ARTIFACT_BUCKET,
  type PrepareSegmentedArtifactInput,
  type PublishSegmentedArtifactResult,
  type SegmentedArtifactAuditSink,
  type SegmentedArtifactBodyStorage,
  type SegmentedArtifactManifest,
  type SegmentedArtifactManifestRepository,
  type SegmentedArtifactProviderMetadata,
  type SegmentedArtifactStage,
  type SegmentedArtifactStatus,
  type SegmentedArtifactStorageReference,
} from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterQueryError } from './errors';

type Row = Record<string, unknown>;

export interface SegmentedArtifactPersistenceContext {
  readonly claimToken: string;
  readonly actorId: string;
  readonly processingJobLockVersion: number;
}

export interface SegmentedArtifactRpcResult {
  readonly artifactId: string;
  readonly artifactKey?: string;
  readonly status: SegmentedArtifactStatus;
  readonly lockVersion: number;
  readonly idempotentReplay: boolean;
}

const stringValue = (value: unknown): string => String(value);
const optionalString = (value: unknown): string | undefined =>
  value == null ? undefined : String(value);
const numeric = (value: unknown): number => Number(value);

const usageFrom = (provider?: SegmentedArtifactProviderMetadata): Record<string, number> => ({
  ...(provider?.inputUnits === undefined ? {} : { inputUnits: provider.inputUnits }),
  ...(provider?.outputUnits === undefined ? {} : { outputUnits: provider.outputUnits }),
  ...(provider?.totalUnits === undefined ? {} : { totalUnits: provider.totalUnits }),
});

const providerFrom = (row: Row): SegmentedArtifactProviderMetadata | undefined => {
  if (row.provider == null || row.provider_version == null) return undefined;
  const usage = (row.usage_metadata ?? {}) as Row;
  return {
    providerKey: stringValue(row.provider),
    providerVersion: stringValue(row.provider_version),
    ...(optionalString(row.prompt_version)
      ? { promptVersion: stringValue(row.prompt_version) }
      : {}),
    ...(optionalString(row.provider_run_id)
      ? { providerRunId: stringValue(row.provider_run_id) }
      : {}),
    ...(optionalString(row.model) ? { model: stringValue(row.model) } : {}),
    ...(row.duration_ms == null ? {} : { durationMs: numeric(row.duration_ms) }),
    ...(usage.inputUnits == null ? {} : { inputUnits: numeric(usage.inputUnits) }),
    ...(usage.outputUnits == null ? {} : { outputUnits: numeric(usage.outputUnits) }),
    ...(usage.totalUnits == null ? {} : { totalUnits: numeric(usage.totalUnits) }),
  };
};

const rpcResult = (data: unknown): SegmentedArtifactRpcResult => {
  const row = data as Row;
  return {
    artifactId: stringValue(row.artifactId),
    ...(row.artifactKey == null ? {} : { artifactKey: stringValue(row.artifactKey) }),
    status: stringValue(row.status) as SegmentedArtifactStatus,
    lockVersion: numeric(row.lockVersion),
    idempotentReplay: row.idempotentReplay === true,
  };
};

const manifestFrom = (
  row: Row,
  sourceArtifactIds: readonly string[],
): SegmentedArtifactManifest => ({
  schemaVersion: 'SegmentedImportArtifactManifest/1',
  pipelineVersion: 'segmented-import/1',
  artifactSchemaVersion: stringValue(row.artifact_schema_version),
  artifactId: stringValue(row.artifact_key),
  artifactVersion: numeric(row.artifact_version),
  batchId: stringValue(row.batch_id),
  jobId: stringValue(row.processing_job_id),
  ...(row.document_id == null ? {} : { documentId: stringValue(row.document_id) }),
  ...(row.unit_id == null ? {} : { unitId: stringValue(row.unit_id) }),
  stage: stringValue(row.stage) as SegmentedArtifactStage,
  attempt: numeric(row.attempt),
  status: stringValue(row.status) as SegmentedArtifactStatus,
  correlationId: stringValue(row.correlation_id),
  idempotencyKey: stringValue(row.idempotency_key),
  sourceArtifactIds,
  ...(row.supersedes_artifact_id == null
    ? {}
    : { supersedesArtifactId: stringValue(row.supersedes_artifact_key) }),
  ...(row.retry_of_artifact_id == null
    ? {}
    : { retryOfArtifactId: stringValue(row.retry_of_artifact_key) }),
  content: {
    sha256: stringValue(row.content_sha256).trim(),
    byteLength: numeric(row.content_size_bytes),
    canonicalization: 'canonical-json/1',
  },
  storage: {
    bucket: SEGMENTED_ARTIFACT_BUCKET,
    objectPath: stringValue(row.storage_object_path),
  },
  ...(providerFrom(row) ? { provider: providerFrom(row) } : {}),
  createdAt: stringValue(row.created_at),
  ...(row.started_at == null ? {} : { startedAt: stringValue(row.started_at) }),
  ...(row.completed_at == null ? {} : { completedAt: stringValue(row.completed_at) }),
  ...(row.error_code == null
    ? {}
    : { failure: { code: stringValue(row.error_code), message: stringValue(row.error_message) } }),
});

export class SegmentedArtifactSupabaseStorageAdapter implements SegmentedArtifactBodyStorage {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }

  async put(reference: SegmentedArtifactStorageReference, body: Uint8Array): Promise<void> {
    const { error } = await this.client.storage
      .from(reference.bucket)
      .upload(reference.objectPath, body, {
        contentType: 'application/json',
        upsert: false,
      });
    if (error)
      throw new PricingAdapterQueryError('Falha ao armazenar artifact canônico privado.', {
        cause: error,
      });
  }

  async read(reference: SegmentedArtifactStorageReference): Promise<Uint8Array> {
    const { data, error } = await this.client.storage
      .from(reference.bucket)
      .download(reference.objectPath);
    if (error)
      throw new PricingAdapterQueryError('Falha ao ler artifact canônico privado.', {
        cause: error,
      });
    return new Uint8Array(await data.arrayBuffer());
  }

  async exists(reference: SegmentedArtifactStorageReference): Promise<boolean> {
    const segments = reference.objectPath.split('/');
    const file = segments.pop();
    const { data, error } = await this.client.storage
      .from(reference.bucket)
      .list(segments.join('/'), { search: file, limit: 2 });
    if (error)
      throw new PricingAdapterQueryError('Falha ao verificar artifact canônico privado.', {
        cause: error,
      });
    return (data ?? []).some((item) => item.name === file);
  }

  async verify(
    reference: SegmentedArtifactStorageReference,
    expectedSha256: string,
    expectedByteLength: number,
  ): Promise<{
    readonly verified: boolean;
    readonly actualSha256: string;
    readonly actualByteLength: number;
  }> {
    const body = await this.read(reference);
    const actualSha256 = await hashSegmentedArtifactBytes(body);
    return {
      verified: body.byteLength === expectedByteLength && actualSha256 === expectedSha256,
      actualSha256,
      actualByteLength: body.byteLength,
    };
  }
}

export class SegmentedArtifactSupabaseManifestAdapter implements SegmentedArtifactManifestRepository {
  private readonly identities = new Map<
    string,
    { readonly id: string; readonly lockVersion: number }
  >();

  constructor(
    private readonly context: SegmentedArtifactPersistenceContext,
    private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv(),
  ) {
    assertLegacyServerRuntime();
  }

  private async rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<SegmentedArtifactRpcResult> {
    const { data, error } = await this.client.rpc(name, args);
    if (error)
      throw new PricingAdapterQueryError(`Falha na operação segura de artifact: ${name}.`, {
        cause: error,
      });
    return rpcResult(data);
  }

  private remember(artifactKey: string, result: SegmentedArtifactRpcResult): void {
    this.identities.set(artifactKey, { id: result.artifactId, lockVersion: result.lockVersion });
  }

  private async identity(
    artifactKey: string,
  ): Promise<{ readonly id: string; readonly lockVersion: number }> {
    const remembered = this.identities.get(artifactKey);
    if (remembered) return remembered;
    const { data, error } = await this.client
      .from('pricing_import_processing_artifacts')
      .select('id,lock_version')
      .eq('artifact_key', artifactKey)
      .maybeSingle();
    if (error || !data)
      throw new PricingAdapterQueryError('Artifact manifest não encontrado.', { cause: error });
    const value = { id: stringValue(data.id), lockVersion: numeric(data.lock_version) };
    this.identities.set(artifactKey, value);
    return value;
  }

  private async artifactIds(keys: readonly string[]): Promise<readonly string[]> {
    return Promise.all(keys.map(async (key) => (await this.identity(key)).id));
  }

  private async hydrate(row: Row): Promise<SegmentedArtifactManifest> {
    const [dependencies, retryOfArtifactKey, supersedesArtifactKey] = await Promise.all([
      this.client
        .from('pricing_import_processing_artifact_dependencies')
        .select(
          'ordinal,source:pricing_import_processing_artifacts!source_artifact_id(artifact_key)',
        )
        .eq('artifact_id', row.id)
        .order('ordinal', { ascending: true }),
      this.artifactKeyById(row.retry_of_artifact_id),
      this.artifactKeyById(row.supersedes_artifact_id),
    ]);
    const { data, error } = dependencies;
    if (error)
      throw new PricingAdapterQueryError('Falha ao carregar dependencies do artifact.', {
        cause: error,
      });
    const sources = ((data ?? []) as Row[]).map((dependency) => {
      const value = dependency.source;
      const source = (Array.isArray(value) ? value[0] : value) as Row;
      return stringValue(source.artifact_key);
    });
    const manifest = manifestFrom(
      {
        ...row,
        ...(retryOfArtifactKey ? { retry_of_artifact_key: retryOfArtifactKey } : {}),
        ...(supersedesArtifactKey ? { supersedes_artifact_key: supersedesArtifactKey } : {}),
      },
      sources,
    );
    this.identities.set(manifest.artifactId, {
      id: stringValue(row.id),
      lockVersion: numeric(row.lock_version),
    });
    return manifest;
  }

  private async artifactKeyById(id: unknown): Promise<string | undefined> {
    if (id == null) return undefined;
    const { data, error } = await this.client
      .from('pricing_import_processing_artifacts')
      .select('artifact_key')
      .eq('id', id)
      .maybeSingle();
    if (error || !data)
      throw new PricingAdapterQueryError('Falha ao carregar lineage do artifact.', {
        cause: error,
      });
    return stringValue(data.artifact_key);
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SegmentedArtifactManifest | undefined> {
    const { data, error } = await this.client
      .from('pricing_import_processing_artifacts')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (error)
      throw new PricingAdapterQueryError('Falha ao localizar replay de artifact.', {
        cause: error,
      });
    return data ? this.hydrate(data as Row) : undefined;
  }

  async createQueued(manifest: SegmentedArtifactManifest): Promise<SegmentedArtifactManifest> {
    const [sourceArtifactIds, retryOfArtifactId, supersedesArtifactId] = await Promise.all([
      this.artifactIds(manifest.sourceArtifactIds),
      manifest.retryOfArtifactId
        ? this.identity(manifest.retryOfArtifactId).then((value) => value.id)
        : undefined,
      manifest.supersedesArtifactId
        ? this.identity(manifest.supersedesArtifactId).then((value) => value.id)
        : undefined,
    ]);
    const result = await this.rpc('reserve_import_processing_artifact', {
      p_artifact_key: manifest.artifactId,
      p_batch_id: manifest.batchId,
      p_processing_job_id: manifest.jobId,
      p_document_id: manifest.documentId ?? null,
      p_unit_id: manifest.unitId ?? null,
      p_stage: manifest.stage,
      p_manifest_schema_version: manifest.schemaVersion,
      p_artifact_schema_version: manifest.artifactSchemaVersion,
      p_artifact_version: manifest.artifactVersion,
      p_pipeline_version: manifest.pipelineVersion,
      p_attempt: manifest.attempt,
      p_content_sha256: manifest.content.sha256,
      p_content_size_bytes: manifest.content.byteLength,
      p_storage_bucket: manifest.storage.bucket,
      p_storage_object_path: manifest.storage.objectPath,
      p_idempotency_key: manifest.idempotencyKey,
      p_retry_of_artifact_id: retryOfArtifactId ?? null,
      p_supersedes_artifact_id: supersedesArtifactId ?? null,
      p_provider: manifest.provider?.providerKey ?? null,
      p_provider_version: manifest.provider?.providerVersion ?? null,
      p_prompt_version: manifest.provider?.promptVersion ?? null,
      p_model: manifest.provider?.model ?? null,
      p_source_artifact_ids: sourceArtifactIds,
      p_claim_token: this.context.claimToken,
      p_expected_job_lock_version: this.context.processingJobLockVersion,
      p_actor_id: this.context.actorId,
      p_correlation_id: manifest.correlationId,
    });
    this.remember(manifest.artifactId, result);
    if (!result.idempotentReplay) return manifest;
    return (await this.findByIdempotencyKey(manifest.idempotencyKey)) ?? manifest;
  }

  async transition(
    artifactId: string,
    expectedStatus: SegmentedArtifactStatus,
    manifest: SegmentedArtifactManifest,
  ): Promise<SegmentedArtifactManifest> {
    const identity = await this.identity(artifactId);
    const common = {
      p_artifact_id: identity.id,
      p_claim_token: this.context.claimToken,
      p_expected_lock_version: identity.lockVersion,
      p_actor_id: this.context.actorId,
      p_correlation_id: manifest.correlationId,
    };
    let result: SegmentedArtifactRpcResult;
    if (expectedStatus === 'queued' && manifest.status === 'processing') {
      result = await this.rpc('start_import_processing_artifact', common);
    } else if (expectedStatus === 'processing' && manifest.status === 'succeeded') {
      result = await this.rpc('succeed_import_processing_artifact', {
        ...common,
        p_content_sha256: manifest.content.sha256,
        p_content_size_bytes: manifest.content.byteLength,
        p_storage_bucket: manifest.storage.bucket,
        p_storage_object_path: manifest.storage.objectPath,
        p_provider_run_id: manifest.provider?.providerRunId ?? null,
        p_usage_metadata: usageFrom(manifest.provider),
        p_duration_ms: manifest.provider?.durationMs ?? null,
      });
    } else if (
      (expectedStatus === 'processing' || expectedStatus === 'queued') &&
      manifest.status === 'failed'
    ) {
      result = await this.rpc('fail_import_processing_artifact', {
        ...common,
        p_error_code: manifest.failure?.code,
        p_error_message: manifest.failure?.message,
        p_duration_ms: manifest.provider?.durationMs ?? null,
      });
    } else {
      throw new Error('SEGMENTED_ARTIFACT_UNSUPPORTED_PERSISTENCE_TRANSITION');
    }
    this.remember(artifactId, result);
    return manifest;
  }

  reserve(manifest: SegmentedArtifactManifest): Promise<SegmentedArtifactManifest> {
    return this.createQueued(manifest);
  }

  async start(manifest: SegmentedArtifactManifest): Promise<SegmentedArtifactManifest> {
    return this.transition(manifest.artifactId, 'queued', manifest);
  }

  async succeed(manifest: SegmentedArtifactManifest): Promise<SegmentedArtifactManifest> {
    return this.transition(manifest.artifactId, 'processing', manifest);
  }

  async fail(manifest: SegmentedArtifactManifest): Promise<SegmentedArtifactManifest> {
    return this.transition(
      manifest.artifactId,
      manifest.startedAt ? 'processing' : 'queued',
      manifest,
    );
  }

  async listDependencies(artifactId: string): Promise<readonly string[]> {
    const row = await this.findByArtifactKey(artifactId);
    return row?.sourceArtifactIds ?? [];
  }

  async attachDependencies(
    artifactId: string,
    sourceArtifactIds: readonly string[],
    correlationId: string,
  ): Promise<number> {
    const target = await this.identity(artifactId);
    const { data, error } = await this.client.rpc(
      'attach_import_processing_artifact_dependencies',
      {
        p_artifact_id: target.id,
        p_source_artifact_ids: await this.artifactIds(sourceArtifactIds),
        p_actor_id: this.context.actorId,
        p_correlation_id: correlationId,
      },
    );
    if (error)
      throw new PricingAdapterQueryError('Falha ao anexar dependencies do artifact.', {
        cause: error,
      });
    return numeric(data);
  }

  findReplay(idempotencyKey: string): Promise<SegmentedArtifactManifest | undefined> {
    return this.findByIdempotencyKey(idempotencyKey);
  }

  async findByArtifactKey(artifactKey: string): Promise<SegmentedArtifactManifest | undefined> {
    const { data, error } = await this.client
      .from('pricing_import_processing_artifacts')
      .select('*')
      .eq('artifact_key', artifactKey)
      .maybeSingle();
    if (error)
      throw new PricingAdapterQueryError('Falha ao localizar artifact manifest.', { cause: error });
    return data ? this.hydrate(data as Row) : undefined;
  }

  async latestSucceeded(selector: {
    readonly batchId: string;
    readonly jobId: string;
    readonly stage: SegmentedArtifactStage;
    readonly documentId?: string;
    readonly unitId?: string;
  }): Promise<SegmentedArtifactManifest | undefined> {
    let query = this.client
      .from('pricing_import_processing_artifacts')
      .select('*')
      .eq('batch_id', selector.batchId)
      .eq('processing_job_id', selector.jobId)
      .eq('stage', selector.stage)
      .eq('status', 'succeeded');
    query = selector.documentId
      ? query.eq('document_id', selector.documentId)
      : query.is('document_id', null);
    query = selector.unitId ? query.eq('unit_id', selector.unitId) : query.is('unit_id', null);
    const { data, error } = await query
      .order('artifact_version', { ascending: false })
      .order('attempt', { ascending: false })
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      throw new PricingAdapterQueryError('Falha ao localizar latest succeeded artifact.', {
        cause: error,
      });
    return data ? this.hydrate(data as Row) : undefined;
  }
}

export const publishPersistedSegmentedArtifact = (
  input: PrepareSegmentedArtifactInput & {
    readonly startedAt: string;
    readonly completedAt: string;
  },
  dependencies: {
    readonly manifests: SegmentedArtifactSupabaseManifestAdapter;
    readonly storage: SegmentedArtifactSupabaseStorageAdapter;
    readonly audit: SegmentedArtifactAuditSink;
  },
): Promise<PublishSegmentedArtifactResult> => publishSegmentedArtifact(input, dependencies);
