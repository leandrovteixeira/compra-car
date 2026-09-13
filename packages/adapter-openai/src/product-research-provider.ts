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
} from '@compra-car/core/agents';
import { productResearchSchema } from './product-research-schema';

export type ProductResearchTransport = (
  request: ResponseCreateParamsNonStreaming,
) => Promise<Response>;
const validate = new Ajv({ strict: true }).compile<{ candidates: OfficialProductCandidate[] }>(
  productResearchSchema,
);

export class ProductResearchProviderError extends Error {
  constructor(
    readonly code:
      | 'OPENAI_AGENT_CONFIG_REQUIRED'
      | 'OPENAI_RESEARCH_FAILED'
      | 'OPENAI_RESEARCH_INCOMPLETE'
      | 'OPENAI_RESEARCH_INVALID_OUTPUT'
      | 'OPENAI_RESEARCH_NO_WEB_SEARCH',
  ) {
    super(code);
  }
}

export class OpenAIProductResearchProvider implements ProductResearchProvider {
  private readonly transport: ProductResearchTransport;
  constructor(
    private readonly options: {
      readonly apiKey: string;
      readonly model: string;
      readonly prompt: string;
      readonly transport?: ProductResearchTransport;
    },
  ) {
    if (!options.apiKey.trim() || !options.model.trim() || !options.prompt.trim())
      throw new ProductResearchProviderError('OPENAI_AGENT_CONFIG_REQUIRED');
    // No SDK debug logging and no propagation of raw API errors/responses.
    const client = options.transport
      ? undefined
      : new OpenAI({ apiKey: options.apiKey, timeout: 120_000, maxRetries: 0, logLevel: 'off' });
    this.transport = options.transport ?? ((request) => client!.responses.create(request));
  }
  async researchProducts(scope: AgentMarketScope) {
    const source = officialBrandSource(scope);
    let response: Response;
    try {
      response = await this.transport({
        model: this.options.model.trim(),
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
      });
    } catch {
      throw new ProductResearchProviderError('OPENAI_RESEARCH_FAILED');
    }
    if (response.status !== 'completed')
      throw new ProductResearchProviderError('OPENAI_RESEARCH_INCOMPLETE');
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
