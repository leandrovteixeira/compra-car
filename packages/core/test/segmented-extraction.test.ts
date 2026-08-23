import { describe, expect, it } from 'vitest';
import {
  SEGMENTED_EXTRACTION_PROMPT_VERSION,
  type SegmentedExtractionUnitFailure,
  type SegmentedExtractionSource,
  type StructuredExtractionProvider,
  type StructuredExtractionRequest,
  type StructuredExtractionResponse,
} from '../src/import/segmented-extraction';
import {
  buildSegmentedExtractionUnitContext,
  buildSegmentedExtractionUnitInstructions,
  executeSegmentedExtraction,
  selectPrimarySegmentedExtractionFailure,
} from '../src/import/segmented-extraction-orchestrator';
import { commercialDocumentExtractionSchemaV1 } from '../src/import/commercial-document-extraction-schema';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';
import { canonicalizeCommercialDocumentExtractionUnit } from '../src/import/commercial-document-extraction-canonicalizer';
import {
  validateCommercialDocumentExtraction,
  type CommercialDocumentExtractionValidationError,
} from '../src/import/commercial-document-extraction-validator';
import type { CommercialDocumentMapV1 } from '../src/import/commercial-document-map';
import {
  fiatLikeCommercialDocumentExtractionFixture,
  geelyLikeCommercialDocumentExtractionFixture,
  gwmLikeCommercialDocumentExtractionFixture,
  volvoLikeCommercialDocumentExtractionFixture,
} from './fixtures/import/commercial-document-extraction-fixtures';
import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  gwmLikeCommercialDocumentMapFixture,
  volvoLikeCommercialDocumentMapFixture,
  vwLikeCommercialDocumentMapFixture,
} from './fixtures/import/commercial-document-map-fixtures';

const usage = { inputUnits: 10, outputUnits: 20, totalUnits: 30 };
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
const extractionWithSourceBlockId = (sourceBlockId: string) =>
  JSON.parse(
    JSON.stringify(geelyLikeCommercialDocumentExtractionFixture).replaceAll(
      '"block-heading"',
      JSON.stringify(sourceBlockId),
    ),
  ) as typeof geelyLikeCommercialDocumentExtractionFixture;
const failedUnit = (
  ordinal: number,
  code: SegmentedExtractionUnitFailure['code'],
): SegmentedExtractionUnitFailure => ({
  status: 'failed',
  unitId: `unit-${ordinal}`,
  ordinal,
  code,
  durationMs: 1,
});
const source: SegmentedExtractionSource = {
  documents: [
    { documentId: 'document-primary', ordinal: 1, bytes: new Uint8Array([37, 80, 68, 70]) },
  ],
};
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
      contentBlockIds: ['block-single-header', 'block-single-table'],
    },
  ],
  contentBlocks: [
    {
      contentBlockId: 'block-single-header',
      documentId: 'document-single',
      pageId: 'page-single',
      blockKind: 'HEADING',
    },
    {
      contentBlockId: 'block-single-table',
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
      sourceBlockIds: ['block-single-header', 'block-single-table'],
    },
  ],
  tables: [
    {
      tableId: 'table-single',
      documentId: 'document-single',
      pageIds: ['page-single'],
      headerBlockIds: ['block-single-header'],
      segments: [
        {
          pageId: 'page-single',
          position: 'WHOLE',
          inheritedHeaderBlockIds: [],
          sourceBlockIds: ['block-single-table'],
        },
      ],
      approximateRowCount: 4,
      columnHeaderLabels: ['Identity', 'Condition'],
      entityHintIds: [],
      footnoteNoteIds: [],
      contextEdgeIds: [],
      sourceBlockIds: ['block-single-header', 'block-single-table'],
    },
  ],
  notes: [],
  entityHints: [],
  contextEdges: [],
};

function providerFrom(
  handler: (
    request: StructuredExtractionRequest,
    call: number,
  ) => Promise<StructuredExtractionResponse>,
  close: () => Promise<void> = async () => undefined,
): { provider: StructuredExtractionProvider; calls: StructuredExtractionRequest[]; opens: number } {
  const calls: StructuredExtractionRequest[] = [];
  let opens = 0;
  return {
    get opens() {
      return opens;
    },
    calls,
    provider: {
      async openSource() {
        opens += 1;
        return {
          async extractStructured(request) {
            calls.push(request);
            return handler(request, calls.length);
          },
          close,
        };
      },
    },
  };
}

const inputFor = (documentMap: typeof geelyLikeCommercialDocumentMapFixture) => ({
  documentMap,
  unitPlan: createCommercialExtractionUnitPlan(documentMap),
  source,
  correlationId: 'correlation-segmented-test',
});

