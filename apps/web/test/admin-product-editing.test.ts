import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdministrativeVehicleRepository } from '@compra-car/core';
import { describe, expect, it, vi } from 'vitest';

import { executeAdminProductUpdate } from '../src/application/admin/update-admin-product';
import { loadAdminProductForEditing } from '../src/server/admin-product-service';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

function formData(overrides: Readonly<Record<string, string>> = {}): FormData {
  const data = new FormData();
  const values = {
    brand: '  toyota ',
    model: 'corolla   cross',
    version: 'xrx',
    modelYear: '2026',
    productionYear: '2025',
    isActive: 'true',
    isPublic: 'true',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function repository(
  options: { readonly duplicate?: boolean } = {},
): AdministrativeVehicleRepository {
  return {
    findAdministrativeVehicleDuplicate: vi.fn(async () => options.duplicate ?? false),
    getAdministrativeVehicleById: vi.fn(async () => null),
    createAdministrativeVehicle: vi.fn(async () => ({ status: 'created', id: '1' }) as const),
    updateAdministrativeVehicle: vi.fn(async () => ({ status: 'updated' as const })),
  };
}

describe('administrative product editing', () => {
  it('loads and maps the existing product into initial form values', async () => {
    await expect(
      loadAdminProductForEditing('42', {
        getAdministrativeVehicleById: vi.fn(async () => ({
          id: '42',
          brand: 'Toyota',
          model: 'Corolla',
          version: 'XRX',
          modelYear: 2026,
          productionYear: 2025,
          isActive: true,
          isPublic: false,
        })),
      }),
    ).resolves.toEqual({
      brand: 'Toyota',
      model: 'Corolla',
      version: 'XRX',
      modelYear: '2026',
      productionYear: '2025',
      isActive: true,
      isPublic: false,
    });
  });

  it('returns null for a missing product and the route delegates it to notFound', async () => {
    await expect(
      loadAdminProductForEditing('999', {
        getAdministrativeVehicleById: vi.fn(async () => null),
      }),
    ).resolves.toBeNull();
    expect(source('../src/app/admin/products/[id]/edit/page.tsx')).toContain(
      'if (!values) notFound()',
    );
  });

  it('authorizes, normalizes, updates, stays on edit and revalidates both views', async () => {
    const target = repository();
    const revalidate = vi.fn();
    const result = await executeAdminProductUpdate('42', formData(), {
      authorize: vi.fn(async () => undefined),
      createRepository: () => target,
      revalidate,
    });

    expect(result).toEqual({
      status: 'success',
      id: '42',
      values: {
        brand: 'Toyota',
        model: 'Corolla cross',
        version: 'Xrx',
        modelYear: '2026',
        productionYear: '2025',
        isActive: true,
        isPublic: true,
      },
      fieldErrors: {},
      message: 'Veículo atualizado com sucesso.',
    });
    expect(target.findAdministrativeVehicleDuplicate).toHaveBeenCalledWith(
      expect.objectContaining({ brand: 'Toyota', model: 'Corolla cross', version: 'Xrx' }),
      '42',
    );
    expect(target.updateAdministrativeVehicle).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ brand: 'Toyota', model: 'Corolla cross', version: 'Xrx' }),
    );
    expect(revalidate.mock.calls).toEqual([['/admin/products'], ['/admin/products/42/edit']]);
  });

  it('returns the same duplicate feedback used by creation', async () => {
    const result = await executeAdminProductUpdate('42', formData(), {
      authorize: vi.fn(async () => undefined),
      createRepository: () => repository({ duplicate: true }),
      revalidate: vi.fn(),
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'Já existe um veículo Toyota Corolla cross Xrx 2026/2025 cadastrado.',
      }),
    );
  });

  it('reuses one form, renders edit navigation and prevents duplicate submissions', () => {
    const form = source('../src/components/admin/admin-product-form.tsx');
    const page = source('../src/app/admin/products/[id]/edit/page.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(page).toContain('title="Editar veículo"');
    expect(page).toContain('initialValues={values}');
    expect(page).toContain('mode="edit"');
    expect(form).toContain("'Salvar alterações'");
    expect(form).toContain('disabled={pending}');
    expect(form).toContain('role="status"');
    expect(form).toContain('href={`/admin/products/${productId}/edit`}');
    expect(list).toContain('href={`/admin/products/${product.id}/edit`}');
    expect(list).toContain('Editar');
  });
});
