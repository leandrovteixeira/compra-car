import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createWatcherArticleObservation } from '@compra-car/core/agents';
import { WatcherSupabaseAdapter, type WatcherRpcClient } from '../src/watcher-supabase-adapter';

const sql = readFileSync(
  new URL(
    '../../../supabase/migrations/20261025220427_sprint_24a3a_watcher_transactions.sql',
    import.meta.url,
  ),
  'utf8',
);
const id = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-25T12:00:00.000Z';
const source = {
  id: 'rss',
  feedUrl: 'https://auto.example.br/rss',
  editorialMarket: 'BR' as const,
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};
const settings = {
  requestUrl: source.feedUrl,
  allowedHosts: ['auto.example.br'],
  allowedArticleHosts: ['auto.example.br'],
  allowRelativeUrls: false,
  pollIntervalSeconds: 3600,
};
const candidate = {
  id,
  brand: 'Ford',
  modelHint: 'Puma',
  projectCode: null,
  aliases: [],
  status: 'EXPECTED_BR' as const,
};
const observation = createWatcherArticleObservation(
  {
    sourceId: 'rss',
    guid: 'one',
    url: 'https://auto.example.br/a',
    title: 'Article',
    excerpt: null,
    publishedAt: null,
    updatedAt: null,
  },
  at,
);
const persist = {
  batchId: id,
  lease: {
    sourceId: 'rss',
    token: id,
    owner: 'worker',
    expiresAt: '2026-10-25T12:01:00.000Z',
    configVersion: 2,
    stateVersion: 3,
  },
  batch: {
    schemaVersion: 'watcher-ingestion/1' as const,
    sourceId: 'rss',
    observedAt: at,
    observations: [observation],
    failures: [],
  },
  checkpoint: { sourceId: 'rss', etag: null, lastModified: null, lastSuccessfulObservedAt: at },
  advanceCheckpoint: true,
  checkpointBlockedReason: null,
  diagnostics: [],
};
function probe() {
  // All writes in this suite are mocks; no table capability or network transport exists.
  const rpc = vi.fn<WatcherRpcClient['rpc']>(async () => ({
    data: null,
    error: { code: 'P0001', message: 'WATCHER_NOT_FOUND' },
  }));
  return { rpc, adapter: new WatcherSupabaseAdapter({ rpc }) };
}
type Operation = (adapter: WatcherSupabaseAdapter) => Promise<unknown>;
const mutations: [string, string[], Operation][] = [
  [
    'watcher_register_source',
    ['p_source:jsonb', 'p_settings:jsonb', 'p_expected_version:bigint'],
    (a) => a.registerSource(source, settings, 2),
  ],
  [
    'watcher_claim_source',
    ['p_source_id:text', 'p_owner:text', 'p_ttl_seconds:integer'],
    (a) => a.claimLease('rss', 'worker', 60),
  ],
  [
    'watcher_release_source',
    ['p_source_id:text', 'p_token:uuid', 'p_failure_code:text'],
    (a) => a.releaseLease('rss', id, 'TIMEOUT'),
  ],
  [
    'watcher_persist_batch',
    [
      'p_batch_id:uuid',
      'p_token:uuid',
      'p_config_version:bigint',
      'p_state_version:bigint',
      'p_payload:jsonb',
    ],
    (a) => a.persistBatch(persist),
  ],
  [
    'watcher_stage_candidate',
    ['p_candidate:jsonb', 'p_expected_version:bigint'],
    (a) => a.stageCandidate(candidate, 2),
  ],
  [
    'watcher_attach_evidence',
    ['p_evidence:jsonb'],
    (a) =>
      a.attachCandidateEvidence({
        candidateId: id,
        candidateVersion: 2,
        revisionId: id,
        assertion: 'BR_CONFIRMED',
        actorId: id,
        note: 'Reviewed Brazil evidence',
      }),
  ],
  [
    'watcher_prepare_hint',
    ['p_candidate_id:uuid', 'p_evidence_id:uuid', 'p_expected_version:bigint'],
    (a) => a.prepareHint(id, id, 2),
  ],
  [
    'watcher_query',
    ['p_kind:text', 'p_filter:text', 'p_limit:integer', 'p_offset:integer'],
    (a) => a.listSources(),
  ],
];

