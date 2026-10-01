import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { CanonicalMmvSupabaseAdapter } from '../src/canonical-mmv-supabase-adapter';

function setup() {
  const rpc = { args: null as Record<string, unknown> | null };
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.origin !== 'https://offline.invalid') throw Error('Network forbidden');
    if (url.pathname.endsWith('/rpc/apply_catalog_mmvs') && (init?.method ?? 'GET') === 'POST') {
      rpc.args = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const findingId = String(rpc.args.p_finding_id);
      return new Response(
        JSON.stringify([
          {
            id: randomUUID(),
            market: 'BR',
            identity_key: 'identity-key',
            brand: 'Jeep',
            model: 'Commander',
            official_version_label: 'Overland',
            body_style: null,
            powertrain_label: 'T270 MHEV',
            propulsion: 'MHEV',
            engine_displacement: '1.300',
            status: 'ACTIVE',
            visibility: 'PRIVATE',
            source_finding_id: findingId,
            last_confirmed_finding_id: findingId,
            created_by: String(rpc.args.p_actor),
            created_at: '2026-10-01T18:00:00Z',
            updated_at: '2026-10-01T18:00:00Z',
          },
        ]),
        { headers: { 'content-type': 'application/json' } },
      );
    }
    throw Error('Unexpected request');
  });
  return {
    rpc,
    repo: new CanonicalMmvSupabaseAdapter(
      createClient('https://offline.invalid', 'synthetic-key', {
        global: { fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    ),
  };
}

describe('Canonical MMV Supabase adapter', () => {
  it('calls only the transactional RPC and maps canonical rows', async () => {
    const { repo, rpc } = setup();
    const findingId = randomUUID();
    const actor = randomUUID();
    const proposal = {
      action: 'STAGE_MMV_IDENTITIES',
      market: 'BR',
      identities: [
        {
          identityKey: 'identity-key',
          brand: 'Jeep',
          model: 'Commander',
          officialVersionLabel: 'Overland',
        },
      ],
    } as const;
    const rows = await repo.applyAcceptedProposal({
      findingId,
      actor,
      proposal,
      expectedFingerprint: 'finding-fingerprint',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      brand: 'Jeep',
      model: 'Commander',
      officialVersionLabel: 'Overland',
      engineDisplacement: 1.3,
      visibility: 'PRIVATE',
    });
    expect(rpc.args).toMatchObject({
      p_finding_id: findingId,
      p_actor: actor,
      p_proposal: proposal,
      p_expected_fingerprint: 'finding-fingerprint',
    });
  });

  it('rejects a non-staging proposal before any RPC', async () => {
    const { repo, rpc } = setup();
    await expect(
      repo.applyAcceptedProposal({
        findingId: randomUUID(),
        actor: randomUUID(),
        proposal: { action: 'REVIEW_MODEL_BODY_SPLIT' },
        expectedFingerprint: 'x',
      }),
    ).rejects.toThrow('MMV_APPLY_INVALID_INPUT');
    expect(rpc.args).toBeNull();
  });
});

describe('20E canonical MMV migration safety', () => {
  const sql = readFileSync(
    new URL(
      '../../../supabase/migrations/20261001184015_sprint_20e_canonical_mmv_registry.sql',
      import.meta.url,
    ),
    'utf8',
  );

  it('is additive and leaves existing products unbackfilled', () => {
    expect(sql).toContain('create table public.catalog_mmvs');
    expect(sql).toContain('alter table public.products add column mmv_id uuid');
    expect(sql).toContain('foreign key (mmv_id) references public.catalog_mmvs(id)');
    expect(sql).not.toMatch(/update\s+public\.products/iu);
    expect(sql).not.toMatch(/insert\s+into\s+public\.products/iu);
    expect(sql).not.toMatch(/delete\s+from\s+public\.products/iu);
  });

  it('keeps the MMV registry server-only and apply transactional', () => {
    expect(sql).toContain('alter table public.catalog_mmvs enable row level security');
    expect(sql).toContain(
      'from public, anon, authenticated, service_role',
    );
    expect(sql).not.toMatch(/create policy/iu);
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("decision is distinct from 'ACCEPT'");
    expect(sql).toContain("'MMV_STALE_PROPOSAL'");
    expect(sql).not.toMatch(/security definer/iu);
  });
});
