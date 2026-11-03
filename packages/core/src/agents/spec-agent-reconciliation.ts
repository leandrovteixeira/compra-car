/**
 * Sprint 27 — Spec Agent reconciliation kernel (pure / no database writes).
 * The extraction adapter supplies rows and completeness evidence. Unknown aliases
 * are never auto-approved; source precedence is evaluated per comparable metric.
 */
export type SpecAvailability = 'STANDARD' | 'OPTIONAL' | 'NOT_AVAILABLE';
export type SpecCoverageStatus = 'AWAITING_SOURCE' | 'PENDING_REVIEW' | 'CONFIRMED';
export type SpecSourceAuthority = 'REGULATORY' | 'MANUFACTURER' | 'DEALER';
export type SpecKind27 = 'binary' | 'numeric' | 'scale';
export interface SpecTarget27 {
  productId: string;
  modelYear: number;
  brand: string;
  model: string;
  version: string;
}
export interface SpecEvidence27 {
  sourceId: string;
  sourceUrl?: string;
  documentHash: string;
  documentPage?: number;
  sourceFamilyId?: string;
  capturedAt: string;
  authority: SpecSourceAuthority;
  methodology?: string;
}
export interface SpecAlias27 {
  alias: string;
  specCode: string;
  approved: boolean;
  brand?: string;
  model?: string;
  feature?: string;
}
export interface SpecObservation27 {
  label: string;
  kind: SpecKind27;
  value: string | number | SpecAvailability;
  unit?: string;
  /** Regulatory autonomy/consumption values must carry their cycle/standard. */
  methodology?: string;
  comparisonOperator?: '=' | '>=' | '<=';
  feature?: string;
  evidence: SpecEvidence27;
}
export interface CanonicalSpec27 {
  specCode: string;
  kind: SpecKind27;
  value: string | number | SpecAvailability;
  unit?: string;
  methodology?: string;
  comparisonOperator?: '=' | '>=' | '<=';
  evidence?: SpecEvidence27;
  inheritedFromModelYear?: number;
  confirmed: boolean;
}
export interface SpecDocument27 {
  target: SpecTarget27;
  observations: readonly SpecObservation27[];
  /** Only complete, model-year-specific manufacturer tables can imply missing binary equipment. */
  completeEquipmentInventory: boolean;
  evidence: SpecEvidence27;
}
export interface SpecFinding27 {
  code: 'UNKNOWN_ALIAS' | 'AMBIGUOUS_ALIAS' | 'VALUE_CONFLICT' | 'SOURCE_CONFLICT' | 'INCOMPLETE_SOURCE';
  label: string;
  specCode?: string;
  message: string;
  evidence?: SpecEvidence27;
}
export interface SpecChange27 {
  specCode: string;
  previous?: CanonicalSpec27;
  next: CanonicalSpec27;
  reason: 'NEW' | 'RECONFIRMED' | 'UPDATED' | 'INFERRED_NOT_AVAILABLE' | 'INHERITED';
}
export interface SpecReconciliation27 {
  target: SpecTarget27;
  status: SpecCoverageStatus;
  specs: readonly CanonicalSpec27[];
  changes: readonly SpecChange27[];
  findings: readonly SpecFinding27[];
  telemetry: {
    observations: number;
    deterministicMatches: number;
    unmatched: number;
    inherited: number;
    changes: number;
    estimatedCostUsd: number;
  };
}
const normalize = (v: string): string => v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
const identity = (a: SpecTarget27, b: SpecTarget27): boolean =>
  a.productId === b.productId && a.modelYear === b.modelYear;
