import type { BrandConnectorResearch, BrandConnectorResearchInput, BrandConnectorResearchProvider } from '@compra-car/core/agents';

/**
 * Passive, opt-in transport-independent telemetry. Null means unavailable,
 * NOT zero. No instrumentation-induced network or LLM requests.
 */
export interface BrandConnectorTelemetry {
  readonly schemaVersion: '22.5B';
  readonly providerCalls: number;
  readonly researchDurationMs: number;
  readonly evidenceCount: number;
  readonly uniqueEvidenceUrls: number;
  readonly discoveredDomains: number;
  readonly sourceEntries: number;
  readonly warnings: number;
  readonly httpRequests: null;
  readonly cacheHits: null;
  readonly cacheMisses: null;
  readonly llmCalls: null;
  readonly inputTokens: null;
  readonly outputTokens: null;
  readonly estimatedCostUsd: null;
}
export function observeBrandConnectorResearch(
  provider: BrandConnectorResearchProvider,
  clock: () => number = () => performance.now(),
): { research: BrandConnectorResearchProvider; snapshot: () => BrandConnectorTelemetry | null } {
  let result: BrandConnectorTelemetry | null = null;
  let providerCalls = 0;
  return {
    research: {
      async researchConnector(input: BrandConnectorResearchInput): Promise<BrandConnectorResearch> {
        const start = clock();
        providerCalls++;
        try {
          const value = await provider.researchConnector(input);
          result = {
            schemaVersion: '22.5B',
            providerCalls,
            researchDurationMs: Math.max(0, clock() - start),
            evidenceCount: value.evidence.length,
            uniqueEvidenceUrls: new Set(value.evidence.map(e => e.url)).size,
            discoveredDomains: value.candidateDomains.length,
            sourceEntries: value.sourceEntries.length,
            warnings: value.warnings.length,
            httpRequests: null, cacheHits: null, cacheMisses: null,
            llmCalls: null, inputTokens: null, outputTokens: null, estimatedCostUsd: null,
          };
          return value;
        } catch (error) {
          result = null;
          throw error;
        }
      },
    },
    snapshot: () => result,
  };
}
