import { createHash, randomUUID } from 'node:crypto';
import {
  assertAgentUuid,
  canonicalAgentJson,
  type AgentObject,
  type AgentRunBundle,
} from '../agent-platform';
import {
  brandKey,
  connectorFingerprint,
  connectorMarket,
  connectorText,
  safeConnectorUrl,
  validateConnectorDefinition,
} from './brand-connector-validation';
import type {
  BrandConnectorResearch,
  BrandConnectorResearchInput,
  BrandConnectorResearchProvider,
} from './brand-connector-types';

export class BrandConnectorAgent {
  constructor(private readonly research: BrandConnectorResearchProvider) {}
  async run(
    input: BrandConnectorResearchInput,
    runId = randomUUID(),
    provider = 'fixture',
  ): Promise<AgentRunBundle> {
    assertAgentUuid(runId);
    connectorText(input.brand, 100);
    connectorMarket(input.market);
    if (
      input.mode === 'health-check' &&
      (!input.activeConnector || input.activeConnector.status !== 'ACTIVE')
    )
      throw new Error('BRAND_CONNECTOR_REQUIRED');
    if (
      input.activeConnector &&
      (brandKey(input.activeConnector.brand) !== brandKey(input.brand) ||
        input.activeConnector.market !== input.market)
    )
      throw new Error('CONNECTOR_SCOPE_MISMATCH');
    if (input.mode === 'discover' && input.activeConnector)
      throw new Error('CONNECTOR_ALREADY_ACTIVE');
    const startedAt = new Date().toISOString();
    const result = await this.research.researchConnector(input);
    return mapBrandConnectorRun(input, result, runId, provider, startedAt);
  }
}
export function mapBrandConnectorRun(
  input: BrandConnectorResearchInput,
  result: BrandConnectorResearch,
  runId: string,
  provider: string,
  startedAt: string,
): AgentRunBundle {
  const noReplacement =
    input.mode === 'health-check' &&
    Array.isArray(result.candidateDomains) &&
    result.candidateDomains.length === 0;
  const proposal = validateConnectorDefinition(
    noReplacement
      ? input.activeConnector
      : {
          ...result,
          allowedDomains: result.candidateDomains,
        },
  );
  if (
    brandKey(result.brand) !== brandKey(input.brand) ||
    result.market !== input.market ||
    brandKey(proposal.brand) !== brandKey(input.brand) ||
    proposal.market !== input.market ||
    !Number.isFinite(result.confidence) ||
    result.confidence < 0 ||
    result.confidence > 1 ||
    typeof result.driftDetected !== 'boolean'
  )
    throw new Error('INVALID_CONNECTOR_RESEARCH');
  const verificationSummary = connectorText(result.verificationSummary, 2000);
  if (
    !Array.isArray(result.warnings) ||
    result.warnings.length > 40 ||
    !Array.isArray(result.checksPerformed) ||
    result.checksPerformed.length > 100 ||
    !Array.isArray(result.evidence) ||
    !result.evidence.length ||
    result.evidence.length > 100
  )
    throw new Error('INVALID_CONNECTOR_RESEARCH');
  const warnings = result.warnings.map((w) => connectorText(w)),
    checksPerformed = result.checksPerformed.map((c) => connectorText(c));
  const observedEvidence = result.evidence.map((e) => {
    const url = safeConnectorUrl(e.url);
    if (!url) throw new Error('INVALID_CONNECTOR_EVIDENCE');
    return { url, title: connectorText(e.title), excerpt: connectorText(e.excerpt, 1000) };
  });
  if (
    !noReplacement &&
    !proposal.allowedDomains.every((d) =>
      observedEvidence.some(
        (e) => new URL(e.url).hostname === d || new URL(e.url).hostname.endsWith('.' + d),
      ),
    )
  )
    throw new Error('CONNECTOR_DOMAIN_EVIDENCE_REQUIRED');
  const fingerprint = connectorFingerprint(proposal);
  const drift =
    input.mode === 'health-check' &&
    (noReplacement ||
      result.driftDetected ||
      input.activeConnector?.fingerprint !== fingerprint ||
      result.confidence < 0.7 ||
      checksPerformed.length === 0 ||
      warnings.length > 0);
  const findingType =
    input.mode === 'discover'
      ? 'NEW_BRAND_CONNECTOR'
      : drift
        ? 'CONNECTOR_DRIFT'
        : 'CONNECTOR_HEALTHY';
  const completedAt = new Date().toISOString(),
    findingId = randomUUID();
  const payload: AgentObject = {
    warnings,
    verificationSummary,
    candidateDomains: noReplacement ? [] : proposal.allowedDomains,
    sourceEntries: proposal.sourceEntries as unknown as AgentObject[],
    sourceCoverage: [...new Set(proposal.sourceEntries.map((e) => e.type))],
    checksPerformed,
    connectorFingerprint: fingerprint,
    ...(input.activeConnector
      ? { previousConnectorFingerprint: input.activeConnector.fingerprint }
      : {}),
  };
  return {
    run: {
      id: runId,
      agentType: 'BRAND_CONNECTOR',
      status: 'COMPLETED',
      brand: proposal.brand,
      market: proposal.market,
      provider,
      runMode: input.mode,
      schemaVersion: '19C.1',
      startedAt,
      completedAt,
      input: { brand: proposal.brand, market: proposal.market, mode: input.mode },
      summary: { findingType, confidence: result.confidence },
      configSnapshot: { connectorVersion: input.activeConnector?.version ?? null },
      error: null,
      sourceCommitSha: null,
      createdBy: null,
      createdAt: startedAt,
      updatedAt: completedAt,
    },
    findings: [
      {
        finding: {
          id: findingId,
          runId,
          findingType,
          fingerprint: canonicalAgentJson([findingType, fingerprint]),
          subjectKey: canonicalAgentJson([proposal.market, brandKey(proposal.brand)]),
          title: proposal.brand + ' / ' + proposal.market + ' — ' + findingType,
          summary: verificationSummary,
          confidence: result.confidence,
          requiresReview: findingType !== 'CONNECTOR_HEALTHY',
          subject: {
            brand: proposal.brand,
            market: proposal.market,
            connectorVersion: input.activeConnector?.version ?? null,
          },
          proposal:
            findingType === 'CONNECTOR_HEALTHY' || noReplacement
              ? null
              : (proposal as unknown as AgentObject),
          payload,
          createdAt: completedAt,
          updatedAt: completedAt,
        },
        evidence: [
          ...new Map(observedEvidence.map((e) => [canonicalAgentJson(e), e])).entries(),
        ].map(([identity, e]) => ({
          id: randomUUID(),
          findingId,
          sourceType: 'OFFICIAL_DOMAIN_VERIFICATION',
          sourceUrl: e.url,
          sourceDomain: new URL(e.url).hostname,
          title: e.title,
          excerpt: e.excerpt,
          evidenceFingerprint: createHash('sha256').update(identity).digest('hex'),
          metadata: { candidateOnly: true, synthetic: provider === 'fixture' },
          capturedAt: completedAt,
          createdAt: completedAt,
        })),
      },
    ],
  };
}
