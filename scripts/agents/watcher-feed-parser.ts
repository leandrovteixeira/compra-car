import sax, { type QualifiedAttribute, type QualifiedTag } from 'sax';
import {
  canonicalArticleUrl,
  validateWatcherFeedItem,
  validateWatcherSource,
  type WatcherFeedItem,
  type WatcherSource,
} from '@compra-car/core/agents';

const ATOM = 'http://www.w3.org/2005/Atom';
const DC = 'http://purl.org/dc/elements/1.1/';
const XML = 'http://www.w3.org/XML/1998/namespace';
export const FEED_MAX_BYTES = 2 * 1024 * 1024;
export type FeedDiagnostic = Readonly<{
  code: 'MISSING_DATE' | 'INVALID_ITEM' | 'INVALID_DATE' | 'EXCERPT_TRUNCATED' | 'ITEMS_TRUNCATED';
  itemIndex: number | null;
}>;
export type WatcherFeedParseResult = Readonly<{
  format: 'RSS' | 'ATOM';
  received: number;
  items: readonly WatcherFeedItem[];
  diagnostics: readonly FeedDiagnostic[];
  rejected: number;
  truncated: boolean;
}>;
export class WatcherFeedParseError extends Error {
  constructor(
    public readonly code: 'INVALID_XML' | 'UNSUPPORTED_FEED' | 'DTD_FORBIDDEN' | 'LIMIT_EXCEEDED',
  ) {
    super('WATCHER_FEED_' + code);
  }
}
export type WatcherFeedParseOptions = Readonly<{
  allowRelativeUrls?: boolean;
  allowedArticleHosts?: readonly string[];
  maxBytes?: number;
  maxDepth?: number;
  maxNodes?: number;
  maxItems?: number;
}>;
function limit(value: number | undefined, fallback: number, max: number): number {
  const n = value ?? fallback;
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error('WATCHER_INVALID_PARSER_LIMIT');
  return n;
}
/** No HTML is retained or rendered. SAX extracts text; attributes/images are ignored. */
function plainText(value: string): string {
  const parser = sax.parser(false, { lowercase: true, noscript: true });
  let text = '',
    blocked = 0;
  const stack: boolean[] = [];
  parser.onopentag = (tag) => {
    const skip = ['script', 'style', 'iframe', 'object'].includes(tag.name.toLowerCase());
    stack.push(skip);
    if (skip) blocked++;
    if (!blocked) text += ' ';
  };
  parser.onclosetag = () => {
    if (stack.pop()) blocked--;
    if (!blocked) text += ' ';
  };
  parser.ontext = (part) => {
    if (!blocked) text += part;
  };
  parser.oncdata = parser.ontext;
  parser.ondoctype = () => {
    throw new WatcherFeedParseError('DTD_FORBIDDEN');
  };
  parser.onsgmldeclaration = parser.ondoctype;
  parser.write('<wrapper>' + value + '</wrapper>').close();
  return text
    .replace(/[\u0000-\u001f\u007f\s]+/gu, ' ')
    .trim()
    .normalize('NFC');
}
function normalizedDate(value: string, sourceId: string): string {
  let timestamp = value.trim();
  // RSS RFC 822/2822: convert recognized, bounded syntax then validate the calendar via Core.
  const rfc =
    /^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)\s+(GMT|UTC|UT|Z|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[+-]\d{4})$/u.exec(
      timestamp,
    );
  if (rfc) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months.findIndex((m) => m.toLowerCase() === rfc[2].toLowerCase()) + 1;
    let year = Number(rfc[3]);
    if (rfc[3].length === 2) year += year < 50 ? 2000 : 1900;
    const time = rfc[4].length === 5 ? rfc[4] + ':00' : rfc[4];
    const zones: Record<string, string> = {
      GMT: 'Z',
      UTC: 'Z',
      UT: 'Z',
      Z: 'Z',
      EST: '-05:00',
      EDT: '-04:00',
      CST: '-06:00',
      CDT: '-05:00',
      MST: '-07:00',
      MDT: '-06:00',
      PST: '-08:00',
      PDT: '-07:00',
    };
    const zone = /^[+-]/u.test(rfc[5]) ? rfc[5].slice(0, 3) + ':' + rfc[5].slice(3) : zones[rfc[5]];
    timestamp = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${rfc[1].padStart(2, '0')}T${time}${zone}`;
  }
  return validateWatcherFeedItem({
    sourceId,
    guid: null,
    url: 'https://date.example.org/',
    title: 'date',
    excerpt: null,
    publishedAt: timestamp,
    updatedAt: null,
  }).publishedAt!;
}

/** Strict SAX parsing, no DOM, DTD resolution, article fetch, content:encoded or Atom content. */
export function parseWatcherFeed(
  xml: string,
  input: WatcherSource,
  options: WatcherFeedParseOptions = {},
): WatcherFeedParseResult {
  const source = validateWatcherSource(input);
  const maxBytes = limit(options.maxBytes, FEED_MAX_BYTES, FEED_MAX_BYTES);
  const maxDepth = limit(options.maxDepth, 32, 64),
    maxNodes = limit(options.maxNodes, 20_000, 20_000);
  const maxItems = limit(options.maxItems, 100, 100);
  if (typeof xml !== 'string' || Buffer.byteLength(xml, 'utf8') > maxBytes)
    throw new WatcherFeedParseError('LIMIT_EXCEEDED');
  const hosts = new Set(options.allowedArticleHosts ?? [new URL(source.feedUrl).hostname]);
  const resolveUrl = (value: string, base: string): string => {
    if (!value.trim() || /[\u0000-\u001f\u007f\\]/u.test(value))
      throw new Error('UNSAFE_ARTICLE_URL');
    if (!options.allowRelativeUrls && !URL.canParse(value))
      throw new Error('RELATIVE_URL_DISABLED');
    const url = canonicalArticleUrl(new URL(value, base).toString());
    if (!url.startsWith('https://') || !hosts.has(new URL(url).hostname))
      throw new Error('UNSAFE_ARTICLE_URL');
    return url;
  };
  const parser = sax.parser(true, { xmlns: true, position: false });
  parser.ENTITIES = Object.assign(Object.create(null), {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  });
  type Frame = { local: string; uri: string; base: string; skip: boolean };
  type Entry = {
    depth: number;
    fields: Record<string, string>;
    link: string | null;
    base: string;
    invalid: boolean;
    overflow: boolean;
  };
  const stack: Frame[] = [],
    items: WatcherFeedItem[] = [],
    diagnostics: FeedDiagnostic[] = [];
  let format: 'RSS' | 'ATOM' | null = null,
    entry: Entry | null = null;
  let nodes = 0,
    seen = 0,
    rejected = 0,
    truncated = false,
    channels = 0;
  let capture: { field: string; depth: number; raw: boolean } | null = null;
  const diagnostic = (code: FeedDiagnostic['code'], itemIndex: number | null) => {
    if (diagnostics.length < 301) diagnostics.push({ code, itemIndex });
  };
  const forbidden = () => {
    throw new WatcherFeedParseError('DTD_FORBIDDEN');
  };
  parser.ondoctype = forbidden;
  parser.onsgmldeclaration = forbidden;
  parser.onerror = () => {
    throw new WatcherFeedParseError('INVALID_XML');
  };
  const attributes = new Set<string>();
  parser.onopentagstart = () => attributes.clear();
  parser.onattribute = (raw) => {
    const attribute = raw as QualifiedAttribute;
    const key = attribute.uri + ':' + attribute.local;
    if (attributes.has(key)) throw new WatcherFeedParseError('INVALID_XML');
    attributes.add(key);
  };
  parser.onopentag = (raw) => {
    const tag = raw as QualifiedTag;
    if (++nodes > maxNodes || stack.length >= maxDepth)
      throw new WatcherFeedParseError('LIMIT_EXCEEDED');
    const parent = stack.at(-1);
    let base = parent?.base ?? input.feedUrl;
    const xmlBase = Object.values(tag.attributes).find((a) => a.uri === XML && a.local === 'base');
    if (xmlBase) {
      resolveUrl(xmlBase.value, base); // Validate without losing directory semantics in xml:base.
      base = new URL(xmlBase.value, base).toString();
    }
    const skip =
      !!parent?.skip || ['script', 'style', 'iframe', 'object'].includes(tag.local.toLowerCase());
    stack.push({ local: tag.local, uri: tag.uri, base, skip });
    if (capture && stack.length > capture.depth && !capture.raw) append(' ');
    if (stack.length === 1) {
      if (tag.local === 'rss' && tag.uri === '' && tag.attributes.version?.value === '2.0')
        format = 'RSS';
      else if (tag.local === 'feed' && tag.uri === ATOM) format = 'ATOM';
      else throw new WatcherFeedParseError('UNSUPPORTED_FEED');
    }
    if (format === 'RSS' && stack.length === 2 && tag.local === 'channel' && tag.uri === '')
      channels++;
    const isEntry =
      format === 'ATOM'
        ? stack.length === 2 && tag.local === 'entry' && tag.uri === ATOM
        : stack.length === 3 &&
          parent?.local === 'channel' &&
          parent.uri === '' &&
          tag.local === 'item' &&
          tag.uri === '';
    if (isEntry) {
      seen++;
      if (seen > maxItems) {
        truncated = true;
        if (seen === maxItems + 1) diagnostic('ITEMS_TRUNCATED', null);
        return;
      }
      entry = {
        depth: stack.length,
        fields: {},
        link: null,
        base,
        invalid: false,
        overflow: false,
      };
      return;
    }
    if (!entry || stack.length !== entry.depth + 1) return;
    const native = format === 'ATOM' ? tag.uri === ATOM : tag.uri === '';
    let field: string | null = null;
    if (
      native &&
      ['title', 'description', 'summary', 'guid', 'id', 'pubDate', 'published', 'updated'].includes(
        tag.local,
      )
    )
      field = tag.local;
    if (format === 'RSS' && tag.uri === DC && tag.local === 'date') field = 'dcDate';
    if (native && tag.local === 'link') {
      if (format === 'RSS') field = 'link';
      else if (
        (!tag.attributes.rel || tag.attributes.rel.value === 'alternate') &&
        tag.attributes.href &&
        !entry.link
      ) {
        try {
          entry.link = resolveUrl(tag.attributes.href.value, base);
        } catch {
          entry.invalid = true;
        }
      }
    }
    if (field && entry.fields[field] === undefined) {
      entry.fields[field] = '';
      capture = {
        field,
        depth: stack.length,
        raw: ['guid', 'id', 'link', 'pubDate', 'published', 'updated', 'dcDate'].includes(field),
      };
      if (field === 'link') entry.base = base;
    }
  };
  const append = (part: string) => {
    if (!entry || !capture || stack.at(-1)?.skip) return;
    const current = entry.fields[capture.field];
    const cap = ['description', 'summary'].includes(capture.field) ? 8192 : 4096;
    if (current.length + part.length > cap) {
      if (['description', 'summary'].includes(capture.field)) entry.overflow = true;
      else entry.invalid = true;
    }
    entry.fields[capture.field] = (current + part).slice(0, cap);
  };
  parser.ontext = append;
  parser.oncdata = append;
  parser.onclosetag = () => {
    if (capture && stack.length > capture.depth && !capture.raw) append(' ');
    if (capture && stack.length === capture.depth) capture = null;
    if (entry && stack.length === entry.depth) {
      const current = entry;
      entry = null;
      try {
        if (current.invalid) throw new Error('INVALID_ITEM');
        const f = current.fields;
        let publishedAt: string | null = null,
          updatedAt: string | null = null;
        try {
          const date = f.pubDate ?? f.published ?? f.dcDate;
          if (date?.trim()) publishedAt = normalizedDate(date, source.id);
          else diagnostic('MISSING_DATE', seen - 1);
          if (f.updated?.trim()) updatedAt = normalizedDate(f.updated, source.id);
        } catch {
          diagnostic('INVALID_DATE', seen - 1);
          throw new Error('INVALID_DATE');
        }
        let excerpt = plainText(f.description ?? f.summary ?? '');
        if (excerpt.length > 1000 || current.overflow) {
          diagnostic('EXCERPT_TRUNCATED', seen - 1);
          truncated = true;
          excerpt = excerpt.slice(0, 1000);
        }
        const guid = f.guid ?? f.id;
        items.push(
          validateWatcherFeedItem({
            sourceId: source.id,
            guid: guid?.trim() ? guid : null,
            url: current.link ?? resolveUrl(f.link?.trim() ?? '', current.base),
            title: plainText(f.title ?? ''),
            excerpt: excerpt || null,
            publishedAt,
            updatedAt,
          }),
        );
      } catch {
        rejected++;
        diagnostic('INVALID_ITEM', seen - 1);
      }
    }
    stack.pop();
  };
  try {
    parser.write(xml).close();
    if (!format || (format === 'RSS' && channels !== 1))
      throw new WatcherFeedParseError('UNSUPPORTED_FEED');
  } catch (error) {
    if (error instanceof WatcherFeedParseError) throw error;
    throw new WatcherFeedParseError('INVALID_XML');
  }
  return {
    format: format as 'RSS' | 'ATOM',
    received: seen,
    items,
    diagnostics,
    rejected,
    truncated,
  };
}
