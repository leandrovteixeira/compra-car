import type { CommercialDocumentExtractionV1 } from './commercial-document-extraction';
import { canonicalizeCommercialDocumentExtractionUnit } from './commercial-document-extraction-canonicalizer';
import {
  CommercialDocumentExtractionValidationError,
  validateCommercialDocumentExtraction,
  type CommercialDocumentExtractionViolationDiagnostic,
} from './commercial-document-extraction-validator';
import type { CommercialDocumentMapV1, CommercialExtractionUnit } from './commercial-document-map';
import {
  validateCommercialDocumentMap,
  validateCommercialExtractionUnitPlan,
} from './commercial-document-map-validator';
import {
  SEGMENTED_EXTRACTION_LIMITS,
  SEGMENTED_EXTRACTION_PROMPT_VERSION,
  SEGMENTED_EXTRACTION_SCHEMA_VERSION,
  type SegmentedExtractionInput,
  type SegmentedExtractionOperationalResult,
  type SegmentedExtractionUnitContext,
  type SegmentedExtractionUnitFailure,
  type SegmentedExtractionUnitResult,
  type StructuredExtractionProvider,
} from './segmented-extraction';
import { COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS } from './commercial-knowledge-calibration';
import {
  measureProviderCall,
  type CommercialCalibrationBudget,
  type ProviderCallEfficiencyObservation,
} from './commercial-extraction-efficiency';

export interface SegmentedExtractionOrchestratorOptions {
  readonly provider: StructuredExtractionProvider;
  readonly sourceSession?: Awaited<ReturnType<StructuredExtractionProvider['openSource']>>;
  readonly closeSourceSession?: boolean;
  readonly unitIds?: readonly string[];
  readonly schema: Readonly<Record<string, unknown>>;
  readonly schemaName?: string;
  readonly concurrency?: number;
  readonly unitTimeoutMs?: number;
  readonly totalTimeoutMs?: number;
  readonly now?: () => number;
  readonly decodeTransport?: (value: unknown) => unknown;
  readonly validateTransport?: (value: unknown) => void;
  readonly diagnostics?: boolean;
  readonly observeUnitValidation?: (
    observation: SegmentedExtractionUnitValidationObservation,
  ) => void;
  readonly observeUnitYearDiagnostic?: (
    observation: SegmentedExtractionUnitYearDiagnosticObservation,
  ) => void;
  readonly buildUnitDocumentContext?: (context: SegmentedExtractionUnitContext) => string;
  readonly includeSourceDocuments?: boolean;
  readonly budget?: CommercialCalibrationBudget & {
    readonly initialCalls?: number;
    readonly initialEstimatedTokens?: number;
    readonly estimatedSourceTokensPerRequest?: number;
  };
  readonly observeProviderCall?: (observation: ProviderCallEfficiencyObservation) => void;
}

export type SegmentedExtractionUnitValidationPhase =
  'transport_decode' | 'transport_validation' | 'canonicalization' | 'canonical_validation';

export interface SegmentedExtractionUnitValidationObservation {
  readonly unitId: string;
  readonly unitOrdinal: number;
  readonly phase: SegmentedExtractionUnitValidationPhase;
  readonly totalViolations: number;
  readonly categories: Readonly<Record<string, number>>;
  readonly sampledViolations: readonly CommercialDocumentExtractionViolationDiagnostic[];
  readonly truncated: boolean;
}

export type SegmentedExtractionUnitYearDiagnosticStage =
  'raw_structured_output' | 'reconstructed' | 'pre_canonicalization' | 'canonical_validation';

export interface SegmentedExtractionUnitYearDiagnosticIdentity {
  readonly identityIndex: number;
  readonly brand?: string;
  readonly model?: string;
  readonly version?: string;
  readonly productionYear: { readonly present: boolean; readonly value?: number };
  readonly modelYear: { readonly present: boolean; readonly value?: number };
  readonly rawYearText: { readonly present: boolean; readonly value?: string };
  readonly evidencePages: readonly number[];
  readonly confidence?: {
    readonly score?: number;
    readonly ambiguous?: boolean;
    readonly requiresReview?: boolean;
    readonly reasons: readonly string[];
  };
}

