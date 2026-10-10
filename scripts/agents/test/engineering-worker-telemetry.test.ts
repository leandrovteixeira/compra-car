import {describe,it,expect,vi} from 'vitest';
import {journalWorkerJob,sanitizeWorkerFailure} from '../engineering-worker-telemetry';
describe('QA queued agent learning events',()=>{
 it('writes a success row for a Brand job without model output or secrets',async()=>{
  const upsert=vi.fn(async()=>({error:null}));
  const db={from:vi.fn(()=>({upsert}))};
  await journalWorkerJob(db,{
   runId:'11111111-1111-4111-8111-111111111111',
   jobType:'BRAND_CONNECTOR',brand:'Kia',startedAtMs:Date.now(),status:'SUCCESS',
  });
  expect(db.from).toHaveBeenCalledWith('agent_engineering_run_events');
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
   agent:'brand-connector',status:'SUCCESS',environment:'qa',failures:[],
  }),{onConflict:'run_id,agent'});
 });
 it('redacts raw error messages and records MMV failures',async()=>{
  const upsert=vi.fn(async()=>({error:null}));
  await journalWorkerJob({from:()=>({upsert})},{
    runId:'22222222-2222-4222-8222-222222222222',
    jobType:'MMV_DISCOVERY',brand:'VW',startedAtMs:Date.now(),
    status:'FAILED',failureCode:'NEW_PRODUCT_CHECK_FAILED: secret-token',
  });
  const payload=upsert.mock.calls[0]![0] as Record<string,unknown>;
  expect(payload.agent).toBe('mmv-discovery');
  expect(JSON.stringify(payload)).not.toContain('secret-token');
  expect(sanitizeWorkerFailure('unknown secret key')).toBe('AGENT_JOB_EXECUTION_FAILED');
 });
});
