import type {
  CommercialDocumentMapV1,
  CommercialExtractionUnit,
  CommercialExtractionUnitPlanV1,
} from './commercial-document-map';
import { COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS } from './commercial-knowledge-calibration';

export const COMMERCIAL_TABLE_IR_SCHEMA_VERSION = 'CommercialTableIR/1' as const;
export const COMMERCIAL_COMPACT_PROMPT_CANDIDATE_VERSION = '12' as const;

export function buildCommercialCompactPromptCandidate(input: {
  readonly unitId: string;
  readonly primaryPages: readonly number[];
  readonly tableIR: CommercialTableIRV1;
}): string {
  return `Commercial documentary extraction v12 candidate. Return only CommercialDocumentExtraction/1 JSON; never domain mapping, Policy/Offer objects, persistence data, credentials, or reasoning.
Scope: unit=${input.unitId}; primary pages=${input.primaryPages.join(',')}; compact input=${input.tableIR.schemaVersion}; tables=${input.tableIR.tables.map((table) => table.tableId).join(',')}.
Extract only facts attributable to this compact input. Governing notes may interpret primary tables but never originate unrelated facts. Keep channel boundaries strict, provenance on every fact/composition, and uncertainty explicit.
Provenance: materialize every cited source block with its existing temporary ID and a shortest verbatim excerpt (maximum 1000 Unicode characters). Never invent, summarize, ellipsize, or cite an undefined block.
Cells: columnId owns meaning; omitted/blank is not zero and must not be filled. Apply explicit merged spans to every covered row without sharing facts across products. Preserve visible AND/OR, option labels, specific exceptions, note scope, and dealer-participation position.
Years: productionYear/modelYear are atomic. Emit both only from an explicit unambiguous pair or scoped header; 26/27=>2026/2027, 26/26=>2026/2026. MY27 or PY26 alone keeps rawYearText, omits both fields, and requires review. Never infer automotive years.
Prices: public/reference and promotional/customer price are distinct. "de X por Y" emits both; PRECO CLIENTE is promotional. Equal values do not justify deduplication.
Composition: cumulative=>APPLIES_TOGETHER; alternatives/non-cumulative=>MUTUALLY_EXCLUSIVE. Relationships require evidence and at least one factId; cumulative/alternative relationships require at least two actual fact/group subjects. Groups require >=2 facts and >=1 scope. Otherwise emit empty arrays, never placeholders.
Coverage: describe only this unit. COMPLETE requires every coverage unit complete, no gaps/incomplete/unresolved references, matching expected vehicle count, and equal expected/extracted family sets. Otherwise use PARTIAL or AMBIGUOUS with explicit gaps. Transport counters are 0 sentinels reconstructed by the server and never justify completeness.
${COMMERCIAL_KNOWLEDGE_CALIBRATION_INSTRUCTIONS.replace('v11', 'v12 candidate')}`;
}