function resolveAlias(label: string, target: SpecTarget27, aliases: readonly SpecAlias27[], feature?: string): { code?: string; ambiguous: boolean } {
  const found = aliases.filter((alias) =>
    alias.approved && normalize(alias.alias) === normalize(label) &&
    (!alias.brand || normalize(alias.brand) === normalize(target.brand)) &&
    (!alias.model || normalize(alias.model) === normalize(target.model)) &&
    (!alias.feature || (feature !== undefined && normalize(alias.feature) === normalize(feature)))
  );
  if (!found.length) return { ambiguous: false };
  // Prefer the most narrowly scoped approved rule. Ties across codes are unsafe.
  const score = (a: SpecAlias27) => Number(Boolean(a.brand)) + Number(Boolean(a.model)) + Number(Boolean(a.feature));
  const highest = Math.max(...found.map(score));
  const codes = [...new Set(found.filter((a) => score(a) === highest).map((a) => a.specCode))];
  return codes.length === 1 ? { code: codes[0], ambiguous: false } : { ambiguous: true };
}
function sameValue(a: CanonicalSpec27, b: CanonicalSpec27): boolean {
  return a.kind === b.kind && a.value === b.value && (a.unit ?? '') === (b.unit ?? '') && (a.methodology ?? '') === (b.methodology ?? '') && (a.comparisonOperator ?? '=') === (b.comparisonOperator ?? '=');
}
const rank = (s?: SpecEvidence27): number =>
  s?.authority === 'REGULATORY' ? 3 : s?.authority === 'MANUFACTURER' ? 2 : s?.authority === 'DEALER' ? 1 : 0;
