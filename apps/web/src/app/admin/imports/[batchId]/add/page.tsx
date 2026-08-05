import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { IMPORT_ENGINE_MAX_DOCUMENTS } from '@compra-car/core';
import type { ImportDocumentsActionStateDto } from '@compra-car/contracts';

import { requireRole } from '@/auth/authorization';
import { AdminImportDocumentsForm } from '@/components/admin/admin-import-documents-form';
import { PageHeader } from '@/components/admin/page-header';
import { loadAdminImportBatch } from '@/server/import-engine-service';
import { addImportDocumentsAction } from '../../actions';

export default async function AddImportDocumentsPage({
  params,
}: {
  readonly params: Promise<{ batchId: string }>;
}) {
  await requireRole('admin');
  const { batchId } = await params;
  const batch = await loadAdminImportBatch(batchId);
  if (!batch || !['uploaded', 'ready'].includes(batch.status)) notFound();
  const maximumFiles = IMPORT_ENGINE_MAX_DOCUMENTS - batch.documentCount;
  if (maximumFiles < 1) notFound();
  const initialState: ImportDocumentsActionStateDto = {
    status: 'idle',
    values: {
      batchId: batch.id,
      expectedLockVersion: String(batch.lockVersion),
      operationId: randomUUID(),
      acknowledgeDuplicates: false,
    },
    fieldErrors: {},
    duplicates: [],
  };
  return (
    <>
      <PageHeader
        description={`Inclua PDFs privados no dossiÃª ${batch.title}.`}
        eyebrow="Import Engine"
        title="Adicionar documentos"
      />
      <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <AdminImportDocumentsForm
          action={addImportDocumentsAction}
          initialState={initialState}
          maximumFiles={maximumFiles}
        />
      </div>
    </>
  );
}