export interface SegmentedExtractionUnitYearDiagnosticObservation {
  readonly stage: SegmentedExtractionUnitYearDiagnosticStage;
  readonly unitId: string;
  readonly unitOrdinal: number;
  readonly primaryPages: readonly number[];
  readonly contextPages: readonly number[];
  readonly tableIds: readonly string[];
  readonly sectionIds: readonly string[];
  readonly vehicleIdentityCount: number;
  readonly vehicleIdentities: readonly SegmentedExtractionUnitYearDiagnosticIdentity[];
  readonly validation?: {
    readonly status: 'passed' | 'failed';
    readonly totalViolations: number;
    readonly categories: Readonly<Record<string, number>>;
  };
}

const assertIntegerRange = (
  value: number,
  minimum: number,
  maximum: number,
  name: string,
): void => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw new Error(`SEGMENTED_EXTRACTION_INVALID_${name}`);
};

const byIds = <T>(items: readonly T[], ids: readonly string[], getId: (item: T) => string): T[] => {
  const indexed = new Map(items.map((item) => [getId(item), item]));
  return ids.map((id) => indexed.get(id)).filter((item): item is T => item !== undefined);
};

export function buildSegmentedExtractionUnitContext(
  map: CommercialDocumentMapV1,
  unit: CommercialExtractionUnit,
): SegmentedExtractionUnitContext {
  const sourceDocument = map.documents.find((item) => item.documentId === unit.documentId);
  if (!sourceDocument) throw new Error('SEGMENTED_EXTRACTION_UNKNOWN_DOCUMENT');
  const notes = byIds(map.notes, unit.noteIds, (item) => item.noteId);
  const contextEdges = map.contextEdges.filter((edge) =>
    [edge.from.refId, edge.to.refId].some((id) =>
      [
        ...unit.sectionIds,
        ...unit.tableIds,
        ...unit.noteIds,
        ...unit.primaryContentBlockIds,
        ...unit.contextContentBlockIds,
      ].includes(id),
    ),
  );
  const tables = byIds(map.tables, unit.tableIds, (item) => item.tableId);
  return {
    unit,
    sourceDocument,
    primaryPages: byIds(map.pages, unit.primaryPageIds, (item) => item.pageId),
    contextOnlyPages: byIds(map.pages, unit.contextPageIds, (item) => item.pageId),
    primaryContentBlocks: byIds(
      map.contentBlocks,
      unit.primaryContentBlockIds,
      (item) => item.contentBlockId,
    ),
    contextOnlyContentBlocks: byIds(
      map.contentBlocks,
      unit.contextContentBlockIds,
      (item) => item.contentBlockId,
    ),
    tables,
    notes,
    contextEdges,
    inheritedHeaderBlockIds: tables.flatMap((table) =>
      table.segments.flatMap((segment) => segment.inheritedHeaderBlockIds),
    ),
  };
}

