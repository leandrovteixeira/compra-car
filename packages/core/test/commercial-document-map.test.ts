import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_DOCUMENT_MAP_LIMITS,
  COMMERCIAL_EXTRACTION_UNIT_LIMITS,
} from '../src/import/commercial-document-map';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';
import {
  commercialDocumentMapSchemaV1,
  commercialExtractionUnitPlanSchemaV1,
} from '../src/import/commercial-document-map-schema';
import {
  CommercialDocumentMapValidationError,
  CommercialExtractionUnitPlanValidationError,
  sanitizeCommercialDocumentMapAjvErrors,
  validateCommercialDocumentMap,
  validateCommercialExtractionUnitPlan,
} from '../src/import/commercial-document-map-validator';
import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  gwmLikeCommercialDocumentMapFixture,
  volvoLikeCommercialDocumentMapFixture,
  vwLikeCommercialDocumentMapFixture,
} from './fixtures/import/commercial-document-map-fixtures';

const fixtures = [
  ['Geely-like', geelyLikeCommercialDocumentMapFixture],
  ['GWM-like', gwmLikeCommercialDocumentMapFixture],
  ['Fiat-like', fiatLikeCommercialDocumentMapFixture],
  ['Volvo-like', volvoLikeCommercialDocumentMapFixture],
  ['VW-like', vwLikeCommercialDocumentMapFixture],
] as const;

