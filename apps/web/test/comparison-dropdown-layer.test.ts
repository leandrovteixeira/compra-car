import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('comparison dropdown stays above sticky specification headers', () => {
  it('lifts the opened search surface above the table headers', () => {
    const selector = readFileSync(resolve(__dirname, '../src/components/admin/comparison-vehicle-selector.tsx'), 'utf8');
    const table = readFileSync(resolve(__dirname, '../src/components/comparison-table.tsx'), 'utf8');
    expect(selector).toContain("open && selected.length < maxVehicles ? 'z-[70]' : ''");
    expect(selector).toContain('absolute inset-x-0 top-full z-50');
    expect(table).toContain('sticky left-0 z-50');
  });
});
