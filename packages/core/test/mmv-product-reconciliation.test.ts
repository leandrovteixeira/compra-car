import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  projectCatalogMmvIdentities,
  catalogMmvIdentityId,
  compatibleEngineDisplacement,
  ProductCandidateMatcher,
  NewProductCheckAgent,
  benchmarkProductFixture,
  jeepCapturedMmvCandidates,
  jeepCapturedMmvCatalog,
  jeepCapturedMmvExpectations,
  toyotaFixtureCandidates,
  toyotaFixtureCatalog,
  parseLegacyProductVersion,
  normalizeTransmissionFamily,
} from '../src/agents';

const scope = { country: 'BR', brand: 'Jeep' } as const;
const matcher = new ProductCandidateMatcher();
beforeEach(() =>
  vi.stubGlobal('fetch', () => {
    throw new Error('Network forbidden');
  }),
);
afterEach(() => vi.unstubAllGlobals());
const run = (candidates = jeepCapturedMmvCandidates, catalog = jeepCapturedMmvCatalog) =>
  new NewProductCheckAgent({
    research: {
      researchProducts: async () => ({
        candidates,
        metadata: { provider: 'fixture-captured-offline', webSearchCount: 0 },
      }),
    },
    catalog: { readProducts: async () => catalog },
    reports: { write: async () => {} },
  }).run(scope, 'captured-mmv');

describe('catalog MMV projection', () => {
  it('groups PY/MY occurrences while preserving ids, original labels and visibility', () => {
    const rows = jeepCapturedMmvCatalog.filter((p) =>
      ['960', '996', '1064', '1128'].includes(p.id),
    );
    expect(rows).toHaveLength(4);
    const projected = projectCatalogMmvIdentities(rows);
    expect(projected).toHaveLength(1);
    expect(projected[0]?.canonicalVersionLabel).toBe('Longitude 1.3 TGDI AT');
    expect(projected[0]?.productRows).toEqual(rows);
    expect(projected[0]?.parsedLegacyComponents).not.toHaveProperty('product');
    expect(new Set(rows.map(catalogMmvIdentityId)).size).toBe(1);
    expect(projectCatalogMmvIdentities([...rows].reverse())).toEqual(projected);
  });
  it('groups casing/whitespace but never merges different canonical version labels', () => {
    const base = toyotaFixtureCatalog[0]!;
    const result = projectCatalogMmvIdentities([
      base,
      {
        ...base,
        id: 'case',
        brand: ' TOYOTA ',
        model: ' Corolla   Cross ',
        version: ' XR   2.0 cvt ',
        isActive: false,
      },
      { ...base, id: 'literal-ice', version: 'XR 2.0 ICE CVT' },
      { ...base, id: 'brand', brand: 'Synthetic' },
      { ...base, id: 'model', model: 'Corolla' },
    ]);
    expect(result).toHaveLength(4);
    expect(result[0]?.productRows).toHaveLength(2);
    expect(result[0]?.productRows.some((p) => !p.isActive)).toBe(true);
  });
  it('matches one MMV with all four historical rows even when official years differ', () => {
    const c = { ...jeepCapturedMmvCandidates[8]!, productionYear: 2030, modelYear: 2031 };
    const result = matcher.match(scope, c, jeepCapturedMmvCatalog);
    expect(result).toMatchObject({
      matched: {
        matchMode: 'LEGACY_NAMING',
        matchedProductIds: ['1064', '1128', '960', '996'],
        candidate: { productionYear: 2030, modelYear: 2031 },
      },
    });
    if (!('matched' in result)) throw new Error('Expected MMV match');
    expect(result.matched.matchedMmvIdentities).toHaveLength(1);
    expect(result.matched.matchedMmvIdentities[0]?.productRows).toHaveLength(4);
  });
  it('keeps distinct canonical identities ambiguous, independent of their row counts', () => {
    const c = {
      ...toyotaFixtureCandidates[2]!,
      officialVersionLabel: 'XRX',
      trim: 'XRX',
      propulsion: null,
      engineDisplacement: null,
      transmission: null,
    };
    const rows = [
      ...toyotaFixtureCatalog,
      { ...toyotaFixtureCatalog[2]!, id: 'historical', modelYear: 2020 },
    ];
    const result = matcher.match({ country: 'BR', brand: 'Toyota' }, c, rows);
    expect(result).toMatchObject({
      finding: { type: 'AMBIGUOUS', matchedProductIds: ['615', '897', 'historical'] },
    });
    if (!('finding' in result)) throw new Error('Expected ambiguous MMVs');
    expect(result.finding.matchedMmvIdentities).toHaveLength(2);
  });
});

