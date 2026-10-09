/** Deterministic failure clustering; no external calls or code mutations. */
export type EngineeringFailureKind =
  | 'SOURCE_ROUTING' | 'IDENTITY_MISMATCH' | 'MISSING_ALIAS'
  | 'STRUCTURED_PARSE_FAILED' | 'HISTORICAL_TARGET' | 'SOURCE_NOISE'
  | 'EVIDENCE_AMBIGUITY' | 'CACHE_MISS' | 'UNKNOWN';
export interface EngineeringFailure {
  readonly targetId: string;
  readonly brand: string;
  readonly model: string;
  readonly sourceType: string;
  readonly reason: string;
  readonly sourceStructure: string;
}
export interface EngineeringFailureCluster {
  readonly key: string;
  readonly kind: EngineeringFailureKind;
  readonly count: number;
  readonly representativeTargetIds: readonly string[];
  readonly recommendedInvestigation: string;
}
function classify(reason: string): EngineeringFailureKind {
  const v=reason.toUpperCase();
  if (v.includes('MODEL_SOURCE_SKIP') || v.includes('SOURCE_ROUTING')) return 'SOURCE_ROUTING';
  if (v.includes('IDENTITY') || v.includes('TARGET_MISS')) return 'IDENTITY_MISMATCH';
  if (v.includes('ALIAS')) return 'MISSING_ALIAS';
  if (v.includes('STRUCTURED') || v.includes('PATTERN_MISS')) return 'STRUCTURED_PARSE_FAILED';
  if (v.includes('HISTORICAL') || v.includes('NOT_CURRENT')) return 'HISTORICAL_TARGET';
  if (v.includes('FINGERPRINT') || v.includes('SOURCE_NOISE')) return 'SOURCE_NOISE';
  if (v.includes('AMBIGUOUS') || v.includes('INSUFFICIENT_EVIDENCE')) return 'EVIDENCE_AMBIGUITY';
  if (v.includes('CACHE_MISS')) return 'CACHE_MISS';
  return 'UNKNOWN';
}
const investigations: Record<EngineeringFailureKind,string> = {
  SOURCE_ROUTING:'Inspect model-scoped official URL routing and deduplication.',
  IDENTITY_MISMATCH:'Inspect canonical identity evidence and conservative reconciliation.',
  MISSING_ALIAS:'Inspect accepted evidence before proposing a reusable alias.',
  STRUCTURED_PARSE_FAILED:'Inspect sanitized source structure for reusable deterministic extraction.',
  HISTORICAL_TARGET:'Review current-vs-historical policy before researching again.',
  SOURCE_NOISE:'Inspect stable semantic fingerprint projections and invalidation.',
  EVIDENCE_AMBIGUITY:'Review conflicting official evidence; never auto-accept.',
  CACHE_MISS:'Inspect source version, cache lineage and semantic equivalence.',
  UNKNOWN:'Collect a bounded sanitized diagnostic sample before proposing a patch.',
};
export function clusterEngineeringFailures(
  failures: readonly EngineeringFailure[],
  maxRepresentatives = 3,
): readonly EngineeringFailureCluster[] {
  if (!Number.isInteger(maxRepresentatives) || maxRepresentatives < 1 || maxRepresentatives > 10)
    throw new Error('ENGINEERING_INVALID_CLUSTER_LIMIT');
  const grouped=new Map<string,{kind:EngineeringFailureKind;targets:Set<string>;count:number}>();
  for(const f of failures) {
    if(!f.targetId.trim() || !f.brand.trim() || !f.sourceType.trim() || !f.reason.trim())
      throw new Error('ENGINEERING_INVALID_FAILURE');
    const kind=classify(f.reason);
    const key=JSON.stringify([kind,f.brand.trim().toLowerCase(),f.model.trim().toLowerCase(),
      f.sourceType.trim().toLowerCase(),f.sourceStructure.trim().toLowerCase()]);
    const existing=grouped.get(key) ?? {kind,targets:new Set<string>(),count:0};
    existing.count++;
    existing.targets.add(f.targetId);
    grouped.set(key,existing);
  }
  return [...grouped.entries()].map(([key,g])=>({
    key,kind:g.kind,count:g.count,
    representativeTargetIds:[...g.targets].sort().slice(0,maxRepresentatives),
    recommendedInvestigation:investigations[g.kind],
  })).sort((a,b)=>b.count-a.count || a.key.localeCompare(b.key));
}
