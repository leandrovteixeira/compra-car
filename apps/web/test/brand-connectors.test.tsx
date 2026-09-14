import { randomUUID } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  BrandConnectorAgent,
  FixtureBrandConnectorResearchProvider,
  fixtureActiveConnector,
  volkswagenConnectorFixture,
  type BrandConnectorRepository,
} from '@compra-car/core/agents';
import { StoredAgentPlatformRepository } from '@compra-car/core/agent-platform';
import { InMemoryAgentPlatformStore } from '@compra-car/core/agent-platform/testing';
import {
  loadBrandTargets,
  loadBrandConnectorDetail,
  manageBrandConnector,
  type BrandAdminDependencies,
} from '../src/application/admin/brand-connectors';
import { BrandConnectorView } from '../src/components/admin/brand-connector-view';
import { AgentFindingDetailView } from '../src/components/admin/agent-platform-views';
const form = (operation: string, values: Record<string, string> = {}) => {
  const data = new FormData();
  data.set('operation', operation);
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};
function setup() {
  const actor = randomUUID(),
    id = randomUUID(),
    target = {
      id,
      brand: 'Volkswagen',
      brandKey: 'volkswagen',
      market: 'BR',
      origin: 'MANUAL' as const,
      enabled: true,
      createdBy: actor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  const repository: BrandConnectorRepository = {
    listTargets: vi.fn(async () => [target]),
    getTarget: vi.fn(async () => target),
    addManualTarget: vi.fn(async () => target),
    setEnabled: vi.fn(async () => undefined),
    syncCatalogBrands: vi.fn(async () => ({ added: 2, existing: 1 })),
    getActiveConnector: vi.fn(async () => fixtureActiveConnector()),
    listConnectorVersions: vi.fn(async () => [fixtureActiveConnector()]),
    listMissingConnectorTargets: vi.fn(async () => []),
    activateConnector: vi.fn(async () => fixtureActiveConnector()),
  };
  const deps: BrandAdminDependencies = {
    authorize: vi.fn(async () => ({ profile: { id: actor } })),
    repository: vi.fn(() => repository),
    platform: () => new StoredAgentPlatformRepository(new InMemoryAgentPlatformStore()),
    revalidate: vi.fn(),
  };
  return { deps, repository, actor, id };
}
describe('Brand Admin authorization and actions', () => {
  it.each(['list', 'detail', 'add', 'sync', 'enable', 'activate'])(
    'denies non-admin %s before privileged construction',
    async (operation) => {
      const { deps: original, id } = setup();
      const deps = {
        ...original,
        authorize: vi.fn(async () => {
          throw Error('denied');
        }),
      };
      await expect(
        operation === 'list'
          ? loadBrandTargets(deps)
          : operation === 'detail'
            ? loadBrandConnectorDetail(id, deps)
            : manageBrandConnector(form(operation), deps),
      ).rejects.toThrow('denied');
      expect(deps.repository).not.toHaveBeenCalled();
    },
  );
  it('loads targets, active connector and history without writes', async () => {
    const { deps, repository, id } = setup();
    expect(await loadBrandTargets(deps)).toHaveLength(1);
    expect((await loadBrandConnectorDetail(id, deps))?.versions).toHaveLength(1);
    expect(repository.syncCatalogBrands).not.toHaveBeenCalled();
    expect(repository.activateConnector).not.toHaveBeenCalled();
  });
  it('adds manual, syncs explicitly and pauses with authenticated actor', async () => {
    const { deps, repository, actor, id } = setup();
    expect(
      (await manageBrandConnector(form('add', { brand: 'Zeekr', market: 'BR' }), deps)).status,
    ).toBe('success');
    expect(repository.addManualTarget).toHaveBeenCalledWith('Zeekr', 'BR', actor);
    expect((await manageBrandConnector(form('sync'), deps)).message).toContain('2 novas');
    await manageBrandConnector(form('enable', { targetId: id, enabled: 'false' }), deps);
    expect(repository.setEnabled).toHaveBeenCalledWith(id, false);
    expect(repository.activateConnector).not.toHaveBeenCalled();
  });
  it('activation is explicit, actor is server-derived and errors are comprehensible', async () => {
    const { deps, repository, actor } = setup(),
      id = randomUUID();
    expect(
      (await manageBrandConnector(form('activate', { findingId: id, actor: 'forged' }), deps))
        .status,
    ).toBe('success');
    expect(repository.activateConnector).toHaveBeenCalledWith(id, actor);
    expect(
      (await manageBrandConnector(form('enable', { targetId: id, enabled: 'invalid' }), deps))
        .status,
    ).toBe('error');
  });
  it('renders structured proposal, terminology, warnings and safe evidence', async () => {
    expect(
      renderToStaticMarkup(<BrandConnectorView value={volkswagenConnectorFixture} />),
    ).toContain('Terminologia de navegação');
    const bundle = await new BrandConnectorAgent(new FixtureBrandConnectorResearchProvider()).run({
      brand: 'Volkswagen',
      market: 'BR',
      mode: 'discover',
    });
    const item = bundle.findings[0]!;
    const html = renderToStaticMarkup(
      <AgentFindingDetailView
        detail={{
          ...item,
          run: bundle.run,
          reviews: [],
          latestReview: null,
          evidence: [{ ...item.evidence[0]!, sourceUrl: 'http://127.0.0.1/' }],
        }}
      />,
    );
    expect(html).toContain('Domínios propostos');
    expect(html).toContain('Accept registra a revisão');
    expect(html).not.toContain('href="http://127.0.0.1');
  });
});
