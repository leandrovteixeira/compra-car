import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NewProductCheckAgent,
  ProductCandidateMatcher,
  findingFingerprint,
  normalizeTransmissionFamily,
  normalizeEngineDisplacement,
  normalizePropulsionFamily,
  normalizePowertrainComponents,
  toyotaFixtureCandidates,
  toyotaFixtureCatalog,
  type OfficialProductCandidate,
} from '../src/agents';

const scope = { country: 'BR', brand: 'Toyota' } as const;
const base = toyotaFixtureCandidates[0]!;
const candidate = (patch: Partial<OfficialProductCandidate> = {}): OfficialProductCandidate => ({
  ...base,
  ...patch,
});
const matcher = new ProductCandidateMatcher();
async function run(candidates: readonly OfficialProductCandidate[]) {
  return new NewProductCheckAgent({
    research: {
      researchProducts: async () => ({
        candidates,
        metadata: { provider: 'fixture', webSearchCount: 0 },
      }),
    },
    catalog: { readProducts: async () => toyotaFixtureCatalog },
    reports: { write: async () => {} },
  }).run(scope, 'deterministic-regression');
}
beforeEach(() =>
  vi.stubGlobal('fetch', () => {
    throw new Error('Network forbidden');
  }),
);
afterEach(() => vi.unstubAllGlobals());