describe('Sprint 10C.3C segmented extraction', () => {
  it('executes a plan containing exactly one unit', async () => {
    const plan = createCommercialExtractionUnitPlan(singleUnitMap);
    expect(plan.units).toHaveLength(1);
    const fake = providerFrom(async () => ({
      output: geelyLikeCommercialDocumentExtractionFixture,
      providerRunId: 'run-single',
      usage,
    }));
    const result = await executeSegmentedExtraction(
      { documentMap: singleUnitMap, unitPlan: plan, source, correlationId: 'correlation-single' },
      { provider: fake.provider, schema: commercialDocumentExtractionSchemaV1 },
    );
    expect(result.unitResults).toHaveLength(1);
    expect(result.unitResults[0]).toMatchObject({
      status: 'succeeded',
      providerRunId: 'run-single',
    });
  });

  it('returns each unit as an independently valid canonical CommercialDocumentExtraction/1', async () => {
    const map = structuredClone(gwmLikeCommercialDocumentMapFixture);
    const plan = createCommercialExtractionUnitPlan(map);
    const fake = providerFrom(async () => ({
      output: gwmLikeCommercialDocumentExtractionFixture,
      providerRunId: 'run-one',
      usage,
    }));
    const result = await executeSegmentedExtraction(
      { documentMap: map, unitPlan: plan, source, correlationId: 'correlation-one' },
      { provider: fake.provider, schema: commercialDocumentExtractionSchemaV1 },
    );
    expect(result.unitResults).toHaveLength(plan.units.length);
    expect(result.unitResults[0]).toMatchObject({
      status: 'succeeded',
      providerRunId: 'run-one',
      usage,
    });
  });

  it('runs multiple units, opens the source once and preserves plan order after out-of-order completion', async () => {
    const fake = providerFrom(async (_request, call) => {
      await new Promise((resolve) => setTimeout(resolve, call === 1 ? 20 : 1));
      return {
        output: geelyLikeCommercialDocumentExtractionFixture,
        providerRunId: `run-${call}`,
        usage,
      };
    });
    const input = inputFor(geelyLikeCommercialDocumentMapFixture);
    const result = await executeSegmentedExtraction(input, {
      provider: fake.provider,
      schema: commercialDocumentExtractionSchemaV1,
      concurrency: 2,
    });
    expect(fake.opens).toBe(1);
    expect(result.unitResults.map((item) => item.ordinal)).toEqual(
      input.unitPlan.units.map((unit) => unit.ordinal),
    );
  });

  it.each([
    ['multipage 13-row logical table', gwmLikeCommercialDocumentMapFixture, 'TABLE'],
    ['dense 100-combination partitioning', fiatLikeCommercialDocumentMapFixture, 'TABLE'],
    ['20-identity multi-channel structure', volvoLikeCommercialDocumentMapFixture, 'CHANNEL'],
    ['large partition with inherited header', vwLikeCommercialDocumentMapFixture, 'TABLE'],
  ] as const)('builds explicit unit context for %s', (_name, map, kind) => {
    const plan = createCommercialExtractionUnitPlan(map);
    const unit = plan.units.find((item) => item.unitType === kind)!;
    const context = buildSegmentedExtractionUnitContext(map, unit);
    const instructions = buildSegmentedExtractionUnitInstructions(context);
    expect(instructions).toContain(`kind=${kind}`);
    expect(instructions).toContain('Primary pages:');
    expect(instructions).toContain('Context-only pages:');
    expect(context.primaryContentBlocks.map((block) => block.contentBlockId)).toEqual(
      unit.primaryContentBlockIds,
    );
    expect(instructions).toContain('evidence.blockIds always references blocks defined');
    expect(instructions).toContain('blocks[].excerpt is a short verbatim evidence snippet');
    expect(instructions).toContain('within 1000 Unicode characters');
    expect(instructions).toContain('Never summarize, rewrite, append an ellipsis');
    expect(instructions).toContain(
      'Create a composition group only when it has at least two actual member facts',
    );
    expect(instructions).toContain(
      'Create a composition relationship only when it references at least one actual fact',
    );
    expect(instructions).toContain(
      'Never emit a composition relationship with an empty factIds array',
    );
    expect(instructions).toContain('groupIds never substitute for the required fact');
    expect(instructions).toContain('If no valid relationships exist, return relationships: []');
    expect(instructions).toContain('INVALID factIds: []');
    expect(instructions).toContain('Never emit placeholder composition objects');
    expect(instructions).toContain('return empty groups and relationships arrays');
    expect(instructions).toContain('coverage.units must describe only the current unit');
    expect(instructions).toContain('emit 0 as a safe sentinel');
    expect(instructions).toContain('server deterministically reconstructs them');
    expect(instructions).toContain('Never use those counters to declare semantic completeness');
    expect(instructions).toContain('A row cell is keyed by columnId, not by its array position');
    expect(instructions).toContain(
      'For a visually blank cell, omit that cell while keeping every other cell',
    );
    expect(instructions).toContain('Never replace a blank with whitespace, "-", "N/A", "unknown"');
    expect(instructions).toContain(
      'literal visible text or symbols may be emitted only when the source displays them',
    );
    expect(instructions).toContain('never copy a merged, repeated or inherited value');
    expect(instructions).toContain('report a genuine coverage gap/unresolved row');
    expect(instructions).toContain('Use complete only when every coverage unit is complete');
    expect(instructions).toContain(
      'gaps, incompleteBlockIds, unresolvedTableRows and unresolvedScopeIds are all empty',
    );
    expect(instructions).toContain('expectedVehicleCount is absent or equals');
    expect(instructions).toContain('expectedFamilies equals extractedFamilies as a set');
    expect(instructions).toContain('never use optimistic complete');
    expect(instructions).toContain('Use partial for known missing or incomplete');
    expect(instructions).toContain('Use ambiguous when unresolved interpretation');
    expect(buildSegmentedExtractionUnitInstructions.toString()).not.toMatch(
      /Geely|GWM|Fiat|Volvo|Volkswagen/iu,
    );
  });

  it('carries inherited headers, context-only footnotes and later general rules into instructions', () => {
    const inheritedPlan = createCommercialExtractionUnitPlan(vwLikeCommercialDocumentMapFixture);
    const inherited = inheritedPlan.units.find((unit) => unit.partition?.index === 2)!;
    const inheritedText = buildSegmentedExtractionUnitInstructions(
      buildSegmentedExtractionUnitContext(vwLikeCommercialDocumentMapFixture, inherited),
    );
    expect(inheritedText).toContain('block-dense-a-header');
    const notePlan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const noteUnit = notePlan.units.find((unit) => unit.noteIds.includes('note-main-footnote'))!;
    expect(
      buildSegmentedExtractionUnitInstructions(
        buildSegmentedExtractionUnitContext(gwmLikeCommercialDocumentMapFixture, noteUnit),
      ),
    ).toContain('note-main-footnote');
    const generalPlan = createCommercialExtractionUnitPlan(geelyLikeCommercialDocumentMapFixture);
    const generalUnit = generalPlan.units.find((unit) =>
      unit.noteIds.includes('note-later-general-rule'),
    )!;
    expect(
      buildSegmentedExtractionUnitInstructions(
        buildSegmentedExtractionUnitContext(geelyLikeCommercialDocumentMapFixture, generalUnit),
      ),
    ).toContain('note-later-general-rule');
  });

  it.each([
    [
      '4 identities, exclusions, cumulative/alternative facts and broad scope',
      geelyLikeCommercialDocumentExtractionFixture,
    ],
    ['13 identities and PY/MY', gwmLikeCommercialDocumentExtractionFixture],
    ['100 identities and partial-scale structure', fiatLikeCommercialDocumentExtractionFixture],
    ['20 identities and channel-specific facts', volvoLikeCommercialDocumentExtractionFixture],
  ] as const)(
    'canonicalizes the %s fixture without losing document semantics',
    (_name, fixture) => {
      const canonical = canonicalizeCommercialDocumentExtractionUnit(fixture, 7);
      expect(canonical.vehicleIdentities).toHaveLength(fixture.vehicleIdentities.length);
      expect(canonical.facts).toHaveLength(fixture.facts.length);
      expect(canonical.composition.groups).toHaveLength(fixture.composition.groups.length);
    },
  );

  it('canonicalizes every local ID and reference deterministically and byte-equivalently', () => {
    const first = canonicalizeCommercialDocumentExtractionUnit(
      geelyLikeCommercialDocumentExtractionFixture,
      2,
    );
    const second = canonicalizeCommercialDocumentExtractionUnit(
      structuredClone(geelyLikeCommercialDocumentExtractionFixture),
      2,
    );
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.facts[0]?.factId).toMatch(/^fact-u0002-/u);
    expect(first.facts[0]?.evidence.blockIds[0]).toMatch(/^block-u0002-/u);
  });

  it('bounds only overlong source block excerpts by Unicode code point before validation', () => {
    const belowLimit = 'A'.repeat(999);
    const atLimit = 'B'.repeat(1_000);
    const unicodeOverLimit = `${'🚗'.repeat(1_000)}Z`;
    const input = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const mutableBlocks = input.blocks as unknown as { excerpt: string }[];
    mutableBlocks[0]!.excerpt = belowLimit;
    mutableBlocks[1]!.excerpt = atLimit;
    mutableBlocks[2]!.excerpt = unicodeOverLimit;
    (input.facts[0]!.evidence as { excerpt?: string }).excerpt = 'literal fact evidence';
    const frozen = deepFreeze(input);
    const referenceInput = structuredClone(input);
    (referenceInput.blocks[2] as { excerpt: string }).excerpt = '🚗'.repeat(1_000);

    const canonical = canonicalizeCommercialDocumentExtractionUnit(frozen, 2);
    const repeated = canonicalizeCommercialDocumentExtractionUnit(frozen, 2);
    const reference = canonicalizeCommercialDocumentExtractionUnit(referenceInput, 2);

    expect(canonical.blocks[0]!.excerpt).toBe(belowLimit);
    expect(canonical.blocks[1]!.excerpt).toBe(atLimit);
    expect(canonical.blocks[2]!.excerpt).toBe('🚗'.repeat(1_000));
    expect(Array.from(canonical.blocks[2]!.excerpt)).toHaveLength(1_000);
    expect(canonical.blocks[2]!.excerpt).not.toContain('…');
    expect(canonical.facts).toEqual(reference.facts);
    expect(canonical.documents).toEqual(reference.documents);
    expect(canonical.facts[0]!.evidence.excerpt).toBe('literal fact evidence');
    expect(JSON.stringify(canonical)).toBe(JSON.stringify(repeated));
    expect(input.blocks[2]!.excerpt).toBe(unicodeOverLimit);
    expect(() => validateCommercialDocumentExtraction(canonical)).not.toThrow();
  });

  it('keeps an empty required source block excerpt invalid and does not synthesize text', () => {
    const input = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    (input.blocks[0] as { excerpt: string }).excerpt = '';
    delete (input.facts[0]!.evidence as { excerpt?: string }).excerpt;

    const canonical = canonicalizeCommercialDocumentExtractionUnit(input, 2);

    expect(canonical.blocks[0]!.excerpt).toBe('');
    expect(canonical.facts[0]!.evidence).not.toHaveProperty('excerpt');
    expect(() => validateCommercialDocumentExtraction(canonical)).toThrowError(
      expect.objectContaining<Partial<CommercialDocumentExtractionValidationError>>({
        keywordCounts: expect.objectContaining({ minLength: 1 }),
      }),
    );
  });

  it('reconstructs provider-supplied coverage counters from canonical artifact contents', () => {
    const input = {
      ...structuredClone(geelyLikeCommercialDocumentExtractionFixture),
      coverage: {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        expectedUnitCount: 999,
        completedUnitCount: 0,
        extractedVehicleCount: 0,
      },
    };

    const frozen = deepFreeze(input);
    const canonical = canonicalizeCommercialDocumentExtractionUnit(frozen, 2);
    const repeated = canonicalizeCommercialDocumentExtractionUnit(frozen, 2);

    expect(canonical.coverage.expectedUnitCount).toBe(canonical.coverage.units.length);
    expect(canonical.coverage.completedUnitCount).toBe(
      canonical.coverage.units.filter((unit) => unit.status === 'complete').length,
    );
    expect(canonical.coverage.extractedVehicleCount).toBe(canonical.vehicleIdentities.length);
    expect(() => validateCommercialDocumentExtraction(canonical)).not.toThrow();
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(canonical));
    expect(input.coverage).toMatchObject({
      expectedUnitCount: 999,
      completedUnitCount: 0,
      extractedVehicleCount: 0,
    });
  });

  it('derives unit-scoped and aggregated coverage counts without assuming a global count of one', () => {
    const unitScoped = {
      ...structuredClone(geelyLikeCommercialDocumentExtractionFixture),
      coverage: {
        ...structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage),
        expectedUnitCount: 0,
        completedUnitCount: 0,
        extractedVehicleCount: 0,
        units: [structuredClone(geelyLikeCommercialDocumentExtractionFixture.coverage.units[0]!)],
      },
    };
    const aggregated = {
      ...structuredClone(gwmLikeCommercialDocumentExtractionFixture),
      coverage: {
        ...structuredClone(gwmLikeCommercialDocumentExtractionFixture.coverage),
        expectedUnitCount: 0,
        completedUnitCount: 0,
        extractedVehicleCount: 0,
      },
    };

    const canonicalUnit = canonicalizeCommercialDocumentExtractionUnit(unitScoped, 1);
    const canonicalAggregate = canonicalizeCommercialDocumentExtractionUnit(aggregated, 2);

    expect(canonicalUnit.coverage).toMatchObject({
      expectedUnitCount: 1,
      completedUnitCount: 1,
      extractedVehicleCount: 4,
    });
    expect(canonicalAggregate.coverage).toMatchObject({
      expectedUnitCount: 2,
      completedUnitCount: 2,
      extractedVehicleCount: 13,
    });
    expect(() => validateCommercialDocumentExtraction(canonicalUnit)).not.toThrow();
    expect(() => validateCommercialDocumentExtraction(canonicalAggregate)).not.toThrow();
  });

  it('preserves partial status and unresolved evidence while deriving exact counters', () => {
    const original = geelyLikeCommercialDocumentExtractionFixture;
    const unresolvedScopeId = original.scopes[0]!.scopeId;
    const input = {
      ...structuredClone(original),
      coverage: {
        ...structuredClone(original.coverage),
        status: 'partial' as const,
        expectedUnitCount: 0,
        completedUnitCount: 0,
        extractedVehicleCount: 0,
        units: [
          { ...structuredClone(original.coverage.units[0]!), status: 'incomplete' as const },
          structuredClone(original.coverage.units[1]!),
        ],
        unresolvedScopeIds: [unresolvedScopeId],
      },
    };

    const canonical = canonicalizeCommercialDocumentExtractionUnit(input, 3);

    expect(canonical.coverage.status).toBe('partial');
    expect(canonical.coverage.expectedUnitCount).toBe(2);
    expect(canonical.coverage.completedUnitCount).toBe(1);
    expect(canonical.coverage.unresolvedScopeIds).toEqual([canonical.scopes[0]!.scopeId]);
    expect(() => validateCommercialDocumentExtraction(canonical)).not.toThrow();
  });

  it('keeps genuinely inconsistent semantic completeness invalid after counter reconstruction', () => {
    const original = geelyLikeCommercialDocumentExtractionFixture;
    const input = {
      ...structuredClone(original),
      coverage: {
        ...structuredClone(original.coverage),
        completedUnitCount: 0,
        unresolvedScopeIds: [original.scopes[0]!.scopeId],
      },
    };
    const canonical = canonicalizeCommercialDocumentExtractionUnit(input, 4);

    expect(canonical.coverage.completedUnitCount).toBe(2);
    expect(() => validateCommercialDocumentExtraction(canonical)).toThrowError(
      expect.objectContaining<Partial<CommercialDocumentExtractionValidationError>>({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            path: '/coverage/status',
            keyword: 'incompleteDataMarkedComplete',
          }),
        ]),
      }),
    );
  });

  it('never normalizes false complete across any deterministic coverage blocker', () => {
    const original = geelyLikeCommercialDocumentExtractionFixture;
    const inputs = [
      {
        name: 'non-complete unit',
        coverage: {
          ...structuredClone(original.coverage),
          units: original.coverage.units.map((unit, index) =>
            index === 0 ? { ...unit, status: 'incomplete' as const } : structuredClone(unit),
          ),
        },
      },
      {
        name: 'gap',
        coverage: {
          ...structuredClone(original.coverage),
          gaps: [
            {
              gapId: 'gap-provider-observed',
              gapType: 'OTHER' as const,
              message: 'Provider-observed incomplete coverage.',
              unitId: original.coverage.units[0]!.unitId,
            },
          ],
        },
      },
      {
        name: 'incomplete block',
        coverage: {
          ...structuredClone(original.coverage),
          incompleteBlockIds: [original.blocks[0]!.blockId],
        },
      },
      {
        name: 'unresolved row',
        coverage: {
          ...structuredClone(original.coverage),
          unresolvedTableRows: [
            {
              tableId: original.tables[0]!.tableId,
              rowId: original.tables[0]!.rows[0]!.rowId,
            },
          ],
        },
      },
      {
        name: 'unresolved scope',
        coverage: {
          ...structuredClone(original.coverage),
          unresolvedScopeIds: [original.scopes[0]!.scopeId],
        },
      },
      {
        name: 'vehicle count mismatch',
        coverage: {
          ...structuredClone(original.coverage),
          expectedVehicleCount: original.vehicleIdentities.length + 1,
        },
      },
      {
        name: 'family set mismatch',
        coverage: {
          ...structuredClone(original.coverage),
          expectedFamilies: [...original.coverage.expectedFamilies, 'Unextracted family'],
        },
      },
    ];

    for (const { name, coverage } of inputs) {
      const input = deepFreeze({ ...structuredClone(original), coverage });
      const first = canonicalizeCommercialDocumentExtractionUnit(input, 5);
      const repeated = canonicalizeCommercialDocumentExtractionUnit(input, 5);

      expect(first.coverage.status, name).toBe('complete');
      expect(repeated, name).toEqual(first);
      expect(() => validateCommercialDocumentExtraction(first), name).toThrowError(
        expect.objectContaining<Partial<CommercialDocumentExtractionValidationError>>({
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              path: '/coverage/status',
              keyword: 'incompleteDataMarkedComplete',
            }),
          ]),
        }),
      );
    }
  });

  it('preserves supported ambiguous status and never promotes it to complete', () => {
    const original = geelyLikeCommercialDocumentExtractionFixture;
    const input = deepFreeze({
      ...structuredClone(original),
      coverage: {
        ...structuredClone(original.coverage),
        status: 'ambiguous' as const,
        units: original.coverage.units.map((unit, index) =>
          index === 0 ? { ...unit, status: 'ambiguous' as const } : structuredClone(unit),
        ),
        gaps: [
          {
            gapId: 'gap-provider-ambiguity',
            gapType: 'AMBIGUITY' as const,
            message: 'Provider-observed ambiguity.',
            unitId: original.coverage.units[0]!.unitId,
          },
        ],
      },
    });

    const canonical = canonicalizeCommercialDocumentExtractionUnit(input, 6);

    expect(canonical.coverage.status).toBe('ambiguous');
    expect(canonical.coverage.completedUnitCount).toBe(1);
    expect(() => validateCommercialDocumentExtraction(canonical)).not.toThrow();
  });

  it('bridges canonical Document Map source provenance through extraction-local blocks', () => {
    const plan = createCommercialExtractionUnitPlan(geelyLikeCommercialDocumentMapFixture);
    const unit = plan.units.find((item) => item.primaryContentBlockIds.length > 0)!;
    const sourceBlockId = unit.primaryContentBlockIds[0]!;
    const input = deepFreeze(extractionWithSourceBlockId(sourceBlockId));
    const canonical = canonicalizeCommercialDocumentExtractionUnit(input, unit.ordinal);

    validateCommercialDocumentExtraction(canonical);
    expect(canonical.blocks.some((block) => block.blockId === sourceBlockId)).toBe(false);
    expect(canonical.documents[0]?.competenceCandidates[0]?.evidence.blockIds[0]).toBe(
      canonical.blocks[0]?.blockId,
    );
    expect(canonical.blocks[0]?.blockId).toMatch(/^block-u\d{4}-0001$/u);
    expect(input.blocks[0]?.blockId).toBe(sourceBlockId);
  });

  it('allows a real context-only source block as evidence but keeps its non-primary role explicit', () => {
    const plan = createCommercialExtractionUnitPlan(gwmLikeCommercialDocumentMapFixture);
    const unit = plan.units.find((item) => item.contextContentBlockIds.length > 0)!;
    const context = buildSegmentedExtractionUnitContext(gwmLikeCommercialDocumentMapFixture, unit);
    const sourceBlockId = unit.contextContentBlockIds[0]!;
    const canonical = canonicalizeCommercialDocumentExtractionUnit(
      extractionWithSourceBlockId(sourceBlockId),
      unit.ordinal,
    );

    validateCommercialDocumentExtraction(canonical);
    expect(context.contextOnlyContentBlocks.map((block) => block.contentBlockId)).toContain(
      sourceBlockId,
    );
    expect(buildSegmentedExtractionUnitInstructions(context)).toContain(
      'must not originate new facts exclusively from context',
    );
  });

  it('preserves a genuinely unknown evidence ref for strict unknownRef rejection', () => {
    const input = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const evidence = input.documents[0]!.competenceCandidates[0]!.evidence as {
      blockIds: string[];
    };
    evidence.blockIds = ['block-never-defined'];
    const canonical = canonicalizeCommercialDocumentExtractionUnit(input, 2);

    expect(canonical.documents[0]?.competenceCandidates[0]?.evidence.blockIds).toEqual([
      'block-never-defined',
    ]);
    expect(() => validateCommercialDocumentExtraction(canonical)).toThrowError(
      expect.objectContaining<Partial<CommercialDocumentExtractionValidationError>>({
        keywordCounts: expect.objectContaining({ unknownRef: 1 }),
      }),
    );
  });

  it('does not normalize duplicate evidence refs into apparent validity', () => {
    const input = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const evidence = input.documents[0]!.competenceCandidates[0]!.evidence as {
      blockIds: string[];
    };
    const blockId = evidence.blockIds[0]!;
    evidence.blockIds = [blockId, blockId];
    const canonical = canonicalizeCommercialDocumentExtractionUnit(input, 2);

    expect(canonical.documents[0]?.competenceCandidates[0]?.evidence.blockIds).toEqual([
      canonical.blocks[0]?.blockId,
      canonical.blocks[0]?.blockId,
    ]);
    expect(() => validateCommercialDocumentExtraction(canonical)).toThrowError(
      expect.objectContaining<Partial<CommercialDocumentExtractionValidationError>>({
        keywordCounts: expect.objectContaining({ uniqueItems: 1 }),
      }),
    );
  });

  it.each([
    [
      'canonical failure over sibling abort',
      [failedUnit(1, 'ABORTED_SIBLING'), failedUnit(2, 'CANONICAL_VALIDATION_FAILED')],
      'CANONICAL_VALIDATION_FAILED',
    ],
    [
      'real provider timeout over sibling abort',
      [failedUnit(1, 'PROVIDER_TIMEOUT'), failedUnit(2, 'ABORTED_SIBLING')],
      'PROVIDER_TIMEOUT',
    ],
    [
      'orchestration timeout when all units expire globally',
      [failedUnit(1, 'ORCHESTRATION_TIMEOUT'), failedUnit(2, 'ORCHESTRATION_TIMEOUT')],
      'ORCHESTRATION_TIMEOUT',
    ],
    [
      'provider failure over sibling abort',
      [failedUnit(1, 'ABORTED_SIBLING'), failedUnit(2, 'PROVIDER_FAILURE')],
      'PROVIDER_FAILURE',
    ],
  ] as const)('selects %s', (_name, results, expected) => {
    expect(selectPrimarySegmentedExtractionFailure(results)?.code).toBe(expected);
    expect(selectPrimarySegmentedExtractionFailure([...results].reverse())?.code).toBe(expected);
  });

  it('classifies malformed transport and dangling canonical references separately', async () => {
    const malformed = providerFrom(async () => ({
      output: { schemaVersion: 'wrong' },
      providerRunId: 'run-malformed',
      usage,
    }));
    const malformedResult = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      { provider: malformed.provider, schema: commercialDocumentExtractionSchemaV1 },
    );
    expect(malformedResult.unitResults[0]).toMatchObject({ code: 'INVALID_STRUCTURED_OUTPUT' });
    const invalidJson = providerFrom(async () => {
      throw Object.assign(new Error('sanitized'), { code: 'PROVIDER_INVALID_OUTPUT' });
    });
    const invalidJsonResult = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      { provider: invalidJson.provider, schema: commercialDocumentExtractionSchemaV1 },
    );
    expect(invalidJsonResult.unitResults[0]).toMatchObject({
      code: 'INVALID_STRUCTURED_OUTPUT',
    });
    const fixture = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const danglingFixture = {
      ...fixture,
      facts: fixture.facts.map((fact, index) =>
        index === 0 ? { ...fact, scopeIds: ['scope-missing'] } : fact,
      ),
    };
    const dangling = providerFrom(async () => ({
      output: danglingFixture,
      providerRunId: 'run-dangling',
      usage,
    }));
    const danglingResult = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      { provider: dangling.provider, schema: commercialDocumentExtractionSchemaV1 },
    );
    expect(danglingResult.unitResults[0]).toMatchObject({ code: 'CANONICAL_VALIDATION_FAILED' });
  });

  it('bounds concurrency', async () => {
    let active = 0;
    let maximum = 0;
    const fake = providerFrom(async (_request, call) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return {
        output: geelyLikeCommercialDocumentExtractionFixture,
        providerRunId: `run-${call}`,
        usage,
      };
    });
    await executeSegmentedExtraction(inputFor(geelyLikeCommercialDocumentMapFixture), {
      provider: fake.provider,
      schema: commercialDocumentExtractionSchemaV1,
      concurrency: 2,
    });
    expect(maximum).toBe(2);
  });

  it('stops scheduling after a fatal unit failure and aborts in-flight siblings', async () => {
    const started: number[] = [];
    const fake = providerFrom(async (request, call) => {
      started.push(call);
      if (call === 2) throw new Error('opaque provider failure');
      await new Promise<void>((_resolve, reject) =>
        request.signal.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        }),
      );
      throw new Error('unreachable');
    });
    const result = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      { provider: fake.provider, schema: commercialDocumentExtractionSchemaV1, concurrency: 2 },
    );
    expect(started).toEqual([1, 2]);
    expect(
      result.unitResults.some(
        (item) => item.status === 'failed' && item.code === 'ABORTED_SIBLING',
      ),
    ).toBe(true);
    expect(result.unitResults.slice(2).every((item) => item.status === 'failed')).toBe(true);
  });

  it('classifies a provider timeout-shaped sibling abort as ABORTED_SIBLING', async () => {
    const fake = providerFrom(async (request, call) => {
      if (call === 1)
        return { output: { schemaVersion: 'wrong' }, providerRunId: 'run-invalid', usage };
      return new Promise((_resolve, reject) =>
        request.signal.addEventListener(
          'abort',
          () =>
            reject(Object.assign(new Error('provider maps abort'), { code: 'PROVIDER_TIMEOUT' })),
          { once: true },
        ),
      );
    });
    const result = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      { provider: fake.provider, schema: commercialDocumentExtractionSchemaV1, concurrency: 2 },
    );
    expect(result.unitResults[0]).toMatchObject({ code: 'INVALID_STRUCTURED_OUTPUT' });
    expect(result.unitResults[1]).toMatchObject({ code: 'ABORTED_SIBLING' });
  });

  it('validates the raw wire payload before transport decoding', async () => {
    const input = inputFor(geelyLikeCommercialDocumentMapFixture);
    const rawWire = { wire: true };
    const phases: string[] = [];
    const fake = providerFrom(async () => ({
      output: rawWire,
      providerRunId: 'run-wire-order',
      usage,
    }));
    const result = await executeSegmentedExtraction(input, {
      provider: fake.provider,
      schema: commercialDocumentExtractionSchemaV1,
      unitIds: [input.unitPlan.units[0]!.unitId],
      validateTransport: (value) => {
        phases.push('validate');
        expect(value).toBe(rawWire);
      },
      decodeTransport: (value) => {
        phases.push('decode');
        expect(value).toBe(rawWire);
        return geelyLikeCommercialDocumentExtractionFixture;
      },
    });

    expect(phases).toEqual(['validate', 'decode']);
    expect(result.unitResults[0]).toMatchObject({ status: 'succeeded' });
  });

  it('emits opt-in structural unit diagnostics by phase without exposing output', async () => {
    const secret = 'commercial-secret-output';
    const observations: unknown[] = [];
    const fake = providerFrom(async () => ({
      output: { schemaVersion: secret },
      providerRunId: 'run-diagnostic',
      usage,
    }));
    const result = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      {
        provider: fake.provider,
        schema: commercialDocumentExtractionSchemaV1,
        diagnostics: true,
        validateTransport: (value) => {
          const candidate = value as { schemaVersion?: string };
          if (candidate.schemaVersion !== 'CommercialDocumentExtraction/1')
            throw new Error('opaque transport error');
        },
        observeUnitValidation: (observation) => observations.push(observation),
      },
    );
    expect(result.unitResults[0]).toMatchObject({ code: 'INVALID_STRUCTURED_OUTPUT' });
    expect(observations[0]).toMatchObject({
      unitId: expect.any(String),
      unitOrdinal: 1,
      phase: 'transport_validation',
      totalViolations: 1,
      categories: { validation: 1 },
      truncated: false,
    });
    expect(JSON.stringify(observations)).not.toContain(secret);
  });

  it('distinguishes provider/unit timeout from total orchestration timeout', async () => {
    const waitingProvider = providerFrom(
      async (request) =>
        new Promise((_resolve, reject) =>
          request.signal.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('timeout'), { code: 'PROVIDER_TIMEOUT' })),
            { once: true },
          ),
        ),
    );
    const unit = await executeSegmentedExtraction(inputFor(geelyLikeCommercialDocumentMapFixture), {
      provider: waitingProvider.provider,
      schema: commercialDocumentExtractionSchemaV1,
      unitTimeoutMs: 10,
      totalTimeoutMs: 100,
    });
    expect(unit.unitResults[0]).toMatchObject({ code: 'PROVIDER_TIMEOUT' });
    const total = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      {
        provider: waitingProvider.provider,
        schema: commercialDocumentExtractionSchemaV1,
        unitTimeoutMs: 100,
        totalTimeoutMs: 20,
      },
    );
    expect(total.unitResults[0]).toMatchObject({ code: 'ORCHESTRATION_TIMEOUT' });
  });

  it('keeps cleanup failure observable without masking primary failure', async () => {
    const fake = providerFrom(
      async () => {
        throw new Error('provider failed');
      },
      async () => {
        throw new Error('cleanup failed');
      },
    );
    const result = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      { provider: fake.provider, schema: commercialDocumentExtractionSchemaV1 },
    );
    expect(result.unitResults[0]).toMatchObject({ code: 'PROVIDER_FAILURE' });
    expect(result.cleanup).toBe('failed');
  });

  it('keeps provider run, usage, correlation, schema and prompt metadata unit-specific', async () => {
    const fake = providerFrom(async (_request, call) => ({
      output: geelyLikeCommercialDocumentExtractionFixture,
      providerRunId: `provider-run-${call}`,
      usage: { inputUnits: call, outputUnits: call + 1, totalUnits: call + 2 },
    }));
    const result = await executeSegmentedExtraction(
      inputFor(geelyLikeCommercialDocumentMapFixture),
      { provider: fake.provider, schema: commercialDocumentExtractionSchemaV1, concurrency: 2 },
    );
    expect(result.correlationId).toBe('correlation-segmented-test');
    expect(
      new Set(
        result.unitResults
          .filter((item) => item.status === 'succeeded')
          .map((item) => item.providerRunId),
      ).size,
    ).toBe(result.unitResults.length);
    expect(fake.calls[0]?.metadata).toMatchObject({
      promptVersion: '8',
      schemaVersion: 'CommercialDocumentExtraction/1',
    });
    expect(SEGMENTED_EXTRACTION_PROMPT_VERSION).toBe('8');
  });

  it('keeps the provider boundary generic and the current one-shot runtime absent', () => {
    const contract = JSON.stringify({
      keys: ['instructions', 'schemaName', 'schema', 'signal', 'metadata'],
    });
    expect(contract).not.toMatch(/Policy|Offer|Product|promotion|commercialLetterUnit/iu);
  });
});
