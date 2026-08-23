import { createHash, randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

const STAGING_REF = 'shfsjyjxmgwnlexmdkcs';
const BENCHMARK_BATCH_ID = '117';
const BENCHMARK_DOCUMENT_ID = '48';
const BENCHMARK_FILENAME = 'Geely 202602-01.pdf';
const BENCHMARK_SIZE = 902_380;
const BENCHMARK_SHA256 = '17b24ab9617fe4d2ee3134f423fea8f71dde74fcbfa6ebc5efd5bf8e499a9f6b';
const enabled = process.env.RUN_SEGMENTED_OPENAI_IMPORT_SMOKE === '1';

export interface SegmentedOpenAISmokeConfig {
  readonly projectRef: typeof STAGING_REF;
  readonly batchId: typeof BENCHMARK_BATCH_ID;
  readonly mode: 'segmented';
  readonly provider: 'openai';
  readonly model: 'gpt-5.6-terra';
}

type SmokeEnvironment = Readonly<Record<string, string | undefined>>;

export function isSegmentedOpenAISmokeEnabled(env: SmokeEnvironment): boolean {
  return env.RUN_SEGMENTED_OPENAI_IMPORT_SMOKE === '1';
}

export function readSegmentedOpenAISmokeConfig(env: SmokeEnvironment): SegmentedOpenAISmokeConfig {
  if (env.IMPORT_EXTRACTION_MODE !== 'segmented') throw new Error('SEGMENTED_SMOKE_MODE_INVALID');
  if (!env.IMPORT_EXTRACTION_PROVIDER?.trim()) throw new Error('SEGMENTED_SMOKE_PROVIDER_MISSING');
  if (env.IMPORT_EXTRACTION_PROVIDER !== 'openai')
    throw new Error('SEGMENTED_SMOKE_PROVIDER_INVALID');
  if (!env.SUPABASE_URL?.trim()) throw new Error('SEGMENTED_SMOKE_SUPABASE_URL_MISSING');
  if (!env.SUPABASE_SERVER_KEY?.trim()) throw new Error('SEGMENTED_SMOKE_SERVER_KEY_MISSING');
  if (!env.OPENAI_API_KEY?.trim()) throw new Error('SEGMENTED_SMOKE_OPENAI_KEY_MISSING');
  if (env.OPENAI_IMPORT_MODEL !== 'gpt-5.6-terra') throw new Error('SEGMENTED_SMOKE_MODEL_INVALID');
  if (env.OPENAI_IMPORT_SMOKE_BATCH_ID !== BENCHMARK_BATCH_ID)
    throw new Error('SEGMENTED_SMOKE_BATCH_INVALID');

  const url = new URL(env.SUPABASE_URL);
  if (url.hostname !== `${STAGING_REF}.supabase.co`)
    throw new Error('SEGMENTED_SMOKE_PROJECT_INVALID');

  return {
    projectRef: STAGING_REF,
    batchId: BENCHMARK_BATCH_ID,
    mode: 'segmented',
    provider: 'openai',
    model: 'gpt-5.6-terra',
  };
}

export function assertSegmentedOpenAISmokeLifecyclePreconditions(input: {
  readonly batchStatus: string;
  readonly documentStatuses: readonly string[];
  readonly activeJobCount: number;
}): 'FIRST_RUN' | 'RETRY' {
  if (input.activeJobCount !== 0) throw new Error('SEGMENTED_SMOKE_ACTIVE_JOB');
  if (input.batchStatus === 'ready' && input.documentStatuses.every((status) => status === 'ready'))
    return 'FIRST_RUN';
  if (
    input.batchStatus === 'failed' &&
    input.documentStatuses.every((status) => status === 'failed')
  )
    return 'RETRY';
  throw new Error('SEGMENTED_SMOKE_LIFECYCLE_INVALID');
}

interface SmokeJobSnapshot {
  readonly id: string | number;
  readonly batchId: string | number;
  readonly attempt: number;
  readonly status: string;
}

interface SmokeArtifactSnapshot {
  readonly id: string | number;
  readonly batchId: string | number;
  readonly jobId: string | number;
  readonly attempt: number;
  readonly status: string;
}

interface SmokeArtifactDependencySnapshot {
  readonly artifactId: string | number;
  readonly sourceArtifactId: string | number;
}

const terminalStatuses = new Set(['succeeded', 'failed']);
const activeStatuses = new Set(['queued', 'processing']);

export function assertSegmentedOpenAISmokeArtifactPreconditions(input: {
  readonly batchId: string;
  readonly pricingRowCount: number;
  readonly jobs: readonly SmokeJobSnapshot[];
  readonly artifacts: readonly SmokeArtifactSnapshot[];
  readonly dependencies: readonly SmokeArtifactDependencySnapshot[];
}): void {
  if (input.pricingRowCount !== 0) throw new Error('SEGMENTED_SMOKE_EXISTING_ROWS');
  const jobs = new Map(input.jobs.map((job) => [String(job.id), job]));
  if (jobs.size !== input.jobs.length) throw new Error('SEGMENTED_SMOKE_DUPLICATE_JOB');
  for (const job of input.jobs) {
    if (String(job.batchId) !== input.batchId) throw new Error('SEGMENTED_SMOKE_CROSS_BATCH_JOB');
    if (activeStatuses.has(job.status)) throw new Error('SEGMENTED_SMOKE_ACTIVE_JOB');
    if (!terminalStatuses.has(job.status)) throw new Error('SEGMENTED_SMOKE_JOB_NON_TERMINAL');
  }
  const artifacts = new Map(input.artifacts.map((artifact) => [String(artifact.id), artifact]));
  if (artifacts.size !== input.artifacts.length)
    throw new Error('SEGMENTED_SMOKE_DUPLICATE_ARTIFACT');
  for (const artifact of input.artifacts) {
    if (String(artifact.batchId) !== input.batchId)
      throw new Error('SEGMENTED_SMOKE_CROSS_BATCH_ARTIFACT');
    const job = jobs.get(String(artifact.jobId));
    if (!job) throw new Error('SEGMENTED_SMOKE_ARTIFACT_UNKNOWN_JOB');
    if (artifact.attempt !== job.attempt)
      throw new Error('SEGMENTED_SMOKE_ARTIFACT_ATTEMPT_MISMATCH');
    if (!terminalStatuses.has(artifact.status))
      throw new Error('SEGMENTED_SMOKE_ARTIFACT_NON_TERMINAL');
  }
  for (const dependency of input.dependencies) {
    if (String(dependency.artifactId) === String(dependency.sourceArtifactId))
      throw new Error('SEGMENTED_SMOKE_ARTIFACT_SELF_DEPENDENCY');
    const artifact = artifacts.get(String(dependency.artifactId));
    const source = artifacts.get(String(dependency.sourceArtifactId));
    if (!artifact || !source) throw new Error('SEGMENTED_SMOKE_ARTIFACT_DANGLING_DEPENDENCY');
    if (
      String(artifact.batchId) !== String(source.batchId) ||
      String(artifact.jobId) !== String(source.jobId)
    )
      throw new Error('SEGMENTED_SMOKE_ARTIFACT_CROSS_JOB_DEPENDENCY');
    if (source.status !== 'succeeded')
      throw new Error('SEGMENTED_SMOKE_ARTIFACT_DEPENDENCY_NOT_SUCCEEDED');
  }
}

const validEnv = (): SmokeEnvironment => ({
  SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
  SUPABASE_SERVER_KEY: 'server-secret-not-returned',
  OPENAI_API_KEY: 'openai-secret-not-returned',
  OPENAI_IMPORT_MODEL: 'gpt-5.6-terra',
  IMPORT_EXTRACTION_MODE: 'segmented',
  IMPORT_EXTRACTION_PROVIDER: 'openai',
  OPENAI_IMPORT_SMOKE_BATCH_ID: BENCHMARK_BATCH_ID,
});

describe('Sprint 10C.4D segmented OpenAI smoke harness preconditions', () => {
  it('reads inherited environment and recognizes segmented mode', () => {
    expect(readSegmentedOpenAISmokeConfig(validEnv())).toEqual({
      projectRef: STAGING_REF,
      batchId: BENCHMARK_BATCH_ID,
      mode: 'segmented',
      provider: 'openai',
      model: 'gpt-5.6-terra',
    });
  });

  it('rejects one-shot mode before the real smoke can run', () => {
    expect(() =>
      readSegmentedOpenAISmokeConfig({
        ...validEnv(),
        IMPORT_EXTRACTION_MODE: 'one_shot',
      }),
    ).toThrow('SEGMENTED_SMOKE_MODE_INVALID');
  });

  it.each([
    [undefined, 'SEGMENTED_SMOKE_PROVIDER_MISSING'],
    ['fake', 'SEGMENTED_SMOKE_PROVIDER_INVALID'],
    ['other', 'SEGMENTED_SMOKE_PROVIDER_INVALID'],
  ] as const)('rejects structured provider %s before the real smoke can run', (provider, code) => {
    expect(() =>
      readSegmentedOpenAISmokeConfig({
        ...validEnv(),
        IMPORT_EXTRACTION_PROVIDER: provider,
      }),
    ).toThrow(code);
  });

  it.each([
    ['SUPABASE_URL', 'SEGMENTED_SMOKE_SUPABASE_URL_MISSING'],
    ['SUPABASE_SERVER_KEY', 'SEGMENTED_SMOKE_SERVER_KEY_MISSING'],
    ['OPENAI_API_KEY', 'SEGMENTED_SMOKE_OPENAI_KEY_MISSING'],
  ] as const)('fails safely when %s is missing', (name, code) => {
    expect(() => readSegmentedOpenAISmokeConfig({ ...validEnv(), [name]: '' })).toThrow(code);
  });

  it('rejects the wrong project ref', () => {
    expect(() =>
      readSegmentedOpenAISmokeConfig({
        ...validEnv(),
        SUPABASE_URL: 'https://wrong-project.supabase.co',
      }),
    ).toThrow('SEGMENTED_SMOKE_PROJECT_INVALID');
  });

  it('rejects the wrong batch', () => {
    expect(() =>
      readSegmentedOpenAISmokeConfig({
        ...validEnv(),
        OPENAI_IMPORT_SMOKE_BATCH_ID: '116',
      }),
    ).toThrow('SEGMENTED_SMOKE_BATCH_INVALID');
  });

  it('keeps the real smoke disabled unless explicitly opted in', () => {
    expect(isSegmentedOpenAISmokeEnabled({})).toBe(false);
    expect(isSegmentedOpenAISmokeEnabled({ RUN_SEGMENTED_OPENAI_IMPORT_SMOKE: '0' })).toBe(false);
    expect(isSegmentedOpenAISmokeEnabled({ RUN_SEGMENTED_OPENAI_IMPORT_SMOKE: '1' })).toBe(true);
  });

  it('never returns secrets in the validated configuration', () => {
    const serialized = JSON.stringify(readSegmentedOpenAISmokeConfig(validEnv()));
    expect(serialized).not.toContain('server-secret-not-returned');
    expect(serialized).not.toContain('openai-secret-not-returned');
    expect(serialized).not.toContain('SUPABASE_SERVER_KEY');
    expect(serialized).not.toContain('OPENAI_API_KEY');
  });

  it('accepts failed batch and documents with no active job as an official retry', () => {
    expect(
      assertSegmentedOpenAISmokeLifecyclePreconditions({
        batchStatus: 'failed',
        documentStatuses: ['failed'],
        activeJobCount: 0,
      }),
    ).toBe('RETRY');
  });

  it.each(['succeeded', 'failed'] as const)(
    'allows terminal historical %s artifacts owned by a terminal prior job',
    (artifactStatus) => {
      expect(() =>
        assertSegmentedOpenAISmokeArtifactPreconditions({
          batchId: BENCHMARK_BATCH_ID,
          pricingRowCount: 0,
          jobs: [{ id: 44, batchId: 117, attempt: 7, status: 'failed' }],
          artifacts: [
            {
              id: 1,
              batchId: 117,
              jobId: 44,
              attempt: 7,
              status: artifactStatus,
            },
          ],
          dependencies: [],
        }),
      ).not.toThrow();
    },
  );

  it('allows the Job 44 document_map and unit_plan succeeded lineage', () => {
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 0,
        jobs: [{ id: 44, batchId: 117, attempt: 7, status: 'failed' }],
        artifacts: [
          { id: 1, batchId: 117, jobId: 44, attempt: 7, status: 'succeeded' },
          { id: 2, batchId: 117, jobId: 44, attempt: 7, status: 'succeeded' },
        ],
        dependencies: [{ artifactId: 2, sourceArtifactId: 1 }],
      }),
    ).not.toThrow();
  });

  it('rejects active jobs with or without an in-progress artifact', () => {
    const activeJob = [{ id: 45, batchId: 117, attempt: 8, status: 'processing' }];
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 0,
        jobs: activeJob,
        artifacts: [],
        dependencies: [],
      }),
    ).toThrow('SEGMENTED_SMOKE_ACTIVE_JOB');
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 0,
        jobs: activeJob,
        artifacts: [{ id: 3, batchId: 117, jobId: 45, attempt: 8, status: 'processing' }],
        dependencies: [],
      }),
    ).toThrow('SEGMENTED_SMOKE_ACTIVE_JOB');
  });

  it('rejects a non-terminal artifact even when its historical job is terminal', () => {
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 0,
        jobs: [{ id: 44, batchId: 117, attempt: 7, status: 'failed' }],
        artifacts: [{ id: 2, batchId: 117, jobId: 44, attempt: 7, status: 'queued' }],
        dependencies: [],
      }),
    ).toThrow('SEGMENTED_SMOKE_ARTIFACT_NON_TERMINAL');
  });

  it('preserves the clean-benchmark pricing row gate', () => {
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 1,
        jobs: [],
        artifacts: [],
        dependencies: [],
      }),
    ).toThrow('SEGMENTED_SMOKE_EXISTING_ROWS');
  });

  it.each([
    [
      'cross-batch artifact',
      [{ id: 1, batchId: 118, jobId: 44, attempt: 7, status: 'succeeded' }],
      'SEGMENTED_SMOKE_CROSS_BATCH_ARTIFACT',
    ],
    [
      'artifact for an unknown future job',
      [{ id: 1, batchId: 117, jobId: 45, attempt: 8, status: 'succeeded' }],
      'SEGMENTED_SMOKE_ARTIFACT_UNKNOWN_JOB',
    ],
    [
      'artifact with mismatched attempt',
      [{ id: 1, batchId: 117, jobId: 44, attempt: 8, status: 'succeeded' }],
      'SEGMENTED_SMOKE_ARTIFACT_ATTEMPT_MISMATCH',
    ],
  ] as const)('rejects malformed %s data', (_name, artifacts, code) => {
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 0,
        jobs: [{ id: 44, batchId: 117, attempt: 7, status: 'failed' }],
        artifacts,
        dependencies: [],
      }),
    ).toThrow(code);
  });

  it.each([
    [
      'dangling dependency',
      [{ artifactId: 2, sourceArtifactId: 99 }],
      'SEGMENTED_SMOKE_ARTIFACT_DANGLING_DEPENDENCY',
    ],
    [
      'self dependency',
      [{ artifactId: 2, sourceArtifactId: 2 }],
      'SEGMENTED_SMOKE_ARTIFACT_SELF_DEPENDENCY',
    ],
  ] as const)('rejects %s in historical artifact lineage', (_name, dependencies, code) => {
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 0,
        jobs: [{ id: 44, batchId: 117, attempt: 7, status: 'failed' }],
        artifacts: [
          { id: 1, batchId: 117, jobId: 44, attempt: 7, status: 'succeeded' },
          { id: 2, batchId: 117, jobId: 44, attempt: 7, status: 'succeeded' },
        ],
        dependencies,
      }),
    ).toThrow(code);
  });

  it('rejects a cross-job historical dependency', () => {
    expect(() =>
      assertSegmentedOpenAISmokeArtifactPreconditions({
        batchId: BENCHMARK_BATCH_ID,
        pricingRowCount: 0,
        jobs: [
          { id: 43, batchId: 117, attempt: 6, status: 'failed' },
          { id: 44, batchId: 117, attempt: 7, status: 'failed' },
        ],
        artifacts: [
          { id: 1, batchId: 117, jobId: 43, attempt: 6, status: 'succeeded' },
          { id: 2, batchId: 117, jobId: 44, attempt: 7, status: 'succeeded' },
        ],
        dependencies: [{ artifactId: 2, sourceArtifactId: 1 }],
      }),
    ).toThrow('SEGMENTED_SMOKE_ARTIFACT_CROSS_JOB_DEPENDENCY');
  });
});

