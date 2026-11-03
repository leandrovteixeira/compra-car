import type { AdministrativeSpecCatalogItem } from '../admin/administrative-product-specs';
import type { SpecJournalPlan27 } from './spec-agent-persistence-plan';

/** Lossless input prepared for a future authorized, atomic server transaction. */
export interface SpecDbObservationInsert27 {
  product_id: number;
  model_year: number;
  spec_id: number;
  source_document_id: string;
  source_locator: string;
  raw_label: string;
  raw_value: string;
  availability: 'STANDARD'|'OPTIONAL'|'NOT_AVAILABLE'|null;
  numeric_value: number|null;
  measurement_operator: '='|'>='|'<=' ;
  measurement_method: string;
  input_unit: string|null;
  inherited_from_model_year: number|null;
  confirmation_status: 'INHERITED'|'PENDING_REVIEW'|'CONFIRMED';
  observed_at: string;
}
export interface SpecDbProjection27 {
  observationInserts: readonly SpecDbObservationInsert27[];
  coverageUpsert: {
    product_id:number;model_year:number;
    status:SpecJournalPlan27['coverage']['status'];
    confirmed_count:number;pending_count:number;inherited_count:number;
  };
  /** Selection is intentionally deferred until observation IDs exist in the same transaction. */
  selectionIntents: readonly {specId:number;measurementMethod:string;isConfirmed:boolean;sourceDocumentId:string}[];
  writesApplied:false;
}
const positiveId=(s:string):number=>{
  if(!/^\d+$/u.test(s))throw new Error('SPEC_DB_ID_REQUIRED');
  const v=Number(s);
  if(!Number.isSafeInteger(v)||v<=0)throw new Error('SPEC_DB_ID_REQUIRED');
  return v;
};
export function projectSpecJournalToDb27(input:{
  plan:SpecJournalPlan27;
  catalog:readonly AdministrativeSpecCatalogItem[];
  sourceDocuments:readonly {sourceId:string;sourceDocumentId:string}[];
  observedAt:string;
}):SpecDbProjection27 {
  const {plan}=input;
  if(!Number.isFinite(Date.parse(input.observedAt)))throw new Error('SPEC_INVALID_OBSERVED_AT');
  const productId=positiveId(plan.coverage.productId);
  const codeToSpec=new Map(input.catalog.map(s=>[s.code,positiveId(s.id)]));
  const sources=new Map(input.sourceDocuments.map(x=>[x.sourceId,x.sourceDocumentId]));
  const observationInserts:SpecDbObservationInsert27[]=[];
  const selectionIntents:SpecDbProjection27['selectionIntents'][number][]=[];
  for(const o of plan.observations){
    if(o.productId!==plan.coverage.productId || o.modelYear!==plan.coverage.modelYear)
      throw new Error('SPEC_DB_TARGET_MISMATCH');
    const specId=codeToSpec.get(o.specCode);
    if(!specId)throw new Error('SPEC_DB_UNKNOWN_CANONICAL_ID');
    const sourceDocumentId=sources.get(o.sourceId);
    if(!sourceDocumentId)throw new Error('SPEC_DB_MISSING_SOURCE_DOCUMENT');
    observationInserts.push({
      product_id:productId,model_year:o.modelYear,spec_id:specId,
      source_document_id:sourceDocumentId,source_locator:o.sourceLocator,
      raw_label:o.specCode,raw_value:o.rawValue,availability:o.availability,
      numeric_value:o.numericValue,measurement_operator:o.measurementOperator,
      measurement_method:o.measurementMethod,input_unit:o.inputUnit,
      inherited_from_model_year:o.inheritedFromModelYear,
      confirmation_status:o.confirmationStatus,observed_at:input.observedAt,
    });
    const selection=plan.selections.find(s=>s.specCode===o.specCode && s.measurementMethod===o.measurementMethod);
    if(!selection)throw new Error('SPEC_DB_SELECTION_MISSING');
    selectionIntents.push({specId,measurementMethod:o.measurementMethod,
      isConfirmed:selection.isConfirmed,sourceDocumentId});
  }
  return {
    observationInserts,
    selectionIntents,
    coverageUpsert:{product_id:productId,model_year:plan.coverage.modelYear,
      status:plan.coverage.status,confirmed_count:plan.coverage.confirmedCount,
      pending_count:plan.coverage.pendingCount,inherited_count:plan.coverage.inheritedCount},
    writesApplied:false,
  };
}
