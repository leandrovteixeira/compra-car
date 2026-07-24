import { createVehicle, type Vehicle } from '@compra-car/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAdminProducts, type AdminProductReader } from '../src/server/admin-product-service';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    ...createVehicle({
      id: '1',
      brand: 'Marca',
      model: 'Modelo',
      version: 'Versão',
      modelYear: '2026',
      productionYear: '2025',
      isActive: true,
      isPublic: true,
    }),
    ...overrides,
  };
}

function reader(result: readonly Vehicle[] | Error): AdminProductReader {
  return {
    listAdministrativeVehicles: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

describe('admin product service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps and sorts returned products into the explicit admin DTO', async () => {
    const source = reader([
      vehicle({ id: '2' as Vehicle['id'], brand: 'Zulu' }),
      vehicle({ id: '1' as Vehicle['id'], brand: 'Alfa', isActive: false, isPublic: false }),
    ]);

    await expect(loadAdminProducts({}, source)).resolves.toEqual({
      ok: true,
      data: [
        {
          id: '1',
          brand: 'Alfa',
          model: 'Modelo',
          version: 'Versão',
          modelYear: '2026',
          productionYear: '2025',
          isActive: false,
          isPublic: false,
        },
        {
          id: '2',
          brand: 'Zulu',
          model: 'Modelo',
          version: 'Versão',
          modelYear: '2026',
          productionYear: '2025',
          isActive: true,
          isPublic: true,
        },
      ],
    });
    expect(source.listAdministrativeVehicles).toHaveBeenCalledWith({});
  });

  it('distinguishes a successful empty list from a query failure', async () => {
    await expect(loadAdminProducts({}, reader([]))).resolves.toEqual({ ok: true, data: [] });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(loadAdminProducts({}, reader(new Error('sensitive detail')))).resolves.toEqual({
      ok: false,
    });
    expect(console.error).toHaveBeenCalledWith('Admin product list could not be loaded.');
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('sensitive'));
  });

  it('forwards normalized filters to the server-side reader', async () => {
    const source = reader([]);
    const filters = {
      model: 'Corolla',
      brand: 'Toyota',
      version: 'XRX',
      isActive: false,
      isPublic: false,
    };

    await loadAdminProducts(filters, source);
    expect(source.listAdministrativeVehicles).toHaveBeenCalledWith(filters);
  });

  it('preserves a long server-side result set without client filtering or pagination', async () => {
    const vehicles = Array.from({ length: 30 }, (_, index) =>
      vehicle({
        id: String(index + 1) as Vehicle['id'],
        model: `Modelo ${String(index + 1).padStart(2, '0')}`,
      }),
    );
    const result = await loadAdminProducts({}, reader(vehicles));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(30);
  });
});
