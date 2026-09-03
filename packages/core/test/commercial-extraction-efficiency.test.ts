import { describe, expect, it } from 'vitest';

import {
  aggregateProviderCallEfficiency,
  buildCommercialCompactPromptCandidate,
  buildStructuralCommercialTableIR,
  coalesceCommercialExtractionUnitPlan,
  compareCommercialExtractionEfficiency,
  createCommercialCalibrationBudgetGuard,
  createCommercialTableIR,
  measureProviderCall,
} from '../src/import/commercial-extraction-efficiency';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';
import { commercialDocumentExtractionSchemaV1 } from '../src/import/commercial-document-extraction-schema';
import {
  buildSegmentedExtractionUnitContext,
  buildSegmentedExtractionUnitInstructions,
} from '../src/import/segmented-extraction-orchestrator';
import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  gwmLikeCommercialDocumentMapFixture,
} from './fixtures/import/commercial-document-map-fixtures';

describe('CommercialTableIR/1', () => {
  it('preserves merged cells, option operators, dealer position and provenance without page text duplication', () => {
    const plan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const unit = plan.units.find((item) => item.tableIds.length)!;
    const blockId = unit.primaryContentBlockIds[0]!;
    const ir = buildStructuralCommercialTableIR({
      map: gwmLikeCommercialDocumentMapFixture,
      unit,
      populatedTables: {
        'table-main-13': {
          rows: [
            {
              rowId: 'row-1',
              product: 'Family Gamma',
              version: 'Longitude',
              rawProductionYear: '26',
              rawModelYear: '27',
              cells: [
                { columnId: 'column-04', rawValue: '0% OU bônus', sourceBlockIds: [blockId] },
              ],
              sourceBlockIds: [blockId],
            },
          ],
          mergedCellGroups: [
            {
              groupId: 'merged-1',
              rowIds: ['row-1'],
              columnIds: ['column-04'],
              rawValue: '0% OU bônus',
              rowSpan: 1,
              sourceBlockIds: [blockId],
            },
          ],
          optionLabels: ['Opção 1', 'Opção 2'],
          structuralOperators: ['OR'],
          dealerParticipationPositions: [
            { rowId: 'row-1', columnId: 'column-04', sourceBlockIds: [blockId] },
          ],
        },
      },
    });

    expect(ir.schemaVersion).toBe('CommercialTableIR/1');
    expect(ir.tables[0]?.rows[0]).toMatchObject({
      product: 'Family Gamma',
      version: 'Longitude',
      rawProductionYear: '26',
      rawModelYear: '27',
    });
    expect(ir.tables[0]?.mergedCellGroups[0]?.rawValue).toBe('0% OU bônus');
    expect(ir.tables[0]?.structuralOperators).toEqual(['OR']);
    expect(ir.tables[0]?.dealerParticipationPositions[0]?.columnId).toBe('column-04');
    expect(JSON.stringify(ir)).not.toContain('Synthetic structural block');
  });

  it('fails closed for provenance and merged-row references outside the IR', () => {
    expect(() =>
      createCommercialTableIR({
        documentOrdinal: 1,
        channel: 'RETAIL',
        sectionIds: ['section-1'],
        tables: [
          {
            tableId: 'table-1',
            pageNumbers: [1],
            sectionIds: ['section-1'],
            headers: [],
            rows: [],
            mergedCellGroups: [],
            optionLabels: [],
            structuralOperators: [],
            dealerParticipationPositions: [],
            noteIds: [],
            sourceBlockIds: ['missing-block'],
          },
        ],
        governingNotes: [],
        provenanceSourceBlockIds: [],
      }),
    ).toThrow('COMMERCIAL_TABLE_IR_UNKNOWN_PROVENANCE');
  });

  it('selects shared, document-wide and table-specific notes structurally', () => {
    const geelyPlan = createCommercialExtractionUnitPlan(geelyLikeCommercialDocumentMapFixture);
    const geelyUnit = geelyPlan.units.find((unit) => unit.tableIds.includes('table-family-a'))!;
    const shared = buildStructuralCommercialTableIR({
      map: geelyLikeCommercialDocumentMapFixture,
      unit: geelyUnit,
    });
    expect(shared.tables.map((table) => table.tableId)).toEqual(['table-family-a']);
    expect(shared.governingNotes.map((note) => note.noteId)).toContain('note-later-general-rule');

    const fiatPlan = createCommercialExtractionUnitPlan(fiatLikeCommercialDocumentMapFixture);
    const fiatUnit = fiatPlan.units.find((unit) => unit.tableIds.length)!;
    const documentWide = buildStructuralCommercialTableIR({
      map: fiatLikeCommercialDocumentMapFixture,
      unit: fiatUnit,
    });
    expect(documentWide.governingNotes.map((note) => note.noteId)).toContain('note-floor-plan');

    const gwmPlan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const gwmUnit = gwmPlan.units.find((unit) => unit.tableIds.length)!;
    const tableSpecific = buildStructuralCommercialTableIR({
      map: gwmLikeCommercialDocumentMapFixture,
      unit: gwmUnit,
    });
    expect(tableSpecific.governingNotes.map((note) => note.noteId)).toEqual(['note-main-footnote']);
  });
});

