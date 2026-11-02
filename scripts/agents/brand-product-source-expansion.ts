import type {
  BrandConnectorResearch,
  BrandConnectorResearchInput,
  BrandConnectorResearchProvider,
  ConnectorSourceEntry,
} from '@compra-car/core/agents';
import { safeConnectorUrl } from '@compra-car/core/agents';

type Fetcher = typeof fetch;
type LinkedPage = { url: string; from: string };
const MAX_INDEXES = 3;
const MAX_PRODUCTS = 24;
const MAX_HTML_BYTES = 2_000_000;

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
): Promise<{ url: string; html: string } | null> {
  let next = url;
  for (let redirects = 0; redirects <= 2; redirects++) {
    try {
      if (!officialUrl(next, next, domains)) return null;
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
        next = redirected;
        continue;
      }
      if (!response.ok || !/text\/html|application\/xhtml\+xml/iu.test(
        response.headers.get('content-type') ?? '',
      )) return null;
      const size = Number(response.headers.get('content-length') ?? '0');
      if (size > MAX_HTML_BYTES) return null;
      const html = await response.text();
      if (html.length > MAX_HTML_BYTES) return null;
      return { url: next, html };
    } catch { return null; }
  }
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
  // A product page is a concrete leaf, not a generic model index.
  if (/\/(?:modelos|veiculos-de-passeio|veiculos|carros|suvs)\/[a-z0-9][a-z0-9-]*(?:\.html)?$/u.test(path))
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
  const signals: string[] = [];
  if (/(?:R\$\s*\d|pre[cç]o|a partir de)/iu.test(html)) signals.push('PRICE');
  if (/(?:versões e preços|compare as versões|vers[aã]o|versões)/iu.test(html))
    signals.push('VERSIONS');
  if (/(?:especifica[cç][aã]o|ficha técnica|equipamentos)/iu.test(html))
    signals.push('SPECS');
  if (/(?:monte o seu|configure|configurador)/iu.test(html))
    signals.push('CONFIGURATOR');
  return signals;
}
export type BrandSourceExpansionReport = Readonly<{
  indexPagesChecked: number;
  productLinksFound: number;
  productPagesVerified: number;
  addedProductPages: number;
  failedProductPages: readonly string[];
}>;

/** Generic HTTP link traversal. Brand Connector pays for discovery, not Price.
 * No inferred MSRP, MMV or MY is written. Any new sources remain a proposal
 * requiring operator review before activating the connector.
 */
export async function expandBrandProductSources(
  input: BrandConnectorResearchInput,
  research: BrandConnectorResearch,
  fetcher: Fetcher = fetch,
): Promise<{ research: BrandConnectorResearch; report: BrandSourceExpansionReport }> {
  const domains = research.candidateDomains.length
    ? research.candidateDomains : (input.activeConnector?.allowedDomains ?? []);
  const seed = [...research.sourceEntries, ...(input.activeConnector?.sourceEntries ?? [])]
    .filter(e => e.type === 'MODEL_INDEX')
    .map(e => officialUrl(e.url, e.url, domains))
    .filter((u): u is string => u !== null);
  const indexes = [...new Set(seed)].slice(0, MAX_INDEXES);
  const candidates: LinkedPage[] = [];
  let checked = 0;
  for (const index of indexes) {
    const page = await officialHtml(index, domains, fetcher);
    if (!page) continue;
    checked++;
    for (const url of linkedUrls(page.html, page.url, domains)) {
      if (kindForUrl(url) !== 'MODEL_PAGE') continue;
      if (!candidates.some(c => c.url === url)) candidates.push({ url, from: page.url });
    }
  }
  const discovered = candidates.slice(0, MAX_PRODUCTS);
  const additions: ConnectorSourceEntry[] = [];
  const newEvidence: BrandConnectorResearch['evidence'][number][] = [];
  const failed: string[] = [];
  let verified = 0;
  // Bounded concurrency: at most four in-flight official product pages.
  for (let i = 0; i < discovered.length; i += 4) {
    const pages = await Promise.all(discovered.slice(i, i + 4).map(async candidate => {
      const page = await officialHtml(candidate.url, domains, fetcher);
      return { candidate, page };
    }));
    for (const { candidate, page } of pages) {
      if (!page) { failed.push(candidate.url); continue; }
      verified++;
      const signals = pageSignals(page.html);
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
    failedProductPages: failed,
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
