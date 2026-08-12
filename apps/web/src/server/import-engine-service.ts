import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import {
  COMMERCIAL_LETTERS_PLUGIN,
  GetImportBatch,
  hasPdfSignature,
  IMPORT_ENGINE_MAX_DOCUMENTS,
  IMPORT_ENGINE_SIGNED_URL_TTL_SECONDS,
  IMPORT_ENGINE_STORAGE_BUCKET,
  isImportDocumentRole,
  ListImportBatches,
  sanitizeImportFileName,
  validateImportBatchForm,
  validateImportDocumentCount,
  validateImportDocumentMetadata,
  type ImportBatchListQuery,
  type ImportDocumentRole,
  type ImportEngineRepository,
  ExtractionProviderRegistry,
  COMMERCIAL_LETTER_PAYLOAD_SCHEMA_VERSION,
  IMPORT_PROCESSING_LEASE_SECONDS,
  enrichCommercialLetterRow,
  matchProduct,
  prepareCommercialLetterRows,
  sanitizeProcessingError,
  type ImportProcessingRepository,
  type ExtractionProvider,
} from '@compra-car/core';
import { createCommercialLetterPayloadValidator } from '@compra-car/core/commercial-letter-payload-validator';
import type {
  ImportBatchActionStateDto,
  ImportBatchDetailsDto,
  ImportBatchFormValuesDto,
  ImportBatchListItemDto,
  ImportDuplicateDto,
  ImportDocumentsActionStateDto,
  ImportDocumentsFormValuesDto,
} from '@compra-car/contracts';
import {
  ImportEngineConflictError,
  ImportEngineStorageError,
  ImportEngineSupabaseAdapter,
  ImportProcessingSupabaseAdapter,
} from '@compra-car/adapter-supabase';
import schema from '../../../../docs/import/schemas/commercial-letter-mmv-payload-v1.schema.json';
import { FakeExtractionProvider } from './fake-extraction-provider';

import { requireRole } from '@/auth/authorization';
import {
  exceedsImportSelectionLimit,
  IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE,
} from '@/config/import-engine-upload';
import { parseImportDocumentSubmissions } from '@/application/admin/import-document-submission';

const createRepository = (): ImportEngineRepository => new ImportEngineSupabaseAdapter();

