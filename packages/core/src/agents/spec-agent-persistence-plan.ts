import type {
  CanonicalSpec27, SpecReconciliation27, SpecSourceAuthority,
} from './spec-agent-reconciliation';

export type SpecJournalConfirmation27 = 'INHERITED' | 'PENDING_REVIEW' | 'CONFIRMED';

export interface SpecObservationDraft27 {
  productId: string;
  modelYear: number;
  specCode: string;
  sourceId: string;
  sourceHash: string;
  authority: SpecSourceAuthority;
  sourceLocator: string;
  availability: 'STANDARD' | 'OPTIONAL' | 'NOT_AVAILABLE' | null;
  numericValue: number | null;
  rawValue: string;
  measurementOperator: '=' | '>=' | '<=';
  measurementMethod: string;
  inputUnit: string | null;
  inheritedFromModelYear: number | null;
  confirmationStatus: SpecJournalConfirmation27;
}
export interface SpecSelectedValueDraft27 {
  productId: string;
  modelYear: number;
  specCode: string;
  measurementMethod: string;
  sourceId: string;
  /** False requires a review path; the value is not publicly confirmed. */
  isConfirmed: boolean;
}
export interface SpecJournalPlan27 {
  observations: readonly SpecObservationDraft27[];
  selections: readonly SpecSelectedValueDraft27[];
  coverage: {
    productId: string;
    modelYear: number;
    status: SpecReconciliation27['status'];
    confirmedCount: number;
    pendingCount: number;
    inheritedCount: number;
  };
  /** Existing confirmed records are never deleted by this planning function. */
  writesApplied: false;
}
const unavailable = (s: CanonicalSpec27): boolean =>
  s.kind === 'binary' && !['STANDARD','OPTIONAL','NOT_AVAILABLE'].includes(String(s.value));
const descriptor = (s: CanonicalSpec27) => JSON.stringify([
  s.specCode,s.kind,s.value,s.unit??null,s.methodology??null,
  s.comparisonOperator??'=',s.evidence?.sourceId??null
]);
/**
 * Lossless persistence draft. No SQL I/O, no promotion of unreviewed conflicts.
 * Any database writer MUST provide transactional validation of product/MY,
 * approved alias binding, review decisions and source fingerprint.
 */
export function planSpecJournal27(reconciliation: SpecReconciliation27): SpecJournalPlan27 {
  const target = reconciliation.target;
  if (!target.productId?.trim() || !Number.isInteger(target.modelYear))
    throw new Error('INVALID_SPEC_TARGET');
  const conflictCodes = new Set(
    reconciliation.findings
      .filter(f => f.specCode && (f.code === 'VALUE_CONFLICT' || f.code === 'SOURCE_CONFLICT'))
      .map(f => f.specCode!)
  );
  const observations: SpecObservationDraft27[] = [];
  const selections: SpecSelectedValueDraft27[] = [];
  const keys = new Set<string>();
  for (const s of reconciliation.specs) {
    if (unavailable(s)) throw new Error('INVALID_SPEC_BINARY_VALUE');
    if (s.kind === 'numeric' && (typeof s.value !== 'number' || !Number.isFinite(s.value)))
      throw new Error('INVALID_SPEC_NUMERIC_VALUE');
    if (s.kind !== 'numeric' && typeof s.value === 'number' && s.kind === 'binary')
      throw new Error('INVALID_SPEC_BINARY_VALUE');
    if (s.kind === 'scale') continue; // scale selection needs family/option mapping
    if (!s.evidence) continue; // inherited without sourced provenance needs source lookup
    const identity = JSON.stringify([s.specCode,s.methodology??'UNSPECIFIED']);
    if (keys.has(identity)) throw new Error('SPEC_DUPLICATE_METRIC');
    keys.add(identity);
    const isInherited = !s.confirmed || s.inheritedFromModelYear !== undefined;
    const conflicted = conflictCodes.has(s.specCode);
    const state: SpecJournalConfirmation27 = isInherited ? 'INHERITED' :
      conflicted || reconciliation.findings.some(f=>f.code==='AMBIGUOUS_ALIAS' && f.specCode===s.specCode)
        ? 'PENDING_REVIEW' : 'CONFIRMED';
    observations.push({
      productId:target.productId, modelYear:target.modelYear,specCode:s.specCode,
      sourceId:s.evidence.sourceId,sourceHash:s.evidence.documentHash,
      authority:s.evidence.authority,
      sourceLocator:`${s.specCode}:${s.evidence.documentPage??'unknown'}`,
      availability:s.kind==='binary' ? s.value as SpecObservationDraft27['availability'] : null,
      numericValue:s.kind==='numeric' ? s.value as number : null,
      rawValue:String(s.value),
      measurementOperator:s.comparisonOperator??'=',
      measurementMethod:s.methodology??'UNSPECIFIED',
      inputUnit:s.unit??null,
      inheritedFromModelYear:s.inheritedFromModelYear??null,
      confirmationStatus:state,
    });
    selections.push({
      productId:target.productId,modelYear:target.modelYear,
      specCode:s.specCode,measurementMethod:s.methodology??'UNSPECIFIED',
      sourceId:s.evidence.sourceId,isConfirmed:state==='CONFIRMED',
    });
  }
  const confirmedCount=observations.filter(o=>o.confirmationStatus==='CONFIRMED').length;
  const inheritedCount=observations.filter(o=>o.confirmationStatus==='INHERITED').length;
  const pendingCount=observations.length-confirmedCount;
  return {
    observations,selections,
    coverage:{productId:target.productId,modelYear:target.modelYear,
      status:reconciliation.status,confirmedCount,pendingCount,inheritedCount},
    writesApplied:false,
  };
}
