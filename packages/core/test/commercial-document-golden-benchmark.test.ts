import { describe, expect, it } from 'vitest';

import type {
  CommercialDocumentExtractionV1,
  CommercialDocumentFact,
} from '../src/import/commercial-document-extraction';
import {
  formatCommercialDocumentGoldenBenchmark,
  runCommercialDocumentGoldenBenchmark,
  type GoldenBenchmarkComposition,
  type GoldenBenchmarkFact,
} from '../src/import/commercial-document-golden-benchmark';

const document = 'Jeep 202606-01.pdf';
const confidence = { score: 100, ambiguous: false, requiresReview: false, reasons: [] } as const;

const goldenFact = (overrides: Partial<GoldenBenchmarkFact> = {}): GoldenBenchmarkFact => ({
  id: 'jeep-vd-reference',
  document,
  page: 6,
  channel: 'VD-CPF',
  model: 'Compass',
  version: 'Sport',
  productionYear: 2026,
  modelYear: 2026,
  factType: 'public_price',
  value: '174990',
  unit: 'BRL',
  evidence: 'de R$ 174.990 por R$ 147.990',
  critical: true,
  ...overrides,
});

const fact = (
  id: string,
  overrides: Partial<CommercialDocumentFact> = {},
): CommercialDocumentFact => ({
  factId: id,
  factType: 'public_price',
  value: { kind: 'money', amount: '174990.00', currency: 'BRL' },
  channel: 'VD-CPF',
  eligibility: [],
  restrictions: [],
  scopeIds: ['scope-vehicle', 'scope-channel'],
  evidence: {
    blockIds: [`block-${id}`],
    excerpt: 'de R$ 174.990 por R$ 147.990',
  },
  confidence,
  ...overrides,
});

const extraction = (
  facts: readonly CommercialDocumentFact[],
  options: {
    readonly relation?: 'AND' | 'OR';
    readonly memberFactIds?: readonly string[];
    readonly compositionEvidence?: string;
    readonly channel?: string;
  } = {},
): CommercialDocumentExtractionV1 => {
  const compositionEvidence =
    options.compositionEvidence ?? 'Supervalorização no seu usado OU Taxa 0%';
  const memberFactIds = options.memberFactIds ?? [];
  const hasComposition = memberFactIds.length > 0;
  const relation = options.relation ?? 'OR';
  return {
    schemaVersion: 'CommercialDocumentExtraction/1',
    documents: [
      {
        documentId: 'document-1',
        ordinal: 1,
        pageCount: 12,
        documentKind: 'commercial_letter',
        competenceCandidates: [],
        validityCandidates: [],
        notes: [],
      },
    ],
    blocks: [
      ...facts.flatMap((item) =>
        item.evidence.blockIds.map((blockId) => ({
          blockId,
          documentId: 'document-1',
          page: 6,
          blockType: 'paragraph' as const,
          excerpt: item.evidence.excerpt ?? '',
        })),
      ),
      ...(hasComposition
        ? [
            {
              blockId: 'block-composition',
              documentId: 'document-1',
              page: 6,
              blockType: 'paragraph' as const,
              excerpt: compositionEvidence,
            },
          ]
        : []),
    ],
    tables: [],
    vehicleIdentities: [
      {
        vehicleIdentityId: 'vehicle-compass',
        brand: 'Jeep',
        model: 'Compass',
        version: 'Sport',
        productionYear: 2026,
        modelYear: 2026,
        evidence: { blockIds: facts[0]?.evidence.blockIds ?? [] },
        confidence,
      },
    ],
    facts,
    scopes: [
      {
        scopeId: 'scope-vehicle',
        scopeType: 'VEHICLE',
        selector: { vehicleIdentityIds: ['vehicle-compass'] },
        exclusions: {},
        evidenceBlockIds: facts[0]?.evidence.blockIds ?? [],
        ambiguous: false,
        requiresReview: false,
      },
      {
        scopeId: 'scope-channel',
        scopeType: 'CHANNEL',
        selector: { channels: [options.channel ?? 'VD-CPF'] },
        exclusions: {},
        evidenceBlockIds: facts[0]?.evidence.blockIds ?? [],
        ambiguous: false,
        requiresReview: false,
      },
    ],
    composition: {
      groups: hasComposition
        ? [
            {
              groupId: 'group-offer',
              groupType: relation === 'OR' ? 'ALTERNATIVE' : 'CUMULATIVE',
              memberFactIds,
              sharedFactIds: [],
              scopeIds: ['scope-vehicle', 'scope-channel'],
            },
          ]
        : [],
      relationships: hasComposition
        ? [
            {
              relationId: 'relation-offer',
              relationType: relation === 'OR' ? 'MUTUALLY_EXCLUSIVE' : 'APPLIES_TOGETHER',
              factIds: memberFactIds,
              groupIds: ['group-offer'],
              scopeIds: ['scope-vehicle', 'scope-channel'],
              evidenceBlockIds: ['block-composition'],
            },
          ]
        : [],
    },
    coverage: {
      status: 'complete',
      expectedUnitCount: 1,
      completedUnitCount: 1,
      expectedVehicleCount: 1,
      extractedVehicleCount: 1,
      expectedFamilies: ['Compass'],
      extractedFamilies: ['Compass'],
      units: [
        {
          unitId: 'unit-1',
          status: 'complete',
          sourceBlockIds: facts.flatMap((item) => item.evidence.blockIds),
          expectedItemCount: facts.length,
          extractedItemCount: facts.length,
        },
      ],
      gaps: [],
      incompleteBlockIds: [],
      unresolvedTableRows: [],
      unresolvedScopeIds: [],
    },
  };
};

