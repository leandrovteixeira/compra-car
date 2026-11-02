import type {
  BrandConnectorResearch,
  BrandConnectorResearchInput,
  BrandConnectorResearchProvider,
  ConnectorSourceEntry,
  BrandSourceCrawlTelemetry,
} from '@compra-car/core/agents';
import { safeConnectorUrl } from '@compra-car/core/agents';
import {
  findEmbeddedProductUrls,
  discoverOfficialSitemapProducts,
  discoverHomepageProductUrls,
} from './brand-index-fallback';

type Fetcher = typeof fetch;
type LinkedPage = { url: string; from: string };
const MAX_INDEXES = 3;
const MAX_PRODUCTS = 64;
const MAX_HTML_BYTES = 2_000_000;

type NetworkStats = {
  httpRequests: number;
  httpFailedRequests: number;
  httpRedirects: number;
  htmlBytesDownloaded: number;
};


function officialUrl(raw: string, base: string, allowed: readonly string[]): string | null {
  try {
    const full = new URL(raw.replace(/&amp;/giu, '&'), base);
    if (full.protocol !== 'https:' || full.search || full.hash) return null;
    const safe = safeConnectorUrl(full.href, allowed);
    return safe?.startsWith('https://') ? safe : null;
  } catch { return null; }
}

