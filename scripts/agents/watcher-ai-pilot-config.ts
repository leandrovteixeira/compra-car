import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

export const WATCHER_MODELS_FILE = 'C:/Dev/.secrets/compra-car/agent-models.env';
export const WATCHER_QA_SECRETS_FILE = 'C:/Dev/.secrets/open_ai.env';
export type WatcherAiPilotConfig = Readonly<{
  model: string;
  maxArticles: number;
  hardCostCapUsd: number;
  apiKey: string;
}>;
/** No inherited keys or fallback; no secret values logged or persisted. */
export async function loadWatcherAiPilotConfig(
  read: (path: string) => Promise<string> = path => readFile(path, 'utf8'),
): Promise<WatcherAiPilotConfig> {
  const models = parseEnv(await read(WATCHER_MODELS_FILE));
  const secrets = parseEnv(await read(WATCHER_QA_SECRETS_FILE));
  if (models.AGENT_WATCHER_AI_ENABLED !== 'true' ||
      models.AGENT_WATCHER_AI_MAX_ARTICLES !== '20' ||
      models.AGENT_WATCHER_MODEL !== 'gpt-5.4-mini' ||
      !secrets.OPENAI_API_KEY?.trim()) throw new Error('WATCHER_AI_PILOT_CONFIG_BLOCKED');
  const cap = Number(models.AGENT_WATCHER_AI_HARD_COST_CAP_USD);
  if (!Number.isFinite(cap) || cap <= 0 || cap > 0.25)
    throw new Error('WATCHER_AI_PILOT_BUDGET_BLOCKED');
  return {model: models.AGENT_WATCHER_MODEL!, maxArticles:20,
    hardCostCapUsd:cap, apiKey:secrets.OPENAI_API_KEY};
}
