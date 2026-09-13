import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdministrativeProductCatalogReader,
  FixtureProductCatalogReader,
  FixtureProductResearchProvider,
  NewProductCheckAgent,
  ProductCandidateMatcher,
  findingFingerprint,
  officialBrandSource,
  officialEvidenceUrl,
  toyotaFixtureCandidates,
  toyotaFixtureCatalog,
  type OfficialProductCandidate,
} from '../src/agents';

const scope = { country: 'BR', brand: 'Toyota' } as const;
const base = toyotaFixtureCandidates[0]!;
const candidate = (patch: Partial<OfficialProductCandidate> = {}) => ({ ...base, ...patch });
const modelOnly = (model: string) =>
  candidate({
    model,
    taxonomy: 'MODEL',
    officialVersionLabel: null,
    trim: null,
    engineDisplacement: null,
    propulsion: null,
    transmission: null,
  });
const matcher = new ProductCandidateMatcher();
const match = (patch: Partial<OfficialProductCandidate> = {}, catalog = toyotaFixtureCatalog) =>
  matcher.match(scope, candidate(patch), catalog);
async function run(candidates: readonly OfficialProductCandidate[]) {
  const write = vi.fn(async () => {});
  const result = await new NewProductCheckAgent({
    research: { researchProducts: async () => ({ candidates, metadata: { provider: 'fake' } }) },
    catalog: new FixtureProductCatalogReader(),
    reports: { write },
    now: () => new Date('2030-01-01T00:00:00Z'),
  }).run(scope, 'test-run');
  expect(write).toHaveBeenCalledOnce();
  return result;
}
beforeEach(() =>
  vi.stubGlobal('fetch', () => {
    throw new Error('Network forbidden');
  }),
);
afterEach(() => vi.unstubAllGlobals());

describe('discovery precedence and official naming', () => {
  it('classifies unknown model with unresolved version as NEW_MODEL', () => {
    expect(matcher.match(scope, modelOnly('SW4'), toyotaFixtureCatalog)).toMatchObject({
      finding: { type: 'NEW_MODEL', matchedProductIds: [] },
    });
  });
  it('keeps known model with unresolved variant ambiguous', () => {
    expect(matcher.match(scope, modelOnly('Corolla Cross'), toyotaFixtureCatalog)).toMatchObject({
      finding: {
        type: 'AMBIGUOUS',
        reason: 'Model is known, but official variant could not be resolved.',
      },
    });
  });
  it.each(['LANDING_PAGE', 'POWERTRAIN', 'UNKNOWN'] as const)(
    'does not turn %s into a new model',
    (taxonomy) => {
      expect(match({ model: 'Corolla Cross Hybrid', taxonomy })).toMatchObject({
        finding: { type: 'AMBIGUOUS' },
      });
    },
  );
  it('keeps Corolla and Corolla Cross distinct when base model is explicit', () => {
    expect(match({}, [{ ...toyotaFixtureCatalog[0]!, model: 'Corolla' }])).toMatchObject({
      finding: { type: 'NEW_MODEL' },
    });
  });
  it('classifies GR-Sport without creating an expanded official label', () => {
    const result = match({
      officialVersionLabel: 'GR-Sport',
      trim: 'GR-Sport',
      engineDisplacement: null,
      transmission: null,
      propulsion: null,
    });
    expect(result).toMatchObject({
      finding: { type: 'NEW_VERSION', candidate: { officialVersionLabel: 'GR-Sport' } },
    });
  });
  it('matches an exact official label and preserves original spelling', () => {
    expect(
      match({ officialVersionLabel: '  xR  ', trim: ' xR ' }, [
        { ...toyotaFixtureCatalog[0]!, version: 'XR' },
      ]),
    ).toMatchObject({
      matched: { matchMode: 'EXACT_OFFICIAL', candidate: { officialVersionLabel: '  xR  ' } },
    });
  });
  it('matches literal official label to legacy trim when decomposition is unavailable', () => {
    expect(match({ trim: null })).toMatchObject({
      matched: { matchMode: 'LEGACY_NAMING', matchedProductIds: ['895'] },
    });
  });
  it('can reconcile an explicit trim without manufacturing an officialVersionLabel', () => {
    expect(match({ officialVersionLabel: null })).toMatchObject({
      matched: { candidate: { officialVersionLabel: null }, matchMode: 'LEGACY_NAMING' },
    });
  });
  it.each(['POSSIBLE_PACKAGE', 'CONFLICTING_SOURCES', 'INSUFFICIENT_EVIDENCE'] as const)(
    'respects extraction warning %s',
    (warning) => {
      expect(match({ extractionWarnings: [warning] })).toMatchObject({
        finding: { type: 'AMBIGUOUS' },
      });
    },
  );
  it('keeps explicit absent model discovery independent of variant confidence', () =>
    expect(
      matcher.match(scope, { ...modelOnly('SW4'), confidence: 0.6 }, toyotaFixtureCatalog),
    ).toMatchObject({ finding: { type: 'NEW_MODEL' } }));
  it('accepts the 0.65 extraction boundary', () =>
    expect(match({ confidence: 0.65 })).toHaveProperty('matched'));
});

