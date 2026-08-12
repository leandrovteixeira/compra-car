/* eslint-disable @typescript-eslint/no-explicit-any -- smoke inspects canonical JSON fixtures */
import { randomUUID } from 'node:crypto';

import {
  createLegacySupabaseClientFromEnv,
  ImportProcessingSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import { describe, expect, it } from 'vitest';
import fixture from '../../../docs/import/examples/commercial-letter-mmv-example-v1.json';

import {
  createAdminImportBatch,
  processAdminImportBatch,
} from '../src/server/import-engine-service';
import { FakeExtractionProvider } from '../src/server/fake-extraction-provider';

const STAGING_REF = 'shfsjyjxmgwnlexmdkcs';
const enabled = process.env.RUN_STAGING_IMPORT_SMOKE === '1';

async function createSmokeBatch(title: string, fileName: string, bytes: string) {
  const client = createLegacySupabaseClientFromEnv();
  const { data: actor } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('status', 'active')
    .limit(1)
    .single();
  if (!actor) throw new Error('Staging has no active admin smoke actor.');
  const operationId = randomUUID();
  const correlationId = randomUUID();
  const form = new FormData();
  form.set('title', `${title}_${operationId}`);
  form.set('notes', `SPRINT10C_SMOKE_${correlationId}`);
  form.set('competence', '2026-08');
  form.set('idempotencyKey', operationId);
  form.set('acknowledgeDuplicates', 'true');
  form.append('documents', new File([bytes], fileName, { type: 'application/pdf' }));
  form.append('documentRoles', 'primary');
  const created = await createAdminImportBatch(form, {
    authorize: async () => ({ actorId: actor.id }),
    createCorrelationId: () => correlationId,
  });
  if (created.status !== 'success') throw new Error(`Setup failed: ${created.status}`);
  return { client, actorId: actor.id, correlationId, batchId: created.batchId };
}

describe.skipIf(!enabled)('Sprint 10C Staging application smoke', () => {
  it('runs the admin server flow with the real adapters and FakeProvider', async () => {
    const url = new URL(process.env.SUPABASE_URL ?? '');
    expect(url.origin).toBe(`https://${STAGING_REF}.supabase.co`);
    expect(url.pathname).toBe('/');

    const client = createLegacySupabaseClientFromEnv();
    const { data: actor, error: actorError } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active')
      .limit(1)
      .single();
    if (actorError || !actor) throw new Error('Staging has no active admin smoke actor.');

    const operationId = randomUUID();
    const correlationId = randomUUID();
    const form = new FormData();
    form.set('title', `SPRINT10C_SMOKE_${operationId}`);
    form.set('notes', `SPRINT10C_SMOKE_${correlationId}`);
    form.set('competence', '2026-08');
    form.set('idempotencyKey', operationId);
    form.set('acknowledgeDuplicates', 'true');
    form.append(
      'documents',
      new File([new TextEncoder().encode('%PDF-1.7\nSPRINT10C_SMOKE\n%%EOF')], 'smoke.pdf', {
        type: 'application/pdf',
      }),
    );
    form.append('documentRoles', 'primary');

    const created = await createAdminImportBatch(form, {
      authorize: async () => ({ actorId: actor.id }),
      createCorrelationId: () => correlationId,
    });
    expect(created.status).toBe('success');
    if (created.status !== 'success')
      throw new Error(`Smoke batch setup failed: ${created.status}`);

    const processed = await processAdminImportBatch(created.batchId, {
      authorize: async () => ({ actorId: actor.id }),
      createCorrelationId: () => correlationId,
    });
    expect(processed.rowCount).toBeGreaterThan(0);
    expect(processed.idempotentReplay).toBe(false);

    const [{ data: batch }, { data: jobs }, { data: rows }, { data: audit }] = await Promise.all([
      client.from('pricing_import_batches').select('id,status').eq('id', created.batchId).single(),
      client
        .from('pricing_import_processing_jobs')
        .select('id,status,attempt')
        .eq('batch_id', created.batchId),
      client
        .from('pricing_import_rows')
        .select('id,status,generation_job_id')
        .eq('batch_id', created.batchId),
      client.from('pricing_audit_events').select('reason').eq('correlation_id', correlationId),
    ]);
    expect(batch?.status).toBe('needs_review');
    expect(jobs).toHaveLength(1);
    expect(jobs?.[0]).toMatchObject({ status: 'succeeded', attempt: 1 });
    expect(rows).toHaveLength(processed.rowCount);
    expect(rows?.every((row) => row.generation_job_id === jobs?.[0]?.id)).toBe(true);

    console.log(
      'STAGING_IMPORT_SMOKE_RESULT',
      JSON.stringify({
        projectRef: STAGING_REF,
        batchId: created.batchId,
        correlationId,
        jobId: jobs?.[0]?.id,
        jobStatus: jobs?.[0]?.status,
        batchStatus: batch?.status,
        rowCount: rows?.length,
        matchingStatuses: [...new Set(rows?.map((row) => row.status) ?? [])],
        auditEvents: audit?.map((event) => event.reason) ?? [],
      }),
    );
  }, 30_000);

  it('preserves failed attempt and succeeds on retry through the application flow', async () => {
    const client = createLegacySupabaseClientFromEnv();
    const { data: actor } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active')
      .limit(1)
      .single();
    if (!actor) throw new Error('Staging has no active admin smoke actor.');
    const operationId = randomUUID();
    const correlationId = randomUUID();
    const form = new FormData();
    form.set('title', `SPRINT10C_SMOKE_FAILURE_RETRY_${operationId}`);
    form.set('notes', `SPRINT10C_SMOKE_${correlationId}`);
    form.set('competence', '2026-08');
    form.set('idempotencyKey', operationId);
    form.set('acknowledgeDuplicates', 'true');
    form.append(
      'documents',
      new File([new TextEncoder().encode(`%PDF-1.7\n${operationId}\n%%EOF`)], 'retry.pdf', {
        type: 'application/pdf',
      }),
    );
    form.append('documentRoles', 'primary');
    const created = await createAdminImportBatch(form, {
      authorize: async () => ({ actorId: actor.id }),
      createCorrelationId: () => correlationId,
    });
    if (created.status !== 'success') throw new Error(`Setup failed: ${created.status}`);

    const failingProvider = {
      key: 'fake',
      version: '1',
      async extract() {
        throw new Error('sk-sensitive-value postgres://private');
      },
    };
    await expect(
      processAdminImportBatch(created.batchId, {
        authorize: async () => ({ actorId: actor.id }),
        createCorrelationId: () => correlationId,
        extractionProvider: failingProvider,
      }),
    ).rejects.toThrow();
    await processAdminImportBatch(created.batchId, {
      authorize: async () => ({ actorId: actor.id }),
      createCorrelationId: () => randomUUID(),
    });
    const [{ data: jobs }, { data: rows }, { data: batch }] = await Promise.all([
      client
        .from('pricing_import_processing_jobs')
        .select('id,attempt,status,error_code,error_message')
        .eq('batch_id', created.batchId)
        .order('attempt'),
      client
        .from('pricing_import_rows')
        .select('generation_job_id')
        .eq('batch_id', created.batchId),
      client.from('pricing_import_batches').select('status').eq('id', created.batchId).single(),
    ]);
    expect(jobs?.map(({ attempt, status }) => ({ attempt, status }))).toEqual([
      { attempt: 1, status: 'failed' },
      { attempt: 2, status: 'succeeded' },
    ]);
    expect(jobs?.[0]?.error_code).toBe('PROCESSING_FAILED');
    expect(jobs?.[0]?.error_message).not.toMatch(/sk-|postgres:\/\//iu);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.generation_job_id).toBe(jobs?.[1]?.id);
    expect(batch?.status).toBe('needs_review');
  }, 30_000);

  it('rebuilds server-owned fields and confirms an exact existing Product', async () => {
    const client = createLegacySupabaseClientFromEnv();
    const [{ data: actor }, { data: product }] = await Promise.all([
      client
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('status', 'active')
        .limit(1)
        .single(),
      client
        .from('products')
        .select('id,brand,model,version,model_year,production_year')
        .eq('is_active', true)
        .limit(1)
        .single(),
    ]);
    if (!actor || !product) throw new Error('Exact-match prerequisites are absent.');
    const payload = structuredClone(fixture) as Record<string, any>;
    payload.mmv.brand.value = product.brand;
    payload.mmv.model.value = product.model;
    payload.mmv.version.value = product.version;
    payload.mmv.modelYear.value = String(product.model_year);
    payload.mmv.productionYear.value = String(product.production_year);
    payload.productMatch = { status: 'confirmed', selectedProductId: -999, selectedBy: 'provider' };
    payload.validation = { readyForApproval: true, readyForPromotion: true };
    payload.promotionPlan = { mode: 'automatic' };
    payload.publicPrice.candidate.existingPriceId = 999;
    payload.publicPrice.candidate.expectedLockVersion = 999;
    payload.policies[0].existingPolicyId = 999;
    payload.policies[0].predecessor = { id: 999 };
    payload.offers[0].existingOfferId = 999;

    const operationId = randomUUID();
    const correlationId = randomUUID();
    const form = new FormData();
    form.set('title', `SPRINT10C_SMOKE_EXACT_${operationId}`);
    form.set('notes', `SPRINT10C_SMOKE_${correlationId}`);
    form.set('competence', '2026-08');
    form.set('idempotencyKey', operationId);
    form.set('acknowledgeDuplicates', 'true');
    form.append(
      'documents',
      new File([`%PDF-1.7\n${operationId}`], 'exact.pdf', { type: 'application/pdf' }),
    );
    form.append('documentRoles', 'primary');
    const created = await createAdminImportBatch(form, {
      authorize: async () => ({ actorId: actor.id }),
      createCorrelationId: () => correlationId,
    });
    if (created.status !== 'success') throw new Error(`Setup failed: ${created.status}`);
    await processAdminImportBatch(created.batchId, {
      authorize: async () => ({ actorId: actor.id }),
      createCorrelationId: () => correlationId,
      extractionProvider: new FakeExtractionProvider([payload]),
    });
    const { data: row } = await client
      .from('pricing_import_rows')
      .select('status,matched_product_id,normalized_payload')
      .eq('batch_id', created.batchId)
      .single();
    const normalized = row?.normalized_payload as Record<string, any>;
    expect(row).toMatchObject({ status: 'needs_review', matched_product_id: product.id });
    expect(normalized.productMatch).toMatchObject({
      status: 'confirmed',
      selectedProductId: product.id,
      selectedBy: 'system',
    });
    expect(normalized.productMatch.expectedProductFingerprint).toBe(
      [
        product.brand,
        product.model,
        product.version,
        product.model_year,
        product.production_year,
      ].join('|'),
    );
    expect(normalized.validation.readyForApproval).toBe(false);
    expect(normalized.promotionPlan.mode).toBe('blocked');
    expect(normalized.publicPrice.candidate).toMatchObject({
      existingPriceId: null,
      expectedLockVersion: null,
      promotionAction: 'blocked',
    });
    expect(normalized.policies[0]).toMatchObject({ existingPolicyId: null, predecessor: null });
    expect(normalized.offers[0]).toMatchObject({ existingOfferId: null });
  }, 30_000);

  it('rejects an invalid canonical payload before rows are persisted', async () => {
    const smoke = await createSmokeBatch(
      'SPRINT10C_SMOKE_CANONICAL_REJECTION',
      'invalid.pdf',
      `%PDF-1.7\n${randomUUID()}`,
    );
    const invalid = { ...structuredClone(fixture), forbiddenExtraProperty: true };
    await expect(
      processAdminImportBatch(smoke.batchId, {
        authorize: async () => ({ actorId: smoke.actorId }),
        createCorrelationId: () => smoke.correlationId,
        extractionProvider: new FakeExtractionProvider([invalid]),
      }),
    ).rejects.toThrow();
    const [{ data: jobs }, { count: rows }, { data: batch }] = await Promise.all([
      smoke.client
        .from('pricing_import_processing_jobs')
        .select('status,error_code,error_message')
        .eq('batch_id', smoke.batchId),
      smoke.client
        .from('pricing_import_rows')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', smoke.batchId),
      smoke.client.from('pricing_import_batches').select('status').eq('id', smoke.batchId).single(),
    ]);
    expect(jobs?.[0]?.status).toBe('failed');
    expect(jobs?.[0]?.error_code).toBe('CANONICAL_PAYLOAD_INVALID');
    expect(jobs?.[0]?.error_message).not.toMatch(/service.?role|api.?key|postgres:\/\//iu);
    expect(rows).toBe(0);
    expect(batch?.status).toBe('failed');
  }, 30_000);

  it('rejects more than 100 extracted rows without partial persistence', async () => {
    const smoke = await createSmokeBatch(
      'SPRINT10C_SMOKE_ROW_LIMIT',
      'row-limit.pdf',
      `%PDF-1.7\n${randomUUID()}`,
    );
    await expect(
      processAdminImportBatch(smoke.batchId, {
        authorize: async () => ({ actorId: smoke.actorId }),
        createCorrelationId: () => smoke.correlationId,
        extractionProvider: new FakeExtractionProvider(
          Array.from({ length: 101 }, () => structuredClone(fixture)),
        ),
      }),
    ).rejects.toThrow();
    const [{ data: job }, { count: rows }] = await Promise.all([
      smoke.client
        .from('pricing_import_processing_jobs')
        .select('status,error_code')
        .eq('batch_id', smoke.batchId)
        .single(),
      smoke.client
        .from('pricing_import_rows')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', smoke.batchId),
    ]);
    expect(job).toMatchObject({ status: 'failed', error_code: 'CANONICAL_PAYLOAD_INVALID' });
    expect(rows).toBe(0);
  }, 30_000);

  it('reclaims an expired lease and rejects the old worker token', async () => {
    const smoke = await createSmokeBatch(
      'SPRINT10C_SMOKE_RECLAIM',
      'reclaim.pdf',
      `%PDF-1.7\n${randomUUID()}`,
    );
    const repository = new ImportProcessingSupabaseAdapter(smoke.client);
    const queued = await repository.enqueue({
      batchId: smoke.batchId,
      pluginVersion: '1',
      providerKey: 'fake',
      providerVersion: '1',
      schemaVersion: 'commercial-letter/mmv-payload/1',
      actorId: smoke.actorId,
      correlationId: smoke.correlationId,
    });
    const oldToken = randomUUID();
    await repository.claim({
      jobId: queued.jobId,
      claimToken: oldToken,
      leaseSeconds: 300,
      actorId: smoke.actorId,
      correlationId: smoke.correlationId,
    });
    const expired = new Date(Date.now() - 60_000).toISOString();
    const claimed = new Date(Date.now() - 120_000).toISOString();
    const { error: expiryError } = await smoke.client
      .from('pricing_import_processing_jobs')
      .update({ claimed_at: claimed, claim_expires_at: expired })
      .eq('id', queued.jobId);
    if (expiryError) throw expiryError;
    await processAdminImportBatch(smoke.batchId, {
      authorize: async () => ({ actorId: smoke.actorId }),
      createCorrelationId: () => smoke.correlationId,
    });
    await expect(
      repository.finalize({
        jobId: queued.jobId,
        claimToken: oldToken,
        rows: [],
        providerRunId: 'old-worker',
        usage: { inputUnits: 0, outputUnits: 0 },
        actorId: smoke.actorId,
        correlationId: smoke.correlationId,
      }),
    ).rejects.toThrow();
    await expect(
      repository.fail({
        jobId: queued.jobId,
        claimToken: oldToken,
        errorCode: 'OLD_WORKER',
        errorMessage: 'old worker',
        actorId: smoke.actorId,
        correlationId: smoke.correlationId,
      }),
    ).rejects.toThrow();
    const { data: audit } = await smoke.client
      .from('pricing_audit_events')
      .select('reason')
      .eq('correlation_id', smoke.correlationId);
    expect(audit?.some(({ reason }) => reason === 'expired processing lease reclaimed')).toBe(true);
  }, 30_000);

  it('rejects a second worker and an incompatible concurrent batch transition', async () => {
    const smoke = await createSmokeBatch(
      'SPRINT10C_SMOKE_CONCURRENCY',
      'concurrency.pdf',
      `%PDF-1.7\n${randomUUID()}`,
    );
    const repository = new ImportProcessingSupabaseAdapter(smoke.client);
    const queued = await repository.enqueue({
      batchId: smoke.batchId,
      pluginVersion: '1',
      providerKey: 'fake',
      providerVersion: '1',
      schemaVersion: 'commercial-letter/mmv-payload/1',
      actorId: smoke.actorId,
      correlationId: smoke.correlationId,
    });
    const token = randomUUID();
    await repository.claim({
      jobId: queued.jobId,
      claimToken: token,
      leaseSeconds: 300,
      actorId: smoke.actorId,
      correlationId: smoke.correlationId,
    });
    await expect(
      repository.claim({
        jobId: queued.jobId,
        claimToken: randomUUID(),
        leaseSeconds: 300,
        actorId: smoke.actorId,
        correlationId: smoke.correlationId,
      }),
    ).rejects.toThrow();
    const { error } = await smoke.client
      .from('pricing_import_batches')
      .update({ status: 'ready' })
      .eq('id', smoke.batchId);
    if (error) throw error;
    await expect(
      repository.fail({
        jobId: queued.jobId,
        claimToken: token,
        errorCode: 'CONCURRENT',
        errorMessage: 'controlled concurrency smoke',
        actorId: smoke.actorId,
        correlationId: smoke.correlationId,
      }),
    ).rejects.toThrow();
    await smoke.client
      .from('pricing_import_batches')
      .update({ status: 'extracting' })
      .eq('id', smoke.batchId);
    await repository.fail({
      jobId: queued.jobId,
      claimToken: token,
      errorCode: 'SMOKE_COMPLETE',
      errorMessage: 'Controlled concurrency smoke completed.',
      actorId: smoke.actorId,
      correlationId: smoke.correlationId,
    });
  }, 30_000);

  it('keeps token matching as a suggestion without selecting a Product', async () => {
    const client = createLegacySupabaseClientFromEnv();
    const { data: product } = await client
      .from('products')
      .select('brand,model,version')
      .eq('is_active', true)
      .limit(1)
      .single();
    if (!product) throw new Error('Suggested-match prerequisite is absent.');
    const payload = structuredClone(fixture) as Record<string, any>;
    payload.mmv.brand.value = product.brand;
    payload.mmv.model.value = product.model;
    payload.mmv.version.value = product.version;
    payload.mmv.modelYear.value = '1900';
    payload.mmv.productionYear.value = '1900';
    const smoke = await createSmokeBatch(
      'SPRINT10C_SMOKE_SUGGESTED',
      'suggested.pdf',
      `%PDF-1.7\n${randomUUID()}`,
    );
    await processAdminImportBatch(smoke.batchId, {
      authorize: async () => ({ actorId: smoke.actorId }),
      createCorrelationId: () => smoke.correlationId,
      extractionProvider: new FakeExtractionProvider([payload]),
    });
    const { data: row } = await client
      .from('pricing_import_rows')
      .select('status,matched_product_id,issue_codes,normalized_payload')
      .eq('batch_id', smoke.batchId)
      .single();
    const match = (row?.normalized_payload as Record<string, any>).productMatch;
    expect(match.status).toBe('suggested');
    expect(match.candidates.length).toBeGreaterThan(0);
    expect(match.selectedProductId).toBeNull();
    expect(row).toMatchObject({ status: 'unmatched', matched_product_id: null });
    expect(row?.issue_codes).toContain('PRODUCT_UNMATCHED');
  }, 30_000);

  it('persists semantically identical results for identical bytes with different filenames', async () => {
    const bytes = `%PDF-1.7\nFILENAME_INVARIANCE_${randomUUID()}`;
    const first = await createSmokeBatch(
      'SPRINT10C_SMOKE_FILENAME_A',
      'Carta_Comercial_Geely_Julho_2026.pdf',
      bytes,
    );
    const second = await createSmokeBatch('SPRINT10C_SMOKE_FILENAME_B', 'opaque-8f9282.pdf', bytes);
    await processAdminImportBatch(first.batchId, {
      authorize: async () => ({ actorId: first.actorId }),
      createCorrelationId: () => first.correlationId,
    });
    await processAdminImportBatch(second.batchId, {
      authorize: async () => ({ actorId: second.actorId }),
      createCorrelationId: () => second.correlationId,
    });
    const [{ data: a }, { data: b }, { data: jobs }] = await Promise.all([
      first.client
        .from('pricing_import_rows')
        .select('source_row_number,status,matched_product_id,normalized_payload')
        .eq('batch_id', first.batchId)
        .single(),
      first.client
        .from('pricing_import_rows')
        .select('source_row_number,status,matched_product_id,normalized_payload')
        .eq('batch_id', second.batchId)
        .single(),
      first.client
        .from('pricing_import_processing_jobs')
        .select('batch_id,provider_run_id')
        .in('batch_id', [first.batchId, second.batchId]),
    ]);
    const semantic = (row: any) => {
      const p = row.normalized_payload;
      return {
        mmv: p.mmv,
        competence: p.commercialPeriod.competence,
        commercialPeriod: p.commercialPeriod,
        publicPrice: p.publicPrice,
        policies: p.policies,
        offers: p.offers,
        ordinal: row.source_row_number,
        status: row.status,
        matchedProductId: row.matched_product_id,
      };
    };
    expect(semantic(a)).toEqual(semantic(b));
    expect(jobs?.[0]?.provider_run_id).toBe(jobs?.[1]?.provider_run_id);
  }, 30_000);

  it('truncates provider run IDs to the supported 200 character limit', async () => {
    const smoke = await createSmokeBatch(
      'SPRINT10C_SMOKE_PROVIDER_RUN_LIMIT',
      'provider-run.pdf',
      `%PDF-1.7\n${randomUUID()}`,
    );
    const provider = new FakeExtractionProvider();
    const original = provider.extract.bind(provider);
    provider.extract = async (request) => ({
      ...(await original(request)),
      providerRunId: 'r'.repeat(250),
    });
    await processAdminImportBatch(smoke.batchId, {
      authorize: async () => ({ actorId: smoke.actorId }),
      createCorrelationId: () => smoke.correlationId,
      extractionProvider: provider,
    });
    const { data: job } = await smoke.client
      .from('pricing_import_processing_jobs')
      .select('status,provider_run_id')
      .eq('batch_id', smoke.batchId)
      .single();
    expect(job?.status).toBe('succeeded');
    expect(job?.provider_run_id).toHaveLength(200);
  }, 30_000);

  it('rejects usage metadata over 2048 characters without partial rows or secrets', async () => {
    const smoke = await createSmokeBatch(
      'SPRINT10C_SMOKE_USAGE_LIMIT',
      'usage.pdf',
      `%PDF-1.7\n${randomUUID()}`,
    );
    const provider = new FakeExtractionProvider();
    const original = provider.extract.bind(provider);
    provider.extract = async (request) => ({
      ...(await original(request)),
      usage: { inputUnits: 1, outputUnits: 1, detail: `sk-${'x'.repeat(2200)}` } as any,
    });
    await expect(
      processAdminImportBatch(smoke.batchId, {
        authorize: async () => ({ actorId: smoke.actorId }),
        createCorrelationId: () => smoke.correlationId,
        extractionProvider: provider,
      }),
    ).rejects.toThrow();
    const [{ data: job }, { count: rows }, { data: audit }] = await Promise.all([
      smoke.client
        .from('pricing_import_processing_jobs')
        .select('status,usage_metadata,error_code,error_message')
        .eq('batch_id', smoke.batchId)
        .single(),
      smoke.client
        .from('pricing_import_rows')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', smoke.batchId),
      smoke.client
        .from('pricing_audit_events')
        .select('after_snapshot,reason')
        .eq('correlation_id', smoke.correlationId),
    ]);
    expect(job).toMatchObject({ status: 'failed', usage_metadata: {} });
    expect(rows).toBe(0);
    expect(JSON.stringify({ job, audit })).not.toMatch(/sk-x{10}/u);
  }, 30_000);
});
