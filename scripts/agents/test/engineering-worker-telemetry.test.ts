import {describe,it,expect,vi} from 'vitest';
import {journalWorkerJob,sanitizeWorkerFailure} from '../engineering-worker-telemetry';
describe('QA queued agent learning events',()=>{
 it('writes a success row for a Brand job without model output or secrets',async()=>{
  const upsert=vi.fn(async (...args:[Record<string,unknown>,{onConflict:string;ignoreDuplicates?:boolean}])=>{void args;return {error:null};});
  const db={from:vi.fn(()=>({upsert}))};
  await journalWorkerJob(db,{
   runId:'11111111-1111-4111-8111-111111111111',
   jobType:'BRAND_CONNECTOR',brand:'Kia',startedAtMs:Date.now(),status:'SUCCESS',
  });
  expect(db.from).toHaveBeenCalledWith('agent_engineering_run_events');
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
   agent:'brand-connector',status:'SUCCESS',environment:'qa',failures:[],
  }),{onConflict:'run_id,agent',ignoreDuplicates:true});
 });
 it('redacts raw error messages and records MMV failures',async()=>{
  const upsert=vi.fn(async (...args:[Record<string,unknown>,{onConflict:string;ignoreDuplicates?:boolean}])=>{void args;return {error:null};});
  await journalWorkerJob({from:()=>({upsert})},{
    runId:'22222222-2222-4222-8222-222222222222',
    jobType:'MMV_DISCOVERY',brand:'VW',startedAtMs:Date.now(),
    status:'FAILED',failureCode:'NEW_PRODUCT_CHECK_FAILED: secret-token',
  });
  const payload=upsert.mock.calls[0]![0];
  expect(payload.agent).toBe('mmv-discovery');
  expect(JSON.stringify(payload)).not.toContain('secret-token');
  expect(sanitizeWorkerFailure('unknown secret key')).toBe('AGENT_JOB_EXECUTION_FAILED');
  expect(sanitizeWorkerFailure('NEW_PRODUCT_CHECK_FAILED: OPENAI_RESEARCH_FAILED: secret-token')).toBe('OPENAI_RESEARCH_FAILED');
  expect(sanitizeWorkerFailure('BRAND_CONNECTOR_FAILED: CONNECTOR_RESEARCH_RATE_LIMIT: secret-token')).toBe('CONNECTOR_RESEARCH_RATE_LIMIT');
 });
 it('does not overwrite detailed run cost and call counts on a duplicate',async()=>{
  const runId='33333333-3333-4333-8333-333333333333';
  const existing={run_id:runId,agent:'brand-connector',estimated_cost_usd:0.42,llm_calls:3,finding_count:8,source_fingerprint:'known'};
  const upsert=vi.fn(async (row:Record<string,unknown>,opts:{onConflict:string;ignoreDuplicates?:boolean})=>{
   if(!opts.ignoreDuplicates)Object.assign(existing,row);
   return {error:null};
  });
  await journalWorkerJob({from:()=>({upsert})},{runId,jobType:'BRAND_CONNECTOR',brand:'Kia',startedAtMs:Date.now()-10,status:'SUCCESS'});
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({run_id:runId}),{onConflict:'run_id,agent',ignoreDuplicates:true});
  expect(existing).toMatchObject({estimated_cost_usd:0.42,llm_calls:3,finding_count:8,source_fingerprint:'known'});
 });
});