export function buildSegmentedExtractionUnitInstructions(
  context: SegmentedExtractionUnitContext,
): string {
  const { unit } = context;
  const compact = (values: readonly string[]): string =>
    values.length ? values.join(', ') : 'none';
  return `
You perform document extraction, never domain mapping. Return only CommercialDocumentExtraction/1 JSON and never chain-of-thought.
Extract only facts, vehicle identities, scopes, evidence, ambiguity, exclusions, eligibility/channel, and cumulative or alternative relationships attributable to this unit.
Unit: id=${unit.unitId}; ordinal=${unit.ordinal}; kind=${unit.unitType}; document=${unit.documentId}.
Primary pages: ${compact(unit.primaryPageIds)}. They are the only primary source of new facts.
Context-only pages: ${compact(unit.contextPageIds)}. Use them only to interpret primary content; do not duplicate facts originating exclusively in another unit.
Primary source blocks from the canonical Document Map: ${compact(context.primaryContentBlocks.map((block) => `${block.contentBlockId}[${block.blockKind}@${block.pageId}]`))}.
Context-only source blocks from the canonical Document Map: ${compact(context.contextOnlyContentBlocks.map((block) => `${block.contentBlockId}[${block.blockKind}@${block.pageId}]`))}.
Source provenance contract: evidence.blockIds always references blocks defined in this same extraction artifact. When content from a listed Document Map source block is used, materialize a genuine extraction blocks entry from the source PDF and reuse that exact canonical source block ID as its temporary blockId. Reference that same temporary blockId from evidence and other block references; the server canonicalizer remaps the definition and every reference together. Never cite a source block ID without materializing its real extraction block, and never invent a placeholder block. Context-only source blocks may support interpretation and evidence, but must not originate new facts exclusively from context.
Source block excerpt contract: blocks[].excerpt is a short verbatim evidence snippet, never a full paragraph, table, or document dump. Keep it within 1000 Unicode characters and select the shortest literal source fragment sufficient to support the block. Never summarize, rewrite, append an ellipsis, emit a placeholder, or invent excerpt text.
Tables: ${compact(unit.tableIds)}; logicalTableId=${unit.logicalTableId ?? 'none'}; partition=${unit.partition ? `${unit.partition.index}/${unit.partition.count}` : 'none'}.
Sections: ${compact(unit.sectionIds)}. Notes/footnotes: ${compact(unit.noteIds)}. Entity hints: ${compact(unit.entityHintIds)}.
Inherited header blocks: ${compact(context.inheritedHeaderBlockIds)}. Preserve inherited headers and applicable notes/footnotes in interpretation and evidence.
Table cell contract: A row cell is keyed by columnId, not by its array position, and rows do not need a cell for every column. Emit a cell only when that column has actual visible non-empty text. For a visually blank cell, omit that cell while keeping every other cell's own columnId. Never replace a blank with whitespace, "-", "N/A", "unknown" or another fabricated placeholder; literal visible text or symbols may be emitted only when the source displays them. The contract has no rowSpan, colSpan or implicit "same as above" state: never copy a merged, repeated or inherited value from a previous row unless the source explicitly displays it in the current cell. If missing cell content makes a row materially unresolved, report a genuine coverage gap/unresolved row instead of inventing content.
Interpret section and channel before classifying any value. Keep every fact inside its documented channel and never transfer a value between retail, direct-sales, CPF, PCD, fleet, or another section merely because model or amount coincides.
Keep productionYear distinct from modelYear. productionYear and modelYear form an atomic pair. Emit both only when the document makes both values unambiguous. If only one side is known, omit both structured fields, preserve the documentary year expression in rawYearText, and set confidence.requiresReview=true. Never infer the missing year from automotive convention. An explicit 26/27 means productionYear=2026, modelYear=2027 and rawYearText="26/27"; an explicit 26/26 means both structured years are 2026. MY27 alone emits neither structured year and preserves rawYearText="MY27" with review; likewise, PY26 alone emits neither structured year and preserves rawYearText="PY26" with review. PY/MY may be inherited from a table or section header when the source scope is explicit and applies unambiguously to the rows; cite the governing header/context as provenance. If no year is explicit or unambiguously inherited, omit both structured fields without silent inference.
public_price/reference/MSRP and promotional_price/customer/offer price are different semantic facts. A documentary "de X por Y" emits both facts: X as public/reference price and Y as promotional price. A value explicitly labeled PREÇO CLIENTE is promotional_price, never public_price. Do not collapse facts merely because their numeric values coincide.
Preserve AND/OR literally: cumulative wording maps to APPLIES_TOGETHER/CUMULATIVE and alternatives or non-cumulativity map to MUTUALLY_EXCLUSIVE/ALTERNATIVE. Evidence is mandatory for every fact and composition relationship. Never invent an absent fact; UNKNOWN, ambiguity, or a coverage gap is preferable to inference. Preserve uncertainty; never guess.
Composition contract: Create a composition group only when it has at least two actual member facts and at least one actual scope. Create a composition relationship only when it references at least one actual fact and has actual evidence; APPLIES_TOGETHER and MUTUALLY_EXCLUSIVE relationships need at least two actual fact/group subjects in total. Never emit placeholder composition objects. If no composition applies to this unit, return empty groups and relationships arrays at the collection level.
Relationship fact requirement: Never emit a composition relationship with an empty factIds array. A relationship must reference at least one concrete extracted fact; groupIds never substitute for the required fact. If you identified only a group but no concrete fact relationship, do not emit a relationship. If no valid relationships exist, return relationships: []. Never emit placeholder relationship objects to satisfy required fields. Cardinality examples only (all other required fields still apply): VALID relationships: []; VALID factIds: ["fact-temp-1"]; INVALID factIds: [].
Coverage status contract: Use complete only when every coverage unit is complete, gaps, incompleteBlockIds, unresolvedTableRows and unresolvedScopeIds are all empty, expectedVehicleCount is absent or equals the extracted vehicles, and expectedFamilies equals extractedFamilies as a set. If any of those conditions is false, never use optimistic complete. Use partial for known missing or incomplete required extraction and include the corresponding incomplete unit, gap or unresolved reference. Use ambiguous when unresolved interpretation or competing readings prevent a confident result, represented by an AMBIGUITY gap, an ambiguous unit or an unresolved scope. Never hide gaps, unresolved items or ambiguity merely to make a status pass validation.
coverage.units must describe only the current unit. The required expectedUnitCount, completedUnitCount, and extractedVehicleCount wire fields are transport-only counters: emit 0 as a safe sentinel because the server deterministically reconstructs them from coverage.units and vehicleIdentities before canonical validation. Never use those counters to declare semantic completeness or hide partial, ambiguous, gap, or unresolved evidence. Local IDs are temporary and must have their contract prefixes.
${COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS}
Never return Product IDs, matching, final Policies/Offers, promotion, persistence IDs, private URLs, file IDs, or credentials.
`.trim();
}

