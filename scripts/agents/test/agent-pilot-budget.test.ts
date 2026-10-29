import {describe,expect,it,vi} from 'vitest';
import {
  agentPilotBudgetKey,needsAgentBudget,reserveAgentPilotBudget,
  finishAgentPilotBudget,GWM_PILOT_RESERVATION_USD,
} from '../agent-pilot-budget';
const job=(type:string,input:Record<string,string>={})=>({
  job_type:type,market:'BR',brand:'GWM',input,
});
describe('Sprint 26 GWM capped pilot',()=>{
  it('sets a conservative $2 reservation for every paid brand agent',()=>{
    expect(GWM_PILOT_RESERVATION_USD).toBe(2);
    expect(agentPilotBudgetKey(job('BRAND_CONNECTOR'))).toBe('qa:BR:GWM:BRAND_CONNECTOR');
    expect(agentPilotBudgetKey(job('MMV_DISCOVERY'))).toBe('qa:BR:GWM:MMV_DISCOVERY');
    expect(agentPilotBudgetKey(job('PRODUCT_YEAR'))).toBe('qa:BR:GWM:PRODUCT_YEAR');
    expect(agentPilotBudgetKey(job('PRICE_INTELLIGENCE'))).toBe('qa:BR:GWM:PRICE_INTELLIGENCE');
  });
  it('charges no reservation for deterministic Price or reused MY run',()=>{
    expect(needsAgentBudget(job('PRICE_INTELLIGENCE'),{})).toBe(false);
    expect(needsAgentBudget(job('PRICE_INTELLIGENCE'),{PRICE_AGENT_LLM_ENABLED:'1'})).toBe(true);
    expect(needsAgentBudget(job('PRODUCT_YEAR',{parentRunId:'prior-mmv-id'}),{})).toBe(false);
    expect(needsAgentBudget(job('PRODUCT_YEAR'),{})).toBe(true);
    expect(needsAgentBudget(job('SOURCE_MONITOR'),{})).toBe(false);
    expect(needsAgentBudget(job('MMV_DISCOVERY'),{})).toBe(true);
  });
  it('requires DB reservation prior to dispatch and conservatively holds reserve',async()=>{
    const rpc=vi.fn(async(name:string)=>({
      data:name==='agent_spend_reserve_remaining'
        ?{id:'reserved-id',reservedUsd:1.99}:null,error:null,
    }));
    const c={rpc};
    const r=await reserveAgentPilotBudget(c,job('BRAND_CONNECTOR'));
    expect(r).toMatchObject({id:'reserved-id',reservedUsd:1.99});
    expect(rpc).toHaveBeenCalledWith('agent_spend_reserve_remaining',{
      p_budget_key:'qa:BR:GWM:BRAND_CONNECTOR',p_model:'BRAND_CONNECTOR',
      p_max_amount_usd:2,
    });
    await finishAgentPilotBudget(c,r);
    expect(rpc).toHaveBeenCalledWith('agent_spend_complete',{
      p_id:'reserved-id',p_usage_known:false,
    });
  });
  it('rejects an invalid or too-small reservation response',async()=>{
    for(const data of [null,{id:'test',reservedUsd:0},{id:'test',reservedUsd:2.5}]){
      const c={rpc:vi.fn(async()=>({data,error:null}))};
      await expect(reserveAgentPilotBudget(c,job('BRAND_CONNECTOR')))
        .rejects.toThrow('COST_ADMISSION_FAILED');
    }
  });
  it('fails closed on missing budget or exhausted capacity',async()=>{
    for(const code of ['COST_BUDGET_NOT_CONFIGURED','COST_BUDGET_EXHAUSTED']){
      const c={rpc:vi.fn(async()=>({data:null,error:{message:code}}))};
      await expect(reserveAgentPilotBudget(c,job('MMV_DISCOVERY'))).rejects.toThrow(code);
    }
  });
  it('rejects invalid scope instead of dispatching an unknown paid job',()=>{
    expect(()=>agentPilotBudgetKey(job('SPEC_INTELLIGENCE'))).toThrow('COST_INVALID_SCOPE');
    expect(()=>agentPilotBudgetKey({job_type:'MMV_DISCOVERY',market:'USA',brand:'GWM'}))
      .toThrow('COST_INVALID_SCOPE');
  });
});
