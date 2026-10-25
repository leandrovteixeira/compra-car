import type {
  AgentRun,
  AgentFinding,
  AgentEvidence,
  AgentReview,
  AgentObject,
  AgentRunBundle,
  AgentPlatformRepository,
  AgentListOptions,
  AgentFindingListOptions,
} from './types';
import {
  AGENT_TYPES,
  AGENT_RUN_STATUSES,
  AGENT_FINDING_TYPES,
  AGENT_REVIEW_DECISIONS,
} from './types';
import {
  AgentPlatformError,
  assertAgentUuid,
  assertAgentSame,
  assertAgentJson,
  latestAgentReview,
  agentReviewHistory,
  safeAgentSourceUrl,
} from './rules';
/** Storage boundary is operational only. Insert methods return existing rows on identity conflict; never overwrite. */
export interface AgentPlatformStore {
  runs(id?: string): Promise<readonly AgentRun[]>;
  findings(runId?: string, id?: string): Promise<readonly AgentFinding[]>;
  evidence(findingId: string): Promise<readonly AgentEvidence[]>;
  reviews(findingId?: string): Promise<readonly AgentReview[]>;
  insertRun(run: AgentRun): Promise<AgentRun>;
  transitionRun(id: string, from: AgentRun['status'], patch: Partial<AgentRun>): Promise<boolean>;
  insertFinding(finding: AgentFinding): Promise<AgentFinding>;
  insertEvidence(evidence: AgentEvidence): Promise<AgentEvidence>;
  insertReview(review: AgentReview): Promise<AgentReview>;
}
function content<T extends { id: string; createdAt: string }>(value: T) {
  const result = { ...value } as Record<string, unknown>;
  for (const key of ['id', 'createdAt', 'updatedAt']) delete result[key];
  if (typeof result.capturedAt === 'string') result.capturedAt = Date.parse(result.capturedAt);
  return result;
}
function runIdentity(run: AgentRun) {
  const result = content(run);
  result.startedAt = Date.parse(run.startedAt);
  for (const key of ['status', 'summary', 'error', 'completedAt']) delete result[key];
  return result;
}
function page<T>(items: readonly T[], options: AgentListOptions) {
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 25)));
  return { items: items.slice(offset, offset + limit), total: items.length };
}
export class StoredAgentPlatformRepository implements AgentPlatformRepository {
  constructor(
    private readonly store: AgentPlatformStore,
    private readonly now = () => new Date().toISOString(),
    private readonly uuid: () => string = () => globalThis.crypto.randomUUID(),
  ) {}
  private async run(id: string) {
    assertAgentUuid(id);
    const run = (await this.store.runs(id))[0];
    if (!run) throw new AgentPlatformError('NOT_FOUND');
    return run;
  }
  private async mutable(id: string) {
    const run = await this.run(id);
    if (run.status !== 'RUNNING') throw new AgentPlatformError('IMMUTABLE_RUN');
    return run;
  }
  async createRun(run: AgentRun): Promise<AgentRun> {
    assertAgentUuid(run.id);
    if (
      !AGENT_TYPES.includes(run.agentType) ||
      !AGENT_RUN_STATUSES.includes(run.status) ||
      run.status !== 'RUNNING' ||
      run.completedAt !== null ||
      !Number.isFinite(Date.parse(run.startedAt))
    )
      throw new AgentPlatformError('INVALID_INPUT');
    for (const value of [run.input, run.summary, run.configSnapshot]) assertAgentJson(value);
    const saved = await this.store.insertRun(run);
    assertAgentSame(runIdentity(saved), runIdentity(run));
    if (saved.status === 'FAILED') {
      if (
        !(await this.store.transitionRun(run.id, 'FAILED', {
          status: 'RUNNING',
          error: null,
          completedAt: null,
          updatedAt: this.now(),
        }))
      )
        throw new AgentPlatformError('CONTENT_CONFLICT');
      return this.run(run.id);
    }
    if (saved.status !== 'RUNNING') throw new AgentPlatformError('IMMUTABLE_RUN');
    return saved;
  }
  async completeRun(id: string, summary: AgentObject, completedAt: string) {
    const run = await this.run(id);
    assertAgentJson(summary);
    if (
      !Number.isFinite(Date.parse(completedAt)) ||
      Date.parse(completedAt) < Date.parse(run.startedAt)
    )
      throw new AgentPlatformError('INVALID_INPUT');
    if (run.status === 'COMPLETED') {
      assertAgentSame(
        [run.summary, Date.parse(run.completedAt!)],
        [summary, Date.parse(completedAt)],
      );
      return run;
    }
    await this.mutable(id);
    if (
      !(await this.store.transitionRun(id, 'RUNNING', {
        status: 'COMPLETED',
        summary,
        completedAt,
        error: null,
        updatedAt: this.now(),
      }))
    )
      throw new AgentPlatformError('CONTENT_CONFLICT');
    return this.run(id);
  }
  async failRun(id: string, error: AgentObject) {
    assertAgentJson(error);
    await this.mutable(id);
    if (
      !(await this.store.transitionRun(id, 'RUNNING', {
        status: 'FAILED',
        error,
        completedAt: this.now(),
        updatedAt: this.now(),
      }))
    )
      throw new AgentPlatformError('CONTENT_CONFLICT');
  }
  async persistFinding(finding: AgentFinding) {
    await this.mutable(finding.runId);
    assertAgentUuid(finding.id);
    if (
      typeof finding.requiresReview !== 'boolean' ||
      !AGENT_FINDING_TYPES.includes(finding.findingType) ||
      !finding.fingerprint.trim() ||
      !finding.title.trim() ||
      (finding.confidence !== null &&
        (!Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1))
    )
      throw new AgentPlatformError('INVALID_INPUT');
    for (const value of [finding.subject, finding.proposal, finding.payload])
      assertAgentJson(value);
    const saved = await this.store.insertFinding(finding);
    assertAgentSame(content(saved), content(finding));
    return saved;
  }
  async persistEvidence(evidence: AgentEvidence) {
    assertAgentUuid(evidence.id);
    assertAgentUuid(evidence.findingId);
    const finding = (await this.store.findings(undefined, evidence.findingId))[0];
    if (!finding) throw new AgentPlatformError('NOT_FOUND');
    await this.mutable(finding.runId);
    if (
      !safeAgentSourceUrl(evidence.sourceUrl) ||
      !evidence.sourceType.trim() ||
      !evidence.evidenceFingerprint.trim() ||
      (evidence.excerpt?.length ?? 0) > 1000 ||
      (evidence.title?.length ?? 0) > 500
    )
      throw new AgentPlatformError('INVALID_INPUT');
    assertAgentJson(evidence.metadata, 8192);
    const saved = await this.store.insertEvidence(evidence);
    assertAgentSame(content(saved), content(evidence));
    return saved;
  }
  private bundleContent(bundle: AgentRunBundle) {
    const findings = new Map<string, unknown>();
    for (const item of bundle.findings) {
      const evidences = new Map<string, unknown>();
      for (const evidence of item.evidence) {
        const value = content(evidence);
        delete value.findingId;
        const prior = evidences.get(evidence.evidenceFingerprint);
        if (prior) assertAgentSame(prior, value);
        evidences.set(evidence.evidenceFingerprint, value);
      }
      const value = {
        finding: content(item.finding),
        evidence: [...evidences.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      };
      const prior = findings.get(item.finding.fingerprint);
      if (prior) assertAgentSame(prior, value);
      findings.set(item.finding.fingerprint, value);
    }
    return {
      run: {
        ...runIdentity(bundle.run),
        summary: bundle.run.summary,
        completedAt: Date.parse(bundle.run.completedAt!),
      },
      findings: [...findings.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    };
  }
  async persistRunBundle(bundle: AgentRunBundle) {
    if (bundle.run.status !== 'COMPLETED' || !bundle.run.completedAt)
      throw new AgentPlatformError('INVALID_INPUT');
    for (const item of bundle.findings)
      if (
        item.finding.runId !== bundle.run.id ||
        item.evidence.some((e) => e.findingId !== item.finding.id)
      )
        throw new AgentPlatformError('INVALID_INPUT');
    const expected = this.bundleContent(bundle);
    const existing = await this.getRun(bundle.run.id);
    if (existing?.run.status === 'COMPLETED') {
      assertAgentSame(this.bundleContent(existing), expected);
      return;
    }
    await this.createRun({
      ...bundle.run,
      status: 'RUNNING',
      summary: {},
      completedAt: null,
      error: null,
    });
    try {
      for (const item of bundle.findings) {
        const saved = await this.persistFinding(item.finding);
        for (const evidence of item.evidence)
          await this.persistEvidence({ ...evidence, findingId: saved.id });
      }
      const persisted = (await this.getRun(bundle.run.id))!;
      assertAgentSame(this.bundleContent({ ...persisted, run: bundle.run }), expected);
      await this.completeRun(bundle.run.id, bundle.run.summary, bundle.run.completedAt);
    } catch (error) {
      try {
        await this.failRun(bundle.run.id, { code: 'BUNDLE_PERSISTENCE_FAILED' });
      } catch {
        /* Original failure wins; a concurrent completion cannot be overwritten. */
      }
      throw error;
    }
  }
  async getRun(id: string): Promise<AgentRunBundle | null> {
    assertAgentUuid(id);
    const run = (await this.store.runs(id))[0];
    if (!run) return null;
    const findings = await this.store.findings(id);
    const bundles = [];
    for (const finding of findings)
      bundles.push({ finding, evidence: await this.store.evidence(finding.id) });
    return { run, findings: bundles };
  }
  async getFinding(id: string) {
    assertAgentUuid(id);
    const finding = (await this.store.findings(undefined, id))[0];
    if (!finding) return null;
    const [run, evidence, reviews] = await Promise.all([
      this.run(finding.runId),
      this.store.evidence(id),
      this.store.reviews(id),
    ]);
    return {
      run,
      finding,
      evidence,
      reviews: agentReviewHistory(reviews),
      latestReview: latestAgentReview(reviews),
    };
  }
  async getLatestReview(findingId: string) {
    assertAgentUuid(findingId);
    return latestAgentReview(await this.store.reviews(findingId));
  }
  async addReview(input: Pick<AgentReview, 'findingId' | 'decision' | 'note' | 'reviewedBy'>) {
    assertAgentUuid(input.findingId);
    if (input.reviewedBy) assertAgentUuid(input.reviewedBy);
    if (!AGENT_REVIEW_DECISIONS.includes(input.decision) || (input.note?.length ?? 0) > 4000)
      throw new AgentPlatformError('INVALID_INPUT');
    const finding = (await this.store.findings(undefined, input.findingId))[0];
    if (!finding) throw new AgentPlatformError('NOT_FOUND');
    if ((await this.run(finding.runId)).status !== 'COMPLETED')
      throw new AgentPlatformError('INVALID_INPUT');
    return this.store.insertReview({
      ...input,
      note: input.note?.trim() || null,
      id: this.uuid(),
      createdAt: this.now(),
    });
  }
  async listFindings(options: AgentFindingListOptions = {}) {
    const [runs, findings, reviews] = await Promise.all([
      this.store.runs(),
      this.store.findings(options.runId),
      this.store.reviews(),
    ]);
    const byRun = new Map(runs.map((r) => [r.id, r]));
    const items = findings
      .flatMap((finding) => {
        const run = byRun.get(finding.runId);
        if (!run || (options.agentType && run.agentType !== options.agentType)) return [];
        if (
          options.requiresReview !== undefined &&
          finding.requiresReview !== options.requiresReview
        )
          return [];
        if (options.review && !options.runId && run.status !== 'COMPLETED') return [];
        const latestReview = latestAgentReview(reviews.filter((r) => r.findingId === finding.id));
        if (options.review === 'OPEN' && (!finding.requiresReview || latestReview !== null))
          return [];
        if (
          options.review &&
          !['OPEN', 'ALL'].includes(options.review) &&
          latestReview?.decision !== options.review
        )
          return [];
        return [{ finding, run, latestReview }];
      })
      .sort(
        (a, b) =>
          Date.parse(b.finding.createdAt) - Date.parse(a.finding.createdAt) ||
          a.finding.id.localeCompare(b.finding.id),
      );
    return page(items, options);
  }
  async listRuns(options: AgentListOptions = {}) {
    const [runs, findings, reviews] = await Promise.all([
      this.store.runs(),
      this.store.findings(),
      this.store.reviews(),
    ]);
    const items = runs
      .filter((run) => !options.agentType || options.agentType === run.agentType)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
      .map((run) => {
        const children = findings.filter((f) => f.runId === run.id);
        const decisions = children.map(
          (f) => latestAgentReview(reviews.filter((r) => r.findingId === f.id))?.decision,
        );
        return {
          run,
          counts: {
            total: children.length,
            reviewRequired: children.filter((f) => f.requiresReview).length,
            accepted: decisions.filter((d) => d === 'ACCEPT').length,
            rejected: decisions.filter((d) => d === 'REJECT').length,
            deferred: decisions.filter((d) => d === 'DEFER').length,
          },
        };
      });
    return page(items, options);
  }
}
