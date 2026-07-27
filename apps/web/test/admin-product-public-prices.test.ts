import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProductPublicPriceRepository } from '@compra-car/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/auth/authorization', () => ({ requireRole: vi.fn() }));

import { parseAdminPricePage } from '../src/application/admin/admin-price-query';
import {
  amountToPtBrInput,
  canonicalAmountFromPtBr,
} from '../src/application/admin/product-public-price-form';
import {
  executeProductPublicPriceCreation,
  executeProductPublicPriceUpdate,
} from '../src/application/admin/save-product-public-price';
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
    createProductPublicPrice: vi.fn(),
    updateProductPublicPrice: vi.fn(),
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
    expect(formatAdminPrice('159990.00', 'BRL')).toMatch(/159\.990(?!,)/u);
    expect(formatAdminDate('2026-07-01')).toBe('01/07/2026');
    expect(formatAdminDate(null)).toBe('Sem término');
    expect(adminPriceStatusLabel('needs_review')).toBe('Requer revisão');
    expect(canonicalAmountFromPtBr('159.990,50')).toBe('159990.50');
    expect(canonicalAmountFromPtBr('159.990')).toBe('159990');
    expect(amountToPtBrInput('249990.50')).toBe('249.990,50');
  });

  it('creates with the authenticated actor and preserves field errors', async () => {
    const target = repository();
    vi.mocked(target.createProductPublicPrice).mockResolvedValue({
      id: '3',
      product: { id: '608', brand: 'BYD', model: 'Dolphin', version: 'GS', modelYear: '2027' },
      money: { amount: '159990.50', currencyCode: 'BRL' },
      startsOn: '2026-08-01',
      endsOn: null,
      status: 'draft',
      publishedAt: null,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
      lockVersion: 1,
    });
    const revalidate = vi.fn();
    const form = new FormData();
    form.set('productId', '608');
    form.set('amount', '159.990,50');
    form.set('startsOn', '2026-08-01');
    await expect(
      executeProductPublicPriceCreation(form, {
        authorize: vi.fn(async () => ({ actorId: 'server-actor' })),
        createRepository: () => target,
        revalidate,
      }),
    ).resolves.toMatchObject({ status: 'success' });
    expect(target.createProductPublicPrice).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'server-actor', amount: '159990.50' }),
    );
    expect(revalidate).toHaveBeenCalledWith('/admin/prices');

    form.set('amount', 'inválido');
    await expect(
      executeProductPublicPriceCreation(form, {
        authorize: vi.fn(async () => ({ actorId: 'server-actor' })),
        createRepository: () => target,
        revalidate,
      }),
    ).resolves.toMatchObject({ status: 'error', fieldErrors: { amount: expect.any(Array) } });
  });

  it('keeps update conflicts distinguishable and sends lock version', async () => {
    const target = repository();
    vi.mocked(target.updateProductPublicPrice).mockResolvedValue({ status: 'conflict' });
    const form = new FormData();
    form.set('id', '3');
    form.set('productId', '608');
    form.set('amount', '159990,50');
    form.set('startsOn', '2026-08-01');
    form.set('lockVersion', '2');
    await expect(
      executeProductPublicPriceUpdate(form, {
        authorize: vi.fn(async () => ({ actorId: 'server-actor' })),
        createRepository: () => target,
        revalidate: vi.fn(),
      }),
    ).resolves.toMatchObject({
      status: 'conflict',
      message: expect.stringContaining('outro usuário'),
    });
    expect(target.updateProductPublicPrice).toHaveBeenCalledWith(
      expect.objectContaining({ expectedLockVersion: 2, actorId: 'server-actor' }),
    );
  });

  it('uses the existing admin boundary and exposes server-side write controls', () => {
    const page = source('../src/app/admin/prices/page.tsx');
    const list = source('../src/components/admin/admin-price-list.tsx');
    const service = source('../src/server/admin-product-public-price-service.ts');
    const manager = source('../src/components/admin/admin-price-manager.tsx');
    expect(page).toContain("await requireRole('admin')");
    expect(page).toContain('<AdminPriceError');
    expect(manager).toContain('<EmptyState');
    expect(manager).toContain('<AdminPriceList');
    expect(page).not.toContain('supabase');
    expect(list).toContain('Editar');
    expect(manager).toContain('Novo preço');
    expect(manager).toContain('Salvar rascunho');
    expect(manager).toContain('disabled={pending}');
    expect(manager).toContain('router.refresh()');
    expect(service).toContain('ProductPublicPriceSupabaseAdapter');
    expect(service.indexOf('await dependencies.authorize()')).toBeLessThan(
      service.indexOf('dependencies.createRepository()'),
    );
  });
});
