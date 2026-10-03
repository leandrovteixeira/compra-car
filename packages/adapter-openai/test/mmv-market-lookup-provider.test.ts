import { describe, expect, it } from 'vitest';
import type { Response } from 'openai/resources/responses/responses';
import { OpenAIMmvMarketLookupProvider } from '../src/mmv-market-lookup-provider';

const request = {
  market: 'BR' as const,
  brand: 'Kia',
  model: 'Niro',
  versionHints: ['EX', 'SX Prestige'],
};

function response(observations: unknown[]): Response {
  return {
    id: 'mock',
    object: 'response',
    created_at: 0,
    completed_at: 0,
    background: false,
    conversation: null,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    max_tool_calls: null,
    model: 'mock-model',
    output_text: JSON.stringify({ observations }),
    output: [
      {
        type: 'web_search_call',
        id: 'search',
        status: 'completed',
        action: { type: 'search', query: 'synthetic', sources: [] },
      },
    ],
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt: null,
    prompt_cache_key: null,
    prompt_cache_retention: null,
    reasoning: null,
    safety_identifier: null,
    service_tier: 'default',
    status: 'completed',
    temperature: 1,
    text: { format: { type: 'text' } },
    tool_choice: 'auto',
    tools: [],
    top_logprobs: 0,
    top_p: 1,
    truncation: 'disabled',
    usage: null,
    user: null,
  } as unknown as Response;
}

describe('OpenAIMmvMarketLookupProvider', () => {
  it('returns explicit secondary FIPE-code candidates tied to manufacturer version hints', async () => {
    const provider = new OpenAIMmvMarketLookupProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () =>
        response([
          {
            sourceKind: 'SECONDARY',
            sourceName: 'WEBMOTORS',
            sourceUrl:
              'https://www.webmotors.com.br/tabela-fipe/carros/kia/niro/2027/16-gdi-hev-ex-dct',
            fipeCode: '999999-9',
            brand: 'Kia',
            modelLabel: 'Niro 1.6 GDI HEV EX DCT',
            matchedVersionHint: 'EX',
            modelYear: 2027,
            referencePeriod: null,
            confidence: 0.95,
          },
          {
            sourceKind: 'SECONDARY',
            sourceName: 'WEBMOTORS',
            sourceUrl:
              'https://www.webmotors.com.br/tabela-fipe/carros/kia/niro/2027/16-gdi-hev-sx-prestige-dct',
            fipeCode: '888888-8',
            brand: 'Kia',
            modelLabel: 'Niro 1.6 GDI HEV SX Prestige DCT',
            matchedVersionHint: 'SX Prestige',
            modelYear: 2027,
            referencePeriod: null,
            confidence: 0.95,
          },
        ]),
    });

    const result = await provider.lookup(request);
    expect(result).toHaveLength(2);
    expect(result.map((item) => [item.matchedVersionHint, item.fipeCode])).toEqual([
      ['EX', '999999-9'],
      ['SX Prestige', '888888-8'],
    ]);
    expect(result.every((item) => item.sourceKind === 'SECONDARY')).toBe(true);
    expect(result.every((item) => Number.isFinite(Date.parse(item.capturedAt)))).toBe(true);
  });

  it('accepts official FIPE evidence only from the FIPE domain', async () => {
    const provider = new OpenAIMmvMarketLookupProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () =>
        response([
          {
            sourceKind: 'FIPE',
            sourceName: 'FIPE',
            sourceUrl: 'https://veiculos.fipe.org.br/',
            fipeCode: '999999-9',
            brand: 'Kia',
            modelLabel: 'Niro 1.6 GDI HEV EX DCT',
            matchedVersionHint: 'EX',
            modelYear: 2027,
            referencePeriod: 'outubro de 2026',
            confidence: 1,
          },
        ]),
    });

    await expect(provider.lookup(request)).resolves.toMatchObject([
      { sourceKind: 'FIPE', sourceName: 'FIPE', fipeCode: '999999-9' },
    ]);
  });

  it.each([
    {
      sourceKind: 'FIPE',
      sourceName: 'FIPE',
      sourceUrl: 'https://example.com/fipe',
      fipeCode: '999999-9',
      brand: 'Kia',
      modelLabel: 'Niro',
      matchedVersionHint: 'EX',
      modelYear: 2027,
      referencePeriod: null,
      confidence: 1,
    },
    {
      sourceKind: 'SECONDARY',
      sourceName: 'WEBMOTORS',
      sourceUrl: 'https://www.webmotors.com.br/tabela-fipe/kia/niro',
      fipeCode: 'INVALID',
      brand: 'Kia',
      modelLabel: 'Niro',
      matchedVersionHint: 'EX',
      modelYear: 2027,
      referencePeriod: null,
      confidence: 1,
    },
    {
      sourceKind: 'SECONDARY',
      sourceName: 'WEBMOTORS',
      sourceUrl: 'https://www.webmotors.com.br/tabela-fipe/kia/niro',
      fipeCode: '999999-9',
      brand: 'Kia',
      modelLabel: 'Niro',
      matchedVersionHint: 'UNKNOWN',
      modelYear: 2027,
      referencePeriod: null,
      confidence: 1,
    },
  ])('rejects unsafe or inconsistent observation %#', async (observation) => {
    const provider = new OpenAIMmvMarketLookupProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => response([observation]),
    });
    await expect(provider.lookup(request)).rejects.toThrow('MMV_MARKET_LOOKUP_INVALID_OUTPUT');
  });

  it('returns an empty result instead of requiring a guessed code', async () => {
    const provider = new OpenAIMmvMarketLookupProvider({
      apiKey: 'synthetic',
      model: 'mock',
      prompt: 'generic',
      transport: async () => response([]),
    });
    await expect(provider.lookup(request)).resolves.toEqual([]);
  });
});
