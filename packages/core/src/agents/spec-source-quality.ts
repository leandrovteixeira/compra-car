import { specApplicability, specText } from './spec-source';
import type { SourceFact, SpecSourceTarget } from './spec-source-types';
export interface SpecQualityDecision {
  state: 'ACCEPTED' | 'REJECTED' | 'UNRESOLVED';
  reason: string;
}
export function assessSourceFact(f: SourceFact, target: SpecSourceTarget): SpecQualityDecision {
  const reject = (reason: string): SpecQualityDecision => ({ state: 'REJECTED', reason });
  if (f.text.length > 1000 || f.label.length > 200 || f.value.length > 500)
    return reject('EVIDENCE_TOO_LARGE');
  if (!f.value.trim() || /^[-–—?]$/u.test(f.value.trim()))
    return reject('INSUFFICIENT_FACT_CONTEXT');
  const a = specApplicability(f.scope, target);
  if (typeof a === 'string') return reject(a);
  if (!f.text.includes(f.value) || (f.unit && !f.text.includes(f.unit)))
    return reject('EVIDENCE_NOT_VERBATIM');
  const at = f.text.indexOf(f.value),
    after = f.text[at + f.value.length] ?? '';
  if (/[\p{L}\p{N}]$/u.test(f.value) && /[\p{L}\p{N}]/u.test(after))
    return reject('TRUNCATED_SOURCE_TEXT');
  if (/\.{3,}\s*\d+|(?:veja|ver|see)\s+(?:página|page|p\.)/iu.test(f.text))
    return reject('INDEX_REFERENCE');
  return a.versionBinding === 'UNRESOLVED' || a.yearBinding === 'UNRESOLVED'
    ? { state: 'UNRESOLVED', reason: 'APPLICABILITY_UNRESOLVED' }
    : { state: 'ACCEPTED', reason: 'GROUNDED_SOURCE_FACT' };
}
export function sourceFactKey(f: SourceFact): string {
  return JSON.stringify([
    specText(f.label),
    specText(f.value),
    specText(f.unit ?? ''),
    f.scope.model,
    f.scope.version,
    f.scope.modelYear,
    f.scope.engineDesignation ?? null,
  ]);
}
