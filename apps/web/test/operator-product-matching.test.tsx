import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOperatorMatchingCatalog } from '../src/app/admin/imports/structured-policies/actions';
import { CommercialProductResolutionPreview } from '../src/components/admin/commercial-product-resolution-preview';
import { resolveCommercialProducts } from '@compra-car/core';
import { validContract } from '../../../packages/core/test/fixtures/import/structured-commercial-fixture';

const { guard, read, writes } = vi.hoisted(() => ({
  guard: vi.fn(),
  read: vi.fn(),
  writes: vi.fn(() => {
    throw new Error('No writes');
  }),
}));
vi.mock('@/auth/authorization', () => ({ requireRole: guard }));
vi.mock('@compra-car/adapter-supabase', () => ({
  LegacySupabaseAdapter: class {
    listOperatorMatchingProducts = read;
    createAdministrativeVehicle = writes;
    updateAdministrativeVehicle = writes;
  },
}));
const real = {
  id: 'real',
  brand: 'Jeep',
  model: 'Compass',
  version: 'Longitude 1.3 TGDI AT',
  productionYear: 2026,
  modelYear: 2026,
  isActive: true,
  isPublic: false,
};

describe('operator matching Web boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.mockResolvedValue(undefined);
    read.mockResolvedValue([real]);
  });
  it('loads real fallback identities through the Admin-only read action', async () => {
    expect(await loadOperatorMatchingCatalog()).toEqual({ ok: true, products: [real] });
    expect(guard).toHaveBeenCalledWith('admin');
    expect(read).toHaveBeenCalledTimes(1);
    expect(writes).not.toHaveBeenCalled();
  });
  it('blocks fallback catalog access before reading for unauthorized callers', async () => {
    guard.mockRejectedValueOnce(new Error('Denied'));
    await expect(loadOperatorMatchingCatalog()).rejects.toThrow('Denied');
    expect(read).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });
  it('returns a retryable safe error without exposing catalog details', async () => {
    read.mockRejectedValueOnce(new Error('secret connection detail'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = await loadOperatorMatchingCatalog();
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('secret');
      expect(writes).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it('offers inline resolution and next-pending controls without publication', () => {
    const resolution = resolveCommercialProducts(validContract().products, [real]);
    const html = renderToStaticMarkup(
      createElement(CommercialProductResolutionPreview, { resolution, initialCatalog: [real] }),
    );
    expect(html).toContain('Resolver');
    expect(html).toContain('Próximo pendente');
    expect(html).toContain('<strong>0</strong> OPERATOR_MATCHED');
    expect(html).toContain('<strong>1</strong> PENDING');
    expect(html).not.toMatch(/READY_TO_APPLY|>Apply<|>Publicar</u);
  });
  it('presents final resolution when the exact stage already matches everything', () => {
    const resolution = resolveCommercialProducts(validContract().products, [
      { ...real, version: 'Longitude' },
    ]);
    const html = renderToStaticMarkup(
      createElement(CommercialProductResolutionPreview, { resolution, initialCatalog: [real] }),
    );
    expect(html).toContain('PRODUCTS_RESOLVED');
    expect(html).toContain('Produtos resolvidos · 1 / 1');
    expect(html).not.toContain('>Resolver<');
  });
});
