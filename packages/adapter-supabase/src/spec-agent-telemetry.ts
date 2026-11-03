import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpecAiUsage27 } from '@compra-car/core/agents';
import { assertLegacyServerRuntime } from './client';

/**
 * Same telemetry journal used by Price Agent, with a distinct SPEC_INTELLIGENCE
 * agent type and a stable intended run ID. No spec or alias mutations.
 */
export class SpecAgentSupabaseTelemetry27 {
  constructor(private readonly client:SupabaseClient) {assertLegacyServerRuntime();}
  async persistUsage(input:{
    readonly runId:string;
    readonly brand:string;
    readonly market:'BR';
    readonly usage:SpecAiUsage27;
  }):Promise<void>{
    const {usage}=input;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(input.runId))
      throw new Error('SPEC_TELEMETRY_RUN_ID_INVALID');
    if(!input.brand.trim()||input.market!=='BR')
      throw new Error('SPEC_TELEMETRY_TARGET_INVALID');
    if(!Number.isFinite(usage.actualEstimatedCostUsd)||usage.actualEstimatedCostUsd<0||
      usage.actualEstimatedCostUsd>2||!Number.isSafeInteger(usage.inputTokens)||
      !Number.isSafeInteger(usage.outputTokens))
      throw new Error('SPEC_TELEMETRY_USAGE_INVALID');
    const row={
      run_id:null,
      intended_run_id:input.runId,
      agent_type:'SPEC_INTELLIGENCE',
      market:input.market,
      brand:input.brand,
      provider:'openai',
      model:usage.model,
      input_tokens:usage.inputTokens,
      output_tokens:usage.outputTokens,
      total_tokens:usage.inputTokens+usage.outputTokens,
      web_search_count:0,
      estimated_cost_usd:usage.actualEstimatedCostUsd,
      reason:'SPEC_CANONICAL_RECONCILIATION',
    };
    const {error}=await this.client.from('agent_ai_usage_events').insert(row);
    if(error)throw new Error('SPEC_TELEMETRY_WRITE_FAILED');
  }
}