const run = (
  artifact: CommercialDocumentExtractionV1,
  expectedFacts: readonly GoldenBenchmarkFact[] = [goldenFact()],
  expectedCompositions: readonly GoldenBenchmarkComposition[] = [],
) =>
  runCommercialDocumentGoldenBenchmark({
    document,
    artifact,
    expectedFacts,
    expectedCompositions,
  });

describe('commercial document golden benchmark', () => {
  it('passes an exact semantic fact match and emits JSON plus readable text', () => {
    const report = run(extraction([fact('fact-reference')]));
    expect(report).toMatchObject({
      facts: { expected: 1, matched: 1, missing: 0, wrong: 0, unexpected: 0 },
      criticalFactRecall: 1,
      overallFactRecall: 1,
      precision: 1,
      compositionAccuracy: 1,
      provenanceAccuracy: 1,
      status: 'PASS',
    });
    expect(JSON.parse(JSON.stringify(report))).toMatchObject({ document, status: 'PASS' });
    expect(formatCommercialDocumentGoldenBenchmark(report)).toContain('PASS Jeep 202606-01.pdf');
  });

  it('does not equate the same numeric value with the wrong fact type', () => {
    const report = run(extraction([fact('fact-promo', { factType: 'promotional_price' })]));
    expect(report.facts).toMatchObject({ matched: 0, wrong: 1 });
    expect(report.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WRONG_FACT_TYPE' })]),
    );
    expect(report.status).toBe('FAIL');
  });

  it('reports missing and wrong-valued facts separately', () => {
    const wrongValue = run(
      extraction([
        fact('fact-reference', {
          value: { kind: 'money', amount: '147990', currency: 'BRL' },
        }),
      ]),
    );
    expect(wrongValue.facts).toMatchObject({ matched: 0, wrong: 1, missing: 0 });
    expect(wrongValue.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WRONG_VALUE' })]),
    );

    const missing = run(extraction([]));
    expect(missing.facts).toMatchObject({ matched: 0, wrong: 0, missing: 1 });
    expect(missing.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_FACT' })]),
    );
  });

  it('rejects a fact from the wrong channel even when value and vehicle match', () => {
    const report = run(
      extraction([fact('fact-reference', { channel: 'VAREJO' })], { channel: 'VAREJO' }),
    );
    expect(report.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WRONG_CHANNEL' })]),
    );
    expect(report.status).toBe('FAIL');
  });

  it('fails disconnected evidence and records provenance independently', () => {
    const report = run(
      extraction([
        fact('fact-reference', {
          evidence: { blockIds: ['missing-block'], excerpt: '' },
        }),
      ]),
    );
    expect(report.facts.matched).toBe(1);
    expect(report.provenanceAccuracy).toBe(0);
    expect(report.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MISSING_EVIDENCE' })]),
    );
  });

  it('counts a duplicate semantic fact as unexpected and lowers precision', () => {
    const report = run(extraction([fact('fact-reference-1'), fact('fact-reference-2')]));
    expect(report.facts).toMatchObject({ matched: 1, unexpected: 1 });
    expect(report.precision).toBe(0.5);
    expect(report.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNEXPECTED_FACT' })]),
    );
  });

  it('rejects AND when the audited offer is OR', () => {
    const expectedFacts = [
      goldenFact({ id: 'jeep-vd-tradein', factType: 'trade_in', value: '3000' }),
      goldenFact({
        id: 'jeep-vd-fin-rate',
        factType: 'financing_rate',
        value: '0',
        unit: 'percent',
        evidence: 'Taxa 0% com 60% de entrada em 24x',
      }),
    ];
    const facts = [
      fact('fact-tradein', {
        factType: 'trade_in',
        value: { kind: 'money', amount: '3000', currency: 'BRL' },
      }),
      fact('fact-financing', {
        factType: 'financing_rate',
        value: { kind: 'percentage', percentage: '0' },
        evidence: {
          blockIds: ['block-fact-financing'],
          excerpt: 'Taxa 0% com 60% de entrada em 24x',
        },
      }),
    ];
    const expectedComposition: GoldenBenchmarkComposition = {
      id: 'jeep-compass-vd-tradein-or-finance',
      document,
      page: 6,
      channel: 'VD-CPF',
      model: 'Compass',
      version: 'Sport',
      relation: 'OR',
      memberFactIds: ['jeep-vd-tradein', 'jeep-vd-fin-rate'],
      evidence: 'Supervalorização no seu usado OU Taxa 0%',
    };
    const report = run(
      extraction(facts, {
        relation: 'AND',
        memberFactIds: facts.map((item) => item.factId),
      }),
      expectedFacts,
      [expectedComposition],
    );
    expect(report.compositionAccuracy).toBe(0);
    expect(report.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'WRONG_COMPOSITION_RELATION' })]),
    );
    expect(report.status).toBe('FAIL');
  });

  it('protects the Jeep 174990 reference versus 147990 customer-price invariant', () => {
    const expectedFacts = [
      goldenFact(),
      goldenFact({
        id: 'jeep-vd-promo',
        factType: 'promotional_price',
        value: '147990',
        evidence: 'PREÇO CLIENTE: R$ 147.990',
      }),
    ];
    const correct = run(
      extraction([
        fact('fact-reference'),
        fact('fact-promo', {
          factType: 'promotional_price',
          value: { kind: 'money', amount: '147990', currency: 'BRL' },
          evidence: {
            blockIds: ['block-fact-promo'],
            excerpt: 'PREÇO CLIENTE: R$ 147.990',
          },
        }),
      ]),
      expectedFacts,
    );
    expect(correct.status).toBe('PASS');

    const swapped = run(
      extraction([
        fact('fact-wrong-reference', {
          factType: 'promotional_price',
          value: { kind: 'money', amount: '174990', currency: 'BRL' },
        }),
        fact('fact-wrong-promo', {
          factType: 'public_price',
          value: { kind: 'money', amount: '147990', currency: 'BRL' },
          evidence: {
            blockIds: ['block-fact-wrong-promo'],
            excerpt: 'PREÇO CLIENTE: R$ 147.990',
          },
        }),
      ]),
      expectedFacts,
    );
    expect(swapped.criticalFactRecall).toBe(0);
    expect(swapped.status).toBe('FAIL');
  });
});
