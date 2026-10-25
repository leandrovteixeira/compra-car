import { vehicleTextComparisonKey as key } from '../admin/vehicle-text-normalization';
import {
  deduplicateOfficialCandidates,
  deduplicateProductEvidence,
} from './official-product-candidate-deduplication';
import type {
  AgentMarketScope,
  NewProductFinding,
  OfficialProductCandidate,
} from './new-product-check-types';

export function aggregateProductFindings(
  scope: AgentMarketScope,
  findings: readonly NewProductFinding[],
  observations: readonly OfficialProductCandidate[],
): readonly NewProductFinding[] {
  const modelKey = (candidate: OfficialProductCandidate) =>
    JSON.stringify([scope.country, key(candidate.brand), key(candidate.model)]);
  const newModels = new Map<string, NewProductFinding[]>();
  for (const finding of findings) {
    if (finding.type !== 'NEW_MODEL') continue;
    const identity = modelKey(finding.candidate);
    newModels.set(identity, [...(newModels.get(identity) ?? []), finding]);
  }
  const result = findings.filter((f) => !newModels.has(modelKey(f.candidate)));
  for (const [identity, group] of newModels) {
    const all = observations.filter((c) => modelKey(c) === identity);
    const variants = deduplicateOfficialCandidates(
      scope,
      all.filter(
        (c) => c.taxonomy !== 'MODEL' || c.officialVersionLabel !== null || c.trim !== null,
      ),
    );
    const evidence = deduplicateProductEvidence(all.flatMap((c) => c.evidence));
    const relevant = all.filter((c) => c.taxonomy === 'MODEL' || c.taxonomy === 'VARIANT');
    const representative =
      [...relevant].sort((a, b) => b.confidence - a.confidence)[0] ?? group[0]!.candidate;
    const warnings = [
      ...new Set([
        ...all.flatMap((c) => c.extractionWarnings ?? []),
        ...variants.flatMap((c) => c.extractionWarnings ?? []),
      ]),
    ];
    result.push({
      ...group[0]!,
      variants,
      warnings,
      candidate: {
        brand: representative.brand,
        model: representative.model,
        taxonomy: 'MODEL',
        officialVersionLabel: null,
        trim: null,
        powertrainLabel: null,
        engineDisplacement: null,
        engineLabel: null,
        propulsion: null,
        transmission: null,
        drivetrain: null,
        productionYear: null,
        modelYear: null,
        confidence: representative.confidence,
        evidence,
        extractionWarnings: [],
      },
      reason:
        'Official base model is absent from the administrative catalog; discovered variants and their warnings are attached.',
    });
  }
  return result;
}
