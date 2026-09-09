import 'server-only';

import { createHash } from 'node:crypto';

import Ajv2020 from 'ajv/dist/2020.js';

import type {
  CommercialDocumentExtractionV1,
  CommercialDocumentMapV1,
  CommercialExtractionUnitPlanV1,
  CommercialTableIRV1,
  CommercialCalibrationBudget,
  CommercialUnitCoalescingDiagnostic,
  ProviderCallEfficiencyObservation,
  ImportBatchDetails,
  SegmentedArtifactManifest,
  SegmentedExtractionSource,
  StructuredExtractionProvider,
  StructuredExtractionSourceSession,
  StructuredExtractionUsage,
} from '@compra-car/core';
import { createCommercialExtractionUnitPlan } from '@compra-car/core/commercial-document-map-planner';
import {
  coalesceCommercialExtractionUnitPlan,
  createCommercialCalibrationBudgetGuard,
  measureProviderCall,
} from '@compra-car/core/commercial-extraction-efficiency';
import {
  canonicalizeCommercialDocumentMapIds,
  CommercialDocumentMapCanonicalizationError,
  type CommercialDocumentMapCanonicalizationDiagnostic,
  type CommercialDocumentMapCanonicalizationFailureCategory,
} from '@compra-car/core/commercial-document-map-canonicalizer';
import { commercialDocumentMapSchemaV1 } from '@compra-car/core/commercial-document-map-schema';
import {
  CommercialDocumentMapValidationError,
  sanitizeCommercialDocumentMapAjvErrors,
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
  type CommercialDocumentReconciliationResult,
} from '@compra-car/core/commercial-document-reconciliation';
import {
  reconcileCommercialDocumentSemantics,
  SEMANTIC_COMMERCIAL_DOCUMENT_VERSION,
  type SemanticallyReconciledCommercialDocument,
} from '@compra-car/core/commercial-document-semantic-reconciliation';
import {
  COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_VERSION,
  mapCommercialDocumentToDomain,
} from '@compra-car/core/commercial-document-domain-mapping';
import { resolveCommercialDocumentPeriod } from '@compra-car/core/commercial-document-period-resolution';
import {
  executeSegmentedExtraction,
  selectPrimarySegmentedExtractionFailure,
  type SegmentedExtractionUnitYearDiagnosticObservation,
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
  reconstructCanonicalValueFromOpenAITransport,
} from './openai-structured-output-schema';

export const DOCUMENT_MAP_PROMPT_VERSION = '5' as const;
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
const documentMapTransportAjv = new Ajv2020({ allErrors: true, strict: true });
export const validateDocumentMapTransportSchema = documentMapTransportAjv.compile(
  openAITransportDocumentMapSchema,
);
const validateDocumentMapTransport = (value: unknown): void => {
  if (!validateDocumentMapTransportSchema(value))
    throw new CommercialDocumentMapValidationError(
      sanitizeCommercialDocumentMapAjvErrors(validateDocumentMapTransportSchema.errors),
    );
};
export const validateExtractionTransportSchema = extractionTransportAjv.compile(
  openAITransportDocumentExtractionSchema,
);
const validateExtractionTransport = (value: unknown): void => {
  if (!validateExtractionTransportSchema(value))
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
  readonly documentMap?: CommercialDocumentMapV1;
  readonly documentary?: SegmentedDocumentaryRuntimeResult;
}

export class SegmentedImportPartialFailure extends Error {
  readonly completedUnitIds: readonly string[];
  readonly pendingUnitIds: readonly string[];
  readonly failedUnitId: string;
  readonly failureCode: string;

  constructor(input: {
    readonly completedUnitIds: readonly string[];
    readonly pendingUnitIds: readonly string[];
    readonly failedUnitId: string;
    readonly failureCode: string;
  }) {
    super(`UNIT_EXTRACTION_${input.failureCode}`);
    this.name = 'SegmentedImportPartialFailure';
    this.completedUnitIds = [...input.completedUnitIds];
    this.pendingUnitIds = [...input.pendingUnitIds];
    this.failedUnitId = input.failedUnitId;
    this.failureCode = input.failureCode;
  }

