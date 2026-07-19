export interface ComparisonNumberMetadata {
  readonly code: string;
  readonly label?: string;
  readonly specSet?: string;
}

const DEFAULT_NUMBER_FORMAT = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
  useGrouping: true,
});

const SINGLE_DECIMAL_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  useGrouping: true,
});

const SCREEN_SIZE_FORMAT = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  useGrouping: true,
});

function normalizeMetadata(metadata: ComparisonNumberMetadata): string {
  return [metadata.code, metadata.label, metadata.specSet]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isSingleDecimalSpec(metadata: string): boolean {
  return (
    metadata.includes('torque') ||
    /power[._ -]?(?:to|x)[._ -]?weight/.test(metadata) ||
    /peso[._ -]?(?:potencia|torque)/.test(metadata)
  );
}

function isScreenSizeSpec(metadata: string, unit: string | null): boolean {
  const normalizedUnit = unit?.trim().toLowerCase() ?? '';
  const screenUnit = ['in', 'inch', 'inches', 'pol', 'polegada', 'polegadas', '"'].includes(
    normalizedUnit,
  );

  return screenUnit || /screen|display|tela/.test(metadata);
}

export function formatComparisonNumber(
  value: number,
  unit: string | null,
  metadata: ComparisonNumberMetadata,
): string {
  const normalizedMetadata = normalizeMetadata(metadata);
  const normalizedUnit = unit?.trim() || null;
  const formatter = isSingleDecimalSpec(normalizedMetadata)
    ? SINGLE_DECIMAL_FORMAT
    : isScreenSizeSpec(normalizedMetadata, normalizedUnit)
      ? SCREEN_SIZE_FORMAT
      : DEFAULT_NUMBER_FORMAT;
  const formattedValue = formatter.format(value);

  return normalizedUnit ? `${formattedValue} ${normalizedUnit}` : formattedValue;
}
