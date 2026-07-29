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
  it('supports explicit checkboxes, financial summary, incompatibility and double-submit protection', () => {
    const ui = source('../src/components/admin/commercial-offer-builder.tsx');
    expect(ui).toContain('type="checkbox"');
    expect(ui).toContain('calculateCommercialOfferBenefit');
    expect(ui).toContain('calculateTransactionalPrice');
    expect(ui).toContain('Não cobre a vigência');
    expect(ui).toContain("pending ? 'Salvando…'");
    expect(ui).toContain('xl:grid-cols');
    expect(ui).toContain('Rascunhos recentes');
  });
});
