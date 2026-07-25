import { describe, expect, it, vi } from 'vitest';

import {
  DuplicateAdministrativeVehicle,
  type AdministrativeProductDuplicationRepository,
  type AdministrativeProductSpecsBatch,
  type AdministrativeProductSpecValue,
  type AdministrativeVehicleInput,
} from '../src';

const input: AdministrativeVehicleInput = {
  brand: 'Toyota',
  model: 'Corolla Cross',
  version: 'XRX',
  modelYear: 2027,
  productionYear: 2026,
  isActive: true,
  isPublic: true,
};

const sourceSpecs: readonly AdministrativeProductSpecValue[] = [
  { specId: 'numeric', value: 198.5, isPresent: null, inputUnit: 'Nm' },
  { specId: 'binary-true', value: null, isPresent: true, inputUnit: null },
  { specId: 'binary-false', value: null, isPresent: false, inputUnit: null },
  { specId: 'scale', value: null, isPresent: true, inputUnit: null },
];

function repository(
  options: {
    readonly specs?: readonly AdministrativeProductSpecValue[];
    readonly creationError?: Error;
    readonly copyError?: Error;
    readonly rollbackError?: Error;
  } = {},
) {
  const copiedByProduct = new Map<string, AdministrativeProductSpecValue[]>();
  const target: AdministrativeProductDuplicationRepository = {
    findAdministrativeVehicleDuplicate: vi.fn(async () => false),
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
    createAdministrativeVehicle: vi.fn(async () => {
      if (options.creationError) throw options.creationError;
      return { status: 'created', id: '84' } as const;
    }),
    updateAdministrativeVehicle: vi.fn(async () => ({ status: 'updated' as const })),
    listAdministrativeProductSpecValues: vi.fn(async () => options.specs ?? sourceSpecs),
    saveAdministrativeProductSpecs: vi.fn(
      async (productId: string, batch: AdministrativeProductSpecsBatch) => {
        if (options.copyError) throw options.copyError;
        copiedByProduct.set(
          productId,
          batch.upserts.map((spec) => ({
            specId: spec.specId,
            value: spec.value,
            isPresent: spec.isPresent,
            inputUnit: spec.inputUnit,
          })),
        );
      },
    ),
    rollbackAdministrativeVehicleDuplication: vi.fn(async (productId) => {
      if (options.rollbackError) throw options.rollbackError;
      copiedByProduct.delete(productId);
    }),
  };
  return { target, copiedByProduct };
}

async function duplicate(
  target: AdministrativeProductDuplicationRepository,
): Promise<Awaited<ReturnType<DuplicateAdministrativeVehicle['execute']>>> {
  return new DuplicateAdministrativeVehicle(target).execute('42', input);
}

describe('DuplicateAdministrativeVehicle', () => {
  it('creates a new product with a new ID', async () => {
    const source = repository();
    await expect(duplicate(source.target)).resolves.toEqual({ ok: true, id: '84' });
    expect(source.target.createAdministrativeVehicle).toHaveBeenCalledWith(input);
  });

  it('copies every source spec to the new product ID', async () => {
    const source = repository();
    await duplicate(source.target);
    expect(source.target.listAdministrativeProductSpecValues).toHaveBeenCalledWith('42');
    expect(source.target.saveAdministrativeProductSpecs).toHaveBeenCalledWith('84', {
      upserts: sourceSpecs,
      deleteSpecIds: [],
    });
    expect(source.copiedByProduct.get('84')).toHaveLength(sourceSpecs.length);
  });

  it('preserves numeric values', async () => {
    const source = repository();
    await duplicate(source.target);
    expect(source.copiedByProduct.get('84')).toContainEqual(
      expect.objectContaining({ specId: 'numeric', value: 198.5 }),
    );
  });

  it('preserves binary true', async () => {
    const source = repository();
    await duplicate(source.target);
    expect(source.copiedByProduct.get('84')).toContainEqual(
      expect.objectContaining({ specId: 'binary-true', isPresent: true }),
    );
  });

  it('preserves explicit binary false', async () => {
    const source = repository();
    await duplicate(source.target);
    expect(source.copiedByProduct.get('84')).toContainEqual(
      expect.objectContaining({ specId: 'binary-false', isPresent: false }),
    );
  });

  it('preserves the selected scale association', async () => {
    const source = repository();
    await duplicate(source.target);
    expect(source.copiedByProduct.get('84')).toContainEqual(
      expect.objectContaining({ specId: 'scale', isPresent: true }),
    );
  });

  it('preserves input_unit', async () => {
    const source = repository();
    await duplicate(source.target);
    expect(source.copiedByProduct.get('84')).toContainEqual(
      expect.objectContaining({ specId: 'numeric', inputUnit: 'Nm' }),
    );
  });

  it('duplicates a source without specs without creating spec rows', async () => {
    const source = repository({ specs: [] });
    await expect(duplicate(source.target)).resolves.toEqual({ ok: true, id: '84' });
    expect(source.target.saveAdministrativeProductSpecs).not.toHaveBeenCalled();
  });

  it('creates independent spec objects whose later changes do not affect the source', async () => {
    const original = sourceSpecs.map((spec) => ({ ...spec }));
    const source = repository({ specs: original });
    await duplicate(source.target);
    source.copiedByProduct.get('84')![0] = {
      specId: 'numeric',
      value: 210,
      isPresent: null,
      inputUnit: 'Nm',
    };
    expect(original[0]?.value).toBe(198.5);
    expect(source.copiedByProduct.get('84')?.[0]?.value).toBe(210);
  });

  it('does not expose operations that copy prices, images or documents', async () => {
    const source = repository();
    const copyPrices = vi.fn();
    const copyImages = vi.fn();
    const copyDocuments = vi.fn();
    Object.assign(source.target, { copyPrices, copyImages, copyDocuments });
    await duplicate(source.target);
    expect(copyPrices).not.toHaveBeenCalled();
    expect(copyImages).not.toHaveBeenCalled();
    expect(copyDocuments).not.toHaveBeenCalled();
  });

  it('does not read or copy specs when product creation fails', async () => {
    const source = repository({ creationError: new Error('creation failed') });
    await expect(duplicate(source.target)).rejects.toThrow('creation failed');
    expect(source.target.listAdministrativeProductSpecValues).not.toHaveBeenCalled();
    expect(source.target.saveAdministrativeProductSpecs).not.toHaveBeenCalled();
  });

  it('does not return success when spec copying fails and compensates the new product', async () => {
    const source = repository({ copyError: new Error('copy failed') });
    const result = await duplicate(source.target);
    expect(result).toMatchObject({
      ok: false,
      code: 'SPEC_COPY_FAILED',
    });
    expect(result).not.toHaveProperty('incompleteProductId');
    expect(source.target.rollbackAdministrativeVehicleDuplication).toHaveBeenCalledWith('84');
  });

  it('identifies the incomplete product when copying and compensation both fail', async () => {
    const source = repository({
      copyError: new Error('copy failed'),
      rollbackError: new Error('rollback failed'),
    });
    await expect(duplicate(source.target)).resolves.toMatchObject({
      ok: false,
      code: 'SPEC_COPY_FAILED',
      incompleteProductId: '84',
    });
  });
});