const PRIMARY_FAILURE_PRIORITY: Readonly<Record<SegmentedExtractionUnitFailure['code'], number>> = {
  BUDGET_EXCEEDED: 0,
  INVALID_STRUCTURED_OUTPUT: 1,
  CANONICAL_VALIDATION_FAILED: 2,
  PROVIDER_FAILURE: 3,
  PROVIDER_TIMEOUT: 4,
  ORCHESTRATION_TIMEOUT: 5,
  ABORTED_SIBLING: 6,
};

export function selectPrimarySegmentedExtractionFailure(
  results: readonly SegmentedExtractionUnitResult[],
): SegmentedExtractionUnitFailure | undefined {
  return results
    .filter((result): result is SegmentedExtractionUnitFailure => result.status === 'failed')
    .sort(
      (left, right) =>
        PRIMARY_FAILURE_PRIORITY[left.code] - PRIMARY_FAILURE_PRIORITY[right.code] ||
        left.ordinal - right.ordinal ||
        left.unitId.localeCompare(right.unitId),
    )[0];
}

const failure = (
  unit: CommercialExtractionUnit,
  code: SegmentedExtractionUnitFailure['code'],
  durationMs: number,
): SegmentedExtractionUnitFailure => ({
  status: 'failed',
  unitId: unit.unitId,
  ordinal: unit.ordinal,
  code,
  durationMs,
});

const providerCode = (error: unknown): string | undefined =>
  error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;

