import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { NewProductCheckResult, OfficialProductCandidate } from './new-product-check-types';

export interface KnownProductExpectation {
  readonly mmvIdentityId: string;
  readonly candidate: OfficialProductCandidate;
}
export interface ProductFixtureBenchmark {
  readonly brand: string;
  readonly canonicalProductRows: number;
  readonly knownMmvIdentities: number;
  readonly officialCandidates: number;
  readonly matchedMmvCandidates: number;
  readonly reconciledKnownMmvIdentities: number;
  readonly falseNewMmv: number;
  readonly newModels: number;
  readonly newVersions: number;
  readonly ambiguous: number;
  readonly rejected: number;
  readonly rejectedExternalSources: number;
  readonly knownReconciliationRate: number | null;
  readonly falseNewRate: number | null;
}
const variantKey = (c: OfficialProductCandidate) =>
  JSON.stringify([
    key(c.brand),
    key(c.model),
    c.officialVersionLabel === null ? null : key(c.officialVersionLabel),
    c.trim === null ? null : key(c.trim),
    c.propulsion,
    c.powertrainLabel === null ? null : key(c.powertrainLabel),
  ]);
/** MMV ground truth is declared by each fixture, not inferred from row counts or matcher decisions. */
export function benchmarkProductFixture(
  result: NewProductCheckResult,
  expectations: readonly KnownProductExpectation[],
): ProductFixtureBenchmark {
  const knownIds = new Set(expectations.map((e) => e.mmvIdentityId));
  if (
    knownIds.size !== result.knownMmvIdentities ||
    expectations.some((e) => key(e.candidate.brand) !== key(result.brand))
  )
    throw new Error('INVALID_FIXTURE_BENCHMARK_EXPECTATIONS');
  const reconciled = new Set<string>(),
    falseNew = new Set<string>();
  for (const expected of expectations) {
    if (
      result.matchedCandidates.some(
        (m) =>
          variantKey(m.candidate) === variantKey(expected.candidate) &&
          m.matchedMmvIdentities.length === 1 &&
          m.matchedMmvIdentities[0]!.id === expected.mmvIdentityId,
      )
    )
      reconciled.add(expected.mmvIdentityId);
    if (
      result.findings.some((f) =>
        f.type === 'NEW_MODEL'
          ? key(f.candidate.brand) === key(expected.candidate.brand) &&
            key(f.candidate.model) === key(expected.candidate.model)
          : f.type === 'NEW_VERSION' && variantKey(f.candidate) === variantKey(expected.candidate),
      )
    )
      falseNew.add(expected.mmvIdentityId);
  }
  return {
    brand: result.brand,
    canonicalProductRows: result.canonicalProductRows,
    knownMmvIdentities: knownIds.size,
    officialCandidates: result.researchedCandidates,
    matchedMmvCandidates: result.matchedCandidates.length,
    reconciledKnownMmvIdentities: reconciled.size,
    falseNewMmv: falseNew.size,
    newModels: result.findings.filter((f) => f.type === 'NEW_MODEL').length,
    newVersions: result.findings.filter((f) => f.type === 'NEW_VERSION').length,
    ambiguous: result.findings.filter((f) => f.type === 'AMBIGUOUS').length,
    rejected: result.rejectedCandidates.length,
    rejectedExternalSources: result.rejectedExternalSources,
    knownReconciliationRate: knownIds.size ? reconciled.size / knownIds.size : null,
    falseNewRate: knownIds.size ? falseNew.size / knownIds.size : null,
  };
}
