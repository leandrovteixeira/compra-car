import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { clusterEngineeringFailures, type EngineeringFailure } from '@compra-car/core/agents';
import { persistEngineeringRunEvent } from './engineering-central-log';

export interface EngineeringRunEvent {
  schemaVersion: 'engineering-run-event-v1';
  runId: string;
  agent: string;
  environment: 'qa' | 'staging';
  timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  durationMs: number | null;
  estimatedCostUsd: number | null;
  llmCalls: number | null;
  sourceFingerprint: string | null;
  findingCount: number | null;
  failures: EngineeringFailure[];
}
/** Write redacted, non-secret run metadata only. Append-only JSONL. */
export async function appendEngineeringRunEvent(path: string, event: EngineeringRunEvent): Promise<void> {
  if(event.schemaVersion !== 'engineering-run-event-v1' ||
    !/^[a-z0-9-]{8,64}$/iu.test(event.runId) ||
    !/^[a-z0-9_-]{2,64}$/iu.test(event.agent) ||
    !['qa','staging'].includes(event.environment) ||
    !Number.isFinite(Date.parse(event.timestamp)) ||
    !['SUCCESS','FAILED','PARTIAL'].includes(event.status) ||
    (event.estimatedCostUsd !== null && (!Number.isFinite(event.estimatedCostUsd)||event.estimatedCostUsd < 0)) ||
    event.failures.length > 50) throw new Error('ENGINEERING_INVALID_EVENT');
  await mkdir(dirname(path),{recursive:true});
  await appendFile(path,JSON.stringify(event)+'\n',{encoding:'utf8',flag:'a'});
}
export async function summarizeEngineeringRunLog(path:string){
  const text=await readFile(path,'utf8').catch((err:NodeJS.ErrnoException)=>{
    if(err.code==='ENOENT')return '';throw err;
  });
  const rows=text.split('\n').filter(Boolean);
  const events:EngineeringRunEvent[]=rows.map((line)=>{
    const e=JSON.parse(line) as EngineeringRunEvent;
    if(e.schemaVersion!=='engineering-run-event-v1')throw new Error('ENGINEERING_LOG_SCHEMA');
    return e;
  });
  const failures=events.flatMap(e=>e.failures);
  const costs=events.map(e=>e.estimatedCostUsd);
  return {
    schemaVersion:'engineering-run-summary-v1',
    runs:events.length,
    failedRuns:events.filter(e=>e.status==='FAILED').length,
    partialRuns:events.filter(e=>e.status==='PARTIAL').length,
    knownCostUsd:costs.reduce<number>((sum,c)=>sum+(c??0),0),
    unknownCostRuns:costs.filter(c=>c===null).length,
    clusters:clusterEngineeringFailures(failures),
    requiresReview:failures.length>0||events.some(e=>e.status!=='SUCCESS'),
  };
}

/** Opt-in central write, in addition to the local fallback.
 * Never silently assume staging based on production credentials. */
export async function recordEngineeringRunEvent(
  path:string,event:EngineeringRunEvent,env:Readonly<Record<string,string|undefined>>=process.env,
):Promise<void>{
  await appendEngineeringRunEvent(path,event);
  if(env.ENGINEERING_CENTRAL_LOG_ENABLED!=='1')return;
  const runtimeEnvironment=env.AGENT_ENVIRONMENT ?? env.APP_ENV;
  if(runtimeEnvironment!=='qa'&&runtimeEnvironment!=='staging')
    throw new Error('ENGINEERING_ENVIRONMENT_NOT_VERIFIED');
  if(env.SUPABASE_URL!=='https://shfsjyjxmgwnlexmdkcs.supabase.co')
    throw new Error('ENGINEERING_QA_DATABASE_REQUIRED');
  if(!env.SUPABASE_URL?.trim()||!env.SUPABASE_SERVER_KEY?.trim())
    throw new Error('ENGINEERING_CENTRAL_LOG_CONFIG_REQUIRED');
  const {createLegacySupabaseClient}=await import('@compra-car/adapter-supabase');
  const db=createLegacySupabaseClient({url:env.SUPABASE_URL,serverKey:env.SUPABASE_SERVER_KEY});
  await persistEngineeringRunEvent(db,{...event,environment:runtimeEnvironment});
}
