import {describe,expect,it} from 'vitest';
import {projectSpecJournalToDb27} from '../src/agents/spec-agent-db-projection';
import type {SpecJournalPlan27} from '../src/agents/spec-agent-persistence-plan';
const plan:SpecJournalPlan27={
  observations:[{productId:'123',modelYear:2027,specCode:'ACC',sourceId:'baic-006',
    sourceHash:'f'.repeat(64),authority:'MANUFACTURER',sourceLocator:'ACC:2',
    availability:'OPTIONAL',numericValue:null,rawValue:'OPTIONAL',measurementOperator:'=',
    measurementMethod:'UNSPECIFIED',inputUnit:null,inheritedFromModelYear:null,
    confirmationStatus:'CONFIRMED'}],
  selections:[{productId:'123',modelYear:2027,specCode:'ACC',measurementMethod:'UNSPECIFIED',
    sourceId:'baic-006',isConfirmed:true}],
  coverage:{productId:'123',modelYear:2027,status:'CONFIRMED',
    confirmedCount:1,pendingCount:0,inheritedCount:0},
  writesApplied:false,
};
const catalog=[{id:'42',code:'ACC',type:'binary' as const,groupName:'Safety',
  equipmentGroup:'ADAS',specSet:'ACC',detail:'ACC',unit:null}];
const input={plan,catalog,sourceDocuments:[{sourceId:'baic-006',
  sourceDocumentId:'00000000-0000-4000-8000-000000000001'}],
  observedAt:'2026-11-03T13:00:00Z'};
describe('Spec Agent DB projection',()=>{
 it('preserves OPTIONAL and uses verified numeric IDs',()=>{
  const result=projectSpecJournalToDb27(input);
  expect(result.writesApplied).toBe(false);
  expect(result.observationInserts).toMatchObject([{product_id:123,spec_id:42,
    model_year:2027,availability:'OPTIONAL'}]);
  expect(result.selectionIntents[0]).toMatchObject({specId:42,isConfirmed:true});
 });
 it('rejects unsaved products, missing source documents and absent spec IDs',()=>{
  expect(()=>projectSpecJournalToDb27({...input,plan:{
    ...plan,coverage:{...plan.coverage,productId:'not-yet-created'}}})).toThrow('SPEC_DB_ID_REQUIRED');
  expect(()=>projectSpecJournalToDb27({...input,sourceDocuments:[]})).toThrow('SPEC_DB_MISSING_SOURCE_DOCUMENT');
  expect(()=>projectSpecJournalToDb27({...input,catalog:[]})).toThrow('SPEC_DB_UNKNOWN_CANONICAL_ID');
 });
});
