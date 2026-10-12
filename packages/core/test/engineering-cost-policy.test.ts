import {describe,it,expect} from 'vitest';
import {AGENT_COST_POLICY,planAgentCostRemediation,type AgentCostProfile} from '../src/agents/engineering-cost-policy';

const complete: AgentCostProfile = {
 agent:'PRICE',preCallReserve:true,sharedLedger:true,outputBound:true,toolBound:true,
 modelPricing:true,unknownUsageHold:true,usageTelemetry:true,cheapFirstLadder:true,
};

describe('Engineering Price-derived agent cost policy',()=>{
 it('makes a failed cost-control audit the first work item',()=>{
  const result=planAgentCostRemediation({...complete,agent:'BRAND_CONNECTOR',
   preCallReserve:false,sharedLedger:false,unknownUsageHold:false});
  expect(result.firstAction).toBe('IMPLEMENT_COST_CONTROL');
  expect(result.findings).toEqual([
   'MISSING_PRECALL_RESERVE','MISSING_SHARED_LEDGER','MISSING_UNKNOWN_USAGE_HOLD',
  ]);
  expect(result.paidExecutionAllowed).toBe(false);
 });
 it('requires provider cap verification even when every internal control passes',()=>{
  expect(planAgentCostRemediation(complete)).toMatchObject({
   findings:[],paidExecutionAllowed:false,firstAction:'VERIFY_EXTERNAL_BILLING_LIMIT',
  });
 });
 it('puts expensive escalations after deterministic checks and reservations',()=>{
  expect(AGENT_COST_POLICY.preflight[0]).toBe('PREFER_DETERMINISTIC_OR_REPLAY');
  expect(AGENT_COST_POLICY.defaultModelLadder).toEqual(['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6-sol']);
 });
});