describe('component reconciliation, uniqueness and years', () => {
  it.each(
    toyotaFixtureCandidates
      .slice(0, 8)
      .map((c, index) => ({ c, id: toyotaFixtureCatalog[index]!.id })),
  )('reconciles $id from official structure', ({ c, id }) => {
    expect(matcher.match(scope, c, toyotaFixtureCatalog)).toMatchObject({
      matched: { matchMode: 'LEGACY_NAMING', matchedProductIds: [id] },
    });
  });
  it('matches Private and Inactive without catalog visibility filtering', () => {
    expect(toyotaFixtureCatalog[1]?.isPublic).toBe(false);
    expect(toyotaFixtureCatalog[2]?.isActive).toBe(false);
    for (const index of [1, 2])
      expect(
        matcher.match(scope, toyotaFixtureCandidates[index]!, toyotaFixtureCatalog),
      ).toHaveProperty('matched');
  });
  it('groups duplicate rows under a unique compatible MMV', () => {
    expect(
      match({}, [...toyotaFixtureCatalog, { ...toyotaFixtureCatalog[0]!, id: 'duplicate' }]),
    ).toMatchObject({ matched: { matchedProductIds: ['895', 'duplicate'] } });
  });
  it('does not use years to choose between multiple compatible products', () => {
    expect(
      match({ modelYear: 2026 }, [
        ...toyotaFixtureCatalog,
        { ...toyotaFixtureCatalog[0]!, id: 'historical', modelYear: 2025 },
      ]),
    ).toMatchObject({ matched: { matchedProductIds: ['895', 'historical'] } });
  });
  it('keeps XRX without propulsion/engine ambiguous between ICE and HEV', () => {
    expect(
      match({
        officialVersionLabel: 'XRX',
        trim: 'XRX',
        engineDisplacement: null,
        propulsion: null,
      }),
    ).toMatchObject({ finding: { type: 'AMBIGUOUS' } });
  });
  it.each([
    { propulsion: 'HEV' as const },
    { engineDisplacement: 1.8 },
    { transmission: 'MT' },
    { engineLabel: 'OTHER', drivetrain: 'AWD' },
  ])('rejects available conflicting components %j', (patch) => {
    const catalog = [{ ...toyotaFixtureCatalog[0]!, version: 'XR 2.0 TGDI CVT 4x2' }];
    expect(match(patch, catalog)).toMatchObject({
      finding: { type: 'NEW_VERSION', matchedProductIds: [], matchedProducts: [] },
    });
  });
  it('treats commercial powertrain text as metadata when hard components agree', () => {
    expect(
      match({ officialVersionLabel: 'XR T270', powertrainLabel: 'T270' }, [
        { ...toyotaFixtureCatalog[0]!, version: 'XR T200 2.0 CVT' },
      ]),
    ).toMatchObject({ matched: { matchedProductIds: ['895'] } });
  });
  it('does not let exact label override an explicit component conflict', () => {
    expect(match({ officialVersionLabel: 'XR 2.0 CVT', propulsion: 'HEV' })).toMatchObject({
      finding: { type: 'NEW_VERSION' },
    });
  });
  it('does not treat missing official or legacy fields as conflicts', () => {
    expect(
      match({
        engineDisplacement: null,
        transmission: null,
        propulsion: null,
        engineLabel: 'Published engine',
      }),
    ).toHaveProperty('matched');
  });
  it('normalizes only comparison values', () =>
    expect(
      match({
        model: ' COROLLA   CROSS ',
        officialVersionLabel: ' xr ',
        trim: ' xR ',
        transmission: 'Direct Shift CVT',
      }),
    ).toHaveProperty('matched'));
  it('keeps explicit years as observations after unique MMV reconciliation', () => {
    expect(match({ modelYear: 2027 })).toMatchObject({
      matched: {
        matchMode: 'LEGACY_NAMING',
        matchedProductIds: ['895'],
      },
    });
  });
  it('does not infer years from execution date, URL, document title or excerpt', async () => {
    const c = candidate({
      evidence: [
        {
          ...base.evidence[0]!,
          url: 'https://media.toyota.com.br/2029/document.pdf',
          title: 'Updated 2029',
          excerpt: 'Document dated 2029.',
        },
      ],
    });
    const result = await run([c]);
    expect(result.matchedCandidates[0]?.candidate).toMatchObject({
      productionYear: null,
      modelYear: null,
    });
    expect(result.findings).toHaveLength(0);
  });
  it('handles Jeep official powertrain naming with the shared registry', () => {
    const official = candidate({
      brand: 'Jeep',
      model: 'Renegade',
      officialVersionLabel: 'Longitude T270 MHEV',
      trim: 'Longitude',
      powertrainLabel: 'T270 MHEV',
      propulsion: 'MHEV',
      engineDisplacement: null,
      transmission: null,
    });
    const catalog = [
      {
        ...toyotaFixtureCatalog[0]!,
        id: 'jeep',
        brand: 'Jeep',
        model: 'Renegade',
        version: 'Longitude 1.3 TGDI AT MHEV',
      },
    ];
    expect(matcher.match({ country: 'BR', brand: 'Jeep' }, official, catalog)).toMatchObject({
      matched: {
        matchedProductIds: ['jeep'],
        matchMode: 'LEGACY_NAMING',
        candidate: { officialVersionLabel: 'Longitude T270 MHEV' },
      },
    });
    expect(officialBrandSource({ country: 'BR', brand: 'Jeep' }).brand).toBe('Jeep');
  });
  it('does not fuzzy-match close trim spelling', () => {
    expect(match({ officialVersionLabel: 'XRF', trim: 'XRF' })).toMatchObject({
      finding: { type: 'NEW_VERSION' },
    });
    expect(match({ officialVersionLabel: 'X-R', trim: 'X-R' })).toMatchObject({
      finding: { type: 'AMBIGUOUS' },
    });
  });
  it('does not ignore an unresolved second possible canonical identity', () => {
    expect(
      match({}, [
        ...toyotaFixtureCatalog,
        { ...toyotaFixtureCatalog[0]!, id: 'unresolved', version: 'XR 2.0 CVT Package' },
      ]),
    ).toMatchObject({ finding: { type: 'AMBIGUOUS' } });
  });
  it('does not reconcile malformed historical attribute tokens', () => {
    expect(match({}, [{ ...toyotaFixtureCatalog[0]!, version: 'XR 2.0 CVT AT' }])).toMatchObject({
      finding: { type: 'AMBIGUOUS' },
    });
  });
});