export function reconcileSpecDocuments27(input: {
  target: SpecTarget27;
  documents: readonly SpecDocument27[];
  aliases: readonly SpecAlias27[];
  /** Complete canonical binary equipment codes, not every numeric spec. */
  binaryCatalog: readonly string[];
  previousModelYearSpecs?: readonly CanonicalSpec27[];
  /** Required for nonadjacent MY inheritance: never assume previous year = current - 1. */
  predecessorModelYear?: number;
  existingCurrentSpecs?: readonly CanonicalSpec27[];
  estimatedCostUsd?: number;
  budgetUsd?: number;
}): SpecReconciliation27 {
  const { target, documents, aliases } = input;
  const cost = input.estimatedCostUsd ?? 0;
  if (!Number.isFinite(cost) || cost < 0 || cost > (input.budgetUsd ?? 2)) throw new Error('SPEC_BUDGET_EXCEEDED');
  if (documents.some((d) => !identity(d.target, target))) throw new Error('SPEC_TARGET_MISMATCH');
  const findings: SpecFinding27[] = [];
  const changes: SpecChange27[] = [];
  const baseline = new Map<string, CanonicalSpec27>();
  if (input.previousModelYearSpecs?.length && (!Number.isInteger(input.predecessorModelYear) || input.predecessorModelYear! >= target.modelYear))
    throw new Error('SPEC_PREDECESSOR_REQUIRED');
  for (const s of input.previousModelYearSpecs ?? []) baseline.set(s.specCode, { ...s, confirmed: false, inheritedFromModelYear: input.predecessorModelYear });
  for (const s of input.existingCurrentSpecs ?? []) baseline.set(s.specCode, s);
  const next = new Map(baseline);
  let matched = 0;
  let unmatched = 0;
  const seen = new Set<string>();
  const completeDocs = documents.filter((d) => d.completeEquipmentInventory && d.evidence.authority === 'MANUFACTURER');
  const sourceByCode = new Map<string, SpecEvidence27>();
  for (const doc of documents) {
    for (const observation of doc.observations) {
      const match = resolveAlias(observation.label, target, aliases, observation.feature);
      if (!match.code) {
        unmatched++;
        findings.push({ code: match.ambiguous ? 'AMBIGUOUS_ALIAS' : 'UNKNOWN_ALIAS', label: observation.label, message: 'Requires contextual mapping review', evidence: observation.evidence });
        continue;
      }
      matched++;
      const code = match.code;
      if (observation.kind === 'binary' && !['STANDARD','OPTIONAL','NOT_AVAILABLE'].includes(String(observation.value))) {
        findings.push({ code: 'VALUE_CONFLICT', label: observation.label, specCode: code, message: 'Invalid binary availability', evidence: observation.evidence });
        continue;
      }
      const candidate: CanonicalSpec27 = { specCode: code, kind: observation.kind, value: observation.value, unit: observation.unit, methodology: observation.methodology, comparisonOperator: observation.comparisonOperator, evidence: observation.evidence, confirmed: true };
      const prior = next.get(code);
      if (prior && prior.kind !== candidate.kind) {
        findings.push({ code:'VALUE_CONFLICT',label:observation.label,specCode:code,message:'Canonical specification kind mismatch',evidence:observation.evidence });
        continue;
      }
      // Never collapse WLTP, NEDC, WLTC and PBEV into a single metric.
      if (prior && prior.methodology && candidate.methodology && normalize(prior.methodology) !== normalize(candidate.methodology)) {
        findings.push({ code: 'SOURCE_CONFLICT', label: observation.label, specCode: code, message: 'Different measurement methodologies need distinct canonical specifications', evidence: observation.evidence });
        continue;
      }
      // A lower-authority source may corroborate the value, but must never
      // replace regulatory/manufacturer provenance, even when values agree.
      if (prior?.confirmed && sameValue(prior, candidate) &&
          rank(prior.evidence) > rank(candidate.evidence)) {
        seen.add(code);
        continue;
      }
      if (prior && prior.confirmed && !sameValue(prior, candidate)) {
        if (rank(prior.evidence) >= rank(candidate.evidence)) {
          findings.push({ code: 'VALUE_CONFLICT', label: observation.label, specCode: code, message: 'Conflicting confirmed value; manual review required', evidence: observation.evidence });
          continue;
        }
      }
      const earlierInRun = sourceByCode.get(code);
      if (earlierInRun && rank(earlierInRun) === rank(candidate.evidence) && prior && !sameValue(prior, candidate)) {
        findings.push({ code: 'SOURCE_CONFLICT', label: observation.label, specCode: code, message: 'Equal-priority sources disagree', evidence: observation.evidence });
        continue;
      }
      sourceByCode.set(code, candidate.evidence!);
      seen.add(code);
      next.set(code, candidate);
      if (!prior || !sameValue(prior, candidate) || !prior.confirmed) changes.push({ specCode: code, previous: prior, next: candidate, reason: !prior ? 'NEW' : sameValue(prior, candidate) ? 'RECONFIRMED' : 'UPDATED' });
    }
  }
  if (completeDocs.length && unmatched === 0 && !findings.some(f => f.code === 'AMBIGUOUS_ALIAS' || f.code === 'VALUE_CONFLICT' || f.code === 'SOURCE_CONFLICT')) {
    // The complete inventory replaces absent binary equipment only; numeric data remains provisional.
    for (const code of input.binaryCatalog) {
      if (seen.has(code)) continue;
      const prior = next.get(code);
      const candidate: CanonicalSpec27 = { specCode: code, kind: 'binary', value: 'NOT_AVAILABLE', evidence: completeDocs[0].evidence, confirmed: true };
      if (!prior || prior.value !== 'NOT_AVAILABLE' || !prior.confirmed) {
        next.set(code, candidate);
        changes.push({ specCode: code, previous: prior, next: candidate, reason: 'INFERRED_NOT_AVAILABLE' });
      }
    }
  }
  if (!documents.length || (!completeDocs.length && !documents.some((d) => d.observations.length))) {
    findings.push({ code: 'INCOMPLETE_SOURCE', label: target.version, message: 'Awaiting a usable technical source' });
  }
  const specs = [...next.values()];
  const provisional = specs.some((s) => !s.confirmed);
  const status: SpecCoverageStatus = !documents.length ? 'AWAITING_SOURCE' : provisional || findings.length || !completeDocs.length ? 'PENDING_REVIEW' : 'CONFIRMED';
  return { target, status, specs, changes, findings, telemetry: { observations: documents.reduce((n,d)=>n+d.observations.length,0), deterministicMatches: matched, unmatched, inherited: specs.filter(s=>!s.confirmed).length, changes: changes.length, estimatedCostUsd: cost } };
}
