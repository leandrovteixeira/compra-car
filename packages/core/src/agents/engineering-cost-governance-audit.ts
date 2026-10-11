/** The engineering agent audits cost admission BEFORE any paid optimization. */
export interface AgentCostGovernanceCapabilities {
  readonly preCallReservation: boolean;
  readonly sharedAtomicBudget: boolean;
  readonly boundedModelTokens: boolean;
  readonly boundedToolCalls: boolean;
  readonly versionedPricing: boolean;
  readonly failClosedUnknownUsage: boolean;
  readonly concurrentRetryAccounting: boolean;
  readonly durableAuditTrail: boolean;
}
export interface AgentCostGovernanceAudit {
  readonly safeForPaidPilot: boolean;
  readonly mandatoryRemediations: readonly (keyof AgentCostGovernanceCapabilities)[];
  readonly nextAction: 'IMPLEMENT_COST_GOVERNANCE' | 'VERIFY_EXTERNAL_BILLING_LIMIT';
}
/** Passing internal checks is not proof of a billing-dollar ceiling. */
export function auditAgentCostGovernance(
  capabilities: AgentCostGovernanceCapabilities,
): AgentCostGovernanceAudit {
  const missing=(Object.keys(capabilities) as (keyof AgentCostGovernanceCapabilities)[])
    .filter(key=>capabilities[key]!==true);
  return {safeForPaidPilot:false,mandatoryRemediations:missing,
    nextAction:missing.length?'IMPLEMENT_COST_GOVERNANCE':'VERIFY_EXTERNAL_BILLING_LIMIT'};
}
