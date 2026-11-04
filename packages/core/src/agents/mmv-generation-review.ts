import type {AgentMarketScope,MatchedProductCandidate} from './new-product-check-types';
import type {MmvGenerationAssessment,MmvGenerationClassification} from './mmv-generation-change-classifier';
import {classifyMmvGenerationChange} from './mmv-generation-change-classifier';

/** Evidence acquisition port. Predecessor MY data must come from independently
 * sourced manufacturer documents, never copies of product_specs alone. */
export interface MmvGenerationAssessmentProvider {
  assess(input:{
    readonly scope:AgentMarketScope;
    readonly matchedCandidates:readonly MatchedProductCandidate[];
  }):Promise<readonly MmvGenerationAssessment[]>;
}
export interface MmvGenerationReviewProposal {
  readonly assessment:MmvGenerationAssessment;
  readonly classification:MmvGenerationClassification;
}
/** Bind assessments to an existing, unambiguous MMV. Evidence must use the
 * official manufacturer's domain already validated by discovery.
 *
 * Does not upgrade UNKNOWN to continuity, and never changes canonical rows.
 */
export function projectMmvGenerationReviewProposals(input:{
  readonly matches:readonly MatchedProductCandidate[];
  readonly assessments:readonly MmvGenerationAssessment[];
}):readonly MmvGenerationReviewProposal[]{
  const validMatches=input.matches.filter(m=>m.matchedMmvIdentities.length===1&&
    m.candidate.modelYear!==null);
  const proposals:MmvGenerationReviewProposal[]=[];
  const keys=new Set<string>();
  for(const assessment of input.assessments){
    const matches=validMatches.filter(m=>
      m.matchedMmvIdentities[0]?.id===assessment.currentMmvId &&
      m.candidate.modelYear===assessment.currentModelYear);
    if(matches.length!==1)throw new Error('MMV_GENERATION_MATCH_NOT_UNAMBIGUOUS');
    const candidate=matches[0]!.candidate;
    const hosts=new Set(candidate.evidence.map(e=>new URL(e.url).hostname.toLowerCase()));
    for(const signal of assessment.signals)for(const evidence of signal.evidence){
      const host=new URL(evidence.sourceUrl).hostname.toLowerCase();
      if(!hosts.has(host))throw new Error('MMV_GENERATION_SOURCE_OUT_OF_SCOPE');
      if(evidence.sourceKind==='SECONDARY')throw new Error('MMV_GENERATION_SECONDARY_NOT_ALLOWED_FOR_AUTOMATED_REVIEW');
    }
    const key=[assessment.currentMmvId,assessment.previousModelYear,assessment.currentModelYear].join(':');
    if(keys.has(key))throw new Error('MMV_GENERATION_DUPLICATE_TRANSITION');
    keys.add(key);
    proposals.push({
      assessment,
      classification:classifyMmvGenerationChange(assessment),
    });
  }
  return proposals;
}
