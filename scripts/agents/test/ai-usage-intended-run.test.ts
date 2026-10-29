import { describe, expect, it, vi } from 'vitest';
import type { LegacySupabaseClient } from '@compra-car/adapter-supabase';
import { recordAiUsage } from '../ai-usage';

describe('Brand usage persistence before agent run creation',()=>{
  it('can write a provider usage receipt by intended run without violating run FK',async()=>{
    const insert=vi.fn(async()=>({error:null}));
    const client={from:vi.fn(()=>({insert}))} as unknown as LegacySupabaseClient;
    await recordAiUsage(client,{
      runId:null,
      intendedRunId:'212c7839-a076-435e-8fe6-c6a581feb503',
      agentType:'BRAND_CONNECTOR',market:'BR',brand:'GWM',provider:'openai',
      model:'gpt-5.6-luna',inputTokens:10300,outputTokens:2000,
      totalTokens:12300,webSearchCount:2,reason:'BRAND_CONNECTOR_RESEARCH',
    },{
      OPENAI_ADJUDICATION_MODEL:'gpt-5.6',
      OPENAI_INPUT_USD_PER_1M:'0.25',
      OPENAI_OUTPUT_USD_PER_1M:'1.5',
      OPENAI_WEB_SEARCH_USD_PER_1K:'10',
    });
    expect(insert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      run_id:null,
      intended_run_id:'212c7839-a076-435e-8fe6-c6a581feb503',
      agent_type:'BRAND_CONNECTOR',input_tokens:10300,
      output_tokens:2000,web_search_count:2,
      estimated_cost_usd:expect.any(Number),
    }));
  });
});
