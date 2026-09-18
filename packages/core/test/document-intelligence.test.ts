import { describe, it, expect, vi } from 'vitest';
import {
  ValidatedDocumentIntelligence,
  validateDocumentExtraction,
  routeSpecSource,
  classifyDocumentSource,
  DOCUMENT_STRATEGY,
  documentCost,
  technicalSheetSchema,
} from '../src/agents';
import type { TechnicalSheetContent, DocumentModelTransport } from '../src/agents';
import { target, source, content } from './document-intelligence-fixture';
const mutate = (fn: (v: TechnicalSheetContent) => void) => {
  const x = structuredClone(content);
  fn(x);
  return x;
};
const validate = (v: unknown, s = source) => validateDocumentExtraction(s, target, v);
const response = (c: unknown, model: string) => ({
  content: c,
  model,
  responseId: 'mock',
  usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 100, reasoningTokens: 10 },
  durationMs: 1,
  completed: true,
});
function transport(values: unknown[]): DocumentModelTransport {
  return {
    count: vi.fn(async () => 100),
    generate: vi.fn(async (r) => response(values.shift(), r.model)),
  };
}
describe('21.5 source policy and router', () => {
  it.each([
    'OWNER_MANUAL',
    'DEALER',
    'PRESS',
    'MEDIA_REVIEW',
    'WEBMOTORS',
    'FORUM',
    'AGGREGATOR',
    'THIRD_PARTY_DATABASE',
  ] as const)('rejects %s', (sourceClass) =>
    expect(routeSpecSource({ ...source, sourceClass })).toBe('REJECT_SOURCE'),
  );
  it('native PDF technical sheet is document intelligence', () =>
    expect(routeSpecSource({ ...source, sourceClass: 'TECHNICAL_SHEET', format: 'PDF_FILE' })).toBe(
      'DOCUMENT_INTELLIGENCE',
    ));
  it('lossless structured JSON may be deterministic', () =>
    expect(
      routeSpecSource({
        ...source,
        sourceClass: 'OFFICIAL_STRUCTURED_DATA',
        format: 'STRUCTURED_JSON',
        losslessStructured: true,
      }),
    ).toBe('DETERMINISTIC_STRUCTURED'));
  it('complex HTML requires intelligence', () =>
    expect(routeSpecSource(source)).toBe('DOCUMENT_INTELLIGENCE'));
  it('manual classification overrides claimed technical sheet', () =>
    expect(
      classifyDocumentSource('https://example.test/manual.pdf', 'ficha tecnica', 'TECHNICAL_SHEET'),
    ).toBe('OWNER_MANUAL'));
  it('generic catalog PDF is not automatically eligible', () =>
    expect(classifyDocumentSource('https://example.test/catalog.pdf')).toBe('UNKNOWN'));
});
describe('21.5 structural validator', () => {
  it('valid grounded source passes with no fixed Golden count', () =>
    expect(validate(content).status).toBe('PASS'));
  it.each(['specCode', 'equipmentId', 'canonicalSpec', 'productSpecId'])(
    'strict schema excludes %s',
    (key) => expect(validate({ ...content, [key]: 'bad' }).issues[0]?.code).toBe('SCHEMA_INVALID'),
  );
  it('missing evidence requires repair', () =>
    expect(
      validate(mutate((x) => (x.sections[0]!.items[0]!.evidence = []))).issues.some(
        (i) => i.code === 'EVIDENCE_MISSING',
      ),
    ).toBe(true));
  it('invented evidence is not grounded', () =>
    expect(
      validate(
        mutate((x) => (x.sections[0]!.items[0]!.evidence[0]!.quote = 'Motor 999')),
      ).issues.some((i) => i.code === 'EVIDENCE_NOT_GROUNDED'),
    ).toBe(true));
  it('wrong source hash cannot ground evidence', () =>
    expect(
      validate(mutate((x) => (x.sections[0]!.items[0]!.evidence[0]!.sourceHash = 'other'))).status,
    ).not.toBe('PASS'));
  it('partial source token is rejected', () =>
    expect(
      validate(mutate((x) => (x.sections[0]!.items[0]!.rawValue = '200 TS'))).issues.some(
        (i) => i.code === 'LIKELY_TRUNCATED_TEXT',
      ),
    ).toBe(true));
  it('unsupported PRESENT requires repair', () => {
    const c = mutate((x) => {
      const i = x.sections[0]!.items[0]!;
      i.kind = 'PRESENT';
      i.present = true;
      i.evidence = [{ ...i.evidence[0]!, quote: 'Motor 200 TSI' }];
    });
    expect(validate(c).issues.some((i) => i.code === 'PRESENCE_NOT_PROVEN')).toBe(true);
  });
  it('explicit bullet proves PRESENT', () =>
    expect(
      validate(
        mutate((x) => {
          const i = x.sections[0]!.items[0]!;
          i.sourceLabel = 'Câmera';
          i.rawValue = '•';
          i.kind = 'PRESENT';
          i.present = true;
        }),
      ).status,
    ).toBe('PASS'));
  it('unproved exact version is downgraded', () => {
    const s = structuredClone(source);
    s.blocks[0]!.scope.version = null;
    const r = validate(content, s);
    expect(r.inventory?.sections[0]?.items[0]?.applicability.versionBinding).toBe('UNRESOLVED');
  });
  it('unproved exact MY is downgraded', () => {
    const s = structuredClone(source);
    s.blocks[0]!.scope.modelYear = null;
    expect(validate(content, s).inventory?.sections[0]?.items[0]?.applicability.yearBinding).toBe(
      'UNRESOLVED',
    );
  });
  it('explicit GTS child overrides shared model and remains inventory only', () => {
    const s = structuredClone(source);
    s.blocks[0]!.scope.version = 'GTS 250 TSI';
    const r = validate(
      mutate((x) => {
        x.sections[0]!.items[0]!.applicability.versionBinding = 'MODEL_SHARED';
      }),
      s,
    );
    expect(r.observations).toHaveLength(0);
    expect(r.inventory?.sections[0]?.items).toHaveLength(1);
    expect(r.issues.some((i) => i.code === 'TARGET_VERSION_CONFLICT')).toBe(true);
  });
  it('explicit other version proposal cannot emit target observation', () =>
    expect(
      validate(mutate((x) => (x.sections[0]!.items[0]!.applicability.version = 'Highline 200 TSI')))
        .observations,
    ).toEqual([]));
  it('model output conflict with explicit source identity is repairable', () =>
    expect(validate(mutate((x) => (x.documentIdentity.model = 'Other'))).status).toBe(
      'REPAIR_REQUIRED',
    ));
  it('empty sections require repair', () =>
    expect(
      validate(mutate((x) => (x.sections[0]!.items = []))).issues.some(
        (i) => i.code === 'EMPTY_SECTION',
      ),
    ).toBe(true));
  it('duplicate explosion requires repair', () =>
    expect(
      validate(
        mutate((x) => x.sections[0]!.items.push(structuredClone(x.sections[0]!.items[0]!))),
      ).issues.some((i) => i.code === 'DUPLICATE_ITEM'),
    ).toBe(true));
  it('unproven nested group requires repair', () =>
    expect(validate(mutate((x) => (x.sections[0]!.items[0]!.subgroup = 'Invented'))).status).toBe(
      'REPAIR_REQUIRED',
    ));
  it('bounded truncation needs review', () =>
    expect(validate(content, { ...source, truncated: true }).status).toBe('HUMAN_REVIEW_REQUIRED'));
  it('model year must be evidenced', () =>
    expect(
      validate(mutate((x) => (x.documentIdentity.modelYear = 2030))).issues.some(
        (i) => i.code === 'MODEL_YEAR_UNSUPPORTED',
      ),
    ).toBe(true));
  it('source schema has no canonical/catalog input', () => {
    for (const v of ['SpecMaster', 'product_specs', 'specCode', 'equipmentId'])
      expect(JSON.stringify(technicalSheetSchema)).not.toContain(v);
  });
});
describe('21.5 Terra / validate / Sol and budget', () => {
  it('models and max repair are explicit', () =>
    expect(DOCUMENT_STRATEGY).toMatchObject({
      primaryModel: 'gpt-5.6-terra',
      repairModel: 'gpt-5.6-sol',
      maxRepairCalls: 1,
      documentHardCostCapUsd: 1,
    }));
  it('Terra PASS never calls Sol', async () => {
    const t = transport([content]);
    const r = await new ValidatedDocumentIntelligence(t).extract(source, target);
    expect(t.generate).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('PASS');
    expect(r.requests[0]?.model).toBe('gpt-5.6-terra');
  });
  it('repair required calls Sol once', async () => {
    const t = transport([{}, content]);
    const r = await new ValidatedDocumentIntelligence(t).extract(source, target);
    expect(t.generate).toHaveBeenCalledTimes(2);
    expect(r.status).toBe('PASS');
    expect(r.requests[1]?.model).toBe('gpt-5.6-sol');
  });
  it('failed repair requires review and no third call', async () => {
    const t = transport([{}, {}]);
    const r = await new ValidatedDocumentIntelligence(t).extract(source, target);
    expect(t.generate).toHaveBeenCalledTimes(2);
    expect(r.reason).toBe('REPAIR_FAILED');
  });
  it('projected Sol cap prevents generation', async () => {
    const t = transport([{}]);
    const r = await new ValidatedDocumentIntelligence(t).extract(source, target, {
      hardCostCapUsd: 0.3,
    });
    expect(t.generate).toHaveBeenCalledTimes(1);
    expect(r.reason).toBe('COST_CAP');
  });
  it('manual uses zero count/generation budget', async () => {
    const t = transport([]);
    await new ValidatedDocumentIntelligence(t).extract(
      { ...source, sourceClass: 'OWNER_MANUAL' },
      target,
    );
    expect(t.count).not.toHaveBeenCalled();
    expect(t.generate).not.toHaveBeenCalled();
  });
  it('usage and actual cost are captured', async () => {
    const r = await new ValidatedDocumentIntelligence(transport([content])).extract(source, target);
    expect(r.requests[0]?.usage.reasoningTokens).toBe(10);
    expect(r.totalCostUsd).toBe(0.0014);
  });
  it('benchmark costs preserved without Golden input', () => {
    expect(
      documentCost('gpt-5.6-terra', {
        inputTokens: 5346,
        cachedInputTokens: 0,
        outputTokens: 6542,
        reasoningTokens: 71,
      }),
    ).toBe(0.089196);
    expect(
      documentCost('gpt-5.6-sol', {
        inputTokens: 11891,
        cachedInputTokens: 0,
        outputTokens: 7197,
        reasoningTokens: 470,
      }),
    ).toBe(0.191504);
  });
  it('genuinely ambiguous source does not spend repair budget', async () => {
    const t = transport([mutate((x) => (x.documentIdentity.model = null))]);
    const ambiguous = structuredClone(source);
    ambiguous.blocks[0]!.text = 'Motor 200 TSI';
    const r = await new ValidatedDocumentIntelligence(t).extract(ambiguous, target);
    expect(r.status).toBe('HUMAN_REVIEW_REQUIRED');
    expect(t.generate).toHaveBeenCalledTimes(1);
  });
  it('invalid budget rejected before model call', async () => {
    const t = transport([]);
    await new ValidatedDocumentIntelligence(t).extract(source, target, { hardCostCapUsd: 2 });
    expect(t.count).not.toHaveBeenCalled();
  });
  it('provider failure is review, not uncaught failure of run', async () => {
    const t = transport([]);
    vi.mocked(t.count).mockRejectedValue(new Error('secret'));
    const r = await new ValidatedDocumentIntelligence(t).extract(source, target);
    expect(r.reason).toBe('PROVIDER_FAILED');
    expect(JSON.stringify(r)).not.toContain('secret');
  });
});

