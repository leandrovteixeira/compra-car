import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AgentObject,
  assertAgentUuid,
} from '@compra-car/core/agent-platform';
import type {
  CanonicalMmv,
  CanonicalMmvRepository,
} from '@compra-car/core/agents';
import { assertLegacyServerRuntime } from './client';

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_MMV_ROW');
  return value;
}

function optionalText(row: Row, key: string): string | null {
  const value = row[key];
  return value === null || value === undefined
    ? null
    : typeof value === 'string'
      ? value
      : (() => {
          throw new Error('INVALID_MMV_ROW');
        })();
}

function canonicalMmv(row: Row): CanonicalMmv {
  const displacement = row.engine_displacement;
  const numeric =
    displacement === null || displacement === undefined
      ? null
      : typeof displacement === 'number'
        ? displacement
        : typeof displacement === 'string' && displacement.trim()
          ? Number(displacement)
          : NaN;
  if (numeric !== null && !Number.isFinite(numeric)) throw new Error('INVALID_MMV_ROW');
  const status = text(row, 'status');
  const visibility = text(row, 'visibility');
  if (!['ACTIVE', 'INACTIVE'].includes(status) || !['PRIVATE', 'PUBLIC'].includes(visibility))
    throw new Error('INVALID_MMV_ROW');
  return {
    id: text(row, 'id'),
    market: text(row, 'market'),
    identityKey: text(row, 'identity_key'),
    brand: text(row, 'brand'),
    model: text(row, 'model'),
    officialVersionLabel: text(row, 'official_version_label'),
    bodyStyle: optionalText(row, 'body_style'),
    powertrainLabel: optionalText(row, 'powertrain_label'),
    propulsion: optionalText(row, 'propulsion'),
    engineDisplacement: numeric,
    status: status as CanonicalMmv['status'],
    visibility: visibility as CanonicalMmv['visibility'],
    sourceFindingId: text(row, 'source_finding_id'),
    lastConfirmedFindingId: text(row, 'last_confirmed_finding_id'),
    createdBy: optionalText(row, 'created_by'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export class CanonicalMmvSupabaseAdapter implements CanonicalMmvRepository {
  constructor(private readonly client: SupabaseClient) {
    assertLegacyServerRuntime();
  }

  async applyAcceptedProposal(input: {
    readonly findingId: string;
    readonly actor: string;
    readonly proposal: AgentObject;
    readonly expectedFingerprint: string;
  }): Promise<readonly CanonicalMmv[]> {
    assertAgentUuid(input.findingId);
    assertAgentUuid(input.actor);
    if (
      input.proposal.action !== 'STAGE_MMV_IDENTITIES' ||
      typeof input.expectedFingerprint !== 'string' ||
      !input.expectedFingerprint.trim()
    )
      throw new Error('MMV_APPLY_INVALID_INPUT');

    const { data, error } = await this.client.rpc('apply_catalog_mmvs', {
      p_finding_id: input.findingId,
      p_actor: input.actor,
      p_proposal: input.proposal,
      p_expected_fingerprint: input.expectedFingerprint,
    });
    if (error || !Array.isArray(data)) throw new Error('MMV_APPLY_FAILED');
    return (data as unknown as Row[]).map(canonicalMmv);
  }
}
