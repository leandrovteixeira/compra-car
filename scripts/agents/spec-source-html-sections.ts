import { publishedSourceVersion } from '@compra-car/core/agents';
import type {
  SourceFact,
  SourceScope,
  SourceSection,
  SpecSourceTarget,
} from '@compra-car/core/agents';
import { specText } from '@compra-car/core/agents';
import { proseFacts, blankSpecScope } from './spec-source-prose';
export interface SpecHtmlNode {
  textContent: string;
  tagName: string;
  rawAttrs: string;
  parentNode: SpecHtmlNode | null;
  childNodes: SpecHtmlNode[];
  getAttribute(name: string): string | undefined;
  querySelectorAll(selector: string): SpecHtmlNode[];
}
const split = (value: string) => {
  const m = /^([-+]?\d+(?:[.,]\d+)?)\s*(cm³|cm3|mm|cm|m|L|litros?|cv|kW|Nm|kgfm|kg|km\/h)$/iu.exec(
    value,
  );
  return m ? { value: m[1]!, unit: m[2]! } : { value, unit: null };
};
const clean = (s: string) => s.replace(/\s+/gu, ' ').trim();
const headings = (n: SpecHtmlNode) => n.querySelectorAll('h1,h2,h3,h4,h5,h6');
const ownHeading = (n: SpecHtmlNode) => clean(headings(n)[0]?.textContent ?? '');
const isCard = (n: SpecHtmlNode) =>
  /(?:^|[-_\s])(card|cartile|version|trim)(?:$|[-_\s])/iu.test(
    [n.getAttribute('class'), n.getAttribute('data-testid'), n.getAttribute('data-component')].join(
      ' ',
    ),
  );
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
/** Explicit carline -> trim -> engine containers, no recursive merging of sibling versions. */
export function manufacturerCards(root: SpecHtmlNode): SourceFact[] {
  const facts: SourceFact[] = [];
  let budget = 30000;
  const walk = (value: unknown, model: string | null, locator: string, depth: number) => {
    if (--budget < 0 || depth > 25) return;
    if (typeof value === 'string' && /^[{[]/u.test(value)) {
      try {
        walk(JSON.parse(value), model, locator + '/decoded', depth + 1);
      } catch {
        /* inert invalid JSON */
      }
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 1000).forEach((v, i) => walk(v, model, locator + '/' + i, depth + 1));
      return;
    }
    const o = object(value),
      data = object(o.data);
    const localModel = o.type === 'carline' && typeof data.name === 'string' ? data.name : model;
    if (
      o.type === 'trim' &&
      localModel &&
      typeof data.name === 'string' &&
      Array.isArray(data.engines)
    ) {
      data.engines.slice(0, 30).forEach((v, ei) => {
        const e = object(v),
          key = object(e.key);
        const year = Number(key.modelYear);
        const scope: SourceScope = {
          ...blankSpecScope(),
          model: localModel,
          version: data.name as string,
          modelYear: Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null,
          ...(typeof key.modelId === 'string' ? { configurationId: key.modelId } : {}),
          evidenceText: JSON.stringify({
            model: localModel,
            version: data.name,
            modelYear: key.modelYear,
            configurationId: key.modelId,
          }),
        };
        for (const name of ['engineTypes', 'gearTypes']) {
          if (!Array.isArray(e[name])) continue;
          for (const v of e[name] as unknown[])
            if (typeof v === 'string')
              facts.push({
                label: name,
                value: v,
                unit: null,
                text: JSON.stringify({ [name]: v }),
                scope,
                locator: locator + '/data/engines/' + ei + '/' + name,
                method: 'VERSION_CARD',
              });
        }
        if (typeof e.modelName === 'string')
          facts.push(
            ...proseFacts(
              {
                text: e.modelName,
                scope,
                locator: locator + '/data/engines/' + ei + '/modelName',
              },
              '',
              'VERSION_CARD',
            ),
          );
      });
    }
    for (const [key, v] of Object.entries(o))
      if (typeof v === 'object' || (typeof v === 'string' && /^[{[]/u.test(v)))
        walk(v, localModel, locator + '/' + key, depth + 1);
  };
  root.querySelectorAll('script').forEach((s, i) => {
    if (!/json|serialized-states/iu.test(s.getAttribute('type') ?? '')) return;
    try {
      const raw = s.textContent.trim();
      walk(
        JSON.parse(/^%7b|^%5b/iu.test(raw) ? decodeURIComponent(raw) : raw),
        null,
        'state/' + i,
        0,
      );
    } catch {
      /* no JS execution */
    }
  });
  return facts;
}
export function extendedHtmlSections(
  root: SpecHtmlNode,
  target: SpecSourceTarget | undefined,
  scopeOf: (n: SpecHtmlNode) => SourceScope,
) {
  const facts: SourceFact[] = manufacturerCards(root),
    sections: SourceSection[] = [];
  const pageHeading = clean(root.querySelectorAll('h1')[0]?.textContent ?? '');
  const pageModel =
    target &&
    (
      ' ' +
      specText(pageHeading)
        .split(/[^a-z0-9]+/u)
        .join(' ') +
      ' '
    ).includes(' ' + specText(target.model) + ' ')
      ? target.model
      : null;
  const resolveScope = (node: SpecHtmlNode): SourceScope => {
    let scope = scopeOf(node);
    if (!scope.model && pageModel)
      scope = { ...scope, model: pageModel, evidenceText: pageHeading };
    if (target)
      for (let n: SpecHtmlNode | null = node; n; n = n.parentNode) {
        if (!['SECTION', 'ARTICLE'].includes(n.tagName) || n.textContent.length > 12000) continue;
        const version = publishedSourceVersion(n.textContent, target.model);
        if (version) {
          scope = { ...scope, model: scope.model ?? target.model, version, shared: false };
          break;
        }
      }
    // Closest card is the boundary, even when it is the wrong requested version.
    for (let p: SpecHtmlNode | null = node; p; p = p.parentNode) {
      if (!isCard(p)) continue;
      const heading =
        p.getAttribute('data-version') ?? p.getAttribute('aria-label') ?? ownHeading(p);
      if (
        !p.getAttribute('data-version') &&
        !/version|trim|cartile/iu.test(
          [p.getAttribute('class'), p.getAttribute('data-testid')].join(' '),
        ) &&
        !/\d{2,4}\s*[A-Z]{2,4}/u.test(heading)
      )
        continue;
      if (heading && heading.length <= 120 && !/versões|versions|modelos|models/iu.test(heading)) {
        const matches = facts.filter(
          (f) =>
            f.scope.version &&
            specText(f.scope.version) === specText(heading) &&
            (!scope.model || specText(f.scope.model ?? '') === specText(scope.model)),
        );
        const models = [...new Set(matches.map((f) => f.scope.model))];
        const years = [...new Set(matches.map((f) => f.scope.modelYear))];
        scope = {
          ...scope,
          model: scope.model ?? (models.length === 1 ? models[0]! : null),
          version: heading,
          shared: false,
          modelYear: years.length === 1 ? years[0]! : scope.modelYear,
          evidenceText: [
            scope.evidenceText,
            heading,
            years.length === 1 && years[0] !== null ? String(years[0]) : '',
          ]
            .filter(Boolean)
            .join(' | '),
        };
      }
      break;
    }
    if (!scope.version)
      for (let p: SpecHtmlNode | null = node; p; p = p.parentNode) {
        if (!['SECTION', 'ARTICLE'].includes(p.tagName)) continue;
        const hs = p.childNodes.filter((c) => /^H[1-6]$/u.test(c.tagName));
        const label = hs.length === 1 ? clean(hs[0]!.textContent) : '';
        if (
          label &&
          /\d{2,4}\s+[A-Z]{2,}|\bT\d{3}\b/u.test(label) &&
          !/^(motor|engine|dados|potência|torque)/iu.test(label)
        ) {
          scope = {
            ...scope,
            version: label,
            shared: false,
            evidenceText: [scope.evidenceText, label].filter(Boolean).join(' | '),
          };
          break;
        }
      }
    return scope;
  };
  // Extract each leaf paragraph/list item independently; never flatten a model page or card matrix.
  root.querySelectorAll('p,li').forEach((node, i) => {
    if (node.querySelectorAll('p,li').length) return;
    if (node.querySelectorAll('script,style').length) return;
    const content = clean(node.textContent);
    if (content.length < 5 || content.length > 1000) return;
    let heading = '';
    for (let p = node.parentNode; p; p = p.parentNode) {
      const hs = p.childNodes.filter((c) => /^H[1-6]$/u.test(c.tagName));
      if (hs.length === 1) {
        heading = clean(hs[0]!.textContent);
        break;
      }
      const nested = headings(p);
      if (nested.length === 1 && clean(p.textContent).length < 1500) {
        heading = clean(nested[0]!.textContent);
        break;
      }
      if (p.tagName === 'BODY') break;
    }
    const section = {
      text: heading && !content.startsWith(heading) ? heading + ' — ' + content : content,
      locator: 'prose/' + i,
      scope: resolveScope(node),
    };
    if (section.text.length > 1000) return;
    const extracted = proseFacts(section, heading);
    facts.push(...extracted);
    if (
      extracted.length ||
      /motor|transmiss|potência|torque|dimens|capacidad|técnic/iu.test(section.text)
    )
      sections.push(section);
  });
  root.querySelectorAll('h2,h3,h4').forEach((h, i) => {
    const parent = h.parentNode;
    if (
      !parent ||
      headings(parent).length !== 1 ||
      parent.querySelectorAll('dl,table,article,li').length
    )
      return;
    const heading = clean(h.textContent),
      content = clean(parent.textContent);
    if (
      !/motor|potência|torque|dimens|capacidad|técnic|transmiss/iu.test(heading) ||
      content.length > 1000 ||
      content === heading
    )
      return;
    if (parent.querySelectorAll('p').length) return; // Paragraph adapter already preserves these boundaries.
    const section = { text: content, locator: 'heading-section/' + i, scope: resolveScope(h) };
    facts.push(...proseFacts(section, heading));
    sections.push(section);
  });
  root.querySelectorAll('dl').forEach((dl, di) => {
    const children = dl.childNodes.filter((n) => ['DT', 'DD'].includes(n.tagName));
    children.forEach((dt, i) => {
      const dd = children[i + 1];
      if (dt.tagName !== 'DT' || dd?.tagName !== 'DD') return;
      const label = clean(dt.textContent),
        value = clean(dd.textContent);
      const scope = resolveScope(dl);
      if (label && value && value.length <= 500)
        facts.push({
          label,
          ...split(value),
          text: label + ': ' + value,
          scope,
          locator: 'extended-dl/' + di + '/' + i,
          method: 'DOM_PAIR',
        });
    });
  });
  // Cards with two direct label/value children, not arbitrary whole-container text.
  root.querySelectorAll('[class]').forEach((node, i) => {
    if (
      !/(?:^|[-_\s])(attribute|feature|spec|detail|card)(?:$|[-_\s])/iu.test(
        node.getAttribute('class') ?? '',
      )
    )
      return;
    const children = node.childNodes.filter((n) => !!n.tagName);
    if (children.length !== 2 || node.querySelectorAll('dl,table,article,section,li').length)
      return;
    const label = clean(children[0]!.textContent),
      value = clean(children[1]!.textContent);
    if (
      !label ||
      label.length > 100 ||
      !value ||
      value.length > 150 ||
      !/\d|automát|manual|flex|gasolina|diesel|disponível/iu.test(value)
    )
      return;
    const scope = resolveScope(node);
    facts.push({
      label,
      ...split(value),
      text: label + ': ' + value,
      scope,
      locator: 'card-pair/' + i,
      method: 'VERSION_CARD',
    });
  });
  return { facts, sections };
}
