import type { EngineeringGoldenScore } from './engineering-golden-benchmark';
import { evaluateEngineeringGoldenGate } from './engineering-golden-benchmark';

/** Approval gate for proposed patches. Does not execute or merge code. */
export interface EngineeringIterationInput {
  readonly sameSourceSnapshot: boolean;
  readonly sameCanonicalSnapshot: boolean;
  readonly independentGoldenFixture: boolean;
  readonly typecheckPassed: boolean;
  readonly testsPassed: boolean;
  readonly lintPassed: boolean;
  readonly reviewControlsPreserved: boolean;
  readonly evidenceProvenancePreserved: boolean;
  readonly modelYearIdentityPreserved: boolean;
  readonly humanApproved: boolean;
  readonly baseline: EngineeringGoldenScore;
  readonly candidate: EngineeringGoldenScore;
  readonly baselineCostUsd: number | null;
  readonly candidateCostUsd: number | null;
}
export interface EngineeringIterationDecision {
  readonly decision: 'REJECT' | 'REVIEW_REQUIRED';
  readonly safeForProduction: false;
  readonly reasons: readonly string[];
  readonly costDeltaUsd: number | null;
}
export function evaluateEngineeringIteration(input: EngineeringIterationInput): EngineeringIterationDecision {
  const reasons: string[]=[];
  for(const [name,ok] of [
    ['SOURCE_SNAPSHOT',input.sameSourceSnapshot],
    ['CANONICAL_SNAPSHOT',input.sameCanonicalSnapshot],
    ['INDEPENDENT_GOLDEN',input.independentGoldenFixture],
    ['TYPECHECK',input.typecheckPassed],
    ['TESTS',input.testsPassed],
    ['LINT',input.lintPassed],
    ['REVIEW_CONTROLS',input.reviewControlsPreserved],
    ['PROVENANCE',input.evidenceProvenancePreserved],
    ['MODEL_YEAR_IDENTITY',input.modelYearIdentityPreserved],
  ] as const) if(!ok) reasons.push(name+'_GATE_FAILED');
  reasons.push(...evaluateEngineeringGoldenGate(input.baseline,input.candidate).reasons);
  const costs=[input.baselineCostUsd,input.candidateCostUsd];
  if(costs.some(v=>v!==null && (!Number.isFinite(v)||v<0))) reasons.push('INVALID_COST');
  const costDeltaUsd=costs.every(v=>v!==null && Number.isFinite(v) && v>=0)
    ? input.baselineCostUsd! - input.candidateCostUsd! : null;
  if(costDeltaUsd!==null && costDeltaUsd<0) reasons.push('COST_REGRESSION');
  // Human approval never bypasses objective regression gates.
  if(!input.humanApproved) reasons.push('HUMAN_APPROVAL_REQUIRED');
  return {
    decision: reasons.some(x=>x!=='HUMAN_APPROVAL_REQUIRED') ? 'REJECT' : 'REVIEW_REQUIRED',
    safeForProduction:false,
    reasons,
    costDeltaUsd,
  };
}
