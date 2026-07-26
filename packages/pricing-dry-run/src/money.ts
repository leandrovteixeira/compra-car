import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export function decimal(value: string | null): Decimal | null {
  if (value === null || value.trim() === '') return null;
  return new Decimal(value);
}

export function money(value: Decimal): string {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function percentage(value: Decimal): string {
  return value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
}

export function roundingResidual(value: Decimal): string {
  return value.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toFixed(8);
}

export function positive(value: string | null): boolean {
  const parsed = decimal(value);
  return parsed !== null && parsed.greaterThan(0);
}

export function nonZero(value: string | null): boolean {
  const parsed = decimal(value);
  return parsed !== null && !parsed.isZero();
}
