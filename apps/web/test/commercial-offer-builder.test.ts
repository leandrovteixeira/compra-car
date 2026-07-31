import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');
describe('commercial offer builder UI', () => {
  it('protects the route and keeps Supabase server-side', () => {
    const page = source('../src/app/admin/prices/offers/page.tsx');
    const action = source('../src/app/admin/prices/offers/actions.ts');
    const service = source('../src/server/commercial-offer-builder-service.ts');
    expect(page).toContain("await requireRole('admin')");
    expect(page).not.toContain('supabase');
    expect(action).toContain("'use server'");
    expect(service).toContain("requireRole('admin')");
    expect(service).toContain('randomUUID');
  });
  it('renders the deterministic matrix and submits one atomic batch', () => {
    const ui = source('../src/components/admin/commercial-offer-builder.tsx');
    expect(ui).toContain('POLICY_COMBINATION_COLUMNS');
    expect(ui).toContain('resolvePolicyCombinationCells');
    expect(ui).toContain('type="checkbox"');
    expect(ui).toContain('Conflito');
    expect(ui).toContain('Salvar ofertas');
    expect(ui).toContain("draft.validTo ?? 'aberta'");
    expect(ui).toContain('min-w-[76rem]');
    expect(ui).toContain('align-middle');
    expect(ui).toContain('Combinações existentes');
    expect(ui).not.toContain('MSRP-base');
    expect(ui).not.toContain('type="date"');
  });
  it('logs server failures with correlation ID and no submitted payload', () => {
    const application = source('../src/application/admin/commercial-offer-builder.ts');
    expect(application).toContain("console.error('Policy combination batch failed.'");
    expect(application).toContain('correlationId');
    expect(application).not.toContain('console.error(rows');
  });
});