const structuralDiagnostic = (
  unit: CommercialExtractionUnit,
  phase: SegmentedExtractionUnitValidationPhase,
  error: unknown,
): SegmentedExtractionUnitValidationObservation => {
  if (error instanceof CommercialDocumentExtractionValidationError)
    return {
      unitId: unit.unitId,
      unitOrdinal: unit.ordinal,
      phase,
      totalViolations: error.totalViolations,
      categories: error.keywordCounts,
      sampledViolations: error.diagnostics,
      truncated: error.truncated,
    };
  const keyword =
    phase === 'transport_decode'
      ? 'decode'
      : phase === 'transport_validation'
        ? 'validation'
        : phase === 'canonical_validation'
          ? 'validation'
          : 'canonicalization';
  return {
    unitId: unit.unitId,
    unitOrdinal: unit.ordinal,
    phase,
    totalViolations: 1,
    categories: { [keyword]: 1 },
    sampledViolations: [{ path: '/', keyword, category: 'schema' }],
    truncated: false,
  };
};

const diagnosticRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const diagnosticArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const optionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

export function inspectSegmentedExtractionUnitYears(input: {
  readonly stage: SegmentedExtractionUnitYearDiagnosticStage;
  readonly context: SegmentedExtractionUnitContext;
  readonly artifact: unknown;
  readonly validation?: SegmentedExtractionUnitYearDiagnosticObservation['validation'];
}): SegmentedExtractionUnitYearDiagnosticObservation {
  const root = diagnosticRecord(input.artifact);
  const blocks = new Map(
    diagnosticArray(root?.blocks)
      .map(diagnosticRecord)
      .filter((block): block is Readonly<Record<string, unknown>> => block !== undefined)
      .flatMap((block) => {
        const blockId = optionalString(block.blockId);
        const page = optionalNumber(block.page);
        return blockId && page !== undefined ? ([[blockId, page]] as const) : [];
      }),
  );
  const identities = diagnosticArray(root?.vehicleIdentities);

  return {
    stage: input.stage,
    unitId: input.context.unit.unitId,
    unitOrdinal: input.context.unit.ordinal,
    primaryPages: input.context.primaryPages.map((page) => page.pageNumber),
    contextPages: input.context.contextOnlyPages.map((page) => page.pageNumber),
    tableIds: [...input.context.unit.tableIds],
    sectionIds: [...input.context.unit.sectionIds],
    vehicleIdentityCount: identities.length,
    vehicleIdentities: identities.map((value, identityIndex) => {
      const identity = diagnosticRecord(value);
      const evidence = diagnosticRecord(identity?.evidence);
      const confidence = diagnosticRecord(identity?.confidence);
      const productionYear = optionalNumber(identity?.productionYear);
      const modelYear = optionalNumber(identity?.modelYear);
      const rawYearText = optionalString(identity?.rawYearText);
      return {
        identityIndex,
        ...(optionalString(identity?.brand) ? { brand: optionalString(identity?.brand) } : {}),
        ...(optionalString(identity?.model) ? { model: optionalString(identity?.model) } : {}),
        ...(optionalString(identity?.version)
          ? { version: optionalString(identity?.version) }
          : {}),
        productionYear: {
          present: productionYear !== undefined,
          ...(productionYear !== undefined ? { value: productionYear } : {}),
        },
        modelYear: {
          present: modelYear !== undefined,
          ...(modelYear !== undefined ? { value: modelYear } : {}),
        },
        rawYearText: {
          present: rawYearText !== undefined,
          ...(rawYearText !== undefined ? { value: rawYearText } : {}),
        },
        evidencePages: [
          ...new Set(
            diagnosticArray(evidence?.blockIds)
              .map(optionalString)
              .filter((blockId): blockId is string => blockId !== undefined)
              .map((blockId) => blocks.get(blockId))
              .filter((page): page is number => page !== undefined),
          ),
        ].sort((left, right) => left - right),
        ...(confidence
          ? {
              confidence: {
                ...(optionalNumber(confidence.score) !== undefined
                  ? { score: optionalNumber(confidence.score) }
                  : {}),
                ...(optionalBoolean(confidence.ambiguous) !== undefined
                  ? { ambiguous: optionalBoolean(confidence.ambiguous) }
                  : {}),
                ...(optionalBoolean(confidence.requiresReview) !== undefined
                  ? { requiresReview: optionalBoolean(confidence.requiresReview) }
                  : {}),
                reasons: diagnosticArray(confidence.reasons)
                  .map(optionalString)
                  .filter((reason): reason is string => reason !== undefined),
              },
            }
          : {}),
      };
    }),
    ...(input.validation ? { validation: input.validation } : {}),
  };
}

