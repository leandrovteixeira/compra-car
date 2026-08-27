import { describe, expect, it } from 'vitest';

import {
  matchesProductSearch,
  normalizeProductSearch,
} from '../src/application/admin/admin-product-search';

describe('admin product combobox search', () => {
  const vehicle = 'BYD Song Plus GS 2025/2026';

  it.each([
    'BYD',
    'song',
    'plus',
    'GS',
    '2026',
    '2025',
    'song plus',
    'BYD song',
    'song 2026',
    'plus 2025',
    '  SONG    2026  ',
  ])('matches all normalized tokens in %s', (query) => {
    expect(matchesProductSearch(vehicle, query)).toBe(true);
  });

  it('requires every token and normalizes repeated whitespace', () => {
    expect(matchesProductSearch(vehicle, 'song corolla')).toBe(false);
    expect(normalizeProductSearch('  BYD   Song  ')).toBe('byd song');
  });
});
