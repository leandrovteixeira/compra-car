import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { extractWatcherNewsWithOpenAi, extractWatcherLaunchesWithOpenAi } from '@compra-car/adapter-openai';
import { scoreWatcherLaunch } from './watcher-launch-scoring';

const QA_URL='https://shfsjyjxmgwnlexmdkcs.supabase.co';
type Claimed={revision_id:string;article_title:string;article_excerpt:string|null};
function assertQa(env:NodeJS.ProcessEnv){
 if(env.APP_ENV!=='qa'||env.SUPABASE_URL!==QA_URL||
   env.WATCHER_AI_PROJECT_REF!=='shfsjyjxmgwnlexmdkcs')
   throw new Error('WATCHER_AI_QA_ONLY');
}
async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--once')
   throw new Error('WATCHER_AI_WORKER_MANUAL_MODE_REQUIRED');
 const env=process.env;
 assertQa(env);
 if(env.WATCHER_AI_AUTOMATION_ENABLED!=='true'){
   console.log(JSON.stringify({status:'PAUSED',aiCalls:0}));return;
 }
 if(!env.SUPABASE_SERVER_KEY?.trim()||!env.OPENAI_WATCHER_API_KEY?.trim())
  throw new Error('WATCHER_AI_WORKER_CREDENTIALS_MISSING');
 const client=createLegacySupabaseClient({url:QA_URL,serverKey:env.SUPABASE_SERVER_KEY});
 let processed=0,errors=0,spentUsd=0;
 // Bounded worker tick: a source revision is claimed ONCE, never automatically replayed.
 const maxPerTick=env.WATCHER_AI_MAX_PER_TICK==='1'?1:5;
 for(let i=0;i<maxPerTick;i++){
   const claimed=await client.rpc('watcher_ai_claim_revision');
   if(claimed.error)throw new Error('WATCHER_AI_CLAIM_FAILED');
   const row=(Array.isArray(claimed.data)?claimed.data[0]:claimed.data) as Claimed|undefined;
   if(!row)break;
   try{
     const text=[row.article_title,row.article_excerpt].filter(Boolean).join('\n').slice(0,2200);
     if(!row.article_title||text.length>2200)throw new Error('WATCHER_AI_INVALID_INPUT');
     const events=await extractWatcherNewsWithOpenAi({apiKey:env.OPENAI_WATCHER_API_KEY,
       model:'gpt-5.4-mini',text});
     const launch=await extractWatcherLaunchesWithOpenAi({apiKey:env.OPENAI_WATCHER_API_KEY,
       model:'gpt-5.4-mini',text});
     const scored=launch.launches.map(item=>scoreWatcherLaunch(row.revision_id,item));
     const inputTokens=events.inputTokens+launch.inputTokens;
     const outputTokens=events.outputTokens+launch.outputTokens;
     const costUsd=(inputTokens*0.75+outputTokens*4.50)/1_000_000;
     if(costUsd>0.05)throw new Error('WATCHER_AI_ITEM_COST_BLOCKED');
     const result=await client.rpc('watcher_ai_complete_revision',{
       p_revision_id:row.revision_id,p_events:events.events,
       p_launches:scored,p_rejected:launch.rejected,
       p_input_tokens:inputTokens,p_output_tokens:outputTokens,p_cost:costUsd,
     });
     if(result.error||result.data!==true)throw new Error('WATCHER_AI_RESULT_COMMIT_FAILED');
     processed++;spentUsd+=costUsd;
   }catch(e){
     errors++;
     const status=(e && typeof e==='object' && 'status' in e) ? Number((e as {status:unknown}).status) : null;
     const sdkCode=(e && typeof e==='object' && 'code' in e) ? String((e as {code:unknown}).code) : '';
     const errorCode=e instanceof Error&&/^WATCHER_[A-Z_]+$/.test(e.message)
       ?e.message
       :status===401?'WATCHER_AI_AUTH_REJECTED'
       :status===403?'WATCHER_AI_ACCESS_DENIED'
       :status===429?'WATCHER_AI_RATE_OR_BALANCE_LIMIT'
       :status===400?'WATCHER_AI_PROVIDER_REQUEST_INVALID'
       :sdkCode==='ETIMEDOUT'?'WATCHER_AI_PROVIDER_TIMEOUT'
       :'WATCHER_AI_UNCLASSIFIED_FAILURE';
     console.error(JSON.stringify({revisionId:row.revision_id,errorCode,httpStatus:status}));
     const fail=await client.rpc('watcher_ai_fail_revision',{
       p_revision_id:row.revision_id,p_error_code:errorCode});
     if(fail.error)throw new Error('WATCHER_AI_FAILURE_COMMIT_FAILED');
   }
 }
 console.log(JSON.stringify({status:errors?'PARTIAL':'PASS',processed,errors,spentUsd}));
 if(errors)process.exitCode=1;
}
main().catch(e=>{
 console.error(e instanceof Error&&/^WATCHER_[A-Z_]+$/.test(e.message)?
   e.message:'WATCHER_AI_WORKER_BLOCKED');
 process.exitCode=1;
});
