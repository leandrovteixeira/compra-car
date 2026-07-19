import { createVehicleId } from '@compra-car/core';
import { describe, expect, it } from 'vitest';

import {
  InvalidLegacyNumericValueError,
  LegacyAdapterMappingError,
  UnknownLegacySpecTypeError,
} from '../src/errors';
import type { LegacyProductSpecRow, LegacySpecRow } from '../src/legacy-dtos';
import {
  mapLegacyProductToVehicle,
  mapLegacyRowsToComparisonValues,
  mapLegacySpecToComparisonItem,
} from '../src/mappers';

const numericSpec: LegacySpecRow = {
  id: 10,
  code: 'engine.power',
  type: 'numeric',
  group_name: 'Motor',
  equipment_group: 'Desempenho',
  spec_set: 'Potência',
  detail: 'Potência máxima',
  unit: 'cv',
  is_active: true,
};

const binarySpec: LegacySpecRow = {
  ...numericSpec,
  id: 11,
  code: 'safety.abs',
  type: 'binary',
  group_name: 'Segurança',
  equipment_group: 'Freios',
  spec_set: 'ABS',
  detail: 'Freios ABS',
  unit: null,
};

describe('mapeadores do legado', () => {
  it('mapeia products sem deixar nomes legados escaparem para o domínio', () => {
    const vehicle = mapLegacyProductToVehicle({
      id: 42,
      brand: 'Marca',
      model: 'Modelo',
      version: 'Versão',
      model_year: 2026,
      production_year: '2025',
      is_active: true,
      is_public: true,
    });

    expect(vehicle).toMatchObject({
      id: '42',
      brand: 'Marca',
      modelYear: '2026',
      productionYear: '2025',
      isActive: true,
      isPublic: true,
    });
  });

  it('preserva textos legados e separa códigos iguais apenas quando realmente iguais', () => {
    const item = mapLegacySpecToComparisonItem({
      ...numericSpec,
      detail: 'Direção 360ï¿½',
    });

    expect(item.label).toBe('Direção 360ï¿½');
    expect(item.sortOrder).toBeNull();
  });

  it('rejeita tipos desconhecidos explicitamente', () => {
    expect(() => mapLegacySpecToComparisonItem({ ...binarySpec, type: 'text' })).toThrow(
      UnknownLegacySpecTypeError,
    );
  });

  it('gera matriz completa: associação binary/scale é true e ausência é false', () => {
    const values = mapLegacyRowsToComparisonValues(
      [createVehicleId('1'), createVehicleId('2')],
      [binarySpec],
      [
        {
          product_id: 1,
          equipment_id: 11,
          value: null,
          is_present: true,
          input_unit: null,
        },
      ],
    );

    expect(values).toEqual([
      { vehicleId: '1', itemCode: 'safety.abs', type: 'binary', present: true },
      { vehicleId: '2', itemCode: 'safety.abs', type: 'binary', present: false },
    ]);
  });

  it('converte numérico, prioriza input_unit e preserva null quando não há associação', () => {
    const associations: LegacyProductSpecRow[] = [
      {
        product_id: 1,
        equipment_id: 10,
        value: '123.5',
        is_present: null,
        input_unit: 'kW',
      },
    ];
    const values = mapLegacyRowsToComparisonValues(
      [createVehicleId('1'), createVehicleId('2')],
      [numericSpec],
      associations,
    );

    expect(values).toEqual([
      {
        vehicleId: '1',
        itemCode: 'engine.power',
        type: 'numeric',
        value: 123.5,
        unit: 'kW',
      },
      {
        vehicleId: '2',
        itemCode: 'engine.power',
        type: 'numeric',
        value: null,
        unit: 'cv',
      },
    ]);
  });

  it('rejeita numérico inválido em vez de mascará-lo como null', () => {
    expect(() =>
      mapLegacyRowsToComparisonValues(
        [createVehicleId('1')],
        [numericSpec],
        [
          {
            product_id: 1,
            equipment_id: 10,
            value: 'doze',
            is_present: null,
            input_unit: null,
          },
        ],
      ),
    ).toThrow(InvalidLegacyNumericValueError);
  });

  it('rejeita associação duplicada e referência fora do lote carregado', () => {
    const association = {
      product_id: 1,
      equipment_id: 11,
      value: null,
      is_present: true,
      input_unit: null,
    };
    expect(() =>
      mapLegacyRowsToComparisonValues(
        [createVehicleId('1')],
        [binarySpec],
        [association, association],
      ),
    ).toThrow(LegacyAdapterMappingError);

    expect(() =>
      mapLegacyRowsToComparisonValues(
        [createVehicleId('1')],
        [binarySpec],
        [{ ...association, equipment_id: 999 }],
      ),
    ).toThrow('spec não carregado');
  });

  it('mantém itens diferentes que compartilham o mesmo spec_set', () => {
    const items = [
      mapLegacySpecToComparisonItem(binarySpec),
      mapLegacySpecToComparisonItem({
        ...binarySpec,
        id: 12,
        code: 'safety.esc',
        detail: 'Controle de estabilidade',
      }),
    ];

    expect(items.map((item) => item.code)).toEqual(['safety.abs', 'safety.esc']);
    expect(items[0]?.specSet).toBe(items[1]?.specSet);
  });

  it('mapeia scale e mantém duas associações do mesmo spec_set como linhas independentes', () => {
    const scaleA = { ...binarySpec, id: 20, code: 'camera.360', type: 'scale' };
    const scaleB = { ...binarySpec, id: 21, code: 'camera.540', type: 'scale' };
    const values = mapLegacyRowsToComparisonValues(
      [createVehicleId('1')],
      [scaleA, scaleB],
      [
        { product_id: 1, equipment_id: 20, value: null, is_present: true, input_unit: null },
        { product_id: 1, equipment_id: 21, value: null, is_present: true, input_unit: null },
      ],
    );

    expect(values).toEqual([
      { vehicleId: '1', itemCode: 'camera.360', type: 'scale', present: true },
      { vehicleId: '1', itemCode: 'camera.540', type: 'scale', present: true },
    ]);
  });

  it('usa specs.unit como fallback e permite unidade null', () => {
    const fallback = mapLegacyRowsToComparisonValues(
      [createVehicleId('1')],
      [numericSpec],
      [
        {
          product_id: 1,
          equipment_id: 10,
          value: null,
          is_present: null,
          input_unit: null,
        },
      ],
    );
    const withoutUnit = mapLegacyRowsToComparisonValues(
      [createVehicleId('1')],
      [{ ...numericSpec, unit: null }],
      [],
    );

    expect(fallback[0]).toMatchObject({ value: null, unit: 'cv' });
    expect(withoutUnit[0]).toMatchObject({ value: null, unit: null });
  });
});