export async function processAdminImportBatch(
  batchId: string,
  dependencies: {
    readonly repository?: ImportEngineRepository;
    readonly processingRepository?: ImportProcessingRepository;
    readonly authorize?: () => Promise<{ readonly actorId: string }>;
    readonly createCorrelationId?: () => string;
    readonly extractionProvider?: ExtractionProvider;
  } = {},
): Promise<{ readonly rowCount: number; readonly idempotentReplay: boolean }> {
  const identity = dependencies.authorize
    ? await dependencies.authorize()
    : await requireRole('admin').then(({ profile }) => ({ actorId: profile.id }));
  const correlationId = dependencies.createCorrelationId?.() ?? randomUUID();
  const repository = dependencies.repository ?? createRepository();
  const processing = dependencies.processingRepository ?? new ImportProcessingSupabaseAdapter();
  const batch = await repository.getBatch(batchId);
  if (!batch) throw new Error('Dossiê de importação não encontrado.');
  const registry = new ExtractionProviderRegistry();
  registry.register(dependencies.extractionProvider ?? new FakeExtractionProvider());
  const provider = registry.require('fake');
  const validatePayload = createCommercialLetterPayloadValidator(schema as Record<string, unknown>);
  const queued = await processing.enqueue({
    batchId,
    pluginVersion: COMMERCIAL_LETTERS_PLUGIN.version,
    providerKey: provider.key,
    providerVersion: provider.version,
    schemaVersion: COMMERCIAL_LETTER_PAYLOAD_SCHEMA_VERSION,
    actorId: identity.actorId,
    correlationId,
  });
  const claimToken = randomUUID();
  await processing.claim({
    jobId: queued.jobId,
    claimToken,
    leaseSeconds: IMPORT_PROCESSING_LEASE_SECONDS,
    actorId: identity.actorId,
    correlationId,
  });
  try {
    const documents = await Promise.all(
      batch.documents
        .filter((document) => document.status !== 'rejected')
        .map(async (document) => ({
          id: document.id,
          role: document.documentRole,
          mimeType: 'application/pdf' as const,
          contentSha256: document.contentSha256,
          originalFileName: document.originalFileName,
          bytes: await processing.downloadDocument(
            document.storageBucket,
            document.storageObjectPath,
          ),
        })),
    );
    const extracted = await provider.extract({
      documents,
      schemaVersion: COMMERCIAL_LETTER_PAYLOAD_SCHEMA_VERSION,
      schema: schema as Record<string, unknown>,
      instructions:
        'Extraia somente fatos explícitos no bloco completo aplicável ao MMV; dúvidas materiais permanecem REVIEW.',
    });
    const rows = await Promise.all(
      prepareCommercialLetterRows(extracted.payloads, validatePayload).map(async (row) => {
        const catalog = await processing.findMatchCandidates(row.matchInput);
        return enrichCommercialLetterRow(
          row,
          matchProduct(row.matchInput, catalog),
          validatePayload,
        );
      }),
    );
    const finalized = await processing.finalize({
      jobId: queued.jobId,
      claimToken,
      rows,
      providerRunId: extracted.providerRunId,
      usage: extracted.usage,
      actorId: identity.actorId,
      correlationId,
    });
    return {
      rowCount: finalized.rowCount ?? rows.length,
      idempotentReplay: finalized.idempotentReplay,
    };
  } catch (error) {
    const safeError = sanitizeProcessingError(error);
    await processing
      .fail({
        jobId: queued.jobId,
        claimToken,
        errorCode: safeError.code,
        errorMessage: safeError.message,
        actorId: identity.actorId,
        correlationId,
      })
      .catch(() => undefined);
    throw error;
  }
}

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function values(formData: FormData): ImportBatchFormValuesDto {
  return {
    competence: formValue(formData, 'competence'),
    notes: formValue(formData, 'notes'),
    idempotencyKey: formValue(formData, 'idempotencyKey'),
    acknowledgeDuplicates: formValue(formData, 'acknowledgeDuplicates') === 'true',
  };
}

export function generateOperationalImportTitle(now: Date): string {
  const timestamp = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .replace(',', '');
  return `Importação ${timestamp}`;
}

function errorState(
  current: ImportBatchFormValuesDto,
  message: string,
  fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  correlationId?: string,
): ImportBatchActionStateDto {
  return {
    status: 'error',
    values: current,
    fieldErrors,
    duplicates: [],
    message,
    ...(correlationId ? { correlationId } : {}),
  };
}

function duplicateDto(
  value: Awaited<ReturnType<ImportEngineRepository['findDuplicateDocuments']>>[number],
): ImportDuplicateDto {
  return {
    contentSha256: value.contentSha256,
    originalFileName: value.originalFileName,
    batchId: value.batchId,
    batchTitle: value.batchTitle,
    batchStatus: value.batchStatus,
    createdAt: value.createdAt,
  };
}