const awaitWithAbort = async <T>(operation: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw new Error('SEGMENTED_EXTRACTION_ABORTED');
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new Error('SEGMENTED_EXTRACTION_ABORTED'));
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
};

export async function executeSegmentedExtraction(
  input: SegmentedExtractionInput,
  options: SegmentedExtractionOrchestratorOptions,
): Promise<SegmentedExtractionOperationalResult> {
  validateCommercialDocumentMap(input.documentMap);
  validateCommercialExtractionUnitPlan(input.unitPlan, input.documentMap);
  const concurrency = options.concurrency ?? SEGMENTED_EXTRACTION_LIMITS.defaultConcurrency;
  const unitTimeoutMs = options.unitTimeoutMs ?? SEGMENTED_EXTRACTION_LIMITS.defaultUnitTimeoutMs;
  const totalTimeoutMs =
    options.totalTimeoutMs ?? SEGMENTED_EXTRACTION_LIMITS.defaultTotalTimeoutMs;
  assertIntegerRange(
    concurrency,
    SEGMENTED_EXTRACTION_LIMITS.minConcurrency,
    SEGMENTED_EXTRACTION_LIMITS.maxConcurrency,
    'CONCURRENCY',
  );
  assertIntegerRange(
    unitTimeoutMs,
    SEGMENTED_EXTRACTION_LIMITS.minUnitTimeoutMs,
    SEGMENTED_EXTRACTION_LIMITS.maxUnitTimeoutMs,
    'UNIT_TIMEOUT',
  );
  assertIntegerRange(
    totalTimeoutMs,
    SEGMENTED_EXTRACTION_LIMITS.minTotalTimeoutMs,
    SEGMENTED_EXTRACTION_LIMITS.maxTotalTimeoutMs,
    'TOTAL_TIMEOUT',
  );

  const now = options.now ?? Date.now;
  const totalController = new AbortController();
  let totalExpired = false;
  const totalTimer = setTimeout(() => {
    totalExpired = true;
    totalController.abort();
  }, totalTimeoutMs);
  const selectedUnitIds = options.unitIds ? new Set(options.unitIds) : undefined;
  const units = [...input.unitPlan.units]
    .filter((unit) => selectedUnitIds?.has(unit.unitId) ?? true)
    .sort((left, right) => left.ordinal - right.ordinal);
  if (selectedUnitIds && units.length !== selectedUnitIds.size)
    throw new Error('SEGMENTED_EXTRACTION_UNKNOWN_SELECTED_UNIT');
  const results: Array<SegmentedExtractionUnitResult | undefined> = new Array(units.length);
  let nextIndex = 0;
  let fatal = false;
  let session: Awaited<ReturnType<StructuredExtractionProvider['openSource']>> | undefined;
  let cleanup: SegmentedExtractionOperationalResult['cleanup'] = 'succeeded';
  let requestOrdinal = options.budget?.initialCalls ?? 0;
  let estimatedTokens = options.budget?.initialEstimatedTokens ?? 0;

  try {
    session =
      options.sourceSession ??
      (await options.provider.openSource(input.source, {
        signal: totalController.signal,
        correlationId: input.correlationId,
      }));
    const runUnit = async (index: number): Promise<void> => {
      const unit = units[index]!;
      const startedAt = now();
      const controller = new AbortController();
      const abortFromTotal = (): void => controller.abort();
      totalController.signal.addEventListener('abort', abortFromTotal, { once: true });
      let unitExpired = false;
      const unitTimer = setTimeout(() => {
        unitExpired = true;
        controller.abort();
      }, unitTimeoutMs);
      const observe = (phase: SegmentedExtractionUnitValidationPhase, error: unknown): void => {
        if (!options.diagnostics) return;
        options.observeUnitValidation?.(structuralDiagnostic(unit, phase, error));
      };
      try {
        const context = buildSegmentedExtractionUnitContext(input.documentMap, unit);
        const instructions = buildSegmentedExtractionUnitInstructions(context);
        const documentContext = options.buildUnitDocumentContext?.(context);
        const plannedObservation = measureProviderCall({
          stage: 'unit_extraction',
          unitId: unit.unitId,
          pages: context.primaryPages.map((page) => page.pageNumber),
          requestOrdinal: requestOrdinal + 1,
          promptVersion: SEGMENTED_EXTRACTION_PROMPT_VERSION,
          instructions,
          schema: options.schema,
          ...(documentContext ? { documentContext } : {}),
        });
        const nextCalls = requestOrdinal + 1;
        const nextTokens =
          estimatedTokens +
          plannedObservation.estimatedInputTokens +
          (options.includeSourceDocuments === false
            ? 0
            : (options.budget?.estimatedSourceTokensPerRequest ?? 0));
        if (options.budget) {
          const estimatedCostUsd =
            options.budget.estimatedCostPerMillionTokensUsd === undefined
              ? undefined
              : (nextTokens / 1_000_000) * options.budget.estimatedCostPerMillionTokensUsd;
          if (
            nextCalls > options.budget.maxProviderCalls ||
            nextTokens > options.budget.maxEstimatedTotalTokens ||
            (options.budget.maxEstimatedCostUsd !== undefined &&
              estimatedCostUsd !== undefined &&
              estimatedCostUsd > options.budget.maxEstimatedCostUsd)
          ) {
            results[index] = failure(unit, 'BUDGET_EXCEEDED', now() - startedAt);
            fatal = true;
            totalController.abort();
            return;
          }
        }
        requestOrdinal = nextCalls;
        estimatedTokens = nextTokens;
        const currentRequestOrdinal = nextCalls;
        const observeYears = (
          stage: SegmentedExtractionUnitYearDiagnosticStage,
          artifact: unknown,
          validation?: SegmentedExtractionUnitYearDiagnosticObservation['validation'],
        ): void => {
          if (!options.diagnostics || !options.observeUnitYearDiagnostic) return;
          options.observeUnitYearDiagnostic(
            inspectSegmentedExtractionUnitYears({ stage, context, artifact, validation }),
          );
        };
        const response = await awaitWithAbort(
          session!.extractStructured({
            instructions,
            ...(documentContext ? { documentContext } : {}),
            ...(options.includeSourceDocuments === undefined
              ? {}
              : { includeSourceDocuments: options.includeSourceDocuments }),
            schemaName: options.schemaName ?? 'commercial_document_extraction_unit_v1',
            schema: options.schema,
            signal: controller.signal,
            metadata: {
              correlationId: input.correlationId,
              unitId: unit.unitId,
              unitOrdinal: unit.ordinal,
              unitKind: unit.unitType,
              requestOrdinal: currentRequestOrdinal,
              promptVersion: SEGMENTED_EXTRACTION_PROMPT_VERSION,
              schemaVersion: SEGMENTED_EXTRACTION_SCHEMA_VERSION,
            },
          }),
          controller.signal,
        );
        options.observeProviderCall?.(
          measureProviderCall({
            stage: 'unit_extraction',
            unitId: unit.unitId,
            pages: context.primaryPages.map((page) => page.pageNumber),
            requestOrdinal: currentRequestOrdinal,
            promptVersion: SEGMENTED_EXTRACTION_PROMPT_VERSION,
            instructions,
            schema: options.schema,
            ...(documentContext ? { documentContext } : {}),
            actual: {
              inputTokens: response.usage.inputUnits,
              outputTokens: response.usage.outputUnits,
              totalTokens: response.usage.totalUnits,
              elapsedMs: now() - startedAt,
            },
          }),
        );
        if (options.validateTransport) {
          try {
            options.validateTransport(response.output);
          } catch (error) {
            observe('transport_validation', error);
            results[index] = failure(unit, 'INVALID_STRUCTURED_OUTPUT', now() - startedAt);
            fatal = true;
            totalController.abort();
            return;
          }
        }
        observeYears('raw_structured_output', response.output);
        let decoded: unknown;
        try {
          decoded = (options.decodeTransport ?? ((value: unknown) => value))(response.output);
        } catch (error) {
          observe('transport_decode', error);
          results[index] = failure(unit, 'INVALID_STRUCTURED_OUTPUT', now() - startedAt);
          fatal = true;
          totalController.abort();
          return;
        }
        observeYears('reconstructed', decoded);
        observeYears('pre_canonicalization', decoded);
        let artifact: CommercialDocumentExtractionV1;
        try {
          artifact = canonicalizeCommercialDocumentExtractionUnit(
            decoded as CommercialDocumentExtractionV1,
            unit.ordinal,
          );
        } catch (error) {
          observe('canonicalization', error);
          results[index] = failure(unit, 'INVALID_STRUCTURED_OUTPUT', now() - startedAt);
          fatal = true;
          totalController.abort();
          return;
        }
        try {
          validateCommercialDocumentExtraction(artifact);
          observeYears('canonical_validation', artifact, {
            status: 'passed',
            totalViolations: 0,
            categories: {},
          });
          results[index] = {
            status: 'succeeded',
            unitId: unit.unitId,
            ordinal: unit.ordinal,
            artifact,
            providerRunId: response.providerRunId,
            usage: response.usage,
            durationMs: now() - startedAt,
          };
        } catch (error) {
          const diagnostic = structuralDiagnostic(unit, 'canonical_validation', error);
          observeYears('canonical_validation', artifact, {
            status: 'failed',
            totalViolations: diagnostic.totalViolations,
            categories: diagnostic.categories,
          });
          observe('canonical_validation', error);
          results[index] = failure(unit, 'CANONICAL_VALIDATION_FAILED', now() - startedAt);
          fatal = true;
          totalController.abort();
        }
      } catch (error) {
        const code = totalExpired
          ? 'ORCHESTRATION_TIMEOUT'
          : controller.signal.aborted && fatal && !unitExpired
            ? 'ABORTED_SIBLING'
            : unitExpired || providerCode(error) === 'PROVIDER_TIMEOUT'
              ? 'PROVIDER_TIMEOUT'
              : providerCode(error) === 'PROVIDER_INVALID_OUTPUT'
                ? 'INVALID_STRUCTURED_OUTPUT'
                : 'PROVIDER_FAILURE';
        results[index] = failure(unit, code, now() - startedAt);
        if (code !== 'ABORTED_SIBLING') {
          fatal = true;
          totalController.abort();
        }
      } finally {
        clearTimeout(unitTimer);
        totalController.signal.removeEventListener('abort', abortFromTotal);
      }
    };
    const worker = async (): Promise<void> => {
      while (!fatal && nextIndex < units.length) {
        const index = nextIndex++;
        await runUnit(index);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, units.length) }, worker));
  } catch {
    fatal = true;
  } finally {
    clearTimeout(totalTimer);
    if (session && (options.sourceSession === undefined || options.closeSourceSession === true)) {
      try {
        await session.close();
      } catch {
        cleanup = 'failed';
      }
    }
  }

  for (let index = 0; index < units.length; index++)
    results[index] ??= failure(
      units[index]!,
      totalExpired ? 'ORCHESTRATION_TIMEOUT' : 'ABORTED_SIBLING',
      0,
    );
  return {
    correlationId: input.correlationId,
    schemaVersion: SEGMENTED_EXTRACTION_SCHEMA_VERSION,
    promptVersion: SEGMENTED_EXTRACTION_PROMPT_VERSION,
    unitResults: results as SegmentedExtractionUnitResult[],
    cleanup,
  };
}
