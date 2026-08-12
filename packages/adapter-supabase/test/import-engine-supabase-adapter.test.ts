import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { ImportEngineSupabaseAdapter } from '../src/import-engine-supabase-adapter';

describe('ImportEngineSupabaseAdapter', () => {
  it('uploads privately without upsert and compensates through the same bucket', async () => {
    const upload = vi.fn(async () => ({ data: { path: 'x' }, error: null }));
    const remove = vi.fn(async () => ({ data: [], error: null }));
    const from = vi.fn(() => ({ upload, remove }));
    const client = { storage: { from }, rpc: vi.fn() } as unknown as SupabaseClient;
    const adapter = new ImportEngineSupabaseAdapter(client);
    await adapter.uploadDocument({
      path: 'commercial_letters/a/b/carta.pdf',
      data: new Uint8Array([1]),
      contentType: 'application/pdf',
    });
    await adapter.removeUploadedDocuments(['commercial_letters/a/b/carta.pdf']);
    expect(from).toHaveBeenCalledWith('import-engine-documents');
    expect(upload).toHaveBeenCalledWith(
      'commercial_letters/a/b/carta.pdf',
      expect.any(Uint8Array),
      { contentType: 'application/pdf', upsert: false },
    );
    expect(remove).toHaveBeenCalledWith(['commercial_letters/a/b/carta.pdf']);
  });

  it('maps the atomic batch RPC and never sends provider configuration', async () => {
    const rpc = vi.fn(async () => ({
      data: { batchId: 10, status: 'ready', documentIds: [20], idempotentReplay: false },
      error: null,
    }));
    const client = { storage: { from: vi.fn() }, rpc } as unknown as SupabaseClient;
    const adapter = new ImportEngineSupabaseAdapter(client);
    await expect(
      adapter.createBatch({
        title: 'Jeep — Julho/2026',
        competence: '2026-07',
        notes: null,
        idempotencyKey: '10000000-0000-4000-8000-000000000001',
        actorId: 'actor',
        correlationId: 'correlation',
        documents: [
          {
            originalFileName: 'Carta.pdf',
            storageBucket: 'import-engine-documents',
            storageObjectPath: 'commercial_letters/a/b/Carta.pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 100,
            contentSha256: 'a'.repeat(64),
            sourceOrder: 1,
            documentRole: 'primary',
            duplicateAcknowledged: false,
          },
          {
            originalFileName: 'Errata.pdf',
            storageBucket: 'import-engine-documents',
            storageObjectPath: 'commercial_letters/a/b/Errata.pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 80,
            contentSha256: 'b'.repeat(64),
            sourceOrder: 2,
            documentRole: 'errata',
            duplicateAcknowledged: false,
          },
        ],
      }),
    ).resolves.toEqual({
      batchId: '10',
      status: 'ready',
      documentIds: ['20'],
      idempotentReplay: false,
    });
    expect(rpc).toHaveBeenCalledWith(
      'create_import_engine_batch',
      expect.objectContaining({
        p_plugin_key: 'commercial_letters',
        p_competence: '2026-07-01',
        p_documents: [
          expect.objectContaining({ originalFileName: 'Carta.pdf', documentRole: 'primary' }),
          expect.objectContaining({ originalFileName: 'Errata.pdf', documentRole: 'errata' }),
        ],
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/openai|gemini|claude|provider/i);
  });

  it('sends a null competence when the operator does not provide the optional hint', async () => {
    const rpc = vi.fn(async () => ({
      data: { batchId: 10, status: 'ready', documentIds: [20], idempotentReplay: false },
      error: null,
    }));
    const client = { storage: { from: vi.fn() }, rpc } as unknown as SupabaseClient;
    const adapter = new ImportEngineSupabaseAdapter(client);

    await adapter.createBatch({
      title: 'Importação 11/08/2026 15:42',
      competence: null,
      notes: null,
      idempotencyKey: '10000000-0000-4000-8000-000000000001',
      actorId: 'actor',
      correlationId: 'correlation',
      documents: [
        {
          originalFileName: 'Carta.pdf',
          storageBucket: 'import-engine-documents',
          storageObjectPath: 'commercial_letters/a/b/Carta.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 100,
          contentSha256: 'a'.repeat(64),
          sourceOrder: 1,
          documentRole: 'primary',
          duplicateAcknowledged: false,
        },
      ],
    });

    expect(rpc).toHaveBeenCalledWith(
      'create_import_engine_batch',
      expect.objectContaining({ p_competence: null }),
    );
  });
});
