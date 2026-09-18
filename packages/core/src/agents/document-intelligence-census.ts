import type {
  DocumentIntelligenceSource,
  SourceStructureCensus,
  TechnicalSheetContent,
} from './document-intelligence-types';
import { normalizeGrounding } from './document-intelligence-grounding';
/** Structural QA only. No automotive vocabulary, catalog, expected answers or row extraction. */
export function sourceStructureCensus(s: DocumentIntelligenceSource): SourceStructureCensus {
  const pages = s.blocks.filter((b) => b.type === 'PAGE');
  const headings =
    s.format === 'PDF_FILE'
      ? pages.flatMap((b) =>
          b.text
            .split(/\n/u)
            .map((x) => x.trim())
            .filter(
              (x) =>
                x.length >= 4 &&
                x.length <= 90 &&
                /\p{L}/u.test(x) &&
                x === x.toLocaleUpperCase('pt-BR') &&
                !/[\d•●✓✔:]/u.test(x) &&
                x.split(/\s+/u).filter((w) => w.length > 1).length >= 1,
            ),
        )
      : s.blocks
          .filter((b) => b.type === 'SECTION')
          .map((b) => b.heading ?? '')
          .filter(Boolean);
  const text = s.blocks
    .filter((b) => s.format !== 'PDF_FILE' || b.type === 'PAGE')
    .map((b) => b.text)
    .join('\n');
  return {
    pageCount: pages.length,
    headings,
    markerCount: (text.match(/[•●✓✔]/gu) ?? []).length,
    rowCount:
      s.format === 'PDF_FILE'
        ? text.split(/\n/u).filter((l) => /\p{L}/u.test(l) && /\d|[•●✓✔]/u.test(l)).length
        : s.blocks.reduce((n, b) => n + (b.tableRows?.length ?? 0), 0),
    tableCount: s.blocks.filter((b) => b.type === 'TABLE').length,
    cardCount: new Set(
      s.blocks.filter((b) => b.type === 'CARD').map((b) => b.parentLocator ?? b.locator),
    ).size,
    listCount: s.blocks.filter((b) => b.locator.startsWith('list/')).length,
    jsonCount: s.blocks.filter((b) => b.type === 'JSON').length,
    blockCount: s.blocks.length,
    textCharacters: text.length,
  };
}
export function assessCompleteness(c: SourceStructureCensus, v: TechnicalSheetContent) {
  const items = v.sections.flatMap((s) => s.items);
  const represented = [
    ...v.sections.map((s) => s.sourceHeading),
    ...items.flatMap((i) => [i.subgroup ?? '', i.parentGroup ?? '']),
    v.documentIdentity.version ?? '',
  ].map(normalizeGrounding);
  const remaining = [...represented];
  const missing = c.headings.filter((h) => {
    const n = normalizeGrounding(h);
    if (
      normalizeGrounding(v.documentIdentity.version ?? '')
        .split(/\s+/u)
        .includes(n) ||
      n.includes(normalizeGrounding(v.documentIdentity.model ?? '\u0000'))
    )
      return false;
    const at = remaining.indexOf(n);
    if (at >= 0) {
      remaining.splice(at, 1);
      return false;
    }
    return true;
  });
  const reasons: string[] = [],
    major: string[] = [];
  if (c.headings.length >= 3 && missing.length && c.pageCount <= 1)
    major.push('Unrepresented source headings: ' + missing.join(' | '));
  if (missing.length && c.pageCount > 1)
    reasons.push('Multi-page heading discrepancy; repeated running headers may explain it');
  const present = items.filter((i) => i.kind === 'PRESENT' && i.present).length;
  if (c.markerCount >= 5 && present < c.markerCount * 0.85)
    major.push('Source markers ' + c.markerCount + '; PRESENT items ' + present);
  if (c.rowCount >= 10 && items.length < c.rowCount * 0.5)
    major.push('Sparse extraction versus source row signals');
  if (v.sections.some((s) => !s.items.length)) major.push('Empty extracted section');
  const versions = new Set(items.map((i) => i.applicability.version).filter(Boolean));
  if (c.cardCount >= 4 && versions.size < c.cardCount / 2)
    major.push('Few version groups relative to source cards');
  if (c.listCount >= 10 && items.length < c.listCount / 2)
    major.push('Few items relative to source list entries');
  if (!c.headings.length && !c.markerCount && !c.rowCount)
    reasons.push('Insufficient independent structural signals');
  return {
    confidence: major.length
      ? ('LOW' as const)
      : reasons.length
        ? ('MEDIUM' as const)
        : ('HIGH' as const),
    reasons: [...major, ...reasons],
    major,
  };
}
