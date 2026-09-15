import { it, expect, vi } from 'vitest';
import type {
  Response,
  ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';
import { coverageTarget } from '../../core/test/fixtures/model-year-coverage';
import {
  OpenAIModelYearResearchProvider,
  modelYearResearchInput,
  modelYearResearchSchema,
} from '../src';
const target = coverageTarget();
const source = {
  brand: 'VW',
  country: 'BR' as const,
  allowedDomains: ['vw.com.br'],
  allowedHosts: ['www.vw.com.br'],
  allowedSubdomainRoots: [],
  searchHints: [],
};
const response = (observations: unknown = [], web = true) =>
  ({
    id: 'r',
    status: 'completed',
    model: 'test',
    output_text: JSON.stringify({ observations }),
    output: web
      ? [
          {
            id: 'w',
            type: 'web_search_call',
            status: 'completed',
            action: { type: 'search', query: 'MY' },
          },
        ]
      : [],
  }) as unknown as Response;
const observation = (targetKey = target.targetKey) => ({
  targetKey,
  modelYear: 2027,
  confidence: 0.9,
  applicability: 'MODEL_LINE',
  dealer: null,
  evidence: [
    {
      url: 'https://www.vw.com.br/page',
      title: 'test',
      excerpt: 'Nivus linha 2027. Versões Highline.',
      contextText: 'Nivus linha 2027. Versões Highline.',
      contextId: 'block',
      role: 'MY_ASSERTION',
      yearSemantics: 'EXPLICIT_MY',
      evidenceType: 'OTHER_OFFICIAL',
    },
  ],
});
const make = (
  transport: (r: ResponseCreateParamsNonStreaming) => Promise<Response>,
  options = {},
) =>
  new OpenAIModelYearResearchProvider({
    apiKey: 'mock',
    model: 'mock',
    prompt: 'facts only',
    transport,
    ...options,
  });
it('one manufacturer job for four targets of same model with tool budget', async () => {
  const transport = vi.fn(async (request: ResponseCreateParamsNonStreaming) => {
    void request;
    return response();
  });
  const ts = [0, 1, 2, 3].map((i) => ({ ...target, targetKey: String(i) }));
  const r = await make(transport).researchModelYears(ts, source);
  expect(transport).toHaveBeenCalledOnce();
  const req = transport.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
  expect(req.max_tool_calls).toBe(3);
  expect(JSON.parse(req.input as string).targets).toHaveLength(4);
  expect(r.searchAttempts).toHaveLength(4);
  expect(r.metrics?.openAiModelGroupsResearched).toBe(1);
});
it('distinct models respect max group budget and remain sequential', async () => {
  let active = 0,
    peak = 0;
  const transport = vi.fn(async () => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    return response();
  });
  const r = await make(transport, { maxModelGroups: 1 }).researchModelYears(
    [target, { ...target, officialIdentity: { ...target.officialIdentity, model: 'Taos' } }],
    source,
  );
  expect(transport).toHaveBeenCalledOnce();
  expect(peak).toBe(1);
  expect(r.metrics?.skippedDueToBudget).toBe(1);
});
it('official domain restrictions applied', async () => {
  const transport = vi.fn(async (request: ResponseCreateParamsNonStreaming) => {
    void request;
    return response();
  });
  await make(transport).researchModelYears([target], source);
  expect(JSON.stringify(transport.mock.calls)).toContain('allowed_domains');
});
it('dealer stage only when configured explicitly', async () => {
  const transport = vi.fn(async (request: ResponseCreateParamsNonStreaming) => {
    void request;
    return response();
  });
  const r = await make(transport, { stage: 'AUTHORIZED_DEALER' }).researchModelYears(
    [target],
    source,
  );
  expect(r.searchAttempts[0]?.stage).toBe('AUTHORIZED_DEALER');
  expect(JSON.stringify(transport.mock.calls)).not.toContain('allowed_domains');
});
it('invalid target binding is retained for deterministic rejection', async () => {
  const r = await make(async () => response([observation('wrong')])).researchModelYears(
    [target],
    source,
  );
  expect(r.observations[0]?.requestedTargetKey).toBe(target.targetKey);
});
it('safe schema failure keeps no raw output', async () => {
  const r = await make(async () => response([{ raw: 'SECRET' }])).researchModelYears(
    [target],
    source,
  );
  expect(r.observations).toEqual([]);
  expect(r.searchAttempts[0]?.errorCode).toBe('OPENAI_RESEARCH_INVALID_OUTPUT');
  expect(JSON.stringify(r)).not.toContain('SECRET');
});
it('no tool call is not a completed search', async () => {
  const r = await make(async () => response([], false)).researchModelYears([target], source);
  expect(r.searchAttempts[0]?.errorCode).toBe('OPENAI_RESEARCH_NO_WEB_SEARCH');
});
it('transport failure is sanitized', async () => {
  const r = await make(async () => {
    throw Error('SECRET');
  }).researchModelYears([target], source);
  expect(r.searchAttempts[0]?.status).toBe('FAILED');
  expect(JSON.stringify(r)).not.toContain('SECRET');
});
it('empty targets consume no tasks', async () => {
  const transport = vi.fn(async (request: ResponseCreateParamsNonStreaming) => {
    void request;
    return response();
  });
  await make(transport).researchModelYears([], source);
  expect(transport).not.toHaveBeenCalled();
});
it('projection contains no PY, source registry or internal MMV id', () => {
  const text = JSON.stringify(modelYearResearchInput([target], source));
  expect(text).not.toMatch(/productionYear|mmvIdentity|approvedAutomotive/);
  expect(JSON.stringify(modelYearResearchSchema)).not.toContain('productionYear');
});
it('accepts several target observations from one model response', async () => {
  const ts = [target, { ...target, targetKey: 'second' }];
  const r = await make(async () =>
    response(ts.map((t) => observation(t.targetKey))),
  ).researchModelYears(ts, source);
  expect(r.observations).toHaveLength(2);
  expect(r.observations.map((o) => o.requestedTargetKey)).toEqual([target.targetKey, 'second']);
});
