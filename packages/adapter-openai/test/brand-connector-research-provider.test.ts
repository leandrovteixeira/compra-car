import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'openai/resources/responses/responses';
import {
  BrandConnectorAgent,
  FixtureBrandConnectorResearchProvider,
} from '@compra-car/core/agents';
import { OpenAIBrandConnectorResearchProvider } from '../src';
const input = { brand: 'Volkswagen', market: 'BR', mode: 'discover' as const };
async function response(patch: Partial<Response> = {}): Promise<Response> {
  const fixture = await new FixtureBrandConnectorResearchProvider().researchConnector(input);
  return {
    id: 'mock',
    model: 'mock-model',
    status: 'completed',
    output_text: JSON.stringify({
      ...fixture,
      sourceEntries: fixture.sourceEntries.map((e) => ({ ...e, notes: null })),
    }),
    output: [
      {
        type: 'web_search_call',
        id: 'mock-search',
        status: 'completed',
        action: { type: 'search', query: 'synthetic', sources: [] },
      },
    ],
    ...patch,
  } as Response;
}
describe('Brand connector provider with injected transport only', () => {
  it('sends internal target unchanged and returns a separate observed label through the structured schema', async () => {
    const transport = vi.fn(async () => response());
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport,
    });
    const bundle = await new BrandConnectorAgent(provider).run(
      { brand: 'VW', market: 'BR', mode: 'discover' },
      undefined,
      'openai',
    );
    expect(bundle.findings[0]!.finding).toMatchObject({
      proposal: { brand: 'VW', market: 'BR' },
      payload: { observedBrandLabel: 'Volkswagen' },
    });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        input: JSON.stringify({ brand: 'VW', market: 'BR', mode: 'discover' }),
      }),
    );
  });
  it('rejects research that attempts to return canonical brand or target id fields', async () => {
    const valid = await response();
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => ({
        ...valid,
        output_text: JSON.stringify({
          ...JSON.parse(valid.output_text),
          brand: 'forged',
          target_id: 'forged',
        }),
      }),
    });
    await expect(provider.researchConnector(input)).rejects.toThrow(
      'CONNECTOR_RESEARCH_INVALID_OUTPUT',
    );
  });
  it('uses independent structured schema and broad discovery search without trusting domains', async () => {
    const transport = vi.fn(async () => response());
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock-model',
      prompt: 'generic',
      transport,
    });
    expect((await provider.researchConnector(input)).candidateDomains).toEqual([
      'volkswagen.com.br',
    ]);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        store: false,
        max_output_tokens: 1800,
        max_tool_calls: 2,
        tool_choice: 'required',
        tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'BR' } }],
        text: {
          format: expect.objectContaining({ name: 'brand_connector_research_v1', strict: true }),
        },
      }),
    );
  });
  it.each([
    { status: 'incomplete' as const },
    { output: [] },
    { output_text: 'invalid' },
    { output_text: '{}' },
  ])('rejects incomplete or invalid research %j', async (patch) => {
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => response(patch),
    });
    await expect(provider.researchConnector(input)).rejects.toThrow();
  });
  it('redacts transport failures', async () => {
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => {
        throw Error('secret raw response');
      },
    });
    await expect(provider.researchConnector(input)).rejects.toThrow('CONNECTOR_RESEARCH_FAILED');
  });
});


describe('Sprint 22.5B usage telemetry', () => {
  it('records API response usage without a second transport request', async () => {
    const onUsage = vi.fn();
    const transport = vi.fn(async () => response({
      usage: {
        input_tokens: 120,
        output_tokens: 30,
        total_tokens: 150,
        input_tokens_details: { cached_tokens: 80, cache_write_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    }));
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic', model: 'mock', prompt: 'generic', transport, onUsage,
    });
    await provider.researchConnector(input);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledOnce();
    expect(onUsage).toHaveBeenCalledWith({
      llmCalls: 1, webSearches: 1, inputTokens: 120,
      outputTokens: 30, cachedInputTokens: 80,
    });
  });
  it('does not transform failed transport into invented usage', async () => {
    const onUsage = vi.fn();
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey:'synthetic', model:'mock', prompt:'generic', onUsage,
      transport: async () => {throw Error('network failed');},
    });
    await expect(provider.researchConnector(input)).rejects.toThrow('CONNECTOR_RESEARCH_FAILED');
    expect(onUsage).not.toHaveBeenCalled();
  });
});

describe('Brand paid-call preflight limits', () => {
  it('rejects attempts to raise output or web-call ceilings', () => {
    expect(() => new OpenAIBrandConnectorResearchProvider({
      apiKey:'fixture', model:'test-model', prompt:'fixture',
      maxOutputTokens:1801, transport:async()=>response(),
    })).toThrow('CONNECTOR_BUDGET_BOUND_INVALID');
    expect(() => new OpenAIBrandConnectorResearchProvider({
      apiKey:'fixture', model:'test-model', prompt:'fixture',
      maxToolCalls:3, transport:async()=>response(),
    })).toThrow('CONNECTOR_BUDGET_BOUND_INVALID');
  });
});
