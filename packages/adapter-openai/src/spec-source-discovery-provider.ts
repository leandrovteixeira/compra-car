import Ajv from 'ajv';
import {
  officialEvidenceUrl,
  type SpecDiscoveryProvider,
  type SpecSourceTarget,
  type OfficialBrandSource,
} from '@compra-car/core/agents';
import { BackgroundResearch } from './background-research';
export const specDiscoverySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'label'],
        properties: {
          url: { type: 'string', maxLength: 1500 },
          label: { type: 'string', maxLength: 300 },
        },
      },
    },
  },
};
const validate = new Ajv({ strict: true }).compile<{
  candidates: { url: string; label: string }[];
}>(specDiscoverySchema);
const prompt =
  'Find official source URLs only, never technical facts. Use exactly one bounded domain-restricted search for this exact brand, model, official version and Model Year. Prioritize model page, exact-version configurator and requested model-year technical literature/manual. No press, dealer, forum, social or aggregators. Return only URLs observed in the search sources. Never invent a URL from a slug. A date in a URL is only a discovery signal.';
export class OpenAISpecDiscoveryProvider implements SpecDiscoveryProvider {
  private readonly background: BackgroundResearch;
  constructor(
    private readonly options: Omit<ConstructorParameters<typeof BackgroundResearch>[0], 'prompt'>,
  ) {
    this.background = new BackgroundResearch({ ...options, prompt, maxWaitMs: 120000 });
  }
  async discover(target: SpecSourceTarget, source: OfficialBrandSource) {
    const response = await this.background.execute({
      model: this.options.model,
      background: true,
      store: true,
      instructions: prompt,
      input: JSON.stringify({
        brand: target.brand,
        model: target.model,
        version: target.officialVersionLabel,
        modelYear: target.modelYear,
        allowedDomains: source.allowedDomains,
      }),
      ...{ max_tool_calls: 1 },
      max_output_tokens: 2000,
      tools: [
        {
          type: 'web_search',
          filters: { allowed_domains: [...source.allowedDomains] },
          search_context_size: 'low',
        },
      ],
      tool_choice: 'required',
      include: ['web_search_call.action.sources'],
      text: {
        format: {
          type: 'json_schema',
          name: 'spec_source_urls',
          strict: true,
          schema: specDiscoverySchema,
        },
      },
    });
    const calls = response.output.filter((i) => i.type === 'web_search_call');
    if (calls.length !== 1 || calls[0]?.status !== 'completed')
      throw new Error('INVALID_DISCOVERY_OUTPUT');
    const observed = new Set<string>();
    for (const call of calls)
      if (call.action.type === 'search')
        for (const s of call.action.sources ?? []) {
          const url = officialEvidenceUrl(s.url, source);
          if (url) observed.add(url);
        }
    const text = response.output
      .filter((i) => i.type === 'message')
      .flatMap((i) => i.content)
      .filter((i) => i.type === 'output_text')
      .map((i) => i.text)
      .join('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('INVALID_DISCOVERY_OUTPUT');
    }
    if (!validate(parsed)) throw new Error('INVALID_DISCOVERY_OUTPUT');
    return parsed.candidates
      .filter((c) => {
        const safe = officialEvidenceUrl(c.url, source);
        return safe && observed.has(safe);
      })
      .map((c) => ({ ...c, method: 'OFFICIAL_SEARCH' as const }));
  }
}
