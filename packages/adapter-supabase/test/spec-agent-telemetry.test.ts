import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {SpecAgentSupabaseTelemetry27} from '../src/spec-agent-telemetry';
import {measureSpecAiUsage27} from '@compra-car/core/agents';
describe('S27 official AI usage journal',()=>{
 const usage=measureSpecAiUsage27({model:'gpt-5.4-mini',inputTokens:11000,
  cachedInputTokens:1000,outputTokens:4900,reasoningTokens:0});
 it('inserts actual provider usage in existing agent_ai_usage_events schema',async()=>{
  const insert=vi.fn(async()=>({error:null}));
  const from=vi.fn(()=>({insert}));
  const client={from} as unknown as SupabaseClient;
  await new SpecAgentSupabaseTelemetry27(client).persistUsage({
   runId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',market:'BR',brand:'GWM',usage});
  expect(from).toHaveBeenCalledWith('agent_ai_usage_events');
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
   agent_type:'SPEC_INTELLIGENCE',model:'gpt-5.4-mini',
   reason:'SPEC_CANONICAL_RECONCILIATION',input_tokens:11000,
   total_tokens:15900,estimated_cost_usd:usage.actualEstimatedCostUsd,
  }));
 });
 it('rejects invalid telemetry before writing',async()=>{
  const from=vi.fn();
  await expect(new SpecAgentSupabaseTelemetry27({from} as unknown as SupabaseClient).persistUsage({
   runId:'invalid',market:'BR',brand:'GWM',usage
  })).rejects.toThrow('SPEC_TELEMETRY_RUN_ID_INVALID');
  expect(from).not.toHaveBeenCalled();
 });
});
