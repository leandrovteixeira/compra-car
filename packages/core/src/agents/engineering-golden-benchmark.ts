/**
 * Sprint 22.5C: deterministic, read-only golden benchmark evaluation.
 * Expected answers must come from independently reviewed golden fixtures;
 * never synthesize expected answers from a candidate's own output.
 */
export interface EngineeringGoldenCase {
  readonly id: string;
  readonly expectedIdentityKeys: readonly string[];
  readonly expectedRejectedKeys: readonly string[];
}
export interface EngineeringObservedCase {
  readonly id: string;
  readonly resolvedIdentityKeys: readonly string[];
  readonly rejectedKeys: readonly string[];
  readonly ambiguousKeys: readonly string[];
}
export interface EngineeringGoldenScore {
  readonly cases: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly rejectedCorrectly: number;
  readonly rejectedIncorrectly: number;
  readonly ambiguous: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly caseSignatures: readonly string[];
}
const unique = (items: readonly string[]) => {
  const set = new Set(items);
  if (set.size !== items.length || items.some(x => !x.trim()))
    throw new Error('ENGINEERING_INVALID_IDENTITY');
  return set;
};
export function scoreEngineeringGolden(
  golden: readonly EngineeringGoldenCase[],
  observed: readonly EngineeringObservedCase[],
): EngineeringGoldenScore {
  const ids = unique(golden.map(x => x.id));
  const seen = unique(observed.map(x => x.id));
  if (ids.size !== seen.size || [...ids].some(x => !seen.has(x)))
    throw new Error('ENGINEERING_CASE_SET_MISMATCH');
  const actual = new Map(observed.map(x => [x.id, x]));
  let tp = 0, fp = 0, fn = 0, rejectedCorrectly = 0, rejectedIncorrectly = 0, ambiguous = 0;
  const caseSignatures: string[] = [];
  for (const g of golden) {
    const o = actual.get(g.id)!;
    const expected = unique(g.expectedIdentityKeys);
    const rejected = unique(g.expectedRejectedKeys);
    const resolved = unique(o.resolvedIdentityKeys);
    const refused = unique(o.rejectedKeys);
    const unsure = unique(o.ambiguousKeys);
    if ([...expected].some(x=>rejected.has(x))
        || [...resolved].some(x=>refused.has(x)||unsure.has(x))
        || [...refused].some(x=>unsure.has(x))) throw new Error('ENGINEERING_CONFLICTING_LABELS');
    for (const key of resolved) {
      if (expected.has(key)) tp++;
      else fp++;
    }
    for (const key of expected) if (!resolved.has(key)) fn++;
    for (const key of refused) {
      if (rejected.has(key)) rejectedCorrectly++;
      else rejectedIncorrectly++;
    }
    ambiguous += unsure.size;
    caseSignatures.push(JSON.stringify([g.id,
      [...resolved].sort(), [...refused].sort(), [...unsure].sort()]));
  }
  return {
    cases: golden.length, truePositives: tp, falsePositives: fp, falseNegatives: fn,
    rejectedCorrectly, rejectedIncorrectly, ambiguous,
    precision: tp+fp ? tp/(tp+fp) : null,
    recall: tp+fn ? tp/(tp+fn) : null,
    caseSignatures: caseSignatures.sort(),
  };
}
export interface EngineeringQualityGate {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}
export function evaluateEngineeringGoldenGate(
  baseline: EngineeringGoldenScore,
  candidate: EngineeringGoldenScore,
): EngineeringQualityGate {
  const reasons: string[] = [];
  if (baseline.cases !== candidate.cases) reasons.push('CASE_COUNT_MISMATCH');
  if (candidate.falsePositives > baseline.falsePositives) reasons.push('FALSE_POSITIVE_REGRESSION');
  if (candidate.falseNegatives > baseline.falseNegatives) reasons.push('FALSE_NEGATIVE_REGRESSION');
  if (candidate.truePositives < baseline.truePositives) reasons.push('CORRECT_COVERAGE_REGRESSION');
  if (candidate.rejectedIncorrectly > baseline.rejectedIncorrectly) reasons.push('REJECTION_REGRESSION');
  if (candidate.ambiguous > baseline.ambiguous) reasons.push('AMBIGUITY_REGRESSION');
  return { accepted: reasons.length === 0, reasons };
}
