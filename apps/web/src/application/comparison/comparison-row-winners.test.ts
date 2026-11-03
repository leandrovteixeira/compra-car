import { describe, expect, it } from 'vitest';
import type { ComparisonCellDto } from '@compra-car/contracts';
import { comparisonRowWinners } from './comparison-row-winners';
import { PRESENCE_DISPLAY_VALUE } from './comparison-mapper';

const numeric = (displayValue: string): ComparisonCellDto => ({
  type: 'numeric',
  displayValue,
  comparison: 'not-applicable',
});
const presence = (present: boolean): ComparisonCellDto => ({
  type: 'binary',
  displayValue: present ? PRESENCE_DISPLAY_VALUE : '—',
  comparison: 'not-applicable',
});

describe('orange checks require a unique winner', () => {
  it('does not highlight equipment present in all models', () => {
    expect(comparisonRowWinners([presence(true), presence(true), presence(true)])).toEqual([
      false,
      false,
      false,
    ]);
  });
  it('does not highlight two tied models even when another lacks the equipment', () => {
    expect(comparisonRowWinners([presence(true), presence(true), presence(false)])).toEqual([
      false,
      false,
      false,
    ]);
  });
  it('highlights equipment available in only one model', () => {
    expect(comparisonRowWinners([presence(false), presence(true), presence(false)])).toEqual([
      false,
      true,
      false,
    ]);
  });
  it('does not highlight absent equipment', () => {
    expect(comparisonRowWinners([presence(false), presence(false)])).toEqual([false, false]);
  });
  it('does not highlight numeric ties for largest or smallest values', () => {
    expect(
      comparisonRowWinners(['500 L', '500 L', '400 L'].map(numeric), 'Volume do porta-malas (L)'),
    ).toEqual([false, false, false]);
    expect(
      comparisonRowWinners(
        ['0,42 MJ/Km', '0,42 MJ/Km', '0,55 MJ/Km'].map(numeric),
        'Eficiência energética (MJ/Km)',
      ),
    ).toEqual([false, false, false]);
    expect(
      comparisonRowWinners(['500 L', '500 L'].map(numeric), 'Volume do porta-malas (L)'),
    ).toEqual([false, false]);
  });
  it('retains a unique numerical advantage in either direction', () => {
    expect(
      comparisonRowWinners(['500 L', '400 L'].map(numeric), 'Volume do porta-malas (L)'),
    ).toEqual([true, false]);
    expect(
      comparisonRowWinners(
        ['0,55 MJ/Km', '0,42 MJ/Km'].map(numeric),
        'Eficiência energética (MJ/Km)',
      ),
    ).toEqual([false, true]);
  });
  it('does not guess an advantage for mixed types or unsupported preferences', () => {
    expect(comparisonRowWinners([presence(true), numeric('10')])).toEqual([false, false]);
    expect(comparisonRowWinners(['10', '20'].map(numeric), 'Sem critério')).toEqual([false, false]);
  });
});
