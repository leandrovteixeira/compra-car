/**
 * Sprint 22.5 — read-only, deterministic Engineering Agent evaluator.
 * The Price Agent supplies the architectural reference; it is not a refactoring target.
 * No network, LLM, database writes or production actions are performed here.
 */
export type EngineeringTarget = 'BRAND_CONNECTOR' | 'MMV_DISCOVERY' | 'MODEL_YEAR' | 'SPEC' | 'PRICE';
export type EngineeringMode = 'BASELINE' | 'INCREMENTAL';
export interface EngineeringRunMetrics {
  readonly target: EngineeringTarget;
  readonly mode: EngineeringMode;
  readonly discoveredIdentities: number;
  readonly verifiedIdentities: number;
  readonly rejectedIdentities: number;
  readonly requestCount: number;
  readonly llmCallCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly sourceCacheHits: number;
  readonly sourceCacheMisses: number;
  readonly durationMs: number;
}
export type EngineeringFindingCode =
  | 'INVALID_METRICS'
  | 'COST_REGRESSION'
  | 'COVERAGE_REGRESSION'
  | 'LOW_CACHE_REUSE'
  | 'UNNECESSARY_LLM_CALLS'
  | 'MANUAL_REVIEW_REQUIRED';
export interface EngineeringFinding {
  readonly code: EngineeringFindingCode;
  readonly severity: 'INFO' | 'WARNING' | 'BLOCKER';
  readonly explanation: string;
}
export interface EngineeringEvaluation {
  readonly target: EngineeringTarget;
  readonly approvedForAutomaticChanges: false;
  readonly estimatedSavingsUsd: number | null;
  readonly findings: readonly EngineeringFinding[];
}
function valid(m: EngineeringRunMetrics): boolean {
  return [
    m.discoveredIdentities, m.verifiedIdentities, m.rejectedIdentities,
    m.requestCount, m.llmCallCount, m.inputTokens, m.outputTokens,
    m.estimatedCostUsd, m.sourceCacheHits, m.sourceCacheMisses, m.durationMs,
  ].every(v => Number.isFinite(v) && v >= 0)
    && m.verifiedIdentities <= m.discoveredIdentities
    && m.rejectedIdentities <= m.discoveredIdentities;
}
/** A baseline and candidate must represent the same target and mode. */
export function evaluateEngineeringCandidate(
  baseline: EngineeringRunMetrics,
  candidate: EngineeringRunMetrics,
): EngineeringEvaluation {
  const findings: EngineeringFinding[] = [];
  if (baseline.target !== candidate.target || baseline.mode !== candidate.mode
    || !valid(baseline) || !valid(candidate)) {
    return {
      target: candidate.target,
      approvedForAutomaticChanges: false,
      estimatedSavingsUsd: null,
      findings: [{ code: 'INVALID_METRICS', severity: 'BLOCKER',
        explanation: 'Metrics are invalid or runs are not comparable.' }],
    };
  }
  if (candidate.estimatedCostUsd > baseline.estimatedCostUsd) {
    findings.push({ code: 'COST_REGRESSION', severity: 'WARNING',
      explanation: 'Candidate costs more than its matching baseline.' });
  }
  if (candidate.verifiedIdentities < baseline.verifiedIdentities
      || candidate.rejectedIdentities < baseline.rejectedIdentities) {
    findings.push({ code: 'COVERAGE_REGRESSION', severity: 'BLOCKER',
      explanation: 'Identity verification/rejection counts dropped; investigate before adoption.' });
  }
  const cacheTotal = candidate.sourceCacheHits + candidate.sourceCacheMisses;
  if (candidate.mode === 'INCREMENTAL' && cacheTotal > 0
    && candidate.sourceCacheHits / cacheTotal < 0.5) {
    findings.push({ code: 'LOW_CACHE_REUSE', severity: 'WARNING',
      explanation: 'Incremental run reused fewer than half of eligible source snapshots.' });
  }
  if (candidate.mode === 'INCREMENTAL' && candidate.llmCallCount > 0
    && candidate.verifiedIdentities === baseline.verifiedIdentities
    && candidate.discoveredIdentities === baseline.discoveredIdentities) {
    findings.push({ code: 'UNNECESSARY_LLM_CALLS', severity: 'INFO',
      explanation: 'Review LLM calls in an incremental run with unchanged identity counts.' });
  }
  findings.push({ code: 'MANUAL_REVIEW_REQUIRED', severity: 'INFO',
    explanation: 'Passing these heuristic checks never authorizes deployment or data changes.' });
  return {
    target: candidate.target,
    approvedForAutomaticChanges: false,
    estimatedSavingsUsd: baseline.estimatedCostUsd - candidate.estimatedCostUsd,
    findings,
  };
}
