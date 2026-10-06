import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentObject } from '@compra-car/core/agent-platform';
import { assertAgentUuid } from '@compra-car/core/agent-platform';
import type {
  CanonicalMmvModelYear,
  CanonicalMmvModelYearRepository,
  ModelYearStatus,
} from '@compra-car/core/agents';
import { assertLegacyServerRuntime } from './client';

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_MODEL_YEAR_ROW');
  return value;
}

function optionalText(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('INVALID_MODEL_YEAR_ROW');
  return value;
}

function integer(row: Row, key: string): number {
  const value = Number(row[key]);
  if (!Number.isInteger(value)) throw new Error('INVALID_MODEL_YEAR_ROW');
  return value;
}

function modelYear(row: Row): CanonicalMmvModelYear {
  const status = text(row, 'status');
  if (!['ACTIVE', 'LIKELY_ACTIVE', 'DISCONTINUED', 'UNKNOWN'].includes(status))
    throw new Error('INVALID_MODEL_YEAR_ROW');
  const confidenceRaw = row.confidence;
  const confidence =
    confidenceRaw === null || confidenceRaw === undefined ? null : Number(confidenceRaw);
  if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1))
    throw new Error('INVALID_MODEL_YEAR_ROW');
  return {
    id: text(row, 'id'),
    mmvId: text(row, 'mmv_id'),
    productionYear: integer(row, 'production_year'),
    modelYear: integer(row, 'model_year'),
    status: status as ModelYearStatus,
    confidence,
    sourceFindingId: text(row, 'source_finding_id'),
    lastConfirmedFindingId: text(row, 'last_confirmed_finding_id'),
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export class CanonicalModelYearSupabaseAdapter implements CanonicalMmvModelYearRepository {
  constructor(private readonly client: SupabaseClient) {
    assertLegacyServerRuntime();
  }

  async listModelYears(filters: {
    readonly mmvId?: string;
    readonly status?: ModelYearStatus;
  } = {}): Promise<readonly CanonicalMmvModelYear[]> {
    const rows: Row[] = [];
    for (;;) {
      let query = this.client
        .from('catalog_mmv_model_years')
        .select('*')
        .order('model_year', { ascending: false })
        .order('production_year', { ascending: false })
        .range(rows.length, rows.length + 499);
      if (filters.mmvId) query = query.eq('mmv_id', filters.mmvId);
      if (filters.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error || !data) throw new Error('MODEL_YEAR_CATALOG_READ_FAILED');
      if (!data.length) return rows.map(modelYear);
      rows.push(...(data as unknown as Row[]));
    }
  }

  async applyAcceptedProposal(input: {
    readonly findingId: string;
    readonly actor: string;
    readonly proposal: AgentObject;
    readonly expectedFingerprint: string;
  }): Promise<readonly CanonicalMmvModelYear[]> {
    assertAgentUuid(input.findingId);
    assertAgentUuid(input.actor);
    if (
      input.proposal.action !== 'STAGE_PRODUCT_YEAR' ||
      typeof input.expectedFingerprint !== 'string' ||
      !input.expectedFingerprint.trim()
    )
      throw new Error('MODEL_YEAR_APPLY_INVALID_INPUT');

    const { data, error } = await this.client.rpc('apply_catalog_mmv_model_year', {
      p_finding_id: input.findingId,
      p_actor: input.actor,
      p_proposal: input.proposal,
      p_expected_fingerprint: input.expectedFingerprint,
    });
    if (error || !Array.isArray(data)) throw new Error('MODEL_YEAR_APPLY_FAILED');
    return (data as unknown as Row[]).map(modelYear);
  }
}
