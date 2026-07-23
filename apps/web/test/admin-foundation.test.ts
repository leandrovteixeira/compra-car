import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { adminNavigationItems } from '../src/components/admin/admin-navigation';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

describe('admin foundation', () => {
  it('keeps server-side admin authorization at the persistent layout boundary', () => {
    const layout = source('../src/app/admin/layout.tsx');

    expect(layout).toContain("await requireRole('admin')");
    expect(layout).toContain('<AdminShell');
    expect(layout).not.toContain('user_metadata');
  });

  it('publishes overview and products links from one navigation definition', () => {
    expect(adminNavigationItems.filter((item) => item.status === 'active')).toEqual([
      { href: '/admin', label: 'Visão geral', status: 'active' },
      { href: '/admin/products', label: 'Veículos', status: 'active' },
    ]);
  });

  it('marks future modules as unavailable', () => {
    const plannedLabels = adminNavigationItems
      .filter((item) => item.status === 'planned')
      .map((item) => item.label);
    const navigation = source('../src/components/admin/admin-nav.tsx');

    expect(plannedLabels).toEqual([
      'Equipamentos',
      'Categorias',
      'Marcas',
      'Importação',
      'Usuários',
      'Configurações',
    ]);
    expect(navigation).toContain('aria-disabled="true"');
    expect(navigation).toContain('Em breve');
  });

  it('keeps seller access and logout in the admin account controls', () => {
    const account = source('../src/components/admin/admin-account.tsx');

    expect(account).toContain('href="/"');
    expect(account).toContain('Área do vendedor');
    expect(account).toContain('<AppLogoutControl');
  });

  it('loads products only after explicit admin authorization and keeps creation unavailable', () => {
    const page = source('../src/app/admin/products/page.tsx');

    expect(page.indexOf("await requireRole('admin')")).toBeLessThan(
      page.indexOf('await loadAdminProducts()'),
    );
    expect(page).toContain('title="Veículos"');
    expect(page).toContain('Novo veículo');
    expect(page).toContain('disabled');
    expect(page).toContain('<AdminProductList products={result.data}');
    expect(page).toContain('Nenhum veículo cadastrado');
    expect(page).toContain('<AdminProductError');
    expect(page).not.toContain("'use client'");
    expect(page).not.toContain('createClient');
    expect(page).not.toContain('supabase');
  });

  it('does not add CRUD controls or links to nonexistent product actions', () => {
    const page = source('../src/app/admin/products/page.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(page).not.toMatch(/href=["']\/admin\/products\/(?:new|\$\{)/);
    expect(list).not.toContain('Editar');
    expect(list).not.toContain('Excluir');
    expect(list).not.toContain('Duplicar');
    expect(list).not.toContain('<Link');
  });
});
