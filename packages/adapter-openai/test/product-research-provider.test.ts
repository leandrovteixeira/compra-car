import OpenAI from 'openai';
import { ProductResearchProviderError } from '../src';
import { readFile } from 'node:fs/promises';
import type { Response } from 'openai/resources/responses/responses';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  toyotaFixtureCandidates,
  jeepFixtureCandidates,
  NewProductCheckAgent,
  FixtureProductCatalogReader,
} from '@compra-car/core/agents';
import { OpenAIProductResearchProvider, type ProductResearchTransport } from '../src';
const scope = { country: 'BR', brand: 'Toyota' } as const;
const secret = 'synthetic-api-key-not-a-real-secret';
const response = (patch: Partial<Response> = {}) =>
  ({
    id: 'response-test',
    model: 'configured-model',
    status: 'completed',
    output_text: JSON.stringify({
      candidates: toyotaFixtureCandidates.map((c) => ({ ...c, extractionWarnings: [] })),
    }),
    output: [
      {
        type: 'web_search_call',
        id: 'search-test',
        status: 'completed',
        action: { type: 'search', query: 'Toyota', sources: [] },
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    ...patch,
  }) as Response;
beforeEach(() =>
  vi.stubGlobal('fetch', () => {
    throw new Error('Network forbidden');
  }),
);
afterEach(() => vi.unstubAllGlobals());
describe('OpenAI research adapter (mock transport only)', () => {
  it('uses Jeep registry and generic prompt through the same simulated Responses transport', async () => {
    const prompt = await readFile(
      new URL('../../../docs/agents/prompts/new-product-check-agent-v1.md', import.meta.url),
      'utf8',
    );
    expect(prompt).not.toContain('site:toyota.com.br');
    expect(prompt).not.toContain('site:media.toyota.com.br');
    const transport = vi.fn<ProductResearchTransport>(async () =>
      response({
        output_text: JSON.stringify({ candidates: jeepFixtureCandidates }),
      }),
    );
    const result = await new OpenAIProductResearchProvider({
      apiKey: secret,
      model: 'configured-model',
      prompt,
      transport,
    }).researchProducts({ country: 'BR', brand: 'Jeep' });
    const request = transport.mock.calls[0]![0];
    expect(request).toMatchObject({
      model: 'configured-model',
      instructions: prompt,
      tools: [
        {
          type: 'web_search',
          filters: { allowed_domains: ['jeep.com.br'] },
          user_location: { type: 'approximate', country: 'BR' },
        },
      ],
    });
    const input = JSON.parse(request.input as string);
    expect(input).toMatchObject({
      brand: 'Jeep',
      country: 'BR',
      allowedDomains: ['jeep.com.br'],
      allowedSubdomainRoots: ['jeep.com.br'],
      researchStages: ['MODEL_DISCOVERY', 'VARIANT_RESOLUTION'],
    });
    expect(input.searchHints.join(' ')).toContain('Hurricane Flex');
    expect(input.searchHints.join(' ')).not.toContain('Toyota');
    expect(result.candidates[0]?.officialVersionLabel).toBe('Longitude T270');
    expect(result.candidates[4]?.powertrainLabel).toBe('Hurricane Flex');
  });

  it('uses Responses, web search, allowlist, required schema and configured model', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('Network forbidden');
    });
    const transport = vi.fn<ProductResearchTransport>(async () => response());
    const provider = new OpenAIProductResearchProvider({
      apiKey: secret,
      model: 'configured-model',
      prompt: 'versioned prompt',
      transport,
    });
    const result = await provider.researchProducts(scope);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'configured-model',
        store: false,
        instructions: 'versioned prompt',
        tool_choice: 'required',
        tools: [
          {
            type: 'web_search',
            filters: { allowed_domains: ['toyota.com.br', 'media.toyota.com.br'] },
            user_location: { type: 'approximate', country: 'BR' },
          },
        ],
        text: { format: expect.objectContaining({ type: 'json_schema', strict: true }) },
      }),
    );
    expect(JSON.stringify(transport.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(transport.mock.calls)).not.toContain('cc-xr');
    expect(JSON.parse(transport.mock.calls[0]![0].input as string)).toMatchObject({
      allowedHosts: ['toyota.com.br', 'www.toyota.com.br', 'media.toyota.com.br'],
      researchStages: ['MODEL_DISCOVERY', 'VARIANT_RESOLUTION'],
    });
    expect(result.candidates[0]?.officialVersionLabel).toBe('XR');
    expect(result.metadata).toEqual({
      provider: 'openai',
      model: 'configured-model',
      responseId: 'response-test',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      webSearchCount: 1,
    });
  });

  it.each([
    { taxonomy: 'SEO_ROUTE' },
    { propulsion: 'HYBRID' },
    { price: 12345 },
    { version: 'XR 2.0 CVT' },
    { engineDisplacement: -1 },
  ])('rejects invalid structured fields or commercial data %j', async (patch) => {
    const provider = new OpenAIProductResearchProvider({
      apiKey: secret,
      model: 'm',
      prompt: 'p',
      transport: async () =>
        response({
          output_text: JSON.stringify({
            candidates: [{ ...toyotaFixtureCandidates[0], ...patch }],
          }),
        }),
    });
    await expect(provider.researchProducts(scope)).rejects.toThrow(
      'OPENAI_RESEARCH_INVALID_OUTPUT',
    );
  });
  it('allows absent token telemetry', async () => {
    const provider = new OpenAIProductResearchProvider({
      apiKey: secret,
      model: 'm',
      prompt: 'p',
      transport: async () => response({ usage: undefined }),
    });
    expect((await provider.researchProducts(scope)).metadata).not.toHaveProperty('inputTokens');
  });
  it.each([
    [{ status: 'incomplete' }, 'OPENAI_RESEARCH_INCOMPLETE'],
    [{ output: [] }, 'OPENAI_RESEARCH_NO_WEB_SEARCH'],
    [{ output_text: 'free prose' }, 'OPENAI_RESEARCH_INVALID_OUTPUT'],
    [{ output_text: '{"candidates":[{"model":"Invented"}]}' }, 'OPENAI_RESEARCH_INVALID_OUTPUT'],
    [{ output_text: '{"candidates":[],"type":"NEW_MODEL"}' }, 'OPENAI_RESEARCH_INVALID_OUTPUT'],
  ] as const)('fails closed on invalid responses %j', async (patch, code) => {
    const provider = new OpenAIProductResearchProvider({
      apiKey: secret,
      model: 'm',
      prompt: 'p',
      transport: async () => response(patch as Partial<Response>),
    });
    await expect(provider.researchProducts(scope)).rejects.toThrow(code);
  });
  it('sanitizes transport errors including keys', async () => {
    const provider = new OpenAIProductResearchProvider({
      apiKey: secret,
      model: 'm',
      prompt: 'p',
      transport: async () => {
        throw new Error(secret);
      },
    });
    await expect(provider.researchProducts(scope)).rejects.toThrow('OPENAI_RESEARCH_FAILED');
    await provider
      .researchProducts(scope)
      .catch((error) => expect(String(error)).not.toContain(secret));
  });
  it.each([
    { apiKey: '', model: 'm' },
    { apiKey: secret, model: '' },
  ])('requires explicit credentials and model', (options) => {
    expect(() => new OpenAIProductResearchProvider({ ...options, prompt: 'p' })).toThrow(
      'OPENAI_AGENT_CONFIG_REQUIRED',
    );
  });
  it('passes external evidence to core for rejection and audit counting', async () => {
    const provider = new OpenAIProductResearchProvider({
      apiKey: secret,
      model: 'm',
      prompt: 'p',
      transport: async () =>
        response({
          output_text: JSON.stringify({
            candidates: [
              {
                ...toyotaFixtureCandidates[1],
                extractionWarnings: [],
                evidence: [
                  { url: 'https://example.com', title: null, excerpt: null, evidenceType: null },
                ],
              },
            ],
          }),
        }),
    });
    const result = await new NewProductCheckAgent({
      research: provider,
      catalog: new FixtureProductCatalogReader(),
      reports: { write: async () => {} },
    }).run(scope, 'provider-test');
    expect(result.rejectedExternalSources).toBe(1);
    expect(result.findings).toHaveLength(0);
  });
});

