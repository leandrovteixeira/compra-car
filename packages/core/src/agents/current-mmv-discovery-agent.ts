import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { BrandConnectorResolver } from './brand-connector-resolver';
import { deduplicateOfficialCandidates } from './official-product-candidate-deduplication';
import { isOfficialProductCandidate } from './official-product-candidate-validation';
import { officialBrandSource, officialEvidenceUrl } from './official-product-sources';
import { isResolvedOfficialVariant } from './product-candidate-matcher';
import type {
  AgentMarketScope,
  CurrentMmvDiscoverySnapshot,
  OfficialProductCandidate,
  ProductEvidence,
  ProductResearchProvider,
  RejectedProductCandidate,
} from './new-product-check-types';

export class CurrentMmvDiscoveryAgent {
  constructor(
    private readonly dependencies: {
      readonly research: ProductResearchProvider;
      readonly now?: () => Date;
      readonly connectorResolver?: BrandConnectorResolver;
    },
  ) {}

  async run(scope: AgentMarketScope, runId: string): Promise<CurrentMmvDiscoverySnapshot> {
    if (!/^[a-zA-Z0-9-]{1,100}$/u.test(runId)) throw new Error('INVALID_RUN_ID');

    const source = this.dependencies.connectorResolver
      ? await this.dependencies.connectorResolver.resolve(scope)
      : officialBrandSource(scope);
    const normalizedScope: AgentMarketScope = { country: source.country, brand: source.brand };
    const now = this.dependencies.now ?? (() => new Date());
    const startedAt = now().toISOString();
    const research = await this.dependencies.research.researchProducts(normalizedScope, source);

    if (!Array.isArray(research.candidates) || research.candidates.length > 1000)
      throw new Error('INVALID_RESEARCH_RESULT');

    const accepted: OfficialProductCandidate[] = [];
    const rejectedCandidates: RejectedProductCandidate[] = [];
    let rejectedExternalSources = 0;

    research.candidates.forEach((raw, candidateIndex) => {
      if (!isOfficialProductCandidate(raw)) {
        rejectedCandidates.push({ candidateIndex, reason: 'INVALID_CANDIDATE' });
        return;
      }

      const evidence: ProductEvidence[] = [];
      for (const item of raw.evidence) {
        const url = officialEvidenceUrl(item.url, source);
        if (url)
          evidence.push({
            url,
            title: item.title,
            excerpt: item.excerpt,
            evidenceType: item.evidenceType,
          });
        else rejectedExternalSources++;
      }

      if (key(raw.brand) !== key(source.brand)) {
        rejectedCandidates.push({ candidateIndex, reason: 'OUT_OF_SCOPE' });
        return;
      }
      if (!evidence.length) {
        rejectedCandidates.push({ candidateIndex, reason: 'NO_OFFICIAL_EVIDENCE' });
        return;
      }

      // Explicit projection strips provider-only fields. Published labels stay verbatim.
      accepted.push({
        brand: raw.brand,
        model: raw.model,
        taxonomy: raw.taxonomy,
        officialVersionLabel: raw.officialVersionLabel,
        trim: raw.trim,
        powertrainLabel: raw.powertrainLabel,
        engineDisplacement: raw.engineDisplacement,
        engineLabel: raw.engineLabel,
        propulsion: raw.propulsion,
        transmission: raw.transmission,
        drivetrain: raw.drivetrain,
        productionYear: raw.productionYear,
        modelYear: raw.modelYear,
        confidence: raw.confidence,
        evidence,
        extractionWarnings: raw.extractionWarnings ?? [],
      });
    });

    const candidates = deduplicateOfficialCandidates(normalizedScope, accepted);
    return {
      schemaVersion: '20B.1',
      runId,
      startedAt,
      completedAt: now().toISOString(),
      brand: source.brand,
      market: source.country,
      researchedCandidates: research.candidates.length,
      acceptedCandidates: candidates.length,
      modelsDiscovered: new Set(
        candidates
          .filter((candidate) => candidate.taxonomy === 'MODEL' || candidate.taxonomy === 'VARIANT')
          .map((candidate) => key(candidate.model)),
      ).size,
      variantsResolved: candidates.filter(isResolvedOfficialVariant).length,
      observations: accepted,
      candidates,
      rejectedCandidates,
      rejectedExternalSources,
      researchMetadata: research.metadata,
    };
  }
}
