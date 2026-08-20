export const SEGMENTED_ARTIFACT_MANIFEST_VERSION = 'SegmentedImportArtifactManifest/1' as const;
export const SEGMENTED_ARTIFACT_PIPELINE_VERSION = 'segmented-import/1' as const;
export const SEGMENTED_ARTIFACT_BUCKET = 'import-artifacts' as const;

export const SEGMENTED_ARTIFACT_STAGES = [
  'document_map',
  'unit_plan',
  'unit_extraction',
  'merge',
  'semantic_reconciliation',
  'domain_mapping',
] as const;
export type SegmentedArtifactStage = (typeof SEGMENTED_ARTIFACT_STAGES)[number];
export type SegmentedArtifactStatus = 'queued' | 'processing' | 'succeeded' | 'failed';
export type SegmentedArtifactEventType =
  | 'artifact_queued'
  | 'artifact_started'
  | 'artifact_succeeded'
  | 'artifact_failed'
  | 'artifact_retried'
  | 'artifact_superseded';

export const SEGMENTED_ARTIFACT_LIMITS = Object.freeze({
  maximumCanonicalBodyBytes: 8 * 1024 * 1024,
  maximumSafeErrorMessageCharacters: 500,
} as const);

export const SEGMENTED_ARTIFACT_RETENTION_POLICY = Object.freeze({
  automaticDeletionEnabled: false,
  succeededMinimumDays: 365,
  failedManifestMinimumDays: 180,
  orphanBodyReviewAfterDays: 30,
} as const);

export interface SegmentedArtifactProviderMetadata {
  readonly providerKey: string;
  readonly providerVersion: string;
  readonly promptVersion?: string;
  readonly providerRunId?: string;
  readonly model?: string;
  readonly durationMs?: number;
  readonly inputUnits?: number;
  readonly outputUnits?: number;
  readonly totalUnits?: number;
}

export interface SegmentedArtifactContentDescriptor {
  readonly sha256: string;
  readonly byteLength: number;
  readonly canonicalization: 'canonical-json/1';
}

export interface SegmentedArtifactStorageReference {
  readonly bucket: typeof SEGMENTED_ARTIFACT_BUCKET;
  readonly objectPath: string;
}

export interface SegmentedArtifactFailure {
  readonly code: string;
  readonly message: string;
}

export interface SegmentedArtifactManifest {
  readonly schemaVersion: typeof SEGMENTED_ARTIFACT_MANIFEST_VERSION;
  readonly pipelineVersion: typeof SEGMENTED_ARTIFACT_PIPELINE_VERSION;
  readonly artifactSchemaVersion: string;
  readonly artifactId: string;
  readonly artifactVersion: number;
  readonly batchId: string;
  readonly jobId: string;
  readonly documentId?: string;
  readonly unitId?: string;
  readonly stage: SegmentedArtifactStage;
  readonly attempt: number;
  readonly status: SegmentedArtifactStatus;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly sourceArtifactIds: readonly string[];
  readonly supersedesArtifactId?: string;
  readonly retryOfArtifactId?: string;
  readonly content: SegmentedArtifactContentDescriptor;
  readonly storage: SegmentedArtifactStorageReference;
  readonly provider?: SegmentedArtifactProviderMetadata;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failure?: SegmentedArtifactFailure;
}

export interface SegmentedArtifactLifecycleEvent {
  readonly eventType: SegmentedArtifactEventType;
  readonly artifactId: string;
  readonly batchId: string;
  readonly jobId: string;
  readonly stage: SegmentedArtifactStage;
  readonly attempt: number;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

export interface SegmentedArtifactManifestRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<SegmentedArtifactManifest | undefined>;
  createQueued(manifest: SegmentedArtifactManifest): Promise<SegmentedArtifactManifest>;
  transition(
    artifactId: string,
    expectedStatus: SegmentedArtifactStatus,
    manifest: SegmentedArtifactManifest,
  ): Promise<SegmentedArtifactManifest>;
}