describe('precision-aware hard components and soft labels', () => {
  it.each([
    [1.332, 1.3],
    [1.995, 2.0],
    [2.184, 2.2],
    [1.3, 1.332],
    [1.332, 1.33],
  ])('compares %s and %s at common precision', (a, b) =>
    expect(compatibleEngineDisplacement(a, b)).toBe(true),
  );
  it.each([
    [1.8, 2.0],
    [1.3, 1.5],
    [1.332, 1.334],
    [1.35, 1.3],
    [1.995, 1.994],
  ])('rejects incompatible %s and %s without an epsilon', (a, b) =>
    expect(compatibleEngineDisplacement(a, b)).toBe(false),
  );
  it('respects explicitly declared canonical precision including trailing zeros', () => {
    const parsed = parseLegacyProductVersion({
      ...toyotaFixtureCatalog[0]!,
      version: 'XR 1.30 CVT',
    });
    expect(parsed.engineDisplacementPrecision).toBe(2);
    expect(
      compatibleEngineDisplacement(
        1.332,
        parsed.engineDisplacement,
        parsed.engineDisplacementPrecision,
      ),
    ).toBe(false);
  });
  it('preserves engineLabel and commercial powertrain without using them as hard constraints', () => {
    const c = {
      ...jeepCapturedMmvCandidates[1]!,
      engineLabel: 'Different engine wording',
      powertrainLabel: 'Commercial family',
    };
    expect(matcher.match(scope, c, jeepCapturedMmvCatalog)).toMatchObject({
      matched: {
        candidate: {
          engineLabel: 'Different engine wording',
          powertrainLabel: 'Commercial family',
        },
      },
    });
  });
  it('keeps MHEV incompatible with explicit ICE', () => {
    const c = { ...jeepCapturedMmvCandidates[0]!, propulsion: 'MHEV' as const };
    expect(matcher.match(scope, c, jeepCapturedMmvCatalog)).toMatchObject({
      finding: { type: 'NEW_VERSION', matchedProductIds: [] },
    });
  });
  it('keeps explicit 4x4 and 4x2 incompatible but treats absent drivetrain as unknown', () => {
    const c = jeepCapturedMmvCandidates[0]!,
      row = jeepCapturedMmvCatalog[0]!;
    expect(matcher.match(scope, c, [row])).toHaveProperty('matched');
    expect(
      matcher.match(scope, { ...c, drivetrain: '4x4' }, [
        { ...row, version: row.version + ' 4x2' },
      ]),
    ).toMatchObject({
      finding: { type: 'NEW_VERSION', matchedProductIds: [] },
    });
  });
  it.each(['Automático de 6 marchas', 'Automático de 9 marchas', 'Automática de 6 velocidades'])(
    'recognizes AT from %s without changing raw label',
    (transmission) => {
      expect(normalizeTransmissionFamily(transmission)).toBe('AT');
      expect(
        matcher.match(
          scope,
          { ...jeepCapturedMmvCandidates[0]!, transmission },
          jeepCapturedMmvCatalog,
        ),
      ).toMatchObject({ matched: { candidate: { transmission } } });
    },
  );
  it('does not invent a powertrain suffix equivalence from arbitrary extra trim words', () => {
    const c = jeepCapturedMmvCandidates[12]!;
    const rows = [
      { ...jeepCapturedMmvCatalog.at(-1)!, version: 'Blackhawk Unknown 2.0 TGDI AT 4x4' },
    ];
    expect(matcher.match(scope, c, rows)).toMatchObject({ finding: { type: 'AMBIGUOUS' } });
  });
});

