import { describe, expect, it } from 'vitest';
import {
  articleTextSimilarity,
  canonicalArticleUrl,
  compareWatcherArticles,
  fingerprintWatcherArticle,
  isNewsEligible,
  preferredWatcherArticle,
  prepareWatcherHint,
  validateWatcherArticle,
  validateWatcherHint,
  type WatcherArticle,
} from '../src/agents/watcher-foundation';

const article: WatcherArticle = {
  id: 'one',
  url: 'https://auto.example.br/a',
  title: 'Novo modelo na Europa',
  sourceId: 'br-editorial',
  sourceRank: 0,
  publishedAt: '2026-10-20T12:00:00Z',
  market: 'BR',
  brazilApplicability: 'NOT_APPLICABLE',
  brand: 'Ford',
  model: 'Puma',
  category: 'PRODUCTS',
  excerpt: 'one two three four five six seven eight',
};
const other = { ...article, id: 'two', url: 'https://other.example.br/b' };
const hint = {
  schemaVersion: 'watcher-brand-hint/1',
  watcherCandidateId: 'c1',
  brand: 'Ford',
  market: 'BR',
  modelHint: 'Puma',
  projectCode: null,
  aliases: ['Puma'],
  evidenceFingerprint: fingerprintWatcherArticle(article),
};

