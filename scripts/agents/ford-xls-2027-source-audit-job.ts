/** QA-only deterministic official Ford XLS MY2027 source preflight.
 * No OpenAI, no catalog/spec writes. The page must be fetched live without
 * redirects, and its version+MY identity must pass a fail-closed audit.
 */
import {createHash} from 'node:crypto';
import {auditFordXls2027VersionPage,FORD_XLS_2027_URL}
  from '@compra-car/core/agents';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
type Db=ReturnType<typeof createLegacySupabaseClient>;
function textFromHtml(s:string):string{
 return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu,' ')
  .replace(/<[^>]*>/gu,' ')
  .replace(/&nbsp;|&#160;/giu,' ')
  .replace(/&amp;/giu,'&').replace(/&quot;|&#34;/giu,'"')
  .replace(/&[a-z]+;/giu,' ').replace(/\s+/gu,' ').trim();
}
export async function auditFordXls2027SourceJob(input:{
 db:Db;runId:string;createdAt:string;productId:number;
}):Promise<{runId:string;verified:boolean;documentSha256:string}>{
 if(input.productId!==1236||!/^[a-f0-9-]{36}$/iu.test(input.runId))
  throw new Error('FORD_XLS_SOURCE_AUDIT_TARGET_INVALID');
 const {data:product,error}=await input.db.from('products')
   .select('id,brand,model,version,model_year,mmv_id')
   .eq('id',input.productId).maybeSingle();
 if(error||!product||!product.mmv_id||
    product.brand!=='Ford'||product.model!=='Ranger'||
    product.version!=='XLS 3.0 4x4 V6'||Number(product.model_year)!==2027)
  throw new Error('FORD_XLS_SOURCE_AUDIT_CANONICAL_IDENTITY_MISMATCH');
 const response=await fetch(FORD_XLS_2027_URL,{
  redirect:'manual',headers:{accept:'text/html'},
  signal:AbortSignal.timeout(25000)
 });
 if(!response.ok||response.status>=300||
    !(response.headers.get('content-type')??'').includes('text/html'))
  throw new Error('FORD_XLS_SOURCE_FETCH_UNAVAILABLE');
 const length=Number(response.headers.get('content-length')??0);
 if(length>2_000_000)throw new Error('FORD_XLS_SOURCE_SIZE_LIMIT');
 const html=await response.text();
 if(html.length>2_000_000)throw new Error('FORD_XLS_SOURCE_SIZE_LIMIT');
 const digest=createHash('sha256').update(html,'utf8').digest('hex');
 const headings=[...html.matchAll(/<(?:h1|h2|h3|title)\b[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|title)>/giu)]
   .map(m=>textFromHtml(m[1]??''));
 const versionHeading=headings.find(h=>/XLS\s+3[.,]0.*V6.*diesel.*4WD.*AT.*2027/iu.test(h));
 const assessment=auditFordXls2027VersionPage({
  sourceUrl:FORD_XLS_2027_URL,heading:versionHeading??'',visibleMainText:textFromHtml(html)
 });
 const now=new Date().toISOString();
 const {error:runError}=await input.db.from('agent_runs').insert({
  id:input.runId,agent_type:'SPEC_INTELLIGENCE',status:'COMPLETED',
  market:'BR',brand:'Ford',provider:'deterministic',run_mode:'SOURCE_AUDIT_ONLY',
  schema_version:'S27-FORD-MY-SOURCE.1',started_at:input.createdAt,
  completed_at:now,
  input:{url:FORD_XLS_2027_URL,productId:input.productId},
  summary:{
    status:assessment.status,reason:assessment.reason,
    sourceSha256:digest,checkedFields:assessment.evidence.map(e=>e.field),
    noCatalogWrites:true,noProductSpecWrites:true,aiCalls:0,
    eligibleForSourceReview:assessment.status==='VERIFIED_FOR_REVIEW',
    operatorApprovalRequired:true
  },
  config_snapshot:{supervised:true,manufacturer:'Ford',snapshotRequired:true}
 });
 if(runError)throw new Error('FORD_XLS_SOURCE_AUDIT_PERSIST_FAILED');
 return {runId:input.runId,verified:assessment.status==='VERIFIED_FOR_REVIEW',documentSha256:digest};
}
