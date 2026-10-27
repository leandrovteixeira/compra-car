import { describe, expect, it } from 'vitest';
import {
  fingerprintWatcherFeedItem,
  type WatcherFeedItem,
} from '../src/agents/watcher-ingestion-contract';
import {
  analyzeWatcherRevision,
  verifyWatcherLiteralEvidence,
  type WatcherIntelligenceContext,
  type WatcherIntelligenceDocument,
} from '../src/agents/watcher-intelligence';
import {
  discoverWatcherCandidates,
  reviewWatcherDiscovery,
  appendWatcherIntelligenceJournal,
} from '../src/agents/watcher-candidate-discovery';
import {
  planWatcherIntelligenceAi,
  type WatcherAiGateBudget,
} from '../src/agents/watcher-intelligence-ai-gate';

const at = '2026-10-26T18:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const source = (id: string) => ({
  id,
  feedUrl: `https://${id}.example.br/rss`,
  editorialMarket: 'BR' as const,
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
});
const context: WatcherIntelligenceContext = {
  brands: [
    { id: 'fiat', canonicalName: 'Fiat', canonicalKey: 'fiat', market: 'BR', aliases: [] },
    {
      id: 'vw',
      canonicalName: 'Volkswagen',
      canonicalKey: 'volkswagen',
      market: 'BR',
      aliases: ['VW'],
    },
  ],
  mmvs: [
    {
      id: 'pulse-drive',
      brand: 'Fiat',
      model: 'Pulse',
      officialVersionLabel: 'Drive',
      market: 'BR',
    },
    {
      id: 'pulse-audace',
      brand: 'Fiat',
      model: 'Pulse',
      officialVersionLabel: 'Audace',
      market: 'BR',
    },
    {
      id: 'polo-gti',
      brand: 'Volkswagen',
      model: 'Polo',
      officialVersionLabel: 'GTI',
      market: 'BR',
    },
    {
      id: 'polo-gts',
      brand: 'Volkswagen',
      model: 'Polo',
      officialVersionLabel: 'GTS',
      market: 'BR',
    },
    {
      id: 'fastback',
      brand: 'Fiat',
      model: 'Fastback',
      officialVersionLabel: 'Limited',
      market: 'BR',
    },
  ],
  sources: [
    { source: source('news'), kind: 'SECONDARY', officialBrandId: null, officialHosts: [] },
    { source: source('other'), kind: 'SECONDARY', officialBrandId: null, officialHosts: [] },
    {
      source: source('official'),
      kind: 'MANUFACTURER',
      officialBrandId: 'fiat',
      officialHosts: ['official.example.br'],
    },
  ],
};
function doc(
  title: string,
  n = 1,
  options: {
    sourceId?: string;
    excerpt?: string | null;
    content?: string;
    originGroup?: string | null;
    observedAt?: string;
    publishedAt?: string | null;
    feedItemId?: string;
    articleId?: string;
  } = {},
): WatcherIntelligenceDocument {
  const item: WatcherFeedItem = {
    sourceId: options.sourceId ?? 'news',
    guid: String(n),
    url: `https://${options.sourceId ?? 'news'}.example.br/news/${n}`,
    title,
    excerpt: options.excerpt ?? null,
    publishedAt: options.publishedAt === undefined ? at : options.publishedAt,
    updatedAt: null,
  };
  return {
    revision: {
      id: uuid(n),
      articleId: options.articleId ?? uuid(n + 1000),
      feedItemId: options.feedItemId ?? uuid(n + 2000),
      item,
      evidenceFingerprint: fingerprintWatcherFeedItem(item),
      firstObservedAt: options.observedAt ?? at,
      createdAt: options.observedAt ?? at,
    },
    content: options.content ?? null,
    originGroup: options.originGroup ?? null,
  };
}
const analyze = (title: string) => analyzeWatcherRevision(doc(title), context);
const discover = (documents: readonly WatcherIntelligenceDocument[]) =>
  discoverWatcherCandidates({ context, documents });

