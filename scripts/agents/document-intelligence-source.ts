import { createHash } from 'node:crypto';
import { classifyDocumentSource, publishedSourceVersion } from '@compra-car/core/agents';
import type {
  DocumentIntelligenceSource,
  DocumentBlock,
  SpecSourceTarget,
  SourceSnapshot,
  DocumentSourceClass,
} from '@compra-car/core/agents';
import { modelYearHtmlParser } from './model-year-html-parser';
import { readPdfPages } from './spec-source-pdf';
interface Node {
  tagName: string;
  textContent: string;
  parentNode: Node | null;
  childNodes: Node[];
  getAttribute(n: string): string | undefined;
  querySelectorAll(s: string): Node[];
}
const clean = (s: string) => s.replace(/\s+/gu, ' ').trim();
function visible(node: Node) {
  for (let n: Node | null = node; n; n = n.parentNode)
    if (
      ['NAV', 'FOOTER', 'NOSCRIPT'].includes(n.tagName) ||
      n.getAttribute('hidden') !== undefined ||
      n.getAttribute('aria-hidden') === 'true' ||
      /display\s*:\s*none|visibility\s*:\s*hidden/iu.test(n.getAttribute('style') ?? '')
    )
      return false;
  return true;
}
export async function buildDocumentSource(
  bytes: Uint8Array,
  snapshot: SourceSnapshot,
  target: SpecSourceTarget,
  label = '',
  hint?: DocumentSourceClass,
): Promise<DocumentIntelligenceSource> {
  const sourceClass = classifyDocumentSource(snapshot.finalUrl, label, hint);
  const base = {
    sourceClass,
    official: true,
    reference: snapshot.sourceUrl,
    finalUrl: snapshot.finalUrl,
    sourceHash: createHash('sha256').update(bytes).digest('hex'),
    contentType: snapshot.contentType,
    byteSize: bytes.length,
    title: null,
    h1: [],
    truncated: false,
  };
  if (snapshot.contentType === 'application/pdf') {
    const pages = await readPdfPages(bytes);
    return {
      ...base,
      format: 'PDF_FILE',
      filename: new URL(snapshot.finalUrl).pathname.split('/').pop() ?? 'sheet.pdf',
      bytes,
      blocks: pages.map((p) => ({
        locator: 'page/' + p.page,
        page: p.page,
        readingText: p.rawPageText,
        type: 'PAGE',
        text: p.text,
        parentLocator: null,
        heading: null,
        scope: { model: null, version: null, modelYear: null },
      })),
    };
  }
  const body = Buffer.from(bytes).toString('utf8');
  if (snapshot.contentType.includes('json'))
    return {
      ...base,
      format: 'STRUCTURED_JSON',
      blocks: [
        {
          locator: 'json/root',
          type: 'JSON',
          text: body.slice(0, 150000),
          scope: { model: null, version: null, modelYear: null },
          parentLocator: null,
          heading: null,
        },
      ],
      truncated: body.length > 150000,
    };
  const root = modelYearHtmlParser()(body) as unknown as Node;
  const title = clean(root.querySelectorAll('title')[0]?.textContent ?? '');
  const h1 = root
    .querySelectorAll('h1')
    .filter(visible)
    .map((n) => clean(n.textContent));
  const blocks: DocumentBlock[] = [
    {
      locator: 'page',
      type: 'PAGE',
      text: [title, ...h1].join(' | '),
      heading: title,
      parentLocator: null,
      scope: { model: null, version: null, modelYear: null },
    },
  ];
  const parents = new Map<Node, string>();
  let length = blocks[0]!.text.length,
    truncated = false;
  for (const node of root.querySelectorAll(
    'h1,h2,h3,p,li,table,dl,script[type="application/json"],script[type="application/ld+json"],script[type="x-feature-hub/serialized-states"]',
  )) {
    const chain: Node[] = [];
    for (let n: Node | null = node; n; n = n.parentNode) chain.push(n);
    if (!visible(node)) continue;
    let text = clean(node.textContent);
    if (node.tagName === 'SCRIPT' && /^%7b|^%5b/iu.test(text)) {
      try {
        text = JSON.stringify(JSON.parse(decodeURIComponent(text)));
      } catch {
        continue;
      }
    }
    if (!text) continue;
    if (length + text.length > 150000 || blocks.length >= 500) {
      truncated = true;
      continue;
    }
    length += text.length;
    let model: string | null = null,
      version: string | null = null,
      modelYear: number | null = null;
    for (const n of [...chain].reverse()) {
      model = n.getAttribute('data-model') ?? model;
      version = n.getAttribute('data-version') ?? version;
      const year = n.getAttribute('data-model-year');
      if (year && /^20\d{2}$/u.test(year)) modelYear = Number(year);
      // A bounded explicit child identity wins over page context.
      if (['SECTION', 'ARTICLE'].includes(n.tagName) && n.textContent.length < 12000) {
        const match = publishedSourceVersion(n.textContent, target.model);
        if (match) {
          model = target.model;
          version = match;
        }
      }
    }
    let parentLocator = 'page';
    for (const ancestor of [...chain]
      .reverse()
      .filter((n) => ['SECTION', 'ARTICLE'].includes(n.tagName))) {
      let locator = parents.get(ancestor);
      if (!locator) {
        locator = 'section/' + parents.size;
        parents.set(ancestor, locator);
        const heading = ancestor.childNodes
          .filter((n) => /^H[1-6]$/u.test(n.tagName) && visible(n))
          .map((n) => clean(n.textContent))
          .join(' | ');
        const identity = [
          ancestor.getAttribute('data-model'),
          ancestor.getAttribute('data-version'),
          ancestor.getAttribute('data-model-year'),
        ]
          .filter(Boolean)
          .join(' ');
        blocks.push({
          locator,
          type: 'SECTION',
          text: [heading, identity].filter(Boolean).join(' | '),
          heading,
          parentLocator,
          scope: {
            model: ancestor.getAttribute('data-model') ?? null,
            version: ancestor.getAttribute('data-version') ?? null,
            modelYear: ancestor.getAttribute('data-model-year')
              ? Number(ancestor.getAttribute('data-model-year'))
              : null,
          },
        });
      }
      parentLocator = locator;
    }
    blocks.push({
      locator: (node.tagName === 'LI' ? 'list/' : 'dom/') + blocks.length,
      type:
        node.tagName === 'TABLE'
          ? 'TABLE'
          : node.tagName === 'SCRIPT'
            ? 'JSON'
            : version
              ? 'CARD'
              : 'TEXT',
      text,
      ...(node.tagName === 'TABLE'
        ? {
            tableRows: node
              .querySelectorAll('tr')
              .map((r) => r.querySelectorAll('th,td').map((c) => clean(c.textContent))),
          }
        : {}),
      parentLocator,
      heading:
        chain
          .find((n) => ['SECTION', 'ARTICLE'].includes(n.tagName))
          ?.childNodes.find((n) => /^H[1-6]$/u.test(n.tagName) && visible(n))?.textContent ?? null,
      scope: { model, version, modelYear },
    });
  }
  return {
    ...base,
    title,
    h1,
    format: sourceClass === 'OFFICIAL_CONFIGURATOR' ? 'CONFIGURATOR_SNAPSHOT' : 'HTML_DOCUMENT',
    blocks,
    truncated,
  };
}
