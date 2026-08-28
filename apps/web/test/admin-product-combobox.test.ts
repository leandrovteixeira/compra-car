import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  matchesVehicleSearch,
  normalizeVehicleSearch,
} from '../src/application/catalog/vehicle-search';

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
    expect(matchesVehicleSearch(vehicle, query)).toBe(true);
  });

  it('requires every token and normalizes repeated whitespace', () => {
    expect(matchesVehicleSearch(vehicle, 'song corolla')).toBe(false);
    expect(normalizeVehicleSearch('  BYD   Song  ')).toBe('byd song');
    expect(matchesVehicleSearch('Citroën C4', 'citroen')).toBe(true);
  });

  it('uses the same compact field primitive as adjacent pricing inputs', () => {
    const component = readFileSync(
      resolve(__dirname, '../src/components/admin/admin-product-combobox.tsx'),
      'utf8',
    );

    expect(component).toContain('`${fieldClassName} pr-10');
    expect(component).toContain("buttonClassName({ compact: true, variant: 'ghost' })");
    expect(component).not.toContain('min-h-11 w-full rounded-lg');
  });
});
