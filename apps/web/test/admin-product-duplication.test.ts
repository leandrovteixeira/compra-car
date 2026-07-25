import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AdministrativeProductDuplicationRepository } from '@compra-car/core';
import { describe, expect, it, vi } from 'vitest';

import { executeAdminProductDuplication } from '../src/application/admin/duplicate-admin-product';
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

function repository(
  options: {
    readonly duplicate?: boolean;
    readonly copyError?: Error;
  } = {},
): AdministrativeProductDuplicationRepository {
  return {
    findAdministrativeVehicleDuplicate: vi.fn(async () => options.duplicate ?? false),
    createAdministrativeVehicle: vi.fn(async () => ({ status: 'created', id: '84' }) as const),
    getAdministrativeVehicleById: vi.fn(async (id) =>
      id === '42'
        ? {
            id,
            brand: 'Toyota',
            model: 'Corolla Cross',
            version: 'XRX',
            modelYear: 2026,
            productionYear: 2025,
            isActive: true,
            isPublic: true,
          }
        : null,
    ),
    updateAdministrativeVehicle: vi.fn(async () => ({ status: 'updated' as const })),
    listAdministrativeProductSpecValues: vi.fn(async () => [
      { specId: '10', value: 198.5, isPresent: null, inputUnit: 'Nm' },
      { specId: '11', value: null, isPresent: false, inputUnit: null },
    ]),
    saveAdministrativeProductSpecs: vi.fn(async () => {
      if (options.copyError) throw options.copyError;
    }),
    rollbackAdministrativeVehicleDuplication: vi.fn(async () => undefined),
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

  it('uses the duplication action and shared editable form while binding the source ID', () => {
    const page = source('../src/app/admin/products/[id]/duplicate/page.tsx');
    const form = source('../src/components/admin/admin-product-form.tsx');
    const list = source('../src/components/admin/admin-product-list.tsx');

    expect(page).toContain("import { duplicateAdminProductAction } from './actions'");
    expect(page).toContain('if (!values) notFound()');
    expect(page).toContain('title="Duplicar veículo"');
    expect(page).toContain('initialValues={values}');
    expect(page).toContain('mode="duplicate"');
    expect(page).toContain('action={duplicateAdminProductAction.bind(null, id)}');
    expect(form).toContain("'Criar veículo'");
    expect(form).toContain("mode !== 'edit' && state.status === 'success'");
    expect(form).toContain('href={`/admin/products/${productId}/edit`}');
    expect(form).toContain('href={`/admin/products/${productId}/specs`}');
    expect(form).toContain('Revisar equipamentos copiados');
    expect(list).toContain('href={`/admin/products/${product.id}/duplicate`}');
    expect(list).toContain('Duplicar');
  });

  it('returns the normal Create conflict when the business key is unchanged', async () => {
    const target = repository({ duplicate: true });
    const result = await executeAdminProductDuplication('42', duplicateFormData(), {
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
    expect(target.listAdministrativeProductSpecValues).not.toHaveBeenCalled();
  });

  it('creates a normalized vehicle and copies the source specs to the new ID', async () => {
    const target = repository();
    const result = await executeAdminProductDuplication(
      '42',
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
    expect(target.saveAdministrativeProductSpecs).toHaveBeenCalledWith('84', {
      upserts: [
        { specId: '10', value: 198.5, isPresent: null, inputUnit: 'Nm' },
        { specId: '11', value: null, isPresent: false, inputUnit: null },
      ],
      deleteSpecIds: [],
    });
  });

  it('preserves the server-side Public implies Active validation', async () => {
    const target = repository();
    const result = await executeAdminProductDuplication(
      '42',
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

  it('does not report success or revalidate when copying specs fails', async () => {
    const target = repository({ copyError: new Error('copy failed') });
    const revalidate = vi.fn();
    const result = await executeAdminProductDuplication(
      '42',
      duplicateFormData({ modelYear: '2027', productionYear: '2026' }),
      {
        authorize: vi.fn(async () => undefined),
        createRepository: () => target,
        revalidate,
      },
    );

    expect(result).toMatchObject({
      status: 'error',
      message: expect.stringContaining('ficha técnica'),
    });
    expect(target.rollbackAdministrativeVehicleDuplication).toHaveBeenCalledWith('84');
    expect(revalidate).not.toHaveBeenCalled();
  });
});
