import 'server-only';

import Ajv2020 from 'ajv/dist/2020.js';

import type {
  CommercialDocumentMapV1,
  ImportBatchDetails,
  SegmentedArtifactManifest,
  SegmentedExtractionSource,
  StructuredExtractionProvider,
  StructuredExtractionSourceSession,
  StructuredExtractionUsage,
} from '@compra-car/core';
import { createCommercialExtractionUnitPlan } from '@compra-car/core/commercial-document-map-planner';
import { canonicalizeCommercialDocumentMapIds } from '@compra-car/core/commercial-document-map-canonicalizer';
import { commercialDocumentMapSchemaV1 } from '@compra-car/core/commercial-document-map-schema';
import {
  CommercialDocumentMapValidationError,
  validateCommercialDocumentMap,
  type CommercialDocumentMapViolationCategory,
  type CommercialDocumentMapViolationDiagnostic,
} from '@compra-car/core/commercial-document-map-validator';
import { commercialDocumentExtractionSchemaV1 } from '@compra-car/core/commercial-document-extraction-schema';
import {
  CommercialDocumentExtractionValidationError,
  sanitizeCommercialDocumentExtractionAjvErrors,
} from '@compra-car/core/commercial-document-extraction-validator';
import {
  COMMERCIAL_DOCUMENT_RECONCILIATION_VERSION,
  reconcileCommercialDocumentExtractions,
} from '@compra-car/core/commercial-document-reconciliation';
import {
  reconcileCommercialDocumentSemantics,
  SEMANTIC_COMMERCIAL_DOCUMENT_VERSION,
} from '@compra-car/core/commercial-document-semantic-reconciliation';
import {
  COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_VERSION,
  mapCommercialDocumentToDomain,
} from '@compra-car/core/commercial-document-domain-mapping';
import { resolveCommercialDocumentPeriod } from '@compra-car/core/commercial-document-period-resolution';
import {
  executeSegmentedExtraction,
  type SegmentedExtractionUnitValidationObservation,
} from '@compra-car/core/segmented-extraction-orchestrator';
import {
  publishPersistedSegmentedArtifact,
  SegmentedArtifactSupabaseManifestAdapter,
  SegmentedArtifactSupabaseStorageAdapter,
  type SegmentedArtifactPersistenceContext,
} from '@compra-car/adapter-supabase';
import {
  createOpenAIStructuredOutputProjection,
  projectCanonicalValueForOpenAITransport,
  reconstructCanonicalValueFromOpenAITransport,
} from './openai-structured-output-schema';

export const DOCUMENT_MAP_PROMPT_VERSION = '1' as const;
export const openAITransportDocumentMapSchema = createOpenAIStructuredOutputProjection(
  commercialDocumentMapSchemaV1,
);
export const openAITransportDocumentExtractionSchema = createOpenAIStructuredOutputProjection(
  commercialDocumentExtractionSchemaV1,
);
const extractionTransportAjv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false,
});
const validateExtractionTransportSchema = extractionTransportAjv.compile(
  openAITransportDocumentExtractionSchema,
);
const validateExtractionTransport = (value: unknown): void => {
  const transport = projectCanonicalValueForOpenAITransport(
    value,
    commercialDocumentExtractionSchemaV1,
  );
  if (!validateExtractionTransportSchema(transport))
    throw new CommercialDocumentExtractionValidationError(
      sanitizeCommercialDocumentExtractionAjvErrors(validateExtractionTransportSchema.errors),
    );
};

export interface SegmentedRuntimeArtifact {
  readonly manifest: SegmentedArtifactManifest;
  readonly body: unknown;
}

export interface SegmentedRuntimeArtifactStore {
  load(input: {
    readonly batchId: string;
    readonly jobId: string;
    readonly stage: SegmentedArtifactManifest['stage'];
    readonly documentId?: string;
    readonly unitId?: string;
  }): Promise<SegmentedRuntimeArtifact | undefined>;
  publish(input: {
    readonly artifactSchemaVersion: string;
    readonly batchId: string;
    readonly jobId: string;
    readonly documentId?: string;
    readonly unitId?: string;
    readonly stage: SegmentedArtifactManifest['stage'];
    readonly attempt: number;
    readonly correlationId: string;
    readonly sourceArtifacts: readonly SegmentedArtifactManifest[];
    readonly body: unknown;
    readonly provider?: SegmentedArtifactManifest['provider'];
  }): Promise<SegmentedRuntimeArtifact>;
}

