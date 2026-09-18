import type {
  SourceFact,
  SpecSourceTarget,
  SourceScope,
  SourceSection,
  SourceSnapshot,
  SpecSourceDocument,
  SpecSourceFormatAdapter,
} from '@compra-car/core/agents';
import { pageApplicabilityContext, inheritPageScope } from './spec-source-page-context';
import { extendedHtmlSections } from './spec-source-html-sections';
import { specText } from '@compra-car/core/agents';
import { modelYearHtmlParser } from './model-year-html-parser';
interface Node {
  textContent: string;
  rawAttrs: string;
  tagName: string;
  parentNode: Node | null;
  childNodes: Node[];
  getAttribute(name: string): string | undefined;
  querySelectorAll(selector: string): Node[];
}
const clean = (value: string) => value.replace(/\s+/gu, ' ').trim();
const emptyScope = (): SourceScope => ({
  model: null,
  version: null,
  modelYear: null,
  shared: false,
  matrix: false,
  currentLineup: false,
});
const direct = (node: Node, tags: readonly string[]) =>
  node.childNodes.filter((c) => tags.includes(c.tagName));
const text = (node: Node | undefined) => (node ? clean(node.textContent) : '');
/** Explicit source attributes/labelled headings only; never inject target names into source scope. */
function scopeOf(node: Node): SourceScope {
  const chain: Node[] = [];
  for (let p: Node | null = node; p; p = p.parentNode) chain.unshift(p);
  let scope = emptyScope();
  for (const part of chain) {
    const heading = direct(part, ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'CAPTION'])
      .map(text)
      .join(' | ');
    const model =
      part.getAttribute?.('data-model') ??
      /(?:^|\|\s*)Modelo:\s*([^|]+)/iu.exec(heading)?.[1]?.trim();
    const version =
      part.getAttribute?.('data-version') ??
      /(?:^|\|\s*)Versão:\s*([^|]+)/iu.exec(heading)?.[1]?.trim();
    const year =
      part.getAttribute?.('data-model-year') ??
      /(?:MY|ano.modelo):?\s*(\d{4})/iu.exec(heading)?.[1];
    if (model && scope.model && specText(model) !== specText(scope.model)) scope = emptyScope();
    if (
      ['SECTION', 'ARTICLE'].includes(part.tagName) &&
      heading &&
      !model &&
      !version &&
      !year &&
      !/todas as versões/iu.test(heading)
    )
      scope = {
        ...scope,
        version:
          scope.version &&
          !/motor|técnic|potência|torque|transmiss|dimens|capacidad|equipamento/iu.test(heading)
            ? heading
            : scope.version,
        shared: false,
      };
    if (version) scope = { ...scope, version, shared: false };
    scope = {
      ...scope,
      ...(part.rawAttrs && (model || version || year)
        ? { evidenceText: part.rawAttrs.slice(0, 1000) }
        : {}),
      ...(part.getAttribute?.('data-configuration-id')
        ? { configurationId: part.getAttribute('data-configuration-id')! }
        : {}),
      ...(part.getAttribute?.('data-engine')
        ? { engineDesignation: part.getAttribute('data-engine')! }
        : {}),
      ...(part.getAttribute?.('data-fuel') ? { fuel: part.getAttribute('data-fuel')! } : {}),
      ...(part.getAttribute?.('data-transmission')
        ? { transmission: part.getAttribute('data-transmission')! }
        : {}),
      ...(part.getAttribute?.('data-component') === 'POWERTRAIN'
        ? { component: 'POWERTRAIN' as const }
        : {}),
      model: model ?? scope.model,
      modelYear: year && /^\d{4}$/u.test(year) ? Number(year) : scope.modelYear,
      shared: scope.shared || /todas as versões/iu.test(heading),
      currentLineup: scope.currentLineup || /linha atual/iu.test(heading),
    };
  }
  return scope;
}
function splitUnit(value: string): { value: string; unit: string | null } {
  const match =
    /^([-+]?\d+(?:[.,]\d+)?)\s*(cm³|cm3|mm|cm|m|L|litros?|cv|kW|Nm|kgfm|kg|km\/h)$/iu.exec(value);
  return match ? { value: match[1]!, unit: match[2]! } : { value, unit: null };
}
const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
export class OfficialSpecDocuments implements SpecSourceFormatAdapter {
  parse(body: string, snapshot: SourceSnapshot, target?: SpecSourceTarget): SpecSourceDocument {
    const facts: SourceFact[] = [],
      sections: SourceSection[] = [],
      links: string[] = [],
      issues: string[] = [];
    if (snapshot.contentType === 'application/pdf')
      return { snapshot, facts, sections, links, issues: ['PDF_UNSUPPORTED'] };
    const json = (raw: string, locator: string) => {
      try {
        const parsed: unknown = JSON.parse(raw);
        const base = asObject(parsed);
        const objects = Array.isArray(parsed)
          ? parsed
          : Array.isArray(base['@graph'])
            ? base['@graph']
            : [parsed];
        objects.slice(0, 100).forEach((value, index) => {
          const item = asObject(value);
          if (!['Vehicle', 'Car', 'Product'].includes(String(item['@type']))) return;
          const model = asString(item.model),
            version = asString(item.vehicleConfiguration);
          const year = Number(item.vehicleModelDate);
          const scope: SourceScope = {
            ...emptyScope(),
            model,
            version,
            modelYear: Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null,
          };
          const properties = Array.isArray(item.additionalProperty) ? item.additionalProperty : [];
          properties.slice(0, 200).forEach((p, pi) => {
            const prop = asObject(p),
              label = asString(prop.name);
            if (
              prop['@type'] !== 'PropertyValue' ||
              !label ||
              !['string', 'number', 'boolean'].includes(typeof prop.value)
            )
              return;
            const rawValue = String(prop.value),
              unit = asString(prop.unitText);
            facts.push({
              label,
              value: rawValue,
              unit,
              text: JSON.stringify(p),
              locator: locator + '/' + index + '/additionalProperty/' + pi,
              scope,
              method: 'STRUCTURED_JSON',
            });
          });
        });
      } catch {
        issues.push('INVALID_STRUCTURED_JSON');
      }
    };
    if (snapshot.contentType.includes('json')) json(body, 'json');
    else {
      const root = modelYearHtmlParser()(body) as Node;
      for (const a of root.querySelectorAll('a[href]')) {
        try {
          links.push(new URL(a.getAttribute('href')!, snapshot.finalUrl).href);
        } catch {
          /* invalid link */
        }
      }
      root.querySelectorAll('table').forEach((table, ti) => {
        const rows = table.querySelectorAll('tr').filter((r) => {
          let p = r.parentNode;
          while (p && p !== table) {
            if (p.tagName === 'TABLE') return false;
            p = p.parentNode;
          }
          return p === table;
        });
        const headers = rows[0] ? direct(rows[0], ['TH', 'TD']).map(text) : [];
        const versionIndex = headers.findIndex((h) => /^(versão|versao|version)$/iu.test(h));
        const modelIndex = headers.findIndex((h) => /^(modelo|model)$/iu.test(h));
        const yearIndex = headers.findIndex((h) => /^(MY|model year|ano.modelo)$/iu.test(h));
        const tableScope = scopeOf(table);
        rows.slice(1).forEach((row, ri) => {
          const cells = direct(row, ['TH', 'TD']);
          if (
            cells.length !== headers.length ||
            cells.some((c) => c.getAttribute('colspan') || c.getAttribute('rowspan'))
          ) {
            issues.push('AMBIGUOUS_TABLE');
            return;
          }
          const values = cells.map(text);
          if (versionIndex >= 0) {
            const scope = {
              ...tableScope,
              version: values[versionIndex] || null,
              model: modelIndex >= 0 ? values[modelIndex] || null : tableScope.model,
              modelYear:
                yearIndex >= 0
                  ? /^\d{4}$/u.test(values[yearIndex] ?? '')
                    ? Number(values[yearIndex])
                    : null
                  : tableScope.modelYear,
              matrix: true,
            };
            values.forEach((v, ci) => {
              if ([versionIndex, modelIndex, yearIndex].includes(ci) || !v || !headers[ci]) return;
              facts.push({
                label: headers[ci]!,
                ...splitUnit(v),
                scope,
                text: headers.map((h, i) => h + ': ' + values[i]).join(' | '),
                locator: 'table/' + ti + '/row/' + (ri + 1) + '/cell/' + ci,
                method: 'STRUCTURED_TABLE',
              });
            });
          } else if (headers.length === 2 && /^(valor|value)$/iu.test(headers[1]!)) {
            facts.push({
              label: values[0]!,
              ...splitUnit(values[1]!),
              scope: tableScope,
              text: values.join(': '),
              locator: 'table/' + ti + '/row/' + (ri + 1),
              method: 'STRUCTURED_TABLE',
            });
          } else if (
            /^(característica|caracteristica|item|equipamento|feature)$/iu.test(headers[0] ?? '')
          ) {
            values.slice(1).forEach((v, i) => {
              if (!v) return;
              facts.push({
                label: values[0]!,
                ...splitUnit(v),
                scope: { ...tableScope, version: headers[i + 1] || null, matrix: true },
                text: headers[i + 1] + ': ' + values[0] + ': ' + v,
                locator: 'table/' + ti + '/row/' + (ri + 1) + '/cell/' + (i + 1),
                method: 'STRUCTURED_TABLE',
              });
            });
          } else issues.push('UNSUPPORTED_TABLE_SHAPE');
        });
      });
      root.querySelectorAll('[data-label][data-value]').forEach((pair, i) => {
        const label = pair.getAttribute('data-label')!,
          value = pair.getAttribute('data-value')!;
        // Attributes must agree with visible source content.
        if (text(pair).includes(label) && text(pair).includes(value))
          facts.push({
            label,
            ...splitUnit(value),
            scope: scopeOf(pair),
            text: text(pair),
            locator: 'pair/' + i,
            method: 'DOM_PAIR',
          });
      });
      root
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((script, i) => json(script.textContent, 'jsonld/' + i));
      const extended = extendedHtmlSections(root, target, scopeOf);
      facts.push(...extended.facts);
      sections.push(...extended.sections);
      root.querySelectorAll('p').forEach((p, i) => {
        const content = text(p);
        // Each paragraph is its own evidence block; no cross-section collage.
        if (content.length >= 20 && content.length <= 2000)
          sections.push({ text: content, locator: 'p/' + i, scope: scopeOf(p) });
      });
    }
    const context = snapshot.contentType.includes('html')
      ? pageApplicabilityContext(modelYearHtmlParser()(body) as Node, snapshot, target)
      : undefined;
    return {
      snapshot,
      pageContext: context,
      facts: facts
        .slice(0, 1000)
        .map((f) => ({ ...f, scope: context ? inheritPageScope(f.scope, context) : f.scope })),
      sections: sections
        .slice(0, 100)
        .map((s) => ({ ...s, scope: context ? inheritPageScope(s.scope, context) : s.scope })),
      links: [...new Set(links)].slice(0, 500),
      issues,
    };
  }
}
