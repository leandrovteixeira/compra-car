import { watcherScheduleWindow } from './watcher-scheduler-window';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';

const env=process.env;
const QA_URL='https://shfsjyjxmgwnlexmdkcs.supabase.co';
async function main() {
 if(env.APP_ENV!=='qa'||env.SUPABASE_URL!==QA_URL)
   throw new Error('WATCHER_SCHEDULER_QA_ONLY');
 if(env.WATCHER_SCHEDULER_ENQUEUE_ENABLED!=='true'){
  console.log(JSON.stringify({status:'PAUSED',writes:0,aiCalls:0}));
  return;
 }
 if(!env.SUPABASE_SERVER_KEY?.trim())throw new Error('WATCHER_SCHEDULER_CREDENTIALS_MISSING');
 const window=watcherScheduleWindow(new Date());
 const client=createLegacySupabaseClient({url:QA_URL,serverKey:env.SUPABASE_SERVER_KEY});
 const {data,error}=await client.rpc('watcher_enqueue_schedule_job',{
   p_source_id:'motor1-br-pilot',p_window_utc:window,
 });
 if(error)throw new Error('WATCHER_SCHEDULER_ENQUEUE_FAILED');
 const result=Array.isArray(data)?data[0]:data;
 if(!result||typeof result.job_id!=='string'||typeof result.inserted!=='boolean')
   throw new Error('WATCHER_SCHEDULER_RECEIPT_INVALID');
 console.log(JSON.stringify({status:'PASS',jobId:result.job_id,inserted:result.inserted,
   window,source:'motor1-br-pilot',aiCalls:0}));
}
main().catch(error=>{
 const code=error instanceof Error && /^WATCHER_SCHEDULER_[A-Z_]+$/.test(error.message)
   ?error.message:'WATCHER_SCHEDULER_BLOCKED';
 console.error(code);process.exitCode=1;
});
