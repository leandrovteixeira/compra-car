import OpenAI from 'openai';
import Ajv from 'ajv';
import type {
  Response,
  ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';
import {
  CONNECTOR_SOURCE_TYPES,
  type BrandConnectorResearch,
  type BrandConnectorResearchInput,
  type BrandConnectorResearchProvider,
} from '@compra-car/core/agents';
const string = { type: 'string' };
const strings = { type: 'array', items: string };
function object(properties: Record<string, unknown>) {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}
export const brandConnectorResearchSchema = object({
  brand: string,
  market: string,
  candidateDomains: strings,
  sourceEntries: {
    type: 'array',
    items: object({
      type: { type: 'string', enum: [...CONNECTOR_SOURCE_TYPES] },
      url: string,
      priority: { type: 'integer' },
      notes: { type: ['string', 'null'] },
    }),
  },
  searchHints: strings,
  terminologyHints: strings,
  confidence: { type: 'number' },
  warnings: strings,
  evidence: { type: 'array', items: object({ url: string, title: string, excerpt: string }) },
  verificationSummary: string,
  checksPerformed: strings,
  driftDetected: { type: 'boolean' },
});
const validate = new Ajv({ strict: true }).compile<BrandConnectorResearch>(
  brandConnectorResearchSchema,
);
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
    } catch {
      throw new Error('CONNECTOR_RESEARCH_FAILED');
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