it('explicit absent statement emits negative rather than relying on vocabulary', () => {
  const s = structuredClone(source);
  s.blocks[0]!.text += ' Teto sem equipamento';
  const c = mutate((x) => {
    const i = x.sections[0]!.items[0]!;
    i.sourceLabel = 'Teto';
    i.rawValue = 'sem equipamento';
    i.kind = 'EXPLICIT_ABSENT';
    i.present = false;
    i.evidence = [{ sourceHash: s.sourceHash, locator: 'card', quote: 'Teto sem equipamento' }];
  });
  expect(validate(c, s).observations[0]?.observation).toMatchObject({
    parsedValue: false,
    polarity: 'EXPLICIT_NEGATIVE',
  });
});
it('copyright year alone cannot prove a document model year', () => {
  const s = structuredClone(source);
  s.blocks[0]!.scope.modelYear = null;
  s.blocks[0]!.text = 'VW Nivus Copyright 2026 Motor 200 TSI';
  const c = mutate((x) => {
    x.documentIdentity.modelYear = 2026;
    x.documentIdentity.evidence = [
      { sourceHash: s.sourceHash, locator: 'card', quote: 'VW Nivus Copyright 2026' },
    ];
  });
  expect(validate(c, s).issues.some((i) => i.code === 'MODEL_YEAR_UNSUPPORTED')).toBe(true);
});

