import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import type { NewProductCheckResult, OfficialProductCandidate } from './new-product-check-types';

export interface KnownProductExpectation {
  readonly productId: string;
  readonly candidate: OfficialProductCandidate;
}
export interface ProductFixtureBenchmark {
  readonly brand: string;
  readonly knownProducts: number;
  readonly reconciledKnownProducts: number;
  readonly falseNewProducts: number;
  readonly newModels: number;
  readonly newVersions: number;
  readonly ambiguous: number;
  readonly rejected: number;
  readonly rejectedExternalSources: number;
  /** Ratios in [0, 1]; null when the fixture contains no known products. */
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
/** Ground truth is supplied by the fixture, never inferred from matcher output. */
export function benchmarkProductFixture(
  result: NewProductCheckResult,
  expectations: readonly KnownProductExpectation[],
): ProductFixtureBenchmark {
  const knownIds = new Set(expectations.map((e) => e.productId));
  if (
    knownIds.size !== result.knownProducts ||
    expectations.some((e) => key(e.candidate.brand) !== key(result.brand))
  )
    throw new Error('INVALID_FIXTURE_BENCHMARK_EXPECTATIONS');
  const reconciled = new Set<string>();
  const falseNew = new Set<string>();
  for (const expected of expectations) {
    const uniqueMatch = result.matchedCandidates.some(
      (m) =>
        variantKey(m.candidate) === variantKey(expected.candidate) &&
        m.matchedProductIds.length === 1 &&
        m.matchedProductIds[0] === expected.productId,
    );
    const yearChange = result.findings.some(
      (f) =>
        f.type === 'POSSIBLE_YEAR_CHANGE' &&
        f.matchMode !== null &&
        variantKey(f.candidate) === variantKey(expected.candidate) &&
        f.matchedProductIds.length === 1 &&
        f.matchedProductIds[0] === expected.productId,
    );
    if (uniqueMatch || yearChange) reconciled.add(expected.productId);
    if (
      result.findings.some((f) =>
        f.type === 'NEW_MODEL'
          ? key(f.candidate.brand) === key(expected.candidate.brand) &&
            key(f.candidate.model) === key(expected.candidate.model)
          : f.type === 'NEW_VERSION' && variantKey(f.candidate) === variantKey(expected.candidate),
      )
    )
      falseNew.add(expected.productId);
  }
  return {
    brand: result.brand,
    knownProducts: knownIds.size,
    reconciledKnownProducts: reconciled.size,
    falseNewProducts: falseNew.size,
    newModels: result.findings.filter((f) => f.type === 'NEW_MODEL').length,
    newVersions: result.findings.filter((f) => f.type === 'NEW_VERSION').length,
    ambiguous: result.findings.filter((f) => f.type === 'AMBIGUOUS').length,
    rejected: result.rejectedCandidates.length,
    rejectedExternalSources: result.rejectedExternalSources,
    knownReconciliationRate: knownIds.size ? reconciled.size / knownIds.size : null,
    falseNewRate: knownIds.size ? falseNew.size / knownIds.size : null,
  };
}
