import type { ComparisonCellDto } from '@compra-car/contracts';
import { PRESENCE_DISPLAY_VALUE } from './comparison-mapper';

export function comparisonRowWinners(
  values: readonly ComparisonCellDto[],
  label = '',
): readonly boolean[] {
  const none = values.map(() => false);
  if (values.length < 2) return none;
  if (values.every((v) => v.type !== 'numeric')) {
    const present = values.map((v) => v.displayValue === PRESENCE_DISPLAY_VALUE);
    return present.filter(Boolean).length === 1 ? present : none;
  }
  if (!values.every((v) => v.type === 'numeric')) return none;

  const parse = (display: string | null): number | null => {
    if (!display || display === '—') return null;
    const match = display.trim().match(/^-?[0-9][0-9.,]*/);
    if (!match) return null;
    const raw = match[0];
    const value = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  };
  const numbers = values.map((v) => parse(v.displayValue));
  const valid = numbers.filter((v): v is number => v !== null);
  if (!valid.length) return none;

  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  // Only explicit, measurable preferences receive winner checks.
  const smaller =
    /eficiencia energetica.*mj\s*\/\s*km|consumo.*l\s*\/\s*100|emissoes|co2|tempo de aceleracao|distancia de frenagem/.test(
      normalized,
    );
  const larger =
    /capacidade|carga|tracao|tanque de combustivel|volume|porta-malas|autonomia|consumo.*km\s*\/\s*l|consumo urbano|consumo rodoviario/.test(
      normalized,
    );
  if (!smaller && !larger) return none;
  const best = smaller ? Math.min(...valid) : Math.max(...valid);
  const winners = numbers.map((n) => n !== null && Math.abs(n - best) < 0.000001);
  return winners.filter(Boolean).length === 1 ? winners : none;
}
