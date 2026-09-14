import { describe, it, expect, vi } from 'vitest';
import {
  BrandConnectorAgent,
  FixtureBrandConnectorResearchProvider,
  fixtureActiveConnector,
  volkswagenConnectorFixture as definition,
  validateConnectorDefinition,
  connectorFingerprint,
  safeConnectorUrl,
  brandKey,
  connectorDomain,
  acceptedConnectorProposal,
  BuiltInBrandConnectorResolver,
  OperationalBrandConnectorResolver,
  builtInConnectorDefinitions,
  officialBrandSource,
  NewProductCheckAgent,
} from '../src/agents';
import {
  StoredAgentPlatformRepository,
  type AgentFindingDetail,
  type AgentReview,
} from '../src/agent-platform';
import { InMemoryAgentPlatformStore, platformFixtureId } from '../src/agent-platform/testing';
const discovery = () =>
  new BrandConnectorAgent(new FixtureBrandConnectorResearchProvider()).run({
    brand: 'Volkswagen',
    market: 'BR',
    mode: 'discover',
  });
describe('Brand connector definitions and URL boundary', () => {
  it('normalizes case and whitespace without fuzzy merging', () => {
    expect(brandKey(' VOLKSWAGEN ')).toBe(brandKey('Volkswagen'));
    expect(brandKey('GWM')).not.toBe(brandKey('Great Wall'));
  });
  it.each([
    'localhost',
    '127.0.0.1',
    '10.0.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '[::1]',
    '0x7f000001',
    'internal.local',
    'https://toyota.com.br',
    'toyota.com.br/path',
  ])('rejects domain %s', (value) => expect(() => connectorDomain(value)).toThrow());
  it.each([
    'http://localhost/',
    'http://127.1/',
    'http://2130706433/',
    'http://[::ffff:127.0.0.1]/',
    'https://user:pass@volkswagen.com.br/',
    'javascript:alert(1)',
    'data:text/plain,test',
    'file:///tmp/test',
    'https://volkswagen.com.br.evil.com/',
    'https://evilvolkswagen.com.br/',
    'https://volkswagen.com.br/?token=secret',
  ])('rejects unsafe or out-of-scope URL %s', (value) =>
    expect(safeConnectorUrl(value, definition.allowedDomains)).toBeNull(),
  );
  it('permits exact and DNS subdomains', () => {
    expect(
      safeConnectorUrl('https://media.volkswagen.com.br/a', definition.allowedDomains),
    ).toBeTruthy();
    expect(validateConnectorDefinition(definition)).toMatchObject({ market: 'BR' });
  });
  it('fingerprints normalized unordered arrays deterministically', () => {
    expect(connectorFingerprint(definition)).toBe(
      connectorFingerprint({
        ...definition,
        brand: ' VOLKSWAGEN ',
        sourceEntries: [...definition.sourceEntries].reverse(),
        searchHints: [...definition.searchHints].reverse(),
        terminologyHints: [...definition.terminologyHints].reverse(),
      }),
    );
    expect(connectorFingerprint(definition)).not.toBe(
      connectorFingerprint({ ...definition, searchHints: ['changed'] }),
    );
  });
  it('rejects missing domains, credentials and HTML hints', () => {
    for (const value of [
      { ...definition, allowedDomains: [] },
      { ...definition, searchHints: ['<html>dump</html>'] },
      { ...definition, terminologyHints: ['api_key=secret'] },
      {
        ...definition,
        sourceEntries: [{ type: 'MODEL_INDEX', url: 'https://evil.com/', priority: 1 }],
      },
    ])
      expect(() => validateConnectorDefinition(value)).toThrow();
  });
});
describe('Brand Connector Agent and platform integration', () => {
  it('reports drift without an activatable replacement when no official domain can be proposed', async () => {
    const input = {
      brand: 'Volkswagen',
      market: 'BR',
      mode: 'health-check' as const,
      activeConnector: fixtureActiveConnector(),
    };
    const result = await new FixtureBrandConnectorResearchProvider().researchConnector(input);
    const bundle = await new BrandConnectorAgent({
      researchConnector: async () => ({
        ...result,
        candidateDomains: [],
        sourceEntries: [],
        driftDetected: true,
      }),
    }).run(input);
    expect(bundle.findings[0]!.finding).toMatchObject({
      findingType: 'CONNECTOR_DRIFT',
      requiresReview: true,
      proposal: null,
    });
    expect(bundle.findings[0]!.evidence).toHaveLength(1);
  });
  it('discovery emits review proposal and separate synthetic evidence, never trusts or activates', async () => {
    const bundle = await discovery(),
      item = bundle.findings[0]!;
    expect(bundle.run.agentType).toBe('BRAND_CONNECTOR');
    expect(item.finding.findingType).toBe('NEW_BRAND_CONNECTOR');
    expect(item.finding.requiresReview).toBe(true);
    expect(item.finding.proposal?.terminologyHints).toEqual(['TSI', 'eTSI']);
    expect(item.evidence[0]?.metadata).toMatchObject({ candidateOnly: true, synthetic: true });
  });
  it.each([false, true])('health check drift=%s', async (drift) => {
    const bundle = await new BrandConnectorAgent(
      new FixtureBrandConnectorResearchProvider(drift),
    ).run({
      brand: 'Volkswagen',
      market: 'BR',
      mode: 'health-check',
      activeConnector: fixtureActiveConnector(),
    });
    expect(bundle.findings[0]!.finding.findingType).toBe(
      drift ? 'CONNECTOR_DRIFT' : 'CONNECTOR_HEALTHY',
    );
    expect(bundle.findings[0]!.finding.requiresReview).toBe(drift);
  });
  it('fails health without ACTIVE and discovery with an active connector', async () => {
    const agent = new BrandConnectorAgent(new FixtureBrandConnectorResearchProvider());
    await expect(
      agent.run({ brand: 'Volkswagen', market: 'BR', mode: 'health-check' }),
    ).rejects.toThrow('BRAND_CONNECTOR_REQUIRED');
    await expect(
      agent.run({
        brand: 'Volkswagen',
        market: 'BR',
        mode: 'discover',
        activeConnector: fixtureActiveConnector(),
      }),
    ).rejects.toThrow();
  });
  it('does not report uncertain research as healthy', async () => {
    const input = {
      brand: 'Volkswagen',
      market: 'BR',
      mode: 'health-check' as const,
      activeConnector: fixtureActiveConnector(),
    };
    const research = await new FixtureBrandConnectorResearchProvider().researchConnector(input);
    const bundle = await new BrandConnectorAgent({
      researchConnector: async () => ({ ...research, confidence: 0.2 }),
    }).run(input);
    expect(bundle.findings[0]!.finding.findingType).toBe('CONNECTOR_DRIFT');
  });
  it('requires evidence for candidate domains', async () => {
    const input = { brand: 'Volkswagen', market: 'BR', mode: 'discover' as const };
    const research = await new FixtureBrandConnectorResearchProvider().researchConnector(input);
    await expect(
      new BrandConnectorAgent({
        researchConnector: async () => ({ ...research, evidence: [] }),
      }).run(input),
    ).rejects.toThrow();
  });
  it('persists and replays without duplicate findings or evidence; ACCEPT only reviews', async () => {
    const bundle = await discovery(),
      store = new InMemoryAgentPlatformStore(),
      repo = new StoredAgentPlatformRepository(store);
    await repo.persistRunBundle(bundle);
    await repo.persistRunBundle(bundle);
    const id = bundle.findings[0]!.finding.id;
    expect((await store.findings()).length).toBe(1);
    expect((await store.evidence(id)).length).toBe(1);
    await repo.addReview({
      findingId: id,
      decision: 'ACCEPT',
      note: null,
      reviewedBy: platformFixtureId(100),
    });
    const detail = (await repo.getFinding(id))!;
    expect(acceptedConnectorProposal(detail).brand).toBe('Volkswagen');
    expect((await store.reviews()).length).toBe(1);
  });
  it.each(['REJECT', 'DEFER', 'OPEN', 'FAILED', 'INVALID_PROPOSAL', 'MISMATCH'])(
    'activation rejects %s',
    async (scenario) => {
      const bundle = await discovery(),
        item = bundle.findings[0]!;
      const review: AgentReview = {
        id: platformFixtureId(2),
        findingId: item.finding.id,
        decision: scenario === 'REJECT' || scenario === 'DEFER' ? scenario : 'ACCEPT',
        note: null,
        reviewedBy: platformFixtureId(3),
        createdAt: bundle.run.createdAt,
      };
      const detail: AgentFindingDetail = {
        ...item,
        run: scenario === 'FAILED' ? { ...bundle.run, status: 'FAILED' } : bundle.run,
        reviews: scenario === 'OPEN' ? [] : [review],
        latestReview: review,
      };
      const changed =
        scenario === 'INVALID_PROPOSAL'
          ? { ...detail, finding: { ...detail.finding, proposal: null } }
          : scenario === 'MISMATCH'
            ? { ...detail, finding: { ...detail.finding, payload: {} } }
            : detail;
      expect(() => acceptedConnectorProposal(changed)).toThrow();
    },
  );
});
describe('Operational connector resolution and MMV regressions', () => {
  it.each(['Toyota', 'Jeep'])('preserves %s built-in and bootstrap values', async (brand) => {
    const source = officialBrandSource({ country: 'BR', brand });
    expect(await new BuiltInBrandConnectorResolver().resolve({ country: 'BR', brand })).toEqual(
      source,
    );
    const operational = new OperationalBrandConnectorResolver({
      getActiveConnector: async () =>
        fixtureActiveConnector(builtInConnectorDefinitions().find((d) => d.brand === brand)!),
    });
    expect(await operational.resolve({ country: 'BR', brand })).toEqual(source);
    expect(builtInConnectorDefinitions().find((d) => d.brand === brand)).toMatchObject({
      allowedDomains: source.allowedDomains,
      searchHints: source.searchHints,
      sourceEntries: [],
      terminologyHints: [],
    });
  });
  it('active new brand reaches provider without a matcher branch', async () => {
    const resolver = new OperationalBrandConnectorResolver({
      getActiveConnector: async () => fixtureActiveConnector(),
    });
    const researchProducts = vi.fn(async () => ({
      candidates: [],
      metadata: { provider: 'fixture' },
    }));
    const reports = { write: vi.fn(async () => undefined) };
    await new NewProductCheckAgent({
      connectorResolver: resolver,
      research: { researchProducts },
      catalog: { readProducts: async () => [] },
      reports,
    }).run({ country: 'BR', brand: 'Volkswagen' }, 'operational-test');
    expect(researchProducts).toHaveBeenCalledWith(
      { country: 'BR', brand: 'Volkswagen' },
      expect.objectContaining({ allowedDomains: definition.allowedDomains }),
    );
  });
  it('unknown brand without active fails safely and controlled fallback resolves Toyota', async () => {
    const resolver = new OperationalBrandConnectorResolver(
      { getActiveConnector: async () => null },
      new BuiltInBrandConnectorResolver(),
    );
    await expect(resolver.resolve({ country: 'BR', brand: 'Unknown' })).rejects.toThrow(
      'BRAND_CONNECTOR_REQUIRED',
    );
    expect((await resolver.resolve({ country: 'BR', brand: 'Toyota' })).brand).toBe('Toyota');
  });
});