describe('captured Jeep offline regression', () => {
  it('preserves individual year observations without inventing a combined PY/MY pair', async () => {
    const c = jeepCapturedMmvCandidates[8]!;
    const result = await run([
      { ...c, productionYear: 2025, modelYear: null },
      { ...c, productionYear: null, modelYear: 2027 },
    ]);
    expect(result.matchedCandidates[0]?.candidate).toMatchObject({
      productionYear: 2025,
      modelYear: null,
      yearObservations: [
        { productionYear: 2025, modelYear: null },
        { productionYear: null, modelYear: 2027 },
      ],
    });
  });

  it.each(
    jeepCapturedMmvExpectations.map((e) => ({
      label: e.candidate.officialVersionLabel,
      expected: e,
    })),
  )('$label reconciles to the expected MMV', ({ expected }) => {
    const result = matcher.match(scope, expected.candidate, jeepCapturedMmvCatalog);
    expect(result).toHaveProperty('matched');
    if (!('matched' in result)) throw new Error('Expected captured MMV match');
    expect(result.matched.matchMode).toBe('LEGACY_NAMING');
    expect(result.matched.matchedMmvIdentities.map((m) => m.id)).toEqual([expected.mmvIdentityId]);
    expect(result.matched.candidate).toEqual(expected.candidate);
  });
  it('reconciles thirteen known candidates, aggregates five absent-model variants and uses an MMV denominator', async () => {
    const result = await run();
    expect(result).toMatchObject({
      canonicalProductRows: 16,
      knownMmvIdentities: 13,
      researchedCandidates: 18,
      schemaVersion: '19A.4',
    });
    expect(result.matchedCandidates).toHaveLength(13);
    expect(result.findings.map((f) => f.type)).toEqual(['NEW_MODEL', 'NEW_MODEL', 'NEW_MODEL']);
    expect(result.findings.reduce((sum, f) => sum + f.variants.length, 0)).toBe(5);
    expect(benchmarkProductFixture(result, jeepCapturedMmvExpectations)).toMatchObject({
      canonicalProductRows: 16,
      knownMmvIdentities: 13,
      officialCandidates: 18,
      matchedMmvCandidates: 13,
      reconciledKnownMmvIdentities: 13,
      falseNewMmv: 0,
      knownReconciliationRate: 1,
      newModels: 3,
      newVersions: 0,
      ambiguous: 0,
    });
  });
  it('does not emit year-change findings or turn repeated year observations into identity conflicts', async () => {
    const c = jeepCapturedMmvCandidates[8]!;
    const result = await run([
      { ...c, productionYear: 2025, modelYear: 2026 },
      { ...c, productionYear: 2026, modelYear: 2027 },
    ]);
    expect(result.matchedCandidates).toHaveLength(1);
    expect(result.findings).toHaveLength(0);
    expect(result.matchedCandidates[0]?.candidate.yearObservations).toEqual([
      { productionYear: 2025, modelYear: 2026 },
      { productionYear: 2026, modelYear: 2027 },
    ]);
    expect(result.matchedCandidates[0]?.candidate.extractionWarnings).not.toContain(
      'CONFLICTING_SOURCES',
    );
  });
  it('keeps different engine wording and representation precision out of dedup identity conflicts', async () => {
    const c = jeepCapturedMmvCandidates[0]!;
    const result = await run([
      c,
      { ...c, engineLabel: 'Another official description', engineDisplacement: 1.3 },
    ]);
    expect(result.matchedCandidates).toHaveLength(1);
    expect(result.findings).toHaveLength(0);
    expect(result.matchedCandidates[0]?.candidate.engineLabel).toBe(c.engineLabel);
  });
  it('does not mutate any frozen product occurrence or official fact', async () => {
    const candidates = jeepCapturedMmvCandidates.map((c) => Object.freeze({ ...c }));
    const rows = jeepCapturedMmvCatalog.map((p) => Object.freeze({ ...p }));
    const before = JSON.stringify({ candidates, rows });
    await run(candidates, rows);
    expect(JSON.stringify({ candidates, rows })).toBe(before);
  });
});
