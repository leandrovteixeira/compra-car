import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {createWatcherQaExecutor,assertWatcherQaTarget,WATCHER_QA_URL} from '@compra-car/adapter-supabase/watcher-qa';
import {createWatcherFeedTransport,nodeWatcherFeedNetwork} from './watcher-feed-transport';
import {runWatcherIncremental} from './watcher-incremental';

type Job={id:string;source_id:string;status:string;window_utc:string};
async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--once')
   throw new Error('WATCHER_CONSUMER_ARGUMENTS_REJECTED');
 const env=process.env;
 assertWatcherQaTarget(env);
 const client=createLegacySupabaseClient({url:WATCHER_QA_URL,serverKey:env.SUPABASE_SERVER_KEY!});
 const {data,error}=await client.rpc('watcher_claim_schedule_job');
 if(error)throw new Error('WATCHER_CONSUMER_CLAIM_FAILED');
 const job=(Array.isArray(data)?data[0]:data) as Job|undefined;
 if(!job){console.log(JSON.stringify({status:'IDLE'}));return;}
 if(job.source_id!=='motor1-br-pilot'||job.status!=='RUNNING')throw new Error('WATCHER_CONSUMER_INVALID_JOB');
 let success=false,code:string|null=null;
 try{
  const transport=createWatcherFeedTransport(nodeWatcherFeedNetwork(),{
   allowedHosts:['motor1.uol.com.br'],maxConcurrencyPerHost:1,timeoutMs:15000,
  });
  const qa=createWatcherQaExecutor(()=>env);
  const result=await qa.run(repository=>runWatcherIncremental({
   repository,transport,now:new Date().toISOString(),
  }));
  success=result.status==='PASS';
  console.log(JSON.stringify({status:result.status,jobId:job.id,received:result.received,receipt:result.receipt}));
 }catch(err){
  code=err instanceof Error&&/^WATCHER_INCREMENTAL_[A-Z_]+$/u.test(err.message)?
   err.message:'WATCHER_CONSUMER_EXECUTION_FAILED';
 }
 const finished=await client.rpc('watcher_finish_schedule_job',{
  p_id:job.id,p_success:success,p_error_code:code,
 });
 if(finished.error||finished.data!==true)throw new Error('WATCHER_CONSUMER_FINISH_FAILED');
 if(!success)throw new Error(code??'WATCHER_CONSUMER_FAILED');
}
main().catch(err=>{console.error(err instanceof Error&&/^WATCHER_[A-Z_]+$/.test(err.message)?
 err.message:'WATCHER_CONSUMER_BLOCKED');process.exitCode=1;});
