/**
 * Sprint 24 — Watcher deterministic foundation.
 * Pure functions only: no crawling, OpenAI calls, persistence, or canonical catalog writes.
 */
export type WatcherMarket = 'BR' | 'GLOBAL';
export type WatcherCategory = 'PRODUCTS' | 'MARKET' | 'IRRELEVANT';
export type WatcherArticle = Readonly<{
  id: string;
  url: string;
  title: string;
  excerpt?: string;
  publishedAt: string;
  sourceId: string;
  sourceRank: number;
  market: WatcherMarket;
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

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLD_ACCENTS = /[\u0300-\u036f]/gu;

export function watcherKey(value: string): string {
  return value.normalize('NFKD').replace(FOLD_ACCENTS, '').toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ');
}

export function canonicalArticleUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('WATCHER_INVALID_URL');
  if (url.username || url.password || !url.hostname.includes('.')) throw new Error('WATCHER_INVALID_URL');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/iu.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/u, '');
  url.searchParams.sort();
  return url.toString();
}

export function isNewsEligible(article: WatcherArticle): boolean {
  return !article.isSponsored && article.category !== 'IRRELEVANT' && !!article.title.trim();
}

function shingles(value: string, size = 5): Set<string> {
  const tokens = watcherKey(value).split(' ').filter(Boolean);
  if (tokens.length < size) return new Set();
  return new Set(Array.from({ length: tokens.length - size + 1 }, (_, i) =>
    tokens.slice(i, i + size).join(' ')));
}

/** Jaccard of distinct five-word shingles; returns null for insufficient text. */
export function articleTextSimilarity(a: string, b: string): number | null {
  const left = shingles(a), right = shingles(b);
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

/**
 * Similarity suppression is limited to the same brand and model, within 7 days.
 * Short titles cannot trigger fuzzy suppression; exact canonical URLs can.
 */
export function compareWatcherArticles(
  a: WatcherArticle,
  b: WatcherArticle,
  options: Readonly<{ days?: number; threshold?: number }> = {},
): DuplicateDecision {
  if (canonicalArticleUrl(a.url) === canonicalArticleUrl(b.url))
    return { duplicate: true, reason: 'SAME_URL', similarity: 1 };
  const days = options.days ?? 7, threshold = options.threshold ?? 0.8;
  if (!Number.isFinite(days) || days < 0 || !Number.isFinite(threshold) || threshold < 0 || threshold > 1)
    throw new Error('WATCHER_INVALID_DEDUPE_OPTIONS');
  const ta = Date.parse(a.publishedAt), tb = Date.parse(b.publishedAt);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) throw new Error('WATCHER_INVALID_DATE');
  if (Math.abs(ta - tb) > days * DAY_MS ||
      !a.brand || !b.brand || !a.model || !b.model ||
      watcherKey(a.brand) !== watcherKey(b.brand) ||
      watcherKey(a.model) !== watcherKey(b.model))
    return { duplicate: false, reason: 'DIFFERENT', similarity: null };
  const similarity = articleTextSimilarity(a.excerpt ?? '', b.excerpt ?? '');
  if (similarity === null) return { duplicate: false, reason: 'INSUFFICIENT_TEXT', similarity };
  return { duplicate: similarity >= threshold, reason: similarity >= threshold ? 'SAME_TEXT' : 'DIFFERENT', similarity };
}

/** Deterministic representative; the lower sourceRank is more authoritative. */
export function preferredWatcherArticle(a: WatcherArticle, b: WatcherArticle): WatcherArticle {
  if (a.sourceRank !== b.sourceRank) return a.sourceRank < b.sourceRank ? a : b;
  const ta = Date.parse(a.publishedAt), tb = Date.parse(b.publishedAt);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) throw new Error('WATCHER_INVALID_DATE');
  if (ta !== tb) return ta < tb ? a : b;
  return a.id.localeCompare(b.id) <= 0 ? a : b;
}

export function validateWatcherHint(hint: WatcherBrandHint): WatcherBrandHint {
  if (hint.schemaVersion !== 'watcher-brand-hint/1' || hint.market !== 'BR' ||
      !hint.watcherCandidateId.trim() || !hint.brand.trim() ||
      !hint.evidenceFingerprint.trim() || !(hint.modelHint?.trim() || hint.projectCode?.trim()) ||
      hint.aliases.some(a => !a.trim()))
    throw new Error('WATCHER_INVALID_HANDOFF');
  return hint;
}

/** A hint is prepared only after explicit confirmation; preparation never dispatches. */
export function prepareWatcherHint(input: Omit<WatcherBrandHint, 'schemaVersion' | 'market'> & {
  market: 'BR'; confirmedBrazil: boolean;
}): WatcherBrandHint {
  if (!input.confirmedBrazil) throw new Error('WATCHER_LAUNCH_NOT_CONFIRMED');
  return validateWatcherHint({
    schemaVersion: 'watcher-brand-hint/1', watcherCandidateId: input.watcherCandidateId,
    brand: input.brand, market: 'BR', modelHint: input.modelHint,
    projectCode: input.projectCode, aliases: [...new Set(input.aliases.map(a => a.trim()))],
    evidenceFingerprint: input.evidenceFingerprint,
  });
}