export interface SegmentedImportRuntimeSummary {
  readonly mode: 'segmented';
  readonly artifacts: readonly SegmentedArtifactManifest[];
  readonly unitCount: number;
  readonly reusedArtifactCount: number;
  readonly usage: StructuredExtractionUsage;
  readonly providerRunIds: readonly string[];
  readonly cleanup: 'succeeded' | 'failed';
}

export interface SegmentedImportRuntimeResult {
  readonly payloads: readonly unknown[];
  readonly summary: SegmentedImportRuntimeSummary;
}

export interface SegmentedDocumentMapValidationObservation {
  readonly totalViolations: number;
  readonly sampledViolations: readonly CommercialDocumentMapViolationDiagnostic[];
  readonly truncated: boolean;
  readonly categories: Readonly<Record<string, number>>;
  readonly broadCategories: Readonly<Record<CommercialDocumentMapViolationCategory, number>>;
}

export type { SegmentedExtractionUnitValidationObservation };

export function createPersistedSegmentedRuntimeArtifactStore(
  context: SegmentedArtifactPersistenceContext,
): SegmentedRuntimeArtifactStore {
  const manifests = new SegmentedArtifactSupabaseManifestAdapter(context);
  const storage = new SegmentedArtifactSupabaseStorageAdapter();
  return {
    async load(selector) {
      const manifest = await manifests.latestSucceeded(selector);
      if (!manifest) return undefined;
      const bytes = await storage.read(manifest.storage);
      return { manifest, body: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
    },
    async publish(value) {
      const startedAt = new Date().toISOString();
      const result = await publishPersistedSegmentedArtifact(
        {
          ...value,
          artifactVersion: 1,
          createdAt: startedAt,
          startedAt,
          completedAt: new Date().toISOString(),
        },
        {
          manifests,
          storage,
          // Artifact RPCs already append the durable, body-free audit events.
          audit: { append: async () => undefined },
        },
      );
      if (result.status !== 'succeeded') throw new Error('ARTIFACT_PERSISTENCE_FAILED');
      return { manifest: result.manifest, body: value.body };
    },
  };
}

const mapInstructions = `Create only a brand-agnostic CommercialDocumentMap/1 inventory of the supplied PDF.
Describe documents, pages, content blocks, sections, tables, notes, entity hints and explicit context edges.
Use stable local IDs with the schema prefixes. Preserve ambiguity and evidence locations.
Do not perform product matching or domain mapping. Do not return Product IDs, Policies, Offers, promotion data, URLs, file IDs, credentials or chain-of-thought.`;

const zeroUsage = (): StructuredExtractionUsage => ({
  inputUnits: 0,
  outputUnits: 0,
  totalUnits: 0,
});
const addUsage = (left: StructuredExtractionUsage, right: StructuredExtractionUsage) => ({
  inputUnits: left.inputUnits + right.inputUnits,
  outputUnits: left.outputUnits + right.outputUnits,
  totalUnits: left.totalUnits + right.totalUnits,
});

const assertBody = <T>(
  artifact: SegmentedRuntimeArtifact,
  validate?: (body: unknown) => void,
): T => {
  validate?.(artifact.body);
  return artifact.body as T;
};

export async function executeSegmentedImportRuntime(input: {
  readonly batch: ImportBatchDetails;
  readonly jobId: string;
  readonly attempt: number;
  readonly correlationId: string;
  readonly source: SegmentedExtractionSource;
  readonly provider: StructuredExtractionProvider;
  readonly artifacts: SegmentedRuntimeArtifactStore;
  readonly diagnostics?: boolean;
  readonly observeDocumentMapValidation?: (
    observation: SegmentedDocumentMapValidationObservation,
  ) => void;
  readonly observeUnitExtractionValidation?: (
    observation: SegmentedExtractionUnitValidationObservation,
  ) => void;
}): Promise<SegmentedImportRuntimeResult> {
  if (input.source.documents.length !== 1) throw new Error('SEGMENTED_PRIMARY_DOCUMENT_REQUIRED');
  const documentId = input.source.documents[0]!.documentId;
  const manifests: SegmentedArtifactManifest[] = [];
  const providerRunIds: string[] = [];
  let usage = zeroUsage();
  let reusedArtifactCount = 0;
  let session: StructuredExtractionSourceSession | undefined;
  let cleanup: 'succeeded' | 'failed' = 'succeeded';
  const validateDocumentMap = (body: unknown): void => {
    try {
      validateCommercialDocumentMap(body);
    } catch (error) {
      if (input.diagnostics && error instanceof CommercialDocumentMapValidationError) {
        const observation = {
          totalViolations: error.totalViolations,
          sampledViolations: error.diagnostics,
          truncated: error.truncated,
          categories: error.keywordCounts,
          broadCategories: error.categoryCounts,
        } satisfies SegmentedDocumentMapValidationObservation;
        if (input.observeDocumentMapValidation) input.observeDocumentMapValidation(observation);
        else console.warn('SEGMENTED_DOCUMENT_MAP_VALIDATION', observation);
      }
      throw error;
    }
  };

  const get = async <T>(
    stage: SegmentedArtifactManifest['stage'],
    schemaVersion: string,
    build: () => Promise<{ body: T; provider?: SegmentedArtifactManifest['provider'] }>,
    sources: readonly SegmentedRuntimeArtifact[],
    unitId?: string,
    validate?: (body: unknown) => void,
  ): Promise<SegmentedRuntimeArtifact> => {
    const replay = await input.artifacts.load({
      batchId: input.batch.id,
      jobId: input.jobId,
      stage,
      documentId,
      ...(unitId ? { unitId } : {}),
    });
    if (replay) {
      assertBody<T>(replay, validate);
      manifests.push(replay.manifest);
      reusedArtifactCount += 1;
      return replay;
    }
    const value = await build();
    validate?.(value.body);
    const created = await input.artifacts.publish({
      artifactSchemaVersion: schemaVersion,
      batchId: input.batch.id,
      jobId: input.jobId,
      documentId,
      ...(unitId ? { unitId } : {}),
      stage,
      attempt: input.attempt,
      correlationId: input.correlationId,
      sourceArtifacts: sources.map((item) => item.manifest),
      body: value.body,
      ...(value.provider ? { provider: value.provider } : {}),
    });
    manifests.push(created.manifest);
    return created;
  };

  try {
    const existingMap = await input.artifacts.load({
      batchId: input.batch.id,
      jobId: input.jobId,
      stage: 'document_map',
      documentId,
    });
    if (!existingMap) {
      session = await input.provider.openSource(input.source, {
        signal: new AbortController().signal,
        correlationId: input.correlationId,
      });
    }
    const mapArtifact = await get<CommercialDocumentMapV1>(
      'document_map',
      'CommercialDocumentMap/1',
      async () => {
        const response = await session!.extractStructured({
          instructions: mapInstructions,
          schemaName: 'commercial_document_map_v1',
          schema: openAITransportDocumentMapSchema,
          signal: new AbortController().signal,
          metadata: {
            correlationId: input.correlationId,
            promptVersion: DOCUMENT_MAP_PROMPT_VERSION,
            schemaVersion: 'CommercialDocumentMap/1',
          },
        });
        usage = addUsage(usage, response.usage);
        providerRunIds.push(response.providerRunId);
        const reconstructed = reconstructCanonicalValueFromOpenAITransport(
          response.output,
          commercialDocumentMapSchemaV1,
        ) as CommercialDocumentMapV1;
        return {
          body: canonicalizeCommercialDocumentMapIds(reconstructed, {
            sourceDocumentOrdinals: input.source.documents.map((document) => document.ordinal),
          }),
          provider: {
            providerKey: 'structured',
            providerVersion: '1',
            promptVersion: DOCUMENT_MAP_PROMPT_VERSION,
            providerRunId: response.providerRunId,
            ...response.usage,
          },
        };
      },
      [],
      undefined,
      validateDocumentMap,
    );
    const documentMap = assertBody<CommercialDocumentMapV1>(mapArtifact, validateDocumentMap);
    const planArtifact = await get(
      'unit_plan',
      'CommercialExtractionUnitPlan/1',
      async () => ({ body: createCommercialExtractionUnitPlan(documentMap) }),
      [mapArtifact],
    );
    const unitPlan = planArtifact.body as ReturnType<typeof createCommercialExtractionUnitPlan>;

    const missingUnits = [];
    const unitArtifacts = new Map<string, SegmentedRuntimeArtifact>();
    for (const unit of unitPlan.units) {
      const replay = await input.artifacts.load({
        batchId: input.batch.id,
        jobId: input.jobId,
        stage: 'unit_extraction',
        documentId,
        unitId: unit.unitId,
      });
      if (replay) {
        unitArtifacts.set(unit.unitId, replay);
        manifests.push(replay.manifest);
        reusedArtifactCount += 1;
      } else missingUnits.push(unit);
    }
    if (missingUnits.length) {
      session ??= await input.provider.openSource(input.source, {
        signal: new AbortController().signal,
        correlationId: input.correlationId,
      });
      const extraction = await executeSegmentedExtraction(
        { documentMap, unitPlan, source: input.source, correlationId: input.correlationId },
        {
          provider: input.provider,
          sourceSession: session,
          unitIds: missingUnits.map((unit) => unit.unitId),
          schema: openAITransportDocumentExtractionSchema,
          decodeTransport: (value) =>
            reconstructCanonicalValueFromOpenAITransport(
              value,
              commercialDocumentExtractionSchemaV1,
            ),
          validateTransport: validateExtractionTransport,
          diagnostics: input.diagnostics,
          observeUnitValidation: (observation) => {
            if (input.observeUnitExtractionValidation)
              input.observeUnitExtractionValidation(observation);
            else console.warn('SEGMENTED_UNIT_EXTRACTION_VALIDATION', observation);
          },
        },
      );
      const failed = extraction.unitResults.find((item) => item.status === 'failed');
      if (failed) throw new Error(`UNIT_EXTRACTION_${failed.code}`);
      for (const result of extraction.unitResults) {
        if (result.status !== 'succeeded') continue;
        usage = addUsage(usage, result.usage);
        providerRunIds.push(result.providerRunId);
        const artifact = await get(
          'unit_extraction',
          'CommercialDocumentExtraction/1',
          async () => ({
            body: result.artifact,
            provider: {
              providerKey: 'structured',
              providerVersion: '1',
              promptVersion: extraction.promptVersion,
              providerRunId: result.providerRunId,
              durationMs: result.durationMs,
              ...result.usage,
            },
          }),
          [planArtifact],
          result.unitId,
        );
        unitArtifacts.set(result.unitId, artifact);
      }
    }
    const orderedUnits = unitPlan.units.map((unit) => unitArtifacts.get(unit.unitId)!);
    const mergeArtifact = await get(
      'merge',
      COMMERCIAL_DOCUMENT_RECONCILIATION_VERSION,
      async () => ({
        body: reconcileCommercialDocumentExtractions({
          documentMap,
          unitPlan,
          artifacts: unitPlan.units.map((unit) => ({
            artifactId: unitArtifacts.get(unit.unitId)!.manifest.artifactId,
            unitId: unit.unitId,
            ordinal: unit.ordinal,
            artifact: unitArtifacts.get(unit.unitId)!.body as never,
          })),
        }),
      }),
      orderedUnits,
    );
    const semanticArtifact = await get(
      'semantic_reconciliation',
      SEMANTIC_COMMERCIAL_DOCUMENT_VERSION,
      async () => ({
        body: reconcileCommercialDocumentSemantics({ foundation: mergeArtifact.body as never }),
      }),
      [mergeArtifact],
    );
    const commercialPeriod = resolveCommercialDocumentPeriod({
      batchCompetence: input.batch.competence,
      semanticDocument: semanticArtifact.body as never,
    });
    if (commercialPeriod.status !== 'resolved')
      throw new Error('DOMAIN_MAPPING_PERIOD_UNAVAILABLE');
    const domainArtifact = await get(
      'domain_mapping',
      COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_VERSION,
      async () => ({
        body: mapCommercialDocumentToDomain({
          semanticDocument: semanticArtifact.body as never,
          sources: [
            ...new Map(
              orderedUnits.flatMap((artifact) =>
                (
                  artifact.body as {
                    readonly documents: readonly {
                      readonly documentId: string;
                      readonly ordinal: number;
                    }[];
                  }
                ).documents.map((document) => {
                  const original = input.batch.documents.find(
                    (candidate) => candidate.sourceOrder === document.ordinal,
                  );
                  if (!original) throw new Error('DOMAIN_MAPPING_SOURCE_UNAVAILABLE');
                  return [
                    document.documentId,
                    {
                      documentId: document.documentId,
                      ordinal: original.sourceOrder,
                      originalFileName: original.originalFileName,
                    },
                  ] as const;
                }),
              ),
            ).values(),
          ],
          commercialPeriod: commercialPeriod.period,
        }),
      }),
      [semanticArtifact],
    );
    const domain = domainArtifact.body as ReturnType<typeof mapCommercialDocumentToDomain>;
    if (!domain.rows.length) throw new Error('DOMAIN_MAPPING_BLOCKED');
    return {
      payloads: domain.rows,
      summary: {
        mode: 'segmented',
        artifacts: manifests,
        unitCount: unitPlan.units.length,
        reusedArtifactCount,
        usage,
        providerRunIds,
        cleanup,
      },
    };
  } finally {
    if (session) {
      try {
        await session.close();
      } catch {
        cleanup = 'failed';
      }
    }
  }
}
