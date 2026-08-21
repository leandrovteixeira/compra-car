import {
  prepareSegmentedArtifact,
  transitionSegmentedArtifact,
  type SegmentedArtifactManifest,
  type SegmentedArtifactStorageReference,
} from '@compra-car/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import {
  publishPersistedSegmentedArtifact,
  SegmentedArtifactSupabaseManifestAdapter,
  SegmentedArtifactSupabaseStorageAdapter,
} from '../src/segmented-artifact-supabase-adapter';

const context = {
  claimToken: '51000000-0000-4000-8000-000000000001',
  actorId: '51000000-0000-4000-8000-000000000002',
  processingJobLockVersion: 2,
};

const queued = async (): Promise<SegmentedArtifactManifest> =>
  (
    await prepareSegmentedArtifact({
      artifactSchemaVersion: 'DocumentMapArtifact/1',
      artifactVersion: 1,
      batchId: '1',
      jobId: '2',
      documentId: '3',
      stage: 'document_map',
      attempt: 1,
      correlationId: '51000000-0000-4000-8000-000000000003',
      sourceArtifacts: [],
      body: { stable: true },
      provider: { providerKey: 'fake', providerVersion: '1', inputUnits: 3 },
      createdAt: '2026-08-20T12:00:00.000Z',
    })
  ).manifest;

const rpcClient = () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let lockVersion = 1;
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === 'attach_import_processing_artifact_dependencies') return { data: 1, error: null };
    const status = name.startsWith('reserve')
      ? 'queued'
      : name.startsWith('start')
        ? 'processing'
        : name.startsWith('succeed')
          ? 'succeeded'
          : 'failed';
    return {
      data: {
        artifactId: '10',
        artifactKey: args.p_artifact_key,
        status,
        lockVersion: lockVersion++,
        idempotentReplay: false,
      },
      error: null,
    };
  });
  return { client: { rpc } as unknown as SupabaseClient, calls };
};

describe('SegmentedArtifactSupabaseManifestAdapter', () => {
  it('reserves, starts and succeeds through allow-listed RPC payloads', async () => {
    const target = rpcClient();
    const adapter = new SegmentedArtifactSupabaseManifestAdapter(context, target.client);
    const reserved = await adapter.reserve(await queued());
    const processing = transitionSegmentedArtifact(reserved, {
      status: 'processing',
      occurredAt: '2026-08-20T12:00:01.000Z',
    });
    await adapter.start(processing);
    const succeeded = transitionSegmentedArtifact(processing, {
      status: 'succeeded',
      occurredAt: '2026-08-20T12:00:02.000Z',
    });
    await adapter.succeed(succeeded);

    expect(target.calls.map((call) => call.name)).toEqual([
      'reserve_import_processing_artifact',
      'start_import_processing_artifact',
      'succeed_import_processing_artifact',
    ]);
    expect(target.calls[0]?.args).toMatchObject({
      p_source_artifact_ids: [],
      p_claim_token: context.claimToken,
      p_expected_job_lock_version: 2,
    });
    expect(target.calls[2]?.args).toMatchObject({
      p_usage_metadata: { inputUnits: 3 },
      p_content_size_bytes: succeeded.content.byteLength,
    });
    expect(JSON.stringify(target.calls)).not.toMatch(
      /authorization|signed.?url|raw.?request|raw.?response/iu,
    );
  });

  it('fails with sanitized core diagnostics and never passes an artifact body', async () => {
    const target = rpcClient();
    const adapter = new SegmentedArtifactSupabaseManifestAdapter(context, target.client);
    const reserved = await adapter.reserve(await queued());
    const processing = transitionSegmentedArtifact(reserved, {
      status: 'processing',
      occurredAt: '2026-08-20T12:00:01.000Z',
    });
    await adapter.start(processing);
    await adapter.fail(
      transitionSegmentedArtifact(processing, {
        status: 'failed',
        occurredAt: '2026-08-20T12:00:02.000Z',
        failure: { code: 'STORAGE_FAILED', message: 'Private storage write failed.' },
      }),
    );
    expect(target.calls.at(-1)).toMatchObject({
      name: 'fail_import_processing_artifact',
      args: { p_error_code: 'STORAGE_FAILED', p_error_message: 'Private storage write failed.' },
    });
    expect(target.calls.at(-1)?.args).not.toHaveProperty('body');
  });

  it('returns a concurrent reserve replay from the persisted manifest', async () => {
    const manifest = await queued();
    const row = {
      id: 10,
      artifact_key: manifest.artifactId,
      artifact_schema_version: manifest.artifactSchemaVersion,
      artifact_version: 1,
      batch_id: 1,
      processing_job_id: 2,
      document_id: 3,
      unit_id: null,
      stage: 'document_map',
      attempt: 1,
      status: 'queued',
      correlation_id: manifest.correlationId,
      idempotency_key: manifest.idempotencyKey,
      content_sha256: manifest.content.sha256,
      content_size_bytes: manifest.content.byteLength,
      storage_object_path: manifest.storage.objectPath,
      provider: 'fake',
      provider_version: '1',
      usage_metadata: {},
      lock_version: 1,
      created_at: manifest.createdAt,
    };
    const rpc = vi.fn(async () => ({
      data: {
        artifactId: '10',
        artifactKey: manifest.artifactId,
        status: 'queued',
        lockVersion: 1,
        idempotentReplay: true,
      },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: table.endsWith('dependencies') ? null : row,
          error: null,
        })),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data: [], error: null }),
      };
      return query;
    });
    const adapter = new SegmentedArtifactSupabaseManifestAdapter(context, {
      rpc,
      from,
    } as unknown as SupabaseClient);
    await expect(adapter.reserve(manifest)).resolves.toMatchObject({
      artifactId: manifest.artifactId,
      status: 'queued',
    });
  });
});

