import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProductPublicPriceRepository } from '@compra-car/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/auth/authorization', () => ({ requireRole: vi.fn() }));

import { parseAdminPricePage } from '../src/application/admin/admin-price-query';
import {
  adminPriceStatusLabel,
  formatAdminDate,
  formatAdminPrice,
} from '../src/components/admin/admin-price-presentation';
import { loadAdminProductPublicPrices } from '../src/server/admin-product-public-price-service';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}
function repository(failure = false): ProductPublicPriceRepository {
  return {
    listProductPublicPrices: vi.fn(async () => {
      if (failure) throw new Error('sensitive Supabase detail');
      return { items: [], total: 0 };
    }),
  };
}

describe('admin ProductPublicPrice read slice', () => {
  afterEach(() => vi.restoreAllMocks());

  it('authorizes before creating the privileged pricing adapter', async () => {
    const order: string[] = [];
    await loadAdminProductPublicPrices(
      {},
      {
        authorize: vi.fn(async () => {
          order.push('authorize');
        }),
        createRepository: () => {
          order.push('adapter');
          return repository();
        },
      },
    );
    expect(order).toEqual(['authorize', 'adapter']);
  });

  it('returns an empty successful page and safe repository errors', async () => {
    await expect(
      loadAdminProductPublicPrices(
        {},
        { authorize: vi.fn(async () => undefined), createRepository: () => repository() },
      ),
    ).resolves.toMatchObject({ ok: true, data: { items: [], total: 0 } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      loadAdminProductPublicPrices(
        {},
        { authorize: vi.fn(async () => undefined), createRepository: () => repository(true) },
      ),
    ).resolves.toEqual({ ok: false });
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('sensitive'));
  });

  it('normalizes pagination and formats critical values in pt-BR', () => {
    expect(parseAdminPricePage({ page: '2' })).toBe(2);
    expect(parseAdminPricePage({ page: '-1' })).toBe(1);
    expect(formatAdminPrice('159990.00', 'BRL')).toContain('159.990,00');
    expect(formatAdminDate('2026-07-01')).toBe('01/07/2026');
    expect(formatAdminDate(null)).toBe('Sem término');
    expect(adminPriceStatusLabel('needs_review')).toBe('Requer revisão');
  });

  it('uses the existing admin boundary and exposes no write controls', () => {
    const page = source('../src/app/admin/prices/page.tsx');
    const list = source('../src/components/admin/admin-price-list.tsx');
    const service = source('../src/server/admin-product-public-price-service.ts');
    expect(page).toContain("await requireRole('admin')");
    expect(page).toContain('<AdminPriceError');
    expect(page).toContain('<EmptyState');
    expect(page).toContain('<AdminPriceList');
    expect(page).not.toContain('supabase');
    expect(list).not.toMatch(/Criar|Editar|Excluir|Publicar/);
    expect(service).toContain('ProductPublicPriceSupabaseAdapter');
    expect(service.indexOf('await dependencies.authorize()')).toBeLessThan(
      service.indexOf('dependencies.createRepository()'),
    );
  });
});
