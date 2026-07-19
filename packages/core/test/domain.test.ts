import { describe, expect, it } from 'vitest';

import {
  ComparisonVehicleCountError,
  CompareVehicles,
  DomainValidationError,
  DuplicateVehicleSelectionError,
  ListAvailableVehicles,
  createComparisonItem,
  createVehicle,
  isVehicleEligibleForPublicCatalog,
  type ComparisonItem,
  type ComparisonResult,
  type Vehicle,
  type VehicleComparisonValue,
} from '../src';
import {
  InMemoryComparisonRepository,
  InMemoryVehicleRepository,
} from './support/in-memory-repositories';

function vehicle(id: string, overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    ...createVehicle({
      id,
      brand: 'Marca',
      model: 'Modelo',
      version: `Versão ${id}`,
      modelYear: '2026',
      productionYear: '2025',
      isActive: true,
      isPublic: true,
    }),
    ...overrides,
  };
}

function item(
  code: string,
  type: 'binary' | 'numeric' | 'scale',
  overrides: Partial<ComparisonItem> = {},
): ComparisonItem {
  return {
    ...createComparisonItem({
      id: `item-${code}`,
      code,
      type,
      category: 'Safety',
      equipmentGroup: 'Driver Assistance',
      specSet: 'Cruise Control',
      label: code,
      unit: type === 'numeric' ? 'mm' : null,
    }),
    ...overrides,
  };
}

function compare(
  vehicles: readonly Vehicle[],
  items: readonly ComparisonItem[],
  values: readonly VehicleComparisonValue[],
): CompareVehicles {
  return new CompareVehicles(
    new InMemoryVehicleRepository(
      vehicles,
      Object.fromEntries(vehicles.map((currentVehicle) => [currentVehicle.id, items.length])),
    ),
    new InMemoryComparisonRepository(items, values),
  );
}

function allRows(result: ComparisonResult) {
  return result.categories.flatMap((category) => category.rows);
}

describe('Vehicle', () => {
  it('cria e normaliza um veículo válido, derivando displayName', () => {
    const created = createVehicle({
      id: ' vehicle-1 ',
      brand: ' Marca ',
      model: ' Modelo ',
      version: ' Versão ',
      modelYear: ' 2026 ',
      productionYear: ' 2025 ',
      isActive: true,
      isPublic: true,
    });

    expect(created.id).toBe('vehicle-1');
    expect(created.displayName).toBe('Marca Modelo Versão 2026 2025');
  });

  it('rejeita campos obrigatórios vazios', () => {
    expect(() =>
      createVehicle({
        id: 'vehicle-1',
        brand: ' ',
        model: 'Modelo',
        version: 'Versão',
        modelYear: '2026',
        productionYear: '2025',
        isActive: true,
        isPublic: true,
      }),
    ).toThrow(DomainValidationError);
  });

  it('exige atividade, publicação e ao menos um item para o catálogo público', async () => {
    const eligible = vehicle('eligible');
    const inactive = vehicle('inactive', { isActive: false });
    const privateVehicle = vehicle('private', { isPublic: false });

    expect(isVehicleEligibleForPublicCatalog(eligible, 1)).toBe(true);
    expect(isVehicleEligibleForPublicCatalog(inactive, 1)).toBe(false);
    expect(isVehicleEligibleForPublicCatalog(privateVehicle, 1)).toBe(false);
    expect(isVehicleEligibleForPublicCatalog(eligible, 0)).toBe(false);

    const repository = new InMemoryVehicleRepository([eligible, inactive, privateVehicle], {
      eligible: 1,
      inactive: 1,
      private: 1,
    });
    await expect(new ListAvailableVehicles(repository).execute()).resolves.toEqual([eligible]);
  });
});

describe('ComparisonItem', () => {
  it('cria um item válido com code estável e campos de organização', () => {
    const created = item('CO_0032', 'scale');

    expect(created.code).toBe('CO_0032');
    expect(created.equipmentGroup).toBe('Driver Assistance');
    expect(created.specSet).toBe('Cruise Control');
  });

  it('rejeita tipo desconhecido e unidade em item de presença', () => {
    expect(() =>
      createComparisonItem({
        id: 'item-1',
        code: 'CO_0032',
        type: 'text',
        category: 'Convenience',
        equipmentGroup: 'Driver Assistance',
        specSet: 'Cruise Control',
        label: 'Cruise Control',
        unit: null,
      }),
    ).toThrow(DomainValidationError);

    expect(() =>
      createComparisonItem({
        id: 'item-2',
        code: 'CO_0033',
        type: 'scale',
        category: 'Convenience',
        equipmentGroup: 'Driver Assistance',
        specSet: 'Cruise Control',
        label: 'Speed limitation system',
        unit: 'km/h',
      }),
    ).toThrow(DomainValidationError);
  });
});

