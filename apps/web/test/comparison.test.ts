import type {
  ComparisonCategoryPresentationDto,
  VehicleComparisonValue,
} from '@compra-car/contracts';
import { VehicleNotFoundError, createComparisonItemCode, createVehicleId } from '@compra-car/core';
import { describe, expect, it } from 'vitest';

import { toPublicComparisonError } from '../src/application/comparison/comparison-errors';
import { filterComparisonCategories } from '../src/application/comparison/comparison-filter';
import { toComparisonCell } from '../src/application/comparison/comparison-mapper';
import { parseComparisonRequest } from '../src/application/comparison/comparison-request';

describe('parâmetros públicos da comparação', () => {
  it('aceita dois IDs e preserva a ordem', () => {
    expect(parseComparisonRequest('20,10')).toEqual({
      ok: true,
      vehicleIds: ['20', '10'],
    });
  });

  it('aceita três IDs', () => {
    expect(parseComparisonRequest('1,2,3')).toEqual({
      ok: true,
      vehicleIds: ['1', '2', '3'],
    });
  });

  it('rejeita menos de dois IDs', () => {
    expect(parseComparisonRequest('1')).toMatchObject({
      ok: false,
      error: { code: 'TOO_FEW_VEHICLES' },
    });
  });

  it('rejeita mais de três IDs', () => {
    expect(parseComparisonRequest('1,2,3,4')).toMatchObject({
      ok: false,
      error: { code: 'TOO_MANY_VEHICLES' },
    });
  });

  it('rejeita IDs duplicados', () => {
    expect(parseComparisonRequest('1,2,1')).toMatchObject({
      ok: false,
      error: { code: 'DUPLICATE_VEHICLES' },
    });
  });

  it('rejeita ID vazio ou incompatível com o legado atual', () => {
    expect(parseComparisonRequest('1,')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_VEHICLE_IDS' },
    });
    expect(parseComparisonRequest('1,abc')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_VEHICLE_IDS' },
    });
  });
});

describe('apresentação dos valores', () => {
  const vehicleId = createVehicleId('1');

  it('mapeia binary e scale como presença sem agrupá-los', () => {
    const binary: VehicleComparisonValue = {
      vehicleId,
      itemCode: createComparisonItemCode('safety.abs'),
      type: 'binary',
      present: true,
    };
    const scale: VehicleComparisonValue = {
      vehicleId,
      itemCode: createComparisonItemCode('camera.360'),
      type: 'scale',
      present: false,
    };

    expect(toComparisonCell(binary)).toEqual({ type: 'binary', displayValue: 'Sim' });
    expect(toComparisonCell(scale)).toEqual({ type: 'scale', displayValue: 'Não' });
  });

  it('formata numeric com unidade', () => {
    const value: VehicleComparisonValue = {
      vehicleId,
      itemCode: createComparisonItemCode('engine.power'),
      type: 'numeric',
      value: 1250.5,
      unit: 'cv',
    };

    expect(toComparisonCell(value)).toEqual({
      type: 'numeric',
      displayValue: '1.250,5 cv',
    });
  });

  it('preserva numeric null como indisponível, nunca como zero', () => {
    const value: VehicleComparisonValue = {
      vehicleId,
      itemCode: createComparisonItemCode('engine.power'),
      type: 'numeric',
      value: null,
      unit: 'cv',
    };

    expect(toComparisonCell(value)).toEqual({ type: 'numeric', displayValue: '—' });
  });
});

describe('filtro e erros públicos', () => {
  const categories: readonly ComparisonCategoryPresentationDto[] = [
    {
      name: 'Segurança',
      rows: [
        {
          code: 'same',
          label: 'Igual',
          equipmentGroup: 'Grupo',
          specSet: 'Set',
          isDifferent: false,
          values: [],
        },
        {
          code: 'different',
          label: 'Diferente',
          equipmentGroup: 'Grupo',
          specSet: 'Set',
          isDifferent: true,
          values: [],
        },
      ],
    },
  ];

  it('filtra somente pelo isDifferent já calculado pelo domínio', () => {
    const filtered = filterComparisonCategories(categories, true);
    expect(filtered[0]?.rows.map((row) => row.code)).toEqual(['different']);
    expect(filterComparisonCategories(categories, false)).toBe(categories);
  });

  it('não vaza detalhes internos em erro inesperado', () => {
    const error = toPublicComparisonError(
      new Error('SQL products SUPABASE_SERVER_KEY=segredo stack trace'),
    );
    expect(error.code).toBe('COMPARISON_UNAVAILABLE');
    expect(error.message).not.toMatch(/SQL|products|SUPABASE|segredo|stack/i);
  });

  it('traduz veículo inexistente para estado público indisponível', () => {
    expect(toPublicComparisonError(new VehicleNotFoundError('99'))).toMatchObject({
      code: 'VEHICLES_UNAVAILABLE',
    });
  });
});