describe('validated evidence and structured deduplication', () => {
  it.each([
    'https://www.toyota.com.br/modelos',
    'https://media.toyota.com.br/ficha.pdf',
    'https://toyota.com.br',
  ])('accepts explicit official host %s', (url) =>
    expect(officialEvidenceUrl(url, officialBrandSource(scope))).not.toBeNull(),
  );
  it.each([
    'http://toyota.com.br',
    'https://toyota.com.br.fake-site.com',
    'https://fake-toyota.com.br',
    'https://toyota.example.com',
    'https://dealer.toyota.com.br',
    'https://www.media.toyota.com.br',
    'https://toyota.com.br@evil.test',
    'https://user:pass@toyota.com.br',
    'https://toyota.com.br:8443',
    'https://wikipedia.org/Toyota',
    'https://youtube.com/Toyota',
    'javascript:alert(1)',
    '/relative',
  ])('rejects %s', (url) =>
    expect(officialEvidenceUrl(url, officialBrandSource(scope))).toBeNull(),
  );
  it('rejects all candidates without official evidence, even new model discoveries', async () => {
    const result = await run([
      candidate({ evidence: [] }),
      { ...modelOnly('SW4'), evidence: [{ ...base.evidence[0]!, url: 'https://example.com' }] },
    ]);
    expect(result.findings).toHaveLength(0);
    expect(result.rejectedCandidates).toHaveLength(2);
    expect(result.rejectedExternalSources).toBe(1);
    expect(JSON.stringify(result)).not.toContain('example.com');
  });
  it('discards external evidence while retaining official identity', async () => {
    const result = await run([
      candidate({
        evidence: [...base.evidence, { ...base.evidence[0]!, url: 'https://example.com' }],
      }),
    ]);
    expect(result.rejectedExternalSources).toBe(1);
    expect(result.matchedCandidates).toHaveLength(1);
    expect(result.matchedCandidates[0]?.candidate.evidence).toHaveLength(1);
  });
  it('deduplicates structured identity and repeated evidence without changing the official label', async () => {
    const c = candidate({
      officialVersionLabel: '  xR  ',
      evidence: [...base.evidence, { ...base.evidence[0]!, url: base.evidence[0]!.url + '#a' }],
    });
    const result = await run([
      c,
      {
        ...c,
        officialVersionLabel: 'XR',
        model: 'COROLLA CROSS',
        engineDisplacement: null,
        transmission: null,
      },
    ]);
    expect(result.acceptedCandidates).toBe(1);
    expect(result.matchedCandidates[0]?.candidate).toMatchObject({
      officialVersionLabel: '  xR  ',
      engineDisplacement: 2,
    });
    expect(result.matchedCandidates[0]?.candidate.evidence).toHaveLength(1);
  });
  it('merges one sparse observation into a unique richer official identity', async () => {
    const result = await run([candidate({ propulsion: null, engineDisplacement: null }), base]);
    expect(result.acceptedCandidates).toBe(1);
    expect(result.matchedCandidates).toHaveLength(1);
  });
  it('never bridges distinct HEV and ICE through a sparse observation', async () => {
    const hev = { ...toyotaFixtureCandidates[2]!, officialVersionLabel: 'XRX' };
    const ice = { ...toyotaFixtureCandidates[3]!, officialVersionLabel: 'XRX' };
    const sparse = { ...hev, engineDisplacement: null, propulsion: null, transmission: null };
    const result = await run([sparse, hev, ice]);
    expect(result.acceptedCandidates).toBe(3);
    expect(result.matchedCandidates).toHaveLength(2);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.type).toBe('AMBIGUOUS');
  });
  it('retains distinct evidence excerpts at the same URL', async () => {
    const result = await run([
      base,
      candidate({ evidence: [{ ...base.evidence[0]!, excerpt: 'A second explicit fact.' }] }),
    ]);
    expect(result.matchedCandidates[0]?.candidate.evidence).toHaveLength(2);
  });
  it.each([{ engineDisplacement: 1.8 }, { transmission: 'MT' }])(
    'marks contradictory observations as ambiguous %j',
    async (patch) => {
      const result = await run([candidate({ modelYear: 2026 }), candidate(patch)]);
      expect(result.acceptedCandidates).toBe(1);
      expect(result.findings[0]?.candidate.extractionWarnings).toContain('CONFLICTING_SOURCES');
      expect(result.findings[0]?.type).toBe('AMBIGUOUS');
    },
  );
  it('fingerprint distinguishes propulsion and powertrain, but not missing engine/transmission/year', () => {
    expect(findingFingerprint(scope, base, 'NEW_VERSION')).toBe(
      findingFingerprint(
        scope,
        candidate({ engineDisplacement: null, transmission: null, modelYear: 2029 }),
        'NEW_VERSION',
      ),
    );
    expect(findingFingerprint(scope, base, 'NEW_VERSION')).not.toBe(
      findingFingerprint(scope, candidate({ propulsion: 'HEV' }), 'NEW_VERSION'),
    );
    expect(findingFingerprint(scope, base, 'NEW_VERSION')).not.toBe(
      findingFingerprint(scope, candidate({ powertrainLabel: 'T270' }), 'NEW_VERSION'),
    );
  });
  it('rejects malformed and out-of-scope candidates without retaining raw provider fields', async () => {
    const result = await run([
      candidate({ brand: 'Other' }),
      candidate({ confidence: NaN }),
      candidate({ trim: undefined as unknown as null }),
    ]);
    expect(result.rejectedCandidates).toHaveLength(3);
    const malicious = await run([
      { ...base, type: 'NEW_MODEL', reason: 'LLM decision' } as OfficialProductCandidate,
    ]);
    expect(malicious.matchedCandidates).toHaveLength(1);
    expect(JSON.stringify(malicious)).not.toContain('LLM decision');
  });
});

