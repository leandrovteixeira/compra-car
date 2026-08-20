import { describe, expect, it } from 'vitest';
import type { CommercialDocumentExtractionV1 } from '../src/import/commercial-document-extraction';
import {
  reconcileCommercialDocumentExtractions,
  type CommercialDocumentReconciliationArtifactInput,
} from '../src/import/commercial-document-reconciliation';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';
import type { CommercialDocumentMapV1 } from '../src/import/commercial-document-map';
import {
  fiatLikeCommercialDocumentExtractionFixture,
  geelyLikeCommercialDocumentExtractionFixture,
  volvoLikeCommercialDocumentExtractionFixture,
} from './fixtures/import/commercial-document-extraction-fixtures';
import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  volvoLikeCommercialDocumentMapFixture,
  vwLikeCommercialDocumentMapFixture,
} from './fixtures/import/commercial-document-map-fixtures';

const singleUnitMap: CommercialDocumentMapV1 = {
  schemaVersion: 'CommercialDocumentMap/1',
  documentCount: 1,
  pageCount: 1,
  documents: [
    {
      documentId: 'document-single',
      ordinal: 1,
      pageCount: 1,
      documentKindCandidate: 'commercial_letter',
      titleHints: [],
      issuerHints: [],
      competenceHints: [],
      validityHints: [],
    },
  ],
  pages: [
    {
      pageId: 'page-single',
      documentId: 'document-single',
      pageNumber: 1,
      role: 'table_content',
      sectionIds: ['section-single'],
      tableIds: ['table-single'],
      noteIds: [],
      entityHintIds: [],
      contextEdgeIds: [],
      contentBlockIds: ['block-header', 'block-table'],
    },
  ],
  contentBlocks: [
    {
      contentBlockId: 'block-header',
      documentId: 'document-single',
      pageId: 'page-single',
      blockKind: 'HEADING',
    },
    {
      contentBlockId: 'block-table',
      documentId: 'document-single',
      pageId: 'page-single',
      blockKind: 'TABLE_REGION',
    },
  ],
  sections: [
    {
      sectionId: 'section-single',
      documentId: 'document-single',
      semanticRole: 'FAMILY',
      pageIds: ['page-single'],
      entityHintIds: [],
      sourceBlockIds: ['block-header', 'block-table'],
    },
  ],
  tables: [
    {
      tableId: 'table-single',
      documentId: 'document-single',
      pageIds: ['page-single'],
      headerBlockIds: ['block-header'],
      segments: [
        {
          pageId: 'page-single',
          position: 'WHOLE',
          inheritedHeaderBlockIds: [],
          sourceBlockIds: ['block-table'],
        },
      ],
      approximateRowCount: 4,
      columnHeaderLabels: ['Vehicle'],
      entityHintIds: [],
      footnoteNoteIds: [],
      contextEdgeIds: [],
      sourceBlockIds: ['block-header', 'block-table'],
    },
  ],
  notes: [],
  entityHints: [],
  contextEdges: [],
};

const clone = <T>(value: T): T => structuredClone(value);
const inputFor = (
  map = geelyLikeCommercialDocumentMapFixture,
  artifact: CommercialDocumentExtractionV1 = geelyLikeCommercialDocumentExtractionFixture,
) => {
  const unitPlan = createCommercialExtractionUnitPlan(map);
  const artifacts: CommercialDocumentReconciliationArtifactInput[] = unitPlan.units.map((unit) => ({
    unitId: unit.unitId,
    ordinal: unit.ordinal,
    artifact: clone(artifact),
  }));
  return { documentMap: map, unitPlan, artifacts };
};
const codes = (result: ReturnType<typeof reconcileCommercialDocumentExtractions>) =>
  result.issues.map((issue) => issue.code);
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