describe.skipIf(!enabled)('Sprint 10C.4D real segmented OpenAI smoke', () => {
  it('processes exactly the explicitly selected Staging benchmark without promotion', async () => {
    const config = readSegmentedOpenAISmokeConfig(process.env);
    const [{ createLegacySupabaseClientFromEnv, ImportEngineSupabaseAdapter }, processingModule] =
      await Promise.all([
        import('@compra-car/adapter-supabase'),
        import('@compra-car/adapter-supabase'),
      ]);
    const { processAdminImportBatch } = await import('../src/server/import-engine-service');
    const client = createLegacySupabaseClientFromEnv();
    const repository = new ImportEngineSupabaseAdapter(client);
    const processing = new processingModule.ImportProcessingSupabaseAdapter(client);
    const batch = await repository.getBatch(config.batchId);
    expect(batch).toMatchObject({ id: BENCHMARK_BATCH_ID, pluginKey: 'commercial_letters' });
    expect(batch?.documents).toHaveLength(1);
    expect(batch?.documents[0]).toMatchObject({
      id: BENCHMARK_DOCUMENT_ID,
      originalFileName: BENCHMARK_FILENAME,
      documentRole: 'primary',
      mimeType: 'application/pdf',
      fileSizeBytes: BENCHMARK_SIZE,
      contentSha256: BENCHMARK_SHA256,
    });

    const [jobsResult, rowsResult, artifactsResult] = await Promise.all([
      client
        .from('pricing_import_processing_jobs')
        .select('id,batch_id,attempt,status')
        .eq('batch_id', config.batchId),
      client.from('pricing_import_rows').select('id').eq('batch_id', config.batchId),
      client
        .from('pricing_import_processing_artifacts')
        .select('id,batch_id,processing_job_id,attempt,status')
        .eq('batch_id', config.batchId),
    ]);
    expect(jobsResult.error).toBeNull();
    expect(rowsResult.error).toBeNull();
    expect(artifactsResult.error).toBeNull();
    const historicalJobs = jobsResult.data ?? [];
    const existingRows = rowsResult.data ?? [];
    const existingArtifacts = artifactsResult.data ?? [];
    const artifactIds = existingArtifacts.map((artifact) => artifact.id);
    const dependenciesResult = artifactIds.length
      ? await client
          .from('pricing_import_processing_artifact_dependencies')
          .select('artifact_id,source_artifact_id')
          .in('artifact_id', artifactIds)
      : { data: [], error: null };
    expect(dependenciesResult.error).toBeNull();
    const activeJobCount = historicalJobs.filter((job) => activeStatuses.has(job.status)).length;
    expect(existingRows).toHaveLength(0);
    expect(
      assertSegmentedOpenAISmokeLifecyclePreconditions({
        batchStatus: batch!.status,
        documentStatuses: batch!.documents.map((item) => item.status),
        activeJobCount,
      }),
    ).toMatch(/^(?:FIRST_RUN|RETRY)$/u);
    assertSegmentedOpenAISmokeArtifactPreconditions({
      batchId: config.batchId,
      pricingRowCount: existingRows.length,
      jobs: historicalJobs.map((job) => ({
        id: job.id,
        batchId: job.batch_id,
        attempt: job.attempt,
        status: job.status,
      })),
      artifacts: existingArtifacts.map((artifact) => ({
        id: artifact.id,
        batchId: artifact.batch_id,
        jobId: artifact.processing_job_id,
        attempt: artifact.attempt,
        status: artifact.status,
      })),
      dependencies: (dependenciesResult.data ?? []).map((dependency) => ({
        artifactId: dependency.artifact_id,
        sourceArtifactId: dependency.source_artifact_id,
      })),
    });

    const document = batch!.documents[0]!;
    const bytes = await processing.downloadDocument(
      document.storageBucket,
      document.storageObjectPath,
    );
    expect(bytes.byteLength).toBe(BENCHMARK_SIZE);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(BENCHMARK_SHA256);

    const { data: actor } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active')
      .limit(1)
      .single();
    expect(actor).toBeTruthy();
    const correlationId = randomUUID();
    const result = await processAdminImportBatch(config.batchId, {
      repository,
      processingRepository: processing,
      authorize: async () => ({ actorId: actor!.id }),
      createCorrelationId: () => correlationId,
      extractionMode: 'segmented',
    });
    expect(result.rowCount).toBeGreaterThan(0);
    const historicalJobIds = new Set(historicalJobs.map((job) => String(job.id)));
    const { data: jobsAfter, error: jobsAfterError } = await client
      .from('pricing_import_processing_jobs')
      .select('id,attempt,status,correlation_id')
      .eq('batch_id', config.batchId);
    expect(jobsAfterError).toBeNull();
    const newJobs = (jobsAfter ?? []).filter((job) => !historicalJobIds.has(String(job.id)));
    expect(newJobs).toHaveLength(1);
    const currentJob = newJobs[0]!;
    expect(currentJob).toMatchObject({ status: 'succeeded', correlation_id: correlationId });
    const { data: currentArtifacts, error: currentArtifactsError } = await client
      .from('pricing_import_processing_artifacts')
      .select('batch_id,processing_job_id,attempt,stage,status')
      .eq('batch_id', config.batchId)
      .eq('processing_job_id', currentJob.id)
      .eq('attempt', currentJob.attempt);
    expect(currentArtifactsError).toBeNull();
    expect(currentArtifacts?.length).toBeGreaterThan(2);
    expect(
      currentArtifacts?.every(
        (artifact) =>
          String(artifact.batch_id) === config.batchId &&
          String(artifact.processing_job_id) === String(currentJob.id) &&
          artifact.attempt === currentJob.attempt &&
          artifact.status === 'succeeded',
      ),
    ).toBe(true);
    expect(new Set(currentArtifacts?.map((artifact) => artifact.stage))).toEqual(
      new Set([
        'document_map',
        'unit_plan',
        'unit_extraction',
        'merge',
        'semantic_reconciliation',
        'domain_mapping',
      ]),
    );
  }, 1_200_000);
});
