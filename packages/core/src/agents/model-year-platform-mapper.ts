import { createHash } from 'node:crypto';
import type {
  AgentFindingBundle,
  AgentFindingType,
  AgentObject,
  AgentRunBundle,
} from '../agent-platform/types';
import {
  canonicalAgentJson,
  safeAgentSourceUrl,
  AgentPlatformError,
} from '../agent-platform/rules';
import type { CurrentMmvDiscoverySnapshot, OfficialProductCandidate } from './new-product-check-types';
import type { ModelYearFindingDraft } from './model-year-contract';

function version(candidate: OfficialProductCandidate): string | null {
  return candidate.officialVersionLabel ?? candidate.trim;
}

function candidateForFinding(
  discovery: CurrentMmvDiscoverySnapshot,
  finding: ModelYearFindingDraft,
): OfficialProductCandidate | null {
  return (
    discovery.candidates.find(
      (candidate) =>
        candidate.brand === finding.subject.brand &&
        candidate.model === finding.subject.model &&
        version(candidate) === finding.subject.officialVersionLabel &&
        candidate.modelYear === finding.subject.modelYear &&
        candidate.productionYear === finding.subject.productionYear,
    ) ?? null
  );
}

function evidenceFingerprint(item: OfficialProductCandidate['evidence'][number]): string {
  return createHash('sha256')
    .update(
      canonicalAgentJson([
        'model-year-evidence:v1',
        item.sourceKind ?? 'MANUFACTURER',
        item.url,
        item.evidenceType,
        item.title,
        item.excerpt,
      ]),
    )
    .digest('hex');
}

function findingFingerprint(finding: ModelYearFindingDraft): string {
  return createHash('sha256')
    .update(
      canonicalAgentJson([
        'product-year-finding:v1',
        finding.findingType,
        finding.reasonCode,
        finding.mmvId,
        finding.subject.brand,
        finding.subject.model,
        finding.subject.officialVersionLabel,
        finding.subject.productionYear,
        finding.subject.modelYear,
      ]),
    )
    .digest('hex');
}

export function mapModelYearRunToPlatform(
  discovery: CurrentMmvDiscoverySnapshot,
  result: { readonly findings: readonly ModelYearFindingDraft[] },
  options: {
    readonly provider: string;
    readonly sourceCommitSha?: string | null;
    readonly uuid?: () => string;
  },
): AgentRunBundle {
  const uuid = options.uuid ?? (() => globalThis.crypto.randomUUID());
  const createdAt = discovery.completedAt;

  const findings: AgentFindingBundle[] = result.findings.map((draft) => {
    const id = uuid();
    const candidate = candidateForFinding(discovery, draft);
    const evidence = (candidate?.evidence ?? []).map((item) => {
      const safeUrl = safeAgentSourceUrl(item.url);
      if (!safeUrl) throw new AgentPlatformError('INVALID_INPUT');
      return {
        id: uuid(),
        findingId: id,
        sourceType: item.evidenceType ?? 'OTHER_OFFICIAL',
        sourceUrl: item.url,
        sourceDomain: new URL(safeUrl).hostname,
        title: item.title?.slice(0, 500) ?? null,
        excerpt: item.excerpt?.slice(0, 1000) ?? null,
        evidenceFingerprint: evidenceFingerprint(item),
        metadata: {
          excerptTruncated: (item.excerpt?.length ?? 0) > 1000,
          titleTruncated: (item.title?.length ?? 0) > 500,
        },
        capturedAt: createdAt,
        createdAt,
      };
    });

    return {
      finding: {
        id,
        runId: discovery.runId,
        findingType: draft.findingType as AgentFindingType,
        fingerprint: findingFingerprint(draft),
        subjectKey: canonicalAgentJson([
          discovery.market,
          draft.subject.brand,
          draft.subject.model,
          draft.subject.officialVersionLabel,
          draft.subject.productionYear,
          draft.subject.modelYear,
        ]),
        title: draft.title,
        summary: draft.summary,
        confidence: draft.confidence,
        requiresReview: draft.requiresReview,
        subject: draft.subject,
        proposal: draft.proposal,
        payload: draft.payload,
        createdAt,
        updatedAt: createdAt,
      },
      evidence,
    };
  });

  return {
    run: {
      id: discovery.runId,
      agentType: 'PRODUCT_YEAR',
      status: 'COMPLETED',
      market: discovery.market,
      brand: discovery.brand,
      provider: options.provider,
      runMode: 'ASSISTED',
      schemaVersion: '21.1',
      startedAt: discovery.startedAt,
      completedAt: discovery.completedAt,
      input: {
        brand: discovery.brand,
        market: discovery.market,
        candidateCount: discovery.candidates.length,
      },
      summary: {
        observations: result.findings.length,
        findings: findings.length,
        reviewRequired: findings.filter((item) => item.finding.requiresReview).length,
        newProductYears: findings.filter(
          (item) => item.finding.findingType === 'NEW_PRODUCT_YEAR' && item.finding.requiresReview,
        ).length,
        identityEscalations: findings.filter(
          (item) => item.finding.findingType === 'POSSIBLE_NEW_MMV',
        ).length,
      },
      configSnapshot: {
        resolver: 'deterministic',
        identityOwner: 'MMV_DISCOVERY',
        applyRequiresReview: true,
      },
      error: null,
      sourceCommitSha: options.sourceCommitSha ?? null,
      createdBy: null,
      createdAt,
      updatedAt: createdAt,
    },
    findings,
  };
}
