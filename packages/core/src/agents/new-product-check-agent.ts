import { projectCatalogMmvIdentities } from './catalog-mmv-identity';
import type { BrandConnectorResolver } from './brand-connector-resolver';
import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import { officialBrandSource, officialEvidenceUrl } from './official-product-sources';
import { ProductCandidateMatcher, isResolvedOfficialVariant } from './product-candidate-matcher';
import { aggregateProductFindings } from './product-finding-aggregation';
import { deduplicateOfficialCandidates } from './official-product-candidate-deduplication';
import { isOfficialProductCandidate } from './official-product-candidate-validation';
import type {
  AgentMarketScope,
  OfficialProductCandidate,
  ProductEvidence,
  ProductResearchProvider,
  ProductCatalogReader,
  ReportWriter,
  NewProductCheckResult,
  RejectedProductCandidate,
} from './new-product-check-types';
export { isOfficialProductCandidate } from './official-product-candidate-validation';

export class NewProductCheckAgent {
  constructor(
    private readonly dependencies: {
      readonly research: ProductResearchProvider;
      readonly catalog: ProductCatalogReader;
      readonly reports: ReportWriter;
      readonly matcher?: ProductCandidateMatcher;
      readonly now?: () => Date;
      readonly connectorResolver?: BrandConnectorResolver;
    },
  ) {}
  async run(scope: AgentMarketScope, runId: string): Promise<NewProductCheckResult> {
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
    const catalog = (await this.dependencies.catalog.readProducts(normalizedScope)).filter(
      (p) => key(p.brand) === key(source.brand),
    );
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
      // Explicit projection strips provider fields; published labels are preserved verbatim.
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
    const identities = projectCatalogMmvIdentities(catalog);
    const candidates = deduplicateOfficialCandidates(normalizedScope, accepted);
    const matcher = this.dependencies.matcher ?? new ProductCandidateMatcher();
    const matches = candidates.map((candidate) =>
      matcher.matchIdentities(normalizedScope, candidate, identities),
    );
    const result: NewProductCheckResult = {
      schemaVersion: '19A.4',
      runId,
      startedAt,
      completedAt: now().toISOString(),
      brand: source.brand,
      market: source.country,
      researchedCandidates: research.candidates.length,
      acceptedCandidates: candidates.length,
      modelsDiscovered: new Set(
        candidates
          .filter((c) => c.taxonomy === 'MODEL' || c.taxonomy === 'VARIANT')
          .map((c) => key(c.model)),
      ).size,
      variantsResolved: candidates.filter(isResolvedOfficialVariant).length,
      knownProducts: catalog.length,
      canonicalProductRows: catalog.length,
      knownMmvIdentities: identities.length,
      matchedCandidates: matches.flatMap((m) => ('matched' in m ? [m.matched] : [])),
      findings: aggregateProductFindings(
        normalizedScope,
        matches.flatMap((m) => ('finding' in m ? [m.finding] : [])),
        accepted,
      ),
      rejectedCandidates,
      rejectedExternalSources,
      researchMetadata: research.metadata,
    };
    await this.dependencies.reports.write(result);
    return result;
  }
}
