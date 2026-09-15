import Ajv from 'ajv';
import type {
  ModelYearResearchProvider,
  ModelYearResearchTarget,
  ModelYearObservation,
  ModelYearResearchResult,
  ModelYearSearchAttempt,
  OfficialBrandSource,
} from '@compra-car/core/agents';
import { groupModelYearTargets } from '@compra-car/core/agents';
import { BackgroundResearch, ProductResearchProviderError } from './background-research';
const string = { type: 'string' };
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
export const modelYearResearchSchema = object({
  observations: {
    type: 'array',
    items: object({
      targetKey: string,
      dealer: { anyOf: [{ type: 'null' }, object({ name: string, domain: string })] },
      modelYear: { type: 'integer', minimum: 1000, maximum: 9999 },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      applicability: { type: 'string', enum: ['EXACT_VERSION', 'MODEL_LINE'] },
      evidence: {
        type: 'array',
        minItems: 1,
        items: object({
          role: {
            type: 'string',
            enum: ['MY_ASSERTION', 'TARGET_APPLICABILITY', 'DEALER_AUTHORIZATION'],
          },
          contextId: string,
          contextText: { type: 'string', maxLength: 2000 },
          yearSemantics: { type: 'string', enum: ['EXPLICIT_MY', 'VEHICLE_MODEL_YEAR'] },
          url: string,
          title: { type: ['string', 'null'] },
          excerpt: { type: 'string', maxLength: 1000 },
          evidenceType: {
            type: 'string',
            enum: [
              'TECHNICAL_SHEET',
              'VERSION_DOCUMENT',
              'PRICE_LIST',
              'CONFIGURATOR',
              'MODEL_PAGE',
              'PRESS_RELEASE',
              'OTHER_OFFICIAL',
            ],
          },
        }),
      },
    }),
  },
});
const validate = new Ajv({ strict: true }).compile<{ observations: ModelYearObservation[] }>(
  modelYearResearchSchema,
);
/** Explicit allowlist projection: neither catalog rows nor internal MMV keys cross the LLM boundary. */
export function modelYearResearchInput(
  targets: readonly ModelYearResearchTarget[],
  source: OfficialBrandSource,
) {
  return {
    market: source.country,
    brand: source.brand,
    allowedDomains: source.allowedDomains,
    searchHints: source.searchHints,
    targets: targets.map((t) => ({
      targetKey: t.targetKey,
      canonicalCatalogIdentity: {
        brand: t.canonicalCatalogIdentity.brand,
        model: t.canonicalCatalogIdentity.model,
        version: t.canonicalCatalogIdentity.version,
      },
      officialIdentity: {
        brand: t.officialIdentity.brand,
        model: t.officialIdentity.model,
        officialVersionLabel: t.officialIdentity.officialVersionLabel,
      },
      structuredIdentity: {
        trim: t.structuredIdentity.trim,
        powertrainLabel: t.structuredIdentity.powertrainLabel,
        engineDisplacement: t.structuredIdentity.engineDisplacement,
        engineLabel: t.structuredIdentity.engineLabel,
        propulsion: t.structuredIdentity.propulsion,
        transmission: t.structuredIdentity.transmission,
        drivetrain: t.structuredIdentity.drivetrain,
      },
      knownAliases: t.knownAliases,
      knownModelYears: t.knownModelYears,
      discoveryEvidence: t.discoveryEvidence.map((e) => ({
        url: e.url,
        title: e.title,
        excerpt: e.excerpt,
        evidenceType: e.evidenceType,
      })),
    })),
  };
}
export class OpenAIModelYearResearchProvider implements ModelYearResearchProvider {
  private readonly background: BackgroundResearch;
  constructor(
    private readonly options: ConstructorParameters<typeof BackgroundResearch>[0] & {
      stage?: 'MANUFACTURER_OFFICIAL' | 'AUTHORIZED_DEALER';
      maxModelGroups?: number;
      maxToolCalls?: number;
    },
  ) {
    this.background = new BackgroundResearch({
      ...options,
      maxWaitMs: options.maxWaitMs ?? 120000,
    });
  }
  async researchModelYears(
    targets: readonly ModelYearResearchTarget[],
    source: OfficialBrandSource,
  ): Promise<ModelYearResearchResult> {
    const observations: ModelYearObservation[] = [],
      searchAttempts: ModelYearSearchAttempt[] = [];
    const stage = this.options.stage ?? 'MANUFACTURER_OFFICIAL';
    const maxGroups = Math.max(0, Math.min(10, this.options.maxModelGroups ?? 2));
    const maxTools = Math.max(1, Math.min(10, this.options.maxToolCalls ?? 3));
    let used = 0,
      skipped = 0;
    for (const group of groupModelYearTargets(targets)) {
      if (used >= maxGroups) {
        skipped++;
        continue;
      }
      used++;
      let webSearchCount = 0;
      try {
        const response = await this.background.execute({
          model: this.options.model.trim(),
          background: true,
          store: false,
          instructions: this.options.prompt,
          input: JSON.stringify({
            ...modelYearResearchInput(group.targets, source),
            stage,
            searchCoverage:
              stage === 'MANUFACTURER_OFFICIAL'
                ? [
                    'model',
                    'configurator',
                    'newsroom',
                    'manuals',
                    'technology',
                    'offers',
                    'PDF content',
                  ]
                : ['authorized dealer MY', 'manufacturer locator identity and domain'],
            instruction:
              'Research these versions together for this model. Extract explicit vehicle model years only.',
          }),
          tools: [
            {
              type: 'web_search',
              ...(stage === 'MANUFACTURER_OFFICIAL'
                ? { filters: { allowed_domains: [...source.allowedDomains] } }
                : {}),
              user_location: { type: 'approximate', country: source.country },
            },
          ],
          tool_choice: 'required',
          ...{ max_tool_calls: maxTools },
          include: ['web_search_call.action.sources'],
          text: {
            format: {
              type: 'json_schema',
              name: 'model_year_contexts_v3',
              strict: true,
              schema: modelYearResearchSchema,
            },
          },
        });
        const calls = response.output.filter((o) => o.type === 'web_search_call');
        webSearchCount = calls.filter((c) => c.status === 'completed').length;
        if (!calls.length || calls.some((c) => c.status !== 'completed') || calls.length > maxTools)
          throw new ProductResearchProviderError('OPENAI_RESEARCH_NO_WEB_SEARCH');
        let data: unknown;
        try {
          data = JSON.parse(response.output_text);
        } catch {
          throw new ProductResearchProviderError('OPENAI_RESEARCH_INVALID_OUTPUT');
        }
        if (!validate(data))
          throw new ProductResearchProviderError('OPENAI_RESEARCH_INVALID_OUTPUT');
        observations.push(
          ...data.observations.map((o) => ({
            ...o,
            sourceTier: stage,
            sourceKind: stage,
            requestedTargetKey: group.targets.some((t) => t.targetKey === o.targetKey)
              ? o.targetKey
              : group.targets[0]!.targetKey,
          })),
        );
        for (const t of group.targets)
          searchAttempts.push({
            targetKey: t.targetKey,
            stage,
            status: 'COMPLETED',
            webSearchCount,
            errorCode: null,
          });
      } catch (error) {
        for (const t of group.targets)
          searchAttempts.push({
            targetKey: t.targetKey,
            stage,
            status: 'FAILED',
            webSearchCount,
            errorCode:
              error instanceof ProductResearchProviderError ? error.code : 'OPENAI_RESEARCH_FAILED',
          });
      }
    }
    return {
      observations,
      searchAttempts,
      metrics: {
        openAiModelGroupsResearched: stage === 'MANUFACTURER_OFFICIAL' ? used : 0,
        dealerModelGroupsResearched: stage === 'AUTHORIZED_DEALER' ? used : 0,
        skippedDueToBudget: skipped,
      },
    };
  }
}
