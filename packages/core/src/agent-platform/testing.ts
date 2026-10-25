/** Synthetic, offline-only fixtures. Never seeded by the application. */
import type {
  AgentRun,
  AgentFinding,
  AgentEvidence,
  AgentReview,
  AgentRunBundle,
  AgentFindingType,
} from './types';
import type { AgentPlatformStore } from './repository';
export const platformFixtureId = (value: number) =>
  '19000000-0000-4000-8000-' + value.toString(16).padStart(12, '0');
const date = '2026-09-13T12:00:00.000Z';
export function agentPlatformFixture(): {
  bundle: AgentRunBundle;
  reviews: readonly AgentReview[];
} {
  const types: AgentFindingType[] = [
    'MMV_MATCHED',
    'NEW_MODEL',
    'NEW_VERSION',
    'AMBIGUOUS_MMV',
    'NEW_MODEL',
    'NEW_VERSION',
    'AMBIGUOUS_MMV',
  ];
  const run: AgentRun = {
    id: platformFixtureId(1),
    agentType: 'MMV_DISCOVERY',
    status: 'COMPLETED',
    market: 'BR',
    brand: 'Fixture Motors',
    provider: 'fixture',
    runMode: 'dry-run',
    schemaVersion: '19B.1',
    startedAt: date,
    completedAt: date,
    input: { brand: 'Fixture Motors' },
    summary: { totalFindings: 7 },
    configSnapshot: { synthetic: true },
    error: null,
    sourceCommitSha: null,
    createdBy: null,
    createdAt: date,
    updatedAt: date,
  };
  const findings = types.map((type, i) => {
    const finding: AgentFinding = {
      id: platformFixtureId(10 + i),
      runId: run.id,
      findingType: type,
      fingerprint: 'synthetic-finding-' + i,
      subjectKey: 'synthetic-subject-' + i,
      title: 'Fixture vehicle ' + i,
      summary: 'Synthetic observation; no current availability claim.',
      confidence: 0.8,
      requiresReview: i !== 0,
      subject: { brand: run.brand, model: 'Model ' + i },
      proposal: i === 1 ? { action: 'REVIEW_NEW_MODEL' } : null,
      payload: { warnings: i === 3 ? ['INSUFFICIENT_EVIDENCE'] : [] },
      createdAt: date,
      updatedAt: date,
    };
    const evidence: AgentEvidence = {
      id: platformFixtureId(30 + i),
      findingId: finding.id,
      sourceType: 'MODEL_PAGE',
      sourceUrl: 'https://example.com/fixture/' + i,
      sourceDomain: 'example.com',
      title: 'Synthetic source ' + i,
      excerpt: 'Offline fixture evidence.',
      evidenceFingerprint: 'synthetic-evidence-' + i,
      metadata: { synthetic: true },
      capturedAt: date,
      createdAt: date,
    };
    return { finding, evidence: [evidence] };
  });
  const reviews: AgentReview[] = (['ACCEPT', 'REJECT', 'DEFER'] as const).map((decision, i) => ({
    id: platformFixtureId(50 + i),
    findingId: findings[4 + i]!.finding.id,
    decision,
    note: 'Synthetic review',
    reviewedBy: platformFixtureId(100),
    createdAt: date,
  }));
  return { bundle: { run, findings }, reviews };
}
export class InMemoryAgentPlatformStore implements AgentPlatformStore {
  private runRows: AgentRun[] = [];
  private findingRows: AgentFinding[] = [];
  private evidenceRows: AgentEvidence[] = [];
  private reviewRows: AgentReview[] = [];
  async runs(id?: string) {
    return structuredClone(this.runRows.filter((row) => !id || row.id === id));
  }
  async findings(runId?: string, id?: string) {
    return structuredClone(
      this.findingRows.filter((row) => (!runId || row.runId === runId) && (!id || row.id === id)),
    );
  }
  async evidence(findingId: string) {
    return structuredClone(this.evidenceRows.filter((row) => row.findingId === findingId));
  }
  async reviews(findingId?: string) {
    return structuredClone(
      this.reviewRows.filter((row) => !findingId || row.findingId === findingId),
    );
  }
  async insertRun(run: AgentRun) {
    const previous = this.runRows.find((row) => row.id === run.id);
    if (previous) return structuredClone(previous);
    this.runRows.push(structuredClone(run));
    return structuredClone(run);
  }
  async transitionRun(id: string, from: AgentRun['status'], patch: Partial<AgentRun>) {
    const index = this.runRows.findIndex((row) => row.id === id && row.status === from);
    if (index < 0) return false;
    this.runRows[index] = { ...this.runRows[index]!, ...structuredClone(patch) };
    return true;
  }
  async insertFinding(finding: AgentFinding) {
    const previous = this.findingRows.find(
      (row) => row.runId === finding.runId && row.fingerprint === finding.fingerprint,
    );
    if (previous) return structuredClone(previous);
    this.findingRows.push(structuredClone(finding));
    return structuredClone(finding);
  }
  async insertEvidence(evidence: AgentEvidence) {
    const previous = this.evidenceRows.find(
      (row) =>
        row.findingId === evidence.findingId &&
        row.evidenceFingerprint === evidence.evidenceFingerprint,
    );
    if (previous) return structuredClone(previous);
    this.evidenceRows.push(structuredClone(evidence));
    return structuredClone(evidence);
  }
  async insertReview(review: AgentReview) {
    this.reviewRows.push(structuredClone(review));
    return structuredClone(review);
  }
}
