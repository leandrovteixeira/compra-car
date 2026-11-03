import type { AdministrativeSpecCatalogItem } from '../admin/administrative-product-specs';
import { normalizeAliasLabel } from '../agent-platform/canonical-alias-contract';
import type { SpecObservation27 } from './spec-agent-reconciliation';

export interface SpecCatalogSuggestion27 {
  readonly specId: string;
  readonly specCode: string;
  readonly label: string;
  readonly kind: AdministrativeSpecCatalogItem['type'];
  readonly score: number;
  readonly reasons: readonly string[];
}
export interface SpecUnresolvedMatch27 {
  readonly observedLabel: string;
  readonly observedKind: SpecObservation27['kind'];
  readonly sourceId: string;
  readonly candidates: readonly SpecCatalogSuggestion27[];
  readonly decision: 'REVIEW_REQUIRED';
}
export interface SpecCatalogDisplay27 extends AdministrativeSpecCatalogItem {
  readonly displayPt?: string | null;
  readonly detailPt?: string | null;
  readonly specSetPt?: string | null;
  readonly equipmentGroupPt?: string | null;
}
const STOPWORDS = new Set(['a','as','o','os','de','da','das','do','dos','com','e','em','para','por','maxima','maximo','tipo','sistema','funcao']);
function tokens(value: string): Set<string> {
  return new Set(normalizeAliasLabel(value).split(' ').filter(t => t.length >= 2 && !STOPWORDS.has(t)));
}
function similarity(left: string, right: string): number {
  const a = tokens(left), b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const part of a) if (b.has(part)) intersection++;
  return intersection / (a.size + b.size - intersection);
}
function phrases(s: SpecCatalogDisplay27): readonly string[] {
  return [s.displayPt, s.detailPt, s.specSetPt, s.detail, s.specSet, s.equipmentGroupPt, s.equipmentGroup]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}
/**
 * Read-only review hints, never a canonical alias. Scores are lexical similarity,
 * NOT calibrated confidence or automatic authorization.
 */
export function suggestCanonicalSpecs27(input: {
  observations: readonly SpecObservation27[];
  catalog: readonly SpecCatalogDisplay27[];
  limit?: number;
}): readonly SpecUnresolvedMatch27[] {
  const limit = input.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('INVALID_SPEC_SUGGESTION_LIMIT');
  return input.observations.map(observed => {
    const candidates: SpecCatalogSuggestion27[] = [];
    for (const spec of input.catalog) {
      if (spec.type !== observed.kind) continue;
      const labels = phrases(spec);
      const exact = labels.some(label => normalizeAliasLabel(label) === normalizeAliasLabel(observed.label));
      const best = Math.max(0,...labels.map(label => similarity(observed.label,label)));
      const sourceUnit = observed.unit?.trim().toLowerCase();
      const targetUnit = spec.unit?.trim().toLowerCase();
      if (observed.kind === 'numeric' && sourceUnit && targetUnit && sourceUnit !== targetUnit) continue;
      const score = exact ? 1 : Math.round(best * 1000) / 1000;
      if (score <= 0) continue;
      candidates.push({
        specId:spec.id,specCode:spec.code,label:spec.displayPt ?? spec.detailPt ?? spec.detail,
        kind:spec.type,score,
        reasons:[exact ? 'EXACT_LABEL' : 'LEXICAL_OVERLAP', ...(sourceUnit && targetUnit ? ['SAME_UNIT'] : [])],
      });
    }
    candidates.sort((a,b)=>b.score-a.score || a.specCode.localeCompare(b.specCode));
    return {
      observedLabel:observed.label,observedKind:observed.kind,
      sourceId:observed.evidence.sourceId,candidates:candidates.slice(0,limit),
      decision:'REVIEW_REQUIRED' as const,
    };
  });
}
