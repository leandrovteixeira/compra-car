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
