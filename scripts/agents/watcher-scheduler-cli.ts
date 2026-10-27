/** Cron entrypoint: safety-gated until WATCHER_INGESTION is handled by the QA worker. */
const target='https://shfsjyjxmgwnlexmdkcs.supabase.co';
const env=process.env;
if(env.APP_ENV!=='qa'||env.SUPABASE_URL!==target)
  throw new Error('WATCHER_SCHEDULER_QA_ONLY');
if(env.WATCHER_SCHEDULER_ENQUEUE_ENABLED!=='true'){
 console.log(JSON.stringify({status:'PAUSED',reason:'WATCHER_WORKER_INTEGRATION_PENDING',
   schedule:'0 11,23 * * *',timezone:'UTC',writes:0,aiCalls:0}));
}else{
 // Fail closed. Never enqueue a job type that the current agent-worker cannot execute.
 throw new Error('WATCHER_SCHEDULER_WORKER_NOT_READY');
}
