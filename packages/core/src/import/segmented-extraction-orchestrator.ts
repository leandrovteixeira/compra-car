import type { CommercialDocumentExtractionV1 } from './commercial-document-extraction';
import { canonicalizeCommercialDocumentExtractionUnit } from './commercial-document-extraction-canonicalizer';
import { validateCommercialDocumentExtractionTransport } from './commercial-document-extraction-validator';
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

export interface SegmentedExtractionOrchestratorOptions {
  readonly provider: StructuredExtractionProvider;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly schemaName?: string;
  readonly concurrency?: number;
  readonly unitTimeoutMs?: number;
  readonly totalTimeoutMs?: number;
  readonly now?: () => number;
  readonly decodeTransport?: (value: unknown) => unknown;
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
Primary blocks: ${compact(unit.primaryContentBlockIds)}. Context-only blocks: ${compact(unit.contextContentBlockIds)}.
Tables: ${compact(unit.tableIds)}; logicalTableId=${unit.logicalTableId ?? 'none'}; partition=${unit.partition ? `${unit.partition.index}/${unit.partition.count}` : 'none'}.
Sections: ${compact(unit.sectionIds)}. Notes/footnotes: ${compact(unit.noteIds)}. Entity hints: ${compact(unit.entityHintIds)}.
Inherited header blocks: ${compact(context.inheritedHeaderBlockIds)}. Preserve inherited headers and applicable notes/footnotes in interpretation and evidence.
Keep productionYear distinct from modelYear. Do not classify a promotional price as public/MSRP without explicit evidence. Preserve uncertainty; never guess.
Coverage must explicitly represent complete, partial, or ambiguous unit extraction. Local IDs are temporary and must have their contract prefixes.
Never return Product IDs, matching, final Policies/Offers, promotion, persistence IDs, private URLs, file IDs, or credentials.
`.trim();
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
  const units = [...input.unitPlan.units].sort((left, right) => left.ordinal - right.ordinal);
  const results: Array<SegmentedExtractionUnitResult | undefined> = new Array(units.length);
  let nextIndex = 0;
  let fatal = false;
  let session: Awaited<ReturnType<StructuredExtractionProvider['openSource']>> | undefined;
  let cleanup: SegmentedExtractionOperationalResult['cleanup'] = 'succeeded';

  try {
    session = await options.provider.openSource(input.source, {
      signal: totalController.signal,
      correlationId: input.correlationId,
    });
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
      try {
        const context = buildSegmentedExtractionUnitContext(input.documentMap, unit);
        const response = await awaitWithAbort(
          session!.extractStructured({
            instructions: buildSegmentedExtractionUnitInstructions(context),
            schemaName: options.schemaName ?? 'commercial_document_extraction_unit_v1',
            schema: options.schema,
            signal: controller.signal,
            metadata: {
              correlationId: input.correlationId,
              unitId: unit.unitId,
              unitOrdinal: unit.ordinal,
              unitKind: unit.unitType,
              promptVersion: SEGMENTED_EXTRACTION_PROMPT_VERSION,
              schemaVersion: SEGMENTED_EXTRACTION_SCHEMA_VERSION,
            },
          }),
          controller.signal,
        );
        let decoded: unknown;
        try {
          decoded = (options.decodeTransport ?? ((value: unknown) => value))(response.output);
          validateCommercialDocumentExtractionTransport(decoded);
        } catch {
          results[index] = failure(unit, 'INVALID_STRUCTURED_OUTPUT', now() - startedAt);
          fatal = true;
          totalController.abort();
          return;
        }
        try {
          const artifact = canonicalizeCommercialDocumentExtractionUnit(
            decoded as CommercialDocumentExtractionV1,
            unit.ordinal,
          );
          results[index] = {
            status: 'succeeded',
            unitId: unit.unitId,
            ordinal: unit.ordinal,
            artifact,
            providerRunId: response.providerRunId,
            usage: response.usage,
            durationMs: now() - startedAt,
          };
        } catch {
          results[index] = failure(unit, 'CANONICAL_VALIDATION_FAILED', now() - startedAt);
          fatal = true;
          totalController.abort();
        }
      } catch (error) {
        const code = totalExpired
          ? 'ORCHESTRATION_TIMEOUT'
          : unitExpired || providerCode(error) === 'PROVIDER_TIMEOUT'
            ? 'PROVIDER_TIMEOUT'
            : providerCode(error) === 'PROVIDER_INVALID_OUTPUT'
              ? 'INVALID_STRUCTURED_OUTPUT'
              : controller.signal.aborted && fatal
                ? 'ABORTED_SIBLING'
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
    if (session) {
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
