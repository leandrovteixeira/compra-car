import { createClient } from '@supabase/supabase-js';
import {
  AdministrativeProductCatalogReader,
  PlatformMmvDiscoveryReader,
  type AgentMarketScope,
} from '@compra-car/core/agents';
import { assertLegacyServerRuntime, type LegacySupabaseClientConfig } from './client';
import { AgentPlatformSupabaseAdapter } from './agent-platform-supabase-adapter';
import { BrandConnectorSupabaseAdapter } from './brand-connector-supabase-adapter';
import { LegacySupabaseAdapter } from './legacy-supabase-adapter';
/** Defence in depth: even reused adapters cannot send mutations or read extraction mappings. */
export function specSourceReadTransport(
  baseUrl: string,
  transport: typeof fetch = fetch,
): typeof fetch {
  const base = new URL(baseUrl);
  return async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const tables = [
      'products',
      'agent_runs',
      'agent_findings',
      'agent_evidence',
      'agent_reviews',
      'brand_connectors',
      'brand_connector_targets',
    ];
    if (
      url.origin !== base.origin ||
      !['GET', 'HEAD'].includes(method) ||
      !tables.some((table) => url.pathname === '/rest/v1/' + table)
    )
      throw new Error('SPEC_SOURCE_READ_ONLY_VIOLATION');
    return transport(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
  };
}
/** Exposes context reads only. Never returns the database client or a persistence port. */
export function createSpecSourceContext(config: LegacySupabaseClientConfig) {
  assertLegacyServerRuntime();
  if (!config.url.trim() || !config.serverKey.trim())
    throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
  const client = createClient(config.url, config.serverKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { fetch: specSourceReadTransport(config.url) },
  });
  const platform = new AgentPlatformSupabaseAdapter(client),
    connectors = new BrandConnectorSupabaseAdapter(client),
    catalog = new LegacySupabaseAdapter(client);
  return {
    async read(scope: AgentMarketScope, discoveryRunId?: string) {
      const connector = await connectors.getActiveConnector(scope.brand, scope.country);
      if (!connector || connector.status !== 'ACTIVE') throw new Error('ACTIVE_CONNECTOR_REQUIRED');
      let discovery;
      if (discoveryRunId) {
        const bundle = await platform.getRun(discoveryRunId);
        if (!bundle) throw new Error('DISCOVERY_RUN_NOT_FOUND');
        const findings = [];
        for (const item of bundle.findings)
          findings.push({ ...item, latestReview: await platform.getLatestReview(item.finding.id) });
        discovery = { run: bundle.run, findings };
      } else discovery = await new PlatformMmvDiscoveryReader(platform).latestCompleted(scope);
      const rows = await new AdministrativeProductCatalogReader({
        listOperatorMatchingProducts: () => catalog.listOperatorMatchingProducts(),
      }).readProducts(scope);
      return { connector, discovery, rows };
    },
  };
}