describe('Watcher deterministic intelligence - no IO capability', () => {
  it('extracts only literal event evidence and never derives launch dates from publication', () => {
    const document = doc('Fiat lança o novo Pulse no Brasil');
    const result = analyzeWatcherRevision(document, context);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({
      category: 'NEW_MODEL',
      decision: 'REVIEW',
      claim: 'EDITORIAL_ASSERTION',
      modelYear: null,
      identity: { resolution: 'EXISTING', brand: 'Fiat', model: 'Pulse', version: null },
    });
    expect(result.signals[0]).not.toHaveProperty('launchDate');
    expect(verifyWatcherLiteralEvidence(result.signals[0].evidence, document)).toBe(true);
  });
  it.each([
    'Receita de bolo de chocolate',
    'O Fiat de um poeta não lança novo carro',
    'Restaurante Polo lança novo menu',
    'Volkswagen apresenta relatório financeiro',
  ])('does not invent candidates for irrelevant or unsupported title %s', (title) => {
    expect(discover([doc(title)]).candidates).toHaveLength(0);
  });
  it.each([
    'Fiat lança o novo Pulse nos EUA',
    'Fiat lança o novo Pulse na Europa',
    'Fiat lança o novo Pulse no Brasil e na China',
  ])(
    'blocks foreign or mixed geography rather than treating BR editorial scope as proof: %s',
    (title) => {
      const result = analyze(title);
      expect(result.signals[0]).toMatchObject({
        applicability: 'NOT_APPLICABLE',
        decision: 'ABSTAIN',
      });
    },
  );
  it('does not use a Brazilian source as evidence of Brazilian availability', () => {
    expect(analyze('Fiat lança o novo Pulse').signals[0]).toMatchObject({
      applicability: 'UNKNOWN',
      decision: 'ABSTAIN',
    });
  });
  it.each([
    ['Fiat não lança o novo Pulse no Brasil', 'INSUFFICIENT', 'NEGATED'],
    ['Fiat pode lançar novo modelo Pulse no Brasil', 'SPECULATION', 'UNCERTAIN_CLAIM'],
    ['Rumor: Fiat lança o novo Pulse no Brasil', 'RUMOR', 'UNCERTAIN_CLAIM'],
    ['Fiat lança o novo Pulse no Brasil?', 'SPECULATION', 'UNCERTAIN_CLAIM'],
  ])('abstains on negation, speculation and questions: %s', (title, claim, reason) => {
    expect(analyze(title).signals[0]).toMatchObject({
      claim,
      decision: 'ABSTAIN',
      reasons: expect.arrayContaining([reason]),
    });
  });
  it('distinguishes an attributed announcement from verified official source evidence', () => {
    const title = 'Fiat anuncia novo modelo Pulse no Brasil';
    expect(analyze(title).signals[0].claim).toBe('ATTRIBUTED');
    expect(
      analyzeWatcherRevision(doc(title, 1, { sourceId: 'official' }), context).signals[0].claim,
    ).toBe('CONFIRMED');
    const forged = doc(title, 1, { sourceId: 'official' });
    const item = { ...forged.revision.item, url: 'https://news.example.br/copied' };
    const result = analyzeWatcherRevision(
      {
        ...forged,
        revision: {
          ...forged.revision,
          item,
          evidenceFingerprint: fingerprintWatcherFeedItem(item),
        },
      },
      context,
    );
    expect(result.signals[0].claim).not.toBe('CONFIRMED');
  });
  it('uses reviewed aliases without fuzzy model or version matching', () => {
    const signal = analyze('VW lança nova versão Polo GTS no Brasil').signals[0];
    expect(signal).toMatchObject({
      category: 'NEW_COMMERCIAL_VARIANT',
      identity: { brand: 'Volkswagen', model: 'Polo', version: 'GTS', mmvIds: ['polo-gts'] },
      decision: 'REVIEW',
    });
    expect(analyze('VW lança nova versão Polo GTX no Brasil').signals[0]).toMatchObject({
      decision: 'ABSTAIN',
      identity: { version: null },
    });
    expect(analyze('VW lança novo modelo Pollo no Brasil').signals[0].identity.model).toBeNull();
  });
  it('does not merge two models mentioned in one clause or disambiguate colliding aliases', () => {
    expect(analyze('Fiat lança novo modelo Pulse e Fastback no Brasil').signals[0]).toMatchObject({
      decision: 'ABSTAIN',
      identity: { resolution: 'UNRESOLVED', model: null },
    });
    const collision = {
      ...context,
      brands: [
        ...context.brands,
        {
          id: 'ambiguous',
          canonicalName: 'Other',
          canonicalKey: 'other',
          market: 'BR',
          aliases: ['Fiat'],
        },
      ],
    };
    expect(
      analyzeWatcherRevision(doc('Fiat lança o novo Pulse no Brasil'), collision).signals,
    ).toHaveLength(0);
  });
  it('does not interpret a homonymous industrial hub as a Volkswagen model', () => {
    const result = discover([doc('Volkswagen apresenta novo Polo industrial no Brasil')]);
    expect(result.candidates).toHaveLength(0);
    expect(result.analyses[0].abstentions).toContain('NON_VEHICLE_CONTEXT');
  });
  it('proposes a literal new version only with explicit version naming, without a canonical MMV', () => {
    expect(analyze('Fiat Pulse ganha nova versão Ultra no Brasil').signals[0]).toMatchObject({
      category: 'NEW_COMMERCIAL_VARIANT',
      decision: 'REVIEW',
      identity: { resolution: 'PROBABLE_NEW', model: 'Pulse', version: 'Ultra', mmvIds: [] },
    });
  });
  it('creates a probable identity only for explicit named new vehicles, never a canonical MMV', () => {
    expect(analyze('Fiat apresenta novo Pandion, carro para o Brasil').signals[0]).toMatchObject({
      identity: { resolution: 'PROBABLE_NEW', model: 'Pandion', mmvIds: [] },
    });
    expect(analyze('Fiat apresenta novo carro para o Brasil').signals[0].identity.model).toBeNull();
    expect(
      analyze('Fiat apresenta novo Grand Panda, carro para o Brasil').signals[0].identity.model,
    ).toBeNull();
  });
  it.each([
    ['Fiat Pulse linha 2027 chega ao Brasil', 'NEW_MODEL_YEAR', 'linha 2027', '2027'],
    ['Fiat Pulse custa R$ 150.000 no Brasil', 'PRICE_CHANGE', 'R$ 150.000', null],
    ['Fiat Pulse custa R$ 150000 no Brasil', 'PRICE_CHANGE', 'R$ 150000', null],
    ['Fiat Pulse ganha novo motor 1.0 turbo no Brasil', 'POWERTRAIN', 'motor 1.0 turbo', null],
    ['Fiat Pulse ganha facelift no Brasil', 'FACELIFT', null, null],
    ['Fiat Pulse sai de linha no Brasil', 'POSSIBLE_DISCONTINUATION', null, null],
  ])(
    'captures supported category and attributes exactly: %s',
    (title, category, value, modelYear) => {
      expect(analyze(title).signals[0]).toMatchObject({
        category,
        value,
        modelYear,
        decision: 'REVIEW',
      });
    },
  );
  it('never synthesizes a missing price or engine value', () => {
    expect(analyze('Fiat Pulse tem preço novo no Brasil').signals[0]).toMatchObject({
      value: null,
      decision: 'ABSTAIN',
    });
    expect(analyze('Fiat Pulse ganha novo motor no Brasil').signals[0]).toMatchObject({
      value: null,
      decision: 'ABSTAIN',
    });
  });
  it('does not override a negating body caveat with a positive headline', () => {
    const document = doc('Fiat lança o novo Pulse no Brasil', 1, {
      content: 'A marca não confirmou a chegada ao Brasil.',
    });
    const result = analyzeWatcherRevision(document, context);
    expect(result.signals[0]).toMatchObject({
      decision: 'ABSTAIN',
      reasons: expect.arrayContaining(['DOCUMENT_QUALIFIER_CONFLICT']),
    });
    expect(result.signals[0].qualifiers).toHaveLength(1);
    expect(verifyWatcherLiteralEvidence(result.signals[0].qualifiers[0], document)).toBe(true);
  });
  it('keeps title, excerpt and content locations verifiable before normalization', () => {
    const document = doc('Resumo neutro', 1, {
      excerpt: 'Segundo a Fiat, Pulse ganha facelift no Brasil.',
      content: 'Texto disponível. Fiat Pulse custa R$ 90.000 no Brasil!',
    });
    const result = analyzeWatcherRevision(document, context);
    expect(new Set(result.signals.map((s) => s.evidence.field))).toEqual(
      new Set(['excerpt', 'content']),
    );
    for (const signal of result.signals) {
      expect(verifyWatcherLiteralEvidence(signal.evidence, document)).toBe(true);
      expect(
        verifyWatcherLiteralEvidence({ ...signal.evidence, quote: 'invented' }, document),
      ).toBe(false);
      expect(
        verifyWatcherLiteralEvidence({ ...signal.evidence, revisionId: uuid(999) }, document),
      ).toBe(false);
    }
  });
  it('rejects corrupt revision fingerprints, missing sources, invalid payloads and bounds', () => {
    const document = doc('Fiat lança o novo Pulse no Brasil');
    expect(() =>
      analyzeWatcherRevision(
        { ...document, revision: { ...document.revision, evidenceFingerprint: 'bad' } },
        context,
      ),
    ).toThrow();
    expect(() => analyzeWatcherRevision(document, { ...context, sources: [] })).toThrow();
    expect(() =>
      analyzeWatcherRevision({ ...document, content: 'x'.repeat(20001) }, context),
    ).toThrow();
    expect(() =>
      analyzeWatcherRevision(
        {
          ...document,
          revision: {
            ...document.revision,
            item: { ...document.revision.item, title: 'x'.repeat(501) },
          },
        },
        context,
      ),
    ).toThrow();
    expect(() => discover(Array.from({ length: 101 }, () => document))).toThrow();
    expect(() => analyzeWatcherRevision(null as never, context)).toThrow();
    expect(() =>
      analyzeWatcherRevision({ ...document, content: 'a. '.repeat(201) }, context),
    ).toThrow('WATCHER_INTELLIGENCE_LIMIT_EXCEEDED');
  });
});

