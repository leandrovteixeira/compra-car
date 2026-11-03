import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { WatcherSupabaseAdapter, type WatcherRpcClient } from '../src/watcher-supabase-adapter';
import { createWatcherArticleObservation, validateWatcherCandidate } from '@compra-car/core/agents';
const id = '11111111-1111-4111-8111-111111111111',
  id2 = '22222222-2222-4222-8222-222222222222';
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
const sourceRow = {
  id: source.id,
  definition: source,
  settings,
  config_version: 1,
  created_at: at,
  updated_at: at,
};
const lease = {
  sourceId: source.id,
  token: id,
  owner: 'worker',
  expiresAt: '2026-10-25T12:01:00.000Z',
  configVersion: 1,
  stateVersion: 0,
};
const observation = createWatcherArticleObservation(
  {
    sourceId: source.id,
    guid: 'guid',
    url: 'https://auto.example.br/a',
    title: 'Article',
    excerpt: null,
    publishedAt: null,
    updatedAt: null,
  },
  at,
);
const persist = {
  batchId: id2,
  lease,
  batch: {
    schemaVersion: 'watcher-ingestion/1' as const,
    sourceId: source.id,
    observedAt: at,
    observations: [observation],
    failures: [],
  },
  checkpoint: { sourceId: source.id, etag: 'v1', lastModified: null, lastSuccessfulObservedAt: at },
  advanceCheckpoint: true,
  checkpointBlockedReason: null,
  diagnostics: [],
};
const candidate = {
  id,
  brand: 'Ford',
  modelHint: 'Puma',
  projectCode: null,
  aliases: [],
  status: 'EXPECTED_BR' as const,
};
function setup(data: unknown, error: unknown = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { rpc, adapter: new WatcherSupabaseAdapter({ rpc }) };
}
describe('Watcher Supabase capability adapter', () => {
  it('registers canonical bounded configuration through one RPC, no table writes', async () => {
    const { adapter, rpc } = setup(sourceRow);
    expect(await adapter.registerSource(source, settings)).toMatchObject({
      source,
      settings,
      configVersion: 1,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('watcher_register_source', {
      p_source: source,
      p_settings: settings,
      p_expected_version: null,
    });
  });
  it('uses Supabase SDK with injected HTTP and no external network', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://offline.invalid/rest/v1/rpc/watcher_register_source');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string).p_source).toEqual(source);
      return new Response(JSON.stringify(sourceRow), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = createClient('https://offline.invalid', 'fixture-not-a-secret', {
      global: { fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    expect(
      (await new WatcherSupabaseAdapter(client).registerSource(source, settings)).configVersion,
    ).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('maps claim/null and boolean release without assuming local ownership', async () => {
    const { adapter, rpc } = setup({
      source_id: 'rss',
      token: id,
      owner: 'worker',
      expires_at: lease.expiresAt,
      config_version: 1,
      state_version: 0,
    });
    expect(await adapter.claimLease('rss', 'worker')).toEqual(lease);
    expect(rpc).toHaveBeenCalledWith('watcher_claim_source', {
      p_source_id: 'rss',
      p_owner: 'worker',
      p_ttl_seconds: 60,
    });
    expect(await setup(null).adapter.claimLease('rss', 'worker')).toBeNull();
    expect(await setup(false).adapter.releaseLease('rss', id)).toBe(false);
  });
  it('commits normalized observations and checkpoints with one atomic RPC', async () => {
    const { adapter, rpc } = setup({
      batch_id: id2,
      source_id: 'rss',
      status: 'COMMITTED',
      state_version: 1,
      checkpoint_advanced: true,
      replayed: false,
    });
    expect(await adapter.persistBatch(persist)).toMatchObject({
      batchId: id2,
      stateVersion: 1,
      checkpointAdvanced: true,
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(name).toBe('watcher_persist_batch');
    expect(args.p_token).toBe(id);
    expect(args.p_state_version).toBe(0);
    expect(args.p_payload).toEqual({
      batch: persist.batch,
      checkpoint: persist.checkpoint,
      advanceCheckpoint: true,
      checkpointBlockedReason: null,
      diagnostics: [],
    });
  });
  it('maps receipt replay without interpreting it as live source state', async () => {
    const { adapter } = setup({
      batch_id: id2,
      source_id: 'rss',
      status: 'COMMITTED',
      state_version: 1,
      checkpoint_advanced: true,
      replayed: true,
    });
    expect((await adapter.persistBatch(persist)).replayed).toBe(true);
  });
  it('maps state including opaque validators, leases and failure counters', async () => {
    const { adapter } = setup([
      {
        source_id: 'rss',
        config_version: 1,
        state_version: 0,
        etag: 'W/"v1"',
        last_modified: null,
        last_successful_observed_at: null,
        last_attempt_at: at,
        lease_token: id,
        lease_owner: 'worker',
        lease_expires_at: lease.expiresAt,
        consecutive_failures: 2,
        last_failure_code: 'TIMEOUT',
      },
    ]);
    expect(await adapter.getSourceState('rss')).toMatchObject({
      lease,
      checkpoint: { etag: 'W/"v1"' },
      consecutiveFailures: 2,
    });
    expect(await setup([]).adapter.getSourceState('missing')).toBeNull();
  });
  it('queries bounded pages and immutable revisions', async () => {
    const { adapter, rpc } = setup([
      { id, canonical_url: observation.item.url, first_seen_at: at, last_seen_at: at },
    ]);
    expect(await adapter.listArticles(10, 20)).toEqual([
      { id, canonicalUrl: observation.item.url, firstSeenAt: at, lastSeenAt: at },
    ]);
    expect(rpc).toHaveBeenCalledWith('watcher_query', {
      p_kind: 'ARTICLES',
      p_filter: null,
      p_limit: 10,
      p_offset: 20,
    });
    const revision = {
      id,
      article_id: id2,
      feed_item_id: id,
      evidence_fingerprint: observation.evidenceFingerprint,
      item_payload: observation.item,
      first_observed_at: at,
      created_at: at,
    };
    expect((await setup([revision]).adapter.listRevisions(id2))[0].item).toEqual(observation.item);
  });
  it('stages versioned candidates and attaches explicit traceable evidence', async () => {
    const normalized = validateWatcherCandidate(candidate),
      row = {
        ...normalized,
        identity_key: normalized.identityKey,
        model_hint: normalized.modelHint,
        project_code: null,
        version: 1,
        created_at: at,
        updated_at: at,
      };
    expect((await setup(row).adapter.stageCandidate(candidate)).identityKey).toBe(
      normalized.identityKey,
    );
    const input = {
      candidateId: id,
      candidateVersion: 1,
      revisionId: id2,
      assertion: 'BR_CONFIRMED' as const,
      actorId: id,
      note: 'Explicit reviewed evidence',
    };
    const e = {
      id,
      candidate_id: id,
      candidate_version: 1,
      candidate_snapshot: row,
      revision_id: id2,
      assertion: input.assertion,
      actor_id: id,
      note: input.note,
      created_at: at,
    };
    expect(await setup(e).adapter.attachCandidateEvidence(input)).toMatchObject({ ...input, id });
  });
  it('prepares a hint only from stored candidate/version/evidence IDs', async () => {
    const payload = {
      schemaVersion: 'watcher-brand-hint/1',
      watcherCandidateId: id,
      brand: 'Ford',
      market: 'BR',
      modelHint: 'Puma',
      projectCode: null,
      aliases: [],
      evidenceFingerprint: observation.evidenceFingerprint,
    };
    const { adapter, rpc } = setup({
      id,
      candidate_id: id,
      candidate_version: 1,
      evidence_id: id2,
      payload,
      prepared_at: at,
    });
    expect((await adapter.prepareHint(id, id2, 1)).payload).toEqual(payload);
    expect(rpc).toHaveBeenCalledWith('watcher_prepare_hint', {
      p_candidate_id: id,
      p_evidence_id: id2,
      p_expected_version: 1,
    });
  });
  it.each([
    ['WATCHER_STALE_LEASE', 'P0001', 'STALE_LEASE'],
    ['WATCHER_STALE_STATE', 'P0001', 'STALE_STATE'],
    ['WATCHER_SOURCE_BUSY', 'P0001', 'SOURCE_BUSY'],
    ['WATCHER_HINT_NOT_READY', 'P0001', 'HINT_NOT_READY'],
    ['WATCHER_CONTENT_CONFLICT', 'P0001', 'CONTENT_CONFLICT'],
    ['secret database payload', '23503', 'INVALID_REFERENCE'],
    ['secret password', '23514', 'INVALID_INPUT'],
    ['secret token', 'XX000', 'PERSISTENCE_FAILED'],
  ])('sanitizes server failure %s', async (message, code, expected) => {
    const { adapter } = setup(null, { message, code, details: 'SECRET' });
    await expect(adapter.claimLease('rss', 'worker')).rejects.toMatchObject({
      code: expected,
      message: 'WATCHER_' + expected,
    });
  });
  it('normalizes transport failures and malformed response data without raw cause', async () => {
    const client: WatcherRpcClient = {
      rpc: () => {
        throw new Error('SECRET');
      },
    };
    await expect(new WatcherSupabaseAdapter(client).listSources()).rejects.toMatchObject({
      message: 'WATCHER_PERSISTENCE_FAILED',
    });
    await expect(setup({ wrong: 'shape' }).adapter.listSources()).rejects.toMatchObject({
      code: 'PERSISTENCE_FAILED',
    });
  });
  it('rejects invalid inputs before invoking any remote capability', () => {
    const { adapter, rpc } = setup(null);
    expect(() => adapter.listArticles(101)).toThrow();
    expect(() => adapter.claimLease('rss', 'worker', 0)).toThrow();
    expect(() => adapter.prepareHint('invalid', id, 1)).toThrow();
    expect(() =>
      adapter.persistBatch({
        ...persist,
        advanceCheckpoint: true,
        checkpointBlockedReason: 'CONFLICT',
      }),
    ).toThrow();
    expect(() =>
      adapter.attachCandidateEvidence({
        candidateId: id,
        candidateVersion: 1,
        revisionId: id2,
        assertion: 'BR_CONFIRMED',
        actorId: null,
        note: 'bad',
      }),
    ).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('refuses browser construction', () => {
    vi.stubGlobal('window', {});
    try {
      expect(() => new WatcherSupabaseAdapter({ rpc: vi.fn() })).toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
