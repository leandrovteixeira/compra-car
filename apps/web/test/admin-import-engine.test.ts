import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ImportEngineRepository } from '@compra-car/core';
import { describe, expect, it, vi } from 'vitest';

import {
  addAdminImportDocuments,
  createAdminImportBatch,
} from '../src/server/import-engine-service';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

function repository(): ImportEngineRepository {
  return {
    findBatchByIdempotencyKey: vi.fn(async () => null),
    findDuplicateDocuments: vi.fn(async () => []),
    uploadDocument: vi.fn(async () => undefined),
    removeUploadedDocuments: vi.fn(async () => undefined),
    createBatch: vi.fn(async () => ({
      batchId: '91',
      status: 'ready' as const,
      documentIds: ['81'],
      idempotentReplay: false,
    })),
    addDocuments: vi.fn(async () => ({
      batchId: '91',
      documentIds: ['82'],
      idempotentReplay: false,
    })),
    listBatches: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    getBatch: vi.fn(async () => null),
    createDocumentSignedUrl: vi.fn(async () => null),
    updateDocumentRole: vi.fn(),
    rejectDocument: vi.fn(),
    archiveBatch: vi.fn(async () => undefined),
  };
}

function form(
  files: readonly File[] = [
    new File([new TextEncoder().encode('%PDF-1.7\nbody')], 'Carta.pdf', {
      type: 'application/pdf',
    }),
  ],
) {
  const data = new FormData();
  data.set('title', 'Jeep — Julho/2026');
  data.set('competence', '2026-07');
  data.set('notes', 'Carta e anexos');
  data.set('idempotencyKey', '10000000-0000-4000-8000-000000000001');
  for (const file of files) data.append('documents', file);
  for (let index = 0; index < files.length; index += 1) data.append('documentRoles', 'primary');
  return data;
}

function addForm() {
  const data = new FormData();
  data.set('batchId', '91');
  data.set('expectedLockVersion', '2');
  data.set('operationId', '40000000-0000-4000-8000-000000000001');
  data.append(
    'documents',
    new File([new TextEncoder().encode('%PDF-1.7\nerrata')], 'Errata.pdf', {
      type: 'application/pdf',
    }),
  );
  data.append('documentRoles', 'errata');
  return data;
}

const existingBatch = {
  id: '91',
  title: 'Jeep â€” Julho/2026',
  pluginKey: 'commercial_letters' as const,
  competence: '2026-07',
  notes: null,
  status: 'ready' as const,
  documentCount: 1,
  mmvCount: 0,
  createdByName: 'Admin',
  createdAt: '2026-08-02T00:00:00Z',
  updatedAt: '2026-08-02T00:00:00Z',
  lockVersion: 2,
  documents: [],
};

const dependencies = (target: ImportEngineRepository) => ({
  repository: target,
  authorize: vi.fn(async () => ({ actorId: '20000000-0000-4000-8000-000000000001' })),
  createCorrelationId: () => '30000000-0000-4000-8000-000000000001',
});

