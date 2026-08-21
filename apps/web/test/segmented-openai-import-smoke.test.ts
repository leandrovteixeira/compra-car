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

    const [{ data: activeJobs }, { data: existingRows }, { data: existingArtifacts }] =
      await Promise.all([
        client
          .from('pricing_import_processing_jobs')
          .select('id')
          .in('status', ['queued', 'processing']),
        client.from('pricing_import_rows').select('id').eq('batch_id', config.batchId),
        client
          .from('pricing_import_processing_artifacts')
          .select('id')
          .eq('batch_id', config.batchId),
      ]);
    expect(activeJobs).toHaveLength(0);
    expect(existingRows).toHaveLength(0);
    expect(existingArtifacts).toHaveLength(0);
    expect(
      assertSegmentedOpenAISmokeLifecyclePreconditions({
        batchStatus: batch!.status,
        documentStatuses: batch!.documents.map((item) => item.status),
        activeJobCount: activeJobs?.length ?? 0,
      }),
    ).toMatch(/^(?:FIRST_RUN|RETRY)$/u);

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
  }, 1_200_000);
});