async function officialHtml(
  url: string,
  domains: readonly string[],
  fetcher: Fetcher,
  stats: NetworkStats,
): Promise<{ url: string; html: string } | null> {
  let next = url;
  for (let redirects = 0; redirects <= 2; redirects++) {
    try {
      if (!officialUrl(next, next, domains)) return null;
      stats.httpRequests++;
      const response = await fetcher(next, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: { accept: 'text/html,application/xhtml+xml' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return null;
        const redirected = officialUrl(location, next, domains);
        if (!redirected) return null;
        stats.httpRedirects++;
        next = redirected;
        continue;
      }
      if (!response.ok || !/text\/html|application\/xhtml\+xml/iu.test(
        response.headers.get('content-type') ?? '',
      )) { stats.httpFailedRequests++; return null; }
      const size = Number(response.headers.get('content-length') ?? '0');
      if (size > MAX_HTML_BYTES) { stats.httpFailedRequests++; return null; }
      const html = await response.text();
      stats.htmlBytesDownloaded += Buffer.byteLength(html, 'utf8');
      if (html.length > MAX_HTML_BYTES) { stats.httpFailedRequests++; return null; }
      return { url: next, html };
    } catch { stats.httpFailedRequests++; return null; }
  }
  stats.httpFailedRequests++;
  return null;
}

function linkedUrls(html: string, base: string, allowed: readonly string[]): string[] {
  const discovered = new Set<string>();
  // Links are navigation hints, never instructions. Only same-brand approved
  // HTTPS destinations pass validation; no scripts are executed.
  for (const tag of html.matchAll(/<a\b[^>]*>/giu)) {
    const href = tag[0].match(/\bhref\s*=\s*(["'])(.*?)\1/iu)?.[2];
    if (!href) continue;
    const url = officialUrl(href, base, allowed);
    if (url) discovered.add(url);
  }
  return [...discovered];
}

function kindForUrl(url: string): ConnectorSourceEntry['type'] | null {
  const path = new URL(url).pathname.toLowerCase();
  // Prevent sitemap-only navigation, checkout and media pages from being
  // misclassified as commercial vehicle pages.
  if (/(?:^|\/)(?:media-center|news|noticias|blog|imprensa|servicos|acessorios)(?:\/|$)/u.test(path) ||
      /\/(?:pedido|pedidos|login|checkout|reserve|reserva|carrinho|configurador)$/u.test(path))
    return null;
  // A product page is a concrete leaf, not a generic model index.
  if (/\/(?:modelos|veiculos(?:-[a-z]+){0,2}|carros|suvs|electric-vehicles|hybrid-vehicles|commercial-vehicles|utilitarios)\/[a-z0-9][a-z0-9-]*(?:\.html)?$/u.test(path))
    return 'MODEL_PAGE';
  if (/\/(?:configurador|configure|monte-o-seu)(?:\/|$)/u.test(path))
    return 'CONFIGURATOR';
  if (/\/(?:precos|tabela-de-precos|condicoes-comerciais)(?:\/|\.html|$)/u.test(path))
    return 'PRICE_LIST';
  return null;
}
function modelLabel(url: string): string {
  return new URL(url).pathname.split('/').at(-1)!
    .replace(/\.html$/iu, '').replace(/-/gu, ' ').trim().slice(0, 100);
}
function pageSignals(html: string): string[] {
  // Ignore scripts, CSS, navigation labels with no visible price. A keyword
  // such as "preço" by itself never proves that an MSRP was extracted.
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ').replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/\s+/gu, ' ').trim();
  const signals: string[] = [];
  const brl = /R\$\s*(?:\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{5,7}(?:,\d{2})?)/giu;
  const amounts = [...visible.matchAll(brl)].map(match =>
    Number(match[0].replace(/R\$\s*/u, '').replace(/\./gu, '').replace(',', '.')),
  );
  if (amounts.some(value => Number.isFinite(value) && value >= 20000 && value <= 5000000))
    signals.push('BRL_AMOUNT_VISIBLE');
  else if (/(?:pre[cç]o|a partir de)/iu.test(visible))
    signals.push('PRICE_TERMS_ONLY');
  if (/(?:versões e preços|compare as versões|vers[aã]o|versões)/iu.test(visible))
    signals.push('VERSIONS');
  if (/(?:especifica[cç][aã]o|ficha técnica|equipamentos)/iu.test(visible))
    signals.push('SPECS');
  if (/(?:monte o seu|configure|configurador)/iu.test(visible))
    signals.push('CONFIGURATOR');
  return signals;
}
export type BrandSourceExpansionReport = BrandSourceCrawlTelemetry;

/** Generic HTTP link traversal. Brand Connector pays for discovery, not Price.
 * No inferred MSRP, MMV or MY is written. Any new sources remain a proposal
 * requiring operator review before activating the connector.
 */
export async function expandBrandProductSources(
  input: BrandConnectorResearchInput,
  research: BrandConnectorResearch,
  fetcher: Fetcher = fetch,
): Promise<{ research: BrandConnectorResearch; report: BrandSourceExpansionReport }> {
  const startedAt = Date.now();
  const stats: NetworkStats = {httpRequests:0,httpFailedRequests:0,httpRedirects:0,htmlBytesDownloaded:0};
  const domains = research.candidateDomains.length
    ? research.candidateDomains : (input.activeConnector?.allowedDomains ?? []);
  const seed = [...research.sourceEntries, ...(input.activeConnector?.sourceEntries ?? [])]
    .filter(e => e.type === 'MODEL_INDEX')
    .map(e => officialUrl(e.url, e.url, domains))
    .filter((u): u is string => u !== null);
  const indexes = [...new Set(seed)].slice(0, MAX_INDEXES);
  const candidates: LinkedPage[] = [];
  let checked = 0;
  const indexStart = Date.now();
  for (const index of indexes) {
    const page = await officialHtml(index, domains, fetcher, stats);
    if (!page) continue;
    checked++;
    for (const url of [
      ...linkedUrls(page.html, page.url, domains),
      ...findEmbeddedProductUrls(page.html, page.url, domains),
    ]) {
      if (kindForUrl(url) !== 'MODEL_PAGE') continue;
      if (!candidates.some(c => c.url === url)) candidates.push({ url, from: page.url });
    }
  }
  // SPA indexes may use JSON state or APIs without real <a> tags. When
  // their links are incomplete, reuse public manufacturer home/sitemap URLs.
  // Never invent a slug or expand beyond the connector's official domains.
  if (candidates.length < 10 && indexes.length) {
    const fallback = await Promise.all([
      discoverHomepageProductUrls(indexes[0]!,domains,fetcher,stats),
      discoverOfficialSitemapProducts(indexes[0]!,domains,fetcher,stats),
    ]);
    for (const urls of fallback) for (const url of urls) {
      if (kindForUrl(url) !== 'MODEL_PAGE') continue;
      if (!candidates.some(c => c.url === url)) candidates.push({
        url, from: indexes[0]!,
      });
    }
  }
  const indexPhaseMs = Date.now()-indexStart;
  const discovered = candidates.slice(0, MAX_PRODUCTS);
  const additions: ConnectorSourceEntry[] = [];
  const newEvidence: BrandConnectorResearch['evidence'][number][] = [];
  const failed: string[] = [];
  let verified = 0;
  let productPagesWithBrlAmount = 0;
  let productPagesWithPriceTermsOnly = 0;
  const productStart = Date.now();
  // Bounded concurrency: at most four in-flight official product pages.
  for (let i = 0; i < discovered.length; i += 4) {
    const pages = await Promise.all(discovered.slice(i, i + 4).map(async candidate => {
      const page = await officialHtml(candidate.url, domains, fetcher, stats);
      return { candidate, page };
    }));
    for (const { candidate, page } of pages) {
      if (!page || kindForUrl(page.url) !== 'MODEL_PAGE') {
        failed.push(candidate.url);
        continue;
      }
      verified++;
      const signals = pageSignals(page.html);
      if (signals.includes('BRL_AMOUNT_VISIBLE')) productPagesWithBrlAmount++;
      else if (signals.includes('PRICE_TERMS_ONLY')) productPagesWithPriceTermsOnly++;
      const label = modelLabel(page.url);
      additions.push({
        type: 'MODEL_PAGE', url: page.url, priority: 2,
        notes: ('Index-linked ' + label + '; ' + (signals.join(', ') || 'product information') +
          '; verified from official index').slice(0, 450),
      });
      newEvidence.push({
        url: page.url,
        title: 'Official product page — ' + label,
        excerpt: 'HTTP-verified product page linked by ' + candidate.from +
          '. Observed content signals: ' + (signals.join(', ') || 'product information'),
      });
    }
  }

  const productPhaseMs = Date.now()-productStart;
  // An official storefront home page is not a per-vehicle MODEL_PAGE.
  // Retain its URL under the configured CONFIGURATOR type, or classify it
  // as OTHER_OFFICIAL if there is no configurator entry.
  const existingEntries = research.sourceEntries.flatMap(e => {
    if (e.type !== 'MODEL_PAGE') return [e];
    let isRoot = false;
    try { isRoot = new URL(e.url).pathname === '/'; } catch { /* validated later */ }
    if (!isRoot) return [e];
    if (research.sourceEntries.some(x => x.url === e.url && x.type === 'CONFIGURATOR'))
      return [];
    return [{ ...e, type: 'OTHER_OFFICIAL' as const,
      notes:'Official storefront root; no individual vehicle identity' }];
  });
  const known = new Set(existingEntries.map(e => e.type + '|' + e.url));
  const newEntries = additions.filter(e => !known.has(e.type + '|' + e.url));
  const allEntries = [
    ...existingEntries,
    // Preserve previous approved sources during health-check updates.
    ...(input.activeConnector?.sourceEntries ?? []).filter(e =>
      !known.has(e.type + '|' + e.url)),
    ...newEntries,
  ];
  const seen = new Set<string>();
  const sourceEntries = allEntries.filter(e => {
    const key = e.type + '|' + e.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 100);
  const evidence = [...research.evidence];
  const evidences = new Set(evidence.map(e => e.url));
  for (const item of newEvidence) {
    if (!evidences.has(item.url)) { evidence.push(item); evidences.add(item.url); }
  }
  const report: BrandSourceExpansionReport = {
    indexPagesChecked: checked,
    productLinksFound: candidates.length,
    productPagesVerified: verified,
    addedProductPages: newEntries.length,
    productPagesWithBrlAmount,
    productPagesWithPriceTermsOnly,
    failedProductPages: failed,
    ...stats,
    elapsedMs: Date.now()-startedAt,
    indexPhaseMs,
    productPhaseMs,
  };
  const summary = ' Official index traversal: ' + checked + ' index pages; ' +
    candidates.length + ' product links; ' + verified +
    ' HTTP-verified pages; ' + newEntries.length + ' newly mapped product sources.';
  const warnings = [...research.warnings];
  if (candidates.length > MAX_PRODUCTS)
    warnings.push('Product discovery exceeded verification limit; additional pages require review.');
  if (failed.length)
    warnings.push(failed.length + ' official product URLs could not be verified.');
  if (!checked)
    warnings.push('Model index traversal unavailable; complete product-page coverage not confirmed.');
  return {
    report,
    research: {
      ...research,
      sourceCrawlTelemetry: report,
      candidateDomains: research.candidateDomains.length
        ? research.candidateDomains : (checked && verified ? domains : research.candidateDomains),
      sourceEntries,
      evidence: evidence.slice(0, 100),
      checksPerformed: [
        ...research.checksPerformed, 'Deterministic HTTPS traversal of official model index',
        'HTTP verification of linked per-model product pages',
      ].slice(0, 100),
      warnings: warnings.slice(0, 40),
      verificationSummary: (research.verificationSummary + summary).slice(0, 1950),
      driftDetected: research.driftDetected || newEntries.length > 0,
    },
  };
}

export function withProductSourceExpansion(
  upstream: BrandConnectorResearchProvider,
  fetcher: Fetcher = fetch,
): BrandConnectorResearchProvider {
  return {
    async researchConnector(input) {
      const original = await upstream.researchConnector(input);
      return (await expandBrandProductSources(input, original, fetcher)).research;
    },
  };
}