describe('admin Import Engine', () => {
  it('uploads a real PDF hash and persists only after server authorization', async () => {
    const target = repository();
    await expect(createAdminImportBatch(form(), dependencies(target))).resolves.toMatchObject({
      status: 'success',
      batchId: '91',
    });
    expect(target.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'application/pdf' }),
    );
    expect(target.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: '20000000-0000-4000-8000-000000000001',
        correlationId: '30000000-0000-4000-8000-000000000001',
        documents: [
          expect.objectContaining({ contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/u) }),
        ],
      }),
    );
  });

  it('requires explicit acknowledgement for a hash used by another dossier', async () => {
    const target = repository();
    vi.mocked(target.findDuplicateDocuments).mockResolvedValue([
      {
        contentSha256: 'a'.repeat(64),
        documentId: '7',
        originalFileName: 'Carta.pdf',
        batchId: '4',
        batchTitle: 'Outro dossiê',
        batchStatus: 'ready',
        createdAt: '2026-08-01T00:00:00Z',
      },
    ]);
    await expect(createAdminImportBatch(form(), dependencies(target))).resolves.toMatchObject({
      status: 'duplicate',
      duplicates: [{ batchId: '4' }],
    });
    expect(target.uploadDocument).not.toHaveBeenCalled();
  });

  it('compensates uploaded objects when database persistence fails', async () => {
    const target = repository();
    vi.mocked(target.findBatchByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(target.createBatch).mockRejectedValue(new Error('private database error'));
    await expect(createAdminImportBatch(form(), dependencies(target))).resolves.toMatchObject({
      status: 'error',
      message: expect.not.stringContaining('private database error'),
      correlationId: '30000000-0000-4000-8000-000000000001',
    });
    expect(target.removeUploadedDocuments).toHaveBeenCalledWith([
      expect.stringMatching(/^commercial_letters\//u),
    ]);
  });

  it('returns an idempotent success without uploading again', async () => {
    const target = repository();
    vi.mocked(target.findBatchByIdempotencyKey).mockResolvedValue({
      batchId: '44',
      status: 'ready',
      documentIds: ['55'],
      idempotentReplay: true,
    });
    await expect(createAdminImportBatch(form([]), dependencies(target))).resolves.toMatchObject({
      status: 'success',
      batchId: '44',
    });
    expect(target.uploadDocument).not.toHaveBeenCalled();
  });

  it('adds documents to an editable dossier through the same validated pipeline', async () => {
    const target = repository();
    vi.mocked(target.getBatch).mockResolvedValue(existingBatch);
    await expect(addAdminImportDocuments(addForm(), dependencies(target))).resolves.toMatchObject({
      status: 'success',
      batchId: '91',
    });
    expect(target.addDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: '91',
        expectedLockVersion: 2,
        operationId: '40000000-0000-4000-8000-000000000001',
        documents: [expect.objectContaining({ documentRole: 'errata' })],
      }),
    );
  });

  it('blocks a duplicate that already belongs to the same dossier', async () => {
    const target = repository();
    vi.mocked(target.getBatch).mockResolvedValue(existingBatch);
    vi.mocked(target.findDuplicateDocuments).mockResolvedValue([
      {
        contentSha256: 'a'.repeat(64),
        documentId: '81',
        originalFileName: 'Errata.pdf',
        batchId: '91',
        batchTitle: existingBatch.title,
        batchStatus: 'ready',
        createdAt: existingBatch.createdAt,
      },
    ]);
    await expect(addAdminImportDocuments(addForm(), dependencies(target))).resolves.toMatchObject({
      status: 'error',
      message: 'Este arquivo jÃ¡ foi adicionado a este dossiÃª.',
    });
    expect(target.uploadDocument).not.toHaveBeenCalled();
  });

  it('keeps Supabase behind server actions and exposes accessible responsive admin routes', () => {
    const list = source('../src/app/admin/imports/page.tsx');
    const create = source('../src/app/admin/imports/new/page.tsx');
    const details = source('../src/app/admin/imports/[batchId]/page.tsx');
    const addDocuments = source('../src/app/admin/imports/[batchId]/add/page.tsx');
    const formSource = source('../src/components/admin/admin-import-form.tsx');
    const navigation = source('../src/components/admin/admin-navigation.ts');
    expect(list).toContain("await requireRole('admin')");
    expect(create).toContain("await requireRole('admin')");
    expect(details).toContain("await requireRole('admin')");
    expect(addDocuments).toContain("await requireRole('admin')");
    expect(list + create + details + addDocuments + formSource).not.toContain('createClient');
    expect(formSource).toContain('multiple');
    expect(formSource).toContain('onDrop');
    expect(formSource).toContain('disabled={pending}');
    expect(formSource).toContain('aria-label');
    expect(navigation).toContain("href: '/admin/imports'");
    expect(navigation).toContain("label: 'Importações'");
  });
});
