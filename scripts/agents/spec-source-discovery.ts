import type { SpecDiscoveredLink } from '@compra-car/core/agents';
import type { SpecHtmlNode } from './spec-source-html-sections';
import { modelYearHtmlParser } from './model-year-html-parser';
/** Parse inert link metadata only. Never evaluate script, invent routes from node IDs or fetch assets. */
export function extractSpecDiscoveryLinks(body: string, baseUrl: string): SpecDiscoveredLink[] {
  const root = modelYearHtmlParser()(body) as SpecHtmlNode,
    result: SpecDiscoveredLink[] = [];
  const add = (raw: string, label: string, method: SpecDiscoveredLink['method']) => {
    if (/[{}]/u.test(raw)) return;
    if (!raw || raw.startsWith('#') || /\$\{|javascript:|data:|mailto:/iu.test(raw)) return;
    try {
      const url = new URL(raw, baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return;
      if (url.username || url.password) return;
      if (/\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?|mp4)(?:$|[?#])/iu.test(url.href)) return;
      if (!result.some((r) => r.url === url.href))
        result.push({
          url: url.href,
          label: label.replace(/\s+/gu, ' ').trim().slice(0, 300),
          method,
        });
    } catch {
      /* malformed source link */
    }
  };
  for (const node of root.querySelectorAll('a[href], [data-href], [data-link], [data-linkref]')) {
    let label = node.getAttribute('aria-label') ?? node.getAttribute('title') ?? node.textContent;
    // A local manual section can supply the model missing from a year-only link.
    if (/\.pdf(?:$|[?#])/iu.test(node.getAttribute('href') ?? '')) {
      let p = node.parentNode;
      for (let depth = 0; p && depth < 4; depth++, p = p.parentNode) {
        const hs = p.querySelectorAll('h2,h3,h4,h5');
        if (hs.length === 1) {
          label = hs[0]!.textContent + ' — ' + label;
          break;
        }
        if (hs.length > 1) break;
      }
    }
    for (const attr of ['href', 'data-href', 'data-link', 'data-linkref']) {
      const url = node.getAttribute(attr);
      if (url) add(url, label, attr === 'href' ? 'HTML_LINK' : 'HTML_DATA_LINK');
    }
  }
  let remaining = 30000;
  const walk = (value: unknown, label: string, depth: number) => {
    if (depth > 25 || remaining-- <= 0) return;
    if (typeof value === 'string') {
      if (value.length <= 2_000_000 && /^[{[]/u.test(value))
        try {
          walk(JSON.parse(value), label, depth + 1);
        } catch {
          /* not JSON */
        }
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.slice(0, 1000).forEach((v) => walk(v, label, depth + 1));
      return;
    }
    const obj = value as Record<string, unknown>;
    const local =
      ['model', 'carlineName', 'name', 'title', 'label', 'text']
        .flatMap((k) =>
          typeof obj[k] === 'string' && (obj[k] as string).length < 200 ? [obj[k] as string] : [],
        )
        .join(' ') || label;
    for (const [key, v] of Object.entries(obj)) {
      if (
        typeof v === 'string' &&
        /(?:url|href|link|linkref)$/iu.test(key) &&
        /^(?:https?:\/\/|\/)/u.test(v)
      )
        add(v, local, 'EMBEDDED_JSON');
      else walk(v, local, depth + 1);
    }
  };
  for (const node of root.querySelectorAll('script')) {
    const type = node.getAttribute('type') ?? '';
    if (!/json|serialized-states/iu.test(type)) continue;
    try {
      const raw = node.textContent.trim();
      walk(JSON.parse(/^%7[Bb]|^%5[Bb]/u.test(raw) ? decodeURIComponent(raw) : raw), '', 0);
    } catch {
      /* no executable JS fallback */
    }
  }
  return result.slice(0, 2000);
}
