export interface ComparisonNumberMetadata {
  readonly code: string;
  readonly label?: string;
  readonly specSet?: string;
}

type ComparisonNumberFormat = 'default' | 'integer' | 'one-decimal' | 'two-decimals';

export const COMPARISON_NUMBER_FORMAT_BY_SPEC_CODE: Readonly<
  Partial<Record<string, ComparisonNumberFormat>>
> = Object.freeze({
  PW_0005: 'integer',
  PW_0015: 'integer',
  CO_0017: 'two-decimals',
  CO_0019: 'two-decimals',
  OW_0002: 'one-decimal',
  OW_0003: 'one-decimal',
  OW_0004: 'one-decimal',
  OW_0005: 'one-decimal',
  PW_0012: 'one-decimal',
  PW_0023: 'one-decimal',
  PW_0026: 'one-decimal',
  PW_0033: 'one-decimal',
  PW_0035: 'one-decimal',
  PW_0036: 'one-decimal',
});

const DEFAULT_NUMBER_FORMAT = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
  useGrouping: true,
});

const INTEGER_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

const SINGLE_DECIMAL_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: true,
});

const TWO_DECIMAL_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

function normalizeUnit(unit: string | null): string | null {
  const normalizedUnit = unit?.trim() || null;
  return normalizedUnit?.toLowerCase() === 'unit' ? null : normalizedUnit;
}

export function formatComparisonNumericValue(
  value: number,
  metadata: ComparisonNumberMetadata,
): string {
  const format = COMPARISON_NUMBER_FORMAT_BY_SPEC_CODE[metadata.code.trim().toUpperCase()];
  const formatter =
    format === 'integer'
      ? INTEGER_FORMAT
      : format === 'one-decimal'
        ? SINGLE_DECIMAL_FORMAT
        : format === 'two-decimals'
          ? TWO_DECIMAL_FORMAT
          : DEFAULT_NUMBER_FORMAT;

  return formatter.format(value);
}

export function formatComparisonNumber(
  value: number,
  unit: string | null,
  metadata: ComparisonNumberMetadata,
): string {
  const normalizedUnit = normalizeUnit(unit);
  const formattedValue = formatComparisonNumericValue(value, metadata);

  return normalizedUnit ? `${formattedValue} ${normalizedUnit}` : formattedValue;
}
