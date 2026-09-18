import { assessSourceFact, sourceFactKey, type SpecQualityDecision } from './spec-source-quality';
import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import type { MmvDiscoveryContext } from './model-year-types';
import type { AgentMarketScope, OfficialBrandSource } from './new-product-check-types';
import { buildModelYearTargets } from './model-year-agent';
import type {
  SourceScope,
  SourceSnapshot,
  SpecApplicability,
  SpecObservation,
  SpecSemanticFact,
  SpecSemanticInput,
  SpecSourceDocument,
  SpecSourceTarget,
} from './spec-source-types';

export const specText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
export const specTargetKey = (t: SpecSourceTarget) =>
  JSON.stringify([t.mmvIdentity, t.officialVersionLabel, t.modelYear]);
export function specObservationTarget(t: SpecSourceTarget): SpecObservation['target'] {
  return {
    mmvIdentity: t.mmvIdentity,
    brand: t.brand,
    model: t.model,
    officialVersionLabel: t.officialVersionLabel,
    modelYear: t.modelYear,
  };
}
export function buildSpecSourceTargets(
  context: MmvDiscoveryContext | null,
  rows: readonly AdministrativeVehicle[],
  scope: AgentMarketScope,
  source: OfficialBrandSource,
): SpecSourceTarget[] {
  return buildModelYearTargets(context, rows, scope, source).targets.flatMap((t) =>
    t.knownModelYears.map((modelYear) => ({
      mmvIdentity: t.mmvIdentity,
      brand: t.officialIdentity.brand,
      model: t.officialIdentity.model,
      catalogVersion: t.canonicalCatalogIdentity.version,
      officialVersionLabel: t.officialIdentity.officialVersionLabel,
      modelYear,
      structuredIdentity: t.structuredIdentity,
      discoveryRunId: context!.run.id,
    })),
  );
}
export function specCacheDecision(
  previous: SourceSnapshot | undefined,
  next: SourceSnapshot,
): 'REUSE' | 'EXTRACT' {
  return previous &&
    previous.finalUrl === next.finalUrl &&
    previous.contentHash === next.contentHash &&
    previous.targetKey === next.targetKey &&
    previous.extractorVersion === next.extractorVersion
    ? 'REUSE'
    : 'EXTRACT';
}
export function specApplicability(
  scope: SourceScope,
  target: SpecSourceTarget,
): SpecApplicability | string {
  if (!scope.model || specText(scope.model) !== specText(target.model)) return 'MODEL_NOT_BOUND';
  if (scope.modelYear !== null && scope.modelYear !== target.modelYear) return 'MY_MISMATCH';
  if (scope.version && specText(scope.version) !== specText(target.officialVersionLabel))
    return 'VERSION_MISMATCH';
  return {
    modelBinding: 'EXACT_MODEL',
    versionBinding: scope.version
      ? scope.matrix
        ? 'VERSION_MATRIX'
        : 'EXACT_VERSION'
      : scope.shared
        ? 'MODEL_SHARED'
        : 'UNRESOLVED',
    yearBinding:
      scope.modelYear !== null ? 'EXACT_MY' : scope.currentLineup ? 'CURRENT_LINEUP' : 'UNRESOLVED',
    confidence: scope.version && scope.modelYear !== null ? 1 : scope.shared ? 0.8 : 0.4,
  };
}
export function specValue(
  label: string,
  value: string,
  unit: string | null,
): SpecObservation['observation'] {
  const negative =
    /^(?:não disponível|nao disponivel|não possui|nao possui|not available|not equipped|ausente)$/iu.test(
      value.trim(),
    );
  const numeric = /^[-+]?\d+(?:[.,]\d+)?$/u.test(value.trim());
  return {
    observedLabel: label,
    rawValue: value,
    rawUnit: unit,
    parsedValue: negative ? false : numeric ? Number(value.replace(',', '.')) : value,
    parsedUnit: unit,
    polarity: negative ? 'EXPLICIT_NEGATIVE' : 'POSITIVE',
  };
}
/** Atomize only explicitly named quantities. Labels stay in source vocabulary. */
export function atomicSpecValues(label: string, value: string, unit: string | null) {
  const atoms: SpecObservation['observation'][] = [];
  const pattern =
    /(cilindrada|potência(?: máxima)?|torque(?: máximo)?)\s*(?:de|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm³|cm3|litros?|L|cv|kW|Nm|kgfm)\b/giu;
  for (const match of value.matchAll(pattern))
    atoms.push(specValue(match[1]!, match[2]!, match[3]!));
  return atoms.length > 1 ? atoms : [specValue(label, value, unit)];
}
export function extractDeterministicSpecs(target: SpecSourceTarget, document: SpecSourceDocument) {
  const observations: SpecObservation[] = [],
    rejections: string[] = [...document.issues];
  const qualityDecisions: {
    fact: (typeof document.facts)[number];
    quality: SpecQualityDecision;
  }[] = [];
  const seen = new Set<string>();
  for (const fact of document.facts) {
    let quality = assessSourceFact(fact, target);
    const key = sourceFactKey(fact);
    if (quality.state !== 'REJECTED' && seen.has(key))
      quality = { state: 'REJECTED', reason: 'DUPLICATE_SOURCE_FACT' };
    qualityDecisions.push({ fact, quality });
    if (quality.state === 'REJECTED') {
      rejections.push(quality.reason);
      continue;
    }
    seen.add(key);
    const applicability = specApplicability(fact.scope, target);
    if (typeof applicability === 'string') {
      rejections.push(applicability);
      continue;
    }
    // Keep unresolved source observations without promoting their applicability.
    if (fact.text.length > 1000 || fact.label.length > 200 || fact.value.length > 500) {
      rejections.push('EVIDENCE_TOO_LARGE');
      continue;
    }
    if (!fact.value.trim() || /^[-–—?]$/u.test(fact.value.trim())) continue;
    for (const observation of atomicSpecValues(fact.label, fact.value, fact.unit)) {
      observations.push({
        target: specObservationTarget(target),
        observation,
        applicability,
        evidence: {
          sourceUrl: document.snapshot.finalUrl,
          sourceKind: document.snapshot.sourceKind,
          evidenceText: fact.text,
          locator: fact.locator,
          contentHash: document.snapshot.contentHash,
        },
        extraction: { method: fact.method, confidence: 1 },
      });
    }
  }
  return { observations, rejections, qualityDecisions };
}
/** Require a local label/value relation, not just two strings somewhere in the same evidence. */
function semanticPairSupported(fact: SpecSemanticFact): boolean {
  const evidence = specText(fact.evidenceText),
    label = specText(fact.observedLabel),
    value = specText(fact.rawValue);
  const start = evidence.indexOf(label);
  if (start < 0) return false;
  const tail = evidence.slice(start + label.length),
    valueAt = tail.indexOf(value);
  if (
    valueAt < 0 ||
    !/^[\s:=]*(?:(?:maxima|maximo|de|com|e|of|is|possui|tem|entrega|desenvolve|atinge|ate|uma|um|a|o)\s+)*$/u.test(
      tail.slice(0, valueAt),
    )
  )
    return false;
  const after = tail.slice(valueAt + value.length);
  if (/^[\p{L}\p{N}]/u.test(after)) return false;
  return fact.rawUnit === null || after.trimStart().startsWith(specText(fact.rawUnit));
}
/** Provider does not set applicability, parsed values, polarity, URL or hash. */
export function validateSemanticSpecs(
  input: SpecSemanticInput,
  facts: readonly SpecSemanticFact[],
) {
  const observations: SpecObservation[] = [],
    rejections: string[] = [];
  for (const fact of facts) {
    if (
      fact.extractionConfidence !== undefined &&
      (!Number.isFinite(fact.extractionConfidence) ||
        fact.extractionConfidence < 0 ||
        fact.extractionConfidence > 1)
    ) {
      rejections.push('INVALID_CONFIDENCE');
      continue;
    }
    const section = input.sections.find((s) => s.locator === fact.locator);
    if (
      !section ||
      !fact.evidenceText?.trim() ||
      !section.text.includes(fact.evidenceText) ||
      !fact.rawValue?.trim() ||
      !fact.evidenceText.includes(fact.rawValue) ||
      (fact.rawUnit !== null && !fact.evidenceText.includes(fact.rawUnit)) ||
      !fact.observedLabel?.trim() ||
      !specText(fact.evidenceText).includes(specText(fact.observedLabel))
    ) {
      rejections.push('INVALID_EVIDENCE');
      continue;
    }
    if (!semanticPairSupported(fact)) {
      rejections.push('INVALID_EVIDENCE');
      continue;
    }
    const applicability = specApplicability(section.scope, input.target);
    if (typeof applicability === 'string') {
      rejections.push(typeof applicability === 'string' ? applicability : 'VERSION_UNRESOLVED');
      continue;
    }
    observations.push({
      target: specObservationTarget(input.target),
      observation: specValue(fact.observedLabel, fact.rawValue, fact.rawUnit),
      applicability,
      evidence: {
        sourceUrl: input.snapshot.finalUrl,
        sourceKind: input.snapshot.sourceKind,
        evidenceText: fact.evidenceText,
        locator: fact.locator,
        contentHash: input.snapshot.contentHash,
      },
      extraction: {
        method: 'SEMANTIC',
        confidence: Math.min(0.8, fact.extractionConfidence ?? 0.8),
      },
    });
  }
  return { observations, rejections };
}
