import OpenAI from 'openai';
import type {
  Response,
  ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';
import Ajv from 'ajv';
import {
  officialBrandSource,
  type AgentMarketScope,
  type OfficialProductCandidate,
  type ProductResearchProvider,
  type OfficialBrandSource,
} from '@compra-car/core/agents';
import { productResearchSchema } from './product-research-schema';

export type ProductResearchTransport = (
  request: ResponseCreateParamsNonStreaming,
) => Promise<Response>;
export interface ProductResearchBackgroundTransport {
  create(
    request: ResponseCreateParamsNonStreaming,
    options: { timeout: number; signal: AbortSignal },
  ): Promise<Response>;
  retrieve(id: string, options: { timeout: number; signal: AbortSignal }): Promise<Response>;
}

export function productResearchMaxWaitMs(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 60_000 && parsed <= 1_800_000 ? parsed : 600_000;
}
const validate = new Ajv({ strict: true }).compile<{ candidates: OfficialProductCandidate[] }>(
  productResearchSchema,
);

export class ProductResearchProviderError extends Error {
  constructor(
    readonly code:
      | 'OPENAI_AGENT_CONFIG_REQUIRED'
      | 'OPENAI_RESEARCH_FAILED'
      | 'OPENAI_RESEARCH_BAD_REQUEST'
      | 'OPENAI_RESEARCH_AUTH'
      | 'OPENAI_RESEARCH_RATE_LIMIT'
      | 'OPENAI_RESEARCH_TIMEOUT'
      | 'OPENAI_RESEARCH_CONNECTION'
      | 'OPENAI_RESEARCH_CANCELLED'
      | 'OPENAI_RESEARCH_SERVER_ERROR'
      | 'OPENAI_RESEARCH_INCOMPLETE'
      | 'OPENAI_RESEARCH_INVALID_OUTPUT'
      | 'OPENAI_RESEARCH_NO_WEB_SEARCH',
    readonly status?: number,
    readonly elapsedMs?: number,
  ) {
    super(code);
  }
}

function transportFailure(error: unknown, elapsedMs: number): ProductResearchProviderError {
  // Never retain the SDK error, cause, headers or textual API metadata.
  const status =
    error instanceof OpenAI.APIError &&
    Number.isInteger(error.status) &&
    error.status! >= 100 &&
    error.status! <= 599
      ? error.status
      : undefined;
  const code =
    error instanceof OpenAI.APIConnectionTimeoutError || status === 408
      ? 'OPENAI_RESEARCH_TIMEOUT'
      : error instanceof OpenAI.APIConnectionError
        ? 'OPENAI_RESEARCH_CONNECTION'
        : status === 400 || status === 422
          ? 'OPENAI_RESEARCH_BAD_REQUEST'
          : status === 401 || status === 403
            ? 'OPENAI_RESEARCH_AUTH'
            : status === 429
              ? 'OPENAI_RESEARCH_RATE_LIMIT'
              : status !== undefined && status >= 500
                ? 'OPENAI_RESEARCH_SERVER_ERROR'
                : 'OPENAI_RESEARCH_FAILED';
  return new ProductResearchProviderError(code, status, Math.max(0, Math.round(elapsedMs)));
}

export class OpenAIProductResearchProvider implements ProductResearchProvider {
  private readonly transport: ProductResearchBackgroundTransport;
  constructor(
    private readonly options: {
      readonly apiKey: string;
      readonly model: string;
      readonly prompt: string;
      readonly transport?: ProductResearchTransport | ProductResearchBackgroundTransport;
      readonly maxWaitMs?: number;
      readonly clock?: { now(): number; sleep(ms: number): Promise<void> };
    },
  ) {
    if (!options.apiKey.trim() || !options.model.trim() || !options.prompt.trim())
      throw new ProductResearchProviderError('OPENAI_AGENT_CONFIG_REQUIRED');
    // No SDK debug logging and no propagation of raw API errors/responses.
    const client = options.transport
      ? undefined
      : new OpenAI({ apiKey: options.apiKey, timeout: 60_000, maxRetries: 0, logLevel: 'off' });
    const injected = options.transport;
    this.transport =
      typeof injected === 'function'
        ? {
            create: (request) => injected(request),
            retrieve: async () => {
              throw new Error('Missing mock retrieve');
            },
          }
        : (injected ?? {
            create: (request, requestOptions) => client!.responses.create(request, requestOptions),
            retrieve: (id, requestOptions) =>
              client!.responses.retrieve(
                id,
                { include: ['web_search_call.action.sources'] },
                requestOptions,
              ),
          });
  }
  async researchProducts(scope: AgentMarketScope, resolvedSource?: OfficialBrandSource) {
    const source = resolvedSource ?? officialBrandSource(scope);
    let response: Response;
    const clock = this.options.clock ?? {
      now: () => performance.now(),
      sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    };
    const started = clock.now();
    const maxWait = productResearchMaxWaitMs(this.options.maxWaitMs);
    const elapsed = () => Math.max(0, Math.round(clock.now() - started));
    const remaining = () => maxWait - (clock.now() - started);
    const timeoutError = () =>
      new ProductResearchProviderError('OPENAI_RESEARCH_TIMEOUT', undefined, elapsed());
    const checkDeadline = () => {
      if (remaining() <= 0) throw timeoutError();
    };
    const operation = async (
      call: (options: { timeout: number; signal: AbortSignal }) => Promise<Response>,
    ) => {
      checkDeadline();
      const timeout = Math.min(60_000, remaining());
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          call({ timeout, signal: controller.signal }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(timeoutError());
              controller.abort();
            }, timeout);
          }),
        ]);
        checkDeadline();
        return result;
      } catch (error) {
        checkDeadline();
        if (error instanceof ProductResearchProviderError) throw error;
        throw transportFailure(error, elapsed());
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      response = await operation((requestOptions) =>
        this.transport.create(
          {
            model: this.options.model.trim(),
            background: true,
            store: false,
            instructions: this.options.prompt,
            input: JSON.stringify({
              country: source.country,
              brand: source.brand,
              allowedDomains: source.allowedDomains,
              allowedHosts: source.allowedHosts,
              allowedSubdomainRoots: source.allowedSubdomainRoots ?? [],
              researchStages: ['MODEL_DISCOVERY', 'VARIANT_RESOLUTION'],
              searchHints: source.searchHints,
              researchedAt: new Date().toISOString(),
            }),
            tools: [
              {
                type: 'web_search',
                filters: { allowed_domains: [...source.allowedDomains] },
                user_location: { type: 'approximate', country: source.country },
              },
            ],
            tool_choice: 'required',
            include: ['web_search_call.action.sources'],
            text: {
              format: {
                type: 'json_schema',
                name: 'official_product_candidates_v2',
                strict: true,
                schema: productResearchSchema,
              },
            },
          },
          requestOptions,
        ),
      );
    } catch (error) {
      if (error instanceof ProductResearchProviderError) throw error;
      throw transportFailure(error, elapsed());
    }
    const responseId = response.id;
    while (response.status === 'queued' || response.status === 'in_progress') {
      if (typeof responseId !== 'string' || !responseId.trim())
        throw new ProductResearchProviderError('OPENAI_RESEARCH_FAILED', undefined, elapsed());
      checkDeadline();
      await clock.sleep(Math.min(2_000, remaining()));
      checkDeadline();
      try {
        const polled = await operation((requestOptions) =>
          this.transport.retrieve(responseId, requestOptions),
        );
        if (polled.id !== responseId)
          throw new ProductResearchProviderError('OPENAI_RESEARCH_FAILED', undefined, elapsed());
        response = polled;
      } catch (error) {
        checkDeadline();
        if (
          !(error instanceof ProductResearchProviderError) ||
          ![
            'OPENAI_RESEARCH_TIMEOUT',
            'OPENAI_RESEARCH_CONNECTION',
            'OPENAI_RESEARCH_RATE_LIMIT',
            'OPENAI_RESEARCH_SERVER_ERROR',
          ].includes(error.code)
        )
          throw error;
      }
    }
    if (response.status !== 'completed') {
      const code =
        response.status === 'incomplete'
          ? 'OPENAI_RESEARCH_INCOMPLETE'
          : response.status === 'cancelled'
            ? 'OPENAI_RESEARCH_CANCELLED'
            : 'OPENAI_RESEARCH_FAILED';
      throw new ProductResearchProviderError(code, undefined, elapsed());
    }
    const webCalls = response.output.filter((item) => item.type === 'web_search_call');
    if (!webCalls.length || webCalls.some((item) => item.status !== 'completed'))
      throw new ProductResearchProviderError('OPENAI_RESEARCH_NO_WEB_SEARCH');
    let data: unknown;
    try {
      data = JSON.parse(response.output_text);
    } catch {
      throw new ProductResearchProviderError('OPENAI_RESEARCH_INVALID_OUTPUT');
    }
    if (!validate(data)) throw new ProductResearchProviderError('OPENAI_RESEARCH_INVALID_OUTPUT');
    return {
      candidates: data.candidates,
      metadata: {
        provider: 'openai',
        model: response.model,
        responseId: response.id,
        ...(response.usage
          ? {
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : {}),
        webSearchCount: webCalls.length,
      },
    };
  }
}
