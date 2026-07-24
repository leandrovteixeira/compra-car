import type { AdministrativeVehicleRepository } from '@compra-car/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeAdminProductCreation } from '../src/application/admin/create-admin-product';

function formData(overrides: Readonly<Record<string, string>> = {}): FormData {
  const values = {
    brand: '  toyota ',
    model: 'corolla   cross',
    version: 'xrx',
    modelYear: '2026',
    productionYear: '2025',
    isActive: 'false',
    isPublic: 'false',
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function repository(
  options: {
    readonly duplicate?: boolean;
    readonly fail?: boolean;
  } = {},
): AdministrativeVehicleRepository {
  return {
    findAdministrativeVehicleDuplicate: vi.fn(async () => options.duplicate ?? false),
    createAdministrativeVehicle: vi.fn(async () => {
      if (options.fail) throw new Error('raw Supabase and SQL detail');
      return { status: 'created', id: '77' } as const;
    }),
  };
}

describe('administrative product creation orchestration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('authorizes before creating the privileged adapter', async () => {
    const order: string[] = [];
    await executeAdminProductCreation(formData(), {
      authorize: vi.fn(async () => {
        order.push('authorize');
      }),
      createRepository: () => {
        order.push('adapter');
        return repository();
      },
      revalidate: () => order.push('revalidate'),
    });
    expect(order).toEqual(['authorize', 'adapter', 'revalidate']);
  });

  it.each(['seller', 'missing session'])('does not create an adapter for %s', async () => {
    const createRepository = vi.fn(() => repository());
    await expect(
      executeAdminProductCreation(formData(), {
        authorize: vi.fn(async () => {
          throw new Error('redirect');
        }),
        createRepository,
        revalidate: vi.fn(),
      }),
    ).rejects.toThrow('redirect');
    expect(createRepository).not.toHaveBeenCalled();
  });

  it('normalizes, creates, returns the ID and revalidates the list', async () => {
    const target = repository();
    const revalidate = vi.fn();
    const result = await executeAdminProductCreation(formData(), {
      authorize: vi.fn(async () => undefined),
      createRepository: () => target,
      revalidate,
    });

    expect(result).toEqual(
      expect.objectContaining({ status: 'success', id: '77', fieldErrors: {} }),
    );
    expect(target.createAdministrativeVehicle).toHaveBeenCalledWith({
      brand: 'Toyota',
      model: 'Corolla cross',
      version: 'Xrx',
      modelYear: 2026,
      productionYear: 2025,
      isActive: false,
      isPublic: false,
    });
    expect(revalidate).toHaveBeenCalledWith('/admin/products');
  });

  it('returns the specific normalized duplicate message', async () => {
    const result = await executeAdminProductCreation(formData(), {
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

  it('returns a safe failure and never exposes the raw adapter error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await executeAdminProductCreation(formData(), {
      authorize: vi.fn(async () => undefined),
      createRepository: () => repository({ fail: true }),
      revalidate: vi.fn(),
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'Não foi possível cadastrar o veículo. Revise os dados e tente novamente.',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('Supabase');
    expect(JSON.stringify(result)).not.toContain('SQL');
  });
});