describe('component families preserve raw labels', () => {
  it.each([
    'CVT',
    'Direct Shift CVT',
    'Direct Shift (CVT)',
    'CVT Multidrive',
    'CVT Multidrive sequencial',
    'Automática CVT',
  ])('normalizes %s to CVT and reconciles', (transmission) => {
    expect(normalizeTransmissionFamily(transmission)).toBe('CVT');
    expect(matcher.match(scope, candidate({ transmission }), toyotaFixtureCatalog)).toMatchObject({
      matched: { matchedProductIds: ['895'], candidate: { transmission } },
    });
  });
  it.each([
    'AT',
    'Automática',
    'Automática de 6 velocidades',
    'Automática de 6 velocidades sequencial',
  ])('normalizes %s to AT and narrows', (transmission) => {
    expect(normalizeTransmissionFamily(transmission)).toBe('AT');
    expect(
      matcher.match(scope, candidate({ transmission }), [
        ...toyotaFixtureCatalog,
        { ...toyotaFixtureCatalog[0]!, id: 'at', version: 'XR 2.0 AT' },
      ]),
    ).toMatchObject({ matched: { matchedProductIds: ['at'], candidate: { transmission } } });
  });
  it.each(['MT', 'Manual', 'Manual de 6 velocidades'])(
    'normalizes %s to MT and narrows',
    (transmission) => {
      expect(normalizeTransmissionFamily(transmission)).toBe('MT');
      expect(
        matcher.match(scope, candidate({ transmission }), [
          ...toyotaFixtureCatalog,
          { ...toyotaFixtureCatalog[0]!, id: 'mt', version: 'XR 2.0 MT' },
        ]),
      ).toMatchObject({ matched: { matchedProductIds: ['mt'] } });
    },
  );
  it('keeps DHT separate from CVT', () => {
    expect(normalizeTransmissionFamily('DHT')).toBe('DHT');
    expect(
      matcher.match(scope, candidate({ transmission: 'DHT' }), toyotaFixtureCatalog),
    ).toMatchObject({
      finding: { type: 'NEW_VERSION', matchedProductIds: [] },
    });
  });
  it.each(['Hybrid Transaxle', 'Hybrid Transaxle (CVT)'])(
    'uses %s only as HEV legacy compatibility',
    (transmission) => {
      expect(normalizeTransmissionFamily(transmission, 'HEV')).toBe('CVT');
      for (const propulsion of [null, 'ICE', 'MHEV', 'PHEV', 'BEV'] as const)
        expect(normalizeTransmissionFamily(transmission, propulsion)).toBeNull();
      expect(
        matcher.match(
          scope,
          { ...toyotaFixtureCandidates[2]!, transmission },
          toyotaFixtureCatalog,
        ),
      ).toMatchObject({
        matched: { matchedProductIds: ['615'], candidate: { transmission } },
      });
    },
  );
  it.each(['CVT AT', 'MT / CVT', 'unknown gearbox', 'CVTransmission'])(
    'does not guess a family for %s',
    (label) => {
      expect(normalizeTransmissionFamily(label)).toBeNull();
    },
  );
  it.each(['2.0L', '2 L', '2.0', '2,0 L'])(
    'compares explicit displacement %s numerically',
    (powertrainLabel) => {
      expect(normalizeEngineDisplacement(powertrainLabel)).toBe(2);
      expect(
        matcher.match(
          scope,
          candidate({ engineDisplacement: null, powertrainLabel }),
          toyotaFixtureCatalog,
        ),
      ).toMatchObject({
        matched: {
          matchedProductIds: ['895'],
          candidate: { powertrainLabel, engineDisplacement: null },
        },
      });
    },
  );
  it.each(['1.8L', '1.8 L'])('never treats %s as 2.0', (powertrainLabel) => {
    expect(normalizeEngineDisplacement(powertrainLabel)).toBe(1.8);
    expect(
      matcher.match(
        scope,
        candidate({ engineDisplacement: null, powertrainLabel }),
        toyotaFixtureCatalog,
      ),
    ).toMatchObject({
      finding: { type: 'NEW_VERSION', matchedProductIds: [] },
    });
  });
  it.each(['Hybrid', 'Híbrido'])(
    'normalizes propulsion alias %s without rewriting it',
    (powertrainLabel) => {
      expect(normalizePropulsionFamily(powertrainLabel)).toBe('HEV');
      expect(
        matcher.match(
          scope,
          {
            ...toyotaFixtureCandidates[6]!,
            propulsion: null,
            powertrainLabel,
          },
          toyotaFixtureCatalog,
        ),
      ).toMatchObject({
        matched: { matchedProductIds: ['1018'], candidate: { powertrainLabel, propulsion: null } },
      });
    },
  );
  it.each(['ICE', 'MHEV', 'HEV', 'PHEV', 'BEV'] as const)(
    'keeps explicit propulsion family %s',
    (family) => {
      expect(normalizePropulsionFamily(family)).toBe(family);
    },
  );
  it.each(['Electric', 'EV', 'Elétrico'])('requires pure-electric context for %s', (label) => {
    expect(normalizePropulsionFamily(label)).toBeNull();
    expect(normalizePropulsionFamily(label, true)).toBe('BEV');
  });
  it('normalizes explicit combined powertrain but never maps marketing codes to displacement', () => {
    expect(normalizePowertrainComponents('1.8 L Híbrido')).toMatchObject({
      displacement: 1.8,
      propulsion: 'HEV',
    });
    expect(normalizePowertrainComponents('T270 MHEV')).toEqual({
      displacement: null,
      propulsion: 'MHEV',
      code: 'T270',
    });
  });
  it('keeps contradictions between official structured facts ambiguous', () => {
    expect(
      matcher.match(scope, candidate({ powertrainLabel: '1.8 L' }), toyotaFixtureCatalog),
    ).toMatchObject({
      finding: { type: 'AMBIGUOUS' },
    });
  });
  it('deduplicates compatible raw transmission and powertrain forms without source conflicts', async () => {
    const c = { ...toyotaFixtureCandidates[2]!, powertrainLabel: 'Hybrid' };
    const result = await run([c, { ...c, powertrainLabel: 'Híbrido', transmission: 'CVT' }]);
    expect(result.acceptedCandidates).toBe(1);
    expect(result.matchedCandidates[0]?.candidate).toMatchObject({
      powertrainLabel: 'Hybrid',
      transmission: 'Hybrid Transaxle (CVT)',
      extractionWarnings: [],
    });
  });
});