export interface SegmentedArtifactBodyStorage {
  put(reference: SegmentedArtifactStorageReference, body: Uint8Array): Promise<void>;
  exists(reference: SegmentedArtifactStorageReference): Promise<boolean>;
  read(reference: SegmentedArtifactStorageReference): Promise<Uint8Array>;
}

export interface SegmentedArtifactAuditSink {
  append(event: SegmentedArtifactLifecycleEvent): Promise<void>;
}

export interface PrepareSegmentedArtifactInput {
  readonly artifactSchemaVersion: string;
  readonly artifactVersion: number;
  readonly batchId: string;
  readonly jobId: string;
  readonly documentId?: string;
  readonly unitId?: string;
  readonly stage: SegmentedArtifactStage;
  readonly attempt: number;
  readonly correlationId: string;
  readonly sourceArtifacts: readonly SegmentedArtifactManifest[];
  readonly body: unknown;
  readonly provider?: SegmentedArtifactProviderMetadata;
  readonly supersedesArtifactId?: string;
  readonly retryOfArtifactId?: string;
  readonly createdAt: string;
}

export interface PublishSegmentedArtifactDependencies {
  readonly manifests: SegmentedArtifactManifestRepository;
  readonly storage: SegmentedArtifactBodyStorage;
  readonly audit: SegmentedArtifactAuditSink;
}

export type PublishSegmentedArtifactResult =
  | {
      readonly status: 'succeeded';
      readonly replayed: boolean;
      readonly manifest: SegmentedArtifactManifest;
      readonly auditRecorded: boolean;
    }
  | {
      readonly status: 'failed';
      readonly replayed: boolean;
      readonly manifest: SegmentedArtifactManifest;
      readonly failureManifestPersisted: boolean;
      readonly orphan?: SegmentedArtifactStorageReference;
    }
  | {
      readonly status: 'in_progress';
      readonly replayed: true;
      readonly manifest: SegmentedArtifactManifest;
    };

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const hashPattern = /^[a-f0-9]{64}$/u;

const assertIdentifier = (value: string, field: string): void => {
  if (!safeIdentifier.test(value)) throw new Error(`SEGMENTED_ARTIFACT_INVALID_${field}`);
};

const assertPositiveInteger = (value: number, field: string): void => {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`SEGMENTED_ARTIFACT_INVALID_${field}`);
};

const assertTimestamp = (value: string, field: string): void => {
  if (!value || !Number.isFinite(Date.parse(value)))
    throw new Error(`SEGMENTED_ARTIFACT_INVALID_${field}`);
};

