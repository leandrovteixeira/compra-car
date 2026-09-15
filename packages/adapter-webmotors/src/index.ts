import type {
  ModelYearGroup,
  ModelYearMode,
  StructuredModelYearProvider,
  StructuredModelYearRow,
  ModelYearRejectionCode,
} from '@compra-car/core/agents';
export interface HtmlNode {
  readonly textContent: string;
  getAttribute(name: string): string | undefined;
  querySelectorAll(selector: string): HtmlNode[];
}
export type HtmlParser = (html: string) => HtmlNode;
export type DocumentTransport = (url: string) => Promise<{ url: string; html: string }>;
const host = 'www.webmotors.com.br';
export function allowedWebmotorsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === 'https:' &&
      u.hostname === host &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.search &&
      !u.hash &&
      /^\/tabela-fipe\/carros\/[a-z0-9-]+\/[a-z0-9-]+(?:\/\d{4})?\/?$/u.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export class StructuredSourceUnavailable extends Error {
  constructor() {
    super('STRUCTURED_SOURCE_UNAVAILABLE');
  }
}
/** Ordinary GET, no retries/sessions/browser evasion. Fixed public host, manual redirects and streaming byte bound. */
export function webmotorsDocumentTransport(
  options: {
    fetch?: typeof fetch;
    timeoutMs?: number;
    maxBytes?: number;
    paceMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): DocumentTransport {
  const fetcher = options.fetch ?? fetch;
  const timeout = Math.max(1, Math.min(options.timeoutMs ?? 10000, 15000)),
    maxBytes = Math.max(1, Math.min(options.maxBytes ?? 2000000, 4000000));
  let last = 0;
  return async (raw) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      if (!allowedWebmotorsUrl(raw)) throw new StructuredSourceUnavailable();
      const delay = Math.max(0, Math.max(250, options.paceMs ?? 500) - (Date.now() - last));
      if (delay) await (options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(delay);
      last = Date.now();
      let current = raw;
      for (let redirects = 0; redirects <= 2; redirects++) {
        const res = await fetcher(current, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { Accept: 'text/html' },
        });
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get('location');
          await res.body?.cancel();
          if (!location || redirects === 2) throw new StructuredSourceUnavailable();
          const next = new URL(location, current).href;
          if (
            !allowedWebmotorsUrl(next) ||
            new URL(next).pathname.replace(/\/$/u, '') !== new URL(raw).pathname.replace(/\/$/u, '')
          )
            throw new StructuredSourceUnavailable();
          current = next;
          continue;
        }
        if (
          !res.ok ||
          (res.url &&
            (!allowedWebmotorsUrl(res.url) ||
              new URL(res.url).pathname !== new URL(current).pathname)) ||
          !/text\/html/iu.test(res.headers.get('content-type') ?? '') ||
          Number(res.headers.get('content-length') ?? 0) > maxBytes
        ) {
          await res.body?.cancel();
          throw new StructuredSourceUnavailable();
        }
        const reader = res.body?.getReader();
        if (!reader) throw new StructuredSourceUnavailable();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > maxBytes) throw new StructuredSourceUnavailable();
            chunks.push(part.value);
          }
        } finally {
          await reader.cancel();
        }
        const html = Buffer.concat(chunks).toString('utf8');
        if (/captcha|access denied|verify you are human/iu.test(html))
          throw new StructuredSourceUnavailable();
        return { url: current, html };
      }
      throw new StructuredSourceUnavailable();
    } catch {
      throw new StructuredSourceUnavailable();
    } finally {
      clearTimeout(timer);
    }
  };
}
const plain = (n: HtmlNode) => n.textContent.replace(/\s+/gu, ' ').trim();
const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
export function parseWebmotorsYears(html: string, url: string, parse: HtmlParser): number[] {
  if (!allowedWebmotorsUrl(url) || html.length > 4000000) return [];
  const root = new URL(url).pathname.replace(/\/$/u, '');
  const years = new Set<number>();
  for (const node of parse(html).querySelectorAll('a[href]')) {
    try {
      const link = new URL(node.getAttribute('href') ?? '', url);
      const suffix = link.pathname.slice(root.length + 1);
      if (
        link.hostname === host &&
        link.pathname.startsWith(root + '/') &&
        /^\d{4}\/?$/u.test(suffix) &&
        (plain(node) === suffix.replace('/', '') ||
          node
            .querySelectorAll('h3[data-testid="card-title"]')
            .some((title) => plain(title) === suffix.replace('/', '')))
      )
        years.add(Number(suffix.replace('/', '')));
    } catch {
      /* Invalid link is data, never a fetch target. */
    }
  }
  return [...years].sort((a, b) => b - a);
}
export function parseWebmotorsRows(
  html: string,
  url: string,
  group: ModelYearGroup,
  year: number,
  parse: HtmlParser,
): StructuredModelYearRow[] {
  if (
    !allowedWebmotorsUrl(url) ||
    html.length > 4000000 ||
    !new URL(url).pathname.endsWith('/' + year)
  )
    return [];
  const document = parse(html);
  if (
    !document
      .querySelectorAll('h1, h2')
      .some(
        (n) =>
          slug(plain(n)).includes(slug(group.model)) &&
          new RegExp('\\b' + year + '\\b', 'u').test(plain(n)),
      )
  )
    return [];
  const rows: StructuredModelYearRow[] = [];
  for (const table of document.querySelectorAll('table')) {
    const header = table.querySelectorAll('tr')[0];
    if (!header) continue;
    const headings = header.querySelectorAll('th, td').map((n) => slug(plain(n)));
    const versionIndex = headings.indexOf('versao'),
      codeIndex = headings.indexOf('codigo-fipe');
    if (versionIndex < 0 || codeIndex < 0) continue;
    for (const tr of table.querySelectorAll('tr').slice(1)) {
      const cells = tr.querySelectorAll('td');
      const versionLabel = cells[versionIndex] ? plain(cells[versionIndex]!) : '';
      if (!versionLabel || versionLabel.length > 500) continue;
      rows.push({
        brand: group.brand,
        model: group.model,
        modelYear: year,
        versionLabel,
        fipeCode: cells[codeIndex] ? plain(cells[codeIndex]!) : null,
        sourceKind: 'WEBMOTORS_FIPE',
        sourceUrl: url,
      });
      if (rows.length >= 200) return rows;
    }
  }
  return rows;
}
export function selectStructuredYears(
  years: readonly number[],
  group: ModelYearGroup,
  mode: ModelYearMode,
  window = 3,
): number[] {
  const limit = Math.max(1, Math.min(5, Math.floor(window)));
  const sorted = [...new Set(years)].sort((a, b) => b - a);
  if (mode === 'BASELINE') return sorted.slice(0, limit);
  const highest = Math.max(0, ...group.targets.flatMap((t) => t.knownModelYears));
  return sorted.filter((y) => y >= highest).slice(0, 2);
}
export class WebmotorsModelYearProvider implements StructuredModelYearProvider {
  private cache = new Map<string, Promise<{ url: string; html: string }>>();
  constructor(
    private readonly options: {
      transport: DocumentTransport;
      parse: HtmlParser;
      baselineWindow?: number;
      brandSlugs?: Readonly<Record<string, string>>;
    },
  ) {}
  beginRun() {
    this.cache = new Map();
  }
  async discover(group: ModelYearGroup, mode: ModelYearMode) {
    // Provider routing configuration, never an identity matcher alias.
    const brand = this.options.brandSlugs?.[group.brand] ?? slug(group.brand);
    const root = 'https://' + host + '/tabela-fipe/carros/' + brand + '/' + slug(group.model);
    const metrics = {
      structuredModelFetches: 0,
      structuredYearFetches: 0,
      structuredRowsParsed: 0,
    };
    const issues: {
        reasonCode: ModelYearRejectionCode;
        sourceUrl: string | null;
        modelYear: number | null;
      }[] = [],
      rows: StructuredModelYearRow[] = [];
    const get = (url: string, kind: 'structuredModelFetches' | 'structuredYearFetches') => {
      if (!allowedWebmotorsUrl(url)) throw new StructuredSourceUnavailable();
      let request = this.cache.get(url);
      if (!request) {
        metrics[kind]++;
        request = this.options.transport(url);
        this.cache.set(url, request);
      }
      return request;
    };
    let years: number[];
    try {
      const doc = await get(root, 'structuredModelFetches');
      if (doc.url !== root) throw new StructuredSourceUnavailable();
      years = parseWebmotorsYears(doc.html, doc.url, this.options.parse);
      if (!years.length) throw new StructuredSourceUnavailable();
    } catch {
      issues.push({
        reasonCode: 'STRUCTURED_SOURCE_UNAVAILABLE',
        sourceUrl: allowedWebmotorsUrl(root) ? root : null,
        modelYear: null,
      });
      return { rows, issues, metrics };
    }
    for (const year of selectStructuredYears(years, group, mode, this.options.baselineWindow)) {
      const url = root + '/' + year;
      try {
        const doc = await get(url, 'structuredYearFetches');
        if (doc.url !== url) throw new StructuredSourceUnavailable();
        const parsed = parseWebmotorsRows(doc.html, doc.url, group, year, this.options.parse);
        if (!parsed.length)
          issues.push({
            reasonCode: 'STRUCTURED_YEAR_PAGE_INVALID',
            sourceUrl: url,
            modelYear: year,
          });
        rows.push(...parsed);
        metrics.structuredRowsParsed += parsed.length;
      } catch {
        issues.push({
          reasonCode: 'STRUCTURED_SOURCE_UNAVAILABLE',
          sourceUrl: url,
          modelYear: year,
        });
      }
    }
    return { rows, issues, metrics };
  }
}
