import { createHash } from 'node:crypto';
import type {
  AgentRunBundle,
  AgentFindingBundle,
  AgentFindingType,
  AgentObject,
} from '../agent-platform/types';
import {
  canonicalAgentJson,
  safeAgentSourceUrl,
  AgentPlatformError,
} from '../agent-platform/rules';
import { officialCandidateIdentity } from './product-candidate-matcher';
import type {
  NewProductCheckResult,
  ProductEvidence,
  OfficialProductCandidate,
} from './new-product-check-types';
export function mmvEvidenceFingerprint(evidence: ProductEvidence): string {
  return createHash('sha256')
    .update(
      canonicalAgentJson([
        'mmv-evidence:v1',
        evidence.url,
        evidence.evidenceType,
        evidence.title,
        evidence.excerpt,
      ]),
    )
    .digest('hex');
}
function candidateDetails(candidate: OfficialProductCandidate): AgentObject {
  const { evidence: _evidence, ...details } = candidate;
  void _evidence;
  return details as unknown as AgentObject;
}
/** Mapping belongs to MMV: the generic platform does not derive official identities. */
export function mapMmvRunToPlatform(
  result: NewProductCheckResult,
  options: {
    readonly provider: string;
    readonly sourceCommitSha?: string | null;
    readonly uuid?: () => string;
  },
): AgentRunBundle {
  const uuid = options.uuid ?? (() => globalThis.crypto.randomUUID());
  const scope = { country: result.market, brand: result.brand };
  const observations = [
    ...result.matchedCandidates.map((match) => ({
      ...match,
      type: 'MMV_MATCHED' as const,
      fingerprint: canonicalAgentJson([
        'mmv-matched:v1',
        ...officialCandidateIdentity(scope, match.candidate),
      ]),
      variants: [],
      warnings: match.candidate.extractionWarnings ?? [],
    })),
    ...result.findings.map((finding) => {
      if (finding.type === 'POSSIBLE_YEAR_CHANGE') throw new AgentPlatformError('INVALID_INPUT');
      return {
        ...finding,
        type: finding.type === 'AMBIGUOUS' ? ('AMBIGUOUS_MMV' as const) : finding.type,
      };
    }),
  ];
  const findings: AgentFindingBundle[] = observations.map((observation) => {
    const id = uuid(),
      candidate = observation.candidate;
    const evidence = [
      ...new Map(
        [...candidate.evidence, ...observation.variants.flatMap((v) => v.evidence)].map((e) => [
          mmvEvidenceFingerprint(e),
          e,
        ]),
      ).entries(),
    ].map(([fingerprint, e]) => {
      const url = safeAgentSourceUrl(e.url);
      if (!url) throw new AgentPlatformError('INVALID_INPUT');
      return {
        id: uuid(),
        findingId: id,
        sourceType: e.evidenceType ?? 'OTHER_OFFICIAL',
        sourceUrl: e.url,
        sourceDomain: new URL(url).hostname,
        title: e.title?.slice(0, 500) ?? null,
        excerpt: e.excerpt?.slice(0, 1000) ?? null,
        evidenceFingerprint: fingerprint,
        metadata: {
          excerptTruncated: (e.excerpt?.length ?? 0) > 1000,
          titleTruncated: (e.title?.length ?? 0) > 500,
        },
        capturedAt: result.completedAt,
        createdAt: result.completedAt,
      };
    });
    const subject: AgentObject = {
      brand: candidate.brand,
      model: candidate.model,
      ...(observation.type === 'NEW_MODEL'
        ? {}
        : { officialVersionLabel: candidate.officialVersionLabel }),
      canonicalMmv: observation.matchedMmvIdentities.map((m) => ({
        id: m.id,
        brand: m.brand,
        model: m.model,
        canonicalVersionLabel: m.canonicalVersionLabel,
      })),
    };
    return {
      finding: {
        id,
        runId: result.runId,
        findingType: observation.type as AgentFindingType,
        fingerprint: observation.fingerprint,
        subjectKey: canonicalAgentJson(
          observation.type === 'NEW_MODEL'
            ? [result.market, candidate.brand, candidate.model]
            : officialCandidateIdentity(scope, candidate),
        ),
        title: [candidate.brand, candidate.model, candidate.officialVersionLabel]
          .filter(Boolean)
          .join(' '),
        summary: observation.reason,
        confidence: candidate.confidence,
        requiresReview: observation.type !== 'MMV_MATCHED',
        subject,
        proposal: null,
        payload: {
          matchMode: observation.matchMode,
          warnings: observation.warnings,
          associatedProductRows: observation.matchedProducts as unknown as AgentObject[],
          structuredCandidate: candidateDetails(candidate),
          resolvedVariants: observation.variants.map(candidateDetails),
        },
        createdAt: result.completedAt,
        updatedAt: result.completedAt,
      },
      evidence,
    };
  });
  return {
    run: {
      id: result.runId,
      agentType: 'MMV_DISCOVERY',
      status: 'COMPLETED',
      market: result.market,
      brand: result.brand,
      provider: options.provider,
      runMode: 'dry-run',
      schemaVersion: result.schemaVersion,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      input: { market: result.market, brand: result.brand },
      summary: {
        totalFindings: findings.length,
        reviewRequired: findings.filter((f) => f.finding.requiresReview).length,
        canonicalProductRows: result.canonicalProductRows,
        knownMmvIdentities: result.knownMmvIdentities,
        matchedCandidates: result.matchedCandidates.length,
        rejectedCandidates: result.rejectedCandidates.length,
        rejectedExternalSources: result.rejectedExternalSources,
      },
      configSnapshot: {
        platformSchemaVersion: '19B.1',
        agentSchemaVersion: result.schemaVersion,
        provider: options.provider,
        persistence: 'operational-only',
      },
      error: null,
      sourceCommitSha: options.sourceCommitSha ?? null,
      createdBy: null,
      createdAt: result.startedAt,
      updatedAt: result.completedAt,
    },
    findings,
  };
}