describe('surviving canonical correspondences', () => {
  it.each([
    ['ICE', ['1015', '1016']],
    ['HEV', ['1017', '1018']],
  ] as const)(
    '%s eliminates incompatible propulsion even when trims remain unresolved',
    (propulsion, ids) => {
      const c = candidate({
        model: 'Yaris Cross',
        taxonomy: 'MODEL',
        trim: null,
        officialVersionLabel: null,
        engineDisplacement: 1.5,
        propulsion,
      });
      const result = matcher.match(scope, c, toyotaFixtureCatalog);
      expect(result).toMatchObject({ finding: { type: 'AMBIGUOUS', matchedProductIds: ids } });
      if (!('finding' in result)) throw new Error('Expected finding');
      expect(result.finding.matchedProducts.map((p) => p.id).sort()).toEqual(ids);
    },
  );
  it('missing official components do not eliminate ICE or HEV', () => {
    const result = matcher.match(
      scope,
      candidate({
        officialVersionLabel: 'XRX',
        trim: 'XRX',
        propulsion: null,
        engineDisplacement: null,
        transmission: null,
      }),
      toyotaFixtureCatalog,
    );
    expect(result).toMatchObject({
      finding: { type: 'AMBIGUOUS', matchedProductIds: ['615', '897'] },
    });
  });
  it('drivetrain breaks a real tie without choosing by order', () => {
    const records = [
      { ...toyotaFixtureCatalog[0]!, id: 'fwd', version: 'XR 2.0 CVT FWD' },
      { ...toyotaFixtureCatalog[0]!, id: 'awd', version: 'XR 2.0 CVT AWD' },
    ];
    for (const catalog of [records, [...records].reverse()])
      expect(matcher.match(scope, candidate({ drivetrain: 'AWD' }), catalog)).toMatchObject({
        matched: { matchedProductIds: ['awd'] },
      });
  });
  it('does not collapse MHEV and PHEV into HEV', () => {
    for (const propulsion of ['MHEV', 'PHEV'] as const)
      expect(
        matcher.match(
          scope,
          { ...toyotaFixtureCandidates[6]!, propulsion, transmission: 'CVT' },
          toyotaFixtureCatalog,
        ),
      ).toMatchObject({
        finding: { type: 'NEW_VERSION', matchedProductIds: [] },
      });
  });
  it('keeps an actual possible alias to an existing canonical product unresolved', () => {
    const grs = toyotaFixtureCandidates.find((c) => c.officialVersionLabel === 'GRS')!;
    expect(
      matcher.match(scope, grs, [
        ...toyotaFixtureCatalog,
        {
          ...toyotaFixtureCatalog[0]!,
          id: 'grsport',
          version: 'GR-Sport 2.0 CVT',
        },
      ]),
    ).toMatchObject({
      finding: { type: 'AMBIGUOUS', matchedProductIds: ['grsport'], warnings: ['POSSIBLE_ALIAS'] },
    });
  });
  it.each(['GRS', 'GRS Dualtone'])('%s remains a new variant with its review warning', (label) => {
    const c = toyotaFixtureCandidates.find((c) => c.officialVersionLabel === label)!;
    expect(matcher.match(scope, c, toyotaFixtureCatalog)).toMatchObject({
      finding: {
        type: 'NEW_VERSION',
        matchedProductIds: [],
        warnings: c.extractionWarnings,
        candidate: { officialVersionLabel: label },
      },
    });
  });
  it('does not mistake a potential package on an existing trim for a confirmed match', () => {
    const c = toyotaFixtureCandidates.find((c) => c.officialVersionLabel === 'GRS Dualtone')!;
    expect(
      matcher.match(scope, c, [
        ...toyotaFixtureCatalog,
        {
          ...toyotaFixtureCatalog[0]!,
          id: 'grs',
          version: 'GRS 2.0 CVT',
        },
      ]),
    ).toMatchObject({ finding: { type: 'AMBIGUOUS', matchedProductIds: ['grs'] } });
  });
  it('does not block a uniquely resolved alias warning', () => {
    expect(
      matcher.match(
        scope,
        candidate({ extractionWarnings: ['POSSIBLE_ALIAS'] }),
        toyotaFixtureCatalog,
      ),
    ).toMatchObject({
      matched: {
        matchedProductIds: ['895'],
        candidate: { extractionWarnings: ['POSSIBLE_ALIAS'] },
      },
    });
  });
});

