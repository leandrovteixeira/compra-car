import { describe, expect, it } from 'vitest';
import type {
  SegmentedExtractionSource,
  StructuredExtractionProvider,
  StructuredExtractionRequest,
  StructuredExtractionResponse,
} from '../src/import/segmented-extraction';
import {
  buildSegmentedExtractionUnitContext,
  buildSegmentedExtractionUnitInstructions,
  executeSegmentedExtraction,
} from '../src/import/segmented-extraction-orchestrator';
import { commercialDocumentExtractionSchemaV1 } from '../src/import/commercial-document-extraction-schema';
import { createCommercialExtractionUnitPlan } from '../src/import/commercial-document-map-planner';
import { canonicalizeCommercialDocumentExtractionUnit } from '../src/import/commercial-document-extraction-canonicalizer';
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
      promptVersion: '1',
      schemaVersion: 'CommercialDocumentExtraction/1',
    });
  });

  it('keeps the provider boundary generic and the current one-shot runtime absent', () => {
    const contract = JSON.stringify({
      keys: ['instructions', 'schemaName', 'schema', 'signal', 'metadata'],
    });
    expect(contract).not.toMatch(/Policy|Offer|Product|promotion|commercialLetterUnit/iu);
  });
});
