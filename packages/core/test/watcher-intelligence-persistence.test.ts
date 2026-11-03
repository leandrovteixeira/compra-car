import { describe, expect, it } from 'vitest';
import { fingerprintWatcherFeedItem } from '../src/agents/watcher-ingestion-contract';
import {
  prepareWatcherIntelligenceCommit,
  validateWatcherIntelligenceCommit,
  watcherIntelligenceCommitKey,
  watcherIntelligenceFences,
  validateWatcherIntelligenceReview,
} from '../src/agents/watcher-intelligence-persistence';
import type {
  WatcherIntelligenceContext,
  WatcherIntelligenceDocument,
} from '../src/agents/watcher-intelligence';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = '2026-10-26T18:00:00.000Z';
const source = {
  id: 'qa-news',
  feedUrl: 'https://qa-news.example.br/rss',
  editorialMarket: 'BR' as const,
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};
const context: WatcherIntelligenceContext = {
  brands: [{ id: 'fiat', canonicalName: 'Fiat', canonicalKey: 'fiat', market: 'BR', aliases: [] }],
  mmvs: [
    { id: 'pulse', brand: 'Fiat', model: 'Pulse', market: 'BR', officialVersionLabel: 'Drive' },
  ],
  sources: [{ source, kind: 'SECONDARY', officialBrandId: null, officialHosts: [] }],
};
const lease = {
  sourceId: source.id,
  token: uuid(999),
  owner: 'fixture',
  expiresAt: '2026-10-26T18:02:00.000Z',
  configVersion: 1,
  stateVersion: 1,
};
function document(n = 1, title = 'Fiat lança o novo Pulse no Brasil'): WatcherIntelligenceDocument {
  const item = {
    sourceId: source.id,
    guid: String(n),
    url: `https://qa-news.example.br/news/${n}`,
    title,
    excerpt: null,
    publishedAt: at,
    updatedAt: null,
  };
  return {
    revision: {
      id: uuid(n),
      articleId: uuid(n + 100),
      feedItemId: uuid(n + 200),
      item,
      evidenceFingerprint: fingerprintWatcherFeedItem(item),
      firstObservedAt: at,
      createdAt: at,
    },
    content: null,
    originGroup: null,
  };
}
function input(documents = [document()]) {
  return {
    commitId: uuid(500),
    scope: 'qa/motor1/24b',
    leases: [lease],
    context,
    documents,
    currentRevisionIds: documents.map((d) => d.revision.id),
    currentPointers: documents.map((d) => ({
      feedItemId: d.revision.feedItemId,
      revisionId: d.revision.id,
      observedAt: d.revision.firstObservedAt,
    })),
  };
}
describe('Watcher intelligence transactional protocol, pure only', () => {
  it('builds a deterministic complete payload without persisting lease tokens', () => {
    const request = prepareWatcherIntelligenceCommit(input());
    expect(validateWatcherIntelligenceCommit(request)).toEqual(request);
    expect(JSON.stringify(request.payload)).not.toContain(lease.token);
    expect(request.payload.candidates[0]).toMatchObject({
      expectedVersion: 0,
      expectedReviewVersion: 0,
      snapshot: { applyAllowed: false, status: 'NEW' },
    });
    expect(watcherIntelligenceCommitKey(request)).toMatch(
      /^watcher-intelligence-commit\/1:sha256:[a-f0-9]{64}$/u,
    );
  });
  it('does not include tokens, worker identity or fresh fence versions in the natural commit key', () => {
    const first = prepareWatcherIntelligenceCommit(input());
    const second = prepareWatcherIntelligenceCommit({
      ...input(),
      commitId: uuid(501),
      leases: [{ ...lease, token: uuid(998), owner: 'other', stateVersion: 9 }],
    });
    expect(watcherIntelligenceCommitKey(second)).toBe(watcherIntelligenceCommitKey(first));
    expect(second.payload.units).toEqual(first.payload.units);
  });
  it('separates scope, context, new revisions and pointer generations', () => {
    const base = input(),
      first = prepareWatcherIntelligenceCommit(base);
    const scope = prepareWatcherIntelligenceCommit({ ...base, scope: 'qa/other' });
    const ctx = prepareWatcherIntelligenceCommit({
      ...base,
      context: {
        ...context,
        brands: context.brands.map((b) => ({ ...b, aliases: ['Fiat Auto'] })),
      },
    });
    for (const changed of [scope, ctx]) {
      expect(changed.payload.units[0].key).not.toBe(first.payload.units[0].key);
      expect(watcherIntelligenceCommitKey(changed)).not.toBe(watcherIntelligenceCommitKey(first));
    }
    const later = prepareWatcherIntelligenceCommit({
      ...base,
      currentPointers: [{ ...base.currentPointers[0], observedAt: '2026-10-27T00:00:00.000Z' }],
    });
    expect(later.payload.units[0].key).toBe(first.payload.units[0].key);
    expect(watcherIntelligenceCommitKey(later)).not.toBe(watcherIntelligenceCommitKey(first));
  });
  it('uses authoritative current pointers for A-B-A without erasing historical revisions', () => {
    const a = document(),
      b0 = document(2, 'Fiat não lança o novo Pulse no Brasil');
    const b = {
      ...b0,
      revision: {
        ...b0.revision,
        articleId: a.revision.articleId,
        feedItemId: a.revision.feedItemId,
        firstObservedAt: '2026-10-27T00:00:00.000Z',
      },
    };
    const first = prepareWatcherIntelligenceCommit({
      ...input([a, b]),
      currentRevisionIds: [a.revision.id],
      currentPointers: [
        {
          feedItemId: a.revision.feedItemId,
          revisionId: a.revision.id,
          observedAt: '2026-10-28T00:00:00.000Z',
        },
      ],
    });
    expect(first.payload.units).toHaveLength(2);
    expect(first.payload.candidates[0].snapshot.status).toBe('NEW');
    expect(first.payload.candidates[0].snapshot.activeSignalIds).toEqual(
      first.payload.units
        .find((u) => u.document.revision.id === a.revision.id)!
        .analysis.signals.map((s) => s.fingerprint),
    );
  });
  it('normalizes source/journal ordering and preserves replay content', () => {
    const a = document(),
      b = document(2, 'Fiat Pulse custa R$ 90.000 no Brasil');
    const first = prepareWatcherIntelligenceCommit(input([a, b])),
      second = prepareWatcherIntelligenceCommit(input([b, a]));
    expect(second).toEqual(first);
  });
  it.each(['PRODUCTION', '../main', 'qa scope', ''])(
    'rejects invalid execution scopes %s',
    (scope) => {
      expect(() => prepareWatcherIntelligenceCommit({ ...input(), scope })).toThrow();
    },
  );
  it('rejects duplicated, cross-source and invalid fencing inputs before RPC', () => {
    expect(() => watcherIntelligenceFences([lease, lease])).toThrow();
    expect(() => watcherIntelligenceFences([{ ...lease, token: 'bad' }])).toThrow();
    expect(() =>
      prepareWatcherIntelligenceCommit({ ...input(), leases: [{ ...lease, sourceId: 'another' }] }),
    ).toThrow();
  });
  it('allows expired lease metadata for read-only receipt reconciliation; SQL gates any new write', () => {
    expect(() =>
      prepareWatcherIntelligenceCommit({
        ...input(),
        leases: [{ ...lease, expiresAt: '2020-01-01T00:00:00.000Z' }],
      }),
    ).not.toThrow();
  });
  it('rejects tampering with signals, candidate status or evidence before any dispatch', () => {
    const first = prepareWatcherIntelligenceCommit(input());
    for (const mutate of [
      (r: typeof first) => {
        (r.payload.candidates[0].snapshot as { status: string }).status = 'DISMISSED';
      },
      (r: typeof first) => {
        (r.payload.units[0].analysis.signals[0].evidence as { quote: string }).quote = 'invented';
      },
    ]) {
      const changed = structuredClone(first);
      mutate(changed);
      expect(() => validateWatcherIntelligenceCommit(changed)).toThrow();
    }
  });
  it('rejects incomplete/ambiguous pointers and old current timestamps', () => {
    const base = input();
    for (const pointers of [
      [],
      [base.currentPointers[0], base.currentPointers[0]],
      [{ ...base.currentPointers[0], observedAt: '2020-01-01T00:00:00.000Z' }],
    ])
      expect(() =>
        prepareWatcherIntelligenceCommit({ ...base, currentPointers: pointers }),
      ).toThrow();
  });
  it('rejects oversized wire payloads even when each stored document is individually bounded', () => {
    const docs = Array.from({ length: 60 }, (_, n) => ({
      ...document(n + 1, 'Irrelevant fixture'),
      content: 'a'.repeat(20000),
    }));
    expect(() => prepareWatcherIntelligenceCommit(input(docs))).toThrow();
  });
  it('supports a zero-article scope without synthesizing signals or candidates', () => {
    const r = prepareWatcherIntelligenceCommit(input([]));
    expect(r.payload.units).toEqual([]);
    expect(r.payload.candidates).toEqual([]);
  });
  it('validates human review independently from generated snapshots', () => {
    const r = prepareWatcherIntelligenceCommit(input()),
      c = r.payload.candidates[0];
    const command = {
      reviewId: uuid(800),
      scope: r.payload.scope,
      scopeVersion: 1,
      eventKey: c.snapshot.key,
      expectedVersion: 1,
      expectedReviewVersion: 0,
      snapshotFingerprint: c.snapshot.fingerprint,
      decision: 'REJECT' as const,
      actorId: uuid(801),
      note: 'Human fixture',
    };
    expect(validateWatcherIntelligenceReview(command)).toEqual(command);
    expect(() =>
      validateWatcherIntelligenceReview({ ...command, decision: 'APPLY' as never }),
    ).toThrow();
    expect(() => validateWatcherIntelligenceReview({ ...command, actorId: 'unknown' })).toThrow();
  });
});
