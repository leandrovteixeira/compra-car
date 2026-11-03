import { AGENT_COST_POLICY_VERSION, AGENT_COST_POLICY } from './engineering-cost-policy';
import type { PriceAiUsage } from './price-agent-types';
import type { WatcherDiscoverySnapshot } from './watcher-candidate-discovery';

export type WatcherAiGateBudget = Readonly<{
  maxCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostUsd: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  spentUsd: number;
  outstandingReserveUsd: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
}>;
/** Admission PLAN only. No provider, prompt, reserve, usage write or model dependency. */
export function planWatcherIntelligenceAi(input: {
  snapshot: WatcherDiscoverySnapshot;
  enabled?: boolean;
  explicitlyAuthorized?: boolean;
  budget?: WatcherAiGateBudget;
}) {
  const latest = new Map<string, (typeof input.snapshot.analyses)[number]>();
  for (const analysis of input.snapshot.analyses) {
    const prior = latest.get(analysis.revision.feedItemId);
    if (!prior || prior.revision.firstObservedAt < analysis.revision.firstObservedAt)
      latest.set(analysis.revision.feedItemId, analysis);
  }
  const current = new Set([...latest.values()].map((a) => a.revision.id));
  const candidates = input.snapshot.candidates.filter(
    (c) =>
      c.status === 'INSUFFICIENT' &&
      !c.evidence.some(
        (s) =>
          current.has(s.evidence.revisionId) &&
          (s.reasons.includes('NEGATED') ||
            s.applicability === 'NOT_APPLICABLE' ||
            s.claim === 'RUMOR'),
      ) &&
      c.evidence.some(
        (s) =>
          current.has(s.evidence.revisionId) &&
          s.applicability !== 'NOT_APPLICABLE' &&
          s.claim !== 'RUMOR' &&
          s.reasons.some((r) => ['UNCERTAIN_CLAIM', 'VERSION_NOT_RESOLVED'].includes(r)),
      ),
  );
  const usage: Pick<
    PriceAiUsage,
    | 'inputTokens'
    | 'cachedInputTokens'
    | 'outputTokens'
    | 'reasoningTokens'
    | 'webSearchCount'
    | 'estimatedCostUsd'
  > = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    webSearchCount: 0,
    estimatedCostUsd: 0,
  };
  let reason:
    | 'DISABLED'
    | 'NOT_AUTHORIZED'
    | 'NOT_NEEDED'
    | 'BUDGET_BLOCKED'
    | 'EXTERNAL_ATOMIC_ADMISSION_REQUIRED';
  const b = input.budget;
  if (input.enabled !== true) reason = 'DISABLED';
  else if (input.explicitlyAuthorized !== true) reason = 'NOT_AUTHORIZED';
  else if (!candidates.length) reason = 'NOT_NEEDED';
  else if (
    !b ||
    [
      'maxCalls',
      'maxInputTokens',
      'maxOutputTokens',
      'maxCostUsd',
      'calls',
      'inputTokens',
      'outputTokens',
      'spentUsd',
      'outstandingReserveUsd',
      'estimatedInputTokens',
      'estimatedOutputTokens',
      'estimatedCostUsd',
    ].some(
      (k) =>
        typeof b[k as keyof WatcherAiGateBudget] !== 'number' ||
        !Number.isFinite(b[k as keyof WatcherAiGateBudget]),
    ) ||
    Object.values(b).some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0) ||
    [
      'maxCalls',
      'maxInputTokens',
      'maxOutputTokens',
      'calls',
      'inputTokens',
      'outputTokens',
      'estimatedInputTokens',
      'estimatedOutputTokens',
    ].some((k) => !Number.isSafeInteger(b[k as keyof WatcherAiGateBudget])) ||
    b.calls + 1 > b.maxCalls ||
    b.inputTokens + b.estimatedInputTokens > b.maxInputTokens ||
    b.outputTokens + b.estimatedOutputTokens > b.maxOutputTokens ||
    b.estimatedInputTokens <= 0 ||
    b.estimatedOutputTokens <= 0 ||
    b.estimatedCostUsd <= 0 ||
    b.spentUsd + b.outstandingReserveUsd + b.estimatedCostUsd > b.maxCostUsd
  )
    reason = 'BUDGET_BLOCKED';
  else reason = 'EXTERNAL_ATOMIC_ADMISSION_REQUIRED';
  return {
    policyVersion: AGENT_COST_POLICY_VERSION,
    preflight: AGENT_COST_POLICY.preflight,
    reason,
    candidateKeys: candidates.map((c) => c.key),
    providerExecutionAllowed: false as const,
    calls: 0 as const,
    usage,
  };
}
