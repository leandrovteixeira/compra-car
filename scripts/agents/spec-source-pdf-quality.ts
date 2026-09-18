import type { SourceFact } from '@compra-car/core/agents';
export type PdfPageRole =
  | 'TECHNICAL_DATA'
  | 'TABLE_OF_CONTENTS'
  | 'INDEX'
  | 'GLOSSARY_OR_DEFINITION'
  | 'REFERENCE'
  | 'GENERAL_PROSE'
  | 'UNKNOWN';
export interface PdfTextSpan {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PdfStructuredBlock {
  rawText: string;
  text: string;
  y: number;
  cells: { text: string; x: number; width: number }[];
}
export function reconstructPdfRows(spans: readonly PdfTextSpan[]): PdfStructuredBlock[] {
  const rows = new Map<number, PdfTextSpan[]>();
  for (const s of spans) {
    const y = Math.round(s.y * 2) / 2;
    const row = rows.get(y) ?? [];
    row.push(s);
    rows.set(y, row);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, row]) => {
      row.sort((a, b) => a.x - b.x);
      const cells: { text: string; x: number; width: number }[] = [];
      for (const s of row) {
        const previous = cells[cells.length - 1];
        const gap = previous ? s.x - (previous.x + previous.width) : Infinity;
        if (previous && gap <= 12) {
          previous.text += ' ' + s.text;
          previous.width = s.x + s.width - previous.x;
        } else cells.push({ text: s.text, x: s.x, width: s.width });
      }
      const rawText = row.map((s) => s.text).join(' ');
      return { rawText, text: rawText.replace(/\s+/gu, ' ').trim(), y, cells };
    });
}
export function classifyPdfPage(text: string): PdfPageRole {
  const lines = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    head = lines.slice(0, 12).join(' ');
  if (/\b(sumário|sumario|table of contents)\b/iu.test(head)) return 'TABLE_OF_CONTENTS';
  if (/índice remissivo|indice remissivo|alphabetical index|^índice\b/iu.test(head)) return 'INDEX';
  if (/gloss[aá]rio|abreviaturas|abreviações|siglas e|glossary|abbreviations/iu.test(head))
    return 'GLOSSARY_OR_DEFINITION';
  const refs = lines.filter((s) =>
    /\.{3,}\s*\d+|^[\p{L}][\p{L}\s,()-]{3,90}\s+\d{1,3}$/u.test(s),
  ).length;
  if (refs >= 5 && refs / lines.length > 0.2) return 'INDEX';
  if (
    lines.some((s) =>
      /^(?:AQ\s*\d+|[A-Z]{2,5})\s+(?:Transmissão|Sistema|Significa|Automatic)/u.test(s),
    ) &&
    !/cilindrada|pot[eê]ncia|torque/iu.test(text)
  )
    return 'GLOSSARY_OR_DEFINITION';
  if (
    /dados t[eé]cnicos|technical data|cilindrada|pot[eê]ncia máxima|dimensões|capacidades|motorização/iu.test(
      text,
    )
  )
    return 'TECHNICAL_DATA';
  if (/veja página|consulte.*página|see page/iu.test(text)) return 'REFERENCE';
  return text.trim() ? 'GENERAL_PROSE' : 'UNKNOWN';
}
export function pdfNoiseReason(text: string): string | null {
  if (
    /\.{3,}\s*\d+|^(?:com\s+)?transmissão automática(?:\s+de\s+\d+\s+marchas)?\s+\d{1,3}$/iu.test(
      text,
    )
  )
    return 'INDEX_REFERENCE';
  if (/^(?:AQ\s*\d+|[A-Z]{2,5})\s+(?:Transmissão|Sistema|Significa)/u.test(text))
    return 'GLOSSARY_DEFINITION';
  return null;
}
export const pdfFactPriority = (f: SourceFact) =>
  f.method === 'STRUCTURED_TABLE' ? 3 : f.method === 'PDF_TEXT' ? 2 : 1;
