import type {
  DuplicateImportDocument,
  ImportBatch,
  ImportBatchDetails,
  ImportBatchListQuery,
  ImportBatchPage,
  ImportBatchStatus,
  ImportBatchWriteResult,
  ImportDocument,
  ImportDocumentRole,
  ImportDocumentStatus,
  ImportEngineRepository,
} from '@compra-car/core';
import {
  IMPORT_BATCH_STATUSES,
  IMPORT_DOCUMENT_ROLES,
  IMPORT_DOCUMENT_STATUSES,
  IMPORT_ENGINE_PLUGIN_KEY,
  IMPORT_ENGINE_STORAGE_BUCKET,
} from '@compra-car/core';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { assertLegacyServerRuntime, createLegacySupabaseClientFromEnv } from './client';
import { PricingAdapterMappingError, PricingAdapterQueryError } from './errors';

type Row = Record<string, unknown>;

export class ImportEngineStorageError extends PricingAdapterQueryError {}
export class ImportEngineConflictError extends PricingAdapterQueryError {}
export class ImportEngineConcurrencyError extends PricingAdapterQueryError {}

function records(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => typeof item === 'object' && item !== null)
    : [];
}

function id(value: unknown, field: string): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || !String(value).trim())
    throw new PricingAdapterMappingError(`Identificador inválido do Import Engine: ${field}.`);
  return String(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new PricingAdapterMappingError(`Campo inválido do Import Engine: ${field}.`);
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function integer(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new PricingAdapterMappingError(`Inteiro inválido do Import Engine: ${field}.`);
  return parsed;
}

function batchStatus(value: unknown): ImportBatchStatus {
  if (!IMPORT_BATCH_STATUSES.includes(value as ImportBatchStatus))
    throw new PricingAdapterMappingError('Status de batch inválido.');
  return value as ImportBatchStatus;
}

function documentStatus(value: unknown): ImportDocumentStatus {
  if (!IMPORT_DOCUMENT_STATUSES.includes(value as ImportDocumentStatus))
    throw new PricingAdapterMappingError('Status de documento inválido.');
  return value as ImportDocumentStatus;
}

function documentRole(value: unknown): ImportDocumentRole {
  if (!IMPORT_DOCUMENT_ROLES.includes(value as ImportDocumentRole))
    throw new PricingAdapterMappingError('Papel de documento inválido.');
  return value as ImportDocumentRole;
}

function countRelation(value: unknown): number {
  const first = records(value)[0];
  return first ? integer(first.count, 'relation.count') : 0;
}

function creatorName(value: unknown): string | null {
  const relation =
    records(value)[0] ?? (typeof value === 'object' && value !== null ? (value as Row) : null);
  return relation ? optionalText(relation.full_name) : null;
}

function mapBatch(row: Row): ImportBatch {
  const pluginKey = text(row.plugin_key, 'plugin_key');
  if (pluginKey !== IMPORT_ENGINE_PLUGIN_KEY)
    throw new PricingAdapterMappingError('Plugin inesperado no Import Engine.');
  const competence = text(row.competence, 'competence').slice(0, 7);
  return Object.freeze({
    id: id(row.id, 'batch.id'),
    title: text(row.dossier_title, 'dossier_title'),
    pluginKey,
    competence,
    notes: optionalText(row.notes),
    status: batchStatus(row.status),
    documentCount: countRelation(row.documents),
    mmvCount: countRelation(row.rows),
    createdByName: creatorName(row.creator),
    createdAt: text(row.created_at, 'created_at'),
    updatedAt: text(row.updated_at, 'updated_at'),
    lockVersion: integer(row.lock_version, 'lock_version'),
  });
}

function mapDocument(row: Row): ImportDocument {
  const mimeType = text(row.mime_type, 'mime_type');
  if (mimeType !== 'application/pdf')
    throw new PricingAdapterMappingError('MIME inesperado no documento de importação.');
  return Object.freeze({
    id: id(row.id, 'document.id'),
    batchId: id(row.batch_id, 'document.batch_id'),
    documentType: 'pdf',
    originalFileName: text(row.original_file_name, 'original_file_name'),
    storageBucket: text(row.storage_bucket, 'storage_bucket'),
    storageObjectPath: text(row.storage_object_path, 'storage_object_path'),
    mimeType,
    fileSizeBytes: integer(row.file_size_bytes, 'file_size_bytes'),
    contentSha256: text(row.content_sha256, 'content_sha256'),
    pageCount: row.page_count == null ? null : integer(row.page_count, 'page_count'),
    status: documentStatus(row.status),
    sourceOrder: integer(row.source_order, 'source_order'),
    documentRole: documentRole(row.document_role),
    errorCode: optionalText(row.error_code),
    errorMessage: optionalText(row.error_message),
    lockVersion: integer(row.lock_version, 'document.lock_version'),
    createdAt: text(row.created_at, 'document.created_at'),
    updatedAt: text(row.updated_at, 'document.updated_at'),
  });
}

function queryError(message: string, error: PostgrestError): Error {
  if (error.code === '23505') return new ImportEngineConflictError(message, { cause: error });
  if (error.code === '40001') return new ImportEngineConcurrencyError(message, { cause: error });
  return new PricingAdapterQueryError(message, { cause: error });
}

const BATCH_COLUMNS =
  'id,dossier_title,plugin_key,competence,notes,status,created_at,updated_at,lock_version,creator:profiles!pricing_import_batches_created_by_fkey(full_name),documents:pricing_import_documents(count),rows:pricing_import_rows(count)';
const DOCUMENT_COLUMNS =
  'id,batch_id,document_type,original_file_name,storage_bucket,storage_object_path,mime_type,file_size_bytes,content_sha256,page_count,status,source_order,document_role,error_code,error_message,lock_version,created_at,updated_at';

export class ImportEngineSupabaseAdapter implements ImportEngineRepository {
  constructor(private readonly client: SupabaseClient = createLegacySupabaseClientFromEnv()) {
    assertLegacyServerRuntime();
  }

  async findBatchByIdempotencyKey(idempotencyKey: string): Promise<ImportBatchWriteResult | null> {
    const { data, error } = await this.client
      .from('pricing_import_batches')
      .select('id,status,documents:pricing_import_documents(id)')
      .eq('idempotency_key', idempotencyKey)
      .eq('plugin_key', IMPORT_ENGINE_PLUGIN_KEY)
      .maybeSingle();
    if (error) throw queryError('Não foi possível verificar a idempotência.', error);
    if (!data) return null;
    const row = data as unknown as Row;
    return {
      batchId: id(row.id, 'batch.id'),
      status: batchStatus(row.status),
      documentIds: Object.freeze(
        records(row.documents).map((document) => id(document.id, 'document.id')),
      ),
      idempotentReplay: true,
    };
  }

  async findDuplicateDocuments(
    hashes: readonly string[],
  ): Promise<readonly DuplicateImportDocument[]> {
    if (!hashes.length) return [];
    const { data, error } = await this.client
      .from('pricing_import_documents')
      .select(
        'id,content_sha256,original_file_name,created_at,batch:pricing_import_batches!pricing_import_documents_batch_id_fkey(id,dossier_title,status)',
      )
      .in('content_sha256', [...hashes]);
    if (error) throw queryError('Não foi possível verificar documentos duplicados.', error);
    return Object.freeze(
      records(data).map((row) => {
        const batch = records(row.batch)[0] ?? (row.batch as Row);
        return Object.freeze({
          contentSha256: text(row.content_sha256, 'content_sha256'),
          documentId: id(row.id, 'document.id'),
          originalFileName: text(row.original_file_name, 'original_file_name'),
          batchId: id(batch.id, 'batch.id'),
          batchTitle: text(batch.dossier_title, 'batch.dossier_title'),
          batchStatus: batchStatus(batch.status),
          createdAt: text(row.created_at, 'created_at'),
        });
      }),
    );
  }

  async uploadDocument(input: {
    readonly path: string;
    readonly data: Uint8Array;
    readonly contentType: 'application/pdf';
  }) {
    const { error } = await this.client.storage
      .from(IMPORT_ENGINE_STORAGE_BUCKET)
      .upload(input.path, input.data, { contentType: input.contentType, upsert: false });
    if (error)
      throw new ImportEngineStorageError('Falha no armazenamento privado do PDF.', {
        cause: error,
      });
  }

  async removeUploadedDocuments(paths: readonly string[]) {
    if (!paths.length) return;
    const { error } = await this.client.storage
      .from(IMPORT_ENGINE_STORAGE_BUCKET)
      .remove([...paths]);
    if (error)
      throw new ImportEngineStorageError('Falha ao compensar objetos do upload.', { cause: error });
  }

  async createBatch(
    input: Parameters<ImportEngineRepository['createBatch']>[0],
  ): Promise<ImportBatchWriteResult> {
    const { data, error } = await this.client.rpc('create_import_engine_batch', {
      p_title: input.title,
      p_plugin_key: IMPORT_ENGINE_PLUGIN_KEY,
      p_competence: `${input.competence}-01`,
      p_notes: input.notes,
      p_idempotency_key: input.idempotencyKey,
      p_documents: input.documents.map((document) => ({
        documentType: 'pdf',
        originalFileName: document.originalFileName,
        storageBucket: document.storageBucket,
        storageObjectPath: document.storageObjectPath,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        contentSha256: document.contentSha256,
        sourceOrder: document.sourceOrder,
        documentRole: document.documentRole,
        duplicateAcknowledged: document.duplicateAcknowledged,
      })),
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error) throw queryError('Não foi possível criar a importação.', error);
    if (typeof data !== 'object' || data === null)
      throw new PricingAdapterMappingError('Resposta inválida da criação de importação.');
    const row = data as Row;
    return Object.freeze({
      batchId: id(row.batchId, 'batchId'),
      status: batchStatus(row.status),
      documentIds: Object.freeze(
        (Array.isArray(row.documentIds) ? row.documentIds : []).map((value) =>
          id(value, 'documentId'),
        ),
      ),
      idempotentReplay: row.idempotentReplay === true,
    });
  }

  async addDocuments(
    input: Parameters<ImportEngineRepository['addDocuments']>[0],
  ): ReturnType<ImportEngineRepository['addDocuments']> {
    const { data, error } = await this.client.rpc('add_import_engine_documents', {
      p_batch_id: Number(input.batchId),
      p_expected_lock_version: input.expectedLockVersion,
      p_operation_id: input.operationId,
      p_documents: input.documents.map((document) => ({
        documentType: 'pdf',
        originalFileName: document.originalFileName,
        storageBucket: document.storageBucket,
        storageObjectPath: document.storageObjectPath,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        contentSha256: document.contentSha256,
        sourceOrder: document.sourceOrder,
        documentRole: document.documentRole,
        duplicateAcknowledged: document.duplicateAcknowledged,
      })),
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error) throw queryError('Não foi possível adicionar os documentos.', error);
    if (typeof data !== 'object' || data === null)
      throw new PricingAdapterMappingError('Resposta inválida da inclusão de documentos.');
    const row = data as Row;
    return Promise.resolve(
      Object.freeze({
        batchId: id(row.batchId, 'batchId'),
        documentIds: Object.freeze(
          (Array.isArray(row.documentIds) ? row.documentIds : []).map((value) =>
            id(value, 'documentId'),
          ),
        ),
        idempotentReplay: row.idempotentReplay === true,
      }),
    );
  }

  async listBatches(query: ImportBatchListQuery): Promise<ImportBatchPage> {
    const from = (query.page - 1) * query.pageSize;
    let request = this.client
      .from('pricing_import_batches')
      .select(BATCH_COLUMNS, { count: 'exact' })
      .eq('plugin_key', IMPORT_ENGINE_PLUGIN_KEY);
    if (query.status) request = request.eq('status', query.status);
    if (query.competence) request = request.eq('competence', `${query.competence}-01`);
    if (query.text?.trim())
      request = request.ilike('dossier_title', `%${query.text.trim().slice(0, 100)}%`);
    const { data, error, count } = await request
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + query.pageSize - 1);
    if (error) throw queryError('Não foi possível listar as importações.', error);
    return Object.freeze({
      items: Object.freeze(records(data).map(mapBatch)),
      total: count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async getBatch(batchId: string): Promise<ImportBatchDetails | null> {
    const { data, error } = await this.client
      .from('pricing_import_batches')
      .select(BATCH_COLUMNS)
      .eq('id', Number(batchId))
      .eq('plugin_key', IMPORT_ENGINE_PLUGIN_KEY)
      .maybeSingle();
    if (error) throw queryError('Não foi possível carregar a importação.', error);
    if (!data) return null;
    const { data: documentData, error: documentError } = await this.client
      .from('pricing_import_documents')
      .select(DOCUMENT_COLUMNS)
      .eq('batch_id', Number(batchId))
      .order('source_order');
    if (documentError) throw queryError('Não foi possível carregar os documentos.', documentError);
    return Object.freeze({
      ...mapBatch(data as unknown as Row),
      documents: Object.freeze(records(documentData).map(mapDocument)),
    });
  }

  async createDocumentSignedUrl(
    documentId: string,
    expiresInSeconds: number,
  ): Promise<string | null> {
    const { data, error } = await this.client
      .from('pricing_import_documents')
      .select(
        'storage_bucket,storage_object_path,batch:pricing_import_batches!pricing_import_documents_batch_id_fkey(plugin_key)',
      )
      .eq('id', Number(documentId))
      .maybeSingle();
    if (error) throw queryError('Não foi possível localizar o documento.', error);
    if (!data) return null;
    const row = data as unknown as Row;
    const batch = records(row.batch)[0] ?? (row.batch as Row);
    if (batch.plugin_key !== IMPORT_ENGINE_PLUGIN_KEY) return null;
    const bucket = text(row.storage_bucket, 'storage_bucket');
    const path = text(row.storage_object_path, 'storage_object_path');
    const { data: signed, error: signedError } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (signedError)
      throw new ImportEngineStorageError('Não foi possível gerar o acesso temporário.', {
        cause: signedError,
      });
    return signed.signedUrl;
  }

  async updateDocumentRole(input: Parameters<ImportEngineRepository['updateDocumentRole']>[0]) {
    const { data, error } = await this.client.rpc('update_import_engine_document_role', {
      p_document_id: Number(input.documentId),
      p_document_role: input.role,
      p_expected_lock_version: input.expectedLockVersion,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error) throw queryError('Não foi possível alterar o papel do documento.', error);
    return mapDocument(data as unknown as Row);
  }

  async rejectDocument(input: Parameters<ImportEngineRepository['rejectDocument']>[0]) {
    const { data, error } = await this.client.rpc('reject_import_engine_document', {
      p_document_id: Number(input.documentId),
      p_expected_lock_version: input.expectedLockVersion,
      p_reason: input.reason,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error) throw queryError('Não foi possível rejeitar o documento.', error);
    return mapDocument(data as unknown as Row);
  }

  async archiveBatch(input: Parameters<ImportEngineRepository['archiveBatch']>[0]) {
    const { error } = await this.client.rpc('archive_import_engine_batch', {
      p_batch_id: Number(input.batchId),
      p_expected_lock_version: input.expectedLockVersion,
      p_reason: input.reason,
      p_actor_id: input.actorId,
      p_correlation_id: input.correlationId,
    });
    if (error) throw queryError('Não foi possível arquivar a importação.', error);
  }
}
