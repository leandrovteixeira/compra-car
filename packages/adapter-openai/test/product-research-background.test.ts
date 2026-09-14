import OpenAI from 'openai';
import type { Response } from 'openai/resources/responses/responses';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  toyotaFixtureCandidates,
  NewProductCheckAgent,
  OperationalBrandConnectorResolver,
  fixtureActiveConnector,
  volkswagenConnectorFixture,
} from '@compra-car/core/agents';
import {
  OpenAIProductResearchProvider,
  productResearchMaxWaitMs,
  type ProductResearchBackgroundTransport,
} from '../src';
import { productResearchSchema } from '../src/product-research-schema';

const scope = { country: 'BR', brand: 'Toyota' } as const;
const result = (status: Response['status'] = 'completed', patch: Partial<Response> = {}) =>
  ({
    id: 'same-response',
    model: 'unchanged-model',
    status,
    output: [{ type: 'web_search_call', status: 'completed' }],
    output_text: JSON.stringify({
      candidates: toyotaFixtureCandidates.map((c) => ({ ...c, extractionWarnings: [] })),
    }),
    ...patch,
  }) as Response;
function setup(sequence: Array<Response | Error>, maxWaitMs = 60_000) {
  let now = 0;
  const clock = {
    now: () => now,
    sleep: vi.fn(async (ms: number) => {
      now += ms;
    }),
  };
  const next = async () => {
    const item = sequence.length > 1 ? sequence.shift()! : sequence[0]!;
    if (item instanceof Error) throw item;
    return item;
  };
  const transport = {
    create: vi.fn<ProductResearchBackgroundTransport['create']>(next),
    retrieve: vi.fn<ProductResearchBackgroundTransport['retrieve']>(next),
  };
  const provider = new OpenAIProductResearchProvider({
    apiKey: 'synthetic',
    model: 'unchanged-model',
    prompt: 'unchanged-prompt',
    transport,
    clock,
    maxWaitMs,
  });
  return { provider, transport, clock };
}
beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    }),
  ),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('background MMV execution', () => {
  it('uses the ACTIVE VW connector through the MMV agent and background transport', async () => {
    const { provider, transport } = setup([
      result('queued'),
      result('completed', { output_text: '{"candidates":[]}' }),
    ]);
    const active = fixtureActiveConnector({ ...volkswagenConnectorFixture, brand: 'VW' });
    const repository = { getActiveConnector: vi.fn(async () => active) };
    await new NewProductCheckAgent({
      research: provider,
      connectorResolver: new OperationalBrandConnectorResolver(repository),
      catalog: { readProducts: async () => [] },
      reports: { write: async () => {} },
    }).run({ country: 'BR', brand: 'VW' }, 'background-vw');
    expect(repository.getActiveConnector).toHaveBeenCalledWith('VW', 'BR');
    const request = transport.create.mock.calls[0]![0];
    expect(JSON.parse(request.input as string)).toMatchObject({
      brand: 'VW',
      allowedDomains: active.allowedDomains,
    });
    expect(request.tools).toContainEqual(
      expect.objectContaining({ filters: { allowed_domains: active.allowedDomains } }),
    );
    expect(transport.retrieve).toHaveBeenCalledTimes(1);
  });
  it('includes create duration and caps polling HTTP timeout to the remaining budget', async () => {
    let now = 0;
    const retrieve = vi.fn<ProductResearchBackgroundTransport['retrieve']>(async () => {
      now = 60_001;
      return result();
    });
    const provider = new OpenAIProductResearchProvider({
      apiKey: 'synthetic',
      model: 'm',
      prompt: 'p',
      maxWaitMs: 60_000,
      clock: {
        now: () => now,
        sleep: async (ms) => {
          now += ms;
        },
      },
      transport: {
        create: async () => {
          now = 57_000;
          return result('queued');
        },
        retrieve,
      },
    });
    await expect(provider.researchProducts(scope)).rejects.toMatchObject({
      code: 'OPENAI_RESEARCH_TIMEOUT',
      elapsedMs: 60_001,
    });
    expect(retrieve).toHaveBeenCalledWith(
      'same-response',
      expect.objectContaining({ timeout: 1000 }),
    );
  });
  it.each([[], ['queued'], ['queued', 'in_progress']] as const)(
    'polls sequence %j',
    async (...args) => {
      const statuses = args as Array<'queued' | 'in_progress'>;
      const { provider, transport, clock } = setup([...statuses.map((s) => result(s)), result()]);
      expect((await provider.researchProducts(scope)).candidates).toHaveLength(
        toyotaFixtureCandidates.length,
      );
      expect(transport.create).toHaveBeenCalledTimes(1);
      expect(transport.retrieve).toHaveBeenCalledTimes(statuses.length);
      expect(clock.sleep.mock.calls).toEqual(statuses.map(() => [2000]));
      for (const call of transport.retrieve.mock.calls)
        expect(call).toEqual([
          'same-response',
          expect.objectContaining({ timeout: expect.any(Number), signal: expect.any(AbortSignal) }),
        ]);
      expect(transport.create.mock.calls[0]).toEqual([
        expect.objectContaining({
          background: true,
          store: false,
          model: 'unchanged-model',
          instructions: 'unchanged-prompt',
          tool_choice: 'required',
          include: ['web_search_call.action.sources'],
          tools: [
            {
              type: 'web_search',
              filters: { allowed_domains: ['toyota.com.br', 'media.toyota.com.br'] },
              user_location: { type: 'approximate', country: 'BR' },
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'official_product_candidates_v2',
              strict: true,
              schema: productResearchSchema,
            },
          },
        }),
        expect.objectContaining({ timeout: 60000 }),
      ]);
    },
  );
  it.each([
    ['failed', 'FAILED'],
    ['incomplete', 'INCOMPLETE'],
    ['cancelled', 'CANCELLED'],
    [undefined, 'FAILED'],
  ] as const)('handles terminal %s', async (status, code) => {
    const { provider, transport } = setup([result('queued'), result('completed', { status })]);
    await expect(provider.researchProducts(scope)).rejects.toThrow('OPENAI_RESEARCH_' + code);
    expect(transport.retrieve).toHaveBeenCalledTimes(1);
  });
  it.each(['timeout', 'connection', 429, 500, 503] as const)(
    'retries only retrieve for %s',
    async (kind) => {
      const error =
        kind === 'timeout'
          ? new OpenAI.APIConnectionTimeoutError({ message: 'private' })
          : kind === 'connection'
            ? new OpenAI.APIConnectionError({ message: 'private' })
            : OpenAI.APIError.generate(kind, { message: 'private' }, 'private', new Headers());
      const { provider, transport, clock } = setup([result('queued'), error, result()]);
      await provider.researchProducts(scope);
      expect(transport.create).toHaveBeenCalledTimes(1);
      expect(transport.retrieve).toHaveBeenCalledTimes(2);
      expect(clock.sleep.mock.calls).toEqual([[2000], [2000]]);
      for (const call of transport.retrieve.mock.calls) expect(call[0]).toBe('same-response');
    },
  );
  it.each([400, 401, 403, 404, 422])('does not retry polling HTTP %s', async (status) => {
    const { provider, transport } = setup([
      result('queued'),
      OpenAI.APIError.generate(status, { message: 'private' }, 'private', new Headers()),
    ]);
    await expect(provider.researchProducts(scope)).rejects.toThrow('OPENAI_RESEARCH_');
    expect(transport.retrieve).toHaveBeenCalledTimes(1);
    expect(transport.create).toHaveBeenCalledTimes(1);
  });
  it('never retries create', async () => {
    const { provider, transport } = setup([new OpenAI.APIConnectionTimeoutError()]);
    await expect(provider.researchProducts(scope)).rejects.toThrow('OPENAI_RESEARCH_TIMEOUT');
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.retrieve).not.toHaveBeenCalled();
  });
  it.each([result('queued'), new OpenAI.APIConnectionError({ message: 'private' })])(
    'bounds queued and transient retry loops',
    async (last) => {
      const { provider, transport, clock } = setup([result('queued'), last]);
      await expect(provider.researchProducts(scope)).rejects.toMatchObject({
        code: 'OPENAI_RESEARCH_TIMEOUT',
        elapsedMs: 60000,
      });
      expect(transport.create).toHaveBeenCalledTimes(1);
      expect(transport.retrieve).toHaveBeenCalledTimes(29);
      expect(clock.sleep).toHaveBeenCalledTimes(30);
    },
  );
  it('bounds hung HTTP operations and aborts their signal', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const provider = new OpenAIProductResearchProvider({
      apiKey: 'synthetic',
      model: 'm',
      prompt: 'p',
      transport: {
        create: async (_, options) => {
          signal = options.signal;
          return new Promise<Response>(() => {});
        },
        retrieve: vi.fn(),
      },
    });
    const pending = expect(provider.researchProducts(scope)).rejects.toMatchObject({
      code: 'OPENAI_RESEARCH_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(60000);
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('validates completed output after polling', async () => {
    const { provider } = setup([
      result('queued'),
      result('completed', { output_text: 'private invalid JSON' }),
    ]);
    await expect(provider.researchProducts(scope)).rejects.toThrow(
      'OPENAI_RESEARCH_INVALID_OUTPUT',
    );
  });
  it('rejects changed or absent polling identity', async () => {
    for (const sequence of [
      [result('queued', { id: '' })],
      [result('queued'), result('in_progress', { id: 'different' })],
    ]) {
      const { provider } = setup(sequence);
      await expect(provider.researchProducts(scope)).rejects.toThrow('OPENAI_RESEARCH_FAILED');
    }
  });
  it.each([undefined, '', 'bad', 'Infinity', '-1', '60000.5', '6e4', 59999, 1800001, NaN])(
    'defaults unsafe max wait %s',
    (value) => {
      expect(productResearchMaxWaitMs(value)).toBe(600000);
    },
  );
  it.each([60000, 600000, 1800000])('accepts bounded max wait %s', (value) => {
    expect(productResearchMaxWaitMs(String(value))).toBe(value);
  });
});
