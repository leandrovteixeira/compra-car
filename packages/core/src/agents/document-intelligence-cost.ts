import type { DocumentUsage } from './document-intelligence-types';
export const DOCUMENT_STRATEGY = {
  primaryModel: 'gpt-5.6-terra',
  repairModel: 'gpt-5.6-sol',
  maxRepairCalls: 1,
  documentHardCostCapUsd: 1,
  targetCostUsd: 0.3,
  softWarningUsd: 0.5,
  maxOutputTokens: 18000,
  reasoningEffort: 'low',
} as const;
/** Benchmark tariffs. Cache discount is deliberately conservative until explicitly configured. USD / million. */
export const DOCUMENT_PRICING: Readonly<
  Record<string, { input: number; cachedInput: number; output: number }>
> = {
  'gpt-5.6-terra': { input: 2, cachedInput: 2, output: 12 },
  'gpt-5.6-sol': { input: 4, cachedInput: 4, output: 20 },
};
export function documentCost(model: string, u: DocumentUsage): number {
  const p = DOCUMENT_PRICING[model];
  if (
    !p ||
    Object.values(u).some((v) => !Number.isFinite(v) || v < 0) ||
    u.cachedInputTokens > u.inputTokens ||
    u.reasoningTokens > u.outputTokens
  )
    throw new Error('INVALID_DOCUMENT_USAGE');
  return (
    ((u.inputTokens - u.cachedInputTokens) * p.input +
      u.cachedInputTokens * p.cachedInput +
      u.outputTokens * p.output) /
    1e6
  );
}
export function maximumDocumentCost(model: string, inputTokens: number, outputTokens: number) {
  return documentCost(model, {
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    reasoningTokens: 0,
  });
}
