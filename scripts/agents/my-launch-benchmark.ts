import {lookupLaunchModelYear} from '@compra-car/adapter-openai';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {requireAgentOpenAiApiKey} from './agent-openai-credentials';
import {loadAgentEnvironment} from './agent-environment';
import {estimateAiCostUsd} from './ai-usage';
import {resolve} from 'node:path';

export async function runMyLaunchBenchmark(
 job:{id:string;brand:string;model:string;version:string},
 environment:Readonly<Record<string,string|undefined>>=process.env,
 log:(s:string)=>void=console.log,
):Promise<void>{
 const env=await loadAgentEnvironment(resolve(process.cwd(),'../..'),environment);
 if(env.APP_ENV!=='qa'||env.SUPABASE_URL!=='https://shfsjyjxmgwnlexmdkcs.supabase.co')
   throw new Error('MY_BENCHMARK_QA_ONLY');
 if(!env.SUPABASE_SERVER_KEY||!env.OPENAI_AGENT_MODEL)throw new Error('MY_BENCHMARK_CONFIG_REQUIRED');
 const db=createLegacySupabaseClient({url:env.SUPABASE_URL,serverKey:env.SUPABASE_SERVER_KEY});
 const {result,usage}=await lookupLaunchModelYear({
  apiKey:requireAgentOpenAiApiKey(env,'MODEL_YEAR'),model:env.OPENAI_AGENT_MODEL,
  brand:job.brand,vehicleModel:job.model,version:job.version,
 });
 const estimate=estimateAiCostUsd(usage,env);
 const {error:usageError}=await db.from('agent_ai_usage_events').insert({
   job_id:job.id,run_id:null,agent_type:'PRODUCT_YEAR',market:'BR',brand:job.brand,
   provider:'openai',model:usage.model,input_tokens:usage.inputTokens,
   output_tokens:usage.outputTokens,total_tokens:usage.inputTokens+usage.outputTokens,
   web_search_count:usage.webSearchCount,estimated_cost_usd:estimate.cost,
   reason:estimate.priced?'MY_BENCHMARK_DIRECT_LOOKUP':'MY_BENCHMARK_DIRECT_LOOKUP:UNPRICED',
 });
 if(usageError)throw new Error('MY_BENCHMARK_TELEMETRY_WRITE_FAILED');
 const evidence=result.sourceUrl&&result.evidence?
   [{sourceUrl:result.sourceUrl,excerpt:result.evidence}]:[];
 const {error}=await db.from('agent_my_benchmark_results').insert({
  job_id:job.id,brand:job.brand,model:job.model,version:job.version,status:result.status,
  detected_model_year:result.modelYear,candidate_payload:[result],evidence,
  input_tokens:usage.inputTokens,output_tokens:usage.outputTokens,web_search_count:usage.webSearchCount,
 });
 if(error)throw new Error('MY_BENCHMARK_RESULT_WRITE_FAILED');
 log('MY benchmark '+job.brand+' '+job.model+' '+job.version+' status='+result.status+
    ' MY='+(result.modelYear??'UNKNOWN')+' tokens='+usage.inputTokens+'/'+usage.outputTokens+
    ' searches='+usage.webSearchCount+' estimated_usd='+estimate.cost.toFixed(6));
}
