import { officialBrandSource } from './official-product-sources';
import type { AgentMarketScope, OfficialBrandSource } from './new-product-check-types';
import { canonicalVehicleBrand, vehicleBrandAliases } from './vehicle-brand-normalization';
import type { BrandConnectorDefinition, BrandConnectorRepository } from './brand-connector-types';
import { connectorFingerprint, validateConnectorDefinition } from './brand-connector-validation';
export interface BrandConnectorResolver {
  resolve(scope: AgentMarketScope): Promise<OfficialBrandSource>;
  resolveAlternates?(scope: AgentMarketScope): Promise<readonly OfficialBrandSource[]>;
}
export class BuiltInBrandConnectorResolver implements BrandConnectorResolver {
  async resolve(scope: AgentMarketScope) {
    try {
      return officialBrandSource(scope);
    } catch {
      throw new Error('BRAND_CONNECTOR_REQUIRED');
    }
  }
}
export function connectorOfficialSource(input: BrandConnectorDefinition): OfficialBrandSource {
  const d = validateConnectorDefinition(input);
  if (d.market !== 'BR') throw new Error('UNSUPPORTED_MMV_MARKET');
  // Preserve the exact validated hostname policy while the active definition equals bootstrap data.
  const bootstrap = builtInConnectorDefinitions().find(
    (b) => connectorFingerprint(b) === connectorFingerprint(d),
  );
  if (bootstrap) return officialBrandSource({ country: 'BR', brand: bootstrap.brand });
  return {
    country: 'BR',
    brand: d.brand,
    allowedDomains: d.allowedDomains,
    allowedHosts: d.allowedDomains,
    allowedSubdomainRoots: d.allowedDomains,
    searchHints: [
      ...d.searchHints,
      ...d.sourceEntries.map((e) => e.type + ': ' + e.url),
      ...d.terminologyHints,
    ],
  };
}
export class OperationalBrandConnectorResolver implements BrandConnectorResolver {
  constructor(
    private readonly repository: Pick<BrandConnectorRepository, 'getActiveConnector'>,
    private readonly fallback?: BrandConnectorResolver,
  ) {}
  async resolve(scope: AgentMarketScope) {
    const sources = await this.resolveAlternates(scope);
    if (sources[0]) return sources[0];
    throw new Error('BRAND_CONNECTOR_REQUIRED');
  }

  async resolveAlternates(scope: AgentMarketScope) {
    const sources: OfficialBrandSource[] = [];
    for (const alias of vehicleBrandAliases(scope.brand)) {
      const active = await this.repository.getActiveConnector(alias, scope.country);
      if (active) sources.push(connectorOfficialSource(active));
    }
    if (!sources.length && this.fallback) {
      sources.push(await this.fallback.resolve({
        ...scope,
        brand: canonicalVehicleBrand(scope.brand),
      }));
    }
    return sources;
  }
}
/** Controlled bootstrap data preserves exactly the existing domains and hints. */
export function builtInConnectorDefinitions(): readonly BrandConnectorDefinition[] {
  return ['Toyota', 'Jeep'].map((brand) => {
    const source = officialBrandSource({ country: 'BR', brand });
    return {
      brand: source.brand,
      market: source.country,
      allowedDomains: source.allowedDomains,
      sourceEntries: [],
      searchHints: source.searchHints,
      terminologyHints: [],
    };
  });
}
