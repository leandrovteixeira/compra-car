import { randomUUID } from 'node:crypto';

import {
  createLegacySupabaseClientFromEnv,
  ImportEngineSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import { describe, expect, it } from 'vitest';

import { processAdminImportBatch } from '../src/server/import-engine-service';
import {
  OPENAI_IMPORT_MAX_TIMEOUT_MS,
  OpenAIExtractionProvider,
  parseOpenAIImportTimeoutMs,
} from '../src/server/openai-extraction-provider';

const STAGING_REF = 'shfsjyjxmgwnlexmdkcs';
const BENCHMARK_BATCHES: Readonly<Record<string, string>> = {
  '116': 'Geely 202602-01.pdf',
  '115': 'Geely 202602-01.pdf',
  '110': 'GWM 202602-01.pdf',
  '111': 'Fiat 202603-01.pdf',
  '113': 'Volvo 202606-02.pdf',
  '112': 'VW 202602-01.pdf',
};
const enabled = process.env.RUN_OPENAI_IMPORT_SMOKE === '1';

type OpenAIImportSmokeMode = 'FIRST_RUN' | 'RETRY';

export function assertOpenAIImportSmokeLifecyclePreconditions(input: {
  readonly batchStatus: string;
  readonly documentStatuses: readonly string[];
  readonly activeJobCount: number;
}): OpenAIImportSmokeMode {
  if (input.activeJobCount !== 0)
    throw new Error('OpenAI import smoke requires zero active processing jobs.');
  if (input.batchStatus === 'ready') {
    if (input.documentStatuses.some((status) => status !== 'ready'))
      throw new Error('FIRST_RUN requires every eligible document to be ready.');
    return 'FIRST_RUN';
  }
  if (input.batchStatus === 'failed') {
    if (input.documentStatuses.some((status) => status !== 'failed'))
      throw new Error('RETRY requires every eligible document to be failed.');
    return 'RETRY';
  }
  throw new Error(`Batch status ${input.batchStatus} is not eligible for the OpenAI import smoke.`);
}

describe('OpenAI import smoke lifecycle preconditions', () => {
  it('accepts a first run only when batch and document are ready', () => {
    expect(
      assertOpenAIImportSmokeLifecyclePreconditions({
        batchStatus: 'ready',
        documentStatuses: ['ready'],
        activeJobCount: 0,
      }),
    ).toBe('FIRST_RUN');
  });

  it('accepts an official retry with failed batch/document and preserved historical jobs', () => {
    const historicalJobs = [{ attempt: 1, status: 'failed' }];
    expect(historicalJobs).toHaveLength(1);
    expect(
      assertOpenAIImportSmokeLifecyclePreconditions({
        batchStatus: 'failed',
        documentStatuses: ['failed'],
        activeJobCount: 0,
      }),
    ).toBe('RETRY');
  });

  it.each(['extracting', 'needs_review', 'promoted'])('rejects batch status %s', (batchStatus) => {
    expect(() =>
      assertOpenAIImportSmokeLifecyclePreconditions({
        batchStatus,
        documentStatuses: ['ready'],
        activeJobCount: 0,
      }),
    ).toThrow(/not eligible/u);
  });

  it('rejects a failed batch with an incompatible document status', () => {
    expect(() =>
      assertOpenAIImportSmokeLifecyclePreconditions({
        batchStatus: 'failed',
        documentStatuses: ['ready'],
        activeJobCount: 0,
      }),
    ).toThrow(/RETRY requires/u);
  });

  it('rejects an active job without rejecting historical failed attempts', () => {
    expect(() =>
      assertOpenAIImportSmokeLifecyclePreconditions({
        batchStatus: 'failed',
        documentStatuses: ['failed'],
        activeJobCount: 1,
      }),
    ).toThrow(/zero active/u);
  });
});

describe.skipIf(!enabled)('Sprint 10C.2 OpenAI real smoke', () => {
  it(
    'processes one explicitly selected Staging commercial letter without promotion',
    async () => {
      const url = new URL(process.env.SUPABASE_URL ?? '');
      expect(url.hostname).toBe(`${STAGING_REF}.supabase.co`);
      expect(process.env.OPENAI_API_KEY).toBeTruthy();
      expect(process.env.OPENAI_IMPORT_MODEL).toBe('gpt-5.6-terra');
      const batchId = process.env.OPENAI_IMPORT_SMOKE_BATCH_ID ?? '';
      const expectedFileName = BENCHMARK_BATCHES[batchId];
      expect(expectedFileName).toBeTruthy();

      const client = createLegacySupabaseClientFromEnv();
      const repository = new ImportEngineSupabaseAdapter(client);
      const batch = await repository.getBatch(batchId);
      expect(batch).toBeTruthy();
      expect(batch?.documents).toHaveLength(1);
      expect(batch?.documents[0]).toMatchObject({
        originalFileName: expectedFileName,
        documentRole: 'primary',
      });
      const { data: activeJobs, error: activeJobsError } = await client
        .from('pricing_import_processing_jobs')
        .select('id,status')
        .eq('batch_id', batchId)
        .in('status', ['queued', 'processing']);
      expect(activeJobsError).toBeNull();
      const executionMode = assertOpenAIImportSmokeLifecyclePreconditions({
        batchStatus: batch!.status,
        documentStatuses: batch!.documents.map((document) => document.status),
        activeJobCount: activeJobs?.length ?? 0,
      });
      const { data: actor } = await client
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('status', 'active')
        .limit(1)
        .single();
      if (!actor) throw new Error('Staging has no active admin smoke actor.');

      const started = performance.now();
      const result = await processAdminImportBatch(batchId, {
        authorize: async () => ({ actorId: actor.id }),
        createCorrelationId: () => randomUUID(),
        extractionProvider: new OpenAIExtractionProvider({
          apiKey: process.env.OPENAI_API_KEY!,
          model: process.env.OPENAI_IMPORT_MODEL!,
          diagnostics:
            process.env.NODE_ENV !== 'production' && process.env.OPENAI_IMPORT_DIAGNOSTICS === '1',
          timeoutMs: parseOpenAIImportTimeoutMs(process.env.OPENAI_IMPORT_TIMEOUT_MS),
        }),
      });
      const [{ data: job }, { data: rows }] = await Promise.all([
        client
          .from('pricing_import_processing_jobs')
          .select('id,status,provider_key,provider_run_id,usage_metadata,error_code')
          .eq('batch_id', batchId)
          .order('attempt', { ascending: false })
          .limit(1)
          .single(),
        client
          .from('pricing_import_rows')
          .select('status,issue_codes,normalized_payload')
          .eq('batch_id', batchId),
      ]);
      expect(job).toMatchObject({ status: 'succeeded', provider_key: 'openai', error_code: null });
      expect(rows).toHaveLength(result.rowCount);
      expect(rows?.every((row) => ['needs_review', 'unmatched'].includes(row.status))).toBe(true);
      console.log(
        'OPENAI_IMPORT_BENCHMARK',
        JSON.stringify({
          projectRef: STAGING_REF,
          executionMode,
          model: process.env.OPENAI_IMPORT_MODEL,
          providerRunId: job?.provider_run_id,
          latencyMs: Math.round(performance.now() - started),
          rowCount: result.rowCount,
          usage: job?.usage_metadata,
          success: true,
          canonicalIssues: rows?.flatMap((row) => row.issue_codes ?? []),
        }),
      );
    },
    OPENAI_IMPORT_MAX_TIMEOUT_MS + 300_000,
  );
});