describe('Watcher event candidates, quality and incremental review', () => {
  it('appends only new revisions, supports replay and fails atomically on rewritten history', () => {
    const first = doc('Fiat lança o novo Pulse no Brasil');
    const initial = appendWatcherIntelligenceJournal({ context, journal: [], updates: [first] });
    const second = doc('Fiat não lança o novo Pulse no Brasil', 2, {
      feedItemId: first.revision.feedItemId,
      articleId: first.revision.articleId,
      observedAt: '2026-10-27T00:00:00.000Z',
    });
    const next = appendWatcherIntelligenceJournal({
      context,
      journal: initial.journal,
      updates: [first, second],
    });
    expect(next.journal).toHaveLength(2);
    expect(next.replayedRevisions).toBe(1);
    expect(next.projection.candidates[0].status).toBe('INSUFFICIENT');
    expect(initial.projection.candidates[0].status).toBe('NEW');
    expect(
      appendWatcherIntelligenceJournal({ context, journal: next.journal, updates: [second] })
        .projection,
    ).toEqual(next.projection);
    const changed = { ...second, revision: { ...second.revision, id: first.revision.id } };
    expect(() =>
      appendWatcherIntelligenceJournal({ context, journal: initial.journal, updates: [changed] }),
    ).toThrow('WATCHER_REVISION_CONTENT_CONFLICT');
    expect(initial.journal).toHaveLength(1);
  });
  it('reports fixture coverage separately from the unprocessed real QA dataset', () => {
    const result = discover([
      doc('Fiat lança o novo Pulse no Brasil'),
      doc('Fiat apresenta o novo Pulse no Brasil', 2, { sourceId: 'other' }),
      doc('Receita de bolo de chocolate', 3),
      doc('Fiat lança o novo Fastback nos EUA', 4),
      doc('Rumor: VW lança novo modelo Polo no Brasil', 5),
      doc('Fiat Pulse custa R$ 90.000 no Brasil', 6),
    ]);
    expect(result.report).toMatchObject({
      articles: 6,
      revisions: 6,
      relevantArticles: 5,
      irrelevantArticles: 1,
      signals: 5,
      activeSignals: 5,
      uniqueCandidates: 4,
      ambiguousCandidates: 2,
      discardedCandidates: 0,
      duplicatesAvoided: 1,
      aiCalls: 0,
      aiCostUsd: 0,
    });
    expect(result.candidates.map((c) => c.evidence.length).sort()).toEqual([1, 1, 1, 2]);
  });
  it('consolidates the same event without claiming unknown sources are independent', () => {
    const result = discover([
      doc('Fiat lança o novo Pulse no Brasil'),
      doc('Fiat apresenta o novo Pulse no Brasil', 2, { sourceId: 'other' }),
    ]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      status: 'NEW',
      quality: { independentOrigins: 0, score: 20 },
      applyAllowed: false,
    });
    expect(result.candidates[0].evidence).toHaveLength(2);
    expect(result.report.duplicatesAvoided).toBe(1);
  });
  it('corroborates only reviewed independent origins, not identical republications', () => {
    const first = doc('Fiat lança o novo Pulse no Brasil', 1, { originGroup: 'announcement-a' });
    const second = doc('Fiat apresenta o novo Pulse no Brasil', 2, {
      sourceId: 'other',
      originGroup: 'interview-b',
    });
    expect(discover([first, second]).candidates[0]).toMatchObject({
      status: 'CORROBORATED',
      quality: { independentOrigins: 2, score: 60 },
    });
    const copied = doc(first.revision.item.title, 2, {
      sourceId: 'other',
      originGroup: 'interview-b',
    });
    expect(discover([first, copied]).candidates[0].quality.independentOrigins).toBe(1);
    const sameOrigin = { ...second, originGroup: 'announcement-a' };
    expect(discover([first, sameOrigin]).candidates[0].quality.independentOrigins).toBe(1);
  });
  it('treats official evidence differently but never authorizes application', () => {
    const candidate = discover([
      doc('Fiat lança o novo Pulse no Brasil', 1, { sourceId: 'official' }),
    ]).candidates[0];
    expect(candidate).toMatchObject({
      status: 'CORROBORATED',
      legacyStatus: 'OBSERVED',
      quality: { officialOrigins: 1, score: 80 },
      applyAllowed: false,
    });
  });
  it('keeps different models, versions, prices and observation windows separate', () => {
    const result = discover([
      doc('Fiat lança o novo Pulse no Brasil'),
      doc('Fiat lança o novo Fastback no Brasil', 2),
      doc('VW lança nova versão Polo GTS no Brasil', 3),
      doc('VW lança nova versão Polo GTI no Brasil', 4),
      doc('Fiat Pulse custa R$ 90.000 no Brasil', 5),
      doc('Fiat Pulse custa R$ 95.000 no Brasil', 6),
      doc('Fiat lança o novo Pulse no Brasil', 7, { publishedAt: '2027-01-01T00:00:00.000Z' }),
    ]);
    expect(result.candidates).toHaveLength(7);
  });
  it('is stable across ordering, aliases snapshot order and replay of identical revisions', () => {
    const documents = [
      doc('Fiat lança o novo Pulse no Brasil'),
      doc('Fiat apresenta o novo Pulse no Brasil', 2, { sourceId: 'other' }),
    ];
    const first = discover(documents),
      reordered = discoverWatcherCandidates({
        context: {
          ...context,
          brands: [...context.brands].reverse(),
          mmvs: [...context.mmvs].reverse(),
          sources: [...context.sources].reverse(),
        },
        documents: [...documents].reverse(),
      });
    expect(reordered).toEqual(first);
    expect(discover([...documents, ...documents]).fingerprint).toBe(first.fingerprint);
    expect(discover([...documents, ...documents]).candidates).toEqual(first.candidates);
  });
  it('preserves historical evidence but a negating new revision supersedes active conclusions', () => {
    const first = doc('Fiat lança o novo Pulse no Brasil');
    const second = doc('Fiat não lança o novo Pulse no Brasil', 2, {
      feedItemId: first.revision.feedItemId,
      articleId: first.revision.articleId,
      observedAt: '2026-10-27T00:00:00.000Z',
    });
    const result = discover([first, second]);
    expect(result.report).toMatchObject({ articles: 1, revisions: 2 });
    expect(result.candidates[0]).toMatchObject({
      status: 'INSUFFICIENT',
      activeSignalIds: [],
      quality: { score: 0 },
    });
    expect(result.candidates[0].evidence).toHaveLength(2);
    const corrupt = { ...first, revision: { ...second.revision, id: first.revision.id } };
    expect(() => discover([first, corrupt])).toThrow('WATCHER_REVISION_CONTENT_CONFLICT');
  });
  it('rejects ambiguous revision chronology instead of choosing a UUID arbitrarily', () => {
    const first = doc('Fiat lança o novo Pulse no Brasil');
    const second = doc('Fiat não lança o novo Pulse no Brasil', 2, {
      feedItemId: first.revision.feedItemId,
      articleId: first.revision.articleId,
    });
    expect(() => discover([first, second])).toThrow('WATCHER_REVISION_ORDER_AMBIGUOUS');
  });
  it('reviews with optimistic fingerprints, preserves history and never publishes', () => {
    const documents = [doc('Fiat lança o novo Pulse no Brasil')],
      snapshot = discover(documents),
      candidate = snapshot.candidates[0];
    const command = {
      candidateKey: candidate.key,
      expectedFingerprint: candidate.fingerprint,
      decision: 'ACCEPT' as const,
      actorId: 'reviewer',
      note: 'Encaminhar para revisão de catálogo',
    };
    const reviews = reviewWatcherDiscovery(snapshot, snapshot.fingerprint, command);
    const reviewed = discoverWatcherCandidates({ context, documents, reviews });
    expect(reviewed.candidates[0]).toMatchObject({
      status: 'REVIEW_REQUIRED',
      applyAllowed: false,
    });
    expect(reviewWatcherDiscovery(reviewed, reviewed.fingerprint, command)).toEqual(reviews);
    expect(() =>
      reviewWatcherDiscovery(reviewed, snapshot.fingerprint, { ...command, decision: 'REJECT' }),
    ).toThrow('WATCHER_STALE_DISCOVERY_SNAPSHOT');
    expect(() =>
      reviewWatcherDiscovery(snapshot, snapshot.fingerprint, {
        ...command,
        expectedFingerprint: 'stale',
      }),
    ).toThrow('WATCHER_STALE_CANDIDATE');
    const rejected = discoverWatcherCandidates({
      context,
      documents,
      reviews: [...reviews, { ...command, decision: 'REJECT' }],
    });
    expect(rejected.candidates[0]).toMatchObject({
      status: 'DISMISSED',
      legacyStatus: 'DISMISSED',
    });
    expect(rejected.reviews).toHaveLength(2);
  });
  it('retains old reviews while new evidence requires a new review snapshot', () => {
    const first = doc('Fiat lança o novo Pulse no Brasil'),
      before = discover([first]),
      candidate = before.candidates[0];
    const reviews = reviewWatcherDiscovery(before, before.fingerprint, {
      candidateKey: candidate.key,
      expectedFingerprint: candidate.fingerprint,
      decision: 'REJECT',
      actorId: 'reviewer',
      note: 'Not enough evidence',
    });
    const next = discoverWatcherCandidates({
      context,
      documents: [first, doc('Fiat apresenta o novo Pulse no Brasil', 2, { sourceId: 'official' })],
      reviews,
    });
    expect(next.reviews).toEqual(reviews);
    expect(next.candidates[0].status).toBe('CORROBORATED');
  });
  it('does not mutate inputs or return partial state when a revision fails validation', () => {
    const documents = [doc('Fiat lança o novo Pulse no Brasil')];
    const baseline = JSON.stringify({ context, documents });
    const snapshot = discover(documents),
      encoded = JSON.stringify(snapshot);
    expect(() =>
      discover([
        ...documents,
        { ...documents[0], revision: { ...documents[0].revision, id: 'bad' } },
      ]),
    ).toThrow();
    expect(JSON.stringify(snapshot)).toBe(encoded);
    expect(JSON.stringify({ context, documents })).toBe(baseline);
  });
});

