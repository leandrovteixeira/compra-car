import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  StoredAgentPlatformRepository,
  type AgentPlatformRepository,
} from '@compra-car/core/agent-platform';
import {
  InMemoryAgentPlatformStore,
  agentPlatformFixture,
  platformFixtureId,
} from '@compra-car/core/agent-platform/testing';
import {
  loadAgentQueue,
  loadAgentRuns,
  loadAgentRun,
  loadAgentFinding,
  reviewAgentFinding,
  type AgentAdminDependencies,
} from '../src/application/admin/agent-platform';
import {
  AgentFindingTable,
  AgentRunHistory,
  AgentRunDetail,
  AgentFindingDetailView,
} from '../src/components/admin/agent-platform-views';
import { adminNavigationItems } from '../src/components/admin/admin-navigation';
import { canAccessArea } from '../src/auth/access-control';
async function setup() {
  let id = 1000;
  const store = new InMemoryAgentPlatformStore(),
    repo = new StoredAgentPlatformRepository(
      store,
      () => '2026-09-13T14:00:00.000Z',
      () => platformFixtureId(id++),
    );
  const { bundle, reviews } = agentPlatformFixture();
  await repo.persistRunBundle(bundle);
  for (const review of reviews) await repo.addReview(review);
  const deps: AgentAdminDependencies = {
    authorize: vi.fn(async () => ({ profile: { id: platformFixtureId(100) } })),
    repository: vi.fn(() => repo),
    revalidate: vi.fn(),
  };
  return { store, repo, bundle, deps };
}
const form = (id: string, decision: string) => {
  const data = new FormData();
  data.set('findingId', id);
  data.set('decision', decision);
  data.set('note', 'Reviewed with evidence');
  data.set('reviewedBy', platformFixtureId(999));
  return data;
};
describe('Agents Admin authorization and review application', () => {
  it.each(['queue', 'runs', 'run', 'finding', 'review'])(
    'denies %s before constructing a privileged repository',
    async (operation) => {
      const deps: AgentAdminDependencies = {
        authorize: vi.fn(async () => {
          throw Error('access denied');
        }),
        repository: vi.fn<() => AgentPlatformRepository>(),
        revalidate: vi.fn(),
      };
      const calls = {
        queue: () => loadAgentQueue({}, deps),
        runs: () => loadAgentRuns({}, deps),
        run: () => loadAgentRun(platformFixtureId(1), deps),
        finding: () => loadAgentFinding(platformFixtureId(10), deps),
        review: () => reviewAgentFinding(form(platformFixtureId(10), 'ACCEPT'), deps),
      };
      await expect(calls[operation as keyof typeof calls]()).rejects.toThrow('access denied');
      expect(deps.repository).not.toHaveBeenCalled();
    },
  );
  it('allows active admins only through the existing profile policy', () => {
    const profile = {
      id: platformFixtureId(100),
      fullName: 'Test',
      role: 'admin' as const,
      status: 'active' as const,
    };
    expect(canAccessArea(profile, 'admin')).toBe(true);
    expect(canAccessArea({ ...profile, role: 'seller' }, 'admin')).toBe(false);
    expect(canAccessArea({ ...profile, status: 'disabled' }, 'admin')).toBe(false);
    expect(canAccessArea(null, 'admin')).toBe(false);
  });
  it('loads queue and all details after authorization and excludes informational records from default queue', async () => {
    const { deps, bundle } = await setup();
    expect((await loadAgentQueue({}, deps)).items.map((i) => i.finding.findingType)).toEqual([
      'NEW_MODEL',
      'NEW_VERSION',
      'AMBIGUOUS_MMV',
    ]);
    expect((await loadAgentRuns({}, deps)).total).toBe(1);
    expect((await loadAgentRun(bundle.run.id, deps))!.findings).toHaveLength(7);
    expect(
      (await loadAgentFinding(bundle.findings[0]!.finding.id, deps))!.finding.requiresReview,
    ).toBe(false);
    expect(deps.authorize).toHaveBeenCalledTimes(4);
  });
  it.each(['ACCEPT', 'REJECT', 'DEFER'])(
    '%s records only a new review by the authenticated actor and revalidates all affected pages',
    async (decision) => {
      const { deps, repo, bundle, store } = await setup();
      const before = await repo.getRun(bundle.run.id),
        target = bundle.findings[1]!.finding.id;
      const result = await reviewAgentFinding(form(target, decision), deps);
      expect(result.status).toBe('success');
      expect(result.message).toContain('não altera o catálogo');
      const detail = (await repo.getFinding(target))!;
      expect(detail.latestReview?.decision).toBe(decision);
      expect(detail.latestReview?.reviewedBy).toBe(platformFixtureId(100));
      expect(detail.latestReview?.note).toBe('Reviewed with evidence');
      expect(await store.reviews()).toHaveLength(4);
      expect(await repo.getRun(bundle.run.id)).toEqual(before);
      expect(deps.revalidate).toHaveBeenCalledWith('/admin/agents');
      expect(deps.revalidate).toHaveBeenCalledWith('/admin/agents/runs/' + bundle.run.id);
      expect(deps.revalidate).toHaveBeenCalledWith('/admin/agents/findings/' + target);
    },
  );
  it('rejects malformed review submissions before repository access', async () => {
    const { deps } = await setup();
    expect((await reviewAgentFinding(form('invalid', 'EXECUTE'), deps)).status).toBe('error');
    expect(deps.repository).not.toHaveBeenCalled();
  });
  it('retains a successful decision even if cache invalidation fails', async () => {
    const { deps, bundle, repo } = await setup();
    const id = bundle.findings[1]!.finding.id;
    const result = await reviewAgentFinding(form(id, 'ACCEPT'), {
      ...deps,
      revalidate: () => {
        throw Error('cache unavailable');
      },
    });
    expect(result.status).toBe('success');
    expect((await repo.getLatestReview(id))?.decision).toBe('ACCEPT');
  });
  it('surfaces persistence uncertainty without leaking backend errors', async () => {
    const { deps, repo, bundle } = await setup();
    vi.spyOn(repo, 'addReview').mockRejectedValue(new Error('private backend secret'));
    const result = await reviewAgentFinding(form(bundle.findings[1]!.finding.id, 'ACCEPT'), deps);
    expect(result.status).toBe('error');
    expect(result.message).not.toContain('private backend secret');
    expect(deps.revalidate).not.toHaveBeenCalled();
  });
});
describe('Agents Admin presentation', () => {
  it('renders the open queue with subject, type, confidence, run date and safe internal review links', async () => {
    const { deps } = await setup();
    const queue = await loadAgentQueue({}, deps);
    const html = renderToStaticMarkup(<AgentFindingTable items={queue.items} />);
    for (const text of [
      'Fixture vehicle 1',
      'NEW_MODEL',
      'NEW_VERSION',
      'AMBIGUOUS_MMV',
      '80%',
      '13/09/2026',
      '/admin/agents/findings/',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('MMV_MATCHED');
    expect(html).not.toContain('Fixture vehicle 4');
  });
  it('renders run history with current decision counts and a run link', async () => {
    const { deps } = await setup();
    const runs = await loadAgentRuns({}, deps);
    const html = renderToStaticMarkup(<AgentRunHistory items={runs.items} />);
    for (const text of [
      'MMV_DISCOVERY',
      'COMPLETED',
      'Fixture Motors',
      'fixture',
      '/admin/agents/runs/',
    ])
      expect(html).toContain(text);
    expect(runs.items[0]!.counts).toEqual({
      total: 7,
      reviewRequired: 6,
      accepted: 1,
      rejected: 1,
      deferred: 1,
    });
  });
  it('renders informational matches and review findings in separate run sections', async () => {
    const { bundle } = await setup();
    const html = renderToStaticMarkup(<AgentRunDetail bundle={bundle} />);
    for (const text of [
      'Exigem revisão',
      'Informativos',
      'MMV_MATCHED',
      'NEW_MODEL',
      'NEW_VERSION',
      'AMBIGUOUS_MMV',
    ])
      expect(html).toContain(text);
  });
  it('renders escaped evidence, safe external links and no executable proposal action', async () => {
    const { repo, bundle } = await setup();
    const detail = (await repo.getFinding(bundle.findings[1]!.finding.id))!;
    const html = renderToStaticMarkup(
      <AgentFindingDetailView
        detail={{
          ...detail,
          evidence: [
            {
              ...detail.evidence[0]!,
              excerpt: '<script>alert(1)</script>',
              sourceUrl: 'https://example.com/source',
            },
          ],
        }}
      />,
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Ação proposta (informativa)');
    expect(html).not.toContain('Execute');
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com'])(
    'does not render an unsafe evidence link %s',
    async (sourceUrl) => {
      const { repo, bundle } = await setup();
      const detail = (await repo.getFinding(bundle.findings[0]!.finding.id))!;
      const html = renderToStaticMarkup(
        <AgentFindingDetailView
          detail={{ ...detail, evidence: [{ ...detail.evidence[0]!, sourceUrl }] }}
        />,
      );
      expect(html).not.toContain('Abrir fonte');
      expect(html).toContain('URL inválida');
    },
  );
  it('displays latest decision and the full append-only history', async () => {
    const { repo, bundle } = await setup();
    const target = bundle.findings[6]!.finding.id;
    await repo.addReview({
      findingId: target,
      decision: 'ACCEPT',
      note: 'Follow-up accepted',
      reviewedBy: platformFixtureId(100),
    });
    const detail = (await repo.getFinding(target))!;
    const html = renderToStaticMarkup(<AgentFindingDetailView detail={detail} />);
    expect(detail.latestReview?.decision).toBe('ACCEPT');
    for (const text of [
      'Aceitos',
      'Adiados',
      'Follow-up accepted',
      'Synthetic review',
      'Histórico de revisão',
    ])
      expect(html).toContain(text);
  });
  it('renders all empty states', async () => {
    const { repo, bundle } = await setup();
    expect(renderToStaticMarkup(<AgentFindingTable items={[]} />)).toContain('Nenhum finding');
    expect(renderToStaticMarkup(<AgentRunHistory items={[]} />)).toContain('Nenhuma run');
    const detail = (await repo.getFinding(bundle.findings[0]!.finding.id))!;
    const html = renderToStaticMarkup(
      <AgentFindingDetailView detail={{ ...detail, evidence: [] }} />,
    );
    expect(html).toContain('Nenhuma evidência');
    expect(html).toContain('Nenhuma revisão');
  });
  it('adds navigation only to Admin and retains guards on the server', () => {
    expect(adminNavigationItems).toContainEqual({
      href: '/admin/agents',
      label: 'Agentes',
      status: 'active',
    });
    const source = readFileSync(
      new URL('../src/application/admin/agent-platform.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain("requireRole('admin')");
    expect(source).not.toMatch(/createProduct|publish|executeProposal|LegacySupabaseAdapter/u);
    const formSource = readFileSync(
      new URL('../src/components/admin/agent-review-form.tsx', import.meta.url),
      'utf8',
    );
    expect(formSource).toContain('useActionState');
    expect(formSource).toContain('disabled={pending}');
    expect(formSource).not.toContain('SUPABASE_SERVER_KEY');
  });
});

describe('Model Year generic Admin views', () => {
  it('displays both new types with informational/review distinction', async () => {
    const { ModelYearAgent, modelYearFixture } = await import('@compra-car/core/agents');
    const { bundle } = await new ModelYearAgent(modelYearFixture('VW')).run(
      { brand: 'VW', country: 'BR' },
      'fixture',
    );
    const html = renderToStaticMarkup(
      <AgentFindingTable
        items={bundle.findings.map(({ finding }) => ({
          finding,
          run: bundle.run,
          latestReview: null,
        }))}
      />,
    );
    expect(html).toContain('MODEL_YEAR_MATCHED');
    expect(html).toContain('NEW_MODEL_YEAR');
    expect(html).toContain('Informativo');
    expect(html).toContain('Aberto');
  });
});