describe('CompareVehicles', () => {
  const firstVehicle = vehicle('vehicle-1');
  const secondVehicle = vehicle('vehicle-2');
  const thirdVehicle = vehicle('vehicle-3');
  const binaryItem = item('SF_0001', 'binary');

  it('compara dois veículos e preserva a ordem solicitada', async () => {
    const useCase = compare(
      [secondVehicle, firstVehicle],
      [binaryItem],
      [
        {
          vehicleId: firstVehicle.id,
          itemCode: binaryItem.code,
          type: 'binary',
          present: true,
        },
      ],
    );

    const result = await useCase.execute({ vehicleIds: [firstVehicle.id, secondVehicle.id] });

    expect(result.vehicles.map((currentVehicle) => currentVehicle.id)).toEqual([
      firstVehicle.id,
      secondVehicle.id,
    ]);
    expect(result.categories).toHaveLength(1);
  });

  it('compara três veículos', async () => {
    const result = await compare(
      [firstVehicle, secondVehicle, thirdVehicle],
      [binaryItem],
      [],
    ).execute({ vehicleIds: [firstVehicle.id, secondVehicle.id, thirdVehicle.id] });

    expect(result.vehicles).toHaveLength(3);
    expect(allRows(result)[0]?.valuesByVehicle).toHaveProperty(thirdVehicle.id);
  });

  it('rejeita menos de dois veículos', async () => {
    await expect(
      compare([firstVehicle], [binaryItem], []).execute({ vehicleIds: [firstVehicle.id] }),
    ).rejects.toBeInstanceOf(ComparisonVehicleCountError);
  });

  it('rejeita mais de três veículos', async () => {
    const fourthVehicle = vehicle('vehicle-4');
    await expect(
      compare([firstVehicle, secondVehicle, thirdVehicle, fourthVehicle], [binaryItem], []).execute(
        {
          vehicleIds: [firstVehicle.id, secondVehicle.id, thirdVehicle.id, fourthVehicle.id],
        },
      ),
    ).rejects.toBeInstanceOf(ComparisonVehicleCountError);
  });

  it('rejeita veículos duplicados', async () => {
    await expect(
      compare([firstVehicle, secondVehicle], [binaryItem], []).execute({
        vehicleIds: [firstVehicle.id, firstVehicle.id],
      }),
    ).rejects.toBeInstanceOf(DuplicateVehicleSelectionError);
  });

  it('mantém cada linha scale independente por code', async () => {
    const regular = item('CO_0032', 'scale');
    const limiter = item('CO_0033', 'scale');
    const result = await compare(
      [firstVehicle, secondVehicle],
      [regular, limiter],
      [
        {
          vehicleId: firstVehicle.id,
          itemCode: regular.code,
          type: 'scale',
          present: true,
        },
        {
          vehicleId: firstVehicle.id,
          itemCode: limiter.code,
          type: 'scale',
          present: true,
        },
      ],
    ).execute({ vehicleIds: [firstVehicle.id, secondVehicle.id] });

    expect(allRows(result).map((row) => row.item.code)).toEqual(['CO_0032', 'CO_0033']);
  });

  it('mantém dois codes do mesmo specSet em duas linhas', async () => {
    const regular = item('CO_0032', 'scale', { specSet: 'shared-set' });
    const limiter = item('CO_0033', 'scale', { specSet: 'shared-set' });
    const result = await compare([firstVehicle, secondVehicle], [regular, limiter], []).execute({
      vehicleIds: [firstVehicle.id, secondVehicle.id],
    });

    expect(allRows(result)).toHaveLength(2);
    expect(new Set(allRows(result).map((row) => row.item.specSet))).toEqual(
      new Set(['shared-set']),
    );
  });

  it('preserva numeric null como indisponibilidade numérica', async () => {
    const numericItem = item('DM_0001', 'numeric');
    const result = await compare(
      [firstVehicle, secondVehicle],
      [numericItem],
      [
        {
          vehicleId: firstVehicle.id,
          itemCode: numericItem.code,
          type: 'numeric',
          value: null,
          unit: 'mm',
        },
      ],
    ).execute({ vehicleIds: [firstVehicle.id, secondVehicle.id] });
    const value = allRows(result)[0]?.valuesByVehicle[firstVehicle.id];

    expect(value).toMatchObject({ type: 'numeric', value: null, unit: 'mm' });
  });

  it('diferencia associação binary ausente de valor numeric ausente', async () => {
    const numericItem = item('DM_0001', 'numeric');
    const result = await compare(
      [firstVehicle, secondVehicle],
      [binaryItem, numericItem],
      [],
    ).execute({ vehicleIds: [firstVehicle.id, secondVehicle.id] });
    const [binaryRow, numericRow] = allRows(result);

    expect(binaryRow?.valuesByVehicle[firstVehicle.id]).toMatchObject({
      type: 'binary',
      present: false,
    });
    expect(numericRow?.valuesByVehicle[firstVehicle.id]).toMatchObject({
      type: 'numeric',
      value: null,
    });
  });
});