describe('Watcher optional AI admission plan', () => {
  const budget: WatcherAiGateBudget = {
    maxCalls: 1,
    maxInputTokens: 2000,
    maxOutputTokens: 1000,
    maxCostUsd: 1,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    spentUsd: 0,
    outstandingReserveUsd: 0,
    estimatedInputTokens: 1000,
    estimatedOutputTokens: 500,
    estimatedCostUsd: 0.5,
  };
  const snapshot = discover([doc('Fiat pode lançar novo modelo Pulse no Brasil')]);
  it('is disabled by default, cannot dispatch and does not block deterministic processing', () => {
    expect(planWatcherIntelligenceAi({ snapshot })).toMatchObject({
      reason: 'DISABLED',
      providerExecutionAllowed: false,
      calls: 0,
      usage: { estimatedCostUsd: 0 },
    });
    expect(snapshot.report).toMatchObject({ aiCalls: 0, aiCostUsd: 0 });
    expect(planWatcherIntelligenceAi({ snapshot, enabled: true })).toMatchObject({
      reason: 'NOT_AUTHORIZED',
    });
  });
  it.each([
    { maxCostUsd: 0.1 },
    { maxCalls: 0 },
    { maxInputTokens: 2 },
    { maxOutputTokens: 2 },
    { outstandingReserveUsd: 0.7 },
    { estimatedCostUsd: NaN },
    { estimatedCostUsd: 0 },
  ])('blocks insufficient or invalid budgets: %j', (patch) => {
    expect(
      planWatcherIntelligenceAi({
        snapshot,
        enabled: true,
        explicitlyAuthorized: true,
        budget: { ...budget, ...patch },
      }).reason,
    ).toBe('BUDGET_BLOCKED');
  });
  it('requires existing atomic admission even when a reviewed ambiguity fits the budget', () => {
    const plan = planWatcherIntelligenceAi({
      snapshot,
      enabled: true,
      explicitlyAuthorized: true,
      budget,
    });
    expect(plan).toMatchObject({
      reason: 'EXTERNAL_ATOMIC_ADMISSION_REQUIRED',
      providerExecutionAllowed: false,
    });
    expect(plan.candidateKeys).toHaveLength(1);
    expect(
      planWatcherIntelligenceAi({
        snapshot: discover([doc('Fiat lança o novo Pulse no Brasil')]),
        enabled: true,
        explicitlyAuthorized: true,
        budget,
      }).reason,
    ).toBe('NOT_NEEDED');
  });
  it('rejects missing pricing fields and excludes superseded ambiguous claims', () => {
    expect(
      planWatcherIntelligenceAi({
        snapshot,
        enabled: true,
        explicitlyAuthorized: true,
        budget: { ...budget, estimatedCostUsd: undefined } as never,
      }).reason,
    ).toBe('BUDGET_BLOCKED');
    const first = doc('Fiat pode lançar novo modelo Pulse no Brasil');
    const second = doc('Fiat não lança o novo Pulse no Brasil', 2, {
      feedItemId: first.revision.feedItemId,
      articleId: first.revision.articleId,
      observedAt: '2026-10-27T00:00:00.000Z',
    });
    expect(
      planWatcherIntelligenceAi({
        snapshot: discover([first, second]),
        enabled: true,
        explicitlyAuthorized: true,
        budget,
      }).reason,
    ).toBe('NOT_NEEDED');
  });
});

