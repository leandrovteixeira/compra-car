import { createHash } from 'node:crypto';
import type { BrandConnectorResearch } from './brand-connector-types';
import { connectorFingerprint } from './brand-connector-validation';
import type { BrandReplayEvidence } from './engineering-brand-replay';
import { evaluateBrandWarmReuse } from './engineering-brand-replay';

export interface BrandAcceptedReplay {
  readonly brand: string;
  readonly market: string;
  readonly reviewedFindingId: string;
  readonly connectorFingerprint: string;
  readonly sourceSetFingerprint: string;
  readonly research: BrandConnectorResearch;
}
export interface BrandReplayCheck {
  readonly canReuse: boolean;
  readonly reason: 'REVIEW_REQUIRED'|'CONNECTOR_CHANGED'|'SOURCE_CHANGED'|
    'INVALID_SNAPSHOT'|'NO_SOURCES'|'REPLAY_IDENTITY_MISMATCH'|'REUSABLE';
}
/**
 * Explicit review-gated reuse admission only. The actual Brand Connector remains
 * unchanged. Caller must independently authenticate review and revalidate freshness.
 */
export function checkAcceptedBrandReplay(
  accepted: BrandAcceptedReplay,
  original: BrandReplayEvidence,
  current: BrandReplayEvidence,
): BrandReplayCheck {
  const match = evaluateBrandWarmReuse(original,current);
  if (!match.reusable) return {canReuse:false,reason:match.reason};
  if (!accepted.reviewedFindingId.trim() || !accepted.reviewedFindingId.match(
    /^[a-f0-9-]{36}$/iu)) return {canReuse:false,reason:'REVIEW_REQUIRED'};
  if (accepted.brand!==current.connector.brand || accepted.market!==current.connector.market
    || accepted.research.market!==current.connector.market
    || accepted.connectorFingerprint!==connectorFingerprint(current.connector))
    return {canReuse:false,reason:'REPLAY_IDENTITY_MISMATCH'};
  if (accepted.sourceSetFingerprint!==match.fingerprint)
    return {canReuse:false,reason:'SOURCE_CHANGED'};
  if (!accepted.research.evidence.length) return {canReuse:false,reason:'REPLAY_IDENTITY_MISMATCH'};
  const domains=current.connector.allowedDomains;
  if (!accepted.research.evidence.every(e=>{
    try {const h=new URL(e.url).hostname;
      return domains.some(d=>h===d||h.endsWith('.'+d));} catch{return false;}
  })) return {canReuse:false,reason:'REPLAY_IDENTITY_MISMATCH'};
  return {canReuse:true,reason:'REUSABLE'};
}
export function brandResearchDigest(value:BrandConnectorResearch):string{
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