export async function createAdminImportBatch(
  formData: FormData,
  dependencies: {
    readonly repository?: ImportEngineRepository;
    readonly authorize?: () => Promise<{ readonly actorId: string }>;
    readonly createCorrelationId?: () => string;
    readonly now?: () => Date;
  } = {},
): Promise<ImportBatchActionStateDto> {
  const identity = dependencies.authorize
    ? await dependencies.authorize()
    : await requireRole('admin').then(({ profile }) => ({ actorId: profile.id }));
  const current = values(formData);
  const correlationId = dependencies.createCorrelationId?.() ?? randomUUID();
  const repository = dependencies.repository ?? createRepository();
  const fieldErrors: Record<string, readonly string[]> = { ...validateImportBatchForm(current) };

  try {
    const replay = current.idempotencyKey
      ? await repository.findBatchByIdempotencyKey(current.idempotencyKey)
      : null;
    if (replay) {
      return {
        status: 'success',
        values: current,
        fieldErrors: {},
        duplicates: [],
        message: 'Esta importação já havia sido criada com sucesso.',
        batchId: replay.batchId,
      };
    }

    const submission = parseImportDocumentSubmissions(formData);
    const files = submission.documents.map(({ file }) => file);
    const countErrors = validateImportDocumentCount(files.length);
    if (countErrors.length) fieldErrors.documents = countErrors;
    if (submission.hasInvalidPairing) fieldErrors.documents = ['Selecione o papel de cada PDF.'];
    if (exceedsImportSelectionLimit(files))
      return errorState(current, 'Revise os dados e os PDFs selecionados.', {
        ...fieldErrors,
        documents: [IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE],
      });

    const prepared: {
      file: File;
      bytes: Uint8Array;
      hash: string;
      role: ImportDocumentRole;
      safeName: string;
      path: string;
    }[] = [];
    for (const [index, document] of submission.documents.entries()) {
      const { file, role } = document;
      const metadataErrors = validateImportDocumentMetadata({
        originalFileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        role,
      });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const errors = [...metadataErrors];
      if (!hasPdfSignature(bytes)) errors.push('A assinatura do arquivo não corresponde a um PDF.');
      if (errors.length) {
        fieldErrors[`document.${index}`] = Object.freeze(errors);
        continue;
      }
      if (!isImportDocumentRole(role)) continue;
      const hash = createHash('sha256').update(bytes).digest('hex');
      const safeName = sanitizeImportFileName(file.name);
      prepared.push({
        file,
        bytes,
        hash,
        role,
        safeName,
        path: `${COMMERCIAL_LETTERS_PLUGIN.key}/${current.idempotencyKey}/${randomUUID()}/${safeName}`,
      });
    }

    const repeated = prepared.filter((document, index) =>
      prepared.some(
        (candidate, candidateIndex) => candidate.hash === document.hash && candidateIndex < index,
      ),
    );
    if (repeated.length)
      fieldErrors.documents = ['O mesmo arquivo foi selecionado mais de uma vez.'];
    if (Object.keys(fieldErrors).length)
      return errorState(current, 'Revise os dados e os PDFs selecionados.', fieldErrors);

    const duplicates = await repository.findDuplicateDocuments(
      prepared.map((document) => document.hash),
    );
    if (duplicates.length && !current.acknowledgeDuplicates) {
      return {
        status: 'duplicate',
        values: current,
        fieldErrors: {},
        duplicates: duplicates.map(duplicateDto),
        message:
          'Um ou mais documentos já pertencem a outro dossiê. Confirme o reprocessamento para continuar.',
      };
    }

    const uploadedPaths: string[] = [];
    try {
      for (const document of prepared) {
        await repository.uploadDocument({
          path: document.path,
          data: document.bytes,
          contentType: 'application/pdf',
        });
        uploadedPaths.push(document.path);
      }
      const result = await repository.createBatch({
        title: generateOperationalImportTitle(dependencies.now?.() ?? new Date()),
        competence: current.competence || null,
        notes: current.notes.trim() || null,
        idempotencyKey: current.idempotencyKey,
        documents: prepared.map((document, index) => ({
          originalFileName: document.file.name,
          storageBucket: IMPORT_ENGINE_STORAGE_BUCKET,
          storageObjectPath: document.path,
          mimeType: 'application/pdf',
          fileSizeBytes: document.file.size,
          contentSha256: document.hash,
          sourceOrder: index + 1,
          documentRole: document.role,
          duplicateAcknowledged: current.acknowledgeDuplicates,
        })),
        actorId: identity.actorId,
        correlationId,
      });
      return {
        status: 'success',
        values: current,
        fieldErrors: {},
        duplicates: [],
        message: 'Documentos recebidos com sucesso. O dossiê está pronto para a próxima etapa.',
        batchId: result.batchId,
      };
    } catch (error) {
      const committed = await repository
        .findBatchByIdempotencyKey(current.idempotencyKey)
        .catch(() => null);
      if (committed) {
        return {
          status: 'success',
          values: current,
          fieldErrors: {},
          duplicates: [],
          message: 'A importação foi confirmada após uma repetição segura da solicitação.',
          batchId: committed.batchId,
        };
      }
      await repository.removeUploadedDocuments(uploadedPaths).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof ImportEngineConflictError)
      return errorState(
        current,
        'O arquivo ou a solicitação já foi registrada.',
        {},
        correlationId,
      );
    if (error instanceof ImportEngineStorageError)
      return errorState(
        current,
        'Não foi possível armazenar um dos PDFs. Nenhum dossiê foi criado.',
        {},
        correlationId,
      );
    return errorState(current, 'Falha inesperada ao criar a importação.', {}, correlationId);
  }
}

