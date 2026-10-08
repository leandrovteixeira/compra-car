import { describe, expect, it, vi } from 'vitest';
import { observeBrandConnectorResearch } from './brand-connector-telemetry';
import type { BrandConnectorResearchProvider } from '@compra-car/core/agents';

const input = {brand: 'Kia', market: 'BR', mode: 'discover' as const};
const output = {
  observedBrandLabel: 'Kia', market: 'BR', candidateDomains: ['kia.com.br'],
  sourceEntries: [{type:'MODEL_INDEX' as const, url:'https://kia.com.br/', priority:1}],
  searchHints:[], terminologyHints:[], confidence:0.9, warnings:[],
  evidence:[{url:'https://kia.com.br/',title:'Home',excerpt:'A'}, {url:'https://kia.com.br/',title:'Home',excerpt:'B'}],
  verificationSummary:'OK', checksPerformed:['official'], driftDetected:false,
};
describe('Brand Connector passive engineering telemetry', () => {
  it('measures only observed data and preserves research result', async () => {
    const call = vi.fn(async () => output);
    const provider: BrandConnectorResearchProvider = {researchConnector:call};
    let ticks = 10;
    const observer = observeBrandConnectorResearch(provider, () => (ticks += 5));
    expect(observer.snapshot()).toBeNull();
    expect(await observer.research.researchConnector(input)).toBe(output);
    expect(call).toHaveBeenCalledTimes(1);
    expect(observer.snapshot()).toMatchObject({
      providerCalls:1, researchDurationMs:5, evidenceCount:2, uniqueEvidenceUrls:1,
      discoveredDomains:1, sourceEntries:1, llmCalls:null, estimatedCostUsd:null,
      httpRequests:null, cacheHits:null,
    });
  });
  it('does not swallow provider errors or manufacture success metrics', async () => {
    const observer = observeBrandConnectorResearch({
      async researchConnector() { throw new Error('PROVIDER_FAILED'); },
    });
    await expect(observer.research.researchConnector(input)).rejects.toThrow('PROVIDER_FAILED');
    expect(observer.snapshot()).toBeNull();
  });
});
