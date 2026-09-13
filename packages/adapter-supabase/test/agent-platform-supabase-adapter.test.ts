import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, vi } from 'vitest';
import { AgentPlatformSupabaseAdapter } from '../src/agent-platform-supabase-adapter';
import { agentPlatformFixture, platformFixtureId } from '@compra-car/core/agent-platform/testing';
type Row = Record<string, unknown>;
function setup() {
  const tables: Record<string, Row[]> = {
    agent_runs: [],
    agent_findings: [],
    agent_evidence: [],
    agent_reviews: [],
  };
  const requests: { table: string; method: string; body: Row | null }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.origin !== 'https://offline.invalid') throw Error('Unexpected network host');
    const table = url.pathname.split('/').at(-1)!,
      method = init?.method ?? 'GET',
      headers = new Headers(init?.headers);
    if (!Object.hasOwn(tables, table))
      throw Error('Canonical or unknown table forbidden: ' + table);
    const rows = tables[table]!,
      body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Row) : null;
    requests.push({ table, method, body });
    const matches = (row: Row) =>
      [...url.searchParams.entries()].every(
        ([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3),
      );
    const response = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0),
        limit = Number(url.searchParams.get('limit') ?? 500);
      return response(
        rows
          .filter(matches)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .slice(offset, offset + limit),
      );
    }
    if (method === 'POST' && body) {
      const duplicate = rows.some(
        (row) =>
          row.id === body.id ||
          (table === 'agent_findings' &&
            row.run_id === body.run_id &&
            row.fingerprint === body.fingerprint) ||
          (table === 'agent_evidence' &&
            row.finding_id === body.finding_id &&
            row.evidence_fingerprint === body.evidence_fingerprint),
      );
      if (duplicate) return response({ code: '23505', message: 'duplicate' }, 409);
      rows.push(structuredClone(body));
      return response(headers.get('accept')?.includes('object') ? body : [body], 201);
    }
    if (method === 'PATCH' && body) {
      if (table !== 'agent_runs') throw Error('Only run transitions can update');
      const selected = rows.filter(matches);
      for (const row of selected) Object.assign(row, body);
      return response(selected);
    }
    throw Error('Unexpected operation');
  });
  const client = createClient('https://offline.invalid', 'synthetic-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  return {
    repo: new AgentPlatformSupabaseAdapter(client),
    tables,
    requests,
    fetch,
    ...agentPlatformFixture(),
  };
}
describe('Agent Platform Supabase adapter with real SDK and mocked HTTP', () => {
  it('persists, reloads and retries a complete bundle without duplicate operational rows', async () => {
    const { repo, tables, bundle, requests } = setup();
    await repo.persistRunBundle(bundle);
    await repo.persistRunBundle(bundle);
    expect(tables.agent_runs).toHaveLength(1);
    expect(tables.agent_findings).toHaveLength(7);
    expect(tables.agent_evidence).toHaveLength(7);
    expect(tables.agent_reviews).toHaveLength(0);
    expect((await repo.getRun(bundle.run.id))!.run.status).toBe('COMPLETED');
    expect(requests.filter((r) => r.method === 'PATCH').at(-1)?.body?.status).toBe('COMPLETED');
  });
  it('handles duplicate finding/evidence keys using INSERT plus existing-row read, without UPDATE', async () => {
    const { repo, bundle, tables } = setup();
    await repo.createRun({ ...bundle.run, status: 'RUNNING', completedAt: null });
    const item = bundle.findings[0]!;
    const first = await repo.persistFinding(item.finding);
    const second = await repo.persistFinding({ ...item.finding, id: platformFixtureId(200) });
    expect(first.id).toBe(second.id);
    await repo.persistEvidence(item.evidence[0]!);
    await repo.persistEvidence({ ...item.evidence[0]!, id: platformFixtureId(201) });
    expect(tables.agent_findings).toHaveLength(1);
    expect(tables.agent_evidence).toHaveLength(1);
  });
  it.each(['ACCEPT', 'REJECT', 'DEFER'] as const)(
    'appends %s reviews and exposes history, queue filters and counts',
    async (decision) => {
      const { repo, bundle, tables, requests } = setup();
      await repo.persistRunBundle(bundle);
      const review = {
        findingId: bundle.findings[1]!.finding.id,
        decision,
        note: 'test',
        reviewedBy: platformFixtureId(100),
      };
      await repo.addReview(review);
      await repo.addReview(review);
      expect(tables.agent_reviews).toHaveLength(2);
      expect((await repo.getFinding(review.findingId))!.reviews).toHaveLength(2);
      expect((await repo.listFindings({ review: decision })).total).toBe(1);
      expect((await repo.listFindings({ review: 'OPEN' })).total).toBe(5);
      expect((await repo.listRuns()).items[0]!.counts.total).toBe(7);
      expect(
        requests
          .filter((r) => r.method !== 'GET')
          .every((r) =>
            ['agent_runs', 'agent_findings', 'agent_evidence', 'agent_reviews'].includes(r.table),
          ),
      ).toBe(true);
    },
  );
  it('marks FAILED on evidence transport failure and resumes safely', async () => {
    const { repo, bundle, fetch, tables } = setup();
    const base = fetch.getMockImplementation()!;
    let fail = true;
    fetch.mockImplementation(async (input, init) => {
      if (fail && String(input).includes('agent_evidence') && init?.method === 'POST') {
        fail = false;
        return new Response(
          JSON.stringify({ code: 'XX000', message: 'private database details' }),
          { status: 500 },
        );
      }
      return base(input, init);
    });
    await expect(repo.persistRunBundle(bundle)).rejects.toThrow('PERSISTENCE_FAILED');
    expect(tables.agent_runs![0]!.status).toBe('FAILED');
    await repo.persistRunBundle(bundle);
    expect(tables.agent_runs![0]!.status).toBe('COMPLETED');
    expect(tables.agent_evidence).toHaveLength(7);
  });
  it('paginates reads beyond the REST row limit before computing totals', async () => {
    const { repo, bundle, tables } = setup();
    await repo.persistRunBundle(bundle);
    const template = tables.agent_findings![0]!;
    for (let i = 0; i < 510; i++)
      tables.agent_findings!.push({
        ...template,
        id: platformFixtureId(1000 + i),
        fingerprint: 'extra-' + i,
      });
    const result = await repo.listFindings({ review: 'ALL', offset: 500, limit: 25 });
    expect(result.total).toBe(517);
    expect(result.items).toHaveLength(17);
  });
  it('rejects changed completed bundles without any write request', async () => {
    const { repo, bundle, requests } = setup();
    await repo.persistRunBundle(bundle);
    const writes = requests.filter((r) => r.method !== 'GET').length;
    await expect(repo.persistRunBundle({ ...bundle, findings: [] })).rejects.toThrow(
      'CONTENT_CONFLICT',
    );
    expect(requests.filter((r) => r.method !== 'GET')).toHaveLength(writes);
  });
  it('maps numeric confidence strings and preserves nested JSON keys', async () => {
    const { repo, bundle, tables } = setup();
    await repo.persistRunBundle(bundle);
    tables.agent_findings![0]!.confidence = '0.8';
    tables.agent_findings![0]!.payload = { some_key: { keep_this: true } };
    const detail = await repo.getFinding(bundle.findings[0]!.finding.id);
    expect(detail?.finding.confidence).toBe(0.8);
    expect(detail?.finding.payload).toEqual({ some_key: { keep_this: true } });
  });
  it('sanitizes query errors without exposing backend details', async () => {
    const { repo, fetch } = setup();
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'synthetic-private-error' }), { status: 500 }),
    );
    await expect(repo.listRuns()).rejects.toThrow('PERSISTENCE_FAILED');
  });
});
