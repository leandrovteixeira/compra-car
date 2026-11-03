import {
  watcherDigest,
  watcherEvidenceFingerprint,
  watcherRank,
  watcherRecord,
  watcherText,
  watcherTimestamp,
} from './watcher-validation';

export type WatcherMarket = 'BR' | 'GLOBAL';
export type WatcherBrazilApplicability = 'UNKNOWN' | 'CONFIRMED' | 'NOT_APPLICABLE';
export type WatcherCategory = 'PRODUCTS' | 'MARKET' | 'IRRELEVANT';
export type WatcherArticle = Readonly<{
  id: string;
  url: string;
  title: string;
  excerpt?: string;
  publishedAt: string;
  sourceId: string;
  sourceRank: number;
  /** Editorial scope, never proof of a Brazilian launch. */
  market: WatcherMarket;
  brazilApplicability?: WatcherBrazilApplicability;
  brand?: string;
  model?: string;
  category: WatcherCategory;
  isSponsored?: boolean;
}>;
export type WatcherBrandHint = Readonly<{
  schemaVersion: 'watcher-brand-hint/1';
  watcherCandidateId: string;
  brand: string;
  market: 'BR';
  modelHint: string | null;
  projectCode: string | null;
  aliases: readonly string[];
  evidenceFingerprint: string;
}>;
export const WATCHER_CANONICALIZATION_VERSION = 'watcher-url/1' as const;
const DAY_MS = 24 * 60 * 60 * 1000;
export function watcherKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

/** Static URL hygiene only. The future network adapter must validate and pin DNS. */
export function canonicalArticleUrl(raw: string): string {
  try {
    if (typeof raw !== 'string' || raw.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(raw))
      throw new Error();
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/u, '');
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !host.includes('.') ||
      /^[\d.]+$/u.test(host) ||
      host.includes(':') ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test|onion)$/u.test(host) ||
      host.endsWith('.home.arpa') ||
      host.split('.').some((part) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(part))
    )
      throw new Error();
    url.hostname = host;
    url.hash = '';
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/iu.test(key)) url.searchParams.delete(key);
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/u, '');
    url.searchParams.sort();
    const result = url.toString();
    if (result.length > 2048) throw new Error();
    return result;
  } catch {
    throw new Error('WATCHER_INVALID_URL');
  }
}

export function validateWatcherArticle(value: unknown): WatcherArticle {
  const code = 'WATCHER_INVALID_ARTICLE',
    a = watcherRecord(value, code);
  const identity = (v: unknown) => {
    const text = watcherText(v, 100, code);
    if (!watcherKey(text)) throw new Error(code);
    return text;
  };
  if (
    !['BR', 'GLOBAL'].includes(a.market as string) ||
    !['PRODUCTS', 'MARKET', 'IRRELEVANT'].includes(a.category as string) ||
    (a.brazilApplicability !== undefined &&
      !['UNKNOWN', 'CONFIRMED', 'NOT_APPLICABLE'].includes(a.brazilApplicability as string)) ||
    (a.isSponsored !== undefined && typeof a.isSponsored !== 'boolean')
  )
    throw new Error(code);
  return {
    id: watcherText(a.id, 200, code),
    url: canonicalArticleUrl(a.url as string),
    title: watcherText(a.title, 500, code),
    sourceId: watcherText(a.sourceId, 200, code),
    sourceRank: watcherRank(a.sourceRank),
    publishedAt: watcherTimestamp(a.publishedAt),
    market: a.market as WatcherMarket,
    category: a.category as WatcherCategory,
    ...(a.excerpt !== undefined ? { excerpt: watcherText(a.excerpt, 1000, code) } : {}),
    ...(a.brand !== undefined ? { brand: identity(a.brand) } : {}),
    ...(a.model !== undefined ? { model: identity(a.model) } : {}),
    ...(a.brazilApplicability !== undefined
      ? { brazilApplicability: a.brazilApplicability as WatcherBrazilApplicability }
      : {}),
    ...(a.isSponsored !== undefined ? { isSponsored: a.isSponsored as boolean } : {}),
  };
}
export function isNewsEligible(article: WatcherArticle): boolean {
  const a = validateWatcherArticle(article);
  return !a.isSponsored && a.category !== 'IRRELEVANT';
}
function shingles(value: string): Set<string> {
  const tokens = watcherKey(value).split(' ').filter(Boolean);
  return new Set(
    Array.from({ length: Math.max(0, tokens.length - 4) }, (_, i) =>
      tokens.slice(i, i + 5).join(' '),
    ),
  );
}
export function articleTextSimilarity(a: string, b: string): number | null {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length > 1000 || b.length > 1000)
    throw new Error('WATCHER_INVALID_TEXT');
  const left = shingles(a),
    right = shingles(b);
  if (!left.size || !right.size) return null;
  let common = 0;
  for (const value of left) if (right.has(value)) common++;
  return common / (left.size + right.size - common);
}
export type DuplicateDecision = Readonly<{
  duplicate: boolean;
  reason: 'SAME_URL' | 'SAME_TEXT' | 'DIFFERENT' | 'INSUFFICIENT_TEXT';
  similarity: number | null;
}>;
export function compareWatcherArticles(
  a: WatcherArticle,
  b: WatcherArticle,
  options: Readonly<{ days?: number; threshold?: number }> = {},
): DuplicateDecision {
  const config = watcherRecord(options, 'WATCHER_INVALID_DEDUPE_OPTIONS');
  const days = config.days === undefined ? 7 : config.days,
    threshold = config.threshold === undefined ? 0.8 : config.threshold;
  if (
    typeof days !== 'number' ||
    !Number.isFinite(days) ||
    days < 0 ||
    days > Number.MAX_SAFE_INTEGER / DAY_MS ||
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 1
  )
    throw new Error('WATCHER_INVALID_DEDUPE_OPTIONS');
  const left = validateWatcherArticle(a),
    right = validateWatcherArticle(b);
  if (left.url === right.url) return { duplicate: true, reason: 'SAME_URL', similarity: 1 };
  if (
    left.market !== right.market ||
    (left.brazilApplicability ?? 'UNKNOWN') !== (right.brazilApplicability ?? 'UNKNOWN') ||
    Math.abs(Date.parse(left.publishedAt) - Date.parse(right.publishedAt)) > days * DAY_MS ||
    !left.brand ||
    !right.brand ||
    !left.model ||
    !right.model ||
    watcherKey(left.brand) !== watcherKey(right.brand) ||
    watcherKey(left.model) !== watcherKey(right.model)
  )
    return { duplicate: false, reason: 'DIFFERENT', similarity: null };
  const similarity = articleTextSimilarity(left.excerpt ?? '', right.excerpt ?? '');
  if (similarity === null) return { duplicate: false, reason: 'INSUFFICIENT_TEXT', similarity };
  return {
    duplicate: similarity >= threshold,
    reason: similarity >= threshold ? 'SAME_TEXT' : 'DIFFERENT',
    similarity,
  };
}

