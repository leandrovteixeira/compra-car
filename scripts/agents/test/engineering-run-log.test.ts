import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
import {appendEngineeringRunEvent,summarizeEngineeringRunLog} from '../engineering-run-log';
describe('Engineering append-only learning log',()=>{
 it('collects real run metadata and groups failures without assuming unknown costs zero',async()=>{
  const root=await mkdtemp(join(tmpdir(),'engineering-log-'));const path=join(root,'events.jsonl');
  try{
   const event={schemaVersion:'engineering-run-event-v1' as const,
    runId:'11111111-1111-4111-8111-111111111111',agent:'brand-connector',
    environment:'qa' as const,timestamp:'2026-10-10T16:00:00Z',
    status:'PARTIAL' as const,durationMs:30,estimatedCostUsd:null,
    llmCalls:null,sourceFingerprint:null,findingCount:1,
    failures:[{targetId:'vehicle-a',brand:'Kia',model:'EV5',
      sourceType:'official',reason:'MISSING_ALIAS',sourceStructure:'html'}]};
   await appendEngineeringRunEvent(path,event);
   await appendEngineeringRunEvent(path,{...event,runId:'22222222-2222-4222-8222-222222222222',
      estimatedCostUsd:0.02});
   const result=await summarizeEngineeringRunLog(path);
   expect(result.runs).toBe(2);
   expect(result.partialRuns).toBe(2);
   expect(result.knownCostUsd).toBe(0.02);
   expect(result.unknownCostRuns).toBe(1);
   expect(result.clusters[0]?.kind).toBe('MISSING_ALIAS');
   expect(result.clusters[0]?.count).toBe(2);
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