it('an explicit MY label can prove document year without injected scope', () => {
  const s = structuredClone(source);
  s.blocks[0]!.scope.modelYear = null;
  s.blocks[0]!.text += ' VW Nivus MY2026';
  const c = mutate((x) => {
    x.documentIdentity.modelYear = 2026;
    x.documentIdentity.evidence = [
      { sourceHash: s.sourceHash, locator: 'card', quote: 'VW Nivus MY2026' },
    ];
  });
  expect(validate(c, s).issues.some((i) => i.code === 'MODEL_YEAR_UNSUPPORTED')).toBe(false);
});

it('21.6 Sol repairs omitted identity using source and issues, never Golden', async () => {
  const broken = mutate((x) => {
    x.documentIdentity.evidence = [];
  });
  const t = transport([broken, content]);
  const r = await new ValidatedDocumentIntelligence(t).extract(source, target);
  expect(r.status).toBe('PASS');
  expect(t.generate).toHaveBeenCalledTimes(2);
  const repair = vi.mocked(t.generate).mock.calls[1]![0].repair!;
  expect(repair.issues.some((i) => i.code === 'IDENTITY_OUTPUT_INCOMPLETE')).toBe(true);
  expect(Object.keys(repair).sort()).toEqual(['issues', 'proposal']);
});

it('21.6 incomplete model output routes through repair at most once', async () => {
  const t = transport([content, content]);
  vi.mocked(t.generate).mockImplementationOnce(async (r) => ({
    ...response(content, r.model),
    completed: false,
  }));
  const r = await new ValidatedDocumentIntelligence(t).extract(source, target);
  expect(r.validations[0]?.status).toBe('REPAIR_REQUIRED');
  expect(r.validations[0]?.issues.some((i) => i.code === 'STRUCTURE_INCOMPLETE')).toBe(true);
  expect(r.status).toBe('PASS');
  expect(t.generate).toHaveBeenCalledTimes(2);
});
