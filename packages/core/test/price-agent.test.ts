import { describe, expect, it, vi } from 'vitest';
import {
  DeterministicFirstPriceResearch,
  extractDeterministicPrice,
  makePriceSnapshot,
  mapPriceRunToPlatform,
  priceSourceAppliesToModel,
  priceTargetBinding,
  priceVersionAliases,
  type PriceTarget,
} from '../src/agents';
import type { BrandConnector } from '../src/agents';

const target: PriceTarget = {
  productId: '101',
  mmvIdentity: 'jeep|compass|longitude t270',
  brand: 'Jeep',
  model: 'Compass',
  version: 'Longitude T270',
  modelYear: 2027,
  currentPrice: {
    id: '900',
    money: { amount: '189990.00', currencyCode: 'BRL' },
    startsOn: '2026-09-01',
    status: 'published',
  },
};

const connector: BrandConnector = {
  id: '11111111-1111-4111-8111-111111111111',
  targetId: '22222222-2222-4222-8222-222222222222',
  version: 1,
  status: 'ACTIVE',
  fingerprint: 'f'.repeat(64),
  sourceFindingId: null,
  activatedBy: null,
  activatedAt: '2026-10-01T00:00:00.000Z',
  supersededAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  brand: 'Jeep',
  market: 'BR',
  allowedDomains: ['jeep.com.br'],
  sourceEntries: [{ type: 'MODEL_PAGE', url: 'https://www.jeep.com.br/compass.html', priority: 1 }],
  searchHints: [],
  terminologyHints: [],
};