describe('Sprint 10C.3D-A deterministic merge/reconciliation', () => {
  it('A/T reconciles one planned unit and one artifact with complete coverage', () => {
    const input = inputFor(singleUnitMap);
    const result = reconcileCommercialDocumentExtractions(input);
    expect(result.coverage).toMatchObject({
      status: 'complete',
      plannedUnitCount: 1,
      validArtifactCount: 1,
    });
    expect(result.sourceArtifacts).toHaveLength(1);
  });

  it('B merges multiple units without overlap and retains their distinct entities', () => {
    const input = inputFor();
    const second = clone(geelyLikeCommercialDocumentExtractionFixture);
    const distinct = {
      ...second,
      vehicleIdentities: second.vehicleIdentities.map((vehicle) => ({
        ...vehicle,
        model: `${vehicle.model} distinct`,
      })),
    };
    input.artifacts[1] = { ...input.artifacts[1]!, artifact: distinct };
    const result = reconcileCommercialDocumentExtractions(input);
    expect(result.vehicleIdentities.length).toBeGreaterThan(
      geelyLikeCommercialDocumentExtractionFixture.vehicleIdentities.length,
    );
  });

  it('C/D/E deduplicates equal facts and identities while preserving every provenance ref', () => {
    const result = reconcileCommercialDocumentExtractions(inputFor());
    expect(result.facts).toHaveLength(geelyLikeCommercialDocumentExtractionFixture.facts.length);
    expect(result.vehicleIdentities).toHaveLength(
      geelyLikeCommercialDocumentExtractionFixture.vehicleIdentities.length,
    );
    expect(result.facts[0]!.provenance).toHaveLength(result.coverage.plannedUnitCount);
    expect(result.duplicates.some((item) => item.duplicateType === 'FACT')).toBe(true);
    expect(result.duplicates.some((item) => item.duplicateType === 'IDENTITY')).toBe(true);
  });

  it('F makes incompatible facts explicit instead of choosing one', () => {
    const input = inputFor();
    const conflicting = clone(geelyLikeCommercialDocumentExtractionFixture);
    const changed = {
      ...conflicting,
      facts: conflicting.facts.map((fact, index) =>
        index === 0
          ? { ...fact, value: { kind: 'money' as const, amount: '999999.00', currency: 'BRL' } }
          : fact,
      ),
    };
    input.artifacts[1] = { ...input.artifacts[1]!, artifact: changed };
    const result = reconcileCommercialDocumentExtractions(input);
    expect(codes(result)).toContain('FACT_CONFLICT');
    expect(result.status).toBe('conflicted');
    expect(result.facts).toContainEqual(
      expect.objectContaining({
        value: expect.objectContaining({ value: expect.objectContaining({ amount: '999999.00' }) }),
      }),
    );
  });

  it('G preserves conflicting documentary years as separate identities', () => {
    const input = inputFor();
    const conflicting = clone(geelyLikeCommercialDocumentExtractionFixture);
    const changed = {
      ...conflicting,
      vehicleIdentities: conflicting.vehicleIdentities.map((vehicle, index) =>
        index === 0 ? { ...vehicle, modelYear: 2099 } : vehicle,
      ),
    };
    input.artifacts[1] = { ...input.artifacts[1]!, artifact: changed };
    const result = reconcileCommercialDocumentExtractions(input);
    expect(codes(result)).toContain('IDENTITY_CONFLICT');
    expect(result.vehicleIdentities.some((item) => item.value.modelYear === 2099)).toBe(true);
  });

  it('H/U reports a planned unit without artifact as partial coverage', () => {
    const input = inputFor();
    input.artifacts.pop();
    const result = reconcileCommercialDocumentExtractions(input);
    expect(codes(result)).toContain('MISSING_UNIT_ARTIFACT');
    expect(result.coverage.status).toBe('partial');
  });

  it('I reports an artifact without a planned unit', () => {
    const input = inputFor();
    input.artifacts.push({
      unitId: 'unit-unplanned',
      ordinal: 999,
      artifact: clone(geelyLikeCommercialDocumentExtractionFixture),
    });
    expect(codes(reconcileCommercialDocumentExtractions(input))).toContain('UNPLANNED_ARTIFACT');
  });

  it('J reports duplicate artifacts for the same unit', () => {
    const input = inputFor();
    input.artifacts.push(clone(input.artifacts[0]!));
    expect(codes(reconcileCommercialDocumentExtractions(input))).toContain(
      'DUPLICATE_UNIT_ARTIFACT',
    );
  });

  it('reports invalid artifacts and inconsistent ordinals safely', () => {
    const input = inputFor();
    input.artifacts[0] = {
      ...input.artifacts[0]!,
      ordinal: 999,
      artifact: { schemaVersion: 'wrong' },
    };
    const resultCodes = codes(reconcileCommercialDocumentExtractions(input));
    expect(resultCodes).toContain('INVALID_ARTIFACT');
    expect(resultCodes).toContain('INCONSISTENT_UNIT_ORDINAL');
  });

  it('K/N orders a complete logical table and preserves inherited-header provenance', () => {
    const result = reconcileCommercialDocumentExtractions(
      inputFor(vwLikeCommercialDocumentMapFixture),
    );
    const table = result.coverage.logicalTables[0]!;
    expect(table.availablePartitionIndexes).toEqual(
      Array.from({ length: table.expectedPartitionCount }, (_, index) => index + 1),
    );
    expect(table.structurallyContinuous).toBe(true);
    expect(table.inheritedHeaderBlockIds.length).toBeGreaterThan(0);
  });

  it('L reports a missing logical-table partition and refuses structural continuity', () => {
    const input = inputFor(vwLikeCommercialDocumentMapFixture);
    const partitionIndex = input.unitPlan.units.findIndex((unit) => unit.partition?.index === 2);
    input.artifacts.splice(partitionIndex, 1);
    const result = reconcileCommercialDocumentExtractions(input);
    expect(codes(result)).toContain('MISSING_TABLE_PARTITION');
    expect(result.coverage.logicalTables[0]!.structurallyContinuous).toBe(false);
  });

  it('M reports a duplicate logical-table partition', () => {
    const input = inputFor(vwLikeCommercialDocumentMapFixture);
    const partitionIndex = input.unitPlan.units.findIndex((unit) => Boolean(unit.partition));
    input.artifacts.push(clone(input.artifacts[partitionIndex]!));
    expect(codes(reconcileCommercialDocumentExtractions(input))).toContain(
      'DUPLICATE_TABLE_PARTITION',
    );
  });

  it('O detects a dangling source reference in an invalid artifact', () => {
    const input = inputFor();
    const dangling = clone(geelyLikeCommercialDocumentExtractionFixture);
    const changed = {
      ...dangling,
      facts: dangling.facts.map((fact, index) =>
        index === 0 ? { ...fact, scopeIds: ['scope-does-not-exist'] } : fact,
      ),
    };
    input.artifacts[0] = { ...input.artifacts[0]!, artifact: changed };
    expect(codes(reconcileCommercialDocumentExtractions(input))).toContain('DANGLING_REFERENCE');
  });

  it('P/Q deduplicates identical scopes and preserves exclusions', () => {
    const result = reconcileCommercialDocumentExtractions(inputFor());
    expect(result.scopes).toHaveLength(geelyLikeCommercialDocumentExtractionFixture.scopes.length);
    expect(result.duplicates.some((item) => item.duplicateType === 'SCOPE')).toBe(true);
    expect(result.scopes.some((item) => Object.keys(item.value.exclusions).length > 0)).toBe(true);
  });

  it('R/S preserves cumulative and alternative composition', () => {
    const result = reconcileCommercialDocumentExtractions(inputFor());
    expect(result.composition.groups.some((group) => group.groupType === 'CUMULATIVE')).toBe(true);
    expect(result.composition.groups.some((group) => group.groupType === 'ALTERNATIVE')).toBe(true);
  });

  it('V/W produces canonical ordering and byte-equivalent output for permuted inputs', () => {
    const input = inputFor();
    const first = reconcileCommercialDocumentExtractions(input);
    const second = reconcileCommercialDocumentExtractions({
      ...clone(input),
      artifacts: [...clone(input.artifacts)].reverse(),
    });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.vehicleIdentities.map((item) => item.reconciledId)).toEqual(
      [...first.vehicleIdentities.map((item) => item.reconciledId)].sort(),
    );
  });

  it('X never mutates deep-frozen map, plan, or source artifacts', () => {
    const input = deepFreeze(inputFor());
    expect(() => reconcileCommercialDocumentExtractions(input)).not.toThrow();
  });

  it('Y handles a Fiat-like set of 100 identities with indexed dedupe', () => {
    const input = inputFor(
      fiatLikeCommercialDocumentMapFixture,
      fiatLikeCommercialDocumentExtractionFixture,
    );
    const result = reconcileCommercialDocumentExtractions(input);
    expect(result.vehicleIdentities).toHaveLength(100);
  });

  it('Z preserves Volvo-like multi-channel facts and scopes', () => {
    const result = reconcileCommercialDocumentExtractions(
      inputFor(volvoLikeCommercialDocumentMapFixture, volvoLikeCommercialDocumentExtractionFixture),
    );
    expect(
      new Set(result.facts.map((item) => item.value.channel).filter(Boolean)).size,
    ).toBeGreaterThan(1);
    expect(result.vehicleIdentities).toHaveLength(20);
  });

  it('AA creates no Product, Policy, Offer, promotion plan, or runtime side effect', () => {
    const serialized = JSON.stringify(reconcileCommercialDocumentExtractions(inputFor()));
    expect(serialized).not.toMatch(/productId|commercialPolicy|commercialOffer|promotionPlan/iu);
  });
});