describe('Watcher incremental news rules — brand ambiguity and Brazil arrival', () => {
  it('recognizes an arrival as a potential model event without claiming an unknown model', () => {
    const ctx: WatcherIntelligenceContext = {
      ...context,
      brands: [...context.brands, { id: 'mg', canonicalName: 'MG', canonicalKey: 'mg', market: 'BR', aliases: [] }],
    };
    const result = analyzeWatcherRevision(doc('MG chega ao Brasil com novo SUV elétrico', 991), ctx);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].category).toBe('NEW_MODEL');
    expect(result.signals[0].identity.model).toBeNull();
    expect(result.signals[0].decision).toBe('ABSTAIN');
  });
  it('retains ambiguity when two separate brands are genuinely mentioned', () => {
    const result = analyzeWatcherRevision(doc('Fiat e Volkswagen apresentam novo modelo SUV no Brasil', 992), context);
    expect(result.signals).toHaveLength(0);
    expect(result.abstentions).toContain('AMBIGUOUS_BRAND');
  });
});

describe('Watcher event dictionary v2 regressions', () => {
  it('classifies explicit market arrival without inventing a model', () => {
    const result = analyze('Volkswagen chega ao Brasil com novo SUV');
    expect(result.signals.some((s) => s.category === 'NEW_MODEL')).toBe(true);
    expect(result.signals.every((s) => s.decision === 'ABSTAIN')).toBe(true);
  });
  it('does not convert promotional discount into a public MSRP change', () => {
    const result = analyze('Fiat Pulse oferece desconto de R$ 20.000 no Brasil');
    expect(result.signals.some((s) => s.category === 'PRICE_CHANGE')).toBe(false);
  });
  it('recognizes explicit version and remains conservative without named version', () => {
    const result = analyze('Fiat Pulse ganha versão no Brasil');
    expect(result.signals.some((s) => s.category === 'NEW_COMMERCIAL_VARIANT')).toBe(true);
    expect(result.signals.every((s) => s.decision === 'ABSTAIN')).toBe(true);
  });
});
