import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_DOCUMENT_EXTRACTION_LIMITS,
  COMMERCIAL_DOCUMENT_SCOPE_TYPES,
  type CommercialDocumentExtractionV1,
} from '../src/import/commercial-document-extraction';
import { commercialDocumentExtractionSchemaV1 } from '../src/import/commercial-document-extraction-schema';
import { canonicalizeCommercialDocumentExtractionUnit } from '../src/import/commercial-document-extraction-canonicalizer';
import {
  CommercialDocumentExtractionValidationError,
  INCOMPLETE_DATA_MARKED_COMPLETE_REASON_CODES,
  validateCommercialDocumentExtraction,
  type CommercialDocumentExtractionViolationDiagnostic,
} from '../src/import/commercial-document-extraction-validator';
import {
  fiatLikeCommercialDocumentExtractionFixture,
  geelyLikeCommercialDocumentExtractionFixture,
  gwmLikeCommercialDocumentExtractionFixture,
  volvoLikeCommercialDocumentExtractionFixture,
} from './fixtures/import/commercial-document-extraction-fixtures';

const fixtures = [
  ['Geely-like', geelyLikeCommercialDocumentExtractionFixture],
  ['GWM-like', gwmLikeCommercialDocumentExtractionFixture],
  ['Fiat-like', fiatLikeCommercialDocumentExtractionFixture],
  ['Volvo-like', volvoLikeCommercialDocumentExtractionFixture],
] as const;
const expectInvalid = (artifact: unknown, issue?: string): void => {
  try {
    validateCommercialDocumentExtraction(artifact);
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(CommercialDocumentExtractionValidationError);
    if (issue)
      expect((error as CommercialDocumentExtractionValidationError).issues.join('\n')).toContain(
        issue,
      );
  }
};
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const incompleteCompleteDiagnostic = (
  coverage: CommercialDocumentExtractionV1['coverage'],
  artifact: CommercialDocumentExtractionV1 = geelyLikeCommercialDocumentExtractionFixture,
): CommercialDocumentExtractionViolationDiagnostic => {
  try {
    validateCommercialDocumentExtraction({ ...artifact, coverage });
    throw new Error('Expected incompleteDataMarkedComplete validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(CommercialDocumentExtractionValidationError);
    const diagnostic = (error as CommercialDocumentExtractionValidationError).diagnostics.find(
      (item) => item.keyword === 'incompleteDataMarkedComplete',
    );
    expect(diagnostic).toBeDefined();
    return diagnostic!;
  }
};

describe('CommercialDocumentExtraction/1', () => {
  it('publishes a valid Draft 2020-12 JSON Schema', () => {
    const ajv = new Ajv2020({ strict: true });
    expect(ajv.validateSchema(commercialDocumentExtractionSchemaV1)).toBe(true);
    expect(commercialDocumentExtractionSchemaV1.$schema).toBe(
      'https://json-schema.org/draft/2020-12/schema',
    );
    expect(commercialDocumentExtractionSchemaV1.additionalProperties).toBe(false);
  });

  it('keeps table cells non-empty and keyed explicitly by columnId', () => {
    const tableCell = commercialDocumentExtractionSchemaV1.$defs.tableCell;
    expect(tableCell).toEqual({
      type: 'object',
      additionalProperties: false,
      required: ['columnId', 'text'],
      properties: {
        columnId: {
          type: 'string',
          pattern: '^column-[a-z0-9][a-z0-9._-]{0,63}$',
        },
        text: {
          type: 'string',
          minLength: 1,
          maxLength: COMMERCIAL_DOCUMENT_EXTRACTION_LIMITS.maxTextLength,
        },
      },
    });

    const empty = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    (empty.tables[0]!.rows[0]!.cells[0] as { text: string }).text = '';
    expectInvalid(empty, '/tables/0/rows/0/cells/0/text: minLength');
  });

  it.each([
    ['first', 0],
    ['middle', 1],
    ['last', 2],
  ] as const)(
    'represents a visually blank %s column by omitting its keyed cell',
    (_name, index) => {
      const artifact = structuredClone(fiatLikeCommercialDocumentExtractionFixture);
      const row = artifact.tables[0]!.rows[0]!;
      const before = row.cells.map((cell) => cell.columnId);
      const omitted = before[index]!;
      (row as unknown as { cells: typeof row.cells }).cells = row.cells.filter(
        (cell) => cell.columnId !== omitted,
      );

      expect(() => validateCommercialDocumentExtraction(artifact)).not.toThrow();
      expect(row.cells.map((cell) => cell.columnId)).toEqual(
        before.filter((columnId) => columnId !== omitted),
      );
      expect(row.cells.every((cell) => cell.text.length > 0)).toBe(true);
    },
  );

  it('rejects invented merged-cell fields because rowSpan and colSpan are unsupported', () => {
    const artifact = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const cell = artifact.tables[0]!.rows[0]!.cells[0] as unknown as Record<string, unknown>;
    cell.rowSpan = 2;
    cell.colSpan = 2;

    expectInvalid(artifact, 'additionalProperties');
  });

  it('canonicalizes a frozen artifact with an omitted blank cell deterministically', () => {
    const artifact = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const row = artifact.tables[0]!.rows[0]!;
    (row as unknown as { cells: typeof row.cells }).cells = row.cells.slice(1);
    const frozen = deepFreeze(artifact);
    const before = JSON.stringify(frozen);

    const first = canonicalizeCommercialDocumentExtractionUnit(frozen, 1);
    const repeated = canonicalizeCommercialDocumentExtractionUnit(frozen, 1);

    expect(JSON.stringify(frozen)).toBe(before);
    expect(repeated).toEqual(first);
    expect(first.tables[0]!.rows[0]!.cells).toHaveLength(1);
    expect(() => validateCommercialDocumentExtraction(first)).not.toThrow();
  });

  it.each(fixtures)('accepts the %s synthetic fixture', (_name, fixture) => {
    expect(() => validateCommercialDocumentExtraction(fixture)).not.toThrow();
  });

  it('rejects duplicate IDs', () => {
    expectInvalid(
      {
        ...geelyLikeCommercialDocumentExtractionFixture,
        blocks: [
          ...geelyLikeCommercialDocumentExtractionFixture.blocks,
          geelyLikeCommercialDocumentExtractionFixture.blocks[0],
        ],
      },
      'duplicateId',
    );
  });

  it('exposes bounded structural diagnostics without raw IDs or values', () => {
    const secretId = geelyLikeCommercialDocumentExtractionFixture.blocks[0]!.blockId;
    try {
      validateCommercialDocumentExtraction({
        ...geelyLikeCommercialDocumentExtractionFixture,
        blocks: [
          ...geelyLikeCommercialDocumentExtractionFixture.blocks,
          geelyLikeCommercialDocumentExtractionFixture.blocks[0],
        ],
      });
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentExtractionValidationError);
      const validation = error as CommercialDocumentExtractionValidationError;
      expect(validation).toMatchObject({
        totalViolations: 1,
        truncated: false,
        keywordCounts: { duplicateId: 1 },
        categoryCounts: { schema: 0, referential: 0, semantic: 0, invariant: 1 },
      });
      expect(validation.diagnostics[0]).toMatchObject({
        path: '/blocks',
        keyword: 'duplicateId',
        category: 'invariant',
      });
      expect(JSON.stringify(validation)).not.toContain(secretId);
    }
  });

  it.each([
    [
      'unit count mismatch',
      'UNIT_COUNT_MISMATCH',
      {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        completedUnitCount:
          geelyLikeCommercialDocumentExtractionFixture.coverage.completedUnitCount - 1,
        units: geelyLikeCommercialDocumentExtractionFixture.coverage.units.map((unit, index) =>
          index === 0 ? { ...unit, status: 'incomplete' as const } : structuredClone(unit),
        ),
      },
    ],
    [
      'gap',
      'GAPS_PRESENT',
      {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        gaps: [
          {
            gapId: 'gap-observed',
            gapType: 'OTHER' as const,
            message: 'Observed gap.',
            unitId: geelyLikeCommercialDocumentExtractionFixture.coverage.units[0]!.unitId,
          },
        ],
      },
    ],
    [
      'incomplete block',
      'INCOMPLETE_BLOCKS_PRESENT',
      {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        incompleteBlockIds: [geelyLikeCommercialDocumentExtractionFixture.blocks[0]!.blockId],
      },
    ],
    [
      'unresolved table row',
      'UNRESOLVED_TABLE_ROWS_PRESENT',
      {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        unresolvedTableRows: [
          {
            tableId: geelyLikeCommercialDocumentExtractionFixture.tables[0]!.tableId,
            rowId: geelyLikeCommercialDocumentExtractionFixture.tables[0]!.rows[0]!.rowId,
          },
        ],
      },
    ],
    [
      'unresolved scope',
      'UNRESOLVED_SCOPES_PRESENT',
      {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        unresolvedScopeIds: [geelyLikeCommercialDocumentExtractionFixture.scopes[0]!.scopeId],
      },
    ],
    [
      'vehicle count mismatch',
      'VEHICLE_COUNT_MISMATCH',
      {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        expectedVehicleCount:
          geelyLikeCommercialDocumentExtractionFixture.coverage.extractedVehicleCount + 1,
      },
    ],
    [
      'family set mismatch',
      'FAMILY_SET_MISMATCH',
      {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        expectedFamilies: [
          ...geelyLikeCommercialDocumentExtractionFixture.coverage.expectedFamilies,
          'Missing family',
        ],
      },
    ],
  ] as const)('reports only the static reason for %s', (_name, reason, coverage) => {
    expect(incompleteCompleteDiagnostic(coverage).reasons).toEqual([reason]);
  });

  it('orders simultaneous incomplete COMPLETE reasons by the static allow-list', () => {
    const original = geelyLikeCommercialDocumentExtractionFixture;
    const coverage = {
      ...structuredClone(original.coverage),
      completedUnitCount: original.coverage.completedUnitCount - 1,
      units: original.coverage.units.map((unit, index) =>
        index === 0 ? { ...unit, status: 'incomplete' as const } : structuredClone(unit),
      ),
      gaps: [
        {
          gapId: 'gap-multiple',
          gapType: 'OTHER' as const,
          message: 'Multiple blocker test.',
          unitId: original.coverage.units[0]!.unitId,
        },
      ],
      incompleteBlockIds: [original.blocks[0]!.blockId],
      unresolvedTableRows: [
        { tableId: original.tables[0]!.tableId, rowId: original.tables[0]!.rows[0]!.rowId },
      ],
      unresolvedScopeIds: [original.scopes[0]!.scopeId],
      expectedVehicleCount: original.coverage.extractedVehicleCount + 1,
      expectedFamilies: [...original.coverage.expectedFamilies, 'Missing family'],
    };

    expect(incompleteCompleteDiagnostic(coverage).reasons).toEqual(
      INCOMPLETE_DATA_MARKED_COMPLETE_REASON_CODES,
    );
  });

  it('keeps COMPLETE reason diagnostics free of values, IDs, counts, messages and excerpts', () => {
    const original = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const secretFamily = 'Confidential Family Name';
    const secretMessage = 'Confidential gap message with commercial value 123456';
    const secretExcerpt = 'Confidential evidence excerpt';
    const secretBlockId = original.blocks[0]!.blockId;
    const secretRowId = original.tables[0]!.rows[0]!.rowId;
    const secretScopeId = original.scopes[0]!.scopeId;
    const artifact = {
      ...original,
      facts: original.facts.map((fact, index) =>
        index === 0 ? { ...fact, evidence: { ...fact.evidence, excerpt: secretExcerpt } } : fact,
      ),
      coverage: {
        ...original.coverage,
        gaps: [
          {
            gapId: 'gap-security',
            gapType: 'OTHER' as const,
            message: secretMessage,
            unitId: original.coverage.units[0]!.unitId,
          },
        ],
        incompleteBlockIds: [secretBlockId],
        unresolvedTableRows: [{ tableId: original.tables[0]!.tableId, rowId: secretRowId }],
        unresolvedScopeIds: [secretScopeId],
        expectedVehicleCount: 999,
        expectedFamilies: [...original.coverage.expectedFamilies, secretFamily],
      },
    };

    try {
      validateCommercialDocumentExtraction(artifact);
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentExtractionValidationError);
      const validation = error as CommercialDocumentExtractionValidationError;
      const serialized = JSON.stringify(validation);
      expect(validation.message).toBe(
        `CommercialDocumentExtraction/1 inválido (${validation.totalViolations} violação(ões)).`,
      );
      expect(serialized).not.toContain(secretFamily);
      expect(serialized).not.toContain(secretMessage);
      expect(serialized).not.toContain(secretExcerpt);
      expect(serialized).not.toContain(secretBlockId);
      expect(serialized).not.toContain(secretRowId);
      expect(serialized).not.toContain(secretScopeId);
      expect(serialized).not.toContain('999');
      expect(
        validation.diagnostics.find((item) => item.keyword === 'incompleteDataMarkedComplete')
          ?.reasons,
      ).toEqual([
        'GAPS_PRESENT',
        'INCOMPLETE_BLOCKS_PRESENT',
        'UNRESOLVED_TABLE_ROWS_PRESENT',
        'UNRESOLVED_SCOPES_PRESENT',
        'VEHICLE_COUNT_MISMATCH',
        'FAMILY_SET_MISMATCH',
      ]);
    }
  });

  it('keeps a valid COMPLETE artifact free of the semantic invariant issue', () => {
    expect(() =>
      validateCommercialDocumentExtraction(geelyLikeCommercialDocumentExtractionFixture),
    ).not.toThrow();
  });

  it.each([
    ['partialWithoutGap', 'partial'],
    ['ambiguousWithoutEvidence', 'ambiguous'],
  ] as const)('does not attach COMPLETE reasons to %s', (keyword, status) => {
    const original = geelyLikeCommercialDocumentExtractionFixture;
    try {
      validateCommercialDocumentExtraction({
        ...original,
        coverage: { ...original.coverage, status },
      });
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentExtractionValidationError);
      const diagnostic = (error as CommercialDocumentExtractionValidationError).diagnostics.find(
        (item) => item.keyword === keyword,
      );
      expect(diagnostic).toBeDefined();
      expect(diagnostic).not.toHaveProperty('reasons');
    }
  });

  it('rejects dangling evidence, fact scope and composition references', () => {
    const fixture = geelyLikeCommercialDocumentExtractionFixture;
    expectInvalid(
      {
        ...fixture,
        facts: fixture.facts.map((fact, index) =>
          index === 0
            ? {
                ...fact,
                scopeIds: ['scope-missing'],
                evidence: { ...fact.evidence, blockIds: ['block-missing'] },
              }
            : fact,
        ),
        composition: {
          ...fixture.composition,
          groups: fixture.composition.groups.map((group, index) =>
            index === 0
              ? { ...group, memberFactIds: ['fact-missing', ...group.memberFactIds] }
              : group,
          ),
        },
      },
      'unknownRef',
    );
  });

  it('rejects an invalid source page', () => {
    const fixture = geelyLikeCommercialDocumentExtractionFixture;
    expectInvalid(
      {
        ...fixture,
        blocks: fixture.blocks.map((block, index) => (index === 0 ? { ...block, page: 4 } : block)),
      },
      'pageOutOfRange',
    );
  });

  it('rejects an invalid vehicle year', () => {
    const fixture = geelyLikeCommercialDocumentExtractionFixture;
    expectInvalid({
      ...fixture,
      vehicleIdentities: fixture.vehicleIdentities.map((vehicle, index) =>
        index === 0 ? { ...vehicle, productionYear: 1700 } : vehicle,
      ),
    });
  });

  it('rejects malformed monetary facts and percentages above 100', () => {
    const fixture = geelyLikeCommercialDocumentExtractionFixture;
    expectInvalid({
      ...fixture,
      facts: fixture.facts.map((fact, index) =>
        index === 0
          ? { ...fact, value: { kind: 'money', amount: 'R$ 1.000,00', currency: 'reais' } }
          : fact,
      ),
    });
    expectInvalid(
      {
        ...fixture,
        facts: fixture.facts.map((fact) =>
          fact.factId === 'fact-financing-alternative'
            ? { ...fact, value: { kind: 'percentage', percentage: '101' } }
            : fact,
        ),
      },
      'above100',
    );
  });

  it('preserves a single logical table across pages with inherited headers and footnotes', () => {
    const fixture = gwmLikeCommercialDocumentExtractionFixture;
    const table = fixture.tables[0]!;
    expect(table.tableId).toBe('table-mmv');
    expect(table.pages).toEqual([2, 3]);
    expect(table.rows).toHaveLength(13);
    expect(table.continuation.continuedAcrossPages).toBe(true);
    expect(table.continuation.segments[1]?.inheritsHeadersFromPage).toBe(2);
    expect(table.footnoteBlockIds).toEqual(['block-table-footnote']);
    expectInvalid(
      {
        ...fixture,
        tables: [
          {
            ...table,
            continuation: {
              ...table.continuation,
              segments: [
                table.continuation.segments[0],
                { ...table.continuation.segments[1], inheritsHeadersFromPage: 3 },
              ],
            },
          },
        ],
      },
      'inheritsHeadersFromPage: invalid',
    );
  });

  it('covers every structured scope kind, exclusions, overlap and one-to-many applicability', () => {
    const fixture = geelyLikeCommercialDocumentExtractionFixture;
    expect(new Set(fixture.scopes.map((scope) => scope.scopeType))).toEqual(
      new Set(COMMERCIAL_DOCUMENT_SCOPE_TYPES),
    );
    const broadScope = fixture.scopes.find((item) => item.scopeId === 'scope-model');
    expect(broadScope?.selector.vehicleIdentityIds).toHaveLength(4);
    expect(broadScope?.exclusions.vehicleIdentityIds).toEqual(['vehicle-version-4']);
    expect(
      fixture.composition.groups.find((item) => item.groupId === 'group-alternatives')
        ?.sharedFactIds,
    ).toContain('fact-general-bonus');
    expect(fixture.scopes.filter((item) => item.scopeType === 'VEHICLE')).toHaveLength(4);
  });

  it('represents cumulative and alternative composition without dangling relations', () => {
    const composition = geelyLikeCommercialDocumentExtractionFixture.composition;
    expect(composition.groups.map((group) => group.groupType).sort()).toEqual([
      'ALTERNATIVE',
      'CUMULATIVE',
    ]);
    expect(composition.relationships.map((relation) => relation.relationType)).toEqual(
      expect.arrayContaining([
        'APPLIES_TOGETHER',
        'MUTUALLY_EXCLUSIVE',
        'GENERAL_RULE',
        'EXCEPTION',
      ]),
    );
  });

  it('validates complete, partial and ambiguous coverage states', () => {
    const fixture = geelyLikeCommercialDocumentExtractionFixture;
    const partial: CommercialDocumentExtractionV1 = {
      ...fixture,
      coverage: {
        ...fixture.coverage,
        status: 'partial',
        completedUnitCount: 1,
        units: fixture.coverage.units.map((unit, index) =>
          index === 1 ? { ...unit, status: 'incomplete', extractedItemCount: 4 } : unit,
        ),
        gaps: [
          {
            gapId: 'gap-incomplete-rules',
            gapType: 'INCOMPLETE_BLOCK',
            message: 'Uma regra sintética permaneceu incompleta.',
            unitId: 'unit-commercial-rules',
            blockId: 'block-options',
          },
        ],
        incompleteBlockIds: ['block-options'],
      },
    };
    const ambiguous: CommercialDocumentExtractionV1 = {
      ...partial,
      scopes: partial.scopes.map((item) =>
        item.scopeId === 'scope-model' ? { ...item, ambiguous: true, requiresReview: true } : item,
      ),
      coverage: {
        ...partial.coverage,
        status: 'ambiguous',
        gaps: [
          {
            gapId: 'gap-ambiguous-scope',
            gapType: 'AMBIGUITY',
            message: 'Escopo sintético não resolvido.',
            scopeId: 'scope-model',
          },
        ],
        unresolvedScopeIds: ['scope-model'],
      },
    };
    expect(() => validateCommercialDocumentExtraction(partial)).not.toThrow();
    expect(() => validateCommercialDocumentExtraction(ambiguous)).not.toThrow();
    expectInvalid({ ...partial, coverage: { ...partial.coverage, status: 'complete' } });
  });

  it('proves exhaustive GWM-like coverage of 13/13 rows', () => {
    const fixture = gwmLikeCommercialDocumentExtractionFixture;
    expect(fixture.tables[0]?.rows).toHaveLength(13);
    expect(fixture.vehicleIdentities).toHaveLength(13);
    expect(fixture.facts).toHaveLength(13);
    expect(fixture.coverage.expectedVehicleCount).toBe(13);
    expect(fixture.coverage.extractedVehicleCount).toBe(13);
  });

  it('supports Fiat-like scale without the canonical 100-row limit', () => {
    const fixture = fiatLikeCommercialDocumentExtractionFixture;
    expect(fixture.coverage.expectedFamilies).toHaveLength(12);
    expect(fixture.vehicleIdentities).toHaveLength(100);
    expect(fixture.facts.length).toBeGreaterThan(100);
    expect(fixture.composition.groups).toHaveLength(100);
    expect(JSON.stringify(fixture).length).toBeLessThan(
      COMMERCIAL_DOCUMENT_EXTRACTION_LIMITS.maxPayloadBytes,
    );
  });

  it('keeps Volvo-like channel prices and financing eligibility distinct', () => {
    const fixture = volvoLikeCommercialDocumentExtractionFixture;
    expect(fixture.vehicleIdentities).toHaveLength(20);
    expect(fixture.facts.filter((fact) => fact.factType === 'promotional_price')).toHaveLength(60);
    expect(fixture.facts.filter((fact) => fact.factType === 'financing_rate')).toHaveLength(40);
    expect(
      fixture.facts.some(
        (fact) => fact.factType === 'financing_rate' && fact.channel === 'Diretas',
      ),
    ).toBe(false);
  });

  it('rejects domain-authority fields at every strict object boundary', () => {
    const fixture = geelyLikeCommercialDocumentExtractionFixture;
    for (const field of [
      'productId',
      'matchedProduct',
      'selectedProductId',
      'productFingerprint',
      'pricingImportRowId',
      'commercialPolicyId',
      'commercialOfferId',
      'lockVersion',
      'predecessorId',
      'promotionPlan',
      'promotionAction',
      'publicationStatus',
      'matchingStrategy',
    ])
      expectInvalid({ ...fixture, [field]: 'forbidden' });
    expectInvalid({
      ...fixture,
      facts: [{ ...fixture.facts[0], selectedProductId: 123 }, ...fixture.facts.slice(1)],
    });
  });

  it('enforces the total serialized payload limit before schema traversal', () => {
    expectInvalid(
      {
        ...geelyLikeCommercialDocumentExtractionFixture,
        oversized: 'x'.repeat(COMMERCIAL_DOCUMENT_EXTRACTION_LIMITS.maxPayloadBytes),
      },
      'maxPayloadBytes',
    );
  });

  it('keeps the core boundary provider-agnostic', () => {
    const publicContract = JSON.stringify({
      schema: commercialDocumentExtractionSchemaV1,
      fixture: geelyLikeCommercialDocumentExtractionFixture,
    });
    expect(publicContract).not.toMatch(
      /from ['"](?:openai|@openai)|Responses API|providerRunId|fileId|usage/iu,
    );
  });
});
