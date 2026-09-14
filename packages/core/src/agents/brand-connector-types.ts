export const CONNECTOR_SOURCE_TYPES = [
  'MODEL_INDEX',
  'MODEL_PAGE',
  'CONFIGURATOR',
  'TECHNICAL_SHEET',
  'PRICE_LIST',
  'MEDIA_CENTER',
  'OTHER_OFFICIAL',
] as const;
export interface ConnectorSourceEntry {
  readonly type: (typeof CONNECTOR_SOURCE_TYPES)[number];
  readonly url: string;
  readonly priority: number;
  readonly notes?: string | null;
}
export interface BrandConnectorDefinition {
  readonly brand: string;
  readonly market: string;
  readonly allowedDomains: readonly string[];
  readonly sourceEntries: readonly ConnectorSourceEntry[];
  readonly searchHints: readonly string[];
  readonly terminologyHints: readonly string[];
}
export interface BrandConnectorTarget {
  readonly id: string;
  readonly brand: string;
  readonly brandKey: string;
  readonly market: string;
  readonly enabled: boolean;
  readonly origin: 'CATALOG' | 'MANUAL';
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface BrandConnector extends BrandConnectorDefinition {
  readonly id: string;
  readonly targetId: string;
  readonly version: number;
  readonly status: 'ACTIVE' | 'SUPERSEDED';
  readonly fingerprint: string;
  readonly sourceFindingId: string | null;
  readonly activatedBy: string | null;
  readonly activatedAt: string;
  readonly supersededAt: string | null;
  readonly createdAt: string;
}
export interface BrandConnectorRepository {
  listTargets(): Promise<readonly BrandConnectorTarget[]>;
  getTarget(brand: string, market: string): Promise<BrandConnectorTarget | null>;
  addManualTarget(brand: string, market: string, actor: string): Promise<BrandConnectorTarget>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  syncCatalogBrands(market?: string): Promise<{ added: number; existing: number }>;
  getActiveConnector(brand: string, market: string): Promise<BrandConnector | null>;
  listConnectorVersions(targetId: string): Promise<readonly BrandConnector[]>;
  listMissingConnectorTargets(): Promise<readonly BrandConnectorTarget[]>;
  /** Atomic review recheck, supersession and insertion; never expose standalone supersession. */
  activateConnector(findingId: string, actor: string): Promise<BrandConnector>;
}
export interface ConnectorEvidence {
  readonly url: string;
  readonly title: string;
  readonly excerpt: string;
}
export interface BrandConnectorResearch {
  /** Informational manufacturer label; never the operational target identity. */
  readonly observedBrandLabel: string;
  readonly market: string;
  readonly candidateDomains: readonly string[];
  readonly sourceEntries: readonly ConnectorSourceEntry[];
  readonly searchHints: readonly string[];
  readonly terminologyHints: readonly string[];
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly evidence: readonly ConnectorEvidence[];
  readonly verificationSummary: string;
  readonly checksPerformed: readonly string[];
  readonly driftDetected: boolean;
}
export interface BrandConnectorResearchInput {
  readonly brand: string;
  readonly market: string;
  readonly mode: 'discover' | 'health-check';
  readonly activeConnector?: BrandConnector;
}
export interface BrandConnectorResearchProvider {
  researchConnector(input: BrandConnectorResearchInput): Promise<BrandConnectorResearch>;
}