function addDocumentValues(formData: FormData): ImportDocumentsFormValuesDto {
  return {
    batchId: formValue(formData, 'batchId'),
    expectedLockVersion: formValue(formData, 'expectedLockVersion'),
    operationId: formValue(formData, 'operationId'),
    acknowledgeDuplicates: formValue(formData, 'acknowledgeDuplicates') === 'true',
  };
}

function addDocumentError(
  current: ImportDocumentsFormValuesDto,
  message: string,
  fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  correlationId?: string,
): ImportDocumentsActionStateDto {
  return {
    status: 'error',
    values: current,
    fieldErrors,
    duplicates: [],
    message,
    ...(correlationId ? { correlationId } : {}),
  };
}

export async function addAdminImportDocuments(
  formData: FormData,
  dependencies: {
    readonly repository?: ImportEngineRepository;
    readonly authorize?: () => Promise<{ readonly actorId: string }>;
    readonly createCorrelationId?: () => string;
  } = {},
): Promise<ImportDocumentsActionStateDto> {
  const identity = dependencies.authorize
    ? await dependencies.authorize()
    : await requireRole('admin').then(({ profile }) => ({ actorId: profile.id }));
  const current = addDocumentValues(formData);
  const correlationId = dependencies.createCorrelationId?.() ?? randomUUID();
  const repository = dependencies.repository ?? createRepository();
  const fieldErrors: Record<string, readonly string[]> = {};

  try {
    if (!/^\d+$/u.test(current.batchId)) fieldErrors.batchId = ['Dossiê inválido.'];
    const expectedLockVersion = Number(current.expectedLockVersion);
    if (!Number.isSafeInteger(expectedLockVersion) || expectedLockVersion < 1)
      fieldErrors.expectedLockVersion = ['Versão do dossiê inválida.'];
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        current.operationId,
      )
    )
      fieldErrors.operationId = ['Identificador da operação inválido.'];

    const submission = parseImportDocumentSubmissions(formData);
    const files = submission.documents.map(({ file }) => file);
    const countErrors = validateImportDocumentCount(files.length);
    if (countErrors.length) fieldErrors.documents = countErrors;
    if (submission.hasInvalidPairing) fieldErrors.documents = ['Selecione o papel de cada PDF.'];
    if (exceedsImportSelectionLimit(files))
      return addDocumentError(current, 'Revise os PDFs selecionados.', {
        ...fieldErrors,
        documents: [IMPORT_ENGINE_REQUEST_TOO_LARGE_MESSAGE],
      });

    const batch = /^\d+$/u.test(current.batchId)
      ? await repository.getBatch(current.batchId)
      : null;
    if (!batch) fieldErrors.batchId = ['Dossiê não encontrado.'];
    else {
      if (!['uploaded', 'ready'].includes(batch.status))
        fieldErrors.documents = ['Este dossiê não aceita novos documentos no status atual.'];
      if (batch.documentCount + files.length > IMPORT_ENGINE_MAX_DOCUMENTS)
        fieldErrors.documents = [
          `O dossiê aceita no máximo ${IMPORT_ENGINE_MAX_DOCUMENTS} documentos.`,
        ];
    }

    const prepared: {
      file: File;
      bytes: Uint8Array;
      hash: string;
      role: ImportDocumentRole;
      path: string;
    }[] = [];
    for (const [index, document] of submission.documents.entries()) {
      const { file, role } = document;
      const errors = validateImportDocumentMetadata({
        originalFileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        role,
      });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const documentErrors = [...errors];
      if (!hasPdfSignature(bytes))
        documentErrors.push('A assinatura do arquivo não corresponde a um PDF.');
      if (documentErrors.length) {
        fieldErrors[`document.${index}`] = Object.freeze(documentErrors);
        continue;
      }
      if (!isImportDocumentRole(role)) continue;
      const hash = createHash('sha256').update(bytes).digest('hex');
      prepared.push({
        file,
        bytes,
        hash,
        role,
        path: `${COMMERCIAL_LETTERS_PLUGIN.key}/${current.operationId}/${randomUUID()}/${sanitizeImportFileName(file.name)}`,
      });
    }
    if (
      prepared.some((document, index) =>
        prepared.some(
          (candidate, candidateIndex) => candidate.hash === document.hash && candidateIndex < index,
        ),
      )
    )
      fieldErrors.documents = ['O mesmo arquivo foi selecionado mais de uma vez.'];
    if (Object.keys(fieldErrors).length)
      return addDocumentError(current, 'Revise os PDFs selecionados.', fieldErrors);

    const duplicates = await repository.findDuplicateDocuments(
      prepared.map((document) => document.hash),
    );
    const sameBatch = duplicates.filter((duplicate) => duplicate.batchId === current.batchId);
    if (sameBatch.length)
      return addDocumentError(current, 'Este arquivo já foi adicionado a este dossiê.', {
        documents: ['Remova da seleção o PDF que já pertence ao dossiê.'],
      });
    if (duplicates.length && !current.acknowledgeDuplicates) {
      return {
        status: 'duplicate',
        values: current,
        fieldErrors: {},
        duplicates: duplicates.map(duplicateDto),
        message:
          'Um ou mais documentos já pertencem a outro dossiê. Confirme o reprocessamento para continuar.',
      };
    }

    const input = {
      batchId: current.batchId,
      expectedLockVersion,
      operationId: current.operationId,
      documents: prepared.map((document, index) => ({
        originalFileName: document.file.name,
        storageBucket: IMPORT_ENGINE_STORAGE_BUCKET,
        storageObjectPath: document.path,
        mimeType: 'application/pdf' as const,
        fileSizeBytes: document.file.size,
        contentSha256: document.hash,
        sourceOrder: index + 1,
        documentRole: document.role,
        duplicateAcknowledged: current.acknowledgeDuplicates,
      })),
      actorId: identity.actorId,
      correlationId,
    };
    const uploadedPaths: string[] = [];
    try {
      for (const document of prepared) {
        await repository.uploadDocument({
          path: document.path,
          data: document.bytes,
          contentType: 'application/pdf',
        });
        uploadedPaths.push(document.path);
      }
      await repository.addDocuments(input);
    } catch (error) {
      const committed = await repository.addDocuments(input).catch(() => null);
      if (!committed) {
        await repository.removeUploadedDocuments(uploadedPaths).catch(() => undefined);
        throw error;
      }
    }
    return {
      status: 'success',
      values: current,
      fieldErrors: {},
      duplicates: [],
      message: 'Documentos adicionados com sucesso.',
      batchId: current.batchId,
    };
  } catch (error) {
    if (error instanceof ImportEngineConflictError)
      return addDocumentError(current, 'O documento já foi registrado.', {}, correlationId);
    if (error instanceof ImportEngineStorageError)
      return addDocumentError(
        current,
        'Não foi possível armazenar um dos PDFs. A operação foi compensada.',
        {},
        correlationId,
      );
    return addDocumentError(
      current,
      'Falha inesperada ao adicionar documentos.',
      {},
      correlationId,
    );
  }
}

