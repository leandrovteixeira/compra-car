import { describe, it, expect, vi } from 'vitest';
import { BrandConnectorAgent } from '../src/agents/brand-connector-agent';
import { FixtureBrandConnectorResearchProvider, fixtureActiveConnector } from '../src/agents/brand-connector-fixture';
import type { BrandConnectorResearchProvider } from '../src/agents/brand-connector-types';

/** Proof of offline equivalence only. Does not represent API savings or real source freshness. */
describe('Brand Connector offline repeatability proof', () => {
  it('preserves the same health finding and evidence fingerprints with replayed research', async () => {
    const fixture = new FixtureBrandConnectorResearchProvider();
    const connector = fixtureActiveConnector();
    const input = {brand:'Volkswagen',market:'BR',mode:'health-check' as const,activeConnector:connector};
    const recorded = await fixture.researchConnector(input);
    const research = vi.fn(async () => recorded);
    const provider:BrandConnectorResearchProvider={researchConnector:research};
    const agent = new BrandConnectorAgent(provider);
    const first=await agent.run(input,'11111111-1111-4111-8111-111111111111','fixture');
    const second=await agent.run(input,'22222222-2222-4222-8222-222222222222','fixture');
    expect(research).toHaveBeenCalledTimes(2);
    expect(first.findings[0]?.finding.findingType).toBe('CONNECTOR_HEALTHY');
    expect(second.findings[0]?.finding.findingType).toBe('CONNECTOR_HEALTHY');
    expect(second.findings[0]?.finding.fingerprint).toBe(first.findings[0]?.finding.fingerprint);
    expect(second.findings[0]?.evidence.map(e=>e.evidenceFingerprint))
      .toEqual(first.findings[0]?.evidence.map(e=>e.evidenceFingerprint));
  });
  it('does not hide observed drift on repeated execution', async () => {
    const agent = new BrandConnectorAgent(new FixtureBrandConnectorResearchProvider(true));
    const input={brand:'Volkswagen',market:'BR',mode:'health-check' as const,activeConnector:fixtureActiveConnector()};
    const result=await agent.run(input);
    expect(result.findings[0]?.finding.findingType).toBe('CONNECTOR_DRIFT');
  });
});