export interface CommercialTableIRCell {
  readonly columnId: string;
  readonly rawValue: string;
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialTableIRRow {
  readonly rowId: string;
  readonly product?: string;
  readonly version?: string;
  readonly rawProductionYear?: string;
  readonly rawModelYear?: string;
  readonly cells: readonly CommercialTableIRCell[];
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialTableIRMergedCellGroup {
  readonly groupId: string;
  readonly rowIds: readonly string[];
  readonly columnIds: readonly string[];
  readonly rawValue: string;
  readonly rowSpan?: number;
  readonly columnSpan?: number;
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialTableIRTable {
  readonly tableId: string;
  readonly pageNumbers: readonly number[];
  readonly sectionIds: readonly string[];
  readonly headers: readonly {
    readonly columnId: string;
    readonly label: string;
    readonly sourceBlockIds: readonly string[];
  }[];
  readonly rows: readonly CommercialTableIRRow[];
  readonly mergedCellGroups: readonly CommercialTableIRMergedCellGroup[];
  readonly optionLabels: readonly string[];
  readonly structuralOperators: readonly ('AND' | 'OR')[];
  readonly dealerParticipationPositions: readonly {
    readonly rowId: string;
    readonly columnId: string;
    readonly sourceBlockIds: readonly string[];
  }[];
  readonly noteIds: readonly string[];
  readonly sourceBlockIds: readonly string[];
}

export interface CommercialTableIRV1 {
  readonly schemaVersion: typeof COMMERCIAL_TABLE_IR_SCHEMA_VERSION;
  readonly documentOrdinal: number;
  readonly channel: 'RETAIL' | 'NON_RETAIL' | 'UNKNOWN';
  readonly sectionIds: readonly string[];
  readonly tables: readonly CommercialTableIRTable[];
  readonly governingNotes: readonly {
    readonly noteId: string;
    readonly pageNumber: number;
    readonly noteKind: CommercialDocumentMapV1['notes'][number]['noteKind'];
    readonly tableIds: readonly string[];
    readonly sectionIds: readonly string[];
    readonly sourceBlockIds: readonly string[];
  }[];
  readonly provenanceSourceBlockIds: readonly string[];
}

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();
const uniqueNumbers = (values: readonly number[]): number[] =>
  [...new Set(values)].sort((left, right) => left - right);
const normalized = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();

export function classifyCommercialTableIRChannel(
  values: readonly string[],
): CommercialTableIRV1['channel'] {
  const text = normalized(values.join(' '));
  if (/\b(vd|venda direta|vd cpf|pcd|taxi|cnpj|frotista|frota|governo|agro|zfm|alc)\b/u.test(text))
    return 'NON_RETAIL';
  if (/\b(varejo|retail)\b/u.test(text)) return 'RETAIL';
  return 'UNKNOWN';
}

export function createCommercialTableIR(
  input: Omit<CommercialTableIRV1, 'schemaVersion'>,
): CommercialTableIRV1 {
  const tableIds = input.tables.map((table) => table.tableId);
  if (new Set(tableIds).size !== tableIds.length)
    throw new Error('COMMERCIAL_TABLE_IR_DUPLICATE_TABLE');
  const blockIds = new Set(input.provenanceSourceBlockIds);
  for (const table of input.tables) {
    const rowIds = new Set(table.rows.map((row) => row.rowId));
    if (rowIds.size !== table.rows.length) throw new Error('COMMERCIAL_TABLE_IR_DUPLICATE_ROW');
    const references = [
      ...table.sourceBlockIds,
      ...table.headers.flatMap((header) => header.sourceBlockIds),
      ...table.rows.flatMap((row) => [
        ...row.sourceBlockIds,
        ...row.cells.flatMap((cell) => cell.sourceBlockIds),
      ]),
      ...table.mergedCellGroups.flatMap((group) => group.sourceBlockIds),
      ...table.dealerParticipationPositions.flatMap((position) => position.sourceBlockIds),
    ];
    if (references.some((id) => !blockIds.has(id)))
      throw new Error('COMMERCIAL_TABLE_IR_UNKNOWN_PROVENANCE');
    if (
      table.mergedCellGroups.some((group) => group.rowIds.some((rowId) => !rowIds.has(rowId))) ||
      table.dealerParticipationPositions.some((position) => !rowIds.has(position.rowId))
    )
      throw new Error('COMMERCIAL_TABLE_IR_UNKNOWN_ROW');
  }
  return {
    schemaVersion: COMMERCIAL_TABLE_IR_SCHEMA_VERSION,
    documentOrdinal: input.documentOrdinal,
    channel: input.channel,
    sectionIds: uniqueSorted(input.sectionIds),
    tables: [...input.tables].sort((left, right) => left.tableId.localeCompare(right.tableId)),
    governingNotes: [...input.governingNotes].sort((left, right) =>
      left.noteId.localeCompare(right.noteId),
    ),
    provenanceSourceBlockIds: uniqueSorted(input.provenanceSourceBlockIds),
  };
}

export function buildStructuralCommercialTableIR(input: {
  readonly map: CommercialDocumentMapV1;
  readonly unit: CommercialExtractionUnit;
  readonly populatedTables?: Readonly<
    Record<
      string,
      Pick<
        CommercialTableIRTable,
        | 'rows'
        | 'mergedCellGroups'
        | 'optionLabels'
        | 'structuralOperators'
        | 'dealerParticipationPositions'
      >
    >
  >;
}): CommercialTableIRV1 {
  const { map, unit } = input;
  const document = map.documents.find((item) => item.documentId === unit.documentId);
  if (!document) throw new Error('COMMERCIAL_TABLE_IR_UNKNOWN_DOCUMENT');
  const pages = new Map(map.pages.map((page) => [page.pageId, page.pageNumber]));
  const hints = map.entityHints.filter((hint) => unit.entityHintIds.includes(hint.entityHintId));
  const channel = classifyCommercialTableIRChannel(
    hints.filter((hint) => hint.hintKind === 'CHANNEL').map((hint) => hint.value),
  );
  const tables = unit.tableIds.map((tableId) => {
    const table = map.tables.find((item) => item.tableId === tableId);
    if (!table) throw new Error('COMMERCIAL_TABLE_IR_UNKNOWN_TABLE');
    const populated = input.populatedTables?.[tableId];
    return {
      tableId,
      pageNumbers: uniqueNumbers(table.pageIds.flatMap((pageId) => pages.get(pageId) ?? [])),
      sectionIds: [...unit.sectionIds],
      headers: table.columnHeaderLabels.map((label, index) => ({
        columnId: `column-${String(index + 1).padStart(2, '0')}`,
        label,
        sourceBlockIds: [...table.headerBlockIds],
      })),
      rows: populated?.rows ?? [],
      mergedCellGroups: populated?.mergedCellGroups ?? [],
      optionLabels: populated?.optionLabels ?? [],
      structuralOperators: populated?.structuralOperators ?? [],
      dealerParticipationPositions: populated?.dealerParticipationPositions ?? [],
      noteIds: uniqueSorted([...unit.noteIds, ...table.footnoteNoteIds]),
      sourceBlockIds: uniqueSorted(table.sourceBlockIds),
    } satisfies CommercialTableIRTable;
  });
  const notes = map.notes
    .filter((note) => unit.noteIds.includes(note.noteId))
    .map((note) => ({
      noteId: note.noteId,
      pageNumber: pages.get(note.pageId) ?? 0,
      noteKind: note.noteKind,
      tableIds: [...note.tableIds],
      sectionIds: [...note.sectionIds],
      sourceBlockIds: [...note.sourceBlockIds],
    }));
  return createCommercialTableIR({
    documentOrdinal: document.ordinal,
    channel,
    sectionIds: unit.sectionIds,
    tables,
    governingNotes: notes,
    provenanceSourceBlockIds: uniqueSorted([
      ...unit.primaryContentBlockIds,
      ...unit.contextContentBlockIds,
      ...tables.flatMap((table) => table.sourceBlockIds),
      ...notes.flatMap((note) => note.sourceBlockIds),
    ]),
  });
}

export interface CommercialUnitCoalescingDiagnostic {
  readonly groupUnitId: string;
  readonly sourceUnitIds: readonly string[];
  readonly tableIds: readonly string[];
  readonly pageCount: number;
  readonly contextPageCount: number;
  readonly reason: 'SAME_COMMERCIAL_SCOPE' | 'NOT_COALESCED';
}

export function coalesceCommercialExtractionUnitPlan(input: {
  readonly map: CommercialDocumentMapV1;
  readonly plan: CommercialExtractionUnitPlanV1;
  readonly maxTablesPerGroup?: number;
  readonly maxPrimaryPagesPerGroup?: number;
  readonly maxContextPagesPerGroup?: number;
}): {
  readonly plan: CommercialExtractionUnitPlanV1;
  readonly diagnostics: readonly CommercialUnitCoalescingDiagnostic[];
} {
  const maxTables = input.maxTablesPerGroup ?? 4;
  const maxPrimaryPages = input.maxPrimaryPagesPerGroup ?? 8;
  const maxContextPages = input.maxContextPagesPerGroup ?? 4;
  const hints = new Map(input.map.entityHints.map((hint) => [hint.entityHintId, hint]));
  const scopeKey = (unit: CommercialExtractionUnit): string => {
    const channels = unit.entityHintIds
      .map((id) => hints.get(id))
      .filter((hint) => hint?.hintKind === 'CHANNEL')
      .map((hint) => normalized(hint!.value))
      .sort();
    return JSON.stringify([unit.documentId, [...unit.sectionIds].sort(), channels]);
  };
  const groups: CommercialExtractionUnit[][] = [];
  for (const unit of [...input.plan.units].sort((left, right) => left.ordinal - right.ordinal)) {
    const current = groups.at(-1);
    const combined = current ? [...current, unit] : [unit];
    const tables = uniqueSorted(combined.flatMap((item) => item.tableIds));
    const pages = uniqueSorted(combined.flatMap((item) => item.primaryPageIds));
    const contextPages = uniqueSorted(
      combined.flatMap((item) => item.contextPageIds).filter((id) => !pages.includes(id)),
    );
    const rows = combined.reduce((total, item) => total + (item.expectedTableRows ?? 0), 0);
    const safe =
      current?.every((item) => item.unitType === 'TABLE' && scopeKey(item) === scopeKey(unit)) ===
        true &&
      unit.unitType === 'TABLE' &&
      tables.length <= maxTables &&
      pages.length <= maxPrimaryPages &&
      contextPages.length <= maxContextPages &&
      rows <= 60;
    if (safe) current!.push(unit);
    else groups.push([unit]);
  }
  const units = groups.map((group, index): CommercialExtractionUnit => {
    const primaryPageIds = uniqueSorted(group.flatMap((unit) => unit.primaryPageIds));
    const contextPageIds = uniqueSorted(
      group.flatMap((unit) => unit.contextPageIds).filter((id) => !primaryPageIds.includes(id)),
    );
    return {
      unitId: `unit-${String(index + 1).padStart(4, '0')}-${group.every((unit) => unit.unitType === 'TABLE') ? 'table' : group[0]!.unitType.toLowerCase().replaceAll('_', '-')}`,
      unitType: group.every((unit) => unit.unitType === 'TABLE') ? 'TABLE' : group[0]!.unitType,
      ordinal: index + 1,
      documentId: group[0]!.documentId,
      primaryPageIds,
      contextPageIds,
      primaryContentBlockIds: uniqueSorted(group.flatMap((unit) => unit.primaryContentBlockIds)),
      contextContentBlockIds: uniqueSorted(group.flatMap((unit) => unit.contextContentBlockIds)),
      sectionIds: uniqueSorted(group.flatMap((unit) => unit.sectionIds)),
      tableIds: uniqueSorted(group.flatMap((unit) => unit.tableIds)),
      noteIds: uniqueSorted(group.flatMap((unit) => unit.noteIds)),
      entityHintIds: uniqueSorted(group.flatMap((unit) => unit.entityHintIds)),
      expectedTableRows: group.reduce((total, unit) => total + (unit.expectedTableRows ?? 0), 0),
      reason:
        group.length > 1
          ? 'Commercially coherent tables coalesced with bounded structural context.'
          : group[0]!.reason,
      overlaps: group
        .flatMap((unit) => unit.overlaps)
        .filter(
          (overlap, overlapIndex, all) =>
            all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(overlap)) ===
            overlapIndex,
        ),
    };
  });
  return {
    plan: { ...input.plan, units },
    diagnostics: units.map((unit, index) => ({
      groupUnitId: unit.unitId,
      sourceUnitIds: groups[index]!.map((source) => source.unitId),
      tableIds: unit.tableIds,
      pageCount: unit.primaryPageIds.length,
      contextPageCount: unit.contextPageIds.length,
      reason: groups[index]!.length > 1 ? 'SAME_COMMERCIAL_SCOPE' : 'NOT_COALESCED',
    })),
  };
}

export interface ProviderCallEfficiencyObservation {
  readonly stage: 'document_map' | 'table_ir' | 'unit_extraction';
  readonly unitId?: string;
  readonly pages: readonly number[];
  readonly requestOrdinal: number;
  readonly promptVersion: string;
  readonly instructionCharacters: number;
  readonly schemaCharacters: number;
  readonly documentContextCharacters: number;
  readonly estimatedInputTokens: number;
  readonly actualInputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly elapsedMs?: number;
  readonly retryCount?: number;
}

export const estimateTokensFromCharacters = (characters: number): number =>
  Math.ceil(characters / 4);

export function measureProviderCall(input: {
  readonly stage: ProviderCallEfficiencyObservation['stage'];
  readonly unitId?: string;
  readonly pages?: readonly number[];
  readonly requestOrdinal: number;
  readonly promptVersion: string;
  readonly instructions: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly documentContext?: string;
  readonly actual?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
    readonly elapsedMs: number;
    readonly retryCount?: number;
  };
}): ProviderCallEfficiencyObservation {
  const schemaCharacters = JSON.stringify(input.schema).length;
  const documentContextCharacters = input.documentContext?.length ?? 0;
  return {
    stage: input.stage,
    ...(input.unitId ? { unitId: input.unitId } : {}),
    pages: uniqueNumbers(input.pages ?? []),
    requestOrdinal: input.requestOrdinal,
    promptVersion: input.promptVersion,
    instructionCharacters: input.instructions.length,
    schemaCharacters,
    documentContextCharacters,
    estimatedInputTokens: estimateTokensFromCharacters(
      input.instructions.length + schemaCharacters + documentContextCharacters,
    ),
    ...(input.actual
      ? {
          actualInputTokens: input.actual.inputTokens,
          outputTokens: input.actual.outputTokens,
          totalTokens: input.actual.totalTokens,
          elapsedMs: input.actual.elapsedMs,
          ...(input.actual.retryCount === undefined ? {} : { retryCount: input.actual.retryCount }),
        }
      : {}),
  };
}

export function aggregateProviderCallEfficiency(
  observations: readonly ProviderCallEfficiencyObservation[],
) {
  const byStage = Object.fromEntries(
    ['document_map', 'table_ir', 'unit_extraction'].map((stage) => {
      const values = observations.filter((item) => item.stage === stage);
      return [
        stage,
        {
          calls: values.length,
          estimatedInputTokens: values.reduce(
            (total, item) => total + item.estimatedInputTokens,
            0,
          ),
          actualInputTokens: values.reduce(
            (total, item) => total + (item.actualInputTokens ?? 0),
            0,
          ),
          outputTokens: values.reduce((total, item) => total + (item.outputTokens ?? 0), 0),
          totalTokens: values.reduce((total, item) => total + (item.totalTokens ?? 0), 0),
        },
      ];
    }),
  );
  const byUnit = Object.fromEntries(
    observations
      .filter((item) => item.unitId)
      .map((item) => [item.unitId!, item.totalTokens ?? item.estimatedInputTokens]),
  );
  const repeatedContextEstimate = observations.reduce(
    (total, item, index) =>
      total +
      (index === 0
        ? 0
        : estimateTokensFromCharacters(item.instructionCharacters + item.schemaCharacters)),
    0,
  );
  return {
    callCount: observations.length,
    estimatedInputTokens: observations.reduce(
      (total, item) => total + item.estimatedInputTokens,
      0,
    ),
    actualTotalTokens: observations.reduce((total, item) => total + (item.totalTokens ?? 0), 0),
    repeatedContextEstimate,
    byStage,
    byUnit,
    largestRequests: [...observations]
      .sort((left, right) => right.estimatedInputTokens - left.estimatedInputTokens)
      .slice(0, 5),
  };
}

export interface CommercialCalibrationBudget {
  readonly maxEstimatedTotalTokens: number;
  readonly maxProviderCalls: number;
  readonly maxEstimatedCostUsd?: number;
  readonly estimatedCostPerMillionTokensUsd?: number;
}

export const JEEP_CALIBRATION_BUDGET_DEFAULTS = Object.freeze({
  maxEstimatedTotalTokens: 300_000,
  maxProviderCalls: 10,
  maxEstimatedCostUsd: 1,
});

export class CommercialCalibrationBudgetExceededError extends Error {
  readonly code = 'COMMERCIAL_CALIBRATION_BUDGET_EXCEEDED';
  constructor(
    readonly diagnostic: {
      readonly reason: 'TOKENS' | 'CALLS' | 'COST';
      readonly completedCalls: number;
      readonly estimatedTokens: number;
      readonly nextEstimatedTokens: number;
      readonly estimatedCostUsd?: number;
    },
  ) {
    super('COMMERCIAL_CALIBRATION_BUDGET_EXCEEDED');
    this.name = 'CommercialCalibrationBudgetExceededError';
  }
}

export function createCommercialCalibrationBudgetGuard(
  budget: CommercialCalibrationBudget,
  initial = { calls: 0, estimatedTokens: 0 },
) {
  let calls = initial.calls;
  let estimatedTokens = initial.estimatedTokens;
  return {
    reserve(nextEstimatedTokens: number): void {
      const nextCalls = calls + 1;
      const nextTotal = estimatedTokens + nextEstimatedTokens;
      const estimatedCostUsd =
        budget.estimatedCostPerMillionTokensUsd === undefined
          ? undefined
          : (nextTotal / 1_000_000) * budget.estimatedCostPerMillionTokensUsd;
      const reason =
        nextCalls > budget.maxProviderCalls
          ? 'CALLS'
          : nextTotal > budget.maxEstimatedTotalTokens
            ? 'TOKENS'
            : budget.maxEstimatedCostUsd !== undefined &&
                estimatedCostUsd !== undefined &&
                estimatedCostUsd > budget.maxEstimatedCostUsd
              ? 'COST'
              : undefined;
      if (reason)
        throw new CommercialCalibrationBudgetExceededError({
          reason,
          completedCalls: calls,
          estimatedTokens,
          nextEstimatedTokens,
          ...(estimatedCostUsd === undefined ? {} : { estimatedCostUsd }),
        });
      calls = nextCalls;
      estimatedTokens = nextTotal;
    },
    snapshot: () => ({ calls, estimatedTokens }),
  };
}

export const JEEP_10R5_EFFICIENCY_BASELINE = Object.freeze({
  providerCalls: 25,
  actualTotalTokens: 2_330_000,
  repeatedDocumentContextCalls: 24,
  approximateCostUsd: 7,
});

export function compareCommercialExtractionEfficiency(input: {
  readonly candidate: readonly ProviderCallEfficiencyObservation[];
  readonly fixedDocumentMapTokens?: number;
  readonly fixedTableIRTokens?: number;
}) {
  const aggregate = aggregateProviderCallEfficiency(input.candidate);
  const projectedTokens =
    (input.fixedDocumentMapTokens ?? 100_713) +
    (input.fixedTableIRTokens ?? 100_000) +
    aggregate.estimatedInputTokens;
  const projectedCalls = 2 + input.candidate.length;
  return {
    baseline: JEEP_10R5_EFFICIENCY_BASELINE,
    candidate: { projectedCalls, projectedTokens, ...aggregate },
    status: projectedCalls <= 10 && projectedTokens <= 300_000 ? 'PASS' : 'FAIL',
  } as const;
}
