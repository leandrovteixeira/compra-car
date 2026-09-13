import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdministrativeProductCatalogReader,
  FixtureProductCatalogReader,
  FixtureProductResearchProvider,
  NewProductCheckAgent,
  ProductCandidateMatcher,
  officialBrandSource,
  officialEvidenceUrl,
  jeepFixtureCandidates,
  jeepFixtureCatalog,
  toyotaFixtureCandidates,
  productCheckFixture,
  benchmarkProductFixture,
  normalizePowertrainComponents,
  parseLegacyProductVersion,
  findingFingerprint,
  type NewProductCheckResult,
} from '../src/agents';

const scope = { country: 'BR', brand: 'Jeep' } as const;
const base = jeepFixtureCandidates[0]!;
const matcher = new ProductCandidateMatcher();
beforeEach(() =>
  vi.stubGlobal('fetch', () => {
    throw new Error('Network forbidden');
  }),
);
afterEach(() => vi.unstubAllGlobals());
async function run(brand = 'Jeep') {
  return new NewProductCheckAgent({
    research: new FixtureProductResearchProvider(),
    catalog: new FixtureProductCatalogReader(),
    reports: { write: async () => {} },
  }).run({ country: 'BR', brand }, 'cross-brand-test');
}

describe('Jeep BR source configuration', () => {
  it('selects canonical scope and Jeep-only domains/hints', () => {
    const source = officialBrandSource({ country: 'BR', brand: ' JEEP ' });
    expect(source).toMatchObject({
      brand: 'Jeep',
      country: 'BR',
      allowedDomains: ['jeep.com.br'],
      allowedSubdomainRoots: ['jeep.com.br'],
    });
    for (const hint of [
      'versões',
      'ficha técnica',
      'monte o seu',
      'configurador',
      'motor',
      'powertrain',
      'T270',
      'T270 MHEV',
      'Hurricane',
      'Hurricane Flex',
      'ano modelo',
      'Jeep Brasil',
    ])
      expect(source.searchHints.join(' ')).toContain(hint);
    expect(source.searchHints.join(' ')).not.toContain('toyota');
  });
  it.each([
    'https://jeep.com.br/',
    'https://www.jeep.com.br/modelos',
    'https://configurador.jeep.com.br/compass',
    'https://conteudo.jeep.com.br/ficha.pdf',
    'https://a.b.jeep.com.br/ficha.pdf',
  ])('accepts official hostname %s', (url) =>
    expect(officialEvidenceUrl(url, officialBrandSource(scope))).toBe(url),
  );
  it.each([
    'https://jeep.com.br.fake-site.com',
    'https://fake-jeep.com.br',
    'https://jeep.example.com',
    'https://jeep.com.br@evil.test',
    'https://user:password@jeep.com.br',
    'http://jeep.com.br',
    'https://jeep.com.br:8443',
    'https://stellantis.com',
    'https://media.stellantis.com',
    'https://toyota.com.br',
    'https://.jeep.com.br',
    'https://a..jeep.com.br',
    'https://-bad.jeep.com.br',
    'https://bad_.jeep.com.br',
    'https://jeep.com.br./',
    'https://evil.test/jeep.com.br',
  ])('rejects unauthorized or malformed host %s', (url) =>
    expect(officialEvidenceUrl(url, officialBrandSource(scope))).toBeNull(),
  );
  it('strips fragments and preserves Toyotas narrower host policy', () => {
    expect(
      officialEvidenceUrl(
        'https://configurador.jeep.com.br/compass#versions',
        officialBrandSource(scope),
      ),
    ).toBe('https://configurador.jeep.com.br/compass');
    expect(
      officialEvidenceUrl(
        'https://dealer.toyota.com.br',
        officialBrandSource({ country: 'BR', brand: 'Toyota' }),
      ),
    ).toBeNull();
    expect(() => officialBrandSource({ country: 'BR', brand: 'Volkswagen' })).toThrow(
      'UNSUPPORTED_AGENT_SCOPE',
    );
  });
});

