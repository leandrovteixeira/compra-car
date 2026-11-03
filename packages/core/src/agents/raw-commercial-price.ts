/** Sprint 26: extraction before identity matching.
 * Pure, zero-AI source parsing. Output is NOT a canonical price or an approval.
 */
export interface RawCommercialPrice {
  readonly amount: string;
  readonly context: string;
  readonly label: 'MSRP' | 'SINGLE_PRICE' | 'PROMOTIONAL_PRICE';
  readonly versionHint: string | null;
  readonly modelYearHint: number | null;
}
const parseBrl = (value: string): string | null => {
  const n = Number(value.replace(/\./gu, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 20000 && n <= 5000000 ? n.toFixed(2) : null;
};
function normalizeHtml(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ').replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&#225;/giu, 'á').replace(/&#231;/giu, 'ç')
    .replace(/\s+/gu, ' ').trim();
}
export function extractRawCommercialPrices(html: string): readonly RawCommercialPrice[] {
  const text = normalizeHtml(html);
  // Some manufacturer pages render commercial labels with missing characters
  // and spaces (e.g. "P eço ú ico") while keeping the BRL amount intact.
  // Require a recognizable price label; never collect arbitrary R$ numbers.
  const pattern = /(?:preço\s+(?:único|público\s+sugerido|sugerido|de\s+tabela)|p\s*r?\s*eço\s+ú\s*n?\s*ico|valor\s+à\s+vista|por)[\s:*]{0,12}R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{5,7}(?:,\d{2})?)/giu;
  const found: RawCommercialPrice[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const amount = parseBrl(match[1]!);
    if (!amount) continue;
    const index = match.index ?? 0;
    const context = text.slice(Math.max(0,index-240),Math.min(text.length,index+250));
    const prefix = match[0].slice(0,match[0].indexOf('R$')).toLowerCase();
    const label = /único|ú\s*n?\s*ico/u.test(prefix) ? 'SINGLE_PRICE' :
      /\bpor\b/u.test(prefix) ? 'PROMOTIONAL_PRICE' : 'MSRP';
    const year = context.match(/(?:ano[ -]?modelo|MY|modelo)\s*(?:20\d\d\s*\/\s*)?(20\d\d)/iu);
    const key = [amount,label,context].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({amount,context,label,versionHint:null,modelYearHint:year?Number(year[1]):null});
  }
  return found;
}