const canonical = (value: unknown, ancestors: Set<object>): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('SEGMENTED_ARTIFACT_NON_JSON_VALUE');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new Error('SEGMENTED_ARTIFACT_NON_JSON_VALUE');
  const object = value as object;
  if (ancestors.has(object)) throw new Error('SEGMENTED_ARTIFACT_CYCLIC_BODY');
  ancestors.add(object);
  try {
    if (Array.isArray(value))
      return `[${value.map((item) => canonical(item, ancestors)).join(',')}]`;
    const record = value as Readonly<Record<string, unknown>>;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error('SEGMENTED_ARTIFACT_NON_PLAIN_OBJECT');
    return `{${Object.keys(record)
      .sort(compare)
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key], ancestors)}`)
      .join(',')}}`;
  } finally {
    ancestors.delete(object);
  }
};

export const canonicalizeSegmentedArtifactBody = (body: unknown): Uint8Array => {
  const bytes = new TextEncoder().encode(canonical(body, new Set()));
  if (bytes.byteLength > SEGMENTED_ARTIFACT_LIMITS.maximumCanonicalBodyBytes)
    throw new Error('SEGMENTED_ARTIFACT_BODY_TOO_LARGE');
  return bytes;
};

const hexadecimal = (bytes: Uint8Array): string =>
  [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');

export const hashSegmentedArtifactBytes = async (bytes: Uint8Array): Promise<string> =>
  hexadecimal(
    new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)),
  );

export const hashSegmentedArtifactBody = async (body: unknown): Promise<string> =>
  hashSegmentedArtifactBytes(canonicalizeSegmentedArtifactBody(body));

export const verifySegmentedArtifactContent = async (
  manifest: SegmentedArtifactManifest,
  body: Uint8Array,
): Promise<void> => {
  if (
    body.byteLength !== manifest.content.byteLength ||
    (await hashSegmentedArtifactBytes(body)) !== manifest.content.sha256
  )
    throw new Error('SEGMENTED_ARTIFACT_CONTENT_HASH_MISMATCH');
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
};

const expectedDependencyStages: Readonly<
  Record<SegmentedArtifactStage, readonly SegmentedArtifactStage[]>
> = Object.freeze({
  document_map: [],
  unit_plan: ['document_map'],
  unit_extraction: ['unit_plan'],
  merge: ['unit_extraction'],
  semantic_reconciliation: ['merge'],
  domain_mapping: ['semantic_reconciliation'],
});

export const buildSegmentedArtifactStorageReference = (input: {
  readonly batchId: string;
  readonly jobId: string;
  readonly stage: SegmentedArtifactStage;
  readonly artifactId: string;
}): SegmentedArtifactStorageReference => {
  assertIdentifier(input.batchId, 'BATCH_ID');
  assertIdentifier(input.jobId, 'JOB_ID');
  assertIdentifier(input.artifactId, 'ARTIFACT_ID');
  if (!SEGMENTED_ARTIFACT_STAGES.includes(input.stage))
    throw new Error('SEGMENTED_ARTIFACT_INVALID_STAGE');
  return deepFreeze({
    bucket: SEGMENTED_ARTIFACT_BUCKET,
    objectPath: `${input.batchId}/${input.jobId}/${input.stage}/${input.artifactId}.json`,
  });
};

export const validateSegmentedArtifactManifest = (
  manifest: SegmentedArtifactManifest,
): SegmentedArtifactManifest => {
  if (manifest.schemaVersion !== SEGMENTED_ARTIFACT_MANIFEST_VERSION)
    throw new Error('SEGMENTED_ARTIFACT_INCOMPATIBLE_MANIFEST_VERSION');
  if (manifest.pipelineVersion !== SEGMENTED_ARTIFACT_PIPELINE_VERSION)
    throw new Error('SEGMENTED_ARTIFACT_INCOMPATIBLE_PIPELINE_VERSION');
  if (!SEGMENTED_ARTIFACT_STAGES.includes(manifest.stage))
    throw new Error('SEGMENTED_ARTIFACT_INVALID_STAGE');
  if (!['queued', 'processing', 'succeeded', 'failed'].includes(manifest.status))
    throw new Error('SEGMENTED_ARTIFACT_INVALID_STATUS');
  [
    ['ARTIFACT_ID', manifest.artifactId],
    ['BATCH_ID', manifest.batchId],
    ['JOB_ID', manifest.jobId],
    ['CORRELATION_ID', manifest.correlationId],
  ].forEach(([field, value]) => assertIdentifier(value!, field!));
  if (manifest.documentId) assertIdentifier(manifest.documentId, 'DOCUMENT_ID');
  if (manifest.unitId) assertIdentifier(manifest.unitId, 'UNIT_ID');
  if (!manifest.artifactSchemaVersion.trim())
    throw new Error('SEGMENTED_ARTIFACT_INVALID_ARTIFACT_SCHEMA_VERSION');
  assertPositiveInteger(manifest.artifactVersion, 'ARTIFACT_VERSION');
  assertPositiveInteger(manifest.attempt, 'ATTEMPT');
  assertTimestamp(manifest.createdAt, 'CREATED_AT');
  if (!hashPattern.test(manifest.content.sha256))
    throw new Error('SEGMENTED_ARTIFACT_INVALID_CONTENT_HASH');
  if (!Number.isSafeInteger(manifest.content.byteLength) || manifest.content.byteLength < 0)
    throw new Error('SEGMENTED_ARTIFACT_INVALID_CONTENT_LENGTH');
  if (manifest.content.byteLength > SEGMENTED_ARTIFACT_LIMITS.maximumCanonicalBodyBytes)
    throw new Error('SEGMENTED_ARTIFACT_BODY_TOO_LARGE');
  if (manifest.provider) {
    const allowed = new Set([
      'providerKey',
      'providerVersion',
      'promptVersion',
      'providerRunId',
      'model',
      'durationMs',
      'inputUnits',
      'outputUnits',
      'totalUnits',
    ]);
    if (Object.keys(manifest.provider).some((key) => !allowed.has(key)))
      throw new Error('SEGMENTED_ARTIFACT_UNSAFE_PROVIDER_METADATA');
    assertIdentifier(manifest.provider.providerKey, 'PROVIDER_KEY');
    assertIdentifier(manifest.provider.providerVersion, 'PROVIDER_VERSION');
    if (manifest.provider.promptVersion)
      assertIdentifier(manifest.provider.promptVersion, 'PROMPT_VERSION');
    if (manifest.provider.providerRunId)
      assertIdentifier(manifest.provider.providerRunId, 'PROVIDER_RUN_ID');
    if (manifest.provider.model) assertIdentifier(manifest.provider.model, 'MODEL');
    for (const value of [
      manifest.provider.durationMs,
      manifest.provider.inputUnits,
      manifest.provider.outputUnits,
      manifest.provider.totalUnits,
    ])
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
        throw new Error('SEGMENTED_ARTIFACT_INVALID_PROVIDER_METRIC');
  }
  if (
    manifest.storage.bucket !== SEGMENTED_ARTIFACT_BUCKET ||
    manifest.storage.objectPath !== buildSegmentedArtifactStorageReference(manifest).objectPath
  )
    throw new Error('SEGMENTED_ARTIFACT_INVALID_STORAGE_PATH');
  if (
    manifest.status === 'queued' &&
    (manifest.startedAt || manifest.completedAt || manifest.failure)
  )
    throw new Error('SEGMENTED_ARTIFACT_INVALID_QUEUED_STATE');
  if (
    manifest.status === 'processing' &&
    (!manifest.startedAt || manifest.completedAt || manifest.failure)
  )
    throw new Error('SEGMENTED_ARTIFACT_INVALID_PROCESSING_STATE');
  if (
    manifest.status === 'succeeded' &&
    (!manifest.startedAt || !manifest.completedAt || manifest.failure)
  )
    throw new Error('SEGMENTED_ARTIFACT_INVALID_SUCCEEDED_STATE');
  if (
    manifest.status === 'failed' &&
    (!manifest.startedAt || !manifest.completedAt || !manifest.failure)
  )
    throw new Error('SEGMENTED_ARTIFACT_INVALID_FAILED_STATE');
  return manifest;
};

export const validateSegmentedArtifactDag = (
  manifests: readonly SegmentedArtifactManifest[],
): void => {
  const byId = new Map<string, SegmentedArtifactManifest>();
  for (const manifest of manifests) {
    validateSegmentedArtifactManifest(manifest);
    if (byId.has(manifest.artifactId)) throw new Error('SEGMENTED_ARTIFACT_DUPLICATE_ID');
    byId.set(manifest.artifactId, manifest);
  }
  const cycleVisiting = new Set<string>();
  const cycleVisited = new Set<string>();
  const detectCycle = (manifest: SegmentedArtifactManifest): void => {
    if (cycleVisiting.has(manifest.artifactId)) throw new Error('SEGMENTED_ARTIFACT_DAG_CYCLE');
    if (cycleVisited.has(manifest.artifactId)) return;
    cycleVisiting.add(manifest.artifactId);
    for (const sourceId of manifest.sourceArtifactIds) {
      if (sourceId === manifest.artifactId) throw new Error('SEGMENTED_ARTIFACT_SELF_DEPENDENCY');
      const source = byId.get(sourceId);
      if (source) detectCycle(source);
    }
    cycleVisiting.delete(manifest.artifactId);
    cycleVisited.add(manifest.artifactId);
  };
  manifests.forEach(detectCycle);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (manifest: SegmentedArtifactManifest): void => {
    if (visiting.has(manifest.artifactId)) throw new Error('SEGMENTED_ARTIFACT_DAG_CYCLE');
    if (visited.has(manifest.artifactId)) return;
    visiting.add(manifest.artifactId);
    const expected = expectedDependencyStages[manifest.stage];
    if (!expected.length && manifest.sourceArtifactIds.length)
      throw new Error('SEGMENTED_ARTIFACT_UNEXPECTED_DEPENDENCY');
    if (expected.length && !manifest.sourceArtifactIds.length)
      throw new Error('SEGMENTED_ARTIFACT_MISSING_DEPENDENCY');
    for (const sourceId of manifest.sourceArtifactIds) {
      const source = byId.get(sourceId);
      if (!source) throw new Error('SEGMENTED_ARTIFACT_DANGLING_DEPENDENCY');
      if (source.artifactId === manifest.artifactId)
        throw new Error('SEGMENTED_ARTIFACT_SELF_DEPENDENCY');
      if (!expected.includes(source.stage))
        throw new Error('SEGMENTED_ARTIFACT_INVALID_DEPENDENCY_STAGE');
      if (source.batchId !== manifest.batchId || source.jobId !== manifest.jobId)
        throw new Error('SEGMENTED_ARTIFACT_CROSS_JOB_DEPENDENCY');
      if (source.pipelineVersion !== manifest.pipelineVersion)
        throw new Error('SEGMENTED_ARTIFACT_INCOMPATIBLE_DEPENDENCY_VERSION');
      if (source.status !== 'succeeded')
        throw new Error('SEGMENTED_ARTIFACT_DEPENDENCY_NOT_SUCCEEDED');
      visit(source);
    }
    visiting.delete(manifest.artifactId);
    visited.add(manifest.artifactId);
  };
  manifests.forEach(visit);
};

const idempotencyMaterial = (
  input: PrepareSegmentedArtifactInput,
): Readonly<Record<string, unknown>> => ({
  pipelineVersion: SEGMENTED_ARTIFACT_PIPELINE_VERSION,
  artifactSchemaVersion: input.artifactSchemaVersion,
  artifactVersion: input.artifactVersion,
  batchId: input.batchId,
  jobId: input.jobId,
  documentId: input.documentId ?? null,
  unitId: input.unitId ?? null,
  stage: input.stage,
  attempt: input.attempt,
  correlationId: input.correlationId,
  sourceContentHashes: input.sourceArtifacts.map((source) => source.content.sha256).sort(compare),
  provider: input.provider
    ? {
        providerKey: input.provider.providerKey,
        providerVersion: input.provider.providerVersion,
        promptVersion: input.provider.promptVersion ?? null,
        model: input.provider.model ?? null,
      }
    : null,
});

export const prepareSegmentedArtifact = async (
  input: PrepareSegmentedArtifactInput,
): Promise<{ readonly manifest: SegmentedArtifactManifest; readonly body: Uint8Array }> => {
  assertPositiveInteger(input.artifactVersion, 'ARTIFACT_VERSION');
  assertPositiveInteger(input.attempt, 'ATTEMPT');
  assertTimestamp(input.createdAt, 'CREATED_AT');
  const body = canonicalizeSegmentedArtifactBody(input.body);
  const contentHash = await hashSegmentedArtifactBytes(body);
  const idempotencyHash = await hashSegmentedArtifactBody(idempotencyMaterial(input));
  const idempotencyKey = `segmented-artifact-${idempotencyHash}`;
  const artifactId = `artifact-${idempotencyHash}`;
  const manifest: SegmentedArtifactManifest = {
    schemaVersion: SEGMENTED_ARTIFACT_MANIFEST_VERSION,
    pipelineVersion: SEGMENTED_ARTIFACT_PIPELINE_VERSION,
    artifactSchemaVersion: input.artifactSchemaVersion,
    artifactId,
    artifactVersion: input.artifactVersion,
    batchId: input.batchId,
    jobId: input.jobId,
    ...(input.documentId ? { documentId: input.documentId } : {}),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    stage: input.stage,
    attempt: input.attempt,
    status: 'queued',
    correlationId: input.correlationId,
    idempotencyKey,
    sourceArtifactIds: input.sourceArtifacts.map((source) => source.artifactId).sort(compare),
    ...(input.supersedesArtifactId ? { supersedesArtifactId: input.supersedesArtifactId } : {}),
    ...(input.retryOfArtifactId ? { retryOfArtifactId: input.retryOfArtifactId } : {}),
    content: {
      sha256: contentHash,
      byteLength: body.byteLength,
      canonicalization: 'canonical-json/1',
    },
    storage: buildSegmentedArtifactStorageReference({
      batchId: input.batchId,
      jobId: input.jobId,
      stage: input.stage,
      artifactId,
    }),
    ...(input.provider ? { provider: structuredClone(input.provider) } : {}),
    createdAt: input.createdAt,
  };
  validateSegmentedArtifactManifest(manifest);
  return Object.freeze({ manifest: deepFreeze(manifest), body });
};

export const transitionSegmentedArtifact = (
  manifest: SegmentedArtifactManifest,
  transition:
    | { readonly status: 'processing'; readonly occurredAt: string }
    | { readonly status: 'succeeded'; readonly occurredAt: string }
    | {
        readonly status: 'failed';
        readonly occurredAt: string;
        readonly failure: SegmentedArtifactFailure;
      },
): SegmentedArtifactManifest => {
  assertTimestamp(transition.occurredAt, 'TRANSITION_AT');
  if (manifest.status === 'queued' && transition.status !== 'processing')
    throw new Error('SEGMENTED_ARTIFACT_INVALID_TRANSITION');
  if (manifest.status === 'processing' && transition.status === 'processing')
    throw new Error('SEGMENTED_ARTIFACT_INVALID_TRANSITION');
  if (manifest.status === 'succeeded' || manifest.status === 'failed')
    throw new Error('SEGMENTED_ARTIFACT_TERMINAL_STATE');
  const next: SegmentedArtifactManifest =
    transition.status === 'processing'
      ? { ...manifest, status: 'processing', startedAt: transition.occurredAt }
      : transition.status === 'succeeded'
        ? { ...manifest, status: 'succeeded', completedAt: transition.occurredAt }
        : {
            ...manifest,
            status: 'failed',
            completedAt: transition.occurredAt,
            failure: {
              code: transition.failure.code.slice(0, 100),
              message: transition.failure.message.slice(
                0,
                SEGMENTED_ARTIFACT_LIMITS.maximumSafeErrorMessageCharacters,
              ),
            },
          };
  validateSegmentedArtifactManifest(next);
  return deepFreeze(next);
};

export const resolveLatestSucceededSegmentedArtifact = (
  manifests: readonly SegmentedArtifactManifest[],
  selector: {
    readonly batchId: string;
    readonly jobId: string;
    readonly stage: SegmentedArtifactStage;
    readonly documentId?: string;
    readonly unitId?: string;
  },
): SegmentedArtifactManifest | undefined =>
  manifests
    .filter(
      (manifest) =>
        manifest.status === 'succeeded' &&
        manifest.batchId === selector.batchId &&
        manifest.jobId === selector.jobId &&
        manifest.stage === selector.stage &&
        manifest.documentId === selector.documentId &&
        manifest.unitId === selector.unitId,
    )
    .sort(
      (left, right) =>
        right.artifactVersion - left.artifactVersion ||
        right.attempt - left.attempt ||
        compare(right.completedAt!, left.completedAt!) ||
        compare(right.artifactId, left.artifactId),
    )[0];

const eventFor = (
  manifest: SegmentedArtifactManifest,
  eventType: SegmentedArtifactEventType,
  occurredAt: string,
): SegmentedArtifactLifecycleEvent => ({
  eventType,
  artifactId: manifest.artifactId,
  batchId: manifest.batchId,
  jobId: manifest.jobId,
  stage: manifest.stage,
  attempt: manifest.attempt,
  correlationId: manifest.correlationId,
  occurredAt,
});

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);

const replayResult = (manifest: SegmentedArtifactManifest): PublishSegmentedArtifactResult => {
  if (manifest.status === 'succeeded')
    return { status: 'succeeded', replayed: true, manifest, auditRecorded: true };
  if (manifest.status === 'failed')
    return {
      status: 'failed',
      replayed: true,
      manifest,
      failureManifestPersisted: true,
    };
  return { status: 'in_progress', replayed: true, manifest };
};

export const publishSegmentedArtifact = async (
  input: PrepareSegmentedArtifactInput & {
    readonly startedAt: string;
    readonly completedAt: string;
  },
  dependencies: PublishSegmentedArtifactDependencies,
): Promise<PublishSegmentedArtifactResult> => {
  const prepared = await prepareSegmentedArtifact(input);
  const existing = await dependencies.manifests.findByIdempotencyKey(
    prepared.manifest.idempotencyKey,
  );
  if (existing) return replayResult(existing);
  let manifest: SegmentedArtifactManifest;
  try {
    manifest = await dependencies.manifests.createQueued(prepared.manifest);
  } catch (error) {
    const concurrent = await dependencies.manifests.findByIdempotencyKey(
      prepared.manifest.idempotencyKey,
    );
    if (!concurrent) throw error;
    return replayResult(concurrent);
  }
  await dependencies.audit.append(eventFor(manifest, 'artifact_queued', input.createdAt));
  manifest = transitionSegmentedArtifact(manifest, {
    status: 'processing',
    occurredAt: input.startedAt,
  });
  manifest = await dependencies.manifests.transition(manifest.artifactId, 'queued', manifest);
  await dependencies.audit.append(eventFor(manifest, 'artifact_started', input.startedAt));
  let bodyStored = false;
  let finalizingManifest = false;
  try {
    await dependencies.storage.put(manifest.storage, prepared.body);
    bodyStored = true;
    if (!(await dependencies.storage.exists(manifest.storage)))
      throw new Error('STORAGE_OBJECT_MISSING');
    const persisted = await dependencies.storage.read(manifest.storage);
    await verifySegmentedArtifactContent(manifest, persisted);
    if (!equalBytes(persisted, prepared.body)) throw new Error('STORAGE_VERIFICATION_FAILED');
    const succeeded = transitionSegmentedArtifact(manifest, {
      status: 'succeeded',
      occurredAt: input.completedAt,
    });
    finalizingManifest = true;
    manifest = await dependencies.manifests.transition(
      manifest.artifactId,
      'processing',
      succeeded,
    );
    let auditRecorded = true;
    try {
      await dependencies.audit.append(eventFor(manifest, 'artifact_succeeded', input.completedAt));
    } catch {
      auditRecorded = false;
    }
    return { status: 'succeeded', replayed: false, manifest, auditRecorded };
  } catch {
    const code = finalizingManifest
      ? 'MANIFEST_FINALIZATION_FAILED'
      : bodyStored
        ? 'ARTIFACT_STORAGE_VERIFICATION_FAILED'
        : 'ARTIFACT_STORAGE_FAILED';
    const failed = transitionSegmentedArtifact(manifest, {
      status: 'failed',
      occurredAt: input.completedAt,
      failure: {
        code,
        message: finalizingManifest
          ? 'Artifact body requires orphan review after manifest finalization failed.'
          : bodyStored
            ? 'Artifact body requires orphan review after Storage verification failed.'
            : 'Artifact body could not be durably stored.',
      },
    });
    let failureManifestPersisted = false;
    try {
      manifest = await dependencies.manifests.transition(manifest.artifactId, 'processing', failed);
      failureManifestPersisted = true;
    } catch {
      manifest = failed;
    }
    try {
      await dependencies.audit.append(eventFor(manifest, 'artifact_failed', input.completedAt));
    } catch {
      // The typed result remains the observable compensation when the audit sink is unavailable.
    }
    return {
      status: 'failed',
      replayed: false,
      manifest,
      failureManifestPersisted,
      ...(bodyStored ? { orphan: manifest.storage } : {}),
    };
  }
};
