import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAdminProductFilters } from '../src/application/admin/admin-product-filters';
import {
  createModelYearOptions,
  createProductionYearOptions,
  productionYearAfterModelYearChange,
} from '../src/application/admin/vehicle-year-options';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

describe('administrative vehicle year options', () => {
  it('generates current year + 2 through 2001 in descending order', () => {
    const options = createModelYearOptions(2026);
    expect(options[0]).toBe(2028);
    expect(options.at(-1)).toBe(2001);
    expect(options).toHaveLength(28);
    expect(options.every((year, index) => index === 0 || year === options[index - 1]! - 1)).toBe(
      true,
    );
  });

  it('offers only model year and model year - 1 for production', () => {
    expect(createProductionYearOptions('2027')).toEqual([2027, 2026]);
    expect(createProductionYearOptions('')).toEqual([]);
  });

  it('clears production when a model year change makes it invalid', () => {
    expect(productionYearAfterModelYearChange('2027', '2026')).toBe('2026');
    expect(productionYearAfterModelYearChange('2028', '2026')).toBe('');
  });

  it('renders dependent selects and preserves boolean coupling without visual containers', () => {
    const form = source('../src/components/admin/admin-product-form.tsx');
    expect(form).toContain('<select');
    expect(form).toContain('name="modelYear"');
    expect(form).toContain('name="productionYear"');
    expect(form).toContain('disabled={!modelYear}');
    expect(form).toContain('createProductionYearOptions(modelYear)');
    expect(form).toContain('if (checked) setIsActive(true)');
    expect(form).toContain('if (!checked) setIsPublic(false)');
    expect(form).not.toContain('min-h-20');
    expect(form).not.toContain('bg-slate-950/60');
  });
});

describe('administrative product filters', () => {
  it('trims text, parses booleans and combines all filters', () => {
    expect(
      parseAdminProductFilters({
        vehicle: '  Corolla  ',
        brand: ' Toyota ',
        version: ' XRX ',
        active: 'false',
        public: 'true',
      }),
    ).toEqual({
      filters: {
        model: 'Corolla',
        brand: 'Toyota',
        version: 'XRX',
        isActive: false,
        isPublic: true,
      },
      values: {
        vehicle: 'Corolla',
        brand: 'Toyota',
        version: 'XRX',
        active: 'false',
        public: 'true',
      },
      hasFilters: true,
    });
  });

  it('ignores empty and invalid URL filters', () => {
    expect(parseAdminProductFilters({ vehicle: ' ', active: 'invalid' })).toEqual({
      filters: {},
      values: { vehicle: '', brand: '', version: '', active: '', public: '' },
      hasFilters: false,
    });
  });

  it('uses GET search params, provides a clean URL and keeps Supabase out of the client', () => {
    const filters = source('../src/components/admin/admin-product-filters.tsx');
    const page = source('../src/app/admin/products/page.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(filters).toContain('method="get"');
    expect(filters).toContain('action="/admin/products"');
    expect(filters).toContain('name="vehicle"');
    expect(filters).toContain('name="brand"');
    expect(filters).toContain('name="version"');
    expect(filters).toContain('name="active"');
    expect(filters).toContain('name="public"');
    expect(filters).toContain('href="/admin/products"');
    expect(filters.indexOf('Marca')).toBeLessThan(filters.indexOf('Modelo'));
    expect(filters.indexOf('Modelo')).toBeLessThan(filters.indexOf('Versão'));
    expect(filters).toContain('name="vehicle"');
    expect(filters).toContain('Limpar');
    expect(filters).not.toContain('Limpar filtros');
    expect(page.indexOf("await requireRole('admin')")).toBeLessThan(
      page.indexOf('loadAdminProducts(parsed.filters)'),
    );
    expect(filters).not.toContain("'use client'");
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
    const page = source('../src/app/admin/products/page.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(shell).toContain('sticky top-0 z-40');
    expect(page).toContain('lg:top-[4.25rem]');
    expect(page).toContain('lg:h-[15rem]');
    expect(list).toContain('lg:top-[19.25rem]');
    expect(list).toContain('overflow-x-auto lg:overflow-visible');
    expect(list).not.toMatch(/overflow-y-(?:auto|scroll)/);
  });

  it('keeps every supplied row in the table mapping', () => {
    const list = source('../src/components/admin/admin-product-list.tsx');
    expect(list).toContain('products.map((product)');
    expect(list).toContain('key={product.id}');
    expect(list).toContain('products.length');
  });
});
