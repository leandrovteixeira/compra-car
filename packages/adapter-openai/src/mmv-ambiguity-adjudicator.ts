import OpenAI from 'openai';
import Ajv from 'ajv';
import type {
  MmvAmbiguityAdjudicator,
  OfficialProductCandidate,
} from '@compra-car/core/agents';
import { candidateProperties } from './product-research-schema';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidate'],
  properties: {
    candidate: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: Object.keys(candidateProperties),
          properties: candidateProperties,
        },
      ],
    },
  },
} as const;

const validate = new Ajv({ strict: true }).compile<{ candidate: OfficialProductCandidate | null }>(
  schema,
);

export class OpenAIMmvAmbiguityAdjudicator implements MmvAmbiguityAdjudicator {
  constructor(
    private readonly options: {
      readonly apiKey: string;
      readonly model: string;
      readonly onUsage?: (usage: {
        model: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        webSearchCount: number;
      }) => void;
    },
  ) {}

  async adjudicate(input: Parameters<MmvAmbiguityAdjudicator['adjudicate']>[0]) {
    const domains = [
      ...new Set(
        input.candidate.evidence.flatMap((item) => {
          try {
            return [new URL(item.url).hostname];
          } catch {
            return [];
          }
        }),
      ),
    ];
    if (!domains.length) return null;

    const client = new OpenAI({
      apiKey: this.options.apiKey,
      timeout: 90000,
      maxRetries: 0,
      logLevel: 'off',
    });

    const response = await client.responses.create({
      model: this.options.model,
      store: false,
      instructions: [
        'You adjudicate one ambiguous Brazilian automotive MMV candidate.',
        'Use only official manufacturer evidence and the allowed official domains.',
        'Do not invent facts. Preserve the published commercial version label.',
        'Return null if explicit evidence is still insufficient.',
        'Only fill production/model year or technical identity fields when explicitly supported.',
      ].join(' '),
      input: JSON.stringify({
        market: input.scope.country,
        brand: input.scope.brand,
        ambiguousCandidate: input.candidate,
        possibleCanonicalMmvs: input.possibleMmvs.map((item) => ({
          id: item.id,
          brand: item.brand,
          model: item.model,
          canonicalVersionLabel: item.canonicalVersionLabel,
        })),
      }),
      tools: [
        {
          type: 'web_search',
          filters: { allowed_domains: domains },
          user_location: { type: 'approximate', country: 'BR' },
        },
      ],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
      text: {
        format: {
          type: 'json_schema',
          name: 'mmv_ambiguity_adjudication_v1',
          strict: true,
          schema,
        },
      },
    });

    if (response.status !== 'completed') return null;
    const searches = response.output.filter((item) => item.type === 'web_search_call');
    if (!searches.length || searches.some((item) => item.status !== 'completed')) return null;

    if (response.usage) {
      this.options.onUsage?.({
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens,
        webSearchCount: searches.length,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      return null;
    }
    if (!validate(parsed)) return null;
    const candidate = parsed.candidate;
    if (!candidate) return null;

    if (
      candidate.brand !== input.candidate.brand ||
      candidate.model !== input.candidate.model ||
      candidate.officialVersionLabel !== input.candidate.officialVersionLabel
    ) return null;

    return candidate;
  }
}