describe('Price Agent', () => {
  it('binds verbose catalog versions through conservative trim aliases', () => {
    const verboseTarget: PriceTarget = {
      ...target,
      model: 'Renegade',
      version: 'Longitude 1.3 TGDI AT MHEV',
    };
    const snapshot = makePriceSnapshot({
      target: verboseTarget,
      sourceUrl: 'https://www.jeep.com.br/renegade.html',
      sourceKind: 'OFFICIAL_MODEL_PAGE',
      body: 'Jeep Renegade Longitude MHEV. Consulte as condições.',
    });
    expect(priceVersionAliases(verboseTarget)).toContain('longitude');
    expect(priceSourceAppliesToModel(snapshot, verboseTarget)).toBe(true);
    expect(priceTargetBinding('Jeep Renegade Longitude MHEV', verboseTarget)).toBe(true);
  });

  it('rejects an official source scoped to another model before version matching', () => {
    const snapshot = makePriceSnapshot({
      target,
      sourceUrl: 'https://www.jeep.com.br/commander.html',
      sourceKind: 'OFFICIAL_MODEL_PAGE',
      body: 'Jeep Commander Longitude. R$ 200.000,00',
    });
    expect(priceSourceAppliesToModel(snapshot, target)).toBe(false);
  });

  it('extracts official MSRP and unconditional retail bonus deterministically', () => {
    const snapshot = makePriceSnapshot({
      target,
      sourceUrl: 'https://www.jeep.com.br/compass.html',
      sourceKind: 'OFFICIAL_MODEL_PAGE',
      fetchedAt: '2026-10-07T12:00:00.000Z',
      body:
        'Jeep Compass Longitude T270. Preço público sugerido: R$ 184.990,00. Bônus varejo de R$ 5.000,00.',
    });
    const result = extractDeterministicPrice(snapshot, target);
    expect(result?.msrpAmount).toBe('184990.00');
    expect(result?.retailBonusAmount).toBe('5000.00');
    expect(result?.confidence).toBeGreaterThan(0.9);
  });

  it('normalizes fragmented HTML before matching model, version and price', () => {
    const snapshot = makePriceSnapshot({
      target,
      sourceUrl: 'https://www.jeep.com.br/compass.html',
      sourceKind: 'OFFICIAL_MODEL_PAGE',
      body:
        '<div>Jeep <strong>Compass</strong></div><div>Longitude <span>T270</span></div><p>Preço público sugerido:&nbsp;<b>R$ 184.990,00</b></p>',
    });
    const result = extractDeterministicPrice(snapshot, target);
    expect(result?.msrpAmount).toBe('184990.00');
  });

  it('does not classify conditional trade-in language as retail bonus', () => {
    const snapshot = makePriceSnapshot({
      target,
      sourceUrl: 'https://www.jeep.com.br/compass.html',
      sourceKind: 'OFFICIAL_MODEL_PAGE',
      body:
        'Jeep Compass Longitude T270. Preço público sugerido: R$ 184.990,00. Bônus de R$ 10.000,00 mediante troca do usado.',
    });
    const result = extractDeterministicPrice(snapshot, target);
    expect(result?.msrpAmount).toBe('184990.00');
    expect(result?.retailBonusAmount).toBeNull();
  });

  it('reuses an upstream source snapshot before network or document intelligence', async () => {
    const cached = makePriceSnapshot({
      target,
      sourceUrl: 'https://www.jeep.com.br/compass.html',
      sourceKind: 'OFFICIAL_MODEL_PAGE',
      body: 'Jeep Compass Longitude T270. Preço público sugerido: R$ 184.990,00.',
      reusedFromAgentRunId: '33333333-3333-4333-8333-333333333333',
    });
    const fetch = vi.fn(async () => []),
      documentIntelligence = { extract: vi.fn(async () => null) };
    const research = new DeterministicFirstPriceResearch({
      upstreamCache: { snapshots: async () => [cached] },
      fetch,
      documentIntelligence,
    });
    const result = await research.researchPrices([target], connector);
    expect(result.metrics.cacheHits).toBe(1);
    expect(result.metrics.networkFetches).toBe(0);
    expect(result.metrics.documentIntelligenceCalls).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(documentIntelligence.extract).not.toHaveBeenCalled();
  });

  it('creates review-only PRICE_CHANGE and emits nothing when MSRP is unchanged', () => {
    const evidence = {
      sourceUrl: 'https://www.jeep.com.br/compass.html',
      sourceKind: 'OFFICIAL_MODEL_PAGE' as const,
      contentHash: 'a'.repeat(64),
      locator: 'deterministic:price-context',
      excerpt: 'Preço público sugerido: R$ 184.990,00',
      capturedAt: '2026-10-07T12:00:00.000Z',
    };
    const observation = {
      target,
      currencyCode: 'BRL' as const,
      msrpAmount: '184990.00',
      publicOfferAmount: null,
      retailBonusAmount: null,
      validFrom: null,
      validTo: null,
      confidence: 0.98,
      ambiguityReasons: [],
      evidence: [evidence],
    };
    const changed = mapPriceRunToPlatform({
      runId: '44444444-4444-4444-8444-444444444444',
      startedAt: '2026-10-07T12:00:00.000Z',
      completedAt: '2026-10-07T12:00:01.000Z',
      brand: 'Jeep',
      market: 'BR',
      provider: 'deterministic',
      connector,
      observations: [observation],
      metrics: {},
    });
    expect(changed.findings).toHaveLength(1);
    expect(changed.findings[0]?.finding.findingType).toBe('PRICE_CHANGE');
    expect(changed.findings[0]?.finding.requiresReview).toBe(true);
    expect(changed.findings[0]?.finding.proposal?.workflowStatus).toBe('needs_review');

    const unchanged = mapPriceRunToPlatform({
      runId: '55555555-5555-4555-8555-555555555555',
      startedAt: '2026-10-07T12:00:00.000Z',
      completedAt: '2026-10-07T12:00:01.000Z',
      brand: 'Jeep',
      market: 'BR',
      provider: 'deterministic',
      connector,
      observations: [{ ...observation, msrpAmount: '189990.00' }],
      metrics: {},
    });
    expect(unchanged.findings).toHaveLength(0);
    expect(unchanged.run.summary.unchangedPrices).toBe(1);
  });
});
