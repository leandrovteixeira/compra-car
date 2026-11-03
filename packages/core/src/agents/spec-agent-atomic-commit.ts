import type { SpecDbProjection27 } from './spec-agent-db-projection';

/** No DML here. The persistence adapter must use a single DB transaction. */
export interface SpecReviewCommit27 {
  readonly caseId:string;
  readonly expectedCaseRevision:number;
  readonly expectedSnapshotFingerprint:string;
  readonly decisionIdempotencyKey:string;
  readonly actorId:string;
  readonly action:'APPROVE'|'MERGE'|'REJECT'|'POSTPONE';
}
export interface SpecAtomicCommitCommand27 {
  readonly target:{productId:number;modelYear:number};
  readonly review:SpecReviewCommit27;
  readonly projection:SpecDbProjection27;
  /** Required to avoid executing an unrelated or stale preview. */
  readonly expectedPreviewFingerprint:string;
}
export interface SpecAtomicCommitReceipt27 {
  readonly commitId:string;
  readonly reviewCaseId:string;
  readonly decisionId:string;
  readonly status:'COMMITTED'|'REPLAYED';
  readonly recordedObservations:number;
  readonly selectedValues:number;
}
export interface SpecAtomicCommitRepository27 {
  /** Single transaction, lock case and catalog rows, recheck source hashes,
   *  authorize server-side actor, insert journal rows and decision together.
   *  Roll back all mutations on errors or stale revisions.
   */
  commitApprovedSpecReview(command:SpecAtomicCommitCommand27):Promise<SpecAtomicCommitReceipt27>;
}
export function validateSpecAtomicCommit27(command:SpecAtomicCommitCommand27):SpecAtomicCommitCommand27 {
  if(!command || command.review.action!=='APPROVE')
    throw new Error('SPEC_REVIEW_NOT_APPROVED');
  const r=command.review;
  if(!r.caseId?.trim() || !r.actorId?.trim() || !r.decisionIdempotencyKey?.trim() ||
    !r.expectedSnapshotFingerprint?.trim() || !command.expectedPreviewFingerprint?.trim() ||
    !Number.isSafeInteger(r.expectedCaseRevision) || r.expectedCaseRevision < 1)
    throw new Error('SPEC_REVIEW_PRECONDITION_MISSING');
  const target=command.target;
  const coverage=command.projection.coverageUpsert;
  if(!Number.isSafeInteger(target.productId) || target.productId < 1 ||
    !Number.isSafeInteger(target.modelYear) ||
    target.productId !== coverage.product_id || target.modelYear !== coverage.model_year)
    throw new Error('SPEC_REVIEW_TARGET_MISMATCH');
  if(command.projection.writesApplied!==false)
    throw new Error('SPEC_ALREADY_APPLIED');
  if(command.projection.observationInserts.some(s=>s.product_id!==target.productId || s.model_year!==target.modelYear))
    throw new Error('SPEC_REVIEW_OBSERVATION_MISMATCH');
  // Intent is not an authorization to publish. A transaction must verify that
  // every CONFIRMED selection is backed by an approved finding or trusted alias.
  if(command.projection.selectionIntents.some(s=>s.isConfirmed && !command.projection.observationInserts
    .some(o=>o.spec_id===s.specId && o.measurement_method===s.measurementMethod && o.confirmation_status==='CONFIRMED')))
    throw new Error('SPEC_REVIEW_UNBACKED_SELECTION');
  return command;
}
