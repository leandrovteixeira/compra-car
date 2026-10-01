import { projectCatalogMmvIdentities } from './catalog-mmv-identity';
import type { BrandConnectorResolver } from './brand-connector-resolver';
import { CurrentMmvDiscoveryAgent } from './current-mmv-discovery-agent';
import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import { ProductCandidateMatcher } from './product-candidate-matcher';
import { aggregateProductFindings } from './product-finding-aggregation';
import type {
  AgentMarketScope,
  ProductResearchProvider,
  ProductCatalogReader,
  ReportWriter,
  NewProductCheckResult,
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
    const discovery = await new CurrentMmvDiscoveryAgent({
      research: this.dependencies.research,
      now: this.dependencies.now,
      connectorResolver: this.dependencies.connectorResolver,
    }).run(scope, runId);

    const normalizedScope: AgentMarketScope = {
      country: discovery.market,
      brand: discovery.brand,
    };
    const catalog = (await this.dependencies.catalog.readProducts(normalizedScope)).filter(
      (product) => key(product.brand) === key(discovery.brand),
    );
    const identities = projectCatalogMmvIdentities(catalog);
    const matcher = this.dependencies.matcher ?? new ProductCandidateMatcher();
    const matches = discovery.candidates.map((candidate) =>
      matcher.matchIdentities(normalizedScope, candidate, identities),
    );

    const completedAt = (this.dependencies.now ?? (() => new Date()))().toISOString();
    const result: NewProductCheckResult = {
      schemaVersion: '19A.4',
      runId: discovery.runId,
      startedAt: discovery.startedAt,
      completedAt,
      brand: discovery.brand,
      market: discovery.market,
      researchedCandidates: discovery.researchedCandidates,
      acceptedCandidates: discovery.acceptedCandidates,
      modelsDiscovered: discovery.modelsDiscovered,
      variantsResolved: discovery.variantsResolved,
      knownProducts: catalog.length,
      canonicalProductRows: catalog.length,
      knownMmvIdentities: identities.length,
      matchedCandidates: matches.flatMap((match) => ('matched' in match ? [match.matched] : [])),
      findings: aggregateProductFindings(
        normalizedScope,
        matches.flatMap((match) => ('finding' in match ? [match.finding] : [])),
        discovery.candidates,
      ),
      rejectedCandidates: discovery.rejectedCandidates,
      rejectedExternalSources: discovery.rejectedExternalSources,
      researchMetadata: discovery.researchMetadata,
    };

    await this.dependencies.reports.write(result);
    return result;
  }
}
