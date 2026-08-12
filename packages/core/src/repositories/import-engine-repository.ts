import type {
  DuplicateImportDocument,
  ImportBatchDetails,
  ImportBatchPage,
  ImportBatchStatus,
  ImportDocument,
  ImportDocumentRole,
} from '../entities/import-engine';

export interface ImportDocumentUpload {
  readonly originalFileName: string;
  readonly storageBucket: 'import-engine-documents';
  readonly storageObjectPath: string;
  readonly mimeType: 'application/pdf';
  readonly fileSizeBytes: number;
  readonly contentSha256: string;
  readonly sourceOrder: number;
  readonly documentRole: ImportDocumentRole;
  readonly duplicateAcknowledged: boolean;
}

export interface ImportBatchWriteResult {
  readonly batchId: string;
  readonly status: ImportBatchStatus;
  readonly documentIds: readonly string[];
  readonly idempotentReplay: boolean;
}

export interface ImportDocumentsWriteResult {
  readonly batchId: string;
  readonly documentIds: readonly string[];
  readonly idempotentReplay: boolean;
}

export interface ImportBatchListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: ImportBatchStatus;
  readonly competence?: string;
  readonly text?: string;
}

export interface ImportEngineRepository {
  findBatchByIdempotencyKey(idempotencyKey: string): Promise<ImportBatchWriteResult | null>;
  findDuplicateDocuments(hashes: readonly string[]): Promise<readonly DuplicateImportDocument[]>;
  uploadDocument(input: {
    readonly path: string;
    readonly data: Uint8Array;
    readonly contentType: 'application/pdf';
  }): Promise<void>;
  removeUploadedDocuments(paths: readonly string[]): Promise<void>;
  createBatch(input: {
    readonly title: string;
    readonly competence: string | null;
    readonly notes: string | null;
    readonly idempotencyKey: string;
    readonly documents: readonly ImportDocumentUpload[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ImportBatchWriteResult>;
  addDocuments(input: {
    readonly batchId: string;
    readonly expectedLockVersion: number;
    readonly operationId: string;
    readonly documents: readonly ImportDocumentUpload[];
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ImportDocumentsWriteResult>;
  listBatches(query: ImportBatchListQuery): Promise<ImportBatchPage>;
  getBatch(batchId: string): Promise<ImportBatchDetails | null>;
  createDocumentSignedUrl(documentId: string, expiresInSeconds: number): Promise<string | null>;
  updateDocumentRole(input: {
    readonly documentId: string;
    readonly role: ImportDocumentRole;
    readonly expectedLockVersion: number;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ImportDocument>;
  rejectDocument(input: {
    readonly documentId: string;
    readonly expectedLockVersion: number;
    readonly reason: string;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ImportDocument>;
  archiveBatch(input: {
    readonly batchId: string;
    readonly expectedLockVersion: number;
    readonly reason: string;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<void>;
}
