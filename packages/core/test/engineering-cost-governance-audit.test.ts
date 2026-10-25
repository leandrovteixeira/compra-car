import {describe,it,expect} from 'vitest';
import {auditAgentCostGovernance,type AgentCostGovernanceCapabilities} from '../src/agents/engineering-cost-governance-audit';
const all:AgentCostGovernanceCapabilities={
 preCallReservation:true,sharedAtomicBudget:true,boundedModelTokens:true,boundedToolCalls:true,
 versionedPricing:true,failClosedUnknownUsage:true,concurrentRetryAccounting:true,durableAuditTrail:true,
};
describe('mandatory Engineering cost governance audit',()=>{
 it('requires remediation if pre-call admission is missing',()=>{
  expect(auditAgentCostGovernance({...all,preCallReservation:false})).toMatchObject({
   safeForPaidPilot:false,nextAction:'IMPLEMENT_COST_GOVERNANCE',
   mandatoryRemediations:['preCallReservation'],
  });
 });
 it('requires an externally proven billing ceiling even after passing internal checks',()=>{
  expect(auditAgentCostGovernance(all)).toMatchObject({
   safeForPaidPilot:false,nextAction:'VERIFY_EXTERNAL_BILLING_LIMIT',
   mandatoryRemediations:[],
  });
 });
});