describe('SegmentedArtifactSupabaseStorageAdapter', () => {
  const reference: SegmentedArtifactStorageReference = {
    bucket: 'import-processing-artifacts',
    objectPath: '1/2/document_map/artifact.json',
  };

  it('puts, reads, checks existence and verifies UTF-8 bytes by hash and size', async () => {
    const bytes = new TextEncoder().encode('{"stable":true}');
    const bucket = {
      upload: vi.fn(async () => ({ error: null })),
      download: vi.fn(async () => ({ data: new Blob([bytes]), error: null })),
      list: vi.fn(async () => ({ data: [{ name: 'artifact.json' }], error: null })),
    };
    const adapter = new SegmentedArtifactSupabaseStorageAdapter({
      storage: { from: vi.fn(() => bucket) },
    } as unknown as SupabaseClient);
    await adapter.put(reference, bytes);
    await expect(adapter.read(reference)).resolves.toEqual(bytes);
    await expect(adapter.exists(reference)).resolves.toBe(true);
    const verified = await adapter.verify(
      reference,
      'f6ae9075446e89443e829410051dee7de57a5455d357a862a38f3208fbc1f6b5',
      bytes.byteLength,
    );
    expect(verified).toMatchObject({ verified: true, actualByteLength: bytes.byteLength });
    expect(bucket.upload).toHaveBeenCalledWith(reference.objectPath, bytes, {
      contentType: 'application/json',
      upsert: false,
    });
  });

  it('reports hash mismatch and propagates storage failure without deletion', async () => {
    const bytes = new TextEncoder().encode('{}');
    const bucket = {
      upload: vi.fn(async () => ({ error: { message: 'private failure' } })),
      download: vi.fn(async () => ({ data: new Blob([bytes]), error: null })),
      list: vi.fn(),
      remove: vi.fn(),
    };
    const adapter = new SegmentedArtifactSupabaseStorageAdapter({
      storage: { from: vi.fn(() => bucket) },
    } as unknown as SupabaseClient);
    await expect(adapter.put(reference, bytes)).rejects.toThrow(
      'Falha ao armazenar artifact canônico privado.',
    );
    await expect(
      adapter.verify(reference, '0'.repeat(64), bytes.byteLength),
    ).resolves.toMatchObject({
      verified: false,
    });
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

describe('publishPersistedSegmentedArtifact convergence diagnostics', () => {
  const input = {
    artifactSchemaVersion: 'DocumentMapArtifact/1',
    artifactVersion: 1,
    batchId: '1',
    jobId: '2',
    documentId: '3',
    stage: 'document_map' as const,
    attempt: 1,
    correlationId: '51000000-0000-4000-8000-000000000003',
    sourceArtifacts: [],
    body: { stable: true },
    provider: { providerKey: 'fake', providerVersion: '1' },
    createdAt: '2026-08-20T12:00:00.000Z',
    startedAt: '2026-08-20T12:00:01.000Z',
    completedAt: '2026-08-20T12:00:02.000Z',
  };

  const dependencies = (options: {
    readonly storageFailure?: boolean;
    readonly corruptRead?: boolean;
    readonly finalizeFailure?: boolean;
  }) => {
    const rows = new Map<string, SegmentedArtifactManifest>();
    const manifests = {
      findByIdempotencyKey: vi.fn(async (key: string) =>
        [...rows.values()].find((row) => row.idempotencyKey === key),
      ),
      createQueued: vi.fn(async (manifest: SegmentedArtifactManifest) => {
        rows.set(manifest.artifactId, manifest);
        return manifest;
      }),
      transition: vi.fn(
        async (artifactId: string, _expected: string, manifest: SegmentedArtifactManifest) => {
          if (options.finalizeFailure && manifest.status === 'succeeded')
            throw new Error('DB_FINALIZE_FAILED');
          rows.set(artifactId, manifest);
          return manifest;
        },
      ),
    };
    let stored: Uint8Array<ArrayBufferLike> = new Uint8Array();
    const storage = {
      put: vi.fn(async (_reference: SegmentedArtifactStorageReference, body: Uint8Array) => {
        if (options.storageFailure) throw new Error('STORAGE_FAILED');
        stored = body;
      }),
      exists: vi.fn(async () => true),
      read: vi.fn(async () =>
        options.corruptRead ? new TextEncoder().encode('{"corrupt":true}') : stored,
      ),
    };
    return {
      manifests,
      storage,
      audit: { append: vi.fn(async () => undefined) },
    };
  };

  it.each([
    ['storage failure', { storageFailure: true }, false],
    ['hash mismatch', { corruptRead: true }, true],
    ['DB finalize failure', { finalizeFailure: true }, true],
  ] as const)('keeps %s observable without automatic deletion', async (_name, options, orphan) => {
    const target = dependencies(options);
    const result = await publishPersistedSegmentedArtifact(input, {
      manifests: target.manifests as unknown as SegmentedArtifactSupabaseManifestAdapter,
      storage: target.storage as unknown as SegmentedArtifactSupabaseStorageAdapter,
      audit: target.audit,
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(Boolean(result.orphan)).toBe(orphan);
    expect(target.storage).not.toHaveProperty('remove');
  });
});
