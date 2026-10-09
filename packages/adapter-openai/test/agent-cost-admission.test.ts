import { describe, expect, it, vi } from 'vitest';
import { InMemoryAgentCostAdmission } from '../src/agent-cost-admission';
import { OpenAIBrandConnectorResearchProvider } from '../src/brand-connector-research-provider';

describe('Engineering mandatory pre-call cost admission',()=>{
  it('serializes competing reservations and rejects over-budget calls',async()=>{
    const admission=new InMemoryAgentCostAdmission(2,{'test-model':1.25});
    const settled=await Promise.allSettled([admission.reserve('test-model'),admission.reserve('test-model')]);
    expect(settled.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect(settled.filter(x=>x.status==='rejected')).toHaveLength(1);
    expect(admission.snapshot().consumedReserveUsd).toBe(1.25);
  });
  it('holds reserve after failed response instead of releasing uncertain spend',async()=>{
    const admission=new InMemoryAgentCostAdmission(2,{'test-model':1.25});
    const reservation=await admission.reserve('test-model');
    await admission.complete(reservation,false);
    await expect(admission.reserve('test-model')).rejects.toThrow('COST_BUDGET_EXHAUSTED');
    await expect(admission.reserve('unknown')).rejects.toThrow('COST_PRICING_UNKNOWN');
  });
  it('blocks a real Brand research provider before transport when admission is absent',async()=>{
    const provider=new OpenAIBrandConnectorResearchProvider({
      apiKey:'synthetic',model:'test-model',prompt:'fixture',
    });
    await expect(provider.researchConnector({brand:'Kia',market:'BR',mode:'discover'}))
      .rejects.toThrow('COST_ADMISSION_REQUIRED');
  });
  it('prevents transport call if a reservation is refused',async()=>{
    const transport=vi.fn();
    const provider=new OpenAIBrandConnectorResearchProvider({
      apiKey:'synthetic',model:'unknown',prompt:'fixture',transport,
      costAdmission:new InMemoryAgentCostAdmission(2,{'test-model':1}),
    });
    await expect(provider.researchConnector({brand:'Kia',market:'BR',mode:'discover'}))
      .rejects.toThrow('COST_PRICING_UNKNOWN');
    expect(transport).not.toHaveBeenCalled();
  });
});
