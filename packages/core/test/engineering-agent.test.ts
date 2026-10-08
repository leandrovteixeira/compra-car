import { describe, expect, it } from 'vitest';
import { evaluateEngineeringCandidate, type EngineeringRunMetrics } from '../src/agents/engineering-agent';

const baseline: EngineeringRunMetrics = {
  target: 'BRAND_CONNECTOR', mode: 'INCREMENTAL',
  discoveredIdentities: 10, verifiedIdentities: 8, rejectedIdentities: 2,
  requestCount: 20, llmCallCount: 2, inputTokens: 5000, outputTokens: 500,
  estimatedCostUsd: 1, sourceCacheHits: 4, sourceCacheMisses: 6, durationMs: 1000,
};
describe('Engineering Agent deterministic evaluation', () => {
  it('never auto-approves a candidate', () => {
    const result = evaluateEngineeringCandidate(baseline, {...baseline, estimatedCostUsd: 0.1});
    expect(result.approvedForAutomaticChanges).toBe(false);
    expect(result.estimatedSavingsUsd).toBeCloseTo(0.9);
  });
  it('blocks dropped verification coverage', () => {
    const result = evaluateEngineeringCandidate(baseline, {...baseline, verifiedIdentities: 7});
    expect(result.findings).toContainEqual(expect.objectContaining({code:'COVERAGE_REGRESSION', severity:'BLOCKER'}));
  });
  it('rejects mismatched run modes and non-finite metrics', () => {
    expect(evaluateEngineeringCandidate(baseline, {...baseline, mode:'BASELINE'}).findings[0].code).toBe('INVALID_METRICS');
    expect(evaluateEngineeringCandidate(baseline, {...baseline, estimatedCostUsd:NaN}).findings[0].code).toBe('INVALID_METRICS');
  });
  it('flags low cache reuse on incremental runs', () => {
    const result = evaluateEngineeringCandidate(baseline, {...baseline, sourceCacheHits:1, sourceCacheMisses:9});
    expect(result.findings.some(f=>f.code==='LOW_CACHE_REUSE')).toBe(true);
  });
});
