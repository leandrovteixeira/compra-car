import type { SupabaseClient } from '@supabase/supabase-js';
import {
  acceptedConnectorProposal,
  brandKey,
  connectorText,
  connectorMarket,
  connectorFingerprint,
  validateConnectorDefinition,
  type BrandConnector,
  type BrandConnectorRepository,
  type BrandConnectorTarget,
} from '@compra-car/core/agents';
import { assertAgentUuid } from '@compra-car/core/agent-platform';
import { assertLegacyServerRuntime } from './client';
import { AgentPlatformSupabaseAdapter } from './agent-platform-supabase-adapter';
type Row = Record<string, unknown>;
function fromRow<T>(row: Row): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/gu, (_, c: string) => c.toUpperCase()),
      v,
    ]),
  ) as T;
}
export class BrandConnectorSupabaseAdapter implements BrandConnectorRepository {
  constructor(private readonly client: SupabaseClient) {
    assertLegacyServerRuntime();
  }
  private async read(
    table: string,
    filters: Record<string, string> = {},
    columns = '*',
  ): Promise<Row[]> {
    const rows: Row[] = [];
    // Advance by actual received rows and terminate on an empty page, even if Max Rows < 500.
    for (;;) {
      let query = this.client
        .from(table)
        .select(columns)
        .order('id', { ascending: true })
        .range(rows.length, rows.length + 499);
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      const { data, error } = await query;
      if (error || !data) throw new Error('CONNECTOR_READ_FAILED');
      if (!data.length) return rows;
      rows.push(...(data as unknown as Row[]));
    }
  }
  async listTargets() {
    return (await this.read('brand_connector_targets')).map((r) =>
      fromRow<BrandConnectorTarget>(r),
    );
  }
  async getTarget(brand: string, market: string) {
    const rows = await this.read('brand_connector_targets', {
      brand_key: brandKey(brand),
      market: connectorMarket(market),
    });
    return rows[0] ? fromRow<BrandConnectorTarget>(rows[0]) : null;
  }
  private async insertTarget(
    brand: string,
    market: string,
    origin: 'MANUAL' | 'CATALOG',
    actor: string | null,
  ) {
    const { data, error } = await this.client
      .from('brand_connector_targets')
      .upsert(
        {
          brand: connectorText(brand, 100),
          brand_key: brandKey(brand),
          market: connectorMarket(market),
          origin,
          created_by: actor,
        },
        { onConflict: 'market,brand_key', ignoreDuplicates: true },
      )
      .select('*');
    if (error || !data) throw new Error('CONNECTOR_TARGET_WRITE_FAILED');
    return data.length > 0;
  }
  async addManualTarget(brand: string, market: string, actor: string) {
    assertAgentUuid(actor);
    await this.insertTarget(brand, market, 'MANUAL', actor);
    const target = await this.getTarget(brand, market);
    if (!target) throw new Error('CONNECTOR_TARGET_WRITE_FAILED');
    return target;
  }
  async setEnabled(id: string, enabled: boolean) {
    assertAgentUuid(id);
    if (typeof enabled !== 'boolean') throw new Error('INVALID_CONNECTOR_TARGET');
    const { data, error } = await this.client
      .from('brand_connector_targets')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id');
    if (error || data?.length !== 1) throw new Error('CONNECTOR_TARGET_WRITE_FAILED');
  }
  async syncCatalogBrands(market = 'BR') {
    connectorMarket(market);
    const rows = await this.read('products', {}, 'id,brand');
    const brands = new Map<string, string>();
    for (const row of rows)
      if (typeof row.brand === 'string' && row.brand.trim())
        brands.set(brandKey(row.brand), row.brand);
    let added = 0;
    for (const brand of brands.values())
      if (await this.insertTarget(brand, market, 'CATALOG', null)) added++;
    return { added, existing: brands.size - added };
  }
  async listConnectorVersions(targetId: string): Promise<readonly BrandConnector[]> {
    assertAgentUuid(targetId);
    const targets = await this.read('brand_connector_targets', { id: targetId });
    if (!targets[0]) return [];
    return (await this.read('brand_connectors', { target_id: targetId }))
      .map((r) => {
        const connector = fromRow<BrandConnector>(r);
        const definition = validateConnectorDefinition({
          ...connector,
          brand: targets[0]!.brand,
          market: targets[0]!.market,
        });
        if (connectorFingerprint(definition) !== connector.fingerprint)
          throw new Error('CONNECTOR_FINGERPRINT_MISMATCH');
        return { ...connector, ...definition };
      })
      .sort((a, b) => b.version - a.version);
  }
  async getActiveConnector(brand: string, market: string) {
    const target = await this.getTarget(brand, market);
    return target
      ? ((await this.listConnectorVersions(target.id)).find((c) => c.status === 'ACTIVE') ?? null)
      : null;
  }
  async listMissingConnectorTargets() {
    const result: BrandConnectorTarget[] = [];
    for (const target of await this.listTargets())
      if (target.enabled && !(await this.getActiveConnector(target.brand, target.market)))
        result.push(target);
    return result;
  }
  async activateConnector(findingId: string, actor: string): Promise<BrandConnector> {
    assertAgentUuid(findingId);
    assertAgentUuid(actor);
    const detail = await new AgentPlatformSupabaseAdapter(this.client).getFinding(findingId);
    if (!detail) throw new Error('CONNECTOR_FINDING_REQUIRED');
    const proposal = acceptedConnectorProposal(detail),
      target = await this.getTarget(proposal.brand, proposal.market);
    if (!target) throw new Error('CONNECTOR_TARGET_REQUIRED');
    const { data, error } = await this.client.rpc('activate_brand_connector', {
      p_finding_id: findingId,
      p_actor: actor,
      p_target_id: target.id,
      p_proposal: detail.finding.proposal,
      p_fingerprint: connectorFingerprint(proposal),
    });
    if (error || !data) throw new Error('CONNECTOR_ACTIVATION_FAILED');
    return { ...fromRow<BrandConnector>(data as Row), ...proposal };
  }
}