describe('Watcher foundation hardening', () => {
  it.each([
    null,
    undefined,
    12,
    '',
    'not a url',
    'file:///tmp/a',
    'https://u:p@auto.example.br/',
    'https://127.0.0.1/',
    'http://10.0.0.1/',
    'http://2130706433/',
    'https://[::1]/',
    'https://localhost/',
    'https://x.local/',
    'https://x.internal/',
    'https://x.home.arpa/',
    'https://auto.example.br:8443/',
    'https://auto.example.br/\nx',
    'https:\\auto.example.br/x',
    'https://auto.example.br/' + 'x'.repeat(2048),
  ])('normalizes URL errors for %j', (url) => {
    expect(() => canonicalArticleUrl(url as string)).toThrow('WATCHER_INVALID_URL');
  });
  it('enforces bounds after URL encoding and Unicode normalization too', () => {
    expect(() => canonicalArticleUrl('https://auto.example.br/' + '\u00e9'.repeat(500))).toThrow(
      'WATCHER_INVALID_URL',
    );
    expect(() => validateWatcherArticle({ ...article, title: '\u0344'.repeat(500) })).toThrow(
      'WATCHER_INVALID_ARTICLE',
    );
  });
  it('canonicalizes only approved equivalences, preserving meaningful distinctions', () => {
    const url = canonicalArticleUrl('https://AUTO.example.br.:443/a/?b=2&utm_source=x&a=1#x');
    expect(url).toBe('https://auto.example.br/a?a=1&b=2');
    expect(canonicalArticleUrl(url)).toBe(url);
    expect(canonicalArticleUrl('https://auto.example.br/a?model=x')).not.toBe(
      canonicalArticleUrl('https://auto.example.br/a?model=y'),
    );
    expect(canonicalArticleUrl('http://auto.example.br/a')).not.toBe(
      canonicalArticleUrl('https://auto.example.br/a'),
    );
    expect(canonicalArticleUrl('https://auto.example.br/A')).not.toBe(
      canonicalArticleUrl('https://auto.example.br/a'),
    );
    expect(canonicalArticleUrl('https://auto.example.br/a?x=1&x=2')).not.toBe(
      canonicalArticleUrl('https://auto.example.br/a?x=2&x=1'),
    );
  });
  it.each([
    'invalid',
    '2026-02-30T12:00:00Z',
    '2025-02-29T12:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-01-01',
    '2026-01-01T12:00:00',
    '2026-01-01T24:00:00Z',
    '2026-01-01T12:60:00Z',
    '2026-01-01T12:00:60Z',
    '2026-01-01T12:00:00+14:01',
  ])('rejects date %s even on shortcuts', (publishedAt) => {
    const invalid = { ...article, publishedAt };
    expect(() => compareWatcherArticles(article, invalid)).toThrow('WATCHER_INVALID_DATE');
    expect(() => preferredWatcherArticle({ ...article, sourceRank: 9 }, invalid)).toThrow(
      'WATCHER_INVALID_DATE',
    );
  });
  it.each(['0001-01-01T00:00:00+01:00', '9999-12-31T23:00:00-02:00'])(
    'rejects UTC normalization outside the supported year range %s',
    (publishedAt) => {
      expect(() => validateWatcherArticle({ ...article, publishedAt })).toThrow(
        'WATCHER_INVALID_DATE',
      );
    },
  );
  it('normalizes explicit offsets and accepts leap days', () => {
    expect(
      validateWatcherArticle({ ...article, publishedAt: '2026-10-20T09:00:00-03:00' }).publishedAt,
    ).toBe('2026-10-20T12:00:00.000Z');
    expect(
      validateWatcherArticle({ ...article, publishedAt: '2024-02-29T00:00:00Z' }).publishedAt,
    ).toBe('2024-02-29T00:00:00.000Z');
  });
  it.each([-1, NaN, Infinity, 0.5, '1', null])('rejects source rank %j', (sourceRank) => {
    expect(() =>
      compareWatcherArticles(article, { ...article, sourceRank } as WatcherArticle),
    ).toThrow('WATCHER_INVALID_SOURCE_RANK');
  });
  it.each([
    { days: -1 },
    { days: Infinity },
    { days: NaN },
    { days: null },
    { threshold: -0.1 },
    { threshold: 1.1 },
    { threshold: NaN },
    { threshold: '0.8' },
    null,
  ])('validates options before URL shortcut %j', (options) => {
    expect(() => compareWatcherArticles(article, article, options as never)).toThrow(
      'WATCHER_INVALID_DEDUPE_OPTIONS',
    );
  });
  it('preserves seven day inclusive boundary and default 80 percent threshold', () => {
    expect(
      compareWatcherArticles(article, { ...other, publishedAt: '2026-10-27T12:00:00Z' }).duplicate,
    ).toBe(true);
    expect(
      compareWatcherArticles(article, { ...other, publishedAt: '2026-10-27T12:00:00.001Z' })
        .duplicate,
    ).toBe(false);
    // Four shared shingles out of five distinct shingles = exactly 0.8.
    expect(articleTextSimilarity(article.excerpt!, article.excerpt! + ' nine')).toBe(0.8);
    expect(
      compareWatcherArticles(article, { ...other, excerpt: article.excerpt! + ' nine' }).duplicate,
    ).toBe(true);
    expect(
      compareWatcherArticles(article, { ...other, excerpt: article.excerpt! + ' nine ten' })
        .duplicate,
    ).toBe(false);
  });
  it('requires sufficient text and matching identities', () => {
    expect(articleTextSimilarity('one two three four', 'one two three four')).toBeNull();
    expect(articleTextSimilarity('one two three four five', 'one two three four five')).toBe(1);
    expect(compareWatcherArticles(article, { ...other, excerpt: undefined }).reason).toBe(
      'INSUFFICIENT_TEXT',
    );
    expect(compareWatcherArticles(article, { ...other, model: 'Ranger' }).duplicate).toBe(false);
    expect(compareWatcherArticles(article, { ...other, brand: 'Fiat' }).duplicate).toBe(false);
    expect(compareWatcherArticles(article, { ...other, brand: undefined }).duplicate).toBe(false);
    expect(() => compareWatcherArticles(article, { ...other, brand: '!!!' })).toThrow(
      'WATCHER_INVALID_ARTICLE',
    );
    expect(() => compareWatcherArticles(article, { ...other, model: '   ' })).toThrow(
      'WATCHER_INVALID_ARTICLE',
    );
  });
  it('retains BR reporting about international launches and legitimate global News', () => {
    expect(isNewsEligible(article)).toBe(true);
    expect(isNewsEligible({ ...article, market: 'GLOBAL' })).toBe(true);
    expect(compareWatcherArticles(article, { ...other, market: 'GLOBAL' }).duplicate).toBe(false);
    expect(
      compareWatcherArticles(article, { ...other, brazilApplicability: 'CONFIRMED' }).duplicate,
    ).toBe(false);
    expect(
      validateWatcherArticle({ ...article, brazilApplicability: undefined }).brazilApplicability,
    ).toBeUndefined();
    expect(() => prepareWatcherHint({ ...hint, market: 'BR', confirmedBrazil: false })).toThrow(
      'WATCHER_LAUNCH_NOT_CONFIRMED',
    );
  });
  it.each([
    null,
    [],
    {},
    { ...hint, aliases: null },
    { ...hint, aliases: [12] },
    { ...hint, aliases: Array(2) },
    { ...hint, aliases: Array(21).fill('a') },
    { ...hint, brand: 'a'.repeat(101) },
    { ...hint, modelHint: null },
    { ...hint, projectCode: undefined },
    { ...hint, evidenceFingerprint: 'sha256-example' },
    { ...hint, market: 'GLOBAL' },
    { ...hint, watcherCandidateId: 'a'.repeat(201) },
    { ...hint, aliases: ['!!!'] },
  ])('rejects malformed hints %j', (value) => {
    expect(() => validateWatcherHint(value)).toThrow('WATCHER_INVALID_HANDOFF');
  });
  it('normalizes hints and enforces their boundary sizes', () => {
    const value = validateWatcherHint({
      ...hint,
      aliases: ['Z', 'A', 'Z'],
      brand: 'b'.repeat(100),
      watcherCandidateId: 'c'.repeat(200),
    });
    expect(value.aliases).toEqual(['A', 'Z']);
    expect(validateWatcherHint(value)).toEqual(value);
    expect(() =>
      prepareWatcherHint({ ...hint, market: 'GLOBAL', confirmedBrazil: true } as never),
    ).toThrow('WATCHER_INVALID_HANDOFF');
  });
  it('selects the same normalized representative regardless of argument or property order', () => {
    const candidates = [article, { ...other, id: 'A' }, { ...other, id: 'A', title: 'Other' }];
    for (const a of candidates)
      for (const b of candidates) {
        expect(preferredWatcherArticle(a, b)).toEqual(preferredWatcherArticle(b, a));
      }
    expect(
      preferredWatcherArticle(
        article,
        Object.fromEntries(Object.entries(article).reverse()) as WatcherArticle,
      ),
    ).toEqual(validateWatcherArticle(article));
  });
  it('fingerprints canonical evidence, excluding operational IDs and source priority', () => {
    const before = JSON.stringify(article);
    expect(fingerprintWatcherArticle(article)).toBe(
      fingerprintWatcherArticle({
        ...article,
        url: article.url + '?utm_source=x#x',
        sourceRank: 5,
        id: 'new',
      }),
    );
    expect(fingerprintWatcherArticle(article)).toBe(
      fingerprintWatcherArticle({ ...article, publishedAt: '2026-10-20T09:00:00-03:00' }),
    );
    expect(fingerprintWatcherArticle(article)).not.toBe(
      fingerprintWatcherArticle({ ...article, brazilApplicability: 'CONFIRMED' }),
    );
    expect(fingerprintWatcherArticle(article)).not.toBe(
      fingerprintWatcherArticle({ ...article, excerpt: 'changed' }),
    );
    expect(JSON.stringify(article)).toBe(before);
  });
});
