import { projectCatalogMmvIdentities, projectCanonicalMmvIdentities } from './catalog-mmv-identity';
import type { BrandConnectorResolver } from './brand-connector-resolver';
import { CurrentMmvDiscoveryAgent } from './current-mmv-discovery-agent';
import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import { sameVehicleBrand } from './vehicle-brand-normalization';
import { ProductCandidateMatcher } from './product-candidate-matcher';
import { aggregateProductFindings } from './product-finding-aggregation';
import type {
  AgentMarketScope,
  ProductResearchProvider,
  ProductCatalogReader,
  ReportWriter,
  NewProductCheckResult,
} from './new-product-check-types';
import type { CanonicalMmv } from './mmv-apply-contract';
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
      readonly canonicalMmvs?: () => Promise<readonly CanonicalMmv[]>;
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
      (product) => sameVehicleBrand(product.brand, discovery.brand),
    );
    const legacyIdentities = projectCatalogMmvIdentities(catalog);
    const canonicalIdentities = this.dependencies.canonicalMmvs
      ? projectCanonicalMmvIdentities(
          (await this.dependencies.canonicalMmvs()).filter(
            (mmv) => sameVehicleBrand(mmv.brand, discovery.brand) && mmv.status === 'ACTIVE',
          ),
        )
      : [];
    const byCore = new Map(
      legacyIdentities.map((identity) => [
        [identity.normalizedBrand, identity.normalizedModel, identity.normalizedVersion].join('|'),
        identity,
      ]),
    );
    for (const canonical of canonicalIdentities) {
      const core = [
        canonical.normalizedBrand,
        canonical.normalizedModel,
        canonical.normalizedVersion,
      ].join('|');
      const legacy = byCore.get(core);
      byCore.set(core, legacy ? { ...canonical, productRows: legacy.productRows } : canonical);
    }
    const identities = [...byCore.values()];
    const matcher = this.dependencies.matcher ?? new ProductCandidateMatcher();
    const matches = discovery.candidates.map((candidate) =>
      matcher.matchIdentities(normalizedScope, candidate, identities),
    );

    const completedAt = (this.dependencies.now ?? (() => new Date()))().toISOString();
    const result: NewProductCheckResult = {
      schemaVersion: '20E.1',
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
        discovery.observations,
      ),
      bodyModelProposals: discovery.bodyModelProposals,
      rejectedCandidates: discovery.rejectedCandidates,
      rejectedExternalSources: discovery.rejectedExternalSources,
      researchMetadata: discovery.researchMetadata,
    };

    await this.dependencies.reports.write(result);
    return result;
  }
}
