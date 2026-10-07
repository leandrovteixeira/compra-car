import type { LegacySupabaseClient } from '@compra-car/adapter-supabase';

function nonNegativeNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function estimateAiCostUsd(
  usage: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly webSearchCount?: number;
  },
  env: Readonly<Record<string, string | undefined>>,
): { readonly cost: number; readonly priced: boolean } {
  const inputRate = nonNegativeNumber(env.OPENAI_INPUT_USD_PER_1M);
  const outputRate = nonNegativeNumber(env.OPENAI_OUTPUT_USD_PER_1M);
  const searchRate = nonNegativeNumber(env.OPENAI_WEB_SEARCH_USD_PER_1K);
  const priced = inputRate !== null && outputRate !== null && searchRate !== null;
  if (!priced) return { cost: 0, priced: false };

  const cost =
    ((usage.inputTokens ?? 0) / 1_000_000) * inputRate +
    ((usage.outputTokens ?? 0) / 1_000_000) * outputRate +
    ((usage.webSearchCount ?? 0) / 1_000) * searchRate;
  return { cost: Math.max(0, cost), priced: true };
}

export async function recordAiUsage(
  client: LegacySupabaseClient,
  input: {
    readonly runId: string;
    readonly agentType: string;
    readonly market: string;
    readonly brand: string;
    readonly provider: string;
    readonly model: string;
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
    readonly webSearchCount?: number;
    readonly reason: string;
  },
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  const estimate = estimateAiCostUsd(input, env);
  const { error } = await client.from('agent_ai_usage_events').insert({
    run_id: input.runId,
    agent_type: input.agentType,
    market: input.market,
    brand: input.brand,
    provider: input.provider,
    model: input.model,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    total_tokens: input.totalTokens ?? (input.inputTokens ?? 0) + (input.outputTokens ?? 0),
    web_search_count: input.webSearchCount ?? 0,
    estimated_cost_usd: estimate.cost,
    reason: estimate.priced ? input.reason : input.reason + ':UNPRICED',
  });
  if (error) return;
}
