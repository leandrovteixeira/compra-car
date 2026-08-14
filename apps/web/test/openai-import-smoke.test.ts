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
  '110': 'GWM 202602-01.pdf',
  '111': 'Fiat 202603-01.pdf',
  '113': 'Volvo 202606-02.pdf',
  '112': 'VW 202602-01.pdf',
};
const enabled = process.env.RUN_OPENAI_IMPORT_SMOKE === '1';

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
      expect(batch?.status).toBe('ready');
      expect(batch?.documents).toHaveLength(1);
      expect(batch?.documents[0]).toMatchObject({
        originalFileName: expectedFileName,
        documentRole: 'primary',
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
