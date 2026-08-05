import {
  IMPORT_DOCUMENT_ROLES,
  IMPORT_ENGINE_MAX_DOCUMENTS,
  IMPORT_ENGINE_MAX_PDF_BYTES,
  type ImportDocumentRole,
} from '../entities/import-engine';

export interface ImportBatchFormInput {
  readonly title: string;
  readonly competence: string;
  readonly notes: string;
  readonly idempotencyKey: string;
}

export type ImportBatchField = 'title' | 'competence' | 'documents' | 'idempotencyKey';
export type ImportBatchFieldErrors = Partial<Readonly<Record<ImportBatchField, readonly string[]>>>;

export function isImportDocumentRole(value: string): value is ImportDocumentRole {
  return IMPORT_DOCUMENT_ROLES.includes(value as ImportDocumentRole);
}

export function validateImportBatchForm(input: ImportBatchFormInput): ImportBatchFieldErrors {
  const errors: Partial<Record<ImportBatchField, string[]>> = {};
  const title = input.title.trim();
  if (!title || title.length > 160) errors.title = ['Informe um título de até 160 caracteres.'];
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(input.competence))
    errors.competence = ['Informe uma competência válida.'];
  if (!/^[0-9a-f-]{36}$/iu.test(input.idempotencyKey))
    errors.idempotencyKey = ['Recarregue o formulário e tente novamente.'];
  return errors;
}

export function validateImportDocumentMetadata(input: {
  readonly originalFileName: string;
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly role: string;
}): readonly string[] {
  const errors: string[] = [];
  if (!input.originalFileName.toLocaleLowerCase('pt-BR').endsWith('.pdf'))
    errors.push('O arquivo deve possuir extensão .pdf.');
  if (input.mimeType !== 'application/pdf') errors.push('O arquivo deve ser um PDF válido.');
  if (!Number.isSafeInteger(input.fileSizeBytes) || input.fileSizeBytes <= 0)
    errors.push('O arquivo está vazio ou possui tamanho inválido.');
  if (input.fileSizeBytes > IMPORT_ENGINE_MAX_PDF_BYTES)
    errors.push('O PDF excede o limite de 32 MiB.');
  if (!isImportDocumentRole(input.role)) errors.push('Selecione um papel válido para o documento.');
  return Object.freeze(errors);
}

export function validateImportDocumentCount(count: number): readonly string[] {
  if (count < 1) return ['Adicione ao menos um PDF.'];
  if (count > IMPORT_ENGINE_MAX_DOCUMENTS)
    return [`Cada dossiê aceita no máximo ${IMPORT_ENGINE_MAX_DOCUMENTS} PDFs.`];
  return [];
}

export function sanitizeImportFileName(value: string): string {
  const extension = '.pdf';
  const base = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\.pdf$/iu, '')
    .replace(/[^A-Za-z0-9._-]+/gu, '-')
    .replace(/^[._-]+|[._-]+$/gu, '')
    .slice(0, 120);
  return `${base || 'documento'}${extension}`;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
}
