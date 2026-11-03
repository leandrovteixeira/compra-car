import { WATCHER_EVENT_RULES, WATCHER_NON_MSRP, WATCHER_NON_PRODUCT, WATCHER_EVENT_DICTIONARY_VERSION } from './watcher-event-dictionary';
import type { BrandIdentityResolution } from './brand-connector-types';
import type { CanonicalMmv } from './mmv-apply-contract';
import type { MmvDiscoverySourceKind, MmvDiscoveryReasonCode } from './mmv-discovery-contract';
import type { ModelYearReasonCode } from './model-year-contract';
import type { AgentFindingType } from '../agent-platform/types';
import type { WatcherStoredRevision } from './watcher-persistence';
import { watcherUuid } from './watcher-persistence';
import {
  fingerprintWatcherFeedItem,
  validateWatcherFeedItem,
  validateWatcherSource,
  type WatcherSource,
} from './watcher-ingestion-contract';
import { watcherDigest, watcherRecord, watcherText, watcherTimestamp } from './watcher-validation';
import {
  canonicalArticleUrl,
  watcherKey,
  type WatcherBrazilApplicability,
} from './watcher-foundation';

export const WATCHER_INTELLIGENCE_VERSION = 'watcher-intelligence/1' as const;
export const WATCHER_INTELLIGENCE_LIMITS = {
  documents: 100,
  brands: 200,
  mmvs: 2000,
  content: 20000,
  sources: 100,
  clausesPerField: 200,
} as const;
export type WatcherEventCategory =
  | Extract<
      MmvDiscoveryReasonCode,
      'NEW_MODEL' | 'NEW_COMMERCIAL_VARIANT' | 'POSSIBLE_DISCONTINUATION'
    >
  | Extract<ModelYearReasonCode, 'NEW_MODEL_YEAR'>
  | Extract<AgentFindingType, 'PRICE_CHANGE'>
  | 'POWERTRAIN'
  | 'FACELIFT';
export type WatcherClaim =
  'CONFIRMED' | 'ATTRIBUTED' | 'EDITORIAL_ASSERTION' | 'SPECULATION' | 'RUMOR' | 'INSUFFICIENT';
