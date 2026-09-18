import type {
  DocumentEvidence,
  DocumentIntelligenceSource,
  DocumentBlock,
  GroundingQuality,
} from './document-intelligence-types';
/** Grounding only: preserve digits, decimal punctuation and word order. */
export function normalizeGrounding(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[“”″]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/[‐‑–—]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}
const tokens = (s: string) =>
  normalizeGrounding(s).match(/[\p{L}\p{N}]+(?:[.,][\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? [];
export function textGrounding(text: string, quote: string, window = false): GroundingQuality {
  if (!quote.trim() || quote.length > 1500) return 'NOT_GROUNDED';
  if (text.includes(quote)) return 'EXACT_TEXT';
  if (normalizeGrounding(text).includes(normalizeGrounding(quote))) return 'NORMALIZED_TEXT';
  if (!window) return 'NOT_GROUNDED';
  // Letterspaced display headings are a layout artifact. Restrict to whole tracked lines.
  for (const line of text.split(/\n/u)) {
    const words = line.trim().split(/\s+/u);
    if (
      words.length >= 8 &&
      words.every((w) => [...w].length === 1) &&
      normalizeGrounding(line)
        .replace(/\s/gu, '')
        .includes(normalizeGrounding(quote).replace(/\s/gu, ''))
    )
      return 'BOUNDED_WINDOW';
  }
  const q = tokens(quote),
    t = tokens(text);
  if (q.length < 3 || q.length > 250) return 'NOT_GROUNDED';
  for (let start = 0; start < t.length; start++) {
    if (t[start] !== q[0]) continue;
    let at = start,
      ok = true,
      gaps = 0;
    for (let i = 1; i < q.length; i++) {
      at++;
      // Only layout markers may intervene; no arbitrary words or numeric substitutions.
      while (at < t.length && t[at] !== q[i] && /^[•●✓✔]$/u.test(t[at]!)) {
        at++;
        gaps++;
      }
      if (t[at] !== q[i] || gaps > 3 || at - start > q.length + 3) {
        ok = false;
        break;
      }
    }
    if (ok) return 'BOUNDED_WINDOW';
  }
  return 'NOT_GROUNDED';
}
function sectionWindows(text: string, heading: string | null | undefined): string[] {
  if (!heading) return [text];
  const lines = text.split(/\n/u),
    windows: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (normalizeGrounding(lines[i]!) !== normalizeGrounding(heading)) continue;
    let end = i + 1;
    while (end < lines.length) {
      const l = lines[end]!.trim();
      if (
        l.length >= 4 &&
        l.length <= 90 &&
        /\p{L}/u.test(l) &&
        l === l.toLocaleUpperCase('pt-BR') &&
        !/[\d•●✓✔:]/u.test(l)
      )
        break;
      end++;
    }
    windows.push(lines.slice(i, end).join('\n'));
  }
  return windows;
}
export function groundEvidence(
  source: DocumentIntelligenceSource,
  e: DocumentEvidence,
): GroundingQuality {
  const b = source.blocks.find((b) => b.locator === e.locator);
  if (
    !b ||
    e.sourceHash !== source.sourceHash ||
    (e.page != null && b.page !== e.page && e.locator !== 'page/' + e.page)
  )
    return 'NOT_GROUNDED';
  if (
    e.sectionHeading &&
    ![b.heading, b.text].some(
      (t) => t && normalizeGrounding(t).includes(normalizeGrounding(e.sectionHeading!)),
    )
  )
    return 'NOT_GROUNDED';
  if (e.parentContext) {
    const chain: DocumentBlock[] = [b];
    const seen = new Set([b.locator]);
    let cursor = b;
    while (cursor.parentLocator) {
      const parent = source.blocks.find((x) => x.locator === cursor.parentLocator);
      if (!parent || seen.has(parent.locator)) break;
      seen.add(parent.locator);
      chain.push(parent);
      cursor = parent;
    }
    if (!chain.some((x) => blockSupports(x, e.parentContext!))) return 'NOT_GROUNDED';
  }
  const window = e.evidenceType === 'TEXT_WINDOW' || e.evidenceType === 'LAYOUT_CONTEXT';
  const candidates =
    source.format === 'PDF_FILE' ? sectionWindows(b.text, e.sectionHeading) : [b.text];
  const result =
    candidates.map((t) => textGrounding(t, e.quote, window)).find((q) => q !== 'NOT_GROUNDED') ??
    'NOT_GROUNDED';
  if (result !== 'NOT_GROUNDED')
    return e.evidenceType === 'STRUCTURAL_CONTEXT' ? 'STRUCTURAL_CONTEXT' : result;
  // Alternative PDF reading order stays on the same page/block; never combine variants.
  if (source.format === 'PDF_FILE' && b.readingText)
    return (
      sectionWindows(b.readingText, e.sectionHeading)
        .map((t) => textGrounding(t, e.quote, window))
        .find((q) => q !== 'NOT_GROUNDED') ?? 'NOT_GROUNDED'
    );
  return 'NOT_GROUNDED';
}
export function blockSupports(b: DocumentBlock, text: string): boolean {
  return (
    textGrounding(b.text, text, true) !== 'NOT_GROUNDED' ||
    (!!b.readingText && textGrounding(b.readingText, text, true) !== 'NOT_GROUNDED')
  );
}
