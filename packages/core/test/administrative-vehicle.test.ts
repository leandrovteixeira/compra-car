import { describe, expect, it, vi } from 'vitest';

import {
  CreateAdministrativeVehicle,
  normalizeVehicleText,
  validateAdministrativeVehicle,
  type AdministrativeVehicleInput,
  type AdministrativeVehicleRepository,
} from '../src';

const validInput: AdministrativeVehicleInput = {
  brand: 'Toyota',
  model: 'Corolla Cross',
  version: 'XRX',
  modelYear: 2026,
  productionYear: 2025,
  isActive: false,
  isPublic: false,
};

function repository(
  options: {
    readonly duplicate?: boolean;
    readonly creation?:
      { readonly status: 'created'; readonly id: string } | { readonly status: 'duplicate' };
  } = {},
): AdministrativeVehicleRepository {
  return {
    findAdministrativeVehicleDuplicate: vi.fn(async () => options.duplicate ?? false),
    createAdministrativeVehicle: vi.fn(
      async () => options.creation ?? ({ status: 'created', id: '42' } as const),
    ),
  };
}

describe('vehicle text normalization', () => {
  it.each([
    ['  toyota  ', 'Toyota'],
    ['corolla   cross', 'Corolla cross'],
    ['  xrx hybrid ', 'Xrx hybrid'],
    ['cx-5  2.0', 'Cx-5 2.0'],
    ['4MATIC', '4MATIC'],
    ['e:HEV', 'E:HEV'],
    ['iX', 'IX'],
  ])('normalizes %j without destructive title case', (source, expected) => {
    expect(normalizeVehicleText(source)).toBe(expected);
  });
});

describe('administrative vehicle validation', () => {
  it.each([
    ['brand', { brand: ' ' }, 'Informe a marca.'],
    ['model', { model: ' ' }, 'Informe o modelo.'],
    ['version', { version: ' ' }, 'Informe a versão.'],
    ['modelYear', { modelYear: 2000 }, 'O ano modelo deve ser maior que 2000.'],
    ['productionYear', { productionYear: 2000 }, 'O ano de produção deve ser maior que 2000.'],
  ] as const)('rejects invalid %s', (field, override, message) => {
    const result = validateAdministrativeVehicle({ ...validInput, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors[field]).toContain(message);
  });

  it.each([
    [2025, 2025],
    [2026, 2025],
  ])('accepts model/production years %i/%i', (modelYear, productionYear) => {
    expect(validateAdministrativeVehicle({ ...validInput, modelYear, productionYear })).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it.each([
    [2025, 2026],
    [2027, 2025],
  ])('rejects inconsistent model/production years %i/%i', (modelYear, productionYear) => {
    const result = validateAdministrativeVehicle({ ...validInput, modelYear, productionYear });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.productionYear).toContain(
        'O ano de produção deve ser igual ao ano modelo ou um ano menor.',
      );
    }
  });

  it('rejects a public inactive vehicle', () => {
    const result = validateAdministrativeVehicle({
      ...validInput,
      isActive: false,
      isPublic: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.isPublic).toContain('Um veículo público precisa estar ativo.');
    }
  });
});

describe('CreateAdministrativeVehicle', () => {
  it('normalizes before duplicate lookup and persistence', async () => {
    const target = repository();
    const result = await new CreateAdministrativeVehicle(target).execute({
      ...validInput,
      brand: '  toyota ',
      model: 'corolla   cross',
      version: 'xrx',
    });

    expect(result).toEqual({ ok: true, id: '42' });
    expect(target.findAdministrativeVehicleDuplicate).toHaveBeenCalledWith({
      ...validInput,
      brand: 'Toyota',
      model: 'Corolla cross',
      version: 'Xrx',
    });
    expect(target.createAdministrativeVehicle).toHaveBeenCalledWith({
      ...validInput,
      brand: 'Toyota',
      model: 'Corolla cross',
      version: 'Xrx',
    });
  });

  it.each([
    'exact duplicate',
    'case-only duplicate',
    'spacing-only duplicate',
    'inactive duplicate',
  ])('rejects a %s reported by the normalized repository lookup', async () => {
    const target = repository({ duplicate: true });
    const result = await new CreateAdministrativeVehicle(target).execute(validInput);

    expect(result).toEqual({
      ok: false,
      code: 'DUPLICATE',
      message: 'Já existe um veículo Toyota Corolla Cross XRX 2026/2025 cadastrado.',
    });
    expect(target.createAdministrativeVehicle).not.toHaveBeenCalled();
  });

  it('allows other valid year combinations when no match exists', async () => {
    const target = repository();
    await new CreateAdministrativeVehicle(target).execute({
      ...validInput,
      modelYear: 2027,
      productionYear: 2026,
    });
    await new CreateAdministrativeVehicle(target).execute({
      ...validInput,
      modelYear: 2026,
      productionYear: 2026,
    });
    expect(target.createAdministrativeVehicle).toHaveBeenCalledTimes(2);
  });

  it('translates a concurrent exact unique conflict into a specific duplicate result', async () => {
    const target = repository({ creation: { status: 'duplicate' } });
    await expect(new CreateAdministrativeVehicle(target).execute(validInput)).resolves.toEqual({
      ok: false,
      code: 'DUPLICATE',
      message: 'Já existe um veículo Toyota Corolla Cross XRX 2026/2025 cadastrado.',
    });
  });
});
