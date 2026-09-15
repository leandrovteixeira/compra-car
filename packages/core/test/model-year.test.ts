import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  ModelYearAgent,
  modelYearFixture,
  buildModelYearTargets,
  knownModelYears,
  explicitModelYears,
  reconcileModelYears,
  mapModelYearRunToPlatform,
  PlatformMmvDiscoveryReader,
  BuiltInBrandConnectorResolver,
  OperationalBrandConnectorResolver,
} from '../src/agents';
import { StoredAgentPlatformRepository } from '../src/agent-platform';
import { InMemoryAgentPlatformStore } from '../src/agent-platform/testing';
import type { AgentFindingType, AgentReviewDecision } from '../src/agent-platform';
const scope = { brand: 'VW', country: 'BR' as const };
async function setup() {
  const f = modelYearFixture('VW'),
    source = await f.connectorResolver.resolve(scope);
  const { targets } = buildModelYearTargets(f.context, f.rows, scope, source);
  const observations = await f.research.researchModelYears(targets, source);
  return { f, source, targets, observations };
}
describe('Model Year domain', () => {
  it.each(['VW', 'Toyota', 'Jeep'])(
    'cross-brand %s uses ACTIVE and produces exactly matched + new',
    async (brand) => {
      const fixture = modelYearFixture(brand),
        before = JSON.stringify(fixture.rows);
      const { bundle, targets } = await new ModelYearAgent(fixture).run(
        { country: 'BR', brand },
        'fixture',
      );
      expect(bundle.run.agentType).toBe('MODEL_YEAR');
      expect(bundle.findings.map((f) => f.finding.findingType).sort()).toEqual([
        'MODEL_YEAR_MATCHED',
        'NEW_MODEL_YEAR',
      ]);
      expect(targets[0]!.knownModelYears).toEqual([2025, 2026]);
      expect(JSON.stringify({ bundle, targets })).not.toContain('productionYear');
      expect(JSON.stringify(fixture.rows)).toBe(before);
    },
  );
  it('deduplicates catalog MY regardless of row order and other fields', () => {
    const f = modelYearFixture('VW');
    expect(knownModelYears(f.rows)).toEqual([2025, 2026]);
    expect(
      knownModelYears([...f.rows].reverse().map((r) => ({ ...r, productionYear: 1900 }))),
    ).toEqual([2025, 2026]);
  });
  it.each([
    ['ano/modelo 2026/2027', [2027]],
    ['ano-modelo 2027', [2027]],
    ['modelo 2027', [2027]],
    ['linha 2027', [2027]],
    ['2027', []],
    ['Copyright 2027', []],
    ['Publicado em 2027', []],
    ['next year', []],
    ['MY 2027', [2027]],
  ])('extracts only explicit content: %s', (text, years) => {
    expect(explicitModelYears(text as string)).toEqual(years);
  });
  it('official naming drives research; canonical key stays catalog identity', async () => {
    const { targets } = await setup();
    expect(targets[0]!.officialIdentity.officialVersionLabel).toBe('Highline 200 TSI');
    expect(targets[0]!.canonicalCatalogIdentity.version).toBe('Highline 1.0 TGDI AT');
    expect(targets[0]!.mmvIdentity).toContain('highline 1.0 tgdi at');
  });
  it.each(['AMBIGUOUS_MMV', 'NEW_MODEL', 'NEW_VERSION'] as AgentFindingType[])(
    'excludes %s even ACCEPTed',
    async (type) => {
      const { f, source } = await setup();
      const item = f.context.findings[0]!;
      const context = {
        ...f.context,
        findings: [
          {
            ...item,
            finding: { ...item.finding, findingType: type },
            latestReview: {
              id: randomUUID(),
              findingId: item.finding.id,
              decision: 'ACCEPT' as const,
              note: null,
              reviewedBy: null,
              createdAt: f.context.run.createdAt,
            },
          },
        ],
      };
      expect(buildModelYearTargets(context, f.rows, scope, source)).toMatchObject({
        targets: [],
        skippedUnresolved: 1,
      });
    },
  );
  it.each(['REJECT', 'DEFER'] as AgentReviewDecision[])('excludes latest %s', async (decision) => {
    const { f, source } = await setup(),
      item = f.context.findings[0]!;
    expect(
      buildModelYearTargets(
        {
          ...f.context,
          findings: [
            {
              ...item,
              latestReview: {
                id: randomUUID(),
                findingId: item.finding.id,
                decision,
                note: null,
                reviewedBy: null,
                createdAt: f.context.run.createdAt,
              },
            },
          ],
        },
        f.rows,
        scope,
        source,
      ).targets,
    ).toEqual([]);
  });
  it('excludes missing catalog identity and non-completed/wrong-market context', async () => {
    const { f, source } = await setup();
    expect(buildModelYearTargets(f.context, [], scope, source).targets).toEqual([]);
    expect(
      buildModelYearTargets(
        { ...f.context, run: { ...f.context.run, status: 'RUNNING' } },
        f.rows,
        scope,
        source,
      ).targets,
    ).toEqual([]);
    expect(
      buildModelYearTargets(
        { ...f.context, run: { ...f.context.run, market: 'US' } },
        f.rows,
        scope,
        source,
      ).targets,
    ).toEqual([]);
  });
  it('deduplicates repeated observations and multiple row years, without negative reconciliation', async () => {
    const { source, targets, observations } = await setup();
    const result = reconcileModelYears(targets, [...observations, ...observations], source);
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted.every((a) => a.observation.evidence.length === 1)).toBe(true);
    expect(
      reconcileModelYears(targets, [observations[1]!], source).accepted.map(
        (a) => a.observation.modelYear,
      ),
    ).toEqual([2027]);
  });
  it.each([
    'Nivus Highline 200 TSI',
    'Copyright 2027 Nivus Highline 200 TSI',
    'Nivus Comfortline modelo 2027',
    'Nivus linha 2027; outra versao',
    'T-Cross Highline 200 TSI modelo 2027',
    'Nivus Comfortline modelo 2027; Nivus Highline 200 TSI modelo 2026',
    'Nivus linha 2027 não inclui Highline 200 TSI',
  ])('rejects unsupported content: %s', async (excerpt) => {
    const { source, targets, observations } = await setup(),
      o = observations[1]!;
    expect(
      reconcileModelYears(
        targets,
        [{ ...o, evidence: [{ ...o.evidence[0]!, url: 'https://vw.com.br/2027/', excerpt }] }],
        source,
      ).accepted,
    ).toEqual([]);
  });
  it('allows model-line applicability only with same-source version membership', async () => {
    const { source, targets, observations } = await setup(),
      o = observations[1]!;
    expect(
      reconcileModelYears(
        targets,
        [
          {
            ...o,
            applicability: 'MODEL_LINE',
            evidence: [{ ...o.evidence[0]!, excerpt: 'Nivus linha 2027 inclui Highline 200 TSI.' }],
          },
        ],
        source,
      ).accepted,
    ).toHaveLength(1);
    expect(
      reconcileModelYears(targets, [{ ...o, applicability: 'MODEL_LINE' }], source).accepted,
    ).toHaveLength(0);
  });
  it.each([
    'https://vw.com.br.evil.test/x',
    'https://dealer.test/x',
    'http://vw.com.br/x',
    'https://user:pass@vw.com.br/x',
  ])('rejects external/unsafe evidence %s', async (url) => {
    const { source, targets, observations } = await setup(),
      o = observations[0]!;
    const result = reconcileModelYears(
      targets,
      [{ ...o, evidence: [{ ...o.evidence[0]!, url }] }],
      source,
    );
    expect(result.accepted).toEqual([]);
    expect(result.rejectedExternalEvidence).toBe(1);
  });
  it('rejects invented target keys and invalid confidence', async () => {
    const { source, targets, observations } = await setup(),
      o = observations[0]!;
    expect(
      reconcileModelYears(
        targets,
        [
          { ...o, targetKey: 'invented' },
          { ...o, confidence: NaN },
        ],
        source,
      ).rejectedObservations,
    ).toBe(2);
  });
  it('does not research when there are no eligible MMVs', async () => {
    const f = modelYearFixture('VW'),
      research = { researchModelYears: vi.fn() };
    const { bundle } = await new ModelYearAgent({
      ...f,
      discovery: {
        async latestCompleted() {
          return null;
        },
      },
      research,
    }).run(scope, 'fixture');
    expect(research.researchModelYears).not.toHaveBeenCalled();
    expect(bundle.findings).toEqual([]);
  });
  it('research succeeds without MY: zero findings and review items', async () => {
    const f = modelYearFixture('VW');
    const { bundle } = await new ModelYearAgent({
      ...f,
      research: {
        async researchModelYears() {
          return [];
        },
      },
    }).run(scope, 'fixture');
    expect(bundle.findings).toEqual([]);
    expect(bundle.run.summary.targetsWithoutExplicitMy).toBe(1);
  });
  it('platform persists evidence, freezes completed observations, ACCEPT remains review only', async () => {
    const store = new InMemoryAgentPlatformStore(),
      repo = new StoredAgentPlatformRepository(store);
    const f = modelYearFixture('VW'),
      before = JSON.stringify(f.rows);
    const { bundle } = await new ModelYearAgent(f).run(scope, 'fixture');
    await repo.persistRunBundle(bundle);
    await repo.persistRunBundle(bundle);
    const matched = bundle.findings.find((f) => !f.finding.requiresReview)!;
    const novel = bundle.findings.find((f) => f.finding.requiresReview)!;
    expect(matched.finding.proposal).toBeNull();
    expect(novel.finding.proposal).toMatchObject({ modelYear: 2027 });
    await repo.addReview({
      findingId: novel.finding.id,
      decision: 'ACCEPT',
      note: null,
      reviewedBy: null,
    });
    expect((await repo.getFinding(novel.finding.id))?.evidence).toHaveLength(1);
    expect((await repo.getFinding(novel.finding.id))?.latestReview?.decision).toBe('ACCEPT');
    await expect(repo.persistFinding(novel.finding)).rejects.toThrow('IMMUTABLE_RUN');
    expect(JSON.stringify(f.rows)).toBe(before);
  });
  it('mapper emits two types only', async () => {
    const { source, targets, observations } = await setup();
    const bundle = mapModelYearRunToPlatform({
      runId: randomUUID(),
      startedAt: '2026-09-15T00:00:00Z',
      completedAt: '2026-09-15T00:00:01Z',
      scope,
      provider: 'fixture',
      targets,
      source,
      discoveryRunId: null,
      skippedUnresolved: 0,
      observations,
    });
    expect(
      bundle.findings.every((f) =>
        ['MODEL_YEAR_MATCHED', 'NEW_MODEL_YEAR'].includes(f.finding.findingType),
      ),
    ).toBe(true);
  });
  it('discovery reader chooses latest completed scoped run, no fallback for empty latest', async () => {
    const a = modelYearFixture('VW').context,
      b = {
        ...a,
        run: { ...a.run, id: randomUUID(), completedAt: '2026-09-16T00:00:00.000Z' },
        findings: [],
      };
    const getRun = vi.fn(async (id: string) => (id === b.run.id ? b : a));
    const reader = new PlatformMmvDiscoveryReader({
      listRuns: async () => ({
        items: [
          {
            run: a.run,
            counts: { total: 1, reviewRequired: 0, accepted: 0, rejected: 0, deferred: 0 },
          },
          {
            run: b.run,
            counts: { total: 0, reviewRequired: 0, accepted: 0, rejected: 0, deferred: 0 },
          },
        ],
        total: 2,
      }),
      getRun,
      getLatestReview: async () => null,
    });
    expect((await reader.latestCompleted(scope))?.findings).toEqual([]);
    expect(getRun).toHaveBeenCalledWith(b.run.id);
  });
  it.each(['Toyota', 'Jeep'])('preserves controlled fallback regression %s', async (brand) => {
    const resolver = new OperationalBrandConnectorResolver(
      {
        async getActiveConnector() {
          return null;
        },
      },
      new BuiltInBrandConnectorResolver(),
    );
    expect((await resolver.resolve({ brand, country: 'BR' })).brand).toBe(brand);
  });
});
