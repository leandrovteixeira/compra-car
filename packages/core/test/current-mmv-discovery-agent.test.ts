import { describe, expect, it, vi } from 'vitest';
import { aggregateBodyModelProposals } from '../src/agents/mmv-body-model-resolver';
import {
  CurrentMmvDiscoveryAgent,
  FixtureProductResearchProvider,
  toyotaFixtureCandidates,
  type OfficialProductCandidate,
} from '../src/agents';

const scope = { country: 'BR', brand: 'Toyota' } as const;

describe('CurrentMmvDiscoveryAgent', () => {
  it('groups normalized body proposal identity without mutating published labels or input', () => {
    const proposal = {
      reasonCode: 'POSSIBLE_BODY_SPLIT' as const,
      currentModel: 'Corolla',
      bodyStyle: 'Sedan',
      proposedModel: 'Corolla Sedan',
      requiresReview: true as const,
      evidence: toyotaFixtureCandidates[0]!.evidence,
    };
    const duplicate = {
      ...proposal,
      currentModel: ' corolla ',
      bodyStyle: 'SEDAN',
      proposedModel: ' corolla   sedan ',
    };
    const result = aggregateBodyModelProposals(
      Object.freeze([Object.freeze(proposal), Object.freeze(duplicate)]),
    );
    expect(result).toEqual([proposal]);
    expect(result[0]).not.toBe(proposal);
  });
  it('aggregates five Corolla variants and keeps distinct Hilux bodies review-only', async () => {
    const base = toyotaFixtureCandidates[0]!;
    const common = base.evidence[0]!;
    const distinct = Array.from({ length: 5 }, (_, index) => ({
      ...common,
      url: `https://toyota.com.br/corolla/${index}`,
      excerpt: `Variant ${index}`,
    }));
    const candidates = [
      ...distinct.map((evidence, index) => ({
        ...base,
        model: 'Corolla',
        bodyStyle: 'Sedan',
        officialVersionLabel: `Variant ${index}`,
        trim: `Variant ${index}`,
        evidence: [common, evidence, common],
      })),
      ...['Cabine Dupla', 'Cabine Simples', 'Chassi Cabine Simples'].map((bodyStyle) => ({
        ...base,
        model: 'Hilux',
        bodyStyle,
      })),
    ];
    const result = await new CurrentMmvDiscoveryAgent({
      research: { researchProducts: async () => ({ candidates, metadata: { provider: 'fake' } }) },
    }).run(scope, 'body-aggregation');
    expect(result.candidates.filter((candidate) => candidate.model === 'Corolla')).toHaveLength(5);
    expect(result.bodyModelProposals).toHaveLength(3);
    expect(
      result.bodyModelProposals.filter((proposal) => proposal.currentModel === 'Corolla'),
    ).toHaveLength(0);
    expect(
      result.bodyModelProposals
        .filter((proposal) => proposal.currentModel === 'Hilux')
        .map((proposal) => proposal.proposedModel),
    ).toEqual(['Hilux Cabine Dupla', 'Hilux Cabine Simples', 'Hilux Chassi Cabine Simples']);
    expect(result.bodyModelProposals.every((proposal) => proposal.requiresReview)).toBe(true);
  });
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
    expect(result.candidates.some((candidate) => candidate.officialVersionLabel === 'XR')).toBe(
      true,
    );
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

  it('suppresses generic body styles without rewriting discovered model identity', async () => {
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
    expect(result.bodyModelProposals).toEqual([]);
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
