export type NumericStringFormat = 'auto' | 'pt-BR' | 'canonical';

export type CanonicalNumericParseResult =
  | { readonly ok: true; readonly kind: 'value'; readonly value: number }
  | { readonly ok: true; readonly kind: 'empty'; readonly value: null }
  | { readonly ok: false; readonly kind: 'invalid' | 'ambiguous'; readonly message: string };

const CANONICAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const PT_BR_INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/u;
const PT_BR_GROUPED_PATTERN = /^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/u;
const PT_BR_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*),\d+$/u;

const invalid = (message: string): CanonicalNumericParseResult => ({
  ok: false,
  kind: 'invalid',
  message,
});

const ambiguous = (message: string): CanonicalNumericParseResult => ({
  ok: false,
  kind: 'ambiguous',
  message,
});

function finite(value: number): CanonicalNumericParseResult {
  return Number.isFinite(value)
    ? { ok: true, kind: 'value', value }
    : invalid('O valor numérico deve ser finito.');
}

function parseCanonicalString(value: string): CanonicalNumericParseResult {
  if (!CANONICAL_PATTERN.test(value)) return invalid('Formato numérico canônico inválido.');
  return finite(Number(value));
}

function parsePtBrString(value: string): CanonicalNumericParseResult {
  if (PT_BR_INTEGER_PATTERN.test(value)) return finite(Number(value));
  if (PT_BR_GROUPED_PATTERN.test(value)) {
    return finite(Number(value.replace(/\./gu, '').replace(',', '.')));
  }
  if (PT_BR_DECIMAL_PATTERN.test(value)) return finite(Number(value.replace(',', '.')));
  return invalid('Formato numérico pt-BR inválido.');
}

export function parseCanonicalNumeric(
  input: unknown,
  stringFormat: NumericStringFormat = 'auto',
): CanonicalNumericParseResult {
  if (typeof input === 'number') return finite(input);
  if (typeof input !== 'string') return invalid('O valor deve ser um número ou texto numérico.');

  const value = input.trim();
  if (value === '') return { ok: true, kind: 'empty', value: null };
  if (stringFormat === 'canonical') return parseCanonicalString(value);
  if (stringFormat === 'pt-BR') return parsePtBrString(value);

  if (value.includes(',')) return parsePtBrString(value);
  if (PT_BR_GROUPED_PATTERN.test(value) && CANONICAL_PATTERN.test(value)) {
    return ambiguous('Use o formato de origem para distinguir milhar pt-BR de decimal canônico.');
  }
  if (CANONICAL_PATTERN.test(value)) return parseCanonicalString(value);
  return invalid('Formato numérico inválido ou ambíguo.');
}