describe('commercial unit coalescing', () => {
  it('groups only consecutive tables in the same bounded commercial scope', () => {
    const base = createCommercialExtractionUnitPlan(fiatLikeCommercialDocumentMapFixture);
    const tableUnits = base.units
      .filter((unit) => unit.unitType === 'TABLE')
      .map((unit, index) => ({
        ...unit,
        ordinal: index + 1,
        sectionIds: ['section-shared-retail'],
        noteIds: ['note-floor-plan'],
        expectedTableRows: 10,
      }));
    const plan = { ...base, units: tableUnits };
    const result = coalesceCommercialExtractionUnitPlan({
      map: fiatLikeCommercialDocumentMapFixture,
      plan,
      maxTablesPerGroup: 4,
    });

    expect(tableUnits).toHaveLength(6);
    expect(result.plan.units).toHaveLength(2);
    expect(result.plan.units.map((unit) => unit.tableIds.length)).toEqual([4, 2]);
    expect(result.diagnostics.map((item) => item.sourceUnitIds.length)).toEqual([4, 2]);
  });

  it('does not cross channel or section boundaries', () => {
    const base = createCommercialExtractionUnitPlan(fiatLikeCommercialDocumentMapFixture);
    const tableUnits = base.units.filter((unit) => unit.unitType === 'TABLE').slice(0, 2);
    const result = coalesceCommercialExtractionUnitPlan({
      map: fiatLikeCommercialDocumentMapFixture,
      plan: { ...base, units: tableUnits },
    });
    expect(result.plan.units).toHaveLength(2);
    expect(result.diagnostics.every((item) => item.reason === 'NOT_COALESCED')).toBe(true);
  });
});

