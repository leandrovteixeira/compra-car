import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('admin manual policy batch', () => {
  it('keeps authorization and server-only dependencies outside the browser', () => {
    const page = source('../src/app/admin/prices/policies/input/page.tsx');
    const action = source('../src/app/admin/prices/policies/input/actions.ts');
    const service = source('../src/server/manual-policy-batch-service.ts');
    expect(page).toContain("await requireRole('admin')");
    expect(page).not.toContain('supabase');
    expect(action).toContain("'use server'");
    expect(service).toContain("requireRole('admin')");
    expect(service).toContain('randomUUID');
  });

  it('renders all current types, dynamic fields and batch safeguards', () => {
    const grid = source('../src/components/admin/admin-policy-batch-grid.tsx');
    for (const type of [
      'retail_bonus',
      'trade_in_bonus',
      'subsidized_financing',
      'free_ipva',
      'free_insurance',
      'free_wallbox',
      'free_registration',
      'free_maintenance',
      'fuel_or_recharge_voucher',
      'other',
    ])
      expect(grid).toContain(type);
    expect(grid).not.toContain("['registration'");
    expect(grid).toContain('changeType');
    expect(grid).toContain('result.push(empty');
    expect(grid).toContain("pending ? 'Salvando lote…'");
    expect(grid).toContain('md:grid-cols');
  });
});
