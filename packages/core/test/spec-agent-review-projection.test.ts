import { describe, expect, it } from 'vitest';
import { normalizeAliasLabel, type CanonicalAlias } from '../src/agent-platform/canonical-alias-contract';
import { projectApprovedSpecAliases27, projectSpecReviewCandidates27 } from '../src/agents/spec-agent-review-projection';
import type { SpecReconciliation27 } from '../src/agents/spec-agent-reconciliation';
const alias = (status:'CONFIRMED'|'REVOKED', rawLabel:string, canonicalId:string):CanonicalAlias => ({
  id:'alias-1',rawLabel,normalizedLabel:normalizeAliasLabel(rawLabel),canonicalId,status,
  scope:{kind:'SPEC_FIELD',locale:'pt-BR',categoryKey:'ADAS',valueType:'binary',sourceContextKey:'BAIC'},
  sourceUrl:null,sourceFindingId:'finding-1',decisionId:'decision-1',
  confirmedAt:'2026-11-03T12:00:00Z',revokedAt:status==='REVOKED'?'2026-11-03T12:01:00Z':null,
});
describe('Spec Agent canonical integration',()=>{
 it('only projects confirmed existing SPEC_FIELD aliases with exact scope and catalog type',()=>{
   const result=projectApprovedSpecAliases27({
     entries:[alias('CONFIRMED','Cruzeiro adaptativo Stop & Go','canonical-acc'),
              alias('REVOKED','Pilotagem mágica','canonical-acc')],
     catalog:[{specCode:'ACC',canonicalId:'canonical-acc',kind:'binary'}],
     market:'BR',locale:'pt-BR',categoryKey:'ADAS',sourceContextKey:'BAIC'
   });
   expect(result).toEqual([{alias:'Cruzeiro adaptativo Stop & Go',specCode:'ACC',approved:true}]);
 });
 it('projects unknown and conflicted findings into existing review domains, without pretending to persist',()=>{
   const target={productId:'arcfox-max',modelYear:2027,brand:'BAIC',model:'ARCFOX T1',version:'MAX'};
   const reconciliation:SpecReconciliation27={
     target,status:'PENDING_REVIEW',changes:[],specs:[],
     findings:[{code:'UNKNOWN_ALIAS',label:'ACC',message:'Unknown alias'},
               {code:'VALUE_CONFLICT',label:'Potência',message:'Value disagreement'}],
     telemetry:{observations:2,deterministicMatches:0,unmatched:1,inherited:0,changes:0,estimatedCostUsd:0}
   };
   const list=projectSpecReviewCandidates27({reconciliation,observedAt:'2026-11-03T13:00:00Z'});
   expect(list.map(x=>x.caseKind)).toEqual(['SPEC_NEW','SPEC_AMBIGUOUS']);
   expect(list[0]?.businessKey).toBe('arcfox-max:2027');
   expect(list[1]?.status).toBe('WAITING');
 });
});
