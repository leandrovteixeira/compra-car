import { describe, expect, it, vi } from 'vitest';
import { runEngineeringEvaluationLoop } from '../src/agents/engineering-evaluation-loop';
import { scoreEngineeringGolden } from '../src/agents/engineering-golden-benchmark';
const golden = [{id:'reviewed-fixture',expectedIdentityKeys:['A'],expectedRejectedKeys:[]}];
const score = scoreEngineeringGolden(golden,[{id:'reviewed-fixture',resolvedIdentityKeys:['A'],rejectedKeys:[],ambiguousKeys:[]}]);
const evidence = {sameSourceSnapshot:true,sameCanonicalSnapshot:true,independentGoldenFixture:true,
  typecheckPassed:true,testsPassed:true,lintPassed:true,reviewControlsPreserved:true,
  evidenceProvenancePreserved:true,modelYearIdentityPreserved:true,humanApproved:false,
  baseline:score,candidate:score,baselineCostUsd:1,candidateCostUsd:0.5};
const proposal = {id:'patch-1',hypothesis:'Unnecessary duplicate source fetches',changedPaths:['packages/core/src/agents/example.ts'],expectedImpact:'Reduce repeated fetches'};
describe('bounded Engineering evaluation loop',()=>{
  it('stops for human review on safe proposal and never deploys',async()=>{
    const run=await runEngineeringEvaluationLoop([proposal],async()=>evidence);
    expect(run.stopReason).toBe('HUMAN_REVIEW_REQUIRED');
    expect(run.iterations[0]).toMatchObject({outcome:'READY_FOR_REVIEW',costDeltaUsd:0.5});
  });
  it('stops after consecutive rejected candidates',async()=>{
    const get=vi.fn(async()=>({...evidence,testsPassed:false}));
    const run=await runEngineeringEvaluationLoop([proposal,{...proposal,id:'patch-2'}],get);
    expect(run).toMatchObject({stopReason:'PLATEAU'});
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('rejects traversal and invalid iteration caps',async()=>{
    await expect(runEngineeringEvaluationLoop([{...proposal,changedPaths:['../outside']}],async()=>evidence)).rejects.toThrow();
    await expect(runEngineeringEvaluationLoop([proposal],async()=>evidence,{maxIterations:0,maxPlateau:1})).rejects.toThrow();
  });
});
