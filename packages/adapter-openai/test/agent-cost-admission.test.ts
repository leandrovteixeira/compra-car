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
  it('retains QA Brand legacy behavior without touching OpenAI',async()=>{
    const transport=vi.fn(async()=>{throw new Error('fixture');});
    const provider=new OpenAIBrandConnectorResearchProvider({
      apiKey:'synthetic',model:'test-model',prompt:'fixture',transport,
    });
    await expect(provider.researchConnector({brand:'Kia',market:'BR',mode:'discover'}))
      .rejects.toThrow();
    expect(transport).toHaveBeenCalledOnce();
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

describe('Kia VW multi-agent shared-budget offline simulation',()=>{
 it('allows only two reserved calls across brands under a shared two-dollar ledger', async()=>{
  const ledger=new InMemoryAgentCostAdmission(2,{'pilot-model':0.9});
  const transport=vi.fn(async()=>{throw new Error('simulated transport failure, no API');});
  const provider=new OpenAIBrandConnectorResearchProvider({
   apiKey:'synthetic',model:'pilot-model',prompt:'fixture',transport,costAdmission:ledger,
  });
  await Promise.all([
   expect(provider.researchConnector({brand:'Kia',market:'BR',mode:'discover'}))
    .rejects.toThrow('CONNECTOR_RESEARCH_FAILED'),
   expect(provider.researchConnector({brand:'Volkswagen',market:'BR',mode:'discover'}))
    .rejects.toThrow('CONNECTOR_RESEARCH_FAILED'),
  ]);
  expect(transport).toHaveBeenCalledTimes(2);
  await expect(provider.researchConnector({brand:'Kia',market:'BR',mode:'discover'}))
   .rejects.toThrow('COST_BUDGET_EXHAUSTED');
  expect(transport).toHaveBeenCalledTimes(2);
  expect(ledger.snapshot()).toMatchObject({budgetUsd:2,consumedReserveUsd:1.8,pending:0});
 });
});
