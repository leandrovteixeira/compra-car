import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import { officialCandidateIdentity } from './product-candidate-matcher';
import {
  transmissionComparisonKey,
  powertrainComparisonKey,
} from './product-component-normalization';
import { officialCandidateTextFields } from './official-product-candidate-validation';
import type {
  AgentMarketScope,
  OfficialProductCandidate,
  ProductEvidence,
} from './new-product-check-types';

export function deduplicateProductEvidence(
  evidence: readonly ProductEvidence[],
): readonly ProductEvidence[] {
  // Repeated observations collapse; different short excerpts at the same URL remain auditable.
  return [
    ...new Map(
      evidence.map((e) => [JSON.stringify([e.url, e.title, e.excerpt, e.evidenceType]), e]),
    ).values(),
  ];
}
function merge(a: OfficialProductCandidate, b: OfficialProductCandidate): OfficialProductCandidate {
  const fields = [
    ...officialCandidateTextFields,
    'propulsion',
    'engineDisplacement',
    'productionYear',
    'modelYear',
  ] as const;
  const conflict = fields.some((field) => {
    const left = a[field],
      right = b[field];
    if (left === null || right === null) return false;
    if (typeof left === 'string' && typeof right === 'string') {
      const compare =
        field === 'transmission'
          ? (value: string) => transmissionComparisonKey(value, a.propulsion ?? b.propulsion)
          : field === 'powertrainLabel'
            ? powertrainComparisonKey
            : key;
      return compare(left) !== compare(right);
    }
    return left !== right;
  });
  const result = { ...a };
  for (const field of fields) Object.assign(result, { [field]: a[field] ?? b[field] });
  return {
    ...result,
    confidence: Math.min(a.confidence, b.confidence),
    evidence: deduplicateProductEvidence([...a.evidence, ...b.evidence]),
    extractionWarnings: [
      ...new Set([
        ...(a.extractionWarnings ?? []),
        ...(b.extractionWarnings ?? []),
        ...(conflict || a.taxonomy !== b.taxonomy ? ['CONFLICTING_SOURCES' as const] : []),
      ]),
    ],
  };
}
export function deduplicateOfficialCandidates(
  scope: AgentMarketScope,
  input: readonly OfficialProductCandidate[],
): readonly OfficialProductCandidate[] {
  const groups = new Map<string, OfficialProductCandidate>();
  for (const candidate of input) {
    const identity = JSON.stringify(officialCandidateIdentity(scope, candidate));
    const previous = groups.get(identity);
    groups.set(
      identity,
      previous
        ? merge(previous, candidate)
        : { ...candidate, evidence: deduplicateProductEvidence(candidate.evidence) },
    );
  }
  const specificity = (c: OfficialProductCandidate) =>
    Number(c.propulsion !== null) + Number(c.powertrainLabel !== null);
  const ordered = [...groups.values()].sort((a, b) => specificity(b) - specificity(a));
  const result: OfficialProductCandidate[] = [];
  for (const candidate of ordered) {
    const base = JSON.stringify(officialCandidateIdentity(scope, candidate).slice(0, 5));
    const matches = result
      .map((other, index) => ({ other, index }))
      .filter(
        ({ other }) =>
          specificity(other) > specificity(candidate) &&
          JSON.stringify(officialCandidateIdentity(scope, other).slice(0, 5)) === base &&
          (candidate.propulsion === null || candidate.propulsion === other.propulsion) &&
          (candidate.powertrainLabel === null ||
            (other.powertrainLabel !== null &&
              powertrainComparisonKey(candidate.powertrainLabel) ===
                powertrainComparisonKey(other.powertrainLabel))),
      );
    if (matches.length === 1) {
      const { other, index } = matches[0]!;
      result[index] = merge(other, candidate);
    } else {
      // A sparse XRX must never bridge distinct ICE/HEV identities.
      result.push(
        matches.length > 1
          ? {
              ...candidate,
              extractionWarnings: [
                ...new Set([
                  ...(candidate.extractionWarnings ?? []),
                  'INSUFFICIENT_EVIDENCE' as const,
                ]),
              ],
            }
          : candidate,
      );
    }
  }
  return result;
}
