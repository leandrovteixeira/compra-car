/**
 * Sprint 27: deterministic BAIC two-version matrix adapter.
 * Input is layout-preserving PDF text extracted upstream (e.g. pdftotext -layout).
 * A document with unresolved rows MUST NOT be marked complete for absence inference.
 */
export interface SpecMatrixCell27 {
  rowId: string;
  label: string;
  pro: string;
  max: string;
  page: number;
}
export interface SpecMatrixIssue27 {
  rowId: string;
  page: number;
  reason: 'WRAPPED_CELLS' | 'MISSING_VERSION_CELL' | 'DUPLICATE_ROW_ID' | 'EMPTY_LABEL';
  excerpt: string;
}
export interface SpecMatrixParse27 {
  rows: readonly SpecMatrixCell27[];
  issues: readonly SpecMatrixIssue27[];
  seenRowIds: readonly string[];
  complete: boolean;
}
const rowIdPattern = /^\s*(\d+\.\d+)\s{2,}/u;
const separator = /\s{2,}/u;
export function parseBaicSpecMatrix27(text: string): SpecMatrixParse27 {
  const rows: SpecMatrixCell27[] = [];
  const issues: SpecMatrixIssue27[] = [];
  const seen = new Set<string>();
  const pages = text.split('\f');
  for (const [p, page] of pages.entries()) {
    const pageNumber = p + 1;
    // Never accidentally process introductory prose as technical table content.
    if (!/Especifica(?:ções|coes) técnicas\s*[—-]\s*Arcfox T1/iu.test(page)) continue;
    for (const line of page.split(/\r?\n/u)) {
      const idMatch = rowIdPattern.exec(line);
      if (!idMatch) continue;
      const id = idMatch[1]!;
      const remainder = line.slice(idMatch[0].length);
      const parts = remainder.split(separator).map((v) => v.trim()).filter(Boolean);
      if (seen.has(id)) {
        issues.push({ rowId:id, page:pageNumber, reason:'DUPLICATE_ROW_ID', excerpt:line.trim() });
        continue;
      }
      seen.add(id);
      if (parts.length < 3) {
        issues.push({ rowId:id, page:pageNumber, reason:'WRAPPED_CELLS', excerpt:line.trim() });
        continue;
      }
      if (parts.length > 3) {
        // Layout uses wide columns; splits beyond 3 generally indicate broken cells.
        issues.push({ rowId:id, page:pageNumber, reason:'WRAPPED_CELLS', excerpt:line.trim() });
        continue;
      }
      const [label, pro, max] = parts;
      if (!label) {
        issues.push({ rowId:id,page:pageNumber,reason:'EMPTY_LABEL',excerpt:line.trim() });
        continue;
      }
      if (!pro || !max) {
        issues.push({ rowId:id,page:pageNumber,reason:'MISSING_VERSION_CELL',excerpt:line.trim() });
        continue;
      }
      rows.push({ rowId:id, label, pro, max, page:pageNumber });
    }
  }
  return { rows, issues, seenRowIds:[...seen], complete: rows.length > 0 && issues.length === 0 };
}
export type SpecCellValue27 =
  | {kind:'binary'; availability:'STANDARD'|'OPTIONAL'|'NOT_AVAILABLE'}
  | {kind:'numeric'; value:number; operator:'='|'>='|'<='; unit?:string}
  | {kind:'text'; value:string}
  | {kind:'ambiguous'; raw:string};
export function parseBaicSpecCell27(raw: string): SpecCellValue27 {
  const value = raw.trim();
  if (value === '●' || value === '•') return {kind:'binary',availability:'STANDARD'};
  if (value === '○') return {kind:'binary',availability:'OPTIONAL'};
  if (value === '—' || value === '–' || value === '-') return {kind:'binary',availability:'NOT_AVAILABLE'};
  if (!value) return {kind:'ambiguous',raw};
  // Conservative numeric parsing: avoid converting "459 / 1352" or tire sizes to one scalar.
  const match = /^(≥|<=|≤|>=)?\s*(\d+(?:[.,]\d+)?)\s*(kWh|kW|km|kg|mm|s|h|min|L|Nm|N·m)?$/iu.exec(value);
  if (match) return {
    kind:'numeric', value:Number(match[2]!.replace(',','.')),
    operator:match[1] === '≥' || match[1] === '>=' ? '>=' : match[1] === '≤' || match[1] === '<=' ? '<=' : '=',
    ...(match[3] ? { unit:match[3] } : {}),
  };
  if (value.startsWith('●') || value.startsWith('○') || value.startsWith('—')) {
    // Cell contains additional qualifications; do not silently discard them.
    return {kind:'ambiguous',raw:value};
  }
  return {kind:'text', value};
}
