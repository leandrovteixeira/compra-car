import type {
  BrandConnector,
  BrandConnectorDefinition,
  BrandConnectorResearchInput,
  BrandConnectorResearchProvider,
} from './brand-connector-types';
import { connectorFingerprint } from './brand-connector-validation';
export const volkswagenConnectorFixture: BrandConnectorDefinition = {
  brand: 'Volkswagen',
  market: 'BR',
  allowedDomains: ['volkswagen.com.br'],
  sourceEntries: [
    { type: 'MODEL_INDEX', url: 'https://volkswagen.com.br/modelos', priority: 1 },
    { type: 'CONFIGURATOR', url: 'https://volkswagen.com.br/configurador', priority: 2 },
    { type: 'TECHNICAL_SHEET', url: 'https://volkswagen.com.br/fichas', priority: 3 },
  ],
  searchHints: ['modelos', 'versões', 'configurador', 'ficha técnica'],
  terminologyHints: ['TSI', 'eTSI'],
};
export function fixtureActiveConnector(definition = volkswagenConnectorFixture): BrandConnector {
  return {
    ...definition,
    id: '00000000-0000-4000-8000-000000000019',
    targetId: '00000000-0000-4000-8000-000000000020',
    version: 1,
    status: 'ACTIVE',
    fingerprint: connectorFingerprint(definition),
    sourceFindingId: null,
    activatedBy: null,
    activatedAt: '2026-09-14T00:00:00.000Z',
    supersededAt: null,
    createdAt: '2026-09-14T00:00:00.000Z',
  };
}
export class FixtureBrandConnectorResearchProvider implements BrandConnectorResearchProvider {
  constructor(private readonly drift = false) {}
  async researchConnector(input: BrandConnectorResearchInput) {
    const definition = input.activeConnector ?? volkswagenConnectorFixture;
    if (
      input.brand.toLowerCase() !== definition.brand.toLowerCase() ||
      input.market !== definition.market
    )
      throw new Error('CONNECTOR_FIXTURE_NOT_AVAILABLE');
    return {
      brand: definition.brand,
      market: definition.market,
      candidateDomains: definition.allowedDomains,
      sourceEntries: definition.sourceEntries,
      searchHints: this.drift
        ? [...definition.searchHints, 'nova navegação sintética']
        : definition.searchHints,
      terminologyHints: definition.terminologyHints,
      confidence: 0.9,
      warnings: [],
      evidence: definition.allowedDomains.map((d) => ({
        url: 'https://' + d + '/',
        title: 'Fixture sintética — não é descoberta real',
        excerpt: 'Sinal de oficialidade simulado exclusivamente para testes.',
      })),
      verificationSummary: 'Fixture sintética. Não comprova o estado atual das fontes.',
      checksPerformed: [
        'Oficialidade simulada',
        'Acessibilidade e relevância simuladas',
        'Cobertura e estrutura simuladas',
      ],
      driftDetected: this.drift,
    };
  }
}