/** Stable code-unit comparison; final content tie-break also handles equal IDs. Returns a validated normalized copy. */
export function preferredWatcherArticle(a: WatcherArticle, b: WatcherArticle): WatcherArticle {
  const left = validateWatcherArticle(a),
    right = validateWatcherArticle(b);
  if (left.sourceRank !== right.sourceRank)
    return left.sourceRank < right.sourceRank ? left : right;
  if (left.publishedAt !== right.publishedAt)
    return left.publishedAt < right.publishedAt ? left : right;
  // Validation constructs properties in a fixed order and drops unknown input fields.
  const key = (v: WatcherArticle) => JSON.stringify([v.id, v.url, JSON.stringify(v)]);
  return key(left) <= key(right) ? left : right;
}

export function validateWatcherHint(value: unknown): WatcherBrandHint {
  const code = 'WATCHER_INVALID_HANDOFF';
  try {
    const h = watcherRecord(value, code);
    if (
      h.schemaVersion !== 'watcher-brand-hint/1' ||
      h.market !== 'BR' ||
      !Array.isArray(h.aliases) ||
      h.aliases.length > 20
    )
      throw new Error(code);
    const name = (v: unknown) => {
      const text = watcherText(v, 100, code);
      if (!watcherKey(text)) throw new Error(code);
      return text;
    };
    const modelHint = h.modelHint === null ? null : name(h.modelHint),
      projectCode = h.projectCode === null ? null : name(h.projectCode);
    if (!modelHint && !projectCode) throw new Error(code);
    return {
      schemaVersion: 'watcher-brand-hint/1',
      market: 'BR',
      watcherCandidateId: watcherText(h.watcherCandidateId, 200, code),
      brand: name(h.brand),
      modelHint,
      projectCode,
      aliases: [...new Set(Array.from(h.aliases, name))].sort(),
      evidenceFingerprint: watcherEvidenceFingerprint(h.evidenceFingerprint),
    };
  } catch {
    throw new Error(code);
  }
}
/** Explicit confirmation is supplied by a future evidence/review workflow; this function never dispatches. */
export function prepareWatcherHint(
  input: Omit<WatcherBrandHint, 'schemaVersion' | 'market'> & {
    market: 'BR';
    confirmedBrazil: boolean;
  },
): WatcherBrandHint {
  const value = watcherRecord(input, 'WATCHER_INVALID_HANDOFF');
  if (value.confirmedBrazil !== true) throw new Error('WATCHER_LAUNCH_NOT_CONFIRMED');
  return validateWatcherHint({ ...value, schemaVersion: 'watcher-brand-hint/1' });
}

export function fingerprintWatcherArticle(article: WatcherArticle): string {
  const a = validateWatcherArticle(article);
  return watcherDigest('watcher-evidence/1', [
    WATCHER_CANONICALIZATION_VERSION,
    a.url,
    a.title,
    a.excerpt ?? null,
    a.publishedAt,
    a.market,
    a.brazilApplicability ?? 'UNKNOWN',
    a.brand ? watcherKey(a.brand) : null,
    a.model ? watcherKey(a.model) : null,
    a.category,
    a.isSponsored ?? false,
  ]);
}
