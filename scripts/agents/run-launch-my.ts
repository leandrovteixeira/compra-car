import {randomUUID,createHash} from 'node:crypto';
import {lookupLaunchModelYear} from '@compra-car/adapter-openai';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {recordAiUsage} from './ai-usage';
import {requireAgentOpenAiApiKey} from './agent-openai-credentials';
import {loadAgentEnvironment} from './agent-environment';
import {resolve} from 'node:path';

export async function runLaunchMyJob(input:Readonly<{
 jobId:string;brand:string;mmvId?:string;
}>,baseEnv:Readonly<Record<string,string|undefined>>=process.env,
 log:(line:string)=>void=console.log):Promise<string|null>{
 const env=await loadAgentEnvironment(resolve(process.cwd(),'../..'),baseEnv);
 if(env.APP_ENV!=='qa'||env.SUPABASE_URL!=='https://shfsjyjxmgwnlexmdkcs.supabase.co')
   throw new Error('MY_QA_ONLY');
 if(!env.SUPABASE_SERVER_KEY||!env.OPENAI_AGENT_MODEL)throw new Error('MY_CONFIG_MISSING');
 const db=createLegacySupabaseClient({url:env.SUPABASE_URL,serverKey:env.SUPABASE_SERVER_KEY});
 let query=db.from('agent_my_launch_eligibility')
   .select('mmv_id,brand,model,official_version_label')
   .eq('brand',input.brand).eq('eligibility','ELIGIBLE').order('mmv_id').limit(1);
 if(input.mmvId)query=query.eq('mmv_id',input.mmvId);
 const {data:eligible,error:selectionError}=await query;
 if(selectionError)throw new Error('MY_ELIGIBILITY_READ_FAILED');
 const target=eligible?.[0];
 if(!target){log('NO_MY_RESEARCH_REQUIRED: zero eligible MMVs');return null;}
 const startedAt=new Date().toISOString();
 const runId=randomUUID();
 const {result,usage}=await lookupLaunchModelYear({
  apiKey:requireAgentOpenAiApiKey(env,'MODEL_YEAR'),model:env.OPENAI_AGENT_MODEL,
  brand:target.brand,vehicleModel:target.model,version:target.official_version_label,
 });
 // Recheck before writing review finding: an operator or FIPE agent may have resolved the MMV.
 const {data:current,error:currentError}=await db.from('agent_my_launch_eligibility')
   .select('eligibility').eq('mmv_id',target.mmv_id).single();
 if(currentError)throw new Error('MY_ELIGIBILITY_RECHECK_FAILED');
 const admissible=current?.eligibility==='ELIGIBLE';
 const confirmed=result.status==='CONFIRMED'&&admissible;
 const {error:runError}=await db.from('agent_runs').insert({
  id:runId,agent_type:'PRODUCT_YEAR',status:'COMPLETED',market:'BR',brand:target.brand,
  provider:'openai',run_mode:'LAUNCH_MY_LOOKUP',schema_version:'MY-LAUNCH-1',
  started_at:startedAt,completed_at:new Date().toISOString(),
  input:{mmvId:target.mmv_id,model:target.model,version:target.official_version_label},
  summary:{findings:confirmed?1:0,reviewRequired:confirmed?1:0,
    lookupStatus:result.status,modelYear:result.modelYear,eligibilityAtCompletion:current?.eligibility},
 });
 if(runError)throw new Error('MY_RUN_PERSIST_FAILED');
 // Persist usage for every completed provider request, including UNKNOWN and CONFLICT.
 await recordAiUsage(db,{
  runId,agentType:'PRODUCT_YEAR',market:'BR',brand:target.brand,provider:'openai',
  model:usage.model,inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,
  webSearchCount:usage.webSearchCount,reason:'MODEL_YEAR_LAUNCH_LOOKUP',
 },env);
 if(confirmed){
   const findingId=randomUUID();
   const identity=target.mmv_id+':'+result.modelYear;
   const fingerprint=createHash('sha256').update('MY-LAUNCH-1:'+identity+':'+result.sourceUrl).digest('hex');
   const {error:findingError}=await db.from('agent_findings').insert({
    id:findingId,run_id:runId,finding_type:'NEW_PRODUCT_YEAR',fingerprint,
    subject_key:identity,title:target.brand+' '+target.model+' '+(target.official_version_label??'')+' — MY'+result.modelYear,
    summary:'Ano-modelo identificado em oferta comercial: '+result.evidence,
    confidence:Math.min(1,Math.max(0,result.confidence)),requires_review:true,
    subject:{brand:target.brand,model:target.model,officialVersionLabel:target.official_version_label,
      mmvId:target.mmv_id,modelYear:result.modelYear},
    proposal:{action:'STAGE_PRODUCT_YEAR',mmvId:target.mmv_id,modelYear:result.modelYear,status:'ACTIVE'},
    payload:{reasonCode:'NEW_MODEL_YEAR',commercialAvailability:'EVIDENCE_OBSERVED',
      sourceCount:1,operatorMessage:'MY encontrado em fonte comercial; revisar e aprovar o vínculo ao MMV.'},
   });
   if(findingError)throw new Error('MY_FINDING_PERSIST_FAILED');
   const url=result.sourceUrl!;
   const {error:evidenceError}=await db.from('agent_evidence').insert({
    id:randomUUID(),finding_id:findingId,source_type:'COMMERCIAL_OFFER',
    source_url:url,source_domain:new URL(url).hostname,
    title:'Evidência comercial MY '+result.modelYear,
    excerpt:result.evidence,
    evidence_fingerprint:createHash('sha256').update(url+'|'+result.evidence).digest('hex'),
    metadata:{method:'DIRECT_MY_SEARCH',provider:'openai'},
    captured_at:new Date().toISOString(),
   });
   if(evidenceError)throw new Error('MY_EVIDENCE_PERSIST_FAILED');
 }
 log('MY launch '+target.brand+' '+target.model+' status='+result.status+
   ' MY='+(result.modelYear??'UNKNOWN')+' findings='+(confirmed?1:0)+
   ' tokens_in='+usage.inputTokens+' tokens_out='+usage.outputTokens+
   ' web_search='+usage.webSearchCount);
 log('Run: '+runId);
 return runId;
}
