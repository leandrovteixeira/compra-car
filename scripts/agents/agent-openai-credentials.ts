/** Isolated OpenAI credentials for QA agent workers.
 * Never fall back silently to OPENAI_API_KEY: it may be disabled, shared, or
 * charged to a different project. Never log or persist secret values.
 */
export const AGENT_OPENAI_KEY_VARIABLES = {
  BRAND_CONNECTOR: 'OPENAI_BRAND_CONNECTOR_API_KEY',
  MMV_DISCOVERY: 'OPENAI_MMV_DISCOVERY_API_KEY',
  MODEL_YEAR: 'OPENAI_MODEL_YEAR_API_KEY',
  PRICE_INTELLIGENCE: 'OPENAI_PRICE_AGENT_API_KEY',
} as const;

export type AgentOpenAiKeyOwner = keyof typeof AGENT_OPENAI_KEY_VARIABLES;
type Env = Readonly<Record<string,string | undefined>>;

export function agentOpenAiApiKey(env:Env,agent:AgentOpenAiKeyOwner):string|null {
  return env[AGENT_OPENAI_KEY_VARIABLES[agent]]?.trim()||null;
}

export function requireAgentOpenAiApiKey(env:Env,agent:AgentOpenAiKeyOwner):string {
  const key=agentOpenAiApiKey(env,agent);
  if(!key) throw new Error('AGENT_OPENAI_KEY_MISSING:'+AGENT_OPENAI_KEY_VARIABLES[agent]);
  return key;
}

/** All agent keys are redacted, even when an agent reports another agent's payload. */
export function agentOpenAiSecrets(env:Env):string[]{
  return [...new Set([
    env.OPENAI_API_KEY, // legacy reports might contain this value
    ...Object.values(AGENT_OPENAI_KEY_VARIABLES).map(name=>env[name]),
  ].filter((key):key is string=>typeof key==='string'&&key.trim().length>0))];
}
