/** QA-only read-only planning of canonical spec review for S27D.
 * No agent_findings or review cases are created until approval semantics
 * distinguish source quality review from canonical CREATE/MERGE.
 */
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {classifySupervisedSpecClaims27,
 type SupervisedSpecClaim27,type SupervisedSpecCatalog27,type SupervisedSpecAlias27,
 type GuardedFordProposal27} from '@compra-car/core/agents';
type Db=ReturnType<typeof createLegacySupabaseClient>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export async function previewFordXlsCanonicalReview27(input:{
 db:Db;jobId:string;createdAt:string;productId:number;fusionRunId:string;
}):Promise<{runId:string;corroborated:number;sourceBlocked:number;canonicalReview:number}>{
 if(input.productId!==1236||!uuid.test(input.fusionRunId)||!uuid.test(input.jobId))
  throw new Error('FORD_S27D_REVIEW_SCOPE_DENIED');
 const {data:run,error:runError}=await input.db.from('agent_runs')
  .select('id,status,run_mode,input,summary').eq('id',input.fusionRunId).maybeSingle();
 if(runError||!run||run.status!=='COMPLETED'||
  run.run_mode!=='SOURCE_FUSION_REVIEW_ONLY'||
  run.summary?.sourceQualityGate!=='S27D_FORD_V1'||
  run.summary?.reviewOnly!==true||
  Number(run.input?.targetProductId)!==1236||
  !Array.isArray(run.summary?.proposals)||run.summary.proposals.length!==107)
  throw new Error('FORD_S27D_REVIEW_FUSION_UNVERIFIED');
 const proposals=run.summary.proposals as GuardedFordProposal27[];
 if(proposals.some(p=>!p||p.eligibleForCatalogApplication!==false||
  !['CORROBORATED','PDF_ONLY_UNVERIFIED','SOURCE_AMBIGUOUS'].includes(p.quality)))
  throw new Error('FORD_S27D_REVIEW_QUALITY_INVALID');
 const corroborated=proposals.map((p,ordinal)=>({p,ordinal:ordinal+1}))
  .filter(x=>x.p.quality==='CORROBORATED'&&x.p.decision==='REVIEW_REQUIRED');
 const sourceBlocked=proposals.filter(p=>p.quality!=='CORROBORATED').length;
 const {data:specRows,error:specError}=await input.db.from('specs')
  .select('id,code,display_pt,detail_pt,detail,type,unit')
  .eq('is_active',true).limit(2000);
 if(specError||!specRows?.length)throw new Error('FORD_S27D_REVIEW_CATALOG_UNAVAILABLE');
 const catalog:SupervisedSpecCatalog27[]=specRows.map(s=>({
  id:String(s.id),code:String(s.code),
  label:String(s.display_pt??s.detail_pt??s.detail??s.code),
  kind:s.type as SupervisedSpecCatalog27['kind'],
  unit:typeof s.unit==='string'?s.unit:null
 }));
 const {data:aliasRows,error:aliasError}=await input.db.from('spec_field_aliases')
  .select('alias,target_spec_id,value_type,source_context_key')
  .eq('status','CONFIRMED').eq('locale','pt-BR').limit(1000);
 if(aliasError)throw new Error('FORD_S27D_REVIEW_ALIAS_UNAVAILABLE');
 const bySpecId=new Map(catalog.map(s=>[s.id,s]));
 const aliases:SupervisedSpecAlias27[]=(aliasRows??[])
  .filter(a=>a.source_context_key==='FORD'&&a.target_spec_id!==null)
  .flatMap(a=>{
   const s=bySpecId.get(String(a.target_spec_id));
   return s&&s.kind===a.value_type?
    [{label:String(a.alias),specCode:s.code,approved:true}]:[];
  });
 const claims:SupervisedSpecClaim27[]=corroborated.map(({p,ordinal})=>{
  const numeric=p.value!==null&&/^\d+(?:[.,]\d+)?$/u.test(p.value);
  const kind:SupervisedSpecClaim27['kind']=numeric?'numeric':
   p.value!==null?'scale':'binary';
  return {ordinal,page:2,label:p.concept,rawLabel:p.evidence[0]?.rawLabel??p.concept,
   kind,unit:p.unit,rawValue:p.value??p.availability};
 });
 const classified=classifySupervisedSpecClaims27({
  brand:'Ford',model:'Ranger',version:'XLS 3.0 4x4 V6',
  modelYear:2027,documentSha256:String(run.input.pdfSha256),
  claims,catalog,aliases
 });
 const reviewCandidates=classified.map(c=>({
  ...c,sourceQuality:'CORROBORATED',operatorApprovalRequired:true,
  pdfFusionRunId:input.fusionRunId,productId:1236,
  canonicalWrites:false,productSpecWrites:false
 }));
 const {error:writeError}=await input.db.from('agent_runs').insert({
  id:input.jobId,agent_type:'SPEC_INTELLIGENCE',status:'COMPLETED',
  market:'BR',brand:'Ford',provider:'deterministic',
  run_mode:'SOURCE_QUALITY_CATALOG_PREVIEW_ONLY',
  schema_version:'S27D-FORD-REVIEW-PREVIEW.1',
  started_at:input.createdAt,completed_at:new Date().toISOString(),
  input:{productId:1236,sourceFusionRunId:input.fusionRunId},
  summary:{
   sourceFusionRunId:input.fusionRunId,originalProposalCount:proposals.length,
   corroboratedCount:corroborated.length,sourceBlockedCount:sourceBlocked,
   matchedAliasCount:classified.filter(c=>c.status==='MATCHED_ALIAS').length,
   ambiguousCanonicalCount:classified.filter(c=>c.status==='SPEC_AMBIGUOUS').length,
   newCanonicalCandidateCount:classified.filter(c=>c.status==='SPEC_NEW').length,
   reviewCandidates,sourceBlocked:proposals.map((p,i)=>({p,index:i+1}))
    .filter(x=>x.p.quality!=='CORROBORATED')
    .map(x=>({ordinal:x.index,concept:x.p.concept,quality:x.p.quality,
      reasons:x.p.sourceQualityReasons})),
   queuePublicationPending:true,operatorApprovalRequired:true,
   noCatalogWrites:true,noProductSpecWrites:true,aiCalls:0,estimatedCostUsd:0
  },
  config_snapshot:{qaOnly:true,supervised:true,sourceQualityGate:'S27D_FORD_V1'}
 });
 if(writeError)throw new Error('FORD_S27D_REVIEW_PREVIEW_PERSIST_FAILED');
 return {runId:input.jobId,corroborated:corroborated.length,
  sourceBlocked,canonicalReview:classified.filter(c=>c.requiresReview).length};
}