describe('commercial powertrain reconciliation without brand rules', () => {
  it.each(
    jeepFixtureCandidates
      .slice(0, 4)
      .map((candidate, index) => ({ candidate, product: jeepFixtureCatalog[index]! })),
  )('reconciles $product.id from published components', ({ candidate, product }) => {
    expect(matcher.match(scope, candidate, jeepFixtureCatalog)).toMatchObject({
      matched: {
        matchMode: 'LEGACY_NAMING',
        matchedProductIds: [product.id],
        candidate: {
          officialVersionLabel: candidate.officialVersionLabel,
          powertrainLabel: candidate.powertrainLabel,
        },
      },
    });
  });
  it('does not infer technical meaning from T270 or Hurricane', () => {
    for (const label of ['T270', 'T270 MHEV', 'Hurricane', 'Hurricane Flex'])
      expect(normalizePowertrainComponents(label).displacement).toBeNull();
    expect(
      parseLegacyProductVersion({ ...jeepFixtureCatalog[0]!, version: 'Longitude T270' })
        .engineDisplacement,
    ).toBeNull();
  });
  it('uses unique MHEV compatibility while keeping absent displacement null', () => {
    const candidate = { ...jeepFixtureCandidates[1]!, engineDisplacement: null };
    expect(matcher.match(scope, candidate, jeepFixtureCatalog)).toMatchObject({
      matched: {
        matchedProductIds: ['jeep-renegade-longitude-mhev'],
        candidate: { engineDisplacement: null, powertrainLabel: 'T270 MHEV' },
      },
    });
  });
  it('leaves multiple compatible options ambiguous when official technical facts are missing', () => {
    expect(
      matcher.match(
        scope,
        { ...base, engineDisplacement: null, propulsion: null, transmission: null },
        jeepFixtureCatalog,
      ),
    ).toMatchObject({
      finding: {
        type: 'AMBIGUOUS',
        matchedProductIds: ['jeep-renegade-longitude-ice', 'jeep-renegade-longitude-mhev'],
      },
    });
  });
  it('does not use a commercial code to break a displacement tie', () => {
    const records = [
      jeepFixtureCatalog[0]!,
      { ...jeepFixtureCatalog[0]!, id: 'other-engine', version: 'Longitude 2.0 TGDI AT' },
    ];
    expect(matcher.match(scope, { ...base, engineDisplacement: null }, records)).toMatchObject({
      finding: { type: 'AMBIGUOUS' },
    });
  });
  it('eliminates ICE for MHEV and never invents a correspondence', () => {
    expect(matcher.match(scope, jeepFixtureCandidates[1]!, [jeepFixtureCatalog[0]!])).toMatchObject(
      {
        finding: { type: 'NEW_VERSION', matchedProductIds: [], matchedProducts: [] },
      },
    );
  });
  it('allows an opaque commercial label when the historical label has no comparable powertrain', () => {
    const candidate = {
      ...base,
      powertrainLabel: 'Hurricane Flex',
      officialVersionLabel: 'Longitude Hurricane Flex',
    };
    expect(matcher.match(scope, candidate, jeepFixtureCatalog)).toMatchObject({
      matched: {
        matchedProductIds: ['jeep-renegade-longitude-ice'],
        candidate: { powertrainLabel: 'Hurricane Flex' },
      },
    });
  });
  it('keeps Blackhawk Hurricane Flex as a new variant with the published name', () => {
    const c = jeepFixtureCandidates[4]!;
    expect(matcher.match(scope, c, jeepFixtureCatalog)).toMatchObject({
      finding: {
        type: 'NEW_VERSION',
        candidate: {
          officialVersionLabel: 'Blackhawk Hurricane Flex',
          powertrainLabel: 'Hurricane Flex',
          engineDisplacement: null,
        },
        matchedProductIds: [],
      },
    });
  });
  it('retains exact official mode only for full label equality', () => {
    expect(
      matcher.match(scope, base, [{ ...jeepFixtureCatalog[0]!, version: 'Longitude T270' }]),
    ).toMatchObject({
      matched: { matchMode: 'EXACT_OFFICIAL' },
    });
  });
  it('runs the same identity rules under any supplied brand without a brand-specific matcher', () => {
    const candidate = { ...base, brand: 'Synthetic manufacturer' };
    const catalog = jeepFixtureCatalog.map((p) => ({ ...p, brand: candidate.brand }));
    expect(matcher.match({ ...scope, brand: candidate.brand }, candidate, catalog)).toMatchObject({
      matched: { matchedProductIds: ['jeep-renegade-longitude-ice'], matchMode: 'LEGACY_NAMING' },
    });
  });
  it('aggregates Commander variants and preserves unresolved Compass ambiguity', async () => {
    const result = await run();
    expect(result).toMatchObject({
      researchedCandidates: 8,
      variantsResolved: 7,
      modelsDiscovered: 3,
      knownProducts: 4,
    });
    const commander = result.findings.find((f) => f.type === 'NEW_MODEL')!;
    expect(commander.candidate.model).toBe('Commander');
    expect(commander.variants.map((c) => c.officialVersionLabel)).toEqual([
      'Limited Hurricane',
      'Overland Hurricane',
    ]);
    expect(result.findings.filter((f) => f.type === 'NEW_MODEL')).toHaveLength(1);
    expect(result.findings.find((f) => f.type === 'AMBIGUOUS')).toMatchObject({
      candidate: { model: 'Compass', officialVersionLabel: null, trim: null },
      matchedProductIds: ['jeep-compass-limited', 'jeep-compass-longitude'],
    });
  });
  it('preserves read-only capability and all administrative fields', async () => {
    const products = jeepFixtureCatalog.map((p) => Object.freeze({ ...p }));
    const before = JSON.stringify(products);
    const write = vi.fn(() => {
      throw new Error('Canonical write forbidden');
    });
    const repository = {
      listOperatorMatchingProducts: vi.fn(async () => products),
      create: write,
      update: write,
      delete: write,
      rename: write,
    };
    const result = await new NewProductCheckAgent({
      research: new FixtureProductResearchProvider(),
      catalog: new AdministrativeProductCatalogReader(repository),
      reports: { write: async () => {} },
    }).run(scope, 'read-only-jeep');
    expect(result.matchedCandidates).toHaveLength(4);
    expect(repository.listOperatorMatchingProducts).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(JSON.stringify(products)).toBe(before);
  });
});

