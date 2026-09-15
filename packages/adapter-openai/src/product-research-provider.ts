import Ajv from 'ajv';
import {
  officialBrandSource,
  type AgentMarketScope,
  type OfficialProductCandidate,
  type ProductResearchProvider,
  type OfficialBrandSource,
} from '@compra-car/core/agents';
import { productResearchSchema } from './product-research-schema';

import {
  BackgroundResearch,
  ProductResearchProviderError,
  type ProductResearchTransport,
  type ProductResearchBackgroundTransport,
} from './background-research';
export {
  ProductResearchProviderError,
  productResearchMaxWaitMs,
  type ProductResearchTransport,
  type ProductResearchBackgroundTransport,
} from './background-research';
const validate = new Ajv({ strict: true }).compile<{ candidates: OfficialProductCandidate[] }>(
  productResearchSchema,
);

export class OpenAIProductResearchProvider implements ProductResearchProvider {
  private readonly background: BackgroundResearch;
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
    this.background = new BackgroundResearch(options);
  }
  async researchProducts(scope: AgentMarketScope, resolvedSource?: OfficialBrandSource) {
    const source = resolvedSource ?? officialBrandSource(scope);
    const response = await this.background.execute({
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
    });
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
