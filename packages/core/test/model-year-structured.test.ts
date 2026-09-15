import { describe, it, expect, vi } from 'vitest';
import {
  groupModelYearTargets,
  matchStructuredRows,
  structuredVersionMatches,
  StructuredFirstModelYearResearch,
  ModelYearAgent,
  modelYearFixture,
  mapModelYearRunToPlatform,
  MODEL_YEAR_SOURCE_TIERS,
  reconcileModelYears,
  type StructuredModelYearRow,
  type ModelYearResearchProvider,
} from '../src/agents';
import { coverageTarget, coverageObservation } from './fixtures/model-year-coverage';
const target = {
  ...coverageTarget(),
  structuredIdentity: {
    ...coverageTarget().structuredIdentity,
    trim: 'Highline',
    powertrainLabel: '200 TSI',
    engineDisplacement: 1.0,
    transmission: 'Automático',
  },
};
const row: StructuredModelYearRow = {
  brand: 'VW',
  model: 'Nivus',
  modelYear: 2027,
  versionLabel: '1.0 200 TSI Total Flex Highline Automático',
  fipeCode: '005526-3',
  sourceKind: 'WEBMOTORS_FIPE',
  sourceUrl: 'https://www.webmotors.com.br/tabela-fipe/carros/volkswagen/nivus/2027',
};
const source = {
  brand: 'VW',
  country: 'BR' as const,
  allowedDomains: ['vw.com.br'],
  allowedHosts: ['www.vw.com.br'],
  allowedSubdomainRoots: [],
  searchHints: [],
};
const g = groupModelYearTargets([target])[0]!;
const provider = (rows: readonly StructuredModelYearRow[] = []) => ({
  discover: vi.fn(async () => ({
    rows,
    issues: [],
    metrics: {
      structuredModelFetches: 1,
      structuredYearFetches: 1,
      structuredRowsParsed: rows.length,
    },
  })),
});
const official: ModelYearResearchProvider = {
  async researchModelYears(ts) {
    return ts.map((t) => coverageObservation(t, 2027, 'Nivus linha 2027. Versões Highline.'));
  },
};
describe('generic structured identity bridge', () => {
  it('token order independent trim and powertrain', () =>
    expect(
      structuredVersionMatches(
        { ...row, versionLabel: 'HIGHLINE TOTAL FLEX TSI 200 1.0 AUTOMÁTICO' },
        target,
      ),
    ).toBe(true));
  it.each([
    '1.0 Comfortline 200 TSI Automático',
    'Highline 250 TSI 1.0 Automático',
    'Highline 200 TSI 1.4 Automático',
    'Highline 200 TSI 1.0 Manual',
    'Higline 200 TSI 1.0 Automático',
  ])('rejects wrong structured components %s', (versionLabel) =>
    expect(structuredVersionMatches({ ...row, versionLabel }, target)).toBe(false),
  );
  it('model must match', () =>
    expect(structuredVersionMatches({ ...row, model: 'Tera' }, target)).toBe(false));
  it('unknown/missing trim never fuzzy matched', () =>
    expect(
      structuredVersionMatches(row, {
        ...target,
        structuredIdentity: { ...target.structuredIdentity, trim: null },
      }),
    ).toBe(false));
  it('ambiguous targets produce only rejected candidates', () => {
    const r = matchStructuredRows(
      { ...g, targets: [target, { ...target, targetKey: 'other', mmvIdentity: 'other' }] },
      [row],
    );
    expect(r.observations).toEqual([]);
    expect(r.rejections[0]?.reasonCode).toBe('STRUCTURED_VERSION_AMBIGUOUS');
  });
  it('two incompatible source versions for a target are ambiguous', () => {
    const t = {
        ...target,
        structuredIdentity: { ...target.structuredIdentity, engineDisplacement: null },
      },
      g = groupModelYearTargets([t])[0]!;
    const r = matchStructuredRows(g, [
      row,
      { ...row, versionLabel: row.versionLabel.replace('1.0', '1.4') },
    ]);
    expect(r.observations).toEqual([]);
    expect(r.rejections.every((r) => r.reasonCode === 'STRUCTURED_VERSION_AMBIGUOUS')).toBe(true);
  });
  it('invalid optional FIPE does not discard MY', () => {
    const r = matchStructuredRows(g, [{ ...row, fipeCode: '0055263' }]);
    expect(r.observations).toHaveLength(1);
    expect(r.observations[0]?.fipeCodeCandidates).toEqual([]);
    expect(r.rejections[0]?.reasonCode).toBe('FIPE_CODE_INVALID');
  });
  it('only FIPE whitespace is normalized', () =>
    expect(
      matchStructuredRows(g, [{ ...row, fipeCode: ' 005526-3 ' }]).observations[0]
        ?.fipeCodeCandidates?.[0]?.code,
    ).toBe('005526-3'));
  it('invalid source kind/URL/year cannot acquire structured trust', () => {
    for (const patch of [
      { sourceKind: 'FIPE_OFFICIAL' as const },
      { sourceUrl: 'https://evil.example/2027' },
      { modelYear: 2026 },
    ])
      expect(matchStructuredRows(g, [{ ...row, ...patch }]).observations).toHaveLength(0);
  });
  it.each(['Toyota', 'Jeep'])('same generic matching for %s', (brand) => {
    const t = {
        ...target,
        officialIdentity: { brand, model: 'Modelo X', officialVersionLabel: 'Limited 200 Turbo' },
        structuredIdentity: {
          ...target.structuredIdentity,
          trim: 'Limited',
          powertrainLabel: '200 Turbo',
        },
      },
      r = { ...row, brand, model: 'Modelo X', versionLabel: '1.0 Limited Turbo 200 Automático' };
    expect(matchStructuredRows(groupModelYearTargets([t])[0]!, [r]).matched).toBe(1);
  });
  it('grouping scales by model, not MMV', () =>
    expect(
      groupModelYearTargets([
        target,
        { ...target, targetKey: '2' },
        { ...target, officialIdentity: { ...target.officialIdentity, model: 'Taos' } },
      ]),
    ).toHaveLength(2));
  it('known and new MY reconcile independently with same FIPE code', () => {
    const rows = [
      row,
      { ...row, modelYear: 2026, sourceUrl: row.sourceUrl.replace('2027', '2026') },
    ];
    const r = matchStructuredRows(g, rows);
    const b = mapModelYearRunToPlatform({
      runId: 'run',
      startedAt: 'now',
      completedAt: 'now',
      scope: { brand: 'VW', country: 'BR' },
      provider: 'structured',
      targets: [target],
      source,
      discoveryRunId: null,
      skippedUnresolved: 0,
      observations: r.observations,
    });
    expect(b.findings.map((f) => f.finding.findingType).sort()).toEqual([
      'MODEL_YEAR_MATCHED',
      'NEW_MODEL_YEAR',
    ]);
    expect(b.run.summary.fipeCodeCandidates).toBe(2);
    expect(b.findings.find((f) => f.finding.requiresReview)?.finding.proposal).toEqual({
      mmvIdentity: target.mmvIdentity,
      modelYear: 2027,
    });
  });
  it('no rows never implies negative reconciliation', () =>
    expect(matchStructuredRows(g, []).observations).toEqual([]));
});
describe('structured first fallback budget', () => {
  it('structured success prevents any fallback initialization', async () => {
    const fallback = vi.fn(async () => official),
      p = new StructuredFirstModelYearResearch({
        structured: provider([row]),
        fallback,
        allowDealer: true,
      });
    const r = await p.researchModelYears([target], source);
    expect(fallback).not.toHaveBeenCalled();
    expect(r.metrics?.structuredRowsMatched).toBe(1);
  });
  it('unresolved manufacturer group is researched once for several targets', async () => {
    const factory = vi.fn(async () => official),
      p = new StructuredFirstModelYearResearch({ structured: provider(), fallback: factory });
    await p.researchModelYears([target, { ...target, targetKey: '2' }], source);
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith('MANUFACTURER_OFFICIAL');
  });
  it('valid manufacturer result prevents dealer fallback', async () => {
    const fallback = vi.fn(async () => official);
    await new StructuredFirstModelYearResearch({
      structured: provider(),
      fallback,
      allowDealer: true,
    }).researchModelYears([target], source);
    expect(fallback).toHaveBeenCalledOnce();
  });
  it('invalid manufacturer observation cannot suppress dealer', async () => {
    const fallback = vi.fn(async (stage: string) =>
      stage === 'MANUFACTURER_OFFICIAL'
        ? {
            researchModelYears: async () => [
              coverageObservation(target, 2027, 'wrong model line 2027'),
            ],
          }
        : official,
    );
    await new StructuredFirstModelYearResearch({
      structured: provider(),
      fallback,
      allowDealer: true,
    }).researchModelYears([target], source);
    expect(fallback.mock.calls.map((c) => c[0])).toEqual([
      'MANUFACTURER_OFFICIAL',
      'AUTHORIZED_DEALER',
    ]);
  });
  it('dealer disabled by default', async () => {
    const fallback = vi.fn(async () => ({ researchModelYears: async () => [] }));
    await new StructuredFirstModelYearResearch({
      structured: provider(),
      fallback,
    }).researchModelYears([target], source);
    expect(fallback).toHaveBeenCalledOnce();
  });
  it('budget zero preserves structured observations and reports skip', async () => {
    const fallback = vi.fn(async () => official),
      other = {
        ...target,
        targetKey: 'taos',
        officialIdentity: { ...target.officialIdentity, model: 'Taos' },
      };
    const r = await new StructuredFirstModelYearResearch({
      structured: provider([row]),
      fallback,
      maxOpenAiModelGroups: 0,
    }).researchModelYears([target, other], source);
    expect(fallback).not.toHaveBeenCalled();
    expect(r.observations).toHaveLength(1);
    expect(r.metrics?.skippedDueToBudget).toBe(1);
  });
  it('group budget bounds both fallback stages', async () => {
    const fallback = vi.fn(async () => ({ researchModelYears: async () => [] }));
    const r = await new StructuredFirstModelYearResearch({
      structured: provider(),
      fallback,
      maxOpenAiModelGroups: 1,
      allowDealer: true,
    }).researchModelYears([target], source);
    expect(fallback).toHaveBeenCalledOnce();
    expect(r.metrics?.skippedDueToBudget).toBe(1);
  });
  it('missing config fails only fallback, preserves run data', async () => {
    const r = await new StructuredFirstModelYearResearch({
      structured: provider(),
      fallback: async () => {
        throw Error('secret');
      },
    }).researchModelYears([target], source);
    expect(r.searchAttempts.at(-1)?.errorCode).toBe('MODEL_YEAR_FALLBACK_UNAVAILABLE');
    expect(JSON.stringify(r)).not.toContain('secret');
  });
  it('source transport failure is audited and official fallback continues', async () => {
    const r = await new StructuredFirstModelYearResearch({
      structured: {
        discover: async () => {
          throw Error('secret');
        },
      },
      fallback: async () => official,
    }).researchModelYears([target], source);
    expect(r.rejections?.[0]?.reasonCode).toBe('STRUCTURED_SOURCE_UNAVAILABLE');
    expect(r.observations).toHaveLength(1);
  });
  it('structured result metrics/rejections reach report without finding persistence', async () => {
    const f = modelYearFixture('VW');
    const r = await new ModelYearAgent({
      ...f,
      research: {
        async researchModelYears(ts) {
          return new StructuredFirstModelYearResearch({
            structured: provider(),
          }).researchModelYears(ts, source);
        },
      },
    }).run({ brand: 'VW', country: 'BR' }, 'structured');
    expect(r.bundle.findings).toEqual([]);
    expect(r.bundle.run.summary.modelGroups).toBeGreaterThan(0);
    expect(MODEL_YEAR_SOURCE_TIERS).toEqual([
      'STRUCTURED_AUTOMOTIVE_DATA',
      'MANUFACTURER_OFFICIAL',
      'AUTHORIZED_DEALER',
    ]);
  });
});

it('preserves distinct FIPE candidates across duplicate source observations', () => {
  const observations = matchStructuredRows(g, [row, { ...row, fipeCode: '005526-4' }]).observations;
  const result = reconcileModelYears([target], observations, source);
  expect(result.accepted[0]?.observation.fipeCodeCandidates).toHaveLength(2);
  expect(result.rejectedDetails[0]?.reasonCode).toBe('DUPLICATE_OBSERVATION');
});
