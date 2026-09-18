import type {
  SourceApplicabilityContext,
  SourceSnapshot,
  SpecSourceTarget,
  SourceScope,
} from '@compra-car/core/agents';
import { specText } from '@compra-car/core/agents';
import type { SpecHtmlNode } from './spec-source-html-sections';
export function pageApplicabilityContext(
  root: SpecHtmlNode,
  snapshot: SourceSnapshot,
  target?: SpecSourceTarget,
): SourceApplicabilityContext {
  const evidence: SourceApplicabilityContext['evidence'][number][] = [];
  if (!target)
    return {
      brandBinding: 'UNRESOLVED',
      modelBinding: 'UNRESOLVED',
      model: null,
      versionBinding: 'UNRESOLVED',
      yearBinding: 'UNRESOLVED',
      evidence,
    };
  const match = (v: string) =>
    (' ' + specText(v).replace(/[^a-z0-9]+/gu, ' ') + ' ').includes(
      ' ' + specText(target.model).replace(/[^a-z0-9]+/gu, ' ') + ' ',
    );
  const add = (value: string, locator: string) =>
    evidence.push({
      sourceUrl: snapshot.finalUrl,
      sourceKind: snapshot.sourceKind,
      contentHash: snapshot.contentHash,
      evidenceText: value,
      locator,
    });
  const final = new URL(snapshot.finalUrl),
    slug = specText(target.model).replace(/\s+/gu, '-');
  const pagePath = decodeURIComponent(final.pathname).toLowerCase().split('/').filter(Boolean);
  const urlModel =
    pagePath.some((p) => p.replace(/\.(html|app)$/u, '') === slug) &&
    !/acessorios|accessories|manual|literatura|literature|dealer|news/iu.test(final.pathname);
  if (urlModel) add(snapshot.finalUrl, 'page/final-url');
  const modelNodes = root.querySelectorAll('[data-model]');
  const uniqueModels = new Set(modelNodes.map((n) => specText(n.getAttribute('data-model') ?? '')));
  const primaryNodes = [
    ...root.querySelectorAll('h1,title,meta[property="og:title"],meta[name="title"]'),
    ...(uniqueModels.size === 1 ? modelNodes : []),
  ];
  for (const h of primaryNodes) {
    const raw = h.getAttribute('content') ?? h.getAttribute('data-model') ?? h.textContent;
    if (raw.length <= 300 && match(raw)) add(raw, 'page/' + h.tagName.toLowerCase());
  }
  const canonical = root.querySelectorAll('link[rel="canonical"]')[0]?.getAttribute('href');
  if (canonical) {
    try {
      const u = new URL(canonical, snapshot.finalUrl);
      if (u.origin === final.origin && u.pathname === final.pathname && urlModel)
        add(u.href, 'page/canonical');
    } catch {
      /* invalid metadata */
    }
  }
  const bound = evidence.length > 0;
  const current = root
    .querySelectorAll('h1,h2,title')
    .some((h) => /linha atual|current lineup/iu.test(h.textContent));
  return {
    brandBinding: 'OFFICIAL_SOURCE',
    modelBinding: bound ? 'EXACT_MODEL' : 'UNRESOLVED',
    model: bound ? target.model : null,
    versionBinding: bound ? 'MODEL_SHARED' : 'UNRESOLVED',
    yearBinding: current ? 'CURRENT_LINEUP' : 'UNRESOLVED',
    evidence,
  };
}
export function inheritPageScope(
  scope: SourceScope,
  context: SourceApplicabilityContext,
): SourceScope {
  if (scope.model && context.model && specText(scope.model) !== specText(context.model))
    return scope;
  if (!context.model) return scope;
  return {
    ...scope,
    model: scope.model ?? context.model,
    // Engine-specific groups are not all-model statements even on a model page.
    shared: scope.shared || (!scope.version && !scope.engineDesignation),
    currentLineup: scope.currentLineup || context.yearBinding === 'CURRENT_LINEUP',
    applicabilityEvidence: [...(scope.applicabilityEvidence ?? []), ...context.evidence],
  };
}