function batchDto(
  batch: Awaited<ReturnType<ListImportBatches['execute']>>['items'][number],
): ImportBatchListItemDto {
  return {
    id: batch.id,
    title: batch.title,
    pluginKey: batch.pluginKey,
    competence: batch.competence,
    status: batch.status,
    documentCount: batch.documentCount,
    mmvCount: batch.mmvCount,
    createdByName: batch.createdByName,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    lockVersion: batch.lockVersion,
  };
}

export async function loadAdminImportBatches(query: ImportBatchListQuery) {
  await requireRole('admin');
  const result = await new ListImportBatches(createRepository()).execute(query);
  return { ...result, items: result.items.map(batchDto) };
}

export async function loadAdminImportBatch(batchId: string): Promise<ImportBatchDetailsDto | null> {
  await requireRole('admin');
  if (!/^\d+$/u.test(batchId)) return null;
  const batch = await new GetImportBatch(createRepository()).execute(batchId);
  if (!batch) return null;
  return {
    ...batchDto(batch),
    notes: batch.notes,
    documents: batch.documents.map((document) => ({
      id: document.id,
      originalFileName: document.originalFileName,
      fileSizeBytes: document.fileSizeBytes,
      contentSha256: document.contentSha256,
      pageCount: document.pageCount,
      status: document.status,
      sourceOrder: document.sourceOrder,
      documentRole: document.documentRole,
      lockVersion: document.lockVersion,
    })),
  };
}

