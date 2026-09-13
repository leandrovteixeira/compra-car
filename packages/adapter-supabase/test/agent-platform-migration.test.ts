import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const sql = readFileSync(
  new URL(
    '../../../supabase/migrations/20260913220406_sprint_19b_agent_platform.sql',
    import.meta.url,
  ),
  'utf8',
);
describe('Agent Platform migration static validation', () => {
  it('creates exactly four operational tables with RLS and no browser policies', () => {
    expect(sql.match(/create table public\.agent_/gu)).toHaveLength(4);
    for (const table of ['agent_runs', 'agent_findings', 'agent_evidence', 'agent_reviews'])
      expect(sql).toContain('alter table public.' + table + ' enable row level security;');
    expect(sql).not.toMatch(/create policy/iu);
    expect(sql).toContain('from public, anon, authenticated, service_role');
  });
  it('defines cascading ownership and per-parent uniqueness without global finding uniqueness', () => {
    expect(sql.match(/on delete cascade/gu)).toHaveLength(3);
    expect(sql).toContain('unique(run_id, fingerprint)');
    expect(sql).toContain('unique(finding_id, evidence_fingerprint)');
    expect(sql).not.toMatch(/unique\s*\(fingerprint\)/iu);
  });
  it('uses text CHECK vocabularies and useful nonredundant indexes', () => {
    expect(sql).not.toMatch(/create type/iu);
    expect(sql).toContain(
      "'BRAND_CONNECTOR','MMV_DISCOVERY','PRODUCT_YEAR','SPEC_INTELLIGENCE','PRICE_INTELLIGENCE'",
    );
    expect(sql).toContain("'RUNNING','COMPLETED','FAILED','CANCELLED'");
    expect(sql).toContain("'ACCEPT','REJECT','DEFER'");
    for (const term of [
      'agent_type, created_at desc',
      'status, created_at desc',
      'agent_findings(finding_type)',
      'agent_findings(requires_review)',
      'agent_findings(created_at desc)',
      'agent_findings(fingerprint)',
      'finding_id, created_at desc, id desc',
    ])
      expect(sql).toContain(term);
  });
  it('grants insert/select only to review and observation tables; never grants canonical writes', () => {
    expect(sql).toContain(
      'grant select, insert on table public.agent_findings, public.agent_evidence, public.agent_reviews to service_role;',
    );
    expect(sql).not.toMatch(/grant[^;]*(delete|truncate)/iu);
    expect(sql).not.toMatch(
      /public\.(products|specs|product_specs|product_public_prices|commercial_)/iu,
    );
    expect(sql).not.toMatch(/insert into|update public|delete from/iu);
  });
});
