import type {EngineeringRunEvent} from './engineering-run-log';

/** Opt-in central QA sink. Never stores secrets or raw model responses. */
export interface EngineeringRunEventDb {
 from(table:string): {upsert(payload:Record<string,unknown>,options:{onConflict:string}):PromiseLike<{error:{message:string}|null}>};
}
export async function persistEngineeringRunEvent(client:EngineeringRunEventDb,event:EngineeringRunEvent):Promise<void>{
 const row={
   run_id:event.runId,agent:event.agent,environment:event.environment,
   happened_at:event.timestamp,status:event.status,duration_ms:event.durationMs,
   estimated_cost_usd:event.estimatedCostUsd,llm_calls:event.llmCalls,
   finding_count:event.findingCount,source_fingerprint:event.sourceFingerprint,
   failures:event.failures,
 };
 const result=await client.from('agent_engineering_run_events').upsert(row,{onConflict:'run_id,agent'});
 if(result.error)throw new Error('ENGINEERING_CENTRAL_LOG_FAILED');
}