describe('reusable cross-brand fixture benchmark', () => {
  it.each([
    { brand: 'Toyota', known: 8, newModels: 3, newVersions: 2 },
    { brand: 'Jeep', known: 4, newModels: 1, newVersions: 1 },
  ])(
    '$brand reconciles 100% with zero false-new known products',
    async ({ brand, known, newModels, newVersions }) => {
      const result = await run(brand);
      const benchmark = benchmarkProductFixture(
        result,
        productCheckFixture({ country: 'BR', brand }).knownExpectations,
      );
      expect(benchmark).toEqual({
        brand,
        knownProducts: known,
        reconciledKnownProducts: known,
        falseNewProducts: 0,
        newModels,
        newVersions,
        ambiguous: 1,
        rejected: 0,
        rejectedExternalSources: 0,
        knownReconciliationRate: 1,
        falseNewRate: 0,
      });
      expect(result.matchedCandidates.every((m) => m.matchMode === 'LEGACY_NAMING')).toBe(true);
      if (brand === 'Toyota')
        expect(result.researchedCandidates).toBe(toyotaFixtureCandidates.length);
    },
  );
  it('detects an injected false NEW_VERSION even when the finding contains no matched ids', async () => {
    const result = await run();
    const broken: NewProductCheckResult = {
      ...result,
      matchedCandidates: result.matchedCandidates.slice(1),
      findings: [
        ...result.findings,
        {
          fingerprint: findingFingerprint(scope, base, 'NEW_VERSION'),
          type: 'NEW_VERSION',
          candidate: base,
          variants: [],
          warnings: [],
          matchedProductIds: [],
          matchedProducts: [],
          matchMode: null,
          reason: 'Injected regression',
        },
      ],
    };
    expect(
      benchmarkProductFixture(broken, productCheckFixture(scope).knownExpectations),
    ).toMatchObject({
      reconciledKnownProducts: 3,
      falseNewProducts: 1,
      knownReconciliationRate: 0.75,
      falseNewRate: 0.25,
    });
  });
  it('detects a false NEW_MODEL for known products even with model-level candidate projection', async () => {
    const result = await run();
    const model = result.findings.find((f) => f.type === 'NEW_MODEL')!;
    const broken = {
      ...result,
      findings: [
        ...result.findings,
        { ...model, candidate: { ...model.candidate, model: 'Renegade' } },
      ],
    };
    expect(
      benchmarkProductFixture(broken, productCheckFixture(scope).knownExpectations)
        .falseNewProducts,
    ).toBe(2);
  });
  it('requires expected correspondence, not just any matched id', async () => {
    const result = await run();
    const broken = {
      ...result,
      matchedCandidates: result.matchedCandidates.map((m, i) =>
        i === 0 ? { ...m, matchedProductIds: ['wrong-id'] } : m,
      ),
    };
    expect(
      benchmarkProductFixture(broken, productCheckFixture(scope).knownExpectations)
        .reconciledKnownProducts,
    ).toBe(3);
  });
  it('counts unique year-change reconciliation without calling it a false new product', async () => {
    const result = await run();
    const first = result.matchedCandidates[0]!;
    const changed = {
      ...result,
      matchedCandidates: result.matchedCandidates.slice(1),
      findings: [
        ...result.findings,
        {
          ...first,
          type: 'POSSIBLE_YEAR_CHANGE' as const,
          fingerprint: findingFingerprint(scope, base, 'POSSIBLE_YEAR_CHANGE'),
          variants: [],
          warnings: [],
        },
      ],
    };
    expect(
      benchmarkProductFixture(changed, productCheckFixture(scope).knownExpectations),
    ).toMatchObject({
      knownReconciliationRate: 1,
      falseNewRate: 0,
    });
  });
  it('rejects incomplete fixture ground truth', async () => {
    const result = await run();
    expect(() => benchmarkProductFixture(result, [])).toThrow(
      'INVALID_FIXTURE_BENCHMARK_EXPECTATIONS',
    );
  });
  it('uses null rates for a benchmark with no known products', async () => {
    const result = await run();
    expect(
      benchmarkProductFixture({ ...result, knownProducts: 0, matchedCandidates: [] }, []),
    ).toMatchObject({
      knownReconciliationRate: null,
      falseNewRate: null,
    });
  });
});
