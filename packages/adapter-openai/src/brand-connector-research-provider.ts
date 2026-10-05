import OpenAI from 'openai';
import Ajv from 'ajv';
import type {
  Response,
  ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';
import {
  BRAND_ALIAS_TYPES,
  CONNECTOR_SOURCE_TYPES,
  type BrandConnectorResearch,
  type BrandConnectorResearchInput,
  type BrandConnectorResearchProvider,
} from '@compra-car/core/agents';
const string = { type: 'string' };
const strings = (maxItems = 40, minItems = 0) => ({ type: 'array', items: string, minItems, maxItems });
function object(properties: Record<string, unknown>) {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}
export const brandConnectorResearchSchema = object({
  observedBrandLabel: string,
  canonicalBrand: string,
  aliases: {
    type: 'array',
    maxItems: 20,
    items: object({
      alias: string,
      aliasType: { type: 'string', enum: [...BRAND_ALIAS_TYPES] },
      confidence: { type: 'number' },
      evidenceUrl: string,
      evidenceTitle: string,
      evidenceExcerpt: string,
    }),
  },
  market: string,
  candidateDomains: strings(20, 1),
  sourceEntries: {
    type: 'array',
    maxItems: 100,
    items: object({
      type: { type: 'string', enum: [...CONNECTOR_SOURCE_TYPES] },
      url: string,
      priority: { type: 'integer' },
      notes: { type: ['string', 'null'] },
    }),
  },
  searchHints: strings(40),
  terminologyHints: strings(40),
  confidence: { type: 'number' },
  warnings: strings(40),
  evidence: { type: 'array', minItems: 1, maxItems: 100, items: object({ url: string, title: string, excerpt: string }) },
  verificationSummary: string,
  checksPerformed: strings(100),
  driftDetected: { type: 'boolean' },
});
const validate = new Ajv({ strict: true }).compile<BrandConnectorResearch>(
  brandConnectorResearchSchema,
);
export class BrandConnectorResearchProviderError extends Error {
  constructor(
    readonly code:
      | 'CONNECTOR_RESEARCH_BAD_REQUEST'
      | 'CONNECTOR_RESEARCH_AUTH'
      | 'CONNECTOR_RESEARCH_RATE_LIMIT'
      | 'CONNECTOR_RESEARCH_TIMEOUT'
      | 'CONNECTOR_RESEARCH_CONNECTION'
      | 'CONNECTOR_RESEARCH_SERVER_ERROR'
      | 'CONNECTOR_RESEARCH_FAILED',
    readonly status?: number,
  ) {
    super(code);
  }
}

function transportFailure(error: unknown): BrandConnectorResearchProviderError {
  // Retain only a bounded HTTP status; never retain SDK errors, causes or response metadata.
  const status =
    error instanceof OpenAI.APIError &&
    Number.isInteger(error.status) &&
    error.status! >= 100 &&
    error.status! <= 599
      ? error.status
      : undefined;
  const code =
    error instanceof OpenAI.APIConnectionTimeoutError || status === 408
      ? 'CONNECTOR_RESEARCH_TIMEOUT'
      : error instanceof OpenAI.APIConnectionError
        ? 'CONNECTOR_RESEARCH_CONNECTION'
        : status === 400 || status === 422
          ? 'CONNECTOR_RESEARCH_BAD_REQUEST'
          : status === 401 || status === 403
            ? 'CONNECTOR_RESEARCH_AUTH'
            : status === 429
              ? 'CONNECTOR_RESEARCH_RATE_LIMIT'
              : status !== undefined && status >= 500
                ? 'CONNECTOR_RESEARCH_SERVER_ERROR'
                : 'CONNECTOR_RESEARCH_FAILED';
  return new BrandConnectorResearchProviderError(code, status);
}
export class OpenAIBrandConnectorResearchProvider implements BrandConnectorResearchProvider {
  private readonly transport: (request: ResponseCreateParamsNonStreaming) => Promise<Response>;
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      prompt: string;
      transport?: (request: ResponseCreateParamsNonStreaming) => Promise<Response>;
    },
  ) {
    if (!options.apiKey.trim() || !options.model.trim() || !options.prompt.trim())
      throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
    const client = options.transport
      ? undefined
      : new OpenAI({ apiKey: options.apiKey, timeout: 120000, maxRetries: 0, logLevel: 'off' });
    this.transport = options.transport ?? ((request) => client!.responses.create(request));
  }
  async researchConnector(input: BrandConnectorResearchInput): Promise<BrandConnectorResearch> {
    let response: Response;
    try {
      response = await this.transport({
        model: this.options.model,
        store: false,
        instructions: this.options.prompt,
        input: JSON.stringify(input),
        tools: [
          { type: 'web_search', user_location: { type: 'approximate', country: input.market } },
        ],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
        text: {
          format: {
            type: 'json_schema',
            name: 'brand_connector_research_v1',
            strict: true,
            schema: brandConnectorResearchSchema,
          },
        },
      });
    } catch (error) {
      throw transportFailure(error);
    }
    if (response.status !== 'completed') throw new Error('CONNECTOR_RESEARCH_INCOMPLETE');
    const searches = response.output.filter((o) => o.type === 'web_search_call');
    if (!searches.length || searches.some((s) => s.status !== 'completed'))
      throw new Error('CONNECTOR_RESEARCH_NO_WEB_SEARCH');
    let data: unknown;
    try {
      data = JSON.parse(response.output_text);
    } catch {
      throw new Error('CONNECTOR_RESEARCH_INVALID_OUTPUT');
    }
    if (!validate(data)) throw new Error('CONNECTOR_RESEARCH_INVALID_OUTPUT');
    return data;
  }
}
