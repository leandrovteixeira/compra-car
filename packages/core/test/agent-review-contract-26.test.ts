import {describe,expect,it} from 'vitest';
import {REVIEW_CASE_POLICIES,validateReviewDecision,type ReviewQueueItem,type ReviewDecisionCommand} from '../src/agent-platform';
const row:ReviewQueueItem={
 caseId:'generation-qa',caseKind:'MMV_GENERATION',sourceAgent:'MMV_DISCOVERY',
 sourceFindingType:'AMBIGUOUS_MMV',businessKey:'BR/GWM/H6/2026/2027',
 title:'H6 MY 2026 -> MY 2027',shortDescription:'Generation hypothesis',
 recommendation:'Classificar',confidence:null,evidenceCount:2,
 primaryEvidenceUrl:null,evidencePreview:null,observedAt:'2026-11-04T12:00:00Z',
 status:'WAITING',snapshotFingerprint:'fingerprint-v1',caseVersion:0,
};
const command:ReviewDecisionCommand={caseId:row.caseId,action:'APPROVE',
 expectedCaseVersion:0,expectedSnapshotFingerprint:'fingerprint-v1',
 idempotencyKey:'qa-test-idempotency',actorId:'operator-test'};
describe('Generation uses the existing review decision contract',()=>{
 it('records classification only, no canonical MMV change',()=>{
  const p=REVIEW_CASE_POLICIES.MMV_GENERATION;
  expect(p.actions).toEqual(['APPROVE','REJECT','POSTPONE']);
  expect(p.approveEffect).toBe('NONE');
  expect(validateReviewDecision(row,command).effect).toBe('NONE');
 });
 it('rejects MERGE and stale fingerprint',()=>{
  expect(()=>validateReviewDecision(row,{...command,action:'MERGE',canonicalTargetId:'mmv-id'})).toThrow();
  expect(()=>validateReviewDecision(row,{...command,expectedSnapshotFingerprint:'stale'})).toThrow();
 });
});
