import {describe,expect,it} from 'vitest';
import {planSpecJournal27} from '../src/agents/spec-agent-persistence-plan';
import type {SpecReconciliation27, SpecEvidence27} from '../src/agents/spec-agent-reconciliation';
const evidence:SpecEvidence27={sourceId:'circular-006',sourceFamilyId:'baic-circular',documentHash:'f'.repeat(64),documentPage:2,capturedAt:'2026-11-03T10:00:00Z',authority:'MANUFACTURER'};
const base:SpecReconciliation27={
 target:{productId:'123',modelYear:2027,brand:'BAIC',model:'ARCFOX T1',version:'MAX'},
 status:'PENDING_REVIEW',findings:[],changes:[],
 specs:[
  {specCode:'ADAS_ACC',kind:'binary',value:'OPTIONAL',evidence,confirmed:true},
  {specCode:'AUTONOMY_WLTC',kind:'numeric',value:310,unit:'km',methodology:'WLTC',comparisonOperator:'>=',evidence,confirmed:true},
  {specCode:'BATTERY_KWH',kind:'numeric',value:42.3,unit:'kWh',inheritedFromModelYear:2026,evidence,confirmed:false},
 ],
 telemetry:{observations:3,deterministicMatches:3,unmatched:0,inherited:1,changes:2,estimatedCostUsd:0}
};
describe('Spec Agent lossless journal planner',()=>{
 it('preserves OPTIONAL, measurement cycle and >= without writing to legacy product_specs',()=>{
  const plan=planSpecJournal27(base);
  expect(plan.writesApplied).toBe(false);
  expect(plan.observations.find(x=>x.specCode==='ADAS_ACC')?.availability).toBe('OPTIONAL');
  expect(plan.observations.find(x=>x.specCode==='AUTONOMY_WLTC')).toMatchObject({numericValue:310,measurementMethod:'WLTC',measurementOperator:'>='});
  expect(plan.observations.find(x=>x.specCode==='BATTERY_KWH')).toMatchObject({confirmationStatus:'INHERITED',inheritedFromModelYear:2026});
  expect(plan.coverage).toMatchObject({confirmedCount:2,pendingCount:1,inheritedCount:1,status:'PENDING_REVIEW'});
 });
 it('does not promote a conflicted previously confirmed value',()=>{
  const plan=planSpecJournal27({...base,findings:[{code:'SOURCE_CONFLICT',label:'WLTC',specCode:'AUTONOMY_WLTC',message:'disagreement'}]});
  expect(plan.selections.find(x=>x.specCode==='AUTONOMY_WLTC')?.isConfirmed).toBe(false);
 });
 it('rejects duplicate canonical metrics even if source text differs',()=>{
  expect(()=>planSpecJournal27({...base,specs:[...base.specs,base.specs[0]!]})).toThrow('SPEC_DUPLICATE_METRIC');
 });
});
