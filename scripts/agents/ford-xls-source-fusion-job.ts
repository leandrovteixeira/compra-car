/** Deterministic QA-only reconciliation of the already validated XLS PDF
 * source with the live, MY2027-specific Ford HTML source. No catalog writes.
 */
import {createHash} from 'node:crypto';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {FORD_XLS_2027_URL,auditFordXls2027VersionPage,
 extractFordXlsHtmlClaims27,normalizeFordPdfTechnicalClaim27,
 reconcileFordXls2027Sources,type FordSourceClaim27} from '@compra-car/core/agents';
import {FORD_XLS_HTML_REVIEW_SNAPSHOT_27,FORD_XLS_HTML_SNAPSHOT_DATE_27} from './ford-xls-html-snapshot-2027';
import type {FordXls2027SourceAssessment} from '@compra-car/core/agents';
type Db=ReturnType<typeof createLegacySupabaseClient>;
const plain=(html:string)=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu,' ')
 .replace(/<[^>]*>/gu,' ').replace(/&nbsp;|&#160;/giu,' ')
 .replace(/&amp;/giu,'&').replace(/&quot;|&#34;/giu,'"')
 .replace(/&[a-z]+;/giu,' ').replace(/\s+/gu,' ').trim();
export async function reconcileFordXls2027Qa27(input:{
 db:Db;jobId:string;createdAt:string;productId:number;pdfRunId:string;
}):Promise<{runId:string;proposals:number;abstains:number;corroborated:number}>{
 if(input.productId!==1236||!/^[a-f0-9-]{36}$/iu.test(input.pdfRunId))
  throw new Error('FORD_XLS_FUSION_TARGET_INVALID');
 const {data:product,error:productError}=await input.db.from('products')
  .select('id,brand,model,version,model_year,mmv_id').eq('id',1236).maybeSingle();
 if(productError||!product||product.brand!=='Ford'||product.model!=='Ranger'||
  product.version!=='XLS 3.0 4x4 V6'||Number(product.model_year)!==2027||!product.mmv_id)
  throw new Error('FORD_XLS_FUSION_CANONICAL_INVALID');
 const {data:run,error:sourceError}=await input.db.from('agent_runs')
  .select('id,status,run_mode,input,summary').eq('id',input.pdfRunId).maybeSingle();
 if(sourceError||!run||run.status!=='COMPLETED'||run.run_mode!=='SUPERVISED_XLS_MATRIX_ONLY'||
  Number(run.input?.targetProductId)!==1236||
  run.summary?.reviewOnly!==true||run.summary?.noProductSpecWrites!==true||
  !Array.isArray(run.summary?.claims)||run.summary.claims.length<50||
  run.summary.claims.length>180)
  throw new Error('FORD_XLS_FUSION_PDF_SOURCE_UNVERIFIED');
 let pdfClaims:FordSourceClaim27[];
 try{
  pdfClaims=(run.summary.claims as FordSourceClaim27[])
   .map(normalizeFordPdfTechnicalClaim27);
 }catch{throw new Error('FORD_XLS_FUSION_PDF_NORMALIZATION_FAILED');}
 let html:string|undefined;
 try{
  const response=await fetch(FORD_XLS_2027_URL,{redirect:'manual',
   headers:{accept:'text/html','accept-language':'pt-BR,pt;q=0.9,en;q=0.5',
    'user-agent':'Mozilla/5.0 (compatible; OfficialSourceReview/1.0)'},
   signal:AbortSignal.timeout(25000)});
  if(!response.ok||response.status>=300)
   throw new Error('FORD_XLS_FUSION_HTML_HTTP_'+response.status);
  if(!(response.headers.get('content-type')??'').includes('text/html'))
   throw new Error('FORD_XLS_FUSION_HTML_CONTENT_TYPE_INVALID');
  if(Number(response.headers.get('content-length')??0)>2_000_000)
   throw new Error('FORD_XLS_FUSION_HTML_TOO_LARGE');
  html=await response.text();
  if(html.length>2_000_000)
   throw new Error('FORD_XLS_FUSION_HTML_TOO_LARGE');
 }catch{
  // Network fallback is review-only: never silently treat a curated excerpt
  // as a newly downloaded live HTML document.
  html=undefined;
 }
 let text:string;let htmlSha256:string;let mode:'LIVE_HTML'|'AUDITED_CURATED_EXCERPT';
 let assessment:FordXls2027SourceAssessment;
 let priorAuditId:string|null=null;
 let priorAuditHtmlSha256:string|null=null;
 if(html){
  text=plain(html);
  const headings=[...html.matchAll(/<(?:h1|h2|h3|title)\b[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|title)>/giu)]
   .map(m=>plain(m[1]??''));
  const heading=headings.find(h=>/XLS\s+3[.,]0.*V6.*diesel.*4WD.*AT.*2027/iu.test(h))??'';
  assessment=auditFordXls2027VersionPage({
   sourceUrl:FORD_XLS_2027_URL,heading,visibleMainText:text});
  if(assessment.status!=='VERIFIED_FOR_REVIEW')
   throw new Error('FORD_XLS_FUSION_HTML_IDENTITY_UNVERIFIED');
  htmlSha256=createHash('sha256').update(html,'utf8').digest('hex');
  mode='LIVE_HTML';
 }else{
  if(new Date().toISOString().slice(0,10)>'2026-11-13')
   throw new Error('FORD_XLS_FUSION_SNAPSHOT_STALE');
  const {data:audit,error:auditError}=await input.db.from('agent_runs')
   .select('id,run_mode,status,completed_at,summary')
   .eq('agent_type','SPEC_INTELLIGENCE').eq('run_mode','SOURCE_AUDIT_ONLY')
   .eq('market','BR').eq('brand','Ford').eq('status','COMPLETED')
   .order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(auditError||!audit||audit.summary?.status!=='VERIFIED_FOR_REVIEW'||
    audit.summary?.eligibleForSourceReview!==true||
    !/^[a-f0-9]{64}$/u.test(String(audit.summary?.sourceSha256??''))||
    !String(audit.completed_at??'').startsWith(FORD_XLS_HTML_SNAPSHOT_DATE_27))
   throw new Error('FORD_XLS_FUSION_PRIOR_AUDIT_REQUIRED');
  priorAuditId=audit.id;priorAuditHtmlSha256=audit.summary.sourceSha256;
  text=FORD_XLS_HTML_REVIEW_SNAPSHOT_27;
  htmlSha256=createHash('sha256').update(text,'utf8').digest('hex');
  mode='AUDITED_CURATED_EXCERPT';
  assessment={status:'VERIFIED_FOR_REVIEW',
   reason:'PRIOR_LIVE_AUDIT_WITH_REVIEW_ONLY_CURATED_EXCERPT',
   vehicle:{brand:'Ford',model:'Ranger',version:'XLS 3.0 V6 Diesel 4WD AT',modelYear:2027},
   evidence:[]};
 }
 let htmlClaims:readonly FordSourceClaim27[];
 try{htmlClaims=extractFordXlsHtmlClaims27({visibleText:text,sha256:htmlSha256,pdfClaims});}
 catch(error){
  if(error instanceof Error&&error.message.startsWith('FORD_XLS_'))throw error;
  throw new Error('FORD_XLS_FUSION_HTML_CLAIMS_EXCEPTION');
 }
 let proposals:ReturnType<typeof reconcileFordXls2027Sources>;
 try{proposals=reconcileFordXls2027Sources({htmlAssessment:assessment,pdfClaims,htmlClaims});}
 catch(error){
  if(error instanceof Error&&error.message.startsWith('FORD_XLS_'))throw error;
  throw new Error('FORD_XLS_FUSION_PROPOSAL_RECONCILIATION_EXCEPTION');
 }
 const abstains=proposals.filter(p=>p.decision==='ABSTAIN');
 const corroborated=proposals.filter(p=>p.reason==='BOTH_OFFICIAL_SOURCES_CORROBORATE');
 if(proposals.length<pdfClaims.length||abstains.length<1)
  throw new Error('FORD_XLS_FUSION_EXPECTED_CONFLICT_MISSING');
 const {error:writeError}=await input.db.from('agent_runs').insert({
  id:input.jobId,agent_type:'SPEC_INTELLIGENCE',status:'COMPLETED',
  market:'BR',brand:'Ford',provider:'deterministic',
  run_mode:'SOURCE_FUSION_REVIEW_ONLY',schema_version:'S27-FORD-MY-FUSION.1',
  started_at:input.createdAt,completed_at:new Date().toISOString(),
  input:{targetProductId:1236,pdfRunId:input.pdfRunId,
   pdfSha256:run.summary.sourceSha256,htmlUrl:FORD_XLS_2027_URL,htmlSha256,
   htmlEvidenceMode:mode,priorAuditId,priorAuditHtmlSha256},
  summary:{proposalCount:proposals.length,abstainCount:abstains.length,
   corroboratedCount:corroborated.length,htmlClaimCount:htmlClaims.length,
   conflicts:abstains.map(p=>({concept:p.concept,reason:p.reason,evidence:p.evidence})),
   proposals,htmlEvidenceMode:mode,
   htmlHashKind:mode==='LIVE_HTML'?'FULL_HTML_SHA256':'CURATED_EXCERPT_SHA256',
   priorAuditId,priorAuditHtmlSha256,reviewOnly:true,operatorApprovalRequired:true,
   noCatalogWrites:true,noProductSpecWrites:true,aiCalls:0,estimatedCostUsd:0},
  config_snapshot:{qaOnly:true,supervised:true,sourceComparison:'PDF_PLUS_MY2027_HTML'}
 });
 if(writeError)throw new Error('FORD_XLS_FUSION_PERSIST_FAILED');
 return {runId:input.jobId,proposals:proposals.length,
  abstains:abstains.length,corroborated:corroborated.length};
}
