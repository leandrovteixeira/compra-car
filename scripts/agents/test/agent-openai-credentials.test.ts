import {describe,expect,it} from 'vitest';
import {
  AGENT_OPENAI_KEY_VARIABLES,
  agentOpenAiApiKey,
  requireAgentOpenAiApiKey,
  agentOpenAiSecrets,
} from '../agent-openai-credentials';

describe('isolation of OpenAI credentials by agent',()=>{
  const env={
    OPENAI_API_KEY:'disabled-old-global-key',
    OPENAI_BRAND_CONNECTOR_API_KEY:'brand-only',
    OPENAI_MMV_DISCOVERY_API_KEY:'mmv-only',
    OPENAI_MODEL_YEAR_API_KEY:'my-only',
    OPENAI_PRICE_AGENT_API_KEY:'price-only',
  };
  it('maps each agent to one explicit secret variable',()=>{
    expect(Object.values(AGENT_OPENAI_KEY_VARIABLES)).toHaveLength(4);
    expect(new Set(Object.values(AGENT_OPENAI_KEY_VARIABLES)).size).toBe(4);
    expect(agentOpenAiApiKey(env,'BRAND_CONNECTOR')).toBe('brand-only');
    expect(agentOpenAiApiKey(env,'MMV_DISCOVERY')).toBe('mmv-only');
    expect(agentOpenAiApiKey(env,'MODEL_YEAR')).toBe('my-only');
    expect(agentOpenAiApiKey(env,'PRICE_INTELLIGENCE')).toBe('price-only');
  });
  it('never falls back to a disabled global or another agent key',()=>{
    expect(agentOpenAiApiKey({OPENAI_API_KEY:'old-key'},'BRAND_CONNECTOR')).toBeNull();
    expect(agentOpenAiApiKey({OPENAI_MMV_DISCOVERY_API_KEY:'mmv'},'MODEL_YEAR')).toBeNull();
    expect(()=>requireAgentOpenAiApiKey({OPENAI_API_KEY:'old-key'},'BRAND_CONNECTOR'))
      .toThrow('AGENT_OPENAI_KEY_MISSING');
    expect(requireAgentOpenAiApiKey(env,'MMV_DISCOVERY')).toBe('mmv-only');
  });
  it('redacts all credentials, including the historical shared one',()=>{
    expect(agentOpenAiSecrets(env).sort()).toEqual(Object.values(env).sort());
    expect(agentOpenAiSecrets({
      OPENAI_BRAND_CONNECTOR_API_KEY:'one',
      OPENAI_MMV_DISCOVERY_API_KEY:'one',
    })).toEqual(['one']);
  });
});
