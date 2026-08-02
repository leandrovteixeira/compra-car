import { describe, expect, it } from 'vitest';

import { resolveCommercialPeriod } from '../src';

describe('commercial period', () => {
  it('derives the complete calendar month, including leap years', () => {
    expect(resolveCommercialPeriod({ competence: '2028-02', kind: 'monthly' })).toEqual({
      ok: true,
      period: {
        competence: '2028-02',
        kind: 'monthly',
        start: '2028-02-01',
        end: '2028-02-29',
      },
    });
  });

  it('accepts an internal special interval and rejects dates outside the competence', () => {
    expect(
      resolveCommercialPeriod({
        competence: '2026-09',
        kind: 'special',
        specialStart: '2026-09-10',
        specialEnd: '2026-09-20',
      }),
    ).toMatchObject({ ok: true, period: { start: '2026-09-10', end: '2026-09-20' } });
    expect(
      resolveCommercialPeriod({
        competence: '2026-09',
        kind: 'special',
        specialStart: '2026-08-31',
        specialEnd: '2026-09-20',
      }),
    ).toMatchObject({ ok: false });
  });
});
