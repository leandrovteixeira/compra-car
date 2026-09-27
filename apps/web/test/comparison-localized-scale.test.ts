import type { ComparisonResult, ComparisonRow, VehicleComparisonValue } from '@compra-car/contracts';
import { createComparisonItem, createVehicle } from '@compra-car/core';
import { describe, expect, it } from 'vitest';

import { toComparisonPageData } from '../src/application/comparison/comparison-mapper';

const vehicles = [
  createVehicle({
    id: '1036',
    brand: 'Jaecoo',
    model: '7',
    version: 'Luxury',
    modelYear: '2026',
    productionYear: '2026',
    isActive: true,
    isPublic: true,
  }),
  createVehicle({
    id: '1037',
    brand: 'Jaecoo',
    model: '7',
    version: 'Prestige',
    modelYear: '2026',
    productionYear: '2026',
    isActive: true,
    isPublic: true,
  }),
] as const;

function scaleRow(
  code: string,
  optionLabel: string,
  selectedByVehicle: readonly [boolean | null, boolean | null],
): ComparisonRow {
  const item = createComparisonItem({
    id: code,
    code,
    type: 'scale',
    category: 'Conveniência',
    equipmentGroup: 'Tela multimídia',
    specSet: 'Conexão multimídia',
    label: 'Conexão multimídia (Android Auto / Carplay)',
    optionLabel,
    unit: null,
    sortOrder: 1870,
  });
  const values = vehicles.map(
    (vehicle, index) =>
      ({
        vehicleId: vehicle.id,
        itemCode: item.code,
        type: 'scale' as const,
        present: selectedByVehicle[index] ?? null,
      }) satisfies VehicleComparisonValue,
  );

  return {
    item,
    valuesByVehicle: Object.freeze({
      [String(vehicles[0].id)]: values[0]!,
      [String(vehicles[1].id)]: values[1]!,
    }),
    comparisonByVehicle: Object.freeze({
      [String(vehicles[0].id)]: 'not-applicable',
      [String(vehicles[1].id)]: 'not-applicable',
    }),
    hasReferenceAdvantage: false,
  };
}

function numericRow(): ComparisonRow {
  const item = createComparisonItem({
    id: 'CO_0019',
    code: 'CO_0019',
    type: 'numeric',
    category: 'Conveniência',
    equipmentGroup: 'Tela multimídia',
    specSet: 'Tamanho',
    label: 'Central multimídia com tela touchscreen de alta resolução',
    unit: 'inch',
    valueDirection: 'positive',
    sortOrder: 1840,
  });
  const first = {
    vehicleId: vehicles[0].id,
    itemCode: item.code,
    type: 'numeric' as const,
    value: 13.2,
    unit: 'inch',
  };
  const second = {
    vehicleId: vehicles[1].id,
    itemCode: item.code,
    type: 'numeric' as const,
    value: 14.8,
    unit: 'inch',
  };

  return {
    item,
    valuesByVehicle: Object.freeze({
      [String(vehicles[0].id)]: first,
      [String(vehicles[1].id)]: second,
    }),
    comparisonByVehicle: Object.freeze({
      [String(vehicles[0].id)]: 'not-applicable',
      [String(vehicles[1].id)]: 'disadvantage',
    }),
    hasReferenceAdvantage: false,
  };
}

describe('seller localized comparison presentation', () => {
  it('collapses scale alternatives into one ordered row and renders detail_pt per vehicle', () => {
    const result: ComparisonResult = {
      vehicles,
      categories: [
        {
          category: 'Conveniência',
          rows: [
            scaleRow('CO_0023', 'Sem fio', [null, true]),
            scaleRow('CO_0022', 'USB', [true, null]),
            numericRow(),
          ],
        },
      ],
    };

    const page = toComparisonPageData(result);
    const rows = page.categories[0]?.rows ?? [];

    expect(rows.map((row) => row.label)).toEqual([
      'Central multimídia com tela touchscreen de alta resolução',
      'Conexão multimídia (Android Auto / Carplay)',
    ]);
    expect(rows[1]).toMatchObject({
      equipmentGroup: 'Tela multimídia',
      specSet: 'Conexão multimídia',
      hasDifference: true,
      hasReferenceAdvantage: false,
    });
    expect(rows[1]?.values.map((value) => value.displayValue)).toEqual(['USB', 'Sem fio']);
  });

  it('uses em dash only for missing scale data, preserving an explicit baseline label', () => {
    const result: ComparisonResult = {
      vehicles,
      categories: [
        {
          category: 'Conveniência',
          rows: [scaleRow('CO_1003', '-', [true, null])],
        },
      ],
    };

    expect(toComparisonPageData(result).categories[0]?.rows[0]?.values.map((value) => value.displayValue))
      .toEqual(['-', '—']);
  });
});
