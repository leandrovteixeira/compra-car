import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAdminProductFilters } from '../src/application/admin/admin-product-filters';
import {
  createModelYearOptions,
  createProductionYearOptions,
  modelYearAfterProductionYearChange,
} from '../src/application/admin/vehicle-year-options';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

describe('administrative vehicle year options', () => {
  it('generates production years from current year + 2 through 2001', () => {
    const options = createProductionYearOptions(2026);
    expect(options[0]).toBe(2028);
    expect(options.at(-1)).toBe(2001);
    expect(options).toHaveLength(28);
    expect(options.every((year, index) => index === 0 || year === options[index - 1]! - 1)).toBe(
      true,
    );
  });

  it('offers only production year and production year + 1 for model', () => {
    expect(createModelYearOptions('2026', 2026)).toEqual([2027, 2026]);
    expect(createModelYearOptions('', 2026)).toEqual([]);
  });

  it('clears model when a production year change makes it invalid', () => {
    expect(modelYearAfterProductionYearChange('2026', '2027', 2026)).toBe('2027');
    expect(modelYearAfterProductionYearChange('2027', '2026', 2026)).toBe('');
  });

  it('renders dependent selects and preserves boolean coupling without visual containers', () => {
    const form = source('../src/components/admin/admin-product-form.tsx');
    expect(form).toContain('<select');
    expect(form).toContain('name="modelYear"');
    expect(form).toContain('name="productionYear"');
    expect(form).toContain('disabled={!productionYear}');
    expect(form).toContain('createModelYearOptions(productionYear, currentYear)');
    expect(form.indexOf('Ano produção')).toBeLessThan(form.indexOf('Ano modelo'));
    expect(form).toContain('if (checked) setIsActive(true)');
    expect(form).toContain('if (!checked) setIsPublic(false)');
    expect(form).not.toContain('min-h-20');
    expect(form).not.toContain('bg-slate-950/60');
  });
});

describe('administrative product filters', () => {
  it('trims unified search, parses booleans and combines filters', () => {
    expect(
      parseAdminProductFilters({
        search: '  Toyota Corolla XRX  ',
        active: 'false',
        public: 'true',
      }),
    ).toEqual({
      filters: {
        isActive: false,
        isPublic: true,
      },
      values: {
        search: 'Toyota Corolla XRX',
        active: 'false',
        public: 'true',
      },
      hasFilters: true,
    });
  });

  it('ignores empty and invalid URL filters', () => {
    expect(parseAdminProductFilters({ search: ' ', active: 'invalid' })).toEqual({
      filters: {},
      values: { search: '', active: '', public: '' },
      hasFilters: false,
    });
  });

  it('uses debounced URL search without a manual filter action', () => {
    const filters = source('../src/components/admin/admin-product-filters.tsx');
    const page = source('../src/app/admin/products/page.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(filters).toContain("'use client'");
    expect(filters).toContain('name="search"');
    expect(filters).toContain('Buscar marca, modelo ou versão...');
    expect(filters).toContain('window.setTimeout');
    expect(filters).toContain('275');
    expect(filters).toContain('name="active"');
    expect(filters).toContain('name="public"');
    expect(filters).toContain('Limpar');
    expect(filters).not.toContain('Filtrar');
    expect(page.indexOf("await requireRole('admin')")).toBeLessThan(
      page.indexOf('loadAdminProducts(parsed.filters'),
    );
    expect(filters).not.toContain('supabase');
    expect(list).toContain('Editar');
    expect(list).not.toContain('Excluir');
    expect(list).toContain('Duplicar');
  });

  it('keeps the boolean controls close without reducing their interaction area', () => {
    const form = source('../src/components/admin/admin-product-form.tsx');
    expect(form).toContain('lg:grid-cols-[1fr_1fr_auto_auto]');
    expect(form).toContain('lg:gap-x-4');
    expect(form.match(/min-h-11 min-w-24 cursor-pointer/g)).toHaveLength(2);
  });

  it('uses accumulated desktop sticky offsets without a competing vertical scroll', () => {
    const shell = source('../src/components/admin/admin-shell.tsx');
    const topbar = source('../src/components/application-topbar.tsx');
    const css = source('../src/app/globals.css');
    const page = source('../src/app/admin/products/page.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(shell).toContain('<ApplicationTopbar');
    expect(topbar).toContain('sticky top-0 z-40');
    expect(page).toContain('admin-catalog-sticky');
    expect(list).toContain('admin-catalog-table-header');
    expect(shell).toContain('lg:pt-0');
    expect(css).toContain('--admin-catalog-sticky-height: 9.5rem');
    expect(css).toContain(
      'top: calc(var(--admin-topbar-height) + var(--admin-catalog-sticky-height))',
    );
    expect(list).toContain('overflow-x-auto lg:overflow-visible');
    expect(list).not.toMatch(/overflow-y-(?:auto|scroll)/);
  });

  it('keeps every supplied row in the table mapping', () => {
    const list = source('../src/components/admin/admin-product-list.tsx');
    expect(list).toContain('products.map((product)');
    expect(list).toContain('key={product.id}');
    expect(list).toContain('products.length');
    expect(list).toContain('{product.productionYear}/{product.modelYear}');
    expect(list).toContain('Editar');
    expect(list).toContain('Duplicar');
    expect(list).toContain('Especificações');
  });
});
