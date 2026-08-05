'use server';

import type {
  ImportBatchActionStateDto,
  ImportDocumentsActionStateDto,
} from '@compra-car/contracts';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import {
  archiveAdminImportBatch,
  addAdminImportDocuments,
  createAdminImportBatch,
  createAdminImportDocumentSignedUrl,
  rejectAdminImportDocument,
  updateAdminImportDocumentRole,
} from '@/server/import-engine-service';

export async function addImportDocumentsAction(
  _previousState: ImportDocumentsActionStateDto,
  formData: FormData,
): Promise<ImportDocumentsActionStateDto> {
  return addAdminImportDocuments(formData);
}

export async function createImportBatchAction(
  _previousState: ImportBatchActionStateDto,
  formData: FormData,
): Promise<ImportBatchActionStateDto> {
  return createAdminImportBatch(formData);
}

export async function openImportDocumentAction(formData: FormData) {
  const documentId = String(formData.get('documentId') ?? '');
  const url = await createAdminImportDocumentSignedUrl(documentId);
  if (!url) redirect('/admin/imports?error=document-not-found');
  redirect(url);
}

export async function updateImportDocumentRoleAction(formData: FormData) {
  const batchId = String(formData.get('batchId') ?? '');
  await updateAdminImportDocumentRole({
    documentId: String(formData.get('documentId') ?? ''),
    role: String(formData.get('documentRole') ?? ''),
    expectedLockVersion: Number(formData.get('lockVersion')),
  });
  revalidatePath(`/admin/imports/${batchId}`);
}

export async function rejectImportDocumentAction(formData: FormData) {
  const batchId = String(formData.get('batchId') ?? '');
  await rejectAdminImportDocument({
    documentId: String(formData.get('documentId') ?? ''),
    expectedLockVersion: Number(formData.get('lockVersion')),
    reason: String(formData.get('reason') ?? ''),
  });
  revalidatePath(`/admin/imports/${batchId}`);
}

export async function archiveImportBatchAction(formData: FormData) {
  await archiveAdminImportBatch({
    batchId: String(formData.get('batchId') ?? ''),
    expectedLockVersion: Number(formData.get('lockVersion')),
    reason: String(formData.get('reason') ?? ''),
  });
  redirect('/admin/imports');
}
