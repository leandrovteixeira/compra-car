import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');

describe('commercial period workspace', () => {
  it('uses one vehicle selector and protects unsaved changes', () => {
    const workspace = source('../src/components/admin/commercial-policy-workspace.tsx');
    expect(workspace).toContain('<AdminProductCombobox');
    expect(workspace).toContain('Existem alterações não salvas');
    expect(workspace).toContain('setDirty(false)');
    expect(workspace).toContain('onSaved={saved}');
    expect(workspace).toContain("isUsed ? 'Em uso' : 'Livre'");
    expect(workspace).toContain("draft: 'Rascunho'");
    expect(workspace).toContain('Políticas salvas com sucesso.');
    expect(workspace).toContain('<AdminPolicyBatchGrid');
    expect(workspace).toContain('<CommercialOfferBuilder');
    expect(workspace).toContain('data-testid="monthly-operation-header"');
    expect(workspace).toContain(
      'lg:grid-cols-[minmax(0,11fr)_minmax(16rem,5fr)_minmax(13rem,4fr)]',
    );
    expect(workspace).toContain('monthlyCompetenceOptions()');
    expect(workspace).toContain('aria-label="Competência mensal"');
    expect(workspace).toContain('className="mt-1 min-h-11 w-full');
    expect(workspace).toContain('className="mt-2 flex min-h-7 items-center');
    expect(workspace).toContain('Período especial');
    expect(workspace).toContain('Preço válido');
    expect(workspace).toContain('Nenhum preço público aplicável');
    expect(workspace).toContain('Adicionar preço');
    expect(workspace).toContain('<PriceDialog');
    expect(workspace).toContain('publishAction={props.publishPriceAction}');
    expect(workspace).toContain('offerSelectionOverrides');
    expect(workspace).not.toContain('Informações do preço válido');
    expect(workspace).toContain('periodStart={period.start}');
    expect(workspace).toContain('periodEnd={period.end}');
    expect(workspace).not.toContain('Rollover é avaliado por tipo ao salvar');
    expect(workspace).not.toContain('Mês anterior');
    expect(workspace).not.toContain('Próximo mês');
  });

  it('marks dirty before the row state update and excludes empty support rows from payload', () => {
    const grid = source('../src/components/admin/admin-policy-batch-grid.tsx');
    expect(grid).toMatch(/onDirty\?\.\(\);\r?\n    setRows\(\(current\) =>/);
    expect(grid).not.toContain('setRows((current) => {\n      onDirty?.();');
    expect(grid).toContain('.filter((row) => !isEmpty(row))');
    expect(grid).not.toContain('type="date"');
    expect(grid).toContain('Salvar políticas');
    expect(grid).toContain('Remover política');
    expect(grid).not.toContain('Veículo selecionado');
    expect(grid).toContain('min-h-11 items-center justify-center gap-2');
    expect(grid).toContain('autoComplete="off"');
    expect(grid).toContain('inputMode="numeric"');
    expect(grid).toContain('inputMode="decimal"');
  });

  it('rebuilds the combination row for the selected Product after a successful reload', () => {
    const builder = source('../src/components/admin/commercial-offer-builder.tsx');
    const workspace = source('../src/components/admin/commercial-policy-workspace.tsx');
    expect(builder).toContain("productId: productId ?? ''");
    expect(builder).toContain('row.policyIds.length > 0');
    expect(builder).toContain('withTrailingEmpty');
    expect(builder).toContain('rows.filter((row) => row.policyIds.length > 0)');
    expect(builder).toContain('nova(s) não salva(s)');
    expect(workspace).toContain('router.refresh()');
    expect(workspace).toContain('MANUAL_POLICY_DISPLAY_LABELS[policy.policyType]');
  });

  it('uses shared stacked sticky offsets for pricing headers', () => {
    const css = source('../src/app/globals.css');
    const pageHeader = source('../src/components/admin/page-header.tsx');
    const priceList = source('../src/components/admin/admin-price-list.tsx');
    expect(css).toContain('--admin-topbar-height: 3.75rem');
    expect(css).toContain('--admin-page-header-height: 7.75rem');
    expect(css).toContain('margin-top: -2rem');
    expect(css).toContain(
      'top: calc(var(--admin-topbar-height) + var(--admin-page-header-height))',
    );
    expect(pageHeader).toContain("sticky ? 'admin-page-header' : ''");
    expect(priceList).toContain('admin-table-header');
    expect(priceList).toContain('lg:overflow-visible');
  });

  it('connects the four administrative RPCs through server-only actions', () => {
    const service = source('../src/server/commercial-policy-workspace-service.ts');
    const adapter = source(
      '../../../packages/adapter-supabase/src/commercial-offer-builder-supabase-adapter.ts',
    );
    expect(service).toContain("requireRole('admin')");
    expect(service).toContain('randomUUID()');
    expect(adapter).toContain("rpc('update_commercial_policy_draft'");
    expect(adapter).toContain("rpc('archive_commercial_policy'");
    expect(adapter).toContain("rpc('replace_commercial_offer_draft'");
    expect(adapter).toContain("rpc('archive_commercial_offer'");
  });

  it('publishes prices through the existing RPC and removes individual creation CTA', () => {
    const adapter = source(
      '../../../packages/adapter-supabase/src/product-public-price-supabase-adapter.ts',
    );
    const manager = source('../src/components/admin/admin-price-manager.tsx');
    const list = source('../src/components/admin/admin-price-list.tsx');
    expect(adapter).toContain("rpc('publish_product_public_price'");
    expect(manager).not.toContain('Novo preço');
    expect(list).toContain('Publicar preço?');
    expect(list).toContain('onPublished');
  });
});
