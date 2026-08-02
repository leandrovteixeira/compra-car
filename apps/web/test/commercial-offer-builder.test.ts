import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLiveOfferSelections } from '../src/application/admin/commercial-offer-builder';
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
    expect(ui).toContain('periodEnd, periodKind');
    expect(ui).toContain("draft.validTo ?? 'aberta'");
    expect(ui).toContain('min-w-[64rem]');
    expect(ui).toContain('align-middle');
    expect(ui).toContain('data-offer-kind="existing"');
    expect(ui).toContain("data-offer-kind={row.policyIds.length ? 'new' : 'trailing'}");
    expect(ui).toContain('Informações da Offer');
    expect(ui).toContain('Somente leitura');
    expect(ui).toContain('replaceAction');
    expect(ui).toContain('archiveAction');
    expect(ui).toContain('border-rose-800 bg-rose-950/20');
    expect(ui).not.toContain('Combinações existentes');
    expect(ui).not.toContain('MSRP-base');
    expect(ui).not.toContain('type="date"');
  });
  it('releases and consumes Policies from checkbox state before persistence', () => {
    const draft = {
      id: '30',
      productId: '616',
      publicPriceAmount: '189990.00',
      validFrom: '2026-09-01',
      validTo: '2026-09-30',
      status: 'draft' as const,
      policyCount: 2,
      benefitAmount: '15000.00',
      transactionalPrice: '174990.00',
      policyIds: ['bonus', 'trade-in'],
      lockVersion: 1,
    };
    expect(buildLiveOfferSelections([draft], { '30': ['trade-in'] }, [])).toEqual({
      '30': ['trade-in'],
    });
    expect(
      buildLiveOfferSelections([draft], { '30': ['trade-in'] }, [
        { clientRowId: 'row-2', productId: '616', policyIds: ['ipva'] },
      ]),
    ).toEqual({ '30': ['trade-in'], 'new:row-2': ['ipva'] });
  });
  it('logs server failures with correlation ID and no submitted payload', () => {
    const application = source('../src/application/admin/commercial-offer-builder.ts');
    expect(application).toContain("console.error('Policy combination batch failed.'");
    expect(application).toContain('correlationId');
    expect(application).not.toContain('console.error(rows');
  });
});