const expectInvalidMap = (value: unknown, issue?: string): void => {
  try {
    validateCommercialDocumentMap(value);
    throw new Error('Expected map validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(CommercialDocumentMapValidationError);
    if (issue)
      expect((error as CommercialDocumentMapValidationError).issues.join('\n')).toContain(issue);
  }
};

describe('CommercialDocumentMap/1 and deterministic unit planning', () => {
  it('publishes strict Draft 2020-12 schemas for the two contracts', () => {
    const ajv = new Ajv2020({ strict: true });
    expect(ajv.validateSchema(commercialDocumentMapSchemaV1)).toBe(true);
    expect(ajv.validateSchema(commercialExtractionUnitPlanSchemaV1)).toBe(true);
    expect(commercialDocumentMapSchemaV1.additionalProperties).toBe(false);
    expect(commercialExtractionUnitPlanSchemaV1.additionalProperties).toBe(false);
  });

  it.each(fixtures)('accepts and plans the %s synthetic fixture', (_name, map) => {
    try {
      validateCommercialDocumentMap(map);
    } catch (error) {
      if (error instanceof CommercialDocumentMapValidationError)
        throw new Error(error.issues.join('\n'));
      throw error;
    }
    const plan = createCommercialExtractionUnitPlan(map);
    try {
      validateCommercialExtractionUnitPlan(plan, map);
    } catch (error) {
      if (error instanceof CommercialExtractionUnitPlanValidationError)
        throw new Error(error.issues.join('\n'));
      throw error;
    }
    expect(plan.coverage.allPagesClassified).toBe(true);
  });

  it('rejects inconsistent totals, duplicate IDs and non-contiguous document pages', () => {
    const map = geelyLikeCommercialDocumentMapFixture;
    expectInvalidMap({ ...map, pageCount: 5 }, '/pageCount: inconsistent');
    expectInvalidMap({ ...map, pages: [...map.pages, map.pages[0]] }, 'duplicateId');
    expectInvalidMap(
      { ...map, documents: [{ ...map.documents[0], pageCount: 7 }] },
      'nonContiguousPages',
    );
  });

  it('rejects dangling section, table, note, hint, edge and content references', () => {
    const map = geelyLikeCommercialDocumentMapFixture;
    expectInvalidMap(
      {
        ...map,
        pages: map.pages.map((page, index) =>
          index === 0
            ? {
                ...page,
                sectionIds: ['section-missing'],
                tableIds: ['table-missing'],
                noteIds: ['note-missing'],
                entityHintIds: ['hint-missing'],
                contextEdgeIds: ['edge-missing'],
                contentBlockIds: ['block-missing'],
              }
            : page,
        ),
      },
      'unknownRef',
    );
  });

  it('reports schema and invariant failures without exposing document values', () => {
    const secret = 'commercial-secret-value';
    const sanitized = sanitizeCommercialDocumentMapAjvErrors([
      {
        instancePath: '/documents/0',
        schemaPath: '#/$defs/document/required',
        keyword: 'required',
        params: { missingProperty: secret },
        message: `must have required property '${secret}'`,
      },
    ]);
    expect(sanitized).toMatchObject({
      totalViolations: 1,
      sampledViolations: [{ path: '/documents/0', keyword: 'required', category: 'schema' }],
      truncated: false,
      keywordCounts: { required: 1 },
    });
    expect(JSON.stringify(sanitized)).not.toContain(secret);

    const invalid = {
      ...geelyLikeCommercialDocumentMapFixture,
      pages: geelyLikeCommercialDocumentMapFixture.pages.map((page, index) =>
        index === 0 ? { ...page, pageNumber: page.pageNumber + 100 } : page,
      ),
    };
    try {
      validateCommercialDocumentMap(invalid);
      throw new Error('Expected invariant validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentMapValidationError);
      expect(error).toMatchObject({
        code: 'COMMERCIAL_DOCUMENT_MAP_INVALID',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            path: '/pages/0/pageNumber',
            keyword: 'outOfRange',
            category: 'semantic',
          }),
        ]),
      });
    }
  });

  it('keeps the true AJV violation count while bounding the safe sample', () => {
    const invalid = {
      ...geelyLikeCommercialDocumentMapFixture,
      pages: Array.from({ length: 101 }, (_, index) => ({
        ...geelyLikeCommercialDocumentMapFixture.pages[0],
        pageId: `page-${String(index + 1).padStart(3, '0')}`,
        role: 'not-a-role',
      })),
    };
    try {
      validateCommercialDocumentMap(invalid);
      throw new Error('Expected schema validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentMapValidationError);
      const validation = error as CommercialDocumentMapValidationError;
      expect(validation.totalViolations).toBe(101);
      expect(validation.diagnostics).toHaveLength(30);
      expect(validation.truncated).toBe(true);
      expect(validation.keywordCounts).toEqual({ enum: 101 });
      expect(validation.message).toContain('101');
    }
  });

  it('distinguishes malformed IDs, extra properties and dangling source references', () => {
    const malformedId = structuredClone(geelyLikeCommercialDocumentMapFixture);
    (malformedId.pages[0] as { pageId: string }).pageId = 'invalid id';
    expectInvalidMap(malformedId, 'pattern');

    expectInvalidMap(
      { ...geelyLikeCommercialDocumentMapFixture, unexpectedCommercialField: 'redacted' },
      'additionalProperties',
    );

    const dangling = structuredClone(geelyLikeCommercialDocumentMapFixture);
    (dangling.sections[0] as unknown as { sourceBlockIds: string[] }).sourceBlockIds = [
      'block-missing',
    ];
    try {
      validateCommercialDocumentMap(dangling);
      throw new Error('Expected referential validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentMapValidationError);
      expect(error).toMatchObject({
        diagnostics: [expect.objectContaining({ keyword: 'unknownRef', category: 'referential' })],
      });
      expect(JSON.stringify(error)).not.toContain('block-missing');
    }
  });

  it('rejects invalid table continuation and inherited header references', () => {
    const map = gwmLikeCommercialDocumentMapFixture;
    const table = map.tables[0]!;
    expectInvalidMap(
      {
        ...map,
        tables: [
          {
            ...table,
            segments: table.segments.map((segment, index) =>
              index === 1
                ? { ...segment, pageId: 'page-004', inheritedHeaderBlockIds: ['block-missing'] }
                : segment,
            ),
          },
        ],
      },
      'segments: pagesMismatch',
    );
  });

  it('keeps a single-page table as one TABLE unit instead of page-default segmentation', () => {
    const plan = createCommercialExtractionUnitPlan(geelyLikeCommercialDocumentMapFixture);
    const unit = plan.units.find((item) => item.tableIds.includes('table-family-a'));
    expect(unit?.unitType).toBe('TABLE');
    expect(unit?.primaryPageIds).toEqual(['page-002']);
    expect(unit?.partition).toBeUndefined();
  });

  it('keeps the GWM-like multipage table and its 13 rows in one logical unit', () => {
    const plan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const units = plan.units.filter((unit) => unit.tableIds.includes('table-main-13'));
    expect(units).toHaveLength(1);
    expect(units[0]?.primaryPageIds).toEqual(['page-002', 'page-003']);
    expect(units[0]?.expectedTableRows).toBe(13);
  });

  it('carries inherited header blocks into later table partitions as context-only overlap', () => {
    const plan = createCommercialExtractionUnitPlan(vwLikeCommercialDocumentMapFixture);
    const laterPartition = plan.units.find(
      (unit) => unit.logicalTableId === 'table-dense-a' && unit.partition?.index === 2,
    );
    expect(laterPartition?.contextContentBlockIds).toContain('block-dense-a-header');
    expect(laterPartition?.overlaps).toContainEqual({
      refType: 'CONTENT_BLOCK',
      refId: 'block-dense-a-header',
      usage: 'CONTEXT_ONLY',
      reason: 'INHERITED_HEADER',
    });
  });

  it('makes a table footnote reachable without making its block primary table content', () => {
    const plan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const tableUnit = plan.units.find((unit) => unit.tableIds.includes('table-main-13'))!;
    expect(tableUnit.noteIds).toContain('note-main-footnote');
    expect(tableUnit.contextContentBlockIds).toContain('block-main-footnote');
    expect(tableUnit.primaryContentBlockIds).not.toContain('block-main-footnote');
  });

  it('propagates section-wide notes only through their mapped structural scope', () => {
    const plan = createCommercialExtractionUnitPlan(fiatLikeCommercialDocumentMapFixture);
    const financingUnits = plan.units.filter((unit) =>
      unit.sectionIds.includes('section-financing'),
    );
    const familyUnits = plan.units.filter((unit) =>
      unit.sectionIds.includes('section-family-group-1'),
    );
    expect(financingUnits.some((unit) => unit.noteIds.includes('note-financing'))).toBe(true);
    expect(familyUnits.some((unit) => unit.noteIds.includes('note-financing'))).toBe(false);
  });

  it('keeps a later document/general rule reachable from earlier table units', () => {
    const plan = createCommercialExtractionUnitPlan(geelyLikeCommercialDocumentMapFixture);
    for (const unit of plan.units.filter((item) => item.unitType === 'TABLE')) {
      expect(unit.noteIds).toContain('note-later-general-rule');
      expect(unit.contextPageIds).toContain('page-006');
      expect(unit.overlaps).toContainEqual(
        expect.objectContaining({ refId: 'note-later-general-rule', usage: 'CONTEXT_ONLY' }),
      );
    }
  });

  it('uses FAMILY and CHANNEL units for coherent non-table sections', () => {
    const fiatPlan = createCommercialExtractionUnitPlan(fiatLikeCommercialDocumentMapFixture);
    const volvoPlan = createCommercialExtractionUnitPlan(volvoLikeCommercialDocumentMapFixture);
    expect(fiatPlan.units.some((unit) => unit.unitType === 'FAMILY')).toBe(true);
    expect(volvoPlan.units.some((unit) => unit.unitType === 'CHANNEL')).toBe(true);
  });

  it('marks every duplicated context reference as context-only overlap', () => {
    const plan = createCommercialExtractionUnitPlan(volvoLikeCommercialDocumentMapFixture);
    const occurrences = new Map<string, number>();
    for (const unit of plan.units)
      for (const blockId of unit.contextContentBlockIds)
        occurrences.set(blockId, (occurrences.get(blockId) ?? 0) + 1);
    for (const [blockId, count] of occurrences)
      if (count > 1)
        for (const unit of plan.units.filter((item) =>
          item.contextContentBlockIds.includes(blockId),
        ))
          expect(unit.overlaps).toContainEqual(
            expect.objectContaining({
              refType: 'CONTENT_BLOCK',
              refId: blockId,
              usage: 'CONTEXT_ONLY',
            }),
          );
  });

  it('produces stable unit IDs, order and complete coverage for identical input', () => {
    const first = createCommercialExtractionUnitPlan(fiatLikeCommercialDocumentMapFixture);
    const second = createCommercialExtractionUnitPlan(
      structuredClone(fiatLikeCommercialDocumentMapFixture),
    );
    expect(second).toEqual(first);
    expect(first.units.map((unit) => unit.ordinal)).toEqual(
      Array.from({ length: first.units.length }, (_, index) => index + 1),
    );
  });

  it('partitions dense logical tables within generic row and page limits', () => {
    const plan = createCommercialExtractionUnitPlan(vwLikeCommercialDocumentMapFixture);
    const denseA = plan.units.filter((unit) => unit.logicalTableId === 'table-dense-a');
    expect(plan.units).toHaveLength(17);
    expect(plan.units.filter((unit) => unit.unitType === 'TABLE')).toHaveLength(7);
    expect(plan.units.filter((unit) => unit.unitType === 'PAGE_RANGE_FALLBACK')).toHaveLength(3);
    expect(denseA).toHaveLength(4);
    expect(denseA.map((unit) => unit.partition?.index)).toEqual([1, 2, 3, 4]);
    expect(
      denseA.every(
        (unit) => unit.primaryPageIds.length <= COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxPagesPerUnit,
      ),
    ).toBe(true);
    expect(
      denseA.every(
        (unit) =>
          (unit.expectedTableRows ?? 0) <=
          COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxApproximateRowsPerUnit,
      ),
    ).toBe(true);
  });

  it('uses bounded page-range fallback only for structurally unassigned content', () => {
    const plan = createCommercialExtractionUnitPlan(vwLikeCommercialDocumentMapFixture);
    const fallback = plan.units.filter((unit) => unit.unitType === 'PAGE_RANGE_FALLBACK');
    expect(fallback.length).toBeGreaterThan(0);
    expect(
      fallback.every(
        (unit) =>
          unit.primaryPageIds.length <= COMMERCIAL_EXTRACTION_UNIT_LIMITS.fallbackPagesPerUnit,
      ),
    ).toBe(true);
    expect(
      fallback.every((unit) =>
        unit.primaryPageIds.every(
          (pageId, index, pages) =>
            index === 0 || Number(pageId.slice(5)) === Number(pages[index - 1]?.slice(5)) + 1,
        ),
      ),
    ).toBe(true);
    expect(fallback.some((unit) => unit.tableIds.length > 0)).toBe(false);
  });

  it('proves no orphan page, section, table, relevant note or content block', () => {
    for (const [, map] of fixtures) {
      const coverage = createCommercialExtractionUnitPlan(map).coverage;
      expect(coverage.orphanPageIds).toEqual([]);
      expect(coverage.orphanSectionIds).toEqual([]);
      expect(coverage.orphanTableIds).toEqual([]);
      expect(coverage.unreachableNoteIds).toEqual([]);
      expect(coverage.orphanContentBlockIds).toEqual([]);
    }
  });

  it('rejects a plan whose references or deterministic coverage were tampered with', () => {
    const map = geelyLikeCommercialDocumentMapFixture;
    const plan = createCommercialExtractionUnitPlan(map);
    const invalid = {
      ...plan,
      units: plan.units.map((unit, index) =>
        index === 0 ? { ...unit, tableIds: ['table-missing'] } : unit,
      ),
    };
    expect(() => validateCommercialExtractionUnitPlan(invalid, map)).toThrow(
      CommercialExtractionUnitPlanValidationError,
    );
  });

  it('segments Fiat-like scale by structure, not by vehicle or page', () => {
    const plan = createCommercialExtractionUnitPlan(fiatLikeCommercialDocumentMapFixture);
    expect(fiatLikeCommercialDocumentMapFixture.pageCount).toBe(17);
    expect(
      fiatLikeCommercialDocumentMapFixture.entityHints.filter((hint) => hint.hintKind === 'FAMILY'),
    ).toHaveLength(24);
    expect(
      fiatLikeCommercialDocumentMapFixture.tables.reduce(
        (sum, table) => sum + (table.approximateRowCount ?? 0),
        0,
      ),
    ).toBe(100);
    expect(plan.units).toHaveLength(17);
    expect(plan.units.filter((unit) => unit.unitType === 'TABLE')).toHaveLength(6);
  });

  it('keeps Volvo-like channel sections and their eligibility context distinct', () => {
    const plan = createCommercialExtractionUnitPlan(volvoLikeCommercialDocumentMapFixture);
    const retail = plan.units.filter((unit) => unit.sectionIds.includes('section-retail-channel'));
    const direct = plan.units.filter((unit) => unit.sectionIds.includes('section-direct-channel'));
    expect(retail.some((unit) => unit.noteIds.includes('note-direct-eligibility'))).toBe(false);
    expect(direct.some((unit) => unit.noteIds.includes('note-direct-eligibility'))).toBe(true);
    expect(
      plan.units
        .filter((unit) => unit.unitType === 'TABLE')
        .reduce((sum, unit) => sum + (unit.expectedTableRows ?? 0), 0),
    ).toBe(20);
  });

  it('keeps the map below its byte limit and independent of commercial authority fields', () => {
    expect(JSON.stringify(vwLikeCommercialDocumentMapFixture).length).toBeLessThan(
      COMMERCIAL_DOCUMENT_MAP_LIMITS.maxPayloadBytes,
    );
    for (const field of [
      'policies',
      'offers',
      'policyClientIds',
      'msrp',
      'productId',
      'promotionPlan',
      'productMatch',
      'commercialPolicyId',
    ])
      expectInvalidMap({ ...geelyLikeCommercialDocumentMapFixture, [field]: 'forbidden' });
    expectInvalidMap({
      ...geelyLikeCommercialDocumentMapFixture,
      tables: [
        { ...geelyLikeCommercialDocumentMapFixture.tables[0], productId: 123 },
        ...geelyLikeCommercialDocumentMapFixture.tables.slice(1),
      ],
    });
    expectInvalidMap({
      ...geelyLikeCommercialDocumentMapFixture,
      notes: [
        { ...geelyLikeCommercialDocumentMapFixture.notes[0], offers: [] },
        ...geelyLikeCommercialDocumentMapFixture.notes.slice(1),
      ],
    });
  });

  it('keeps provider SDKs and provider execution metadata outside the core contracts', () => {
    const surface = JSON.stringify({
      map: commercialDocumentMapSchemaV1,
      plan: commercialExtractionUnitPlanSchemaV1,
      fixture: geelyLikeCommercialDocumentMapFixture,
    });
    expect(surface).not.toMatch(/OpenAI|Responses API|providerRunId|fileId|usage_metadata/iu);
  });
});