describe('model-level finding aggregation', () => {
  const corolla = toyotaFixtureCandidates.filter((c) => c.model === 'Corolla');
  it('aggregates five variants into one model finding, retaining labels, warnings and evidence', async () => {
    const result = await run(corolla);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0]!;
    expect(finding).toMatchObject({
      type: 'NEW_MODEL',
      candidate: { model: 'Corolla', taxonomy: 'MODEL', officialVersionLabel: null, trim: null },
      warnings: ['POSSIBLE_ALIAS'],
      matchedProductIds: [],
    });
    expect(finding.variants.map((c) => c.officialVersionLabel)).toEqual(
      corolla.map((c) => c.officialVersionLabel),
    );
    expect(finding.variants.find((c) => c.trim === 'GR-S')?.extractionWarnings).toContain(
      'POSSIBLE_ALIAS',
    );
  });
  it('retains maximum relevant model confidence, all valid evidence and deduplicated variants', async () => {
    const c = corolla[0]!;
    const result = await run([
      { ...c, confidence: 0.7 },
      {
        ...c,
        brand: ' TOYOTA ',
        model: ' COROLLA ',
        confidence: 0.98,
        evidence: [
          ...c.evidence,
          { ...c.evidence[0]!, url: 'https://media.toyota.com.br/other.pdf' },
          { ...c.evidence[0]!, url: 'https://evil.test' },
        ],
      },
      {
        ...c,
        taxonomy: 'UNKNOWN',
        officialVersionLabel: 'Unresolved observation',
        confidence: 1,
        extractionWarnings: ['INSUFFICIENT_EVIDENCE'],
      },
    ]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.candidate.confidence).toBe(0.98);
    expect(result.findings[0]?.candidate.evidence).toHaveLength(2);
    expect(result.findings[0]?.variants).toHaveLength(2);
    expect(result.findings[0]?.warnings).toContain('INSUFFICIENT_EVIDENCE');
    expect(result.rejectedExternalSources).toBe(1);
    expect(JSON.stringify(result)).not.toContain('evil.test');
  });
  it.each([
    'POSSIBLE_ALIAS',
    'POSSIBLE_PACKAGE',
    'CONFLICTING_SOURCES',
    'INSUFFICIENT_EVIDENCE',
  ] as const)('keeps %s on a variant without demoting an absent model', async (warning) => {
    const result = await run([{ ...corolla[0]!, extractionWarnings: [warning], confidence: 0.5 }]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ type: 'NEW_MODEL', warnings: [warning] });
    expect(result.findings[0]?.variants[0]?.extractionWarnings).toContain(warning);
  });
  it('keeps unresolved variants attached and model-only evidence out of the variant list', async () => {
    const c = candidate({ model: 'SW4', officialVersionLabel: null, trim: null, confidence: 0.8 });
    const result = await run([c, { ...c, taxonomy: 'MODEL', confidence: 0.99 }]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.type).toBe('NEW_MODEL');
    expect(result.findings[0]?.candidate.confidence).toBe(0.99);
    expect(result.findings[0]?.variants).toHaveLength(1);
    expect(result.findings[0]?.variants[0]?.officialVersionLabel).toBeNull();
  });
  it('preserves distinct provider model identities for Hilux and Hiace', async () => {
    const models = ['Hilux Cabine Dupla', 'Hilux Cabine Simples', 'Hiace', 'Hiace Furgão'];
    const result = await run(models.map((model) => candidate({ model })));
    expect(result.findings).toHaveLength(4);
    expect(result.findings.map((f) => f.candidate.model)).toEqual(models);
    expect(new Set(result.findings.map((f) => f.fingerprint)).size).toBe(4);
  });
  it('aggregates SW4 and RAV4 independently despite variant aliases', async () => {
    const result = await run(
      toyotaFixtureCandidates.filter((c) => c.model === 'SW4' || c.model === 'RAV4'),
    );
    expect(result.findings.map((f) => [f.type, f.candidate.model, f.variants.length])).toEqual([
      ['NEW_MODEL', 'SW4', 3],
      ['NEW_MODEL', 'RAV4', 2],
    ]);
  });
  it('uses model-level fingerprints independent of variant and variant-level NEW_VERSION fingerprints', () => {
    const a = corolla[0]!,
      b = corolla[1]!;
    expect(findingFingerprint(scope, a, 'NEW_MODEL')).toBe(
      findingFingerprint(scope, b, 'NEW_MODEL'),
    );
    expect(findingFingerprint(scope, a, 'NEW_VERSION')).not.toBe(
      findingFingerprint(scope, b, 'NEW_VERSION'),
    );
    expect(findingFingerprint(scope, a, 'NEW_MODEL')).toBe(
      findingFingerprint(
        { ...scope, brand: ' TOYOTA ' },
        { ...b, model: ' COROLLA ' },
        'NEW_MODEL',
      ),
    );
  });
  it('keeps two new versions separate with distinct fingerprints', async () => {
    const result = await run(
      toyotaFixtureCandidates.filter((c) => c.officialVersionLabel?.startsWith('GRS')),
    );
    expect(result.findings.map((f) => f.type)).toEqual(['NEW_VERSION', 'NEW_VERSION']);
    expect(new Set(result.findings.map((f) => f.fingerprint)).size).toBe(2);
    expect(result.findings.every((f) => f.variants.length === 0)).toBe(true);
  });
});
