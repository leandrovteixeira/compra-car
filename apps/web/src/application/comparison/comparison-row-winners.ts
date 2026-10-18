import type { ComparisonCellDto } from '@compra-car/contracts';
import { PRESENCE_DISPLAY_VALUE } from './comparison-mapper';

/**
 * Winners are computed against the full row, not separately vs the reference.
 * For numeric rows, the engine's reference-relative outcome establishes whether
 * high or low is favorable; no direction is guessed where evidence conflicts.
 */
export function comparisonRowWinners(values: readonly ComparisonCellDto[]): readonly boolean[] {
  const none = values.map(() => false);
  if (values.length < 2) return none;
  if (values.every(value => value.type !== 'numeric')) {
    const present = values.map(v => v.displayValue === PRESENCE_DISPLAY_VALUE);
    return present.some(Boolean) ? present : none;
  }
  if (!values.every(v => v.type === 'numeric')) return none;
  const parse = (s: string | null): number | null => {
    if (!s || s === '—') return null;
    const match = s.trim().match(/^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
    if (!match) return null;
    const n = Number(match[0].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const numbers = values.map(v => parse(v.displayValue));
  const reference = numbers[0];
  if (reference === null) return none;
  const directions = values.slice(1).flatMap((v,i) => {
    const n = numbers[i+1];
    if (n === null || n === reference) return [];
    if (v.comparison !== 'advantage' && v.comparison !== 'disadvantage') return [];
    const positive = v.comparison === 'advantage';
    return [(n > reference) === positive ? 'max' : 'min'];
  });
  if (!directions.length || directions.some(d => d !== directions[0])) return none;
  const eligible = numbers.filter((n): n is number => n !== null);
  const best = directions[0] === 'max' ? Math.max(...eligible) : Math.min(...eligible);
  return numbers.map(n => n !== null && Math.abs(n-best) < 0.000001);
}
