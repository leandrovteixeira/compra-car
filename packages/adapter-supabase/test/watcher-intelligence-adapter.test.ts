import { describe, expect, it, vi } from 'vitest';
import {
  prepareWatcherIntelligenceCommit,
  watcherIntelligenceCommitKey,
  fingerprintWatcherFeedItem,
} from '@compra-car/core/agents';
import { WatcherSupabaseAdapter, type WatcherRpcClient } from '../src/watcher-supabase-adapter';
import { createWatcherQaExecutor, WATCHER_QA_REF, WATCHER_QA_URL } from '../src/watcher-qa-safety';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = '2026-10-26T18:00:00.000Z';
const source = {
  id: 'fixture',
  feedUrl: 'https://fixture.example.br/rss',
  editorialMarket: 'BR' as const,
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};
const item = {
  sourceId: 'fixture',
  guid: 'one',
  url: 'https://fixture.example.br/news/1',
  title: 'Fiat lança o novo Pulse no Brasil',
  excerpt: null,
  publishedAt: at,
  updatedAt: null,
};
const lease = {
  sourceId: 'fixture',
  token: id(900),
  owner: 'fixture',
  expiresAt: '2026-10-26T18:02:00.000Z',
  configVersion: 1,
  stateVersion: 1,
};
const request = prepareWatcherIntelligenceCommit({
  commitId: id(500),
  scope: 'qa/fixture',
  leases: [lease],
  context: {
    brands: [
      { id: 'fiat', canonicalName: 'Fiat', canonicalKey: 'fiat', market: 'BR', aliases: [] },
    ],
    mmvs: [
      { id: 'pulse', market: 'BR', brand: 'Fiat', model: 'Pulse', officialVersionLabel: 'Drive' },
    ],
    sources: [{ source, kind: 'SECONDARY', officialBrandId: null, officialHosts: [] }],
  },
  documents: [
    {
      revision: {
        id: id(1),
        articleId: id(2),
        feedItemId: id(3),
        item,
        evidenceFingerprint: fingerprintWatcherFeedItem(item),
        firstObservedAt: at,
        createdAt: at,
      },
      content: null,
      originGroup: null,
    },
  ],
  currentRevisionIds: [id(1)],
  currentPointers: [{ feedItemId: id(3), revisionId: id(1), observedAt: at }],
});
const candidate = request.payload.candidates[0];
const receipt = {
  commitId: request.commitId,
  commitKey: watcherIntelligenceCommitKey(request),
  scope: request.payload.scope,
  scopeVersion: 1,
  unitKeys: request.payload.units.map((u) => u.key),
  candidateVersions: request.payload.candidates.map((c) => ({
    key: c.snapshot.key,
    version: 1,
    reviewVersion: 0,
  })),
  sourceVersions: [{ sourceId: 'fixture', stateVersion: 2 }],
  replayed: false,
};
function setup(data: unknown = receipt, error: unknown = null) {
  const rpc = vi.fn<WatcherRpcClient['rpc']>(async () => ({ data, error }));
  return { rpc, adapter: new WatcherSupabaseAdapter({ rpc }) };
}
describe('Watcher intelligence adapter - one injected HTTPS RPC capability', () => {
  it('sends exactly one transactional RPC with fences separate from persisted payload', async () => {
    const { rpc, adapter } = setup();
    expect(await adapter.persistIntelligence(request)).toEqual(receipt);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('watcher_commit_intelligence');
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_commit_id: request.commitId,
      p_fences: [{ sourceId: 'fixture', token: lease.token, configVersion: 1, stateVersion: 1 }],
    });
    expect(JSON.stringify(rpc.mock.calls[0][1].p_payload)).not.toContain(lease.token);
  });
  it('decodes replay receipts with their canonical ID and old versions without applying writes', async () => {
    const replay = { ...receipt, commitId: id(501), replayed: true };
    const { adapter } = setup(replay);
    expect(
      await adapter.persistIntelligence({ ...request, leases: [{ ...lease, stateVersion: 9 }] }),
    ).toEqual(replay);
  });
  it.each([
    { replayed: 'yes' },
    { scope: 'production' },
    { commitKey: 'wrong' },
    { unitKeys: [] },
    { candidateVersions: [] },
    { sourceVersions: [{ sourceId: 'other', stateVersion: 2 }] },
    { sourceVersions: [{ sourceId: 'fixture', stateVersion: 9 }] },
  ])('rejects corrupt or cross-scope receipt %j', async (patch) => {
    await expect(
      setup({ ...receipt, ...patch }).adapter.persistIntelligence(request),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
  });
  it('rejects tampered snapshot before transport construction or dispatch', () => {
    const { adapter, rpc } = setup();
    const changed = structuredClone(request);
    (changed.payload.candidates[0].snapshot as { applyAllowed: boolean }).applyAllowed = true;
    expect(() => adapter.persistIntelligence(changed)).toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(['STALE_STATE', 'STALE_LEASE', 'CONTENT_CONFLICT', 'REVIEW_CONFLICT'])(
    'preserves sanitized transactional code %s without retries',
    async (code) => {
      const { adapter, rpc } = setup(null, { code: 'P0001', message: 'WATCHER_' + code });
      await expect(adapter.persistIntelligence(request)).rejects.toMatchObject({ code });
      expect(rpc).toHaveBeenCalledTimes(1);
    },
  );
  it('reviews with a separate append-only RPC and validates the human receipt', async () => {
    const command = {
      reviewId: id(700),
      scope: request.payload.scope,
      scopeVersion: 1,
      eventKey: candidate.snapshot.key,
      expectedVersion: 1,
      expectedReviewVersion: 0,
      snapshotFingerprint: candidate.snapshot.fingerprint,
      decision: 'REJECT' as const,
      actorId: id(701),
      note: 'Explicit test review',
    };
    const answer = {
      reviewId: command.reviewId,
      scope: command.scope,
      scopeVersion: 1,
      eventKey: command.eventKey,
      candidateVersion: 1,
      reviewVersion: 1,
      sourceVersions: receipt.sourceVersions,
      replayed: false,
    };
    const { adapter, rpc } = setup(answer);
    expect(await adapter.reviewIntelligence([lease], command)).toEqual(answer);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('watcher_review_intelligence');
    await expect(
      setup({ ...answer, reviewVersion: 2 }).adapter.reviewIntelligence([lease], command),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_FAILED' });
  });
  it.each(['RECEIPTS', 'UNITS', 'CANDIDATES', 'REVIEWS'] as const)(
    'queries only scoped audit kind %s',
    async (kind) => {
      const { adapter, rpc } = setup([]);
      expect(await adapter.queryIntelligence(kind, 'qa/fixture')).toEqual([]);
      expect(rpc).toHaveBeenCalledExactlyOnceWith('watcher_intelligence_query', {
        p_kind: kind,
        p_scope: 'qa/fixture',
        p_filter: null,
        p_limit: 25,
        p_offset: 0,
      });
      expect(() => adapter.queryIntelligence(kind, 'qa/fixture', null, 101)).toThrow();
    },
  );
  it('keeps all new administrative capabilities blocked by the existing operational QA executor', async () => {
    const rpc = vi.fn<WatcherRpcClient['rpc']>(async () => ({ data: null, error: null }));
    const env = {
      APP_ENV: 'qa',
      WATCHER_ENVIRONMENT: 'qa',
      WATCHER_QA_PROJECT_REF: WATCHER_QA_REF,
      SUPABASE_URL: WATCHER_QA_URL,
      SUPABASE_SERVER_KEY: 'fixture-server-key',
    };
    const executor = createWatcherQaExecutor(
      () => env,
      () => ({ rpc }),
    );
    await expect(executor.run((repo) => repo.persistIntelligence(request))).rejects.toThrow();
    await expect(
      executor.run((repo) => repo.queryIntelligence('CANDIDATES', 'qa/fixture')),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    const factory = vi.fn(() => ({ rpc }));
    expect(() =>
      createWatcherQaExecutor(() => ({ ...env, WATCHER_QA_PROJECT_REF: 'production' }), factory),
    ).toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
});
