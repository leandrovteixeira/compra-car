import { describe, expect, it } from 'vitest';
import { ModelYearAgent } from '../src/agents/model-year-agent';
import type { CanonicalMmv } from '../src/agents/mmv-apply-contract';
import type { CurrentMmvDiscoverySnapshot } from '../src/agents/new-product-check-types';

const mmv: CanonicalMmv = {
  id: '11111111-1111-4111-8111-111111111111',
  market: 'BR',
  identityKey: 'niro-ex',
  brand: 'Kia',
  model: 'Niro',
  officialVersionLabel: 'EX',
  bodyStyle: null,
  powertrainLabel: null,
  propulsion: 'HEV',
  engineDisplacement: 1.6,
  status: 'ACTIVE',
  visibility: 'PRIVATE',
  sourceFindingId: 'a',
  lastConfirmedFindingId: 'b',
  createdBy: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function discovery(modelYear = 2027, productionYear: number | null = 2026): CurrentMmvDiscoverySnapshot {
  const candidate = {
    brand: 'Kia',
    model: 'Niro',
    taxonomy: 'VARIANT' as const,
    officialVersionLabel: 'EX',
    trim: 'EX',
    powertrainLabel: null,
    engineDisplacement: 1.6,
    engineLabel: null,
    propulsion: 'HEV' as const,
    transmission: null,
    drivetrain: null,
    productionYear,
    modelYear,
    confidence: 0.98,
    evidence: [
      {
        url: 'https://www.kia.com.br/niro',
        title: 'Niro',
        excerpt: 'Niro EX 2026/2027',
        evidenceType: 'MODEL_PAGE' as const,
      },
    ],
  };
  return {
    schemaVersion: '20C.1',
    runId: 'run-21',
    startedAt: '2026-10-06T00:00:00.000Z',
    completedAt: '2026-10-06T00:01:00.000Z',
    brand: 'Kia',
    market: 'BR',
    researchedCandidates: 1,
    acceptedCandidates: 1,
    modelsDiscovered: 1,
    variantsResolved: 1,
    observations: [candidate],
    candidates: [candidate],
    bodyModelProposals: [],
    rejectedCandidates: [],
    rejectedExternalSources: 0,
    researchMetadata: { provider: 'fixture' },
  };
}

describe('ModelYearAgent', () => {
  it('proposes a new model year for an existing MMV', () => {
    const result = new ModelYearAgent().run({
      discovery: discovery(),
      mmvs: [mmv],
      knownYears: [],
    });
    expect(result.findings[0]).toMatchObject({
      findingType: 'NEW_PRODUCT_YEAR',
      reasonCode: 'NEW_MODEL_YEAR',
      mmvId: mmv.id,
      requiresReview: true,
      proposal: {
        action: 'STAGE_PRODUCT_YEAR',
        productionYear: 2026,
        modelYear: 2027,
      },
    });
  });

  it('does not let Model Year create a new MMV', () => {
    const result = new ModelYearAgent().run({
      discovery: discovery(),
      mmvs: [],
      knownYears: [],
    });
    expect(result.findings[0]).toMatchObject({
      findingType: 'POSSIBLE_NEW_MMV',
      reasonCode: 'POSSIBLE_NEW_MMV',
      proposal: null,
    });
  });

  it('flags invalid production/model year pairs', () => {
    const result = new ModelYearAgent().run({
      discovery: discovery(2027, 2024),
      mmvs: [mmv],
      knownYears: [],
    });
    expect(result.findings[0]).toMatchObject({
      findingType: 'PRODUCTION_MODEL_YEAR_CONFLICT',
      proposal: null,
    });
  });

  it('does not invent a production year when only MY is observed', () => {
    const result = new ModelYearAgent().run({
      discovery: discovery(2027, null),
      mmvs: [mmv],
      knownYears: [],
    });
    expect(result.findings[0]).toMatchObject({
      findingType: 'PRODUCT_YEAR_UNCERTAIN',
      reasonCode: 'INSUFFICIENT_YEAR_EVIDENCE',
      proposal: null,
      subject: { productionYear: null, modelYear: 2027 },
    });
  });
});
