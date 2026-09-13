import type { SupabaseClient } from '@supabase/supabase-js';
import {
  StoredAgentPlatformRepository,
  AgentPlatformError,
  type AgentPlatformStore,
  type AgentRun,
  type AgentFinding,
  type AgentEvidence,
  type AgentReview,
} from '@compra-car/core/agent-platform';
import { assertLegacyServerRuntime } from './client';
const tables = {
  runs: 'agent_runs',
  findings: 'agent_findings',
  evidence: 'agent_evidence',
  reviews: 'agent_reviews',
} as const;
type Table = (typeof tables)[keyof typeof tables];
type Row = Record<string, unknown>;
// Only top-level operational columns are translated; JSON payload keys remain untouched.
function toRow(value: object): Row {
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key.replace(/[A-Z]/gu, (c) => '_' + c.toLowerCase()),
      v,
    ]),
  );
}
function fromRow<T>(row: Row): T {
  const entries = Object.entries(row).map(([key, value]) => {
    const name = key.replace(/_([a-z])/gu, (_, c: string) => c.toUpperCase());
    const normalized =
      key.endsWith('_at') && typeof value === 'string'
        ? new Date(value).toISOString()
        : key === 'confidence' && value !== null
          ? Number(value)
          : value;
    return [name, normalized];
  });
  return Object.fromEntries(entries) as T;
}
class SupabaseAgentPlatformStore implements AgentPlatformStore {
  constructor(private readonly client: SupabaseClient) {
    assertLegacyServerRuntime();
  }
  private async read<T>(table: Table, filters: Record<string, string> = {}): Promise<readonly T[]> {
    const rows: T[] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      let query = this.client
        .from(table)
        .select('*')
        .order('id', { ascending: true })
        .range(offset, offset + size - 1);
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      const { data, error } = await query;
      if (error || !data) throw new AgentPlatformError('PERSISTENCE_FAILED');
      rows.push(...data.map((row) => fromRow<T>(row as Row)));
      if (data.length < size) return rows;
    }
  }
  private async insert<T extends object>(
    table: Table,
    input: T,
    identity: Record<string, string>,
  ): Promise<T> {
    const { data, error } = await this.client.from(table).insert(toRow(input)).select('*').single();
    if (!error && data) return fromRow<T>(data as Row);
    if (error?.code === '23505') {
      const existing = (await this.read<T>(table, identity))[0];
      if (existing) return existing;
      throw new AgentPlatformError('CONTENT_CONFLICT');
    }
    throw new AgentPlatformError('PERSISTENCE_FAILED');
  }
  runs(id?: string) {
    return this.read<AgentRun>(tables.runs, id ? { id } : {});
  }
  findings(runId?: string, id?: string) {
    return this.read<AgentFinding>(tables.findings, {
      ...(runId ? { run_id: runId } : {}),
      ...(id ? { id } : {}),
    });
  }
  evidence(findingId: string) {
    return this.read<AgentEvidence>(tables.evidence, { finding_id: findingId });
  }
  reviews(findingId?: string) {
    return this.read<AgentReview>(tables.reviews, findingId ? { finding_id: findingId } : {});
  }
  insertRun(run: AgentRun) {
    return this.insert(tables.runs, run, { id: run.id });
  }
  async transitionRun(id: string, from: AgentRun['status'], patch: Partial<AgentRun>) {
    const { data, error } = await this.client
      .from(tables.runs)
      .update(toRow(patch))
      .eq('id', id)
      .eq('status', from)
      .select('id');
    if (error) throw new AgentPlatformError('PERSISTENCE_FAILED');
    return data?.length === 1;
  }
  insertFinding(finding: AgentFinding) {
    return this.insert(tables.findings, finding, {
      run_id: finding.runId,
      fingerprint: finding.fingerprint,
    });
  }
  insertEvidence(evidence: AgentEvidence) {
    return this.insert(tables.evidence, evidence, {
      finding_id: evidence.findingId,
      evidence_fingerprint: evidence.evidenceFingerprint,
    });
  }
  async insertReview(review: AgentReview) {
    // Always INSERT. Review decisions are independent events, including repeated decisions.
    const { data, error } = await this.client
      .from(tables.reviews)
      .insert(toRow(review))
      .select('*')
      .single();
    if (error || !data) throw new AgentPlatformError('PERSISTENCE_FAILED');
    return fromRow<AgentReview>(data as Row);
  }
}
export class AgentPlatformSupabaseAdapter extends StoredAgentPlatformRepository {
  constructor(client: SupabaseClient) {
    super(new SupabaseAgentPlatformStore(client));
  }
}
