/**
 * Engineering Agent's canonical remediation recipe for existing paid agents.
 *
 * Price Agent reference:
 * - deterministic grouping / cache before paid reasoning
 * - cheapest model first with escalation only for ambiguous cases
 * - conservative per-request reserves before Responses API
 * - max_output_tokens and maxRetries=0
 * - observed usage costing including cached tokens and web-search charges
 *
 * DO NOT copy Price's local `spent + reserve` guard verbatim: it does not retain
 * all outstanding reserves, and missing usage/errors must not mean zero charge.
 */
export const AGENT_COST_POLICY_VERSION = 'engineering-cost-policy-v1' as const;
export const AGENT_COST_POLICY = {
  version: AGENT_COST_POLICY_VERSION,
  defaultModelLadder: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'],
  preflight: [
    'PREFER_DETERMINISTIC_OR_REPLAY',
    'REQUIRE_REVIEWED_EVIDENCE_FOR_REUSE',
    'VALIDATE_MODEL_PRICING_AND_TOOL_FEES',
    'BOUND_OUTPUT_TOKENS_AND_TOOL_CALLS',
    'ATOMIC_RESERVE_SHARED_RUN_BUDGET',
  ],
  afterCall: [
    'RECORD_INPUT_CACHED_OUTPUT_AND_WEB_USAGE',
    'KEEP_FULL_RESERVE_ON_UNKNOWN_USAGE_OR_ERROR',
    'ESCALATE_ONLY_UNRESOLVED_AMBIGUITY',
    'REQUIRE_EXPLICIT_REVIEW_FOR_POLICY_CHANGE',
  ],
  paidPilotGate: 'PROVIDER_BILLING_LIMIT_REQUIRED',
  targetOrder: ['BRAND_CONNECTOR', 'MMV_DISCOVERY', 'MODEL_YEAR', 'SPEC', 'PRICE'],
} as const;

export type CostControlFinding =
  | 'MISSING_PRECALL_RESERVE' | 'MISSING_SHARED_LEDGER'
  | 'MISSING_OUTPUT_BOUND' | 'MISSING_TOOL_BOUND'
  | 'MISSING_PRICING' | 'MISSING_UNKNOWN_USAGE_HOLD'
  | 'MISSING_TELEMETRY' | 'MISSING_CHEAP_FIRST_LADDER';

export interface AgentCostProfile {
  readonly agent: string;
  readonly preCallReserve: boolean;
  readonly sharedLedger: boolean;
  readonly outputBound: boolean;
  readonly toolBound: boolean;
  readonly modelPricing: boolean;
  readonly unknownUsageHold: boolean;
  readonly usageTelemetry: boolean;
  readonly cheapFirstLadder: boolean;
}
export interface CostRemediationPlan {
  readonly policyVersion: typeof AGENT_COST_POLICY_VERSION;
  readonly agent: string;
  readonly findings: readonly CostControlFinding[];
  readonly paidExecutionAllowed: false;
  readonly firstAction: 'IMPLEMENT_COST_CONTROL' | 'VERIFY_EXTERNAL_BILLING_LIMIT';
}
export function planAgentCostRemediation(profile: AgentCostProfile): CostRemediationPlan {
  if (!profile.agent.trim()) throw new Error('COST_AGENT_REQUIRED');
  const findings: CostControlFinding[] = [];
  const flags: readonly [keyof AgentCostProfile, CostControlFinding][] = [
    ['preCallReserve','MISSING_PRECALL_RESERVE'],
    ['sharedLedger','MISSING_SHARED_LEDGER'],
    ['outputBound','MISSING_OUTPUT_BOUND'],
    ['toolBound','MISSING_TOOL_BOUND'],
    ['modelPricing','MISSING_PRICING'],
    ['unknownUsageHold','MISSING_UNKNOWN_USAGE_HOLD'],
    ['usageTelemetry','MISSING_TELEMETRY'],
    ['cheapFirstLadder','MISSING_CHEAP_FIRST_LADDER'],
  ];
  for (const [field,finding] of flags) if (profile[field] !== true) findings.push(finding);
  return {
    policyVersion: AGENT_COST_POLICY_VERSION,
    agent:profile.agent,
    findings,
    paidExecutionAllowed:false,
    firstAction:findings.length ? 'IMPLEMENT_COST_CONTROL' : 'VERIFY_EXTERNAL_BILLING_LIMIT',
  };
}