export type WatcherIdentity = Readonly<{
  resolution: 'EXISTING' | 'PROBABLE_NEW' | 'UNRESOLVED';
  brandId: string;
  brand: string;
  model: string | null;
  version: string | null;
  mmvIds: readonly string[];
}>;
export type WatcherIntelligenceContext = Readonly<{
  /** Reviewed snapshots, not authority inferred from news or a domain suffix. */
  brands: readonly BrandIdentityResolution[];
  mmvs: readonly Pick<CanonicalMmv, 'id' | 'brand' | 'market' | 'model' | 'officialVersionLabel'>[];
  sources: readonly Readonly<{
    source: WatcherSource;
    kind: MmvDiscoverySourceKind;
    officialBrandId: string | null;
    officialHosts: readonly string[];
  }>[];
}>;
export type WatcherIntelligenceDocument = Readonly<{
  revision: WatcherStoredRevision;
  /** Already available plain text only. This module never fetches article content. */
  content?: string | null;
  /** Reviewed upstream-information origin, not simply the publisher. Null means independence unknown. */
  originGroup?: string | null;
}>;
export type WatcherLiteralEvidence = Readonly<{
  articleId: string;
  revisionId: string;
  sourceId: string;
  url: string;
  revisionFingerprint: string;
  field: 'title' | 'excerpt' | 'content';
  start: number;
  end: number;
  quote: string;
  ruleId: string;
  sourceKind: MmvDiscoverySourceKind;
  official: boolean;
  originGroup: string | null;
}>;
export type WatcherIntelligenceSignal = Readonly<{
  fingerprint: string;
  eventKey: string;
  identity: WatcherIdentity;
  category: WatcherEventCategory;
  applicability: WatcherBrazilApplicability;
  claim: WatcherClaim;
  decision: 'REVIEW' | 'ABSTAIN';
  reasons: readonly string[];
  /** Literal attribute, never a synthesized commercial value. */
  value: string | null;
  modelYear: string | null;
  observationWindow: string;
  evidence: WatcherLiteralEvidence;
  qualifiers: readonly WatcherLiteralEvidence[];
}>;
export type WatcherRevisionAnalysis = Readonly<{
  revision: WatcherStoredRevision;
  documentFingerprint: string;
  contextFingerprint: string;
  normalized: Readonly<{ title: string; excerpt: string; content: string }>;
  relevant: boolean;
  signals: readonly WatcherIntelligenceSignal[];
  abstentions: readonly string[];
}>;
const INVALID = 'WATCHER_INVALID_INTELLIGENCE';
const reject = (): never => {
  throw new Error(INVALID);
};
const text = (v: unknown, max = 200) => watcherText(v, max, INVALID);
const array = <T>(v: readonly T[], max: number): readonly T[] => {
  if (!Array.isArray(v) || v.length > max) return reject();
  return v;
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const has = (sentence: string, phrase: string) =>
  (' ' + sentence + ' ').includes(' ' + watcherKey(phrase) + ' ');
const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export function validateWatcherIntelligenceContext(value: WatcherIntelligenceContext) {
  watcherRecord(value, INVALID);
  const brands = array(value.brands, WATCHER_INTELLIGENCE_LIMITS.brands)
    .map((b) => {
      watcherRecord(b, INVALID);
      if (b.market !== 'BR') return reject();
      return {
        id: text(b.id),
        market: 'BR',
        canonicalName: text(b.canonicalName, 100),
        canonicalKey: text(b.canonicalKey, 100),
        aliases: [...new Set(array(b.aliases, 30).map((a) => text(a, 100)))].sort(compare),
      };
    })
    .sort((a, b) => compare(a.id, b.id));
  const mmvs = array(value.mmvs, WATCHER_INTELLIGENCE_LIMITS.mmvs)
    .map((m) => {
      watcherRecord(m, INVALID);
      if (m.market !== 'BR') return reject();
      return {
        id: text(m.id),
        market: 'BR',
        brand: text(m.brand, 100),
        model: text(m.model, 100),
        officialVersionLabel: text(m.officialVersionLabel, 200),
      };
    })
    .sort((a, b) => compare(a.id, b.id));
  const sources = array(value.sources, WATCHER_INTELLIGENCE_LIMITS.sources)
    .map((s) => {
      watcherRecord(s, INVALID);
      if (!['MANUFACTURER', 'SECONDARY', 'FIPE'].includes(s.kind)) return reject();
      const source = validateWatcherSource(s.source);
      const officialBrandId = s.officialBrandId === null ? null : text(s.officialBrandId);
      if (officialBrandId !== null && !brands.some((b) => b.id === officialBrandId))
        return reject();
      const officialHosts = [
        ...new Set(
          array(s.officialHosts, 20).map((h) => {
            const host = text(h, 253);
            if (new URL(canonicalArticleUrl('https://' + host + '/')).hostname !== host)
              return reject();
            return host;
          }),
        ),
      ].sort(compare);
      if (s.kind === 'MANUFACTURER' && (!officialBrandId || !officialHosts.length)) return reject();
      return { source, kind: s.kind, officialBrandId, officialHosts };
    })
    .sort((a, b) => compare(a.source.id, b.source.id));
  for (const ids of [
    brands.map((b) => b.id),
    mmvs.map((m) => m.id),
    sources.map((s) => s.source.id),
  ])
    if (new Set(ids).size !== ids.length) return reject();
  const context = { brands, mmvs, sources };
  return { context, fingerprint: watcherDigest('watcher-intelligence-context/1', [context]) };
}

const rules = WATCHER_EVENT_RULES;

function clauses(raw: string) {
  const result: { quote: string; start: number; end: number }[] = [];
  const expression = /[^.!?;]+(?:[.!?;](?!\s|$)[^.!?;]+)*(?:[.!?;](?=\s|$)|$)/gu;
  for (const match of raw.matchAll(expression)) {
    const quote = match[0].trim();
    if (!quote) continue;
    const start = match.index! + match[0].indexOf(quote);
    result.push({ quote, start, end: start + quote.length });
    if (result.length > WATCHER_INTELLIGENCE_LIMITS.clausesPerField)
      throw new Error('WATCHER_INTELLIGENCE_LIMIT_EXCEEDED');
  }
  return result;
}

/** Pure interpretation of bounded, stored revisions. Publication dates only bound observation groups. */
export function analyzeWatcherRevision(
  document: WatcherIntelligenceDocument,
  input: WatcherIntelligenceContext,
): WatcherRevisionAnalysis {
  watcherRecord(document, INVALID);
  const { context, fingerprint: contextFingerprint } = validateWatcherIntelligenceContext(input);
  const r = watcherRecord(document.revision, INVALID);
  const item = validateWatcherFeedItem(r.item);
  const revision: WatcherStoredRevision = {
    id: watcherUuid(r.id),
    articleId: watcherUuid(r.articleId),
    feedItemId: watcherUuid(r.feedItemId),
    evidenceFingerprint: text(r.evidenceFingerprint),
    item,
    firstObservedAt: watcherTimestamp(r.firstObservedAt),
    createdAt: watcherTimestamp(r.createdAt),
  };
  if (fingerprintWatcherFeedItem(item) !== revision.evidenceFingerprint) return reject();
  const source = context.sources.find((s) => s.source.id === item.sourceId);
  if (!source) return reject();
  const content = document.content == null ? null : document.content;
  if (
    content !== null &&
    (typeof content !== 'string' ||
      content.length > WATCHER_INTELLIGENCE_LIMITS.content ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content))
  )
    return reject();
  const originGroup = document.originGroup == null ? null : text(document.originGroup, 200);
  const documentFingerprint = watcherDigest('watcher-intelligence-document/1', [
    revision,
    content,
    originGroup,
  ]);
  const fields = { title: item.title, excerpt: item.excerpt ?? '', content: content ?? '' };
  // Conservative document-wide veto: do not let a positive headline override a caveat
  // in the available excerpt/body. Keep the exact caveat, not just a boolean or score.
  const qualifiers: WatcherLiteralEvidence[] = [];
  for (const [field, raw] of Object.entries(fields) as [keyof typeof fields, string][]) {
    for (const span of clauses(raw)) {
      if (
        /\b(?:nao|nunca|nega|negou|desmente|desmentiu|rumor|rumores|boato|boatos|eua|estados unidos|europa|china|japao|india|argentina|mexico|alemanha)\b/u.test(
          watcherKey(span.quote),
        ) ||
        span.quote.includes('?')
      ) {
        qualifiers.push({
          articleId: revision.articleId,
          revisionId: revision.id,
          sourceId: item.sourceId,
          url: item.url,
          revisionFingerprint: revision.evidenceFingerprint,
          field,
          ...span,
          ruleId: WATCHER_INTELLIGENCE_VERSION + ':DOCUMENT_QUALIFIER',
          sourceKind: source.kind,
          official: false,
          originGroup,
        });
      }
    }
  }
  const signals: WatcherIntelligenceSignal[] = [];
  const abstentions = new Set<string>();
  let relevant = false;
  for (const [field, raw] of Object.entries(fields) as [keyof typeof fields, string][]) {
    for (const span of clauses(raw)) {
      const normalized = watcherKey(span.quote);
      const mentions = context.brands.flatMap((brand) =>
        [brand.canonicalName, ...brand.aliases]
          .filter((alias) => has(normalized, alias))
          .map((alias) => ({ brand, alias: watcherKey(alias) })),
      );
      // A short alias inside a longer recognized brand name is not an independent
      // mention. Distinct non-overlapping brands remain ambiguous (review only).
      const brands = context.brands.filter((brand) =>
        mentions.some(({ brand: found, alias }) =>
          found.id === brand.id &&
          !mentions.some(({ brand: other, alias: longer }) =>
            other.id !== brand.id && longer !== alias &&
            (' ' + longer + ' ').includes(' ' + alias + ' '),
          ),
        ),
      );
      const categories = rules.filter((rule) => rule.pattern.test(normalized));
      const automotive =
        /\b(?:carro|carros|veiculo|veiculos|automovel|automoveis|modelo|modelos|suv|picape|sedan|hatch|motor|motorizacao|automotivo)\b/u.test(
          normalized,
        );
      if (!categories.length) {
        if (automotive) relevant = true;
        continue;
      }
      if (brands.length !== 1) {
        abstentions.add(brands.length ? 'AMBIGUOUS_BRAND' : 'NO_BRAND');
        continue;
      }
      const brand = brands[0];
      const aliases = [brand.canonicalName, ...brand.aliases];
      const rows = context.mmvs.filter((m) =>
        aliases.some((a) => watcherKey(a) === watcherKey(m.brand)),
      );
      let models = [...new Set(rows.filter((m) => has(normalized, m.model)).map((m) => m.model))];
      models = models.filter(
        (m) =>
          !models.some((other) => watcherKey(other) !== watcherKey(m) && has(watcherKey(other), m)),
      );
      let model = models.length === 1 ? models[0] : null;
      let resolution: WatcherIdentity['resolution'] = model ? 'EXISTING' : 'UNRESOLVED';
      if (!model && !models.length && automotive) {
        const names = aliases.map(escape).join('|');
        const proposalMatch = new RegExp(
          '(?:' +
            names +
            ')\\s+(?:apresenta|lança|anuncia)\\s+(?:o\\s+)?novo\\s+([A-Z][\\p{L}\\p{N}-]{1,30})',
          'u',
        ).exec(span.quote);
        const proposed = proposalMatch?.[1];
        const tail = proposalMatch
          ? span.quote.slice(proposalMatch.index + proposalMatch[0].length).trimStart()
          : '';
        if (
          proposed &&
          !/^[\p{Lu}\d-]/u.test(tail) &&
          !['suv', 'carro', 'motor', 'modelo', 'veiculo', 'visual', 'preco', 'ano'].includes(
            watcherKey(proposed),
          )
        ) {
          model = proposed;
          resolution = 'PROBABLE_NEW';
        }
      }
      if (!automotive && !model) {
        abstentions.add('NO_AUTOMOTIVE_CONTEXT');
        continue;
      }
      relevant = true;
      if (
        /\b(?:polo industrial|restaurante|futebol|shampoo|perfume|celular|telefone|hotel|programa de fidelidade)\b/u.test(
          normalized,
        )
      ) {
        abstentions.add('NON_VEHICLE_CONTEXT');
        continue;
      }
      if (models.length > 1) abstentions.add('AMBIGUOUS_MODEL');
      const matches = rows.filter((m) => m.model === model);
      const versions = [
        ...new Set(
          matches
            .filter((m) => has(normalized, m.officialVersionLabel))
            .map((m) => m.officialVersionLabel),
        ),
      ];
      let version = versions.length === 1 ? versions[0] : null;
      if (!versions.length && model) {
        const namedVersion = /nova vers[aã]o\s+([A-Z][\p{L}\p{N}-]{1,30})/u.exec(span.quote);
        const proposed = namedVersion?.[1];
        const tail = namedVersion
          ? span.quote.slice(namedVersion.index + namedVersion[0].length).trimStart()
          : '';
        if (
          proposed &&
          !/^[\p{Lu}\d-]/u.test(tail) &&
          ![model, ...aliases].some((name) => watcherKey(name) === watcherKey(proposed))
        ) {
          version = proposed;
          resolution = 'PROBABLE_NEW';
        }
      }
      if (versions.length > 1) {
        resolution = 'UNRESOLVED';
        abstentions.add('AMBIGUOUS_VERSION');
      }
      const identity: WatcherIdentity = {
        resolution,
        brandId: brand.id,
        brand: brand.canonicalName,
        model,
        version,
        mmvIds: matches
          .filter((m) => !version || m.officialVersionLabel === version)
          .map((m) => m.id)
          .sort(compare),
      };
      const negated =
        /\b(?:nao|nunca|nega|negou|descarta|descartou|desmente|desmentiu|sem confirmacao)\b/u.test(
          normalized,
        );
      const rumor = /\b(?:rumor|rumores|boato|boatos)\b/u.test(normalized);
      const speculation =
        /\b(?:pode|podera|poderia|deve|devera|talvez|suposto|especula|previsto|previsao)\b/u.test(
          normalized,
        ) || span.quote.includes('?');
      const br =
        /\b(?:no brasil|ao brasil|para o brasil|mercado brasileiro|mercado nacional|brasileiro|brasileira)\b/u.test(
          normalized,
        );
      const foreign =
        /\b(?:eua|estados unidos|europa|europeu|europeia|china|chines|chinesa|japao|india|argentina|mexico|alemanha)\b/u.test(
          normalized,
        );
      const applicability: WatcherBrazilApplicability =
        negated && br ? 'UNKNOWN' : foreign ? 'NOT_APPLICABLE' : br ? 'CONFIRMED' : 'UNKNOWN';
      const official =
        source.kind === 'MANUFACTURER' &&
        source.officialBrandId === brand.id &&
        source.officialHosts.includes(new URL(item.url).hostname);
      const attributed =
        /\b(?:segundo|afirma|afirmou|anuncia|anunciou|declara|declarou|informa|informou|diz|disse)\b/u.test(
          normalized,
        );
      const claim: WatcherClaim = negated
        ? 'INSUFFICIENT'
        : rumor
          ? 'RUMOR'
          : speculation
            ? 'SPECULATION'
            : official
              ? 'CONFIRMED'
              : attributed
                ? 'ATTRIBUTED'
                : 'EDITORIAL_ASSERTION';
      for (const rule of categories) {
        if (rule.category === 'PRICE_CHANGE' && WATCHER_NON_MSRP.test(normalized)) {
          abstentions.add('PROMOTION_NOT_MSRP');
          continue;
        }
        if (rule.category === 'NEW_MODEL' && WATCHER_NON_PRODUCT.test(normalized) &&
            !/\b(?:novo modelo|novo carro|chega ao brasil|inicia vendas no brasil)\b/u.test(normalized)) {
          abstentions.add('CORPORATE_NOT_PRODUCT_EVENT');
          continue;
        }
        // A specific event must not also create a generic NEW_MODEL signal.
        if (rule.category === 'NEW_MODEL' && categories.some((x) => x.category !== 'NEW_MODEL'))
          continue;
        const value = rule.value?.exec(span.quote)?.[0] ?? null;
        const year =
          /(?:ano[- ]modelo|linha)\s+((?:19|20|21)\d{2})/iu.exec(span.quote)?.[1] ?? null;
        const observationWindow = item.publishedAt?.slice(0, 7) ?? 'undated:' + revision.articleId;
        const reasons: string[] = [];
        if (!model || resolution === 'UNRESOLVED') reasons.push('UNRESOLVED_IDENTITY');
        if (negated) reasons.push('NEGATED');
        if (rumor || speculation) reasons.push('UNCERTAIN_CLAIM');
        if (applicability !== 'CONFIRMED')
          reasons.push(
            applicability === 'NOT_APPLICABLE' ? 'FOREIGN_MARKET' : 'BRAZIL_NOT_EXPLICIT',
          );
        if (rule.value && !value) reasons.push('MISSING_LITERAL_ATTRIBUTE');
        if (rule.category === 'NEW_COMMERCIAL_VARIANT' && !version)
          reasons.push('VERSION_NOT_RESOLVED');
        if (/<[^>]*>/u.test(span.quote)) reasons.push('MARKUP_NOT_PLAIN_TEXT');
        if (qualifiers.some((q) => q.field !== field || q.start !== span.start))
          reasons.push('DOCUMENT_QUALIFIER_CONFLICT');
        const ruleId = WATCHER_INTELLIGENCE_VERSION + ':' + rule.category;
        const evidence: WatcherLiteralEvidence = {
          articleId: revision.articleId,
          revisionId: revision.id,
          sourceId: item.sourceId,
          url: item.url,
          revisionFingerprint: revision.evidenceFingerprint,
          field,
          ...span,
          ruleId,
          sourceKind: source.kind,
          official,
          originGroup,
        };
        const eventKey = watcherDigest('watcher-event/1', [
          brand.id,
          model ? watcherKey(model) : null,
          version ? watcherKey(version) : null,
          rule.category,
          value ? watcherKey(value) : null,
          year,
          observationWindow,
        ]);
        const fingerprint = watcherDigest('watcher-signal/1', [
          WATCHER_INTELLIGENCE_VERSION,
          WATCHER_EVENT_DICTIONARY_VERSION,
          contextFingerprint,
          documentFingerprint,
          revision.id,
          eventKey,
          field,
          span.start,
          span.end,
          claim,
          applicability,
        ]);
        signals.push({
          fingerprint,
          eventKey,
          identity,
          category: rule.category,
          claim,
          applicability,
          decision: reasons.length ? 'ABSTAIN' : 'REVIEW',
          reasons,
          value,
          modelYear: year,
          observationWindow,
          evidence,
          qualifiers,
        });
      }
    }
  }
  if (!signals.length)
    abstentions.add(relevant ? 'NO_SUPPORTED_EVENT' : 'IRRELEVANT_OR_UNRESOLVED');
  return {
    revision,
    documentFingerprint,
    contextFingerprint,
    normalized: {
      title: watcherKey(fields.title),
      excerpt: watcherKey(fields.excerpt),
      content: watcherKey(fields.content),
    },
    relevant,
    signals: signals.sort((a, b) => compare(a.fingerprint, b.fingerprint)),
    abstentions: [...abstentions].sort(compare),
  };
}

export function verifyWatcherLiteralEvidence(
  evidence: WatcherLiteralEvidence,
  document: WatcherIntelligenceDocument,
): boolean {
  try {
    if (!['title', 'excerpt', 'content'].includes(evidence.field)) return false;
    const r = document.revision;
    const raw =
      evidence.field === 'content'
        ? document.content
        : evidence.field === 'title'
          ? r.item.title
          : r.item.excerpt;
    return (
      evidence.articleId === r.articleId &&
      evidence.revisionId === r.id &&
      evidence.sourceId === r.item.sourceId &&
      evidence.url === canonicalArticleUrl(r.item.url) &&
      evidence.revisionFingerprint === fingerprintWatcherFeedItem(r.item) &&
      evidence.revisionFingerprint === r.evidenceFingerprint &&
      typeof raw === 'string' &&
      Number.isInteger(evidence.start) &&
      Number.isInteger(evidence.end) &&
      evidence.start >= 0 &&
      evidence.end > evidence.start &&
      raw.slice(evidence.start, evidence.end) === evidence.quote
    );
  } catch {
    return false;
  }
}
