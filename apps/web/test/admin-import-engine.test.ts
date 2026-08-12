import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ImportEngineRepository } from '@compra-car/core';
import { describe, expect, it, vi } from 'vitest';

import { appendImportDocumentSubmission } from '../src/application/admin/import-document-submission';

import {
  IMPORT_ENGINE_MAX_SELECTION_BYTES,
  IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE,
} from '../src/config/import-engine-upload';

import {
  addAdminImportDocuments,
  createAdminImportBatch,
  generateOperationalImportTitle,
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
  roles: readonly ('primary' | 'errata' | 'other')[] = files.map(() => 'primary'),
) {
  const data = new FormData();
  data.set('competence', '2026-07');
  data.set('notes', 'Carta e anexos');
  data.set('idempotencyKey', '10000000-0000-4000-8000-000000000001');
  files.forEach((file, index) =>
    appendImportDocumentSubmission(data, {
      id: `document-${index}`,
      file,
      role: roles[index] ?? 'other',
    }),
  );
  return data;
}

function sizedPdf(size: number, name = 'Carta.pdf'): File {
  const signature = new TextEncoder().encode('%PDF-');
  const identity = new TextEncoder().encode(name);
  return new File(
    [signature, identity, new Uint8Array(size - signature.length - identity.length)],
    name,
    {
      type: 'application/pdf',
    },
  );
}

function addForm() {
  const data = new FormData();
  data.set('batchId', '91');
  data.set('expectedLockVersion', '2');
  data.set('operationId', '40000000-0000-4000-8000-000000000001');
  appendImportDocumentSubmission(data, {
    id: 'errata',
    file: new File([new TextEncoder().encode('%PDF-1.7\nerrata')], 'Errata.pdf', {
      type: 'application/pdf',
    }),
    role: 'errata',
  });
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
  now: () => new Date('2026-08-11T18:42:00.000Z'),
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
        title: 'Importação 11/08/2026 15:42',
        competence: '2026-07',
        documents: [
          expect.objectContaining({ contentSha256: expect.stringMatching(/^[0-9a-f]{64}$/u) }),
        ],
      }),
    );
  });

  it('accepts a PDF larger than the former 1 MB boundary', async () => {
    const target = repository();
    const file = sizedPdf(2 * 1024 * 1024);

    await expect(createAdminImportBatch(form([file]), dependencies(target))).resolves.toMatchObject(
      {
        status: 'success',
      },
    );
    expect(target.uploadDocument).toHaveBeenCalledOnce();
  });

  it.each([
    {
      label: 'A primary / B other',
      roles: ['primary', 'other'] as const,
    },
    {
      label: 'A other / B primary',
      roles: ['other', 'primary'] as const,
    },
    {
      label: 'A primary / B primary',
      roles: ['primary', 'primary'] as const,
    },
  ])('persists the roles submitted by each selected file: $label', async ({ roles }) => {
    const target = repository();
    const files = [sizedPdf(1024, 'A.pdf'), sizedPdf(1024, 'B.pdf')];

    await expect(
      createAdminImportBatch(form(files, roles), dependencies(target)),
    ).resolves.toMatchObject({
      status: 'success',
    });
    expect(target.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: [
          expect.objectContaining({ originalFileName: 'A.pdf', documentRole: roles[0] }),
          expect.objectContaining({ originalFileName: 'B.pdf', documentRole: roles[1] }),
        ],
      }),
    );
  });

  it('blocks an oversized total before reading or uploading the files', async () => {
    const target = repository();
    const files = [sizedPdf(31 * 1024 * 1024, 'A.pdf'), sizedPdf(31 * 1024 * 1024, 'B.pdf')];

    await expect(createAdminImportBatch(form(files), dependencies(target))).resolves.toMatchObject({
      status: 'error',
      fieldErrors: { documents: [IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE] },
    });
    expect(files.reduce((total, file) => total + file.size, 0)).toBeGreaterThan(
      IMPORT_ENGINE_MAX_SELECTION_BYTES,
    );
    expect(target.uploadDocument).not.toHaveBeenCalled();
  });

  it('creates without a manual title or competence and keeps an optional competence hint', async () => {
    expect(generateOperationalImportTitle(new Date('2026-08-11T18:42:00.000Z'))).toBe(
      'Importação 11/08/2026 15:42',
    );
    const withoutCompetence = form();
    withoutCompetence.delete('competence');
    const target = repository();
    await expect(
      createAdminImportBatch(withoutCompetence, dependencies(target)),
    ).resolves.toMatchObject({ status: 'success' });
    expect(target.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Importação 11/08/2026 15:42', competence: null }),
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
      message: 'Este arquivo já foi adicionado a este dossiê.',
    });
    expect(target.uploadDocument).not.toHaveBeenCalled();
  });

  it('keeps Supabase behind server actions and exposes accessible responsive admin routes', () => {
    const list = source('../src/app/admin/imports/page.tsx');
    const create = source('../src/app/admin/imports/new/page.tsx');
    const details = source('../src/app/admin/imports/[batchId]/page.tsx');
    const addDocuments = source('../src/app/admin/imports/[batchId]/add/page.tsx');
    const formSource = source('../src/components/admin/admin-import-form.tsx');
    const addFormSource = source('../src/components/admin/admin-import-documents-form.tsx');
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
    expect(formSource).not.toContain('encType=');
    expect(addFormSource).not.toContain('encType=');
    expect(formSource + addFormSource).toContain('AdminImportFileInput');
    expect(formSource + addFormSource).toContain('importDocumentRoleFieldName(item.id)');
    expect(formSource + addFormSource).not.toContain('name="documentRoles"');
    expect(formSource).not.toContain('name="title"');
    expect(formSource).toContain('Competência, se conhecida');
    expect(navigation).toContain("href: '/admin/imports'");
    expect(navigation).toContain("label: 'Importações'");
  });
});