describe('safe transport classification', () => {
  it.each([
    [400, 'BAD_REQUEST'],
    [422, 'BAD_REQUEST'],
    [401, 'AUTH'],
    [403, 'AUTH'],
    [408, 'TIMEOUT'],
    [429, 'RATE_LIMIT'],
    [500, 'SERVER_ERROR'],
    [503, 'SERVER_ERROR'],
    [404, 'FAILED'],
    ['timeout', 'TIMEOUT'],
    ['connection', 'CONNECTION'],
    ['unknown', 'FAILED'],
  ] as const)('classifies %s without retaining SDK content', async (kind, suffix) => {
    const privateText = 'sk-synthetic-key private-body private-header private-prompt';
    const raw =
      typeof kind === 'number'
        ? OpenAI.APIError.generate(
            kind,
            { message: privateText, code: privateText, param: privateText },
            privateText,
            new Headers({ authorization: privateText, 'x-request-id': privateText }),
          )
        : kind === 'timeout'
          ? new OpenAI.APIConnectionTimeoutError({ message: privateText })
          : kind === 'connection'
            ? new OpenAI.APIConnectionError({ message: privateText, cause: new Error(privateText) })
            : new Error(privateText);
    const provider = new OpenAIProductResearchProvider({
      apiKey: privateText,
      model: 'test',
      prompt: privateText,
      transport: async () => {
        throw raw;
      },
    });
    const failure = await provider.researchProducts(scope).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProductResearchProviderError);
    expect(failure).toMatchObject({
      code: 'OPENAI_RESEARCH_' + suffix,
      elapsedMs: expect.any(Number),
    });
    expect((failure as ProductResearchProviderError).status).toBe(
      typeof kind === 'number' ? kind : undefined,
    );
    expect((failure as ProductResearchProviderError).elapsedMs).toBeGreaterThanOrEqual(0);
    for (const field of ['cause', 'headers', 'error', 'body', 'apiCode', 'param', 'requestId'])
      expect(failure).not.toHaveProperty(field);
    expect(String(failure) + JSON.stringify(failure)).not.toContain(privateText);
  });
});