export async function createAdminImportDocumentSignedUrl(
  documentId: string,
): Promise<string | null> {
  await requireRole('admin');
  if (!/^\d+$/u.test(documentId)) return null;
  return createRepository().createDocumentSignedUrl(
    documentId,
    IMPORT_ENGINE_SIGNED_URL_TTL_SECONDS,
  );
}

export async function updateAdminImportDocumentRole(input: {
  readonly documentId: string;
  readonly role: string;
  readonly expectedLockVersion: number;
}) {
  const { profile } = await requireRole('admin');
  if (!/^\d+$/u.test(input.documentId) || !isImportDocumentRole(input.role))
    throw new Error('INVALID_INPUT');
  return createRepository().updateDocumentRole({
    documentId: input.documentId,
    role: input.role,
    expectedLockVersion: input.expectedLockVersion,
    actorId: profile.id,
    correlationId: randomUUID(),
  });
}

export async function rejectAdminImportDocument(input: {
  readonly documentId: string;
  readonly expectedLockVersion: number;
  readonly reason: string;
}) {
  const { profile } = await requireRole('admin');
  if (!/^\d+$/u.test(input.documentId) || !input.reason.trim()) throw new Error('INVALID_INPUT');
  return createRepository().rejectDocument({
    documentId: input.documentId,
    expectedLockVersion: input.expectedLockVersion,
    reason: input.reason.trim(),
    actorId: profile.id,
    correlationId: randomUUID(),
  });
}

export async function archiveAdminImportBatch(input: {
  readonly batchId: string;
  readonly expectedLockVersion: number;
  readonly reason: string;
}) {
  const { profile } = await requireRole('admin');
  if (!/^\d+$/u.test(input.batchId) || !input.reason.trim()) throw new Error('INVALID_INPUT');
  await createRepository().archiveBatch({
    batchId: input.batchId,
    expectedLockVersion: input.expectedLockVersion,
    reason: input.reason.trim(),
    actorId: profile.id,
    correlationId: randomUUID(),
  });
}
