import { describe, expect, it } from 'vitest';

import {
  currentMonthlyCompetence,
  dateBelongsToCompetence,
  monthlyPricingPeriod,
  monthlyCompetenceOptions,
  normalizeMonthlyCompetence,
  shiftMonthlyCompetence,
} from '../src/application/admin/monthly-pricing-context';

describe('monthly pricing context', () => {
  it('uses the operational timezone for the current month', () => {
    expect(currentMonthlyCompetence(new Date('2026-09-01T01:30:00Z'))).toBe('2026-08');
  });

  it('normalizes query string and resolves month boundaries', () => {
    expect(normalizeMonthlyCompetence('2026-02')).toBe('2026-02');
    expect(normalizeMonthlyCompetence('invalid', new Date('2026-08-15T12:00:00Z'))).toBe('2026-08');
    expect(monthlyPricingPeriod('2028-02')).toMatchObject({
      firstDay: '2028-02-01',
      lastDay: '2028-02-29',
    });
  });

  it('moves between months and validates the base date', () => {
    expect(shiftMonthlyCompetence('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthlyCompetence('2026-12', 1)).toBe('2027-01');
    expect(dateBelongsToCompetence('2026-08-31', '2026-08')).toBe(true);
    expect(dateBelongsToCompetence('2026-09-01', '2026-08')).toBe(false);
  });

  it('builds the canonical N-6 to N+6 dropdown in Portuguese', () => {
    const options = monthlyCompetenceOptions(new Date('2026-08-15T12:00:00Z'));
    expect(options).toHaveLength(13);
    expect(options.at(0)).toMatchObject({ competence: '2026-02', label: 'Fevereiro/2026' });
    expect(options.at(6)).toMatchObject({ competence: '2026-08', label: 'Agosto/2026' });
    expect(options.at(-1)).toMatchObject({ competence: '2027-02', label: 'Fevereiro/2027' });
  });
});
