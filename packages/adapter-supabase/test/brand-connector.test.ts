import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { BrandConnectorSupabaseAdapter } from '../src/brand-connector-supabase-adapter';
import {
  builtInConnectorDefinitions,
  connectorFingerprint,
  brandKey,
  BrandConnectorAgent,
  FixtureBrandConnectorResearchProvider,
  fixtureActiveConnector,
} from '@compra-car/core/agents';
type Row = Record<string, unknown>;
function setup() {
  const tables: Record<string, Row[]> = {
    products: [
      { id: 1, brand: 'Toyota' },
      { id: 2, brand: 'TOYOTA' },
      { id: 3, brand: 'Jeep' },
      { id: 4, brand: ' Volkswagen ' },
      { id: 5, brand: 'BYD' },
    ],
    brand_connector_targets: [],
    brand_connectors: [],
    agent_runs: [],
    agent_findings: [],
    agent_evidence: [],
    agent_reviews: [],
  };
  const rpc = { result: null as Row | null, args: null as Row | null };
  const requests: { table: string; method: string }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.origin !== 'https://offline.invalid') throw Error('Network forbidden');
    const table = url.pathname.split('/').at(-1)!,
      method = init?.method ?? 'GET';
    requests.push({ table, method });
    const response = (data: unknown) =>
      new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    if (table === 'activate_brand_connector' && method === 'POST') {
      rpc.args = JSON.parse(String(init?.body)) as Row;
      return response(rpc.result);
    }
    const rows = tables[table];
    if (!rows || (table === 'products' && method !== 'GET'))
      throw Error('Canonical write forbidden');
    const matches = (r: Row) =>
      [...url.searchParams].every(([k, v]) => !v.startsWith('eq.') || String(r[k]) === v.slice(3));
    if (method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return response(rows.filter(matches).slice(offset, offset + 2));
    }
    const body = JSON.parse(String(init?.body)) as Row;
    if (method === 'POST') {
      if (rows.some((r) => r.market === body.market && r.brand_key === body.brand_key))
        return response([]);
      const row = {
        id: randomUUID(),
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...body,
      };
      rows.push(row);
      return response([row]);
    }
    if (method === 'PATCH') {
      const selected = rows.filter(matches);
      selected.forEach((r) => Object.assign(r, body));
      return response(selected);
    }
    throw Error('Unsupported operation');
  });
  return {
    tables,
    rpc,
    requests,
    repo: new BrandConnectorSupabaseAdapter(
      createClient('https://offline.invalid', 'synthetic-key', {
        global: { fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    ),
  };
}
describe('Brand target adapter, real SDK and offline transport', () => {
  it('rechecks review before RPC and passes the immutable proposal with server actor', async () => {
    const { repo, tables, rpc, requests } = setup(),
      actor = randomUUID();
    const target = await repo.addManualTarget('Volkswagen', 'BR', actor);
    const bundle = await new BrandConnectorAgent(new FixtureBrandConnectorResearchProvider()).run({
      brand: 'Volkswagen',
      market: 'BR',
      mode: 'discover',
    });
    const row = (value: object): Row =>
      Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k.replace(/[A-Z]/gu, (c) => '_' + c.toLowerCase()),
          v,
        ]),
      );
    tables.agent_runs!.push(row(bundle.run));
    tables.agent_findings!.push(row(bundle.findings[0]!.finding));
    await expect(repo.activateConnector(bundle.findings[0]!.finding.id, actor)).rejects.toThrow(
      'CONNECTOR_ACTIVATION_NOT_ALLOWED',
    );
    expect(rpc.args).toBeNull();
    tables.agent_reviews!.push({
      id: randomUUID(),
      finding_id: bundle.findings[0]!.finding.id,
      decision: 'ACCEPT',
      note: null,
      reviewed_by: actor,
      created_at: new Date().toISOString(),
    });
    rpc.result = row({ ...fixtureActiveConnector(), targetId: target.id });
    expect((await repo.activateConnector(bundle.findings[0]!.finding.id, actor)).version).toBe(1);
    expect(rpc.args).toMatchObject({
      p_actor: actor,
      p_target_id: target.id,
      p_proposal: bundle.findings[0]!.finding.proposal,
    });
    expect(
      requests
        .filter((r) => r.method !== 'GET')
        .every((r) => ['brand_connector_targets', 'activate_brand_connector'].includes(r.table)),
    ).toBe(true);
  });
  it('creates manual target, deduplicates normalized brand and separates market', async () => {
    const { repo, tables } = setup(),
      actor = randomUUID();
    const first = await repo.addManualTarget(' Volkswagen ', 'BR', actor);
    expect((await repo.addManualTarget('VOLKSWAGEN', 'br', actor)).id).toBe(first.id);
    await repo.addManualTarget('Volkswagen', 'US', actor);
    expect(tables.brand_connector_targets).toHaveLength(2);
    expect(first.origin).toBe('MANUAL');
  });
  it('sync paginates below configured request size, preserves paused manual targets and never writes catalog', async () => {
    const { repo, tables, requests } = setup(),
      products = structuredClone(tables.products);
    const manual = await repo.addManualTarget('Toyota', 'BR', randomUUID());
    await repo.setEnabled(manual.id, false);
    expect(await repo.syncCatalogBrands()).toEqual({ added: 3, existing: 1 });
    expect(await repo.syncCatalogBrands()).toEqual({ added: 0, existing: 4 });
    expect(await repo.getTarget('Toyota', 'BR')).toMatchObject({
      origin: 'MANUAL',
      enabled: false,
    });
    expect(await repo.listTargets()).toHaveLength(4);
    expect(await repo.listMissingConnectorTargets()).toHaveLength(3);
    await repo.setEnabled(manual.id, true);
    expect(await repo.listMissingConnectorTargets()).toHaveLength(4);
    expect(tables.products).toEqual(products);
    expect(requests.filter((r) => r.table === 'products').every((r) => r.method === 'GET')).toBe(
      true,
    );
  });
});
describe('19C migration structural safety', () => {
  const sql = readFileSync(
    new URL(
      '../../../supabase/migrations/20260914172157_sprint_19c_brand_connectors.sql',
      import.meta.url,
    ),
    'utf8',
  );
  it('bootstrap exactly matches validated built-ins and their deterministic fingerprints', () => {
    const match = sql.match(/\$definitions\$(.*?)\$definitions\$/su);
    expect(JSON.parse(match![1]!)).toEqual(
      builtInConnectorDefinitions().map((d) => ({
        ...d,
        brandKey: brandKey(d.brand),
        fingerprint: connectorFingerprint(d),
      })),
    );
  });
  it('uses RLS without browser grants or policies, and one active version', () => {
    expect(sql.match(/create table public\.brand_/gu)).toHaveLength(2);
    expect(sql.match(/enable row level security/gu)).toHaveLength(2);
    expect(sql).not.toMatch(/create policy/iu);
    expect(sql).toContain("where status = 'ACTIVE'");
    expect(sql).toContain('unique (target_id, version)');
    expect(sql).toContain('from public, anon, authenticated, service_role');
  });
  it('serializes target activation and latest review; preserves catalog and immutable history', () => {
    expect(sql).toContain('for update');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("decision is distinct from 'ACCEPT'");
    expect(sql).toContain('current_connector.fingerprint = p_fingerprint');
    expect(sql).not.toMatch(
      /(?:update|insert into|delete from) public\.(products|specs|prices)\b/iu,
    );
    expect(sql).not.toMatch(/security definer|grant[^;]*(delete|truncate)/iu);
  });
});
