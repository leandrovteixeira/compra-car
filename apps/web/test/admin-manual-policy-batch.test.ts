import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('admin manual policy batch', () => {
  it('keeps authorization and server-only dependencies outside the browser', () => {
    const page = source('../src/app/admin/prices/policies/input/page.tsx');
    const action = source('../src/app/admin/prices/policies/input/actions.ts');
    const service = source('../src/server/manual-policy-batch-service.ts');
    const application = source('../src/application/admin/manual-policy-batch.ts');
    expect(page).toContain("await requireRole('admin')");
    expect(page).not.toContain('supabase');
    expect(action).toContain("'use server'");
    expect(service).toContain("requireRole('admin')");
    expect(service).toContain('randomUUID');
    expect(application).toContain('{ correlationId, error }');
  });

  it('renders all current types, dynamic fields and batch safeguards', () => {
    const grid = source('../src/components/admin/admin-policy-batch-grid.tsx');
    expect(grid).toContain('Object.entries(MANUAL_POLICY_DISPLAY_LABELS)');
    expect(grid).not.toContain("['registration'");
    expect(grid).toContain('changeType');
    expect(grid).toContain('result.push(empty');
    expect(grid).toContain("pending ? 'Salvando…'");
    expect(grid).toContain('/10 políticas');
    expect(grid).toContain('lg:grid-cols-');
    expect(grid).toContain('lg:overflow-x-visible');
    expect(grid).toContain('formatPtBrMoneyInput');
    expect(grid).toContain('formatPtBrPercentageInput');
    expect(grid).toContain("'loyalty_bonus'");
    expect(grid).toContain('<AdminProductCombobox');
    expect(grid).toContain('<span>Veículo</span>');
    expect(grid).toContain('<span>Rebate</span>');
    expect(grid).not.toContain('<span>Descrição</span>');
    expect(grid).toContain('DescriptionDialog');
    expect(grid).toContain('Adicionar descrição');
    expect(grid).toContain('⊖');
    expect(grid).toContain('title="Remover política"');
    expect(grid).toContain("'invoice_discount'");
    expect(grid).not.toContain('MSRP publicado');
    expect(grid).not.toContain('Alíquota anual');
    expect(grid).not.toContain('Principal financiado');
    expect(grid).not.toContain('Fim (opcional)');
    expect(grid).not.toContain('>Título<');
  });
});
