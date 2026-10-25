import { describe, expect, it } from 'vitest';
import { parseAdminPriceFilters } from './admin-price-query';
import { adminPriceVisualStatusLabel } from '@/components/admin/admin-price-presentation';

describe('operational price filters', () => {
  it.each(['current', 'future', 'expired', 'archived', 'all'] as const)('accepts %s', (status) => {
    expect(parseAdminPriceFilters({ status }).status).toBe(status);
  });
  it.each(['published', 'draft', 'needs_review', 'rejected'])(
    'resets obsolete filter %s',
    (status) => {
      expect(parseAdminPriceFilters({ status }).status).toBe('current');
    },
  );
  it('keeps future prices separate from expired and includes the end date', () => {
    expect(adminPriceVisualStatusLabel('published', '2026-11-01', '2026-11-30', '2026-10-25')).toBe(
      'Previsto',
    );
    expect(adminPriceVisualStatusLabel('published', '2026-10-01', '2026-10-24', '2026-10-25')).toBe(
      'Expirado',
    );
    expect(adminPriceVisualStatusLabel('published', '2026-10-01', '2026-10-25', '2026-10-25')).toBe(
      'Vigente',
    );
  });
});
