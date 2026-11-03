import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseWatcherFeed, FEED_MAX_BYTES } from '../watcher-feed-parser';
const source = {
  id: 'fixture',
  feedUrl: 'https://auto.example.br/rss',
  editorialMarket: 'BR' as const,
  language: 'pt-BR',
  sourceRank: 1,
  enabled: true,
};
const rss = readFileSync(new URL('./fixtures/watcher/rss.xml', import.meta.url), 'utf8');
const atom = readFileSync(new URL('./fixtures/watcher/atom.xml', import.meta.url), 'utf8');
const wrap = (item: string) => '<rss version="2.0"><channel>' + item + '</channel></rss>';
const entry = (extra = '') =>
  '<item><title>A car</title><link>https://auto.example.br/a</link>' + extra + '</item>';
describe('offline RSS/Atom parser', () => {
  it('supports RSS, CDATA, XML entities, DC dates, relative URLs and excludes full content/images', () => {
    const result = parseWatcherFeed(rss, source, { allowRelativeUrls: true });
    expect(result.rejected).toBe(0);
    expect(result.truncated).toBe(false);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      guid: 'opaque-1',
      title: 'Modelo & Europa',
      url: 'https://auto.example.br/news/europe',
      publishedAt: '2026-10-20T12:00:00.000Z',
      excerpt: 'Resumo curto & útil.',
    });
    expect(result.items[1].publishedAt).toBe('2024-02-29T00:00:00.000Z');
    expect(JSON.stringify(result)).not.toMatch(/DO_NOT_STORE|images.example|forbidden/);
  });
  it('resolves namespaced Atom IDs/alternate links/xml:base and summary only', () => {
    const result = parseWatcherFeed(atom, source, { allowRelativeUrls: true });
    expect(result.items[0]).toMatchObject({
      guid: 'tag:fixture.example,2026:one',
      title: 'Global & cars',
      url: 'https://auto.example.br/news/global',
      excerpt: 'Resumo & mercado',
      updatedAt: '2026-10-21T12:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('DO_NOT_STORE');
  });
  it('requires opt-in for relative links and leaves missing dates explicitly null', () => {
    expect(parseWatcherFeed(rss, source).rejected).toBe(1);
    const result = parseWatcherFeed(wrap(entry()), source);
    expect(result.items[0].publishedAt).toBeNull();
    expect(result.items[0].guid).toBeNull();
    expect(result.diagnostics).toContainEqual({ code: 'MISSING_DATE', itemIndex: 0 });
  });
  it.each([
    '<rss',
    '<rss version="2.0"><channel></rss>',
    '<rss version="2.0"><channel><item>&unknown;</item></channel></rss>',
    '<rss version="2.0"><channel x="1" x="2"/></rss>',
  ])('rejects malformed XML %s', (xml) => {
    expect(() => parseWatcherFeed(xml, source)).toThrow('WATCHER_FEED_INVALID_XML');
  });
  it.each([
    '<!DOCTYPE rss SYSTEM "https://evil.example.org/a.dtd">',
    '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>',
    '<!DOCTYPE rss [<!ENTITY x "explosion">]>',
  ])('rejects DTD and all declared entities without loading them', (dtd) => {
    expect(() => parseWatcherFeed(dtd + wrap(entry()), source)).toThrow(
      'WATCHER_FEED_DTD_FORBIDDEN',
    );
  });
  it.each([
    '<html/>',
    '<rss version="1.0"/>',
    '<feed xmlns="https://evil.example.org"/>',
    '<rss version="2.0"><channel/><channel/></rss>',
  ])('rejects non-RSS/Atom documents', (xml) => {
    expect(() => parseWatcherFeed(xml, source)).toThrow('WATCHER_FEED_UNSUPPORTED_FEED');
  });
  it.each([
    'javascript:alert(1)',
    'file:///a',
    'http://auto.example.br/a',
    'https://127.0.0.1/',
    'https://u:p@auto.example.br/a',
    'https://evil.example.org/a',
    '//evil.example.org/a',
    'https://auto.example.br/a&#10;b',
  ])('rejects malicious links %s', (url) => {
    const result = parseWatcherFeed(
      wrap('<item><title>A</title><link>' + url + '</link></item>'),
      source,
      { allowRelativeUrls: true },
    );
    expect(result.items).toHaveLength(0);
    expect(result.rejected).toBe(1);
  });
  it('requires a link even when relative URLs are enabled', () => {
    expect(
      parseWatcherFeed(wrap('<item><title>A</title></item>'), source, { allowRelativeUrls: true })
        .rejected,
    ).toBe(1);
  });
  it('accepts another article host only when explicitly allowed', () => {
    const xml = wrap(entry().replace('auto.example.br/a', 'news.example.org/a'));
    expect(parseWatcherFeed(xml, source).rejected).toBe(1);
    expect(
      parseWatcherFeed(xml, source, { allowedArticleHosts: ['news.example.org'] }).items,
    ).toHaveLength(1);
  });
  it.each(['Wed, 30 Feb 2026 10:00:00 GMT', '2026-02-30T00:00:00Z', 'yesterday', '2026-10-20'])(
    'rejects invalid dates with explicit diagnostics',
    (date) => {
      const result = parseWatcherFeed(wrap(entry('<pubDate>' + date + '</pubDate>')), source);
      expect(result.rejected).toBe(1);
      expect(result.diagnostics.some((d) => d.code === 'INVALID_DATE')).toBe(true);
    },
  );
  it.each([
    ['EST', '2026-10-20T17:00:00.000Z'],
    ['PDT', '2026-10-20T19:00:00.000Z'],
  ])('supports standard RSS named timezone %s', (zone, expected) => {
    const result = parseWatcherFeed(
      wrap(entry('<pubDate>Tue, 20 Oct 2026 12:00:00 ' + zone + '</pubDate>')),
      source,
    );
    expect(result.items[0].publishedAt).toBe(expected);
  });
  it('does not confuse foreign namespaces with RSS fields', () => {
    const xml = wrap(
      '<item xmlns:e="https://evil.example.org"><e:title>Fake</e:title><e:link>https://auto.example.br/fake</e:link></item>',
    );
    expect(parseWatcherFeed(xml, source).rejected).toBe(1);
  });
  it('reports item and excerpt truncation without retaining raw articles', () => {
    const result = parseWatcherFeed(
      wrap(entry('<description>' + 'a'.repeat(1500) + '</description>') + entry()),
      source,
      { maxItems: 1 },
    );
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].excerpt).toHaveLength(1000);
    expect(result.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining(['EXCERPT_TRUNCATED', 'ITEMS_TRUNCATED']),
    );
  });
  it('rejects oversized identity fields instead of truncating GUIDs', () => {
    expect(
      parseWatcherFeed(wrap(entry('<guid>' + 'x'.repeat(5000) + '</guid>')), source).rejected,
    ).toBe(1);
  });
  it('enforces byte, depth and node limits before building an unbounded tree', () => {
    expect(() => parseWatcherFeed(' '.repeat(FEED_MAX_BYTES + 1), source)).toThrow(
      'WATCHER_FEED_LIMIT_EXCEEDED',
    );
    expect(() =>
      parseWatcherFeed(wrap(entry('<a><b><c/></b></a>')), source, { maxDepth: 4 }),
    ).toThrow('WATCHER_FEED_LIMIT_EXCEEDED');
    expect(() => parseWatcherFeed(wrap(entry()), source, { maxNodes: 2 })).toThrow(
      'WATCHER_FEED_LIMIT_EXCEEDED',
    );
    expect(() => parseWatcherFeed(wrap(entry()), source, { maxItems: 101 })).toThrow(
      'WATCHER_INVALID_PARSER_LIMIT',
    );
  });
  it('separates nested XHTML text and preserves xml:base directory resolution', () => {
    const xml =
      '<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://auto.example.br/news/"><entry><id>one</id><title>A</title><link href="relative"/><summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>one</p><p>two</p></div></summary></entry></feed>';
    const result = parseWatcherFeed(xml, source, { allowRelativeUrls: true });
    expect(result.items[0].excerpt).toBe('one two');
    expect(result.items[0].url).toBe('https://auto.example.br/news/relative');
  });
  it('is deterministic and preserves opaque GUID case and Unicode', () => {
    const xml = wrap(entry('<guid>É-Aa</guid>'));
    expect(parseWatcherFeed(xml, source)).toEqual(parseWatcherFeed(xml, source));
    expect(parseWatcherFeed(xml, source).items[0].guid).toBe('É-Aa');
  });
});
