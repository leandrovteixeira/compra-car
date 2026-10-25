/**
 * QA worker telemetry bridge for Engineering 22.5.
 * No OpenAI calls; never changes a canonical finding or job decision.
 */
export interface WorkerLearningEvent {
  runId: string;
  jobType: string;
  brand: string;
  startedAtMs: number;
  status: 'SUCCESS'|'FAILED';
  failureCode?: string;
}
export interface WorkerLearningDb {
  from(table:string):{upsert(value:Record<string,unknown>,opts:{onConflict:string}):PromiseLike<{error:{message:string}|null}>};
}
export function sanitizeWorkerFailure(value:unknown):string{
  const code=typeof value==='string'?value.split(/[:\s]/u)[0]??'':'';
  const known=['AGENT_JOB_EXECUTION_FAILED','BRAND_CONNECTOR_FAILED','NEW_PRODUCT_CHECK_FAILED',
    'OPENAI_AGENT_CONFIG_REQUIRED','SUPABASE_AGENT_CONFIG_REQUIRED','SOURCE_MONITOR_TRIGGER_FAILED',
    'CONNECTOR_RESEARCH_FAILED','COST_BUDGET_EXHAUSTED'];
  return known.includes(code)?code:'AGENT_JOB_EXECUTION_FAILED';
}
export async function journalWorkerJob(db:WorkerLearningDb,event:WorkerLearningEvent):Promise<void>{
  const agent=event.jobType==='MMV_DISCOVERY'?'mmv-discovery':
    event.jobType==='BRAND_CONNECTOR'?'brand-connector':
    event.jobType==='PRICE_INTELLIGENCE'?'price':null;
  if(!agent)return;
  const runId=/^[0-9a-f-]{36}$/iu.test(event.runId)?event.runId:null;
  if(!runId)return;
  const reason=event.status==='FAILED'?sanitizeWorkerFailure(event.failureCode):null;
  const result=await db.from('agent_engineering_run_events').upsert({
    run_id:runId,agent,environment:'qa',happened_at:new Date().toISOString(),
    status:event.status,duration_ms:Math.max(0,Date.now()-event.startedAtMs),
    estimated_cost_usd:null,llm_calls:null,finding_count:null,
    source_fingerprint:null,failures:reason?[{
      targetId:runId,brand:event.brand.slice(0,100),model:'unknown',
      sourceType:'agent-worker',reason,sourceStructure:'unknown',
    }]:[],
  },{onConflict:'run_id,agent'});
  if(result.error)throw new Error('ENGINEERING_WORKER_LOG_FAILED');
}
