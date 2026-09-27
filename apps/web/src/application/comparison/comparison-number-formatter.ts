export interface ComparisonNumberMetadata {
  readonly code: string;
  readonly label?: string;
  readonly specSet?: string;
  readonly displayUnit?: string | null;
  readonly displayMultiplier?: number;
  readonly displayDecimals?: number | null;
}

type ComparisonNumberFormat = 'default' | 'integer' | 'one-decimal' | 'two-decimals';

export const COMPARISON_NUMBER_FORMAT_BY_SPEC_CODE: Readonly<
  Partial<Record<string, ComparisonNumberFormat>>
> = Object.freeze({
  PW_0005: 'one-decimal',
  PW_0015: 'integer',
  CO_0017: 'two-decimals',
  CO_0019: 'two-decimals',
  OW_0001: 'two-decimals',
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

const UNIT_LABEL_PT: Readonly<Record<string, string>> = Object.freeze({
  inch: 'pol',
  years: 'anos',
});

function normalizeUnit(unit: string | null, displayUnit?: string | null): string | null {
  const preferred = displayUnit?.trim();
  if (preferred) return preferred;

  const normalizedUnit = unit?.trim() || null;
  if (!normalizedUnit || normalizedUnit.toLowerCase() === 'unit') return null;
  return UNIT_LABEL_PT[normalizedUnit.toLowerCase()] ?? normalizedUnit;
}

function exactDecimalsFormatter(decimals: number): Intl.NumberFormat {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
}

export function formatComparisonNumericValue(
  value: number,
  metadata: ComparisonNumberMetadata,
): string {
  const displayValue = value * (metadata.displayMultiplier ?? 1);

  if (metadata.displayDecimals !== null && metadata.displayDecimals !== undefined) {
    return exactDecimalsFormatter(metadata.displayDecimals).format(displayValue);
  }

  const format = COMPARISON_NUMBER_FORMAT_BY_SPEC_CODE[metadata.code.trim().toUpperCase()];
  const formatter =
    format === 'integer'
      ? INTEGER_FORMAT
      : format === 'one-decimal'
        ? SINGLE_DECIMAL_FORMAT
        : format === 'two-decimals'
          ? TWO_DECIMAL_FORMAT
          : DEFAULT_NUMBER_FORMAT;

  return formatter.format(displayValue);
}

export function formatComparisonNumber(
  value: number,
  unit: string | null,
  metadata: ComparisonNumberMetadata,
): string {
  const normalizedUnit = normalizeUnit(unit, metadata.displayUnit);
  const formattedValue = formatComparisonNumericValue(value, metadata);

  return normalizedUnit ? `${formattedValue} ${normalizedUnit}` : formattedValue;
}
