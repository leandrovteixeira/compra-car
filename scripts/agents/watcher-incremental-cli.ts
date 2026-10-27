import {createWatcherQaExecutor,WATCHER_QA_URL} from '@compra-car/adapter-supabase/watcher-qa';
import {loadWatcherQaEnvironment} from './watcher-qa-environment';
import {createWatcherFeedTransport,nodeWatcherFeedNetwork} from './watcher-feed-transport';
import {runWatcherIncremental} from './watcher-incremental';

async function main() {
 if(process.argv.length!==3||process.argv[2]!=='--run-once')
  throw new Error('WATCHER_INCREMENTAL_MANUAL_REQUIRED');
 const env=await loadWatcherQaEnvironment();
 if(env.SUPABASE_URL!==WATCHER_QA_URL)throw new Error('WATCHER_INCREMENTAL_QA_ONLY');
 const transport=createWatcherFeedTransport(nodeWatcherFeedNetwork(),{
  allowedHosts:['motor1.uol.com.br'],maxConcurrencyPerHost:1,timeoutMs:15000,
 });
 const executor=createWatcherQaExecutor(()=>env);
 const result=await executor.run(repository=>runWatcherIncremental({
   repository,transport,now:new Date().toISOString(),
 }));
 console.log(JSON.stringify(result));
}
main().catch(err=>{
 const message=err instanceof Error&&/^WATCHER_INCREMENTAL_[A-Z_]+$/u.test(err.message)
   ?err.message:'WATCHER_INCREMENTAL_BLOCKED';
 console.error(message);process.exitCode=1;
});
