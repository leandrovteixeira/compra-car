import {describe,it,expect} from 'vitest';
import {evaluateEngineeringIteration} from '../src/agents/engineering-iteration-gate';
import {scoreEngineeringGolden} from '../src/agents/engineering-golden-benchmark';
const golden=[{id:'synthetic-vw',expectedIdentityKeys:['VW|NIVUS|2026'],expectedRejectedKeys:[]}];
const good=scoreEngineeringGolden(golden,[{id:'synthetic-vw',resolvedIdentityKeys:['VW|NIVUS|2026'],rejectedKeys:[],ambiguousKeys:[]}]);
const base={
 sameSourceSnapshot:true,sameCanonicalSnapshot:true,independentGoldenFixture:true,
 typecheckPassed:true,testsPassed:true,lintPassed:true,reviewControlsPreserved:true,
 evidenceProvenancePreserved:true,modelYearIdentityPreserved:true,humanApproved:false,
 baseline:good,candidate:good,baselineCostUsd:1,candidateCostUsd:0.1,
};
describe('engineering iteration safety gate',()=>{
 it('never authorizes automatic deployment',()=>{
  expect(evaluateEngineeringIteration(base)).toMatchObject({decision:'REVIEW_REQUIRED',safeForProduction:false,costDeltaUsd:0.9});
 });
 it('rejects regression even when user approval is granted',()=>{
  const bad=scoreEngineeringGolden(golden,[{id:'synthetic-vw',resolvedIdentityKeys:['VW|POLO|2026'],rejectedKeys:[],ambiguousKeys:[]}]);
  expect(evaluateEngineeringIteration({...base,candidate:bad,humanApproved:true}).decision).toBe('REJECT');
 });
 it('rejects mismatched snapshot and failing CI',()=>{
  expect(evaluateEngineeringIteration({...base,sameSourceSnapshot:false,lintPassed:false}).reasons)
    .toEqual(expect.arrayContaining(['SOURCE_SNAPSHOT_GATE_FAILED','LINT_GATE_FAILED']));
 });
 it('does not manufacture dollar savings without valid usage',()=>{
  expect(evaluateEngineeringIteration({...base,candidateCostUsd:null}).costDeltaUsd).toBeNull();
 });
});
