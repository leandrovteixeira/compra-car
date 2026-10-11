import { createHash } from 'node:crypto';
import { connectorFingerprint, validateConnectorDefinition } from './brand-connector-validation';
import type { BrandConnectorDefinition } from './brand-connector-types';

/** Immutable replay evidence supplied by a separately verified capture. */
export interface BrandReplaySnapshot {
  readonly brand: string;
  readonly market: string;
  readonly sourceUrl: string;
  readonly sourceContentSha256: string;
  readonly capturedAt: string;
}
export interface BrandReplayEvidence {
  readonly connector: BrandConnectorDefinition;
  readonly snapshots: readonly BrandReplaySnapshot[];
  readonly independentReview: boolean;
  readonly reviewReference: string | null;
}
export interface BrandWarmReuseDecision {
  readonly reusable: boolean;
  readonly reason: 'REVIEW_REQUIRED' | 'NO_SOURCES' | 'SOURCE_CHANGED'
    | 'INVALID_SNAPSHOT' | 'CONNECTOR_CHANGED' | 'REUSABLE';
  readonly fingerprint: string | null;
}
const digest=/^[0-9a-f]{64}$/u;
function snapshotDigest(snapshots:readonly BrandReplaySnapshot[]): string {
  const rows=snapshots.map(s=>[s.sourceUrl,s.sourceContentSha256]).sort((a,b)=>a[0]!.localeCompare(b[0]!));
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
/**
 * A warm run is reusable only with independent acceptance, the exact same official
 * source set and verified content hashes. Does not substitute for periodic freshness
 * validation or license unconditional LLM suppression in production.
 */
export function evaluateBrandWarmReuse(
  baseline: BrandReplayEvidence,
  candidate: BrandReplayEvidence,
): BrandWarmReuseDecision {
  if (!baseline.independentReview || !candidate.independentReview ||
    !baseline.reviewReference?.trim() || !candidate.reviewReference?.trim())
    return {reusable:false,reason:'REVIEW_REQUIRED',fingerprint:null};
  let first: BrandConnectorDefinition, second: BrandConnectorDefinition;
  try {
    first=validateConnectorDefinition(baseline.connector);
    second=validateConnectorDefinition(candidate.connector);
  } catch { return {reusable:false,reason:'INVALID_SNAPSHOT',fingerprint:null}; }
  if(connectorFingerprint(first)!==connectorFingerprint(second))
    return {reusable:false,reason:'CONNECTOR_CHANGED',fingerprint:null};
  const required=new Set(first.sourceEntries.map(e=>e.url));
  if(!required.size) return {reusable:false,reason:'NO_SOURCES',fingerprint:null};
  const valid=(e:BrandReplayEvidence)=> {
    const urls=new Set<string>();
    if(e.snapshots.length!==required.size) return false;
    for(const s of e.snapshots){
      if(!required.has(s.sourceUrl)||urls.has(s.sourceUrl)||!digest.test(s.sourceContentSha256)
        ||s.brand!==first.brand||s.market!==first.market
        ||!Number.isFinite(Date.parse(s.capturedAt))) return false;
      urls.add(s.sourceUrl);
    }
    return true;
  };
  if(!valid(baseline)||!valid(candidate))
    return {reusable:false,reason:'INVALID_SNAPSHOT',fingerprint:null};
  const fingerprint=snapshotDigest(candidate.snapshots);
  if(snapshotDigest(baseline.snapshots)!==fingerprint)
    return {reusable:false,reason:'SOURCE_CHANGED',fingerprint};
  return {reusable:true,reason:'REUSABLE',fingerprint};
}
