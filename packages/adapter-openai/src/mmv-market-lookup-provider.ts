import OpenAI from 'openai';
import Ajv from 'ajv';
import type { Response, ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import type {
  MmvMarketLookupPort,
  MmvMarketLookupRequest,
  MmvMarketObservation,
} from '@compra-car/core/agents';

const observationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sourceKind',
    'sourceName',
    'sourceUrl',
    'fipeCode',
    'brand',
    'modelLabel',
    'matchedVersionHint',
    'modelYear',
    'referencePeriod',
    'confidence',
  ],
  properties: {
    sourceKind: { type: 'string', enum: ['FIPE', 'SECONDARY'] },
    sourceName: { type: 'string', enum: ['FIPE', 'WEBMOTORS'] },
    sourceUrl: { type: 'string' },
    fipeCode: { type: 'string', pattern: '^[0-9]{6}-[0-9]$' },
    brand: { type: 'string' },
    modelLabel: { type: 'string' },
    matchedVersionHint: { type: ['string', 'null'] },
    modelYear: { type: ['integer', 'null'] },
    referencePeriod: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;

export const mmvMarketLookupSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['observations'],
  properties: {
    observations: {
      type: 'array',
      maxItems: 50,
      items: observationSchema,
    },
  },
} as const;

const validate = new Ajv({ strict: true }).compile<{ observations: MmvMarketObservation[] }>(
  mmvMarketLookupSchema,
);

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ['https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export class OpenAIMmvMarketLookupProvider implements MmvMarketLookupPort {
  private readonly transport: (request: ResponseCreateParamsNonStreaming) => Promise<Response>;

  constructor(
    private readonly options: {
      readonly apiKey: string;
      readonly model: string;
      readonly prompt: string;
      readonly transport?: (request: ResponseCreateParamsNonStreaming) => Promise<Response>;
    },
  ) {
    if (!options.apiKey.trim() || !options.model.trim() || !options.prompt.trim())
      throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
    const client = options.transport
      ? undefined
      : new OpenAI({ apiKey: options.apiKey, timeout: 120000, maxRetries: 0, logLevel: 'off' });
    this.transport = options.transport ?? ((request) => client!.responses.create(request));
  }

  async lookup(request: MmvMarketLookupRequest): Promise<readonly MmvMarketObservation[]> {
    if (
      request.market !== 'BR' ||
      !request.brand.trim() ||
      !request.model.trim() ||
      request.versionHints.length === 0 ||
      request.versionHints.length > 20
    )
      throw new Error('INVALID_MMV_MARKET_LOOKUP');

    const response = await this.transport({
      model: this.options.model,
      store: false,
      instructions: this.options.prompt,
      input: JSON.stringify(request),
      tools: [
        {
          type: 'web_search',
          filters: { allowed_domains: ['fipe.org.br', 'webmotors.com.br'] },
          user_location: { type: 'approximate', country: 'BR' },
        },
      ],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
      text: {
        format: {
          type: 'json_schema',
          name: 'mmv_market_lookup_v1',
          strict: true,
          schema: mmvMarketLookupSchema,
        },
      },
    });

    if (response.status !== 'completed') throw new Error('MMV_MARKET_LOOKUP_FAILED');
    if (!response.output.some((item) => item.type === 'web_search_call' && item.status === 'completed'))
      throw new Error('MMV_MARKET_LOOKUP_NO_WEB_SEARCH');

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new Error('MMV_MARKET_LOOKUP_INVALID_OUTPUT');
    }
    if (!validate(parsed)) throw new Error('MMV_MARKET_LOOKUP_INVALID_OUTPUT');

    const hints = new Set(request.versionHints);
    return parsed.observations.map((observation) => {
      const url = safeUrl(observation.sourceUrl);
      if (!url) throw new Error('MMV_MARKET_LOOKUP_INVALID_OUTPUT');
      const host = url.hostname.toLowerCase();
      const official = host === 'fipe.org.br' || host.endsWith('.fipe.org.br');
      const secondary = host === 'webmotors.com.br' || host.endsWith('.webmotors.com.br');
      if (!official && !secondary) throw new Error('MMV_MARKET_LOOKUP_INVALID_OUTPUT');
      if (official && (observation.sourceKind !== 'FIPE' || observation.sourceName !== 'FIPE'))
        throw new Error('MMV_MARKET_LOOKUP_INVALID_OUTPUT');
      if (
        secondary &&
        (observation.sourceKind !== 'SECONDARY' || observation.sourceName !== 'WEBMOTORS')
      )
        throw new Error('MMV_MARKET_LOOKUP_INVALID_OUTPUT');
      if (observation.matchedVersionHint !== null && !hints.has(observation.matchedVersionHint))
        throw new Error('MMV_MARKET_LOOKUP_INVALID_OUTPUT');
      return { ...observation, capturedAt: new Date().toISOString() };
    });
  }
}