  toJSON() {
    return {
      code: this.message,
      failureCode: this.failureCode,
      completedUnitIds: this.completedUnitIds,
      pendingUnitIds: this.pendingUnitIds,
      failedUnitId: this.failedUnitId,
    };
  }
}

export interface SegmentedDocumentaryRuntimeResult {
  readonly documentMap: CommercialDocumentMapV1;
  readonly unitPlan: CommercialExtractionUnitPlanV1;
  readonly unitExtractions: readonly CommercialDocumentExtractionV1[];
  readonly reconciliation: CommercialDocumentReconciliationResult;
  readonly semanticReconciliation: SemanticallyReconciledCommercialDocument;
}

export interface SegmentedDocumentMapValidationObservation {
  readonly totalViolations: number;
  readonly sampledViolations: readonly CommercialDocumentMapViolationDiagnostic[];
  readonly truncated: boolean;
  readonly categories: Readonly<Record<string, number>>;
  readonly broadCategories: Readonly<Record<CommercialDocumentMapViolationCategory, number>>;
}

export interface SegmentedDocumentMapCanonicalizationObservation {
  readonly totalViolations: number;
  readonly categories: Readonly<
    Partial<Record<CommercialDocumentMapCanonicalizationFailureCategory, number>>
  >;
  readonly sampledViolations: readonly CommercialDocumentMapCanonicalizationDiagnostic[];
  readonly truncated: boolean;
}

export type SegmentedDocumentMapDiagnosticStage =
  'raw_structured_output' | 'reconstructed' | 'pre_canonicalization' | 'canonicalized';

export type SegmentedDocumentMapMetadataCollection =
  'titleHints' | 'issuerHints' | 'competenceHints' | 'validityHints';

export interface SegmentedDocumentMapMetadataReferenceObservation {
  readonly path: string;
  readonly idFingerprint: string;
  readonly definitionExists: boolean;
}

export interface SegmentedDocumentMapMetadataHintObservation {
  readonly documentIndex: number;
  readonly hintIndex: number;
  readonly sourceBlockCount: number;
  readonly references: readonly SegmentedDocumentMapMetadataReferenceObservation[];
}

export interface SegmentedDocumentMapMetadataCollectionObservation {
  readonly hintCount: number;
  readonly referenceCount: number;
  readonly orphanCount: number;
  readonly hints: readonly SegmentedDocumentMapMetadataHintObservation[];
}

export interface SegmentedDocumentMapMetadataAuditObservation {
  readonly stage: SegmentedDocumentMapDiagnosticStage;
  readonly definitionCounts: Readonly<{
    documents: number;
    pages: number;
    contentBlocks: number;
    sections: number;
    tables: number;
    notes: number;
    entityHints: number;
    contextEdges: number;
  }>;
  readonly collections: Readonly<
    Record<
      SegmentedDocumentMapMetadataCollection,
      SegmentedDocumentMapMetadataCollectionObservation
    >
  >;
  readonly orphanCount: number;
}

export type {
  SegmentedExtractionUnitValidationObservation,
  SegmentedExtractionUnitYearDiagnosticObservation,
};

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
Always emit every required collection from the schema. Use [] when a required collection has no supported entries; never omit a required collection or invent an entry merely to avoid an empty collection. For every document, always emit titleHints, issuerHints, competenceHints and validityHints. Return [] for a hint collection when no supported candidate exists.
Every local reference must resolve to a real object emitted in the same map. Never reference a block, page, section, table, note, entity hint or context edge that you did not emit. A document metadata hint requires at least one real sourceBlockIds entry resolving to an emitted content block; if no source block is identifiable, omit the hint instead of inventing an ID. Never create placeholder definitions solely to satisfy references.
Before returning, perform a referential-closure check: every referenced local ID must have a corresponding definition in the same artifact. Apply this exact check to metadata hint sourceBlockIds, page refs, section refs, table refs, note refs, entity hint refs and both sides of every context edge. Keep IDs model-local; do not rewrite them to canonical server IDs.
Create a table only when at least one real header block is identifiable. Every table.headerBlockIds must contain at least one real TABLE_REGION or HEADING content block from that table. If no header is identifiable, represent the region with the appropriate content blocks and sections instead of creating an invalid table. A continued table remains one logical table: keep its original headerBlockIds and use inheritedHeaderBlockIds on CONTINUE segments.
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