describe('read-only fixture application', () => {
  it('runs all eight legacy identities and discovery/resolution findings end to end', async () => {
    const result = await new NewProductCheckAgent({
      research: new FixtureProductResearchProvider(),
      catalog: new FixtureProductCatalogReader(),
      reports: { write: async () => {} },
    }).run(scope, 'fixture-test');
    expect(result).toMatchObject({
      schemaVersion: '19A.4',
      modelsDiscovered: 5,
      variantsResolved: 20,
      researchedCandidates: 21,
      acceptedCandidates: 21,
      knownProducts: 8,
      rejectedExternalSources: 0,
    });
    expect(result.matchedCandidates).toHaveLength(8);
    expect(result.matchedCandidates.every((m) => m.matchMode === 'LEGACY_NAMING')).toBe(true);
    expect(result.findings.map((f) => f.type).sort()).toEqual([
      'AMBIGUOUS',
      'NEW_MODEL',
      'NEW_MODEL',
      'NEW_MODEL',
      'NEW_VERSION',
      'NEW_VERSION',
    ]);
  });
  it('uses only the administrative read capability, preserving every canonical field', async () => {
    const products = toyotaFixtureCatalog.map((p) => Object.freeze({ ...p }));
    const before = JSON.stringify(products);
    const write = vi.fn(() => {
      throw new Error('Write forbidden');
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
    }).run(scope, 'read-only');
    expect(result.matchedCandidates).toHaveLength(8);
    expect(repository.listOperatorMatchingProducts).toHaveBeenCalledWith();
    expect(write).not.toHaveBeenCalled();
    expect(JSON.stringify(products)).toBe(before);
  });
  it('propagates operational catalog and report failures', async () => {
    const write = vi.fn(async () => {});
    await expect(
      new NewProductCheckAgent({
        research: new FixtureProductResearchProvider(),
        catalog: {
          readProducts: async () => {
            throw new Error('catalog unavailable');
          },
        },
        reports: { write },
      }).run(scope, 'failure'),
    ).rejects.toThrow('catalog unavailable');
    expect(write).not.toHaveBeenCalled();
    await expect(
      new NewProductCheckAgent({
        research: new FixtureProductResearchProvider(),
        catalog: new FixtureProductCatalogReader(),
        reports: {
          write: async () => {
            throw new Error('disk unavailable');
          },
        },
      }).run(scope, 'failure'),
    ).rejects.toThrow('disk unavailable');
  });
});
