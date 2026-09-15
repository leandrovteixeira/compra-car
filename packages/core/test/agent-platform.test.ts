import { describe, expect, it, vi } from 'vitest';
import {
  StoredAgentPlatformRepository,
  AGENT_TYPES,
  AGENT_RUN_STATUSES,
  AGENT_REVIEW_DECISIONS,
  latestAgentReview,
  canonicalAgentJson,
  safeAgentSourceUrl,
} from '../src/agent-platform';
import {
  agentPlatformFixture,
  InMemoryAgentPlatformStore,
  platformFixtureId,
} from '../src/agent-platform/testing';
const setup = () => {
  const store = new InMemoryAgentPlatformStore();
  let id = 1000;
  const repo = new StoredAgentPlatformRepository(
    store,
    () => '2026-09-13T13:00:00.000Z',
    () => platformFixtureId(id++),
  );
  return { store, repo, ...agentPlatformFixture() };
};
describe('Agent Platform domain and persistence', () => {
  it('keeps partial runs out of the review queue until completion', async () => {
    const { repo, bundle } = setup();
    await repo.createRun({ ...bundle.run, status: 'RUNNING', completedAt: null });
    await repo.persistFinding(bundle.findings[1]!.finding);
    expect((await repo.listFindings({ review: 'OPEN' })).total).toBe(0);
    await expect(
      repo.addReview({
        findingId: bundle.findings[1]!.finding.id,
        decision: 'ACCEPT',
        note: null,
        reviewedBy: null,
      }),
    ).rejects.toThrow('INVALID_INPUT');
    expect((await repo.listFindings({ runId: bundle.run.id })).total).toBe(1);
  });
  it('accepts equivalent timestamp encodings during idempotent replay', async () => {
    const { repo, bundle } = setup();
    await repo.persistRunBundle(bundle);
    await expect(
      repo.persistRunBundle({
        ...bundle,
        run: { ...bundle.run, startedAt: '2026-09-13T09:00:00-03:00' },
        findings: bundle.findings.map((item) => ({
          ...item,
          evidence: item.evidence.map((e) => ({ ...e, capturedAt: '2026-09-13T09:00:00-03:00' })),
        })),
      }),
    ).resolves.toBeUndefined();
  });
  it('does not reopen cancelled runs', async () => {
    const { repo, store, bundle } = setup();
    await store.insertRun({ ...bundle.run, status: 'CANCELLED' });
    await expect(repo.persistRunBundle(bundle)).rejects.toThrow('IMMUTABLE_RUN');
  });
  it('rejects non-boolean requiresReview and out-of-range confidence', async () => {
    const { repo, bundle } = setup();
    await repo.createRun({ ...bundle.run, status: 'RUNNING', completedAt: null });
    await expect(
      repo.persistFinding({ ...bundle.findings[0]!.finding, requiresReview: 'true' } as never),
    ).rejects.toThrow('INVALID_INPUT');
    await expect(
      repo.persistFinding({ ...bundle.findings[0]!.finding, confidence: 2 }),
    ).rejects.toThrow('INVALID_INPUT');
  });
  it('does not finalize after a conditional transition loses a race', async () => {
    const { repo, store, bundle } = setup();
    await repo.createRun({ ...bundle.run, status: 'RUNNING', completedAt: null });
    vi.spyOn(store, 'transitionRun').mockResolvedValueOnce(false);
    await expect(repo.completeRun(bundle.run.id, {}, bundle.run.completedAt!)).rejects.toThrow(
      'CONTENT_CONFLICT',
    );
  });
  it('rejects huge evidence snippets and changed evidence identities without overwriting', async () => {
    const { repo, bundle } = setup();
    await repo.createRun({ ...bundle.run, status: 'RUNNING', completedAt: null });
    const item = bundle.findings[0]!;
    await repo.persistFinding(item.finding);
    await expect(
      repo.persistEvidence({ ...item.evidence[0]!, excerpt: 'x'.repeat(1001) }),
    ).rejects.toThrow('INVALID_INPUT');
    await repo.persistEvidence(item.evidence[0]!);
    await expect(
      repo.persistEvidence({ ...item.evidence[0]!, excerpt: 'changed' }),
    ).rejects.toThrow('CONTENT_CONFLICT');
  });

  it('declares exactly five specialist types, four run states and three decisions', () => {
    expect(AGENT_TYPES).toEqual([
      'BRAND_CONNECTOR',
      'MMV_DISCOVERY',
      'MODEL_YEAR',
      'SPEC_INTELLIGENCE',
      'PRICE_INTELLIGENCE',
    ]);
    expect(AGENT_RUN_STATUSES).toEqual(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);
    expect(AGENT_REVIEW_DECISIONS).toEqual(['ACCEPT', 'REJECT', 'DEFER']);
  });
  it('creates RUNNING, stores observations, then completes with summary', async () => {
    const { repo, bundle } = setup();
    await repo.createRun({ ...bundle.run, status: 'RUNNING', completedAt: null });
    await repo.persistFinding(bundle.findings[0]!.finding);
    await repo.persistEvidence(bundle.findings[0]!.evidence[0]!);
    expect(
      (await repo.completeRun(bundle.run.id, { count: 1 }, bundle.run.completedAt!)).status,
    ).toBe('COMPLETED');
    expect((await repo.getRun(bundle.run.id))!.findings).toHaveLength(1);
  });
  it.each(['agentType', 'status'] as const)('rejects invalid %s at runtime', async (field) => {
    const { repo, bundle } = setup();
    await expect(
      repo.createRun({
        ...bundle.run,
        status: 'RUNNING',
        completedAt: null,
        [field]: 'INVALID',
      } as never),
    ).rejects.toThrow('INVALID_INPUT');
  });
  it('marks failures and retries the same run without duplicate observations', async () => {
    const { repo, store, bundle } = setup();
    const insert = vi.spyOn(store, 'insertEvidence').mockRejectedValueOnce(new Error('failure'));
    await expect(repo.persistRunBundle(bundle)).rejects.toThrow('failure');
    expect((await repo.getRun(bundle.run.id))!.run.status).toBe('FAILED');
    insert.mockRestore();
    await repo.persistRunBundle(bundle);
    expect((await repo.getRun(bundle.run.id))!.findings).toHaveLength(7);
  });
  it('never reports COMPLETED after a partial persistence failure', async () => {
    const { repo, store, bundle } = setup();
    vi.spyOn(store, 'insertFinding').mockRejectedValueOnce(new Error('storage'));
    await expect(repo.persistRunBundle(bundle)).rejects.toThrow('storage');
    const run = (await repo.getRun(bundle.run.id))!.run;
    expect(run.status).toBe('FAILED');
    expect(run.error).toEqual({ code: 'BUNDLE_PERSISTENCE_FAILED' });
  });
  it('preserves original failure when recording FAILED also fails', async () => {
    const { repo, store, bundle } = setup();
    vi.spyOn(store, 'insertEvidence').mockRejectedValueOnce(new Error('original'));
    vi.spyOn(store, 'transitionRun').mockRejectedValueOnce(new Error('secondary'));
    await expect(repo.persistRunBundle(bundle)).rejects.toThrow('original');
    expect((await repo.getRun(bundle.run.id))!.run.status).toBe('RUNNING');
  });
  it('persists a full bundle twice idempotently, including regenerated child UUIDs', async () => {
    const { repo, store, bundle } = setup();
    await repo.persistRunBundle(bundle);
    const replay = {
      ...bundle,
      findings: bundle.findings.map((item, i) => ({
        finding: { ...item.finding, id: platformFixtureId(200 + i) },
        evidence: item.evidence.map((e) => ({
          ...e,
          id: platformFixtureId(300 + i),
          findingId: platformFixtureId(200 + i),
        })),
      })),
    };
    await repo.persistRunBundle(replay);
    expect(await store.runs()).toHaveLength(1);
    expect(await store.findings()).toHaveLength(7);
    expect(await store.reviews()).toHaveLength(0);
    for (const item of bundle.findings)
      expect(await store.evidence(item.finding.id)).toHaveLength(1);
  });
  it('deduplicates same finding and evidence within one input bundle', async () => {
    const { repo, bundle } = setup();
    const item = bundle.findings[0]!;
    await repo.persistRunBundle({
      ...bundle,
      findings: [{ ...item, evidence: [...item.evidence, ...item.evidence] }, item],
    });
    expect((await repo.getRun(bundle.run.id))!.findings).toHaveLength(1);
  });
  it('allows the same fingerprint in a later run', async () => {
    const { repo, store, bundle } = setup();
    await repo.persistRunBundle(bundle);
    await repo.persistRunBundle({
      ...bundle,
      run: { ...bundle.run, id: platformFixtureId(2) },
      findings: bundle.findings.map((item, i) => ({
        finding: { ...item.finding, id: platformFixtureId(200 + i), runId: platformFixtureId(2) },
        evidence: item.evidence.map((e) => ({
          ...e,
          id: platformFixtureId(300 + i),
          findingId: platformFixtureId(200 + i),
        })),
      })),
    });
    expect(await store.findings()).toHaveLength(14);
  });
  it.each(['finding', 'evidence', 'run'] as const)(
    'rejects changed %s in a completed bundle without modifying its status',
    async (kind) => {
      const { repo, bundle } = setup();
      await repo.persistRunBundle(bundle);
      const changed = structuredClone(bundle);
      if (kind === 'run') Object.assign(changed.run, { summary: { different: true } });
      if (kind === 'finding') Object.assign(changed.findings[0]!.finding, { title: 'changed' });
      if (kind === 'evidence')
        Object.assign(changed.findings[0]!.evidence[0]!, { excerpt: 'changed' });
      await expect(repo.persistRunBundle(changed)).rejects.toThrow('CONTENT_CONFLICT');
      expect((await repo.getRun(bundle.run.id))!.run.status).toBe('COMPLETED');
    },
  );
  it('blocks direct finding/evidence writes and failure transitions after completion', async () => {
    const { repo, bundle } = setup();
    await repo.persistRunBundle(bundle);
    await expect(repo.persistFinding(bundle.findings[0]!.finding)).rejects.toThrow('IMMUTABLE_RUN');
    await expect(repo.persistEvidence(bundle.findings[0]!.evidence[0]!)).rejects.toThrow(
      'IMMUTABLE_RUN',
    );
    await expect(repo.failRun(bundle.run.id, { code: 'late' })).rejects.toThrow('IMMUTABLE_RUN');
  });
  it('rejects changed duplicate fingerprint while RUNNING', async () => {
    const { repo, bundle } = setup();
    await repo.createRun({ ...bundle.run, status: 'RUNNING', completedAt: null });
    const finding = bundle.findings[0]!.finding;
    await repo.persistFinding(finding);
    await expect(repo.persistFinding({ ...finding, title: 'overwrite' })).rejects.toThrow(
      'CONTENT_CONFLICT',
    );
    expect((await repo.getFinding(finding.id))!.finding.title).toBe(finding.title);
  });
  it('rejects mismatched bundle ownership before writing', async () => {
    const { repo, store, bundle } = setup();
    await expect(
      repo.persistRunBundle({
        ...bundle,
        findings: [
          {
            ...bundle.findings[0]!,
            finding: { ...bundle.findings[0]!.finding, runId: platformFixtureId(99) },
          },
        ],
      }),
    ).rejects.toThrow('INVALID_INPUT');
    expect(await store.runs()).toHaveLength(0);
  });
  it('appends repeated decisions as separate reviews, preserving previous history', async () => {
    const { repo, bundle } = setup();
    await repo.persistRunBundle(bundle);
    const input = {
      findingId: bundle.findings[1]!.finding.id,
      decision: 'ACCEPT' as const,
      note: 'approved',
      reviewedBy: platformFixtureId(100),
    };
    const before = await repo.getRun(bundle.run.id);
    const first = await repo.addReview(input),
      second = await repo.addReview(input);
    expect(first.id).not.toBe(second.id);
    const detail = (await repo.getFinding(input.findingId))!;
    expect(detail.reviews).toHaveLength(2);
    expect(detail.latestReview?.id).toBe(second.id);
    expect(detail.finding.proposal).toEqual({ action: 'REVIEW_NEW_MODEL' });
    expect(await repo.getRun(bundle.run.id)).toEqual(before);
  });
  it.each(['ACCEPT', 'REJECT', 'DEFER'] as const)(
    'filters latest %s and computes live run review counts',
    async (decision) => {
      const { repo, bundle, reviews } = setup();
      await repo.persistRunBundle(bundle);
      for (const r of reviews) await repo.addReview(r);
      const list = await repo.listFindings({ review: decision, requiresReview: true });
      expect(list.items).toHaveLength(1);
      expect(list.items[0]!.latestReview?.decision).toBe(decision);
      const runs = await repo.listRuns();
      expect(runs.items[0]!.counts).toEqual({
        total: 7,
        reviewRequired: 6,
        accepted: 1,
        rejected: 1,
        deferred: 1,
      });
    },
  );
  it('Open excludes every decision and informational findings; All restores reviewed items', async () => {
    const { repo, bundle, reviews } = setup();
    await repo.persistRunBundle(bundle);
    for (const r of reviews) await repo.addReview(r);
    expect(
      (await repo.listFindings({ review: 'OPEN', requiresReview: true })).items.map(
        (i) => i.finding.findingType,
      ),
    ).toEqual(['NEW_MODEL', 'NEW_VERSION', 'AMBIGUOUS_MMV']);
    expect((await repo.listFindings({ review: 'ALL', requiresReview: true })).total).toBe(6);
    expect((await repo.listFindings({ runId: bundle.run.id, review: 'ALL' })).total).toBe(7);
  });
  it('latest review controls transitions from deferred to accepted', async () => {
    const { repo, bundle } = setup();
    await repo.persistRunBundle(bundle);
    const input = { findingId: bundle.findings[1]!.finding.id, note: null, reviewedBy: null };
    await repo.addReview({ ...input, decision: 'DEFER' });
    await repo.addReview({ ...input, decision: 'ACCEPT' });
    expect((await repo.getLatestReview(input.findingId))?.decision).toBe('ACCEPT');
    expect((await repo.listFindings({ review: 'DEFER' })).total).toBe(0);
  });
  it('orders equal timestamps deterministically by UUID without mutating history', () => {
    const { reviews } = agentPlatformFixture();
    const original = structuredClone(reviews);
    expect(latestAgentReview([...reviews].reverse())?.id).toBe(reviews[2]!.id);
    expect(reviews).toEqual(original);
    expect(latestAgentReview([])).toBeNull();
  });
  it('paginates filtered run and finding results', async () => {
    const { repo, bundle } = setup();
    await repo.persistRunBundle(bundle);
    expect((await repo.listFindings({ review: 'ALL', offset: 2, limit: 2 })).items).toHaveLength(2);
    expect((await repo.listRuns({ agentType: 'PRICE_INTELLIGENCE' })).total).toBe(0);
  });
  it.each(['PENDING', 'EXECUTE', 'accept'])(
    'rejects non-operational review decision %s',
    async (decision) => {
      const { repo, bundle } = setup();
      await repo.persistRunBundle(bundle);
      await expect(
        repo.addReview({
          findingId: bundle.findings[0]!.finding.id,
          decision: decision as never,
          note: null,
          reviewedBy: null,
        }),
      ).rejects.toThrow('INVALID_INPUT');
    },
  );
  it('returns empty details for unknown UUID and rejects malformed IDs', async () => {
    const { repo } = setup();
    expect(await repo.getRun(platformFixtureId(999))).toBeNull();
    expect(await repo.getFinding(platformFixtureId(999))).toBeNull();
    await expect(repo.getRun('invalid')).rejects.toThrow('INVALID_INPUT');
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:pass@example.com',
    'file:///secret',
  ])('rejects unsafe evidence URL %s', (url) => expect(safeAgentSourceUrl(url)).toBeNull());
  it('canonicalizes nested JSON keys without reordering arrays', () => {
    expect(canonicalAgentJson({ b: { y: 1, x: 2 }, a: [2, 1] })).toBe(
      canonicalAgentJson({ a: [2, 1], b: { x: 2, y: 1 } }),
    );
  });
});
