import { describe, it, expect, vi } from 'vitest';
import type { Response } from 'openai/resources/responses/responses';
import {
  BrandConnectorAgent,
  FixtureBrandConnectorResearchProvider,
} from '@compra-car/core/agents';
import { OpenAIBrandConnectorResearchProvider, BrandConnectorResearchProviderError } from '../src';
import OpenAI from 'openai';
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
  it('rejects a candidate domain without evidence in the same response', async () => {
    const valid = await response();
    const data = JSON.parse(valid.output_text);
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => ({
        ...valid,
        output_text: JSON.stringify({
          ...data,
          candidateDomains: ['vw.com.br', 'outro-dominio.com.br'],
          sourceEntries: [
            { type: 'MODEL_INDEX', url: 'https://vw.com.br/modelos', priority: 1, notes: null },
          ],
          evidence: [
            ...data.evidence,
            {
              url: 'https://vw.com.br/legal',
              title: 'Official ownership',
              excerpt: 'Manufacturer',
            },
          ],
        }),
      }),
    });
    await expect(new BrandConnectorAgent(provider).run(input, undefined, 'openai')).rejects.toThrow(
      'CONNECTOR_DOMAIN_EVIDENCE_REQUIRED',
    );
  });

  it.each([
    [400, 'BAD_REQUEST'],
    [422, 'BAD_REQUEST'],
    [401, 'AUTH'],
    [403, 'AUTH'],
    [408, 'TIMEOUT'],
    [429, 'RATE_LIMIT'],
    [500, 'SERVER_ERROR'],
  ] as const)('redacts SDK failure %i into %s', async (status, suffix) => {
    const raw = new OpenAI.APIError(
      status,
      { message: 'secret response' },
      'secret message',
      new Headers({ authorization: 'secret-api-key' }),
    );
    const transport = vi.fn(async () => {
      throw raw;
    });
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'secret-api-key',
      model: 'mock',
      prompt: 'generic',
      transport,
    });
    const error = await provider.researchConnector(input).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(BrandConnectorResearchProviderError);
    expect(error).toMatchObject({
      code: `CONNECTOR_RESEARCH_${suffix}`,
      message: `CONNECTOR_RESEARCH_${suffix}`,
      status,
    });
    expect(error).not.toHaveProperty('cause');
    expect(error).not.toHaveProperty('headers');
    expect(String(error) + JSON.stringify(error)).not.toContain('secret');
    expect(transport).toHaveBeenCalledOnce();
  });

  it.each([
    [new OpenAI.APIConnectionTimeoutError({ message: 'secret timeout' }), 'TIMEOUT'],
    [new OpenAI.APIConnectionError({ message: 'secret connection' }), 'CONNECTION'],
  ] as const)('classifies connection errors safely', async (raw, suffix) => {
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => {
        throw raw;
      },
    });
    const error = await provider.researchConnector(input).catch((error: unknown) => error);
    expect(error).toMatchObject({ code: `CONNECTOR_RESEARCH_${suffix}` });
    expect(error).not.toHaveProperty('cause');
    expect(String(error) + JSON.stringify(error)).not.toContain('secret');
  });
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
      subject: { brand: 'VW', canonicalBrand: 'Volkswagen', market: 'BR' },
      payload: {
        observedBrandLabel: 'Volkswagen',
        canonicalBrand: 'Volkswagen',
        aliases: [
          expect.objectContaining({
            alias: 'VW',
            aliasType: 'OFFICIAL_SHORT_NAME',
          }),
        ],
      },
    });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        input: JSON.stringify({ brand: 'VW', market: 'BR', mode: 'discover' }),
      }),
    );
  });
  it('rejects undeclared operational target fields outside the structured identity contract', async () => {
    const valid = await response();
    const provider = new OpenAIBrandConnectorResearchProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => ({
        ...valid,
        output_text: JSON.stringify({
          ...JSON.parse(valid.output_text),
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
  it('captures token usage and reports output limit before rejecting incomplete research', async () => {
    const onUsage=vi.fn();
    const incomplete=await response({
      status:'incomplete',
      incomplete_details:{reason:'max_output_tokens'},
      usage:{
        input_tokens:2100,
        output_tokens:4000,
        total_tokens:6100,
        input_tokens_details:{cached_tokens:0},
        output_tokens_details:{reasoning_tokens:0},
      } as Response['usage'],
    });
    const transport=vi.fn(async()=>incomplete);
    const provider=new OpenAIBrandConnectorResearchProvider({
      apiKey:'synthetic',model:'mock',prompt:'generic',
      transport,onUsage,
    });
    await expect(provider.researchConnector(input)).rejects.toThrow('CONNECTOR_RESEARCH_OUTPUT_LIMIT');
    expect(onUsage).toHaveBeenCalledOnce();
    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({
      inputTokens:2100,outputTokens:4000,totalTokens:6100,
      webSearchCount:1,
    }));
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        max_output_tokens:6000,
        reasoning:{effort:'low'},
        instructions:expect.stringContaining('at most 8 official sourceEntries'),
      }),
    );
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