const objectValue = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === 'object' ? (value as Readonly<Record<string, unknown>>) : {};
const arrayValue = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);
const idFingerprint = (value: unknown): string =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : `${typeof value}:${String(value)}`)
    .digest('hex')
    .slice(0, 16);
const metadataCollections: readonly SegmentedDocumentMapMetadataCollection[] = [
  'titleHints',
  'issuerHints',
  'competenceHints',
  'validityHints',
];

export function auditDocumentMapMetadataReferences(
  value: unknown,
  stage: SegmentedDocumentMapDiagnosticStage,
): SegmentedDocumentMapMetadataAuditObservation {
  const root = objectValue(value);
  const definitions = new Set(
    arrayValue(root.contentBlocks)
      .map((block) => objectValue(block).contentBlockId)
      .filter((id): id is string => typeof id === 'string'),
  );
  const documents = arrayValue(root.documents);
  const collections = Object.fromEntries(
    metadataCollections.map((collection) => {
      const hints = documents.flatMap((document, documentIndex) =>
        arrayValue(objectValue(document)[collection]).map((hint, hintIndex) => {
          const references = arrayValue(objectValue(hint).sourceBlockIds).map(
            (id, referenceIndex) => ({
              path: `/documents/${documentIndex}/${collection}/${hintIndex}/sourceBlockIds/${referenceIndex}`,
              idFingerprint: idFingerprint(id),
              definitionExists: typeof id === 'string' && definitions.has(id),
            }),
          );
          return {
            documentIndex,
            hintIndex,
            sourceBlockCount: references.length,
            references,
          };
        }),
      );
      const references = hints.flatMap((hint) => hint.references);
      return [
        collection,
        {
          hintCount: hints.length,
          referenceCount: references.length,
          orphanCount: references.filter((reference) => !reference.definitionExists).length,
          hints,
        },
      ];
    }),
  ) as unknown as Record<
    SegmentedDocumentMapMetadataCollection,
    SegmentedDocumentMapMetadataCollectionObservation
  >;
  return {
    stage,
    definitionCounts: {
      documents: documents.length,
      pages: arrayValue(root.pages).length,
      contentBlocks: definitions.size,
      sections: arrayValue(root.sections).length,
      tables: arrayValue(root.tables).length,
      notes: arrayValue(root.notes).length,
      entityHints: arrayValue(root.entityHints).length,
      contextEdges: arrayValue(root.contextEdges).length,
    },
    collections,
    orphanCount: metadataCollections.reduce(
      (count, collection) => count + collections[collection].orphanCount,
      0,
    ),
  };
}

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
  readonly stopAfter?: 'document_map' | 'semantic_reconciliation';
  readonly diagnostics?: boolean;
  readonly observeDocumentMapValidation?: (
    observation: SegmentedDocumentMapValidationObservation,
  ) => void;
  readonly observeDocumentMapCanonicalization?: (
    observation: SegmentedDocumentMapCanonicalizationObservation,
  ) => void;
  readonly observeDocumentMapMetadataReferences?: (
    observation: SegmentedDocumentMapMetadataAuditObservation,
  ) => void;
  readonly observeUnitExtractionValidation?: (
    observation: SegmentedExtractionUnitValidationObservation,
  ) => void;
  readonly observeUnitExtractionYears?: (
    observation: SegmentedExtractionUnitYearDiagnosticObservation,
  ) => void;
  readonly efficiency?: {
    readonly enabled: true;
    readonly concurrency?: number;
    readonly commercialTableIRByUnitId?: Readonly<Record<string, CommercialTableIRV1>>;
    readonly budget?: CommercialCalibrationBudget & {
      readonly initialCalls?: number;
      readonly initialEstimatedTokens?: number;
    };
    readonly estimatedSourceTokensPerAttachedRequest?: number;
    readonly observeCoalescing?: (
      diagnostics: readonly CommercialUnitCoalescingDiagnostic[],
    ) => void;
    readonly observeProviderCall?: (observation: ProviderCallEfficiencyObservation) => void;
  };
}): Promise<SegmentedImportRuntimeResult> {
  if (input.source.documents.length !== 1) throw new Error('SEGMENTED_PRIMARY_DOCUMENT_REQUIRED');
  const documentId = input.source.documents[0]!.documentId;
  const manifests: SegmentedArtifactManifest[] = [];
  const providerRunIds: string[] = [];
  let usage = zeroUsage();
  let reusedArtifactCount = 0;
  let session: StructuredExtractionSourceSession | undefined;
  let cleanup: 'succeeded' | 'failed' = 'succeeded';
  const calibrationBudgetGuard = input.efficiency?.budget
    ? createCommercialCalibrationBudgetGuard(input.efficiency.budget, {
        calls: input.efficiency.budget.initialCalls ?? 0,
        estimatedTokens: input.efficiency.budget.initialEstimatedTokens ?? 0,
      })
    : undefined;
  const observeDocumentMapValidation = (validation: () => void): void => {
    try {
      validation();
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
  const validateDocumentMap = (body: unknown): void =>
    observeDocumentMapValidation(() => validateCommercialDocumentMap(body));
  const validateDocumentMapWire = (body: unknown): void =>
    observeDocumentMapValidation(() => validateDocumentMapTransport(body));
  const canonicalizeDocumentMap = (body: CommercialDocumentMapV1): CommercialDocumentMapV1 => {
    if (input.diagnostics && input.observeDocumentMapMetadataReferences)
      input.observeDocumentMapMetadataReferences(
        auditDocumentMapMetadataReferences(body, 'pre_canonicalization'),
      );
    try {
      const canonical = canonicalizeCommercialDocumentMapIds(body, {
        sourceDocumentOrdinals: input.source.documents.map((document) => document.ordinal),
      });
      if (input.diagnostics && input.observeDocumentMapMetadataReferences)
        input.observeDocumentMapMetadataReferences(
          auditDocumentMapMetadataReferences(canonical, 'canonicalized'),
        );
      return canonical;
    } catch (error) {
      if (input.diagnostics && error instanceof CommercialDocumentMapCanonicalizationError) {
        const sampleLimit = 30;
        const categories = Object.fromEntries(
          [...new Set(error.diagnostics.map((diagnostic) => diagnostic.category))].map(
            (category) => [
              category,
              error.diagnostics.filter((diagnostic) => diagnostic.category === category).length,
            ],
          ),
        ) as Partial<Record<CommercialDocumentMapCanonicalizationFailureCategory, number>>;
        const observation = {
          totalViolations: error.diagnostics.length,
          categories,
          sampledViolations: error.diagnostics.slice(0, sampleLimit),
          truncated: error.diagnostics.length > sampleLimit,
        } satisfies SegmentedDocumentMapCanonicalizationObservation;
        if (input.observeDocumentMapCanonicalization)
          input.observeDocumentMapCanonicalization(observation);
        else console.warn('SEGMENTED_DOCUMENT_MAP_CANONICALIZATION', observation);
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
        const requestOrdinal = (calibrationBudgetGuard?.snapshot().calls ?? 0) + 1;
        const planned = measureProviderCall({
          stage: 'document_map',
          pages: [],
          requestOrdinal,
          promptVersion: DOCUMENT_MAP_PROMPT_VERSION,
          instructions: mapInstructions,
          schema: openAITransportDocumentMapSchema,
        });
        const plannedWithSource = {
          ...planned,
          estimatedInputTokens:
            planned.estimatedInputTokens +
            (input.efficiency?.estimatedSourceTokensPerAttachedRequest ?? 0),
        };
        calibrationBudgetGuard?.reserve(plannedWithSource.estimatedInputTokens);
        const providerStartedAt = Date.now();
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
        input.efficiency?.observeProviderCall?.({
          ...plannedWithSource,
          actualInputTokens: response.usage.inputUnits,
          outputTokens: response.usage.outputUnits,
          totalTokens: response.usage.totalUnits,
          elapsedMs: Date.now() - providerStartedAt,
        });
        validateDocumentMapWire(response.output);
        if (input.diagnostics && input.observeDocumentMapMetadataReferences)
          input.observeDocumentMapMetadataReferences(
            auditDocumentMapMetadataReferences(response.output, 'raw_structured_output'),
          );
        const reconstructed = reconstructCanonicalValueFromOpenAITransport(
          response.output,
          commercialDocumentMapSchemaV1,
        ) as CommercialDocumentMapV1;
        if (input.diagnostics && input.observeDocumentMapMetadataReferences)
          input.observeDocumentMapMetadataReferences(
            auditDocumentMapMetadataReferences(reconstructed, 'reconstructed'),
          );
        return {
          body: canonicalizeDocumentMap(reconstructed),
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
    if (input.stopAfter === 'document_map')
      return {
        payloads: [],
        documentMap,
        summary: {
          mode: 'segmented',
          artifacts: manifests,
          unitCount: 0,
          reusedArtifactCount,
          usage,
          providerRunIds,
          cleanup,
        },
      };
    const planArtifact = await get(
      'unit_plan',
      'CommercialExtractionUnitPlan/1',
      async () => {
        const basePlan = createCommercialExtractionUnitPlan(documentMap);
        if (!input.efficiency?.enabled) return { body: basePlan };
        const coalesced = coalesceCommercialExtractionUnitPlan({
          map: documentMap,
          plan: basePlan,
        });
        input.efficiency.observeCoalescing?.(coalesced.diagnostics);
        return { body: coalesced.plan };
      },
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
          observeUnitYearDiagnostic: input.observeUnitExtractionYears,
          ...(input.efficiency?.concurrency === undefined
            ? {}
            : { concurrency: input.efficiency.concurrency }),
          ...(input.efficiency?.commercialTableIRByUnitId
            ? {
                buildUnitDocumentContext: (context) => {
                  const ir = input.efficiency!.commercialTableIRByUnitId?.[context.unit.unitId];
                  if (!ir) throw new Error('COMMERCIAL_TABLE_IR_MISSING_FOR_UNIT');
                  return JSON.stringify(ir);
                },
                includeSourceDocuments: false,
              }
            : {}),
          ...(input.efficiency?.budget
            ? {
                budget: {
                  ...input.efficiency.budget,
                  initialCalls: calibrationBudgetGuard?.snapshot().calls ?? 0,
                  initialEstimatedTokens: calibrationBudgetGuard?.snapshot().estimatedTokens ?? 0,
                  estimatedSourceTokensPerRequest:
                    input.efficiency.estimatedSourceTokensPerAttachedRequest ?? 0,
                },
              }
            : {}),
          ...(input.efficiency?.observeProviderCall
            ? { observeProviderCall: input.efficiency.observeProviderCall }
            : {}),
        },
      );
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
      const failed = selectPrimarySegmentedExtractionFailure(extraction.unitResults);
      if (failed) {
        const completedUnitIds = extraction.unitResults
          .filter((result) => result.status === 'succeeded')
          .map((result) => result.unitId)
          .sort();
        const pendingUnitIds = missingUnits
          .map((unit) => unit.unitId)
          .filter((unitId) => unitId !== failed.unitId && !completedUnitIds.includes(unitId))
          .sort();
        throw new SegmentedImportPartialFailure({
          completedUnitIds,
          pendingUnitIds,
          failedUnitId: failed.unitId,
          failureCode: failed.code,
        });
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
    if (input.stopAfter === 'semantic_reconciliation')
      return {
        payloads: [],
        documentary: {
          documentMap,
          unitPlan,
          unitExtractions: orderedUnits.map(
            (artifact) => artifact.body as CommercialDocumentExtractionV1,
          ),
          reconciliation: mergeArtifact.body as CommercialDocumentReconciliationResult,
          semanticReconciliation: semanticArtifact.body as SemanticallyReconciledCommercialDocument,
        },
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