describe('Watcher runtime RPC contracts against approved SQL', () => {
  it.each(mutations)(
    'matches names/types and sends exactly one RPC for %s',
    async (name, signature, operation) => {
      const declaration = sql.match(
        new RegExp(
          'create function public\\.' + name + '\\(([^)]*)\\) returns ([^\\n]+)\\n([^$]+)',
        ),
      );
      expect(declaration).not.toBeNull();
      const parameters = declaration![1]
        .split(',')
        .map((p) => p.trim().split(/\s+/u).slice(0, 2).join(':'));
      expect(parameters).toEqual(signature);
      expect(declaration![3]).toContain('security invoker');
      const { rpc, adapter } = probe();
      await expect(operation(adapter)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc.mock.calls[0][0]).toBe(name);
      expect(Object.keys(rpc.mock.calls[0][1]).sort()).toEqual(
        signature.map((p) => p.split(':')[0]).sort(),
      );
    },
  );
  it('carries source/candidate CAS versions and lease fencing into the transaction', async () => {
    const { rpc, adapter } = probe();
    await expect(adapter.registerSource(source, settings, 2)).rejects.toThrow();
    expect(rpc.mock.calls[0][1].p_expected_version).toBe(2);
    await expect(adapter.stageCandidate(candidate, 2)).rejects.toThrow();
    expect(rpc.mock.calls[1][1].p_expected_version).toBe(2);
    await expect(adapter.persistBatch(persist)).rejects.toThrow();
    expect(rpc.mock.calls[2][1]).toMatchObject({
      p_batch_id: id,
      p_token: id,
      p_config_version: 2,
      p_state_version: 3,
    });
    await expect(
      adapter.attachCandidateEvidence({
        candidateId: id,
        candidateVersion: 2,
        revisionId: id,
        assertion: 'BR_CONFIRMED',
        actorId: id,
        note: 'Reviewed Brazil evidence',
      }),
    ).rejects.toThrow();
    expect(rpc.mock.calls[3][1].p_evidence).toMatchObject({ candidateVersion: 2, revisionId: id });
  });
  it('keeps byte-identical retry payloads and sends no direct table write', async () => {
    const { rpc, adapter } = probe();
    await expect(adapter.persistBatch(persist)).rejects.toThrow();
    await expect(adapter.persistBatch(persist)).rejects.toThrow();
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls.every(([name]) => name === 'watcher_persist_batch')).toBe(true);
  });
  it('isolates source query filters and returns empty/null reads without inventing state', async () => {
    const rpc = vi.fn<WatcherRpcClient['rpc']>(async () => ({
      data: [],
      error: null,
    }));
    const adapter = new WatcherSupabaseAdapter({ rpc });
    expect(await adapter.listSourceItems('source-a')).toEqual([]);
    expect(await adapter.listSourceItems('source-b')).toEqual([]);
    expect(rpc.mock.calls.map(([, args]) => args.p_filter)).toEqual(['source-a', 'source-b']);
    expect(await adapter.getSourceState('missing')).toBeNull();
    expect(await adapter.listCandidates()).toEqual([]);
    expect(await adapter.listCandidateEvidence(id)).toEqual([]);
  });
  it('rejects cross-source batches and unsafe optimistic versions before RPC', () => {
    const { rpc, adapter } = probe();
    expect(() =>
      adapter.persistBatch({ ...persist, lease: { ...persist.lease, sourceId: 'other' } }),
    ).toThrow();
    expect(() => adapter.registerSource(source, settings, Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => adapter.prepareHint(id, id, 0)).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
