import { PricingAdapterMappingError } from './errors';

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/u;

function expandExponent(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u.exec(value);
  if (!match) return value;
  const [, sign, integer, fraction = '', exponentText] = match;
  const digits = `${integer}${fraction}`;
  const point = integer.length + Number(exponentText);
  if (point <= 0) return `${sign}0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

export function decimalString(value: unknown, field: string): string {
  const raw =
    typeof value === 'number'
      ? Number.isFinite(value)
        ? expandExponent(String(value))
        : ''
      : typeof value === 'string'
        ? value.trim()
        : '';
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new PricingAdapterMappingError(`Valor decimal invÃ¡lido: ${field}.`);
  }
  const [integer, fraction] = raw.split('.');
  const normalizedInteger = integer!.replace(/^(-?)0+(?=\d)/u, '$1');
  return fraction === undefined ? normalizedInteger : `${normalizedInteger}.${fraction}`;
}

export function moneyDecimalString(value: unknown, field: string): string {
  const decimal = decimalString(value, field);
  const [integer, fraction = ''] = decimal.split('.');
  if (decimal.startsWith('-') || fraction.length > 2) {
    throw new PricingAdapterMappingError(`Valor monetÃ¡rio invÃ¡lido: ${field}.`);
  }
  return `${integer}.${fraction.padEnd(2, '0')}`;
}
