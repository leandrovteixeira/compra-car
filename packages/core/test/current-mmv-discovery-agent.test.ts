import { describe, expect, it, vi } from 'vitest';
import {
  CurrentMmvDiscoveryAgent,
  FixtureProductResearchProvider,
  toyotaFixtureCandidates,
  type OfficialProductCandidate,
} from '../src/agents';

const scope = { country: 'BR', brand: 'Toyota' } as const;

describe('CurrentMmvDiscoveryAgent', () => {
  it('produces a current discovery snapshot without any catalog dependency', async () => {
    const research = new FixtureProductResearchProvider();
    const result = await new CurrentMmvDiscoveryAgent({
      research,
      now: () => new Date('2030-01-01T00:00:00Z'),
    }).run(scope, 'current-only');

    expect(result).toMatchObject({
      schemaVersion: '20C.1',
      runId: 'current-only',
      brand: 'Toyota',
      market: 'BR',
      researchedCandidates: 21,
      acceptedCandidates: 21,
      modelsDiscovered: 5,
      variantsResolved: 20,
      rejectedExternalSources: 0,
    });
    expect(result.observations).toHaveLength(21);
    expect(result.candidates).toHaveLength(21);
    expect(result.candidates.some((candidate) => candidate.officialVersionLabel === 'XR')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('matchedProductIds');
    expect(JSON.stringify(result)).not.toContain('knownMmvIdentities');
  });

  it('validates scope and official evidence before the snapshot', async () => {
    const base = toyotaFixtureCandidates[0]!;
    const external = {
      ...base,
      evidence: [{ ...base.evidence[0]!, url: 'https://example.com/not-official' }],
    };
    const wrongBrand = { ...base, brand: 'Other' };
    const invalid = { ...base, confidence: Number.NaN } as OfficialProductCandidate;

    const result = await new CurrentMmvDiscoveryAgent({
      research: {
        researchProducts: async () => ({
          candidates: [external, wrongBrand, invalid],
          metadata: { provider: 'fake' },
        }),
      },
    }).run(scope, 'validation-only');

    expect(result.candidates).toHaveLength(0);
    expect(result.rejectedCandidates.map((candidate) => candidate.reason).sort()).toEqual([
      'INVALID_CANDIDATE',
      'NO_OFFICIAL_EVIDENCE',
      'OUT_OF_SCOPE',
    ]);
    expect(result.rejectedExternalSources).toBe(1);
  });

  it('deduplicates repeated official observations before any legacy reconciliation', async () => {
    const base = toyotaFixtureCandidates[0]!;
    const sparse = {
      ...base,
      engineDisplacement: null,
      transmission: null,
    };

    const result = await new CurrentMmvDiscoveryAgent({
      research: {
        researchProducts: async () => ({
          candidates: [base, sparse],
          metadata: { provider: 'fake' },
        }),
      },
    }).run(scope, 'dedupe-only');

    expect(result.acceptedCandidates).toBe(1);
    expect(result.candidates[0]).toMatchObject({
      officialVersionLabel: base.officialVersionLabel,
      engineDisplacement: base.engineDisplacement,
      transmission: base.transmission,
    });
  });

  it('emits review-only body/model proposals without rewriting discovered model identity', async () => {
    const base = toyotaFixtureCandidates[0]!;
    const result = await new CurrentMmvDiscoveryAgent({
      research: {
        researchProducts: async () => ({
          candidates: [
            {
              ...base,
              brand: 'Audi',
              model: 'A3',
              bodyStyle: 'Sedan',
              officialVersionLabel: 'Performance',
              trim: 'Performance',
              evidence: [
                {
                  url: 'https://toyota.com.br/body-fixture',
                  title: 'Synthetic body fixture',
                  excerpt: 'A3 Sedan Performance',
                  evidenceType: 'MODEL_PAGE' as const,
                },
              ],
            },
          ],
          metadata: { provider: 'fake' },
        }),
      },
      connectorResolver: {
        resolve: async () => ({
          country: 'BR' as const,
          brand: 'Audi',
          allowedDomains: ['toyota.com.br'],
          allowedHosts: ['toyota.com.br'],
          searchHints: [],
        }),
      },
    }).run({ country: 'BR', brand: 'Audi' }, 'body-proposal');

    expect(result.candidates[0]?.model).toBe('A3');
    expect(result.candidates[0]?.bodyStyle).toBe('Sedan');
    expect(result.bodyModelProposals).toEqual([
      {
        reasonCode: 'POSSIBLE_BODY_SPLIT',
        currentModel: 'A3',
        bodyStyle: 'Sedan',
        proposedModel: 'A3 Sedan',
        requiresReview: true,
      },
    ]);
  });

  it('preserves validated observations separately from deduplicated candidates', async () => {
    const base = toyotaFixtureCandidates[0]!;
    const result = await new CurrentMmvDiscoveryAgent({
      research: {
        researchProducts: async () => ({
          candidates: [
            { ...base, confidence: 0.7 },
            { ...base, confidence: 0.98 },
          ],
          metadata: { provider: 'fake' },
        }),
      },
    }).run(scope, 'observation-preservation');

    expect(result.observations).toHaveLength(2);
    expect(result.observations.map((candidate) => candidate.confidence)).toEqual([0.7, 0.98]);
    expect(result.candidates).toHaveLength(1);
  });

  it('uses the resolved Brand Connector source without reading the legacy catalog', async () => {
    const resolve = vi.fn(async () => ({
      country: 'BR' as const,
      brand: 'Toyota',
      allowedDomains: ['media.toyota.com.br'],
      allowedHosts: ['media.toyota.com.br'],
      searchHints: ['current catalog'],
    }));
    const researchProducts = vi.fn(async () => ({
      candidates: [toyotaFixtureCandidates[0]!],
      metadata: { provider: 'fake' },
    }));

    const result = await new CurrentMmvDiscoveryAgent({
      research: { researchProducts },
      connectorResolver: { resolve },
    }).run(scope, 'connector-current');

    expect(resolve).toHaveBeenCalledOnce();
    expect(researchProducts).toHaveBeenCalledOnce();
    expect(result.candidates).toHaveLength(1);
  });
});
