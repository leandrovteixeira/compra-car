import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdministrativeVehicleRepository } from '@compra-car/core';
import { describe, expect, it, vi } from 'vitest';

import { executeAdminProductCreation } from '../src/application/admin/create-admin-product';
import { loadAdminProductForEditing } from '../src/server/admin-product-service';

function source(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

function duplicateFormData(overrides: Readonly<Record<string, string>> = {}): FormData {
  const data = new FormData();
  const values = {
    brand: 'Toyota',
    model: 'Corolla Cross',
    version: 'XRX',
    modelYear: '2026',
    productionYear: '2025',
    isActive: 'true',
    isPublic: 'true',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function repository(duplicate = false): AdministrativeVehicleRepository {
  return {
    findAdministrativeVehicleDuplicate: vi.fn(async () => duplicate),
    createAdministrativeVehicle: vi.fn(async () => ({ status: 'created', id: '84' }) as const),
    getAdministrativeVehicleById: vi.fn(async () => null),
    updateAdministrativeVehicle: vi.fn(async () => ({ status: 'updated' as const })),
  };
}

describe('administrative product duplication', () => {
  it('loads all seven copied fields and returns null for a missing source', async () => {
    const reader = {
      getAdministrativeVehicleById: vi.fn(async (id: string) =>
        id === '42'
          ? {
              id: '42',
              brand: 'Toyota',
              model: 'Corolla Cross',
              version: 'XRX',
              modelYear: 2026,
              productionYear: 2025,
              isActive: true,
              isPublic: false,
            }
          : null,
      ),
    };

    await expect(loadAdminProductForEditing('42', reader)).resolves.toEqual({
      brand: 'Toyota',
      model: 'Corolla Cross',
      version: 'XRX',
      modelYear: '2026',
      productionYear: '2025',
      isActive: true,
      isPublic: false,
    });
    await expect(loadAdminProductForEditing('999', reader)).resolves.toBeNull();
  });

  it('uses the Create action and shared form without carrying the source ID', () => {
    const page = source('../src/app/admin/products/[id]/duplicate/page.tsx');
    const form = source('../src/components/admin/admin-product-form.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(page).toContain(
      "import { createAdminProductAction } from '@/app/admin/products/new/actions'",
    );
    expect(page).toContain('if (!values) notFound()');
    expect(page).toContain('title="Duplicar veículo"');
    expect(page).toContain('initialValues={values}');
    expect(page).toContain('mode="duplicate"');
    expect(page).toContain('action={createAdminProductAction}');
    expect(page).not.toContain('bind(null, id)');
    expect(form).toContain("'Criar veículo'");
    expect(form).toContain("mode !== 'edit' && state.status === 'success'");
    expect(form).toContain('href={`/admin/products/${productId}/edit`}');
    expect(list).toContain('href={`/admin/products/${product.id}/duplicate`}');
    expect(list).toContain('Duplicar');
  });

  it('returns the normal Create conflict when the business key is unchanged', async () => {
    const target = repository(true);
    const result = await executeAdminProductCreation(duplicateFormData(), {
      authorize: vi.fn(async () => undefined),
      createRepository: () => target,
      revalidate: vi.fn(),
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'Já existe um veículo Toyota Corolla Cross XRX 2026/2025 cadastrado.',
      }),
    );
    expect(target.createAdministrativeVehicle).not.toHaveBeenCalled();
  });

  it('creates a new normalized vehicle after a field changes and copies no related data', async () => {
    const target = repository();
    const result = await executeAdminProductCreation(
      duplicateFormData({ version: '  xrx   premium ' }),
      {
        authorize: vi.fn(async () => undefined),
        createRepository: () => target,
        revalidate: vi.fn(),
      },
    );

    expect(result).toEqual(expect.objectContaining({ status: 'success', id: '84' }));
    expect(target.createAdministrativeVehicle).toHaveBeenCalledWith({
      brand: 'Toyota',
      model: 'Corolla Cross',
      version: 'Xrx premium',
      modelYear: 2026,
      productionYear: 2025,
      isActive: true,
      isPublic: true,
    });
    expect(Object.keys(target).sort()).toEqual([
      'createAdministrativeVehicle',
      'findAdministrativeVehicleDuplicate',
      'getAdministrativeVehicleById',
      'updateAdministrativeVehicle',
    ]);
  });

  it('preserves the server-side Public implies Active validation', async () => {
    const target = repository();
    const result = await executeAdminProductCreation(
      duplicateFormData({ isActive: 'false', isPublic: 'true' }),
      {
        authorize: vi.fn(async () => undefined),
        createRepository: () => target,
        revalidate: vi.fn(),
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        fieldErrors: expect.objectContaining({ isPublic: expect.any(Array) }),
      }),
    );
    expect(target.createAdministrativeVehicle).not.toHaveBeenCalled();
  });
});
