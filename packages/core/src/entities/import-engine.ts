export const IMPORT_ENGINE_PLUGIN_KEY = 'commercial_letters' as const;
export const IMPORT_ENGINE_SCHEMA_VERSION = 'import-engine/batch/1' as const;
export const IMPORT_ENGINE_STORAGE_BUCKET = 'import-engine-documents' as const;
export const IMPORT_ENGINE_MAX_DOCUMENTS = 20;
export const IMPORT_ENGINE_MAX_PDF_BYTES = 32 * 1024 * 1024;
export const IMPORT_ENGINE_SIGNED_URL_TTL_SECONDS = 300;

export const IMPORT_DOCUMENT_ROLES = [
  'primary',
  'errata',
  'complement',
  'financial_appendix',
  'trade_in_appendix',
  'technical_appendix',
  'other',
] as const;

export type ImportDocumentRole = (typeof IMPORT_DOCUMENT_ROLES)[number];

export const IMPORT_DOCUMENT_STATUSES = [
  'uploaded',
  'validated',
  'ready',
  'processing',
  'processed',
  'failed',
  'rejected',
  'archived',
] as const;

export type ImportDocumentStatus = (typeof IMPORT_DOCUMENT_STATUSES)[number];

export const IMPORT_BATCH_STATUSES = [
  'uploaded',
  'extracting',
  'needs_review',
  'ready',
  'promoting',
  'promoted',
  'failed',
  'rejected',
  'archived',
] as const;

export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export interface ImportPluginDescriptor {
  readonly key: typeof IMPORT_ENGINE_PLUGIN_KEY;
  readonly version: '1';
  readonly displayName: 'Cartas Comerciais';
  readonly acceptedDocumentTypes: readonly ['pdf'];
}

export const COMMERCIAL_LETTERS_PLUGIN: ImportPluginDescriptor = Object.freeze({
  key: IMPORT_ENGINE_PLUGIN_KEY,
  version: '1',
  displayName: 'Cartas Comerciais',
  acceptedDocumentTypes: Object.freeze(['pdf'] as const),
});

export interface ImportDocument {
  readonly id: string;
  readonly batchId: string;
  readonly documentType: 'pdf';
  readonly originalFileName: string;
  readonly storageBucket: string;
  readonly storageObjectPath: string;
  readonly mimeType: 'application/pdf';
  readonly fileSizeBytes: number;
  readonly contentSha256: string;
  readonly pageCount: number | null;
  readonly status: ImportDocumentStatus;
  readonly sourceOrder: number;
  readonly documentRole: ImportDocumentRole;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly lockVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImportBatch {
  readonly id: string;
  readonly title: string;
  readonly pluginKey: typeof IMPORT_ENGINE_PLUGIN_KEY;
  readonly competence: string | null;
  readonly notes: string | null;
  readonly status: ImportBatchStatus;
  readonly documentCount: number;
  readonly mmvCount: number;
  readonly createdByName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lockVersion: number;
}

export interface ImportBatchDetails extends ImportBatch {
  readonly documents: readonly ImportDocument[];
}

export interface ImportBatchPage {
  readonly items: readonly ImportBatch[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface DuplicateImportDocument {
  readonly contentSha256: string;
  readonly documentId: string;
  readonly originalFileName: string;
  readonly batchId: string;
  readonly batchTitle: string;
  readonly batchStatus: ImportBatchStatus;
  readonly createdAt: string;
}