describe('token forensics and calibration budget', () => {
  it('reports request footprint and aggregate duplication without source excerpts', () => {
    const calls = [1, 2].map((requestOrdinal) =>
      measureProviderCall({
        stage: 'unit_extraction',
        unitId: `unit-${requestOrdinal}`,
        pages: [requestOrdinal],
        requestOrdinal,
        promptVersion: '12',
        instructions: 'x'.repeat(400),
        schema: { type: 'object' },
        documentContext: 'y'.repeat(200),
        actual: {
          inputTokens: 160,
          outputTokens: 20,
          totalTokens: 180,
          elapsedMs: 10,
          retryCount: 0,
        },
      }),
    );
    const aggregate = aggregateProviderCallEfficiency(calls);
    expect(aggregate.callCount).toBe(2);
    expect(aggregate.actualTotalTokens).toBe(360);
    expect(aggregate.repeatedContextEstimate).toBeGreaterThan(100);
    expect(aggregate.byUnit).toEqual({ 'unit-1': 180, 'unit-2': 180 });
  });

  it('aborts before the request that exceeds calls, tokens or estimated cost', () => {
    const guard = createCommercialCalibrationBudgetGuard({
      maxEstimatedTotalTokens: 300_000,
      maxProviderCalls: 2,
      maxEstimatedCostUsd: 1,
      estimatedCostPerMillionTokensUsd: 2,
    });
    guard.reserve(100_000);
    guard.reserve(100_000);
    expect(() => guard.reserve(1)).toThrow('COMMERCIAL_CALIBRATION_BUDGET_EXCEEDED');
    expect(guard.snapshot()).toEqual({ calls: 2, estimatedTokens: 200_000 });
  });

  it('projects eight bounded compact extraction groups within the Jeep ceilings', () => {
    const plan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const unit = plan.units.find((item) => item.tableIds.length)!;
    const context = buildSegmentedExtractionUnitContext(gwmLikeCommercialDocumentMapFixture, unit);
    const ir = buildStructuralCommercialTableIR({ map: gwmLikeCommercialDocumentMapFixture, unit });
    const groupedIR = createCommercialTableIR({
      ...ir,
      tables: Array.from({ length: 4 }, (_, index) => ({
        ...ir.tables[0]!,
        tableId: `table-group-${index + 1}`,
        pageNumbers: [index + 1],
      })),
    });
    const instructions = buildCommercialCompactPromptCandidate({
      unitId: unit.unitId,
      primaryPages: context.primaryPages.map((page) => page.pageNumber),
      tableIR: groupedIR,
    });
    const currentInstructions = buildSegmentedExtractionUnitInstructions(context);
    const candidate = Array.from({ length: 8 }, (_, index) =>
      measureProviderCall({
        stage: 'unit_extraction',
        unitId: `unit-${index + 1}`,
        pages: [index + 1],
        requestOrdinal: index + 3,
        promptVersion: '12',
        instructions,
        schema: commercialDocumentExtractionSchemaV1,
        documentContext: JSON.stringify(groupedIR),
      }),
    );
    const comparison = compareCommercialExtractionEfficiency({ candidate });
    const reportEnabled = (
      globalThis as { readonly process?: { readonly env?: Readonly<Record<string, string>> } }
    ).process?.env?.REPORT_10R6_EFFICIENCY;
    if (reportEnabled === '1')
      console.info(
        'SPRINT_10R6_EFFICIENCY',
        JSON.stringify({
          baseline: comparison.baseline,
          candidate: {
            projectedCalls: comparison.candidate.projectedCalls,
            projectedTokens: comparison.candidate.projectedTokens,
            repeatedContextEstimate: comparison.candidate.repeatedContextEstimate,
            maxSingleCallPayload: comparison.candidate.largestRequests[0]?.estimatedInputTokens,
            averageExtractionPayload: Math.ceil(
              comparison.candidate.estimatedInputTokens / candidate.length,
            ),
            promptCharacters: instructions.length,
            currentPromptCharacters: currentInstructions.length,
            promptReductionPercent: Number(
              ((1 - instructions.length / currentInstructions.length) * 100).toFixed(2),
            ),
            schemaCharacters: JSON.stringify(commercialDocumentExtractionSchemaV1).length,
            irCharacters: JSON.stringify(groupedIR).length,
          },
          status: comparison.status,
        }),
      );
    expect(comparison.candidate.projectedCalls).toBe(10);
    expect(comparison.candidate.projectedTokens).toBeLessThanOrEqual(300_000);
    expect(comparison.status).toBe('PASS');
  });
});

describe('v12 compact candidate', () => {
  it('retains the discriminative v11 rules with a materially smaller repeated prompt', () => {
    const plan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const unit = plan.units.find((item) => item.tableIds.length)!;
    const context = buildSegmentedExtractionUnitContext(gwmLikeCommercialDocumentMapFixture, unit);
    const ir = buildStructuralCommercialTableIR({ map: gwmLikeCommercialDocumentMapFixture, unit });
    const current = buildSegmentedExtractionUnitInstructions(context);
    const candidate = buildCommercialCompactPromptCandidate({
      unitId: unit.unitId,
      primaryPages: context.primaryPages.map((page) => page.pageNumber),
      tableIR: ir,
    });
    expect(candidate).toContain('productionYear/modelYear are atomic');
    expect(candidate).toContain('merged spans');
    expect(candidate).toContain('dealer-participation position');
    expect(candidate).toContain('only for VAREJO');
    expect(candidate).toContain('Without explicit composition');
    expect(candidate).toContain('Invoice discount requires explicit NF/N.F');
    expect(candidate.length).toBeLessThan(current.length * 0.75);
  });
});
