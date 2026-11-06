/** QA-only paid XLS PDF matrix staging run.
 * Does not create findings for product values, canonical aliases, or product_specs.
 * Row-level evidence is staged in a completed run summary for later source fusion.
 */
import {extractFordRangerXlsMatrix27} from '@compra-car/adapter-openai';
import {RANGER_XLS_MATRIX_PDF} from '@compra-car/core/agents';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {officialFordPdfBytes} from './ford-supervised-pdf-job';
type Db=ReturnType<typeof createLegacySupabaseClient>;

export async function stageFordRangerXlsMatrix27(input:{
  db:Db;jobId:string;jobCreatedAt:string;productId:number;apiKey:string;
}):Promise<{runId:string;cellCount:number;costUsd:number}>{
 if(input.productId!==1236||!input.apiKey.trim()||
  !/^[a-f0-9-]{36}$/iu.test(input.jobId))throw new Error('FORD_XLS_MATRIX_JOB_INVALID');
 const {data:product,error:targetError}=await input.db.from('products')
  .select('id,brand,model,version,model_year,mmv_id')
  .eq('id',input.productId).maybeSingle();
 if(targetError||!product||product.brand!=='Ford'||product.model!=='Ranger'||
   product.version!=='XLS 3.0 4x4 V6'||Number(product.model_year)!==2027||
   !product.mmv_id)throw new Error('FORD_XLS_MATRIX_TARGET_NOT_CANONICAL');
 // Requires a prior independently successful, immutable HTML source audit.
 const {data:audits,error:auditError}=await input.db.from('agent_runs')
   .select('id,summary').eq('agent_type','SPEC_INTELLIGENCE')
   .eq('run_mode','SOURCE_AUDIT_ONLY').eq('status','COMPLETED')
   .eq('market','BR').eq('brand','Ford').order('started_at',{ascending:false})
   .limit(10);
 if(auditError||!audits?.some(a=>a.summary?.status==='VERIFIED_FOR_REVIEW'&&
   a.summary?.eligibleForSourceReview===true))
   throw new Error('FORD_XLS_MY2027_HTML_AUDIT_REQUIRED');
 const pdf=await officialFordPdfBytes(RANGER_XLS_MATRIX_PDF);
 const extracted=await extractFordRangerXlsMatrix27({
   sourceUrl:RANGER_XLS_MATRIX_PDF,pdf,apiKey:input.apiKey,maxCostUsd:2,
   onUsage:async usage=>{
     const {error}=await input.db.from('agent_ai_usage_events').insert({
      job_id:input.jobId,agent_type:'SPEC_INTELLIGENCE',market:'BR',brand:'Ford',
      provider:'openai',model:usage.model,
      input_tokens:usage.inputTokens,output_tokens:usage.outputTokens,
      total_tokens:usage.inputTokens+usage.outputTokens,web_search_count:0,
      estimated_cost_usd:usage.estimatedCostUsd,
      reason:'FORD_XLS_COLUMN_MATRIX_EXTRACTION'
     });
     if(error)throw new Error('FORD_XLS_MATRIX_USAGE_LEDGER_FAILED');
   }
 });
 const now=new Date().toISOString();
 const {error:runError}=await input.db.from('agent_runs').insert({
   id:input.jobId,agent_type:'SPEC_INTELLIGENCE',status:'COMPLETED',
   brand:'Ford',market:'BR',provider:'openai',
   run_mode:'SUPERVISED_XLS_MATRIX_ONLY',schema_version:'S27-FORD-XLS-MATRIX.1',
   started_at:input.jobCreatedAt,completed_at:now,
   input:{sourceUrl:RANGER_XLS_MATRIX_PDF,
      sourceSha256:extracted.documentSha256,
      sourceScope:'XLS_MATRIX_CELL',targetProductId:input.productId,
      my2027SourceAuditRequired:true},
   summary:{claimCount:extracted.cellCount,estimatedCostUsd:extracted.estimatedCostUsd,
      aiCalls:1,aiInputTokens:extracted.inputTokens,aiOutputTokens:extracted.outputTokens,
      sourceSha256:extracted.documentSha256,
      claims:extracted.claims,
      reviewOnly:true,htmlFusionPending:true,
      noCatalogWrites:true,noProductSpecWrites:true,noAliasWrites:true},
   config_snapshot:{qaOnly:true,supervised:true,sourceMode:'XLS_MATRIX_ONLY'}
 });
 if(runError)throw new Error('FORD_XLS_MATRIX_RUN_PERSIST_FAILED');
 return {runId:input.jobId,cellCount:extracted.cellCount,costUsd:extracted.estimatedCostUsd};
}
