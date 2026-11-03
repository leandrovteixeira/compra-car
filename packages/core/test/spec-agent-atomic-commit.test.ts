import {describe,expect,it} from 'vitest';
import {validateSpecAtomicCommit27,type SpecAtomicCommitCommand27} from '../src/agents/spec-agent-atomic-commit';
const cmd:SpecAtomicCommitCommand27={
 target:{productId:123,modelYear:2027},
 review:{caseId:'case1',expectedCaseRevision:1,expectedSnapshotFingerprint:'fingerprint',
  decisionIdempotencyKey:'idempotency',actorId:'operator',action:'APPROVE'},
 expectedPreviewFingerprint:'preview',
 projection:{writesApplied:false,
  coverageUpsert:{product_id:123,model_year:2027,status:'PENDING_REVIEW',
   confirmed_count:1,pending_count:0,inherited_count:0},
  observationInserts:[{product_id:123,model_year:2027,spec_id:42,
   source_document_id:'doc',source_locator:'page:2',raw_label:'ACC',raw_value:'STANDARD',
   availability:'STANDARD',numeric_value:null,measurement_operator:'=',
   measurement_method:'UNSPECIFIED',input_unit:null,inherited_from_model_year:null,
   confirmation_status:'CONFIRMED',observed_at:'2026-11-03T13:00:00Z'}],
  selectionIntents:[{specId:42,measurementMethod:'UNSPECIFIED',
   isConfirmed:true,sourceDocumentId:'doc'}],
 }
};
describe('Spec Agent atomic review transaction contract',()=>{
 it('accepts a properly bound reviewed plan without performing writes',()=>{
  expect(validateSpecAtomicCommit27(cmd)).toBe(cmd);
 });
 it('rejects non-approval, stale/missing review preconditions and target mismatches',()=>{
  expect(()=>validateSpecAtomicCommit27({...cmd,review:{...cmd.review,action:'POSTPONE'}})).toThrow('SPEC_REVIEW_NOT_APPROVED');
  expect(()=>validateSpecAtomicCommit27({...cmd,review:{...cmd.review,expectedCaseRevision:0}})).toThrow('SPEC_REVIEW_PRECONDITION_MISSING');
  expect(()=>validateSpecAtomicCommit27({...cmd,target:{productId:234,modelYear:2027}})).toThrow('SPEC_REVIEW_TARGET_MISMATCH');
 });
 it('rejects confirmed selections that are not backed by a confirmed observation',()=>{
  const selectionIntents=[{specId:43,measurementMethod:'WLTP',isConfirmed:true,sourceDocumentId:'doc'}];
  expect(()=>validateSpecAtomicCommit27({...cmd,projection:{...cmd.projection,selectionIntents}})).toThrow('SPEC_REVIEW_UNBACKED_SELECTION');
 });
});
