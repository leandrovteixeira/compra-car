import OpenAI from 'openai';
import Ajv from 'ajv';
import type { AgentCostAdmission } from './agent-cost-admission';
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
  observedBrandLabel: string,
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
      costAdmission?: AgentCostAdmission;
      model: string;
      prompt: string;
      maxOutputTokens?: number;
      transport?: (request: ResponseCreateParamsNonStreaming) => Promise<Response>;
      onUsage?: (usage: { llmCalls: number; webSearches: number; inputTokens: number | null;
        outputTokens: number | null; cachedInputTokens: number | null }) => void;
    },
  ) {
    if (!options.apiKey.trim() || !options.model.trim() || !options.prompt.trim())
      throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
    if (!Number.isInteger(options.maxOutputTokens ?? 1800) || (options.maxOutputTokens ?? 1800) > 1800 || (options.maxOutputTokens ?? 1800) < 1)
      throw new Error('CONNECTOR_BUDGET_BOUND_INVALID');
    const client = options.transport
      ? undefined
      : new OpenAI({ apiKey: options.apiKey, timeout: 120000, maxRetries: 0, logLevel: 'off' });
    this.transport = options.transport ?? ((request) => client!.responses.create(request));
  }
  async researchConnector(input: BrandConnectorResearchInput): Promise<BrandConnectorResearch> {
    if (!this.options.transport && !this.options.costAdmission)
      throw new Error('COST_ADMISSION_REQUIRED');
    const reservation = this.options.costAdmission
      ? await this.options.costAdmission.reserve(this.options.model) : null;
    let response: Response;
    try {
      response = await this.transport({
        model: this.options.model,
        store: false,
        max_output_tokens: this.options.maxOutputTokens ?? 1800,
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
    } finally {
      if (reservation) await this.options.costAdmission!.complete(reservation, false);
    }
    if (response.status !== 'completed') throw new Error('CONNECTOR_RESEARCH_INCOMPLETE');
    const searches = response.output.filter((o) => o.type === 'web_search_call');
    // Counts come from the actual response, not an estimated token formula.
    try {
      this.options.onUsage?.({
        llmCalls: 1,
        webSearches: searches.length,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
      });
    } catch { /* Observability must never affect research. */ }
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
