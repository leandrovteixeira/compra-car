import type {
  ComparisonCategoryPresentationDto,
  VehicleComparisonValue,
} from '@compra-car/contracts';
import { VehicleNotFoundError, createComparisonItemCode, createVehicleId } from '@compra-car/core';
import { describe, expect, it } from 'vitest';

import { formatComparisonNumber } from '../src/application/comparison/comparison-number-formatter';
import { toPublicComparisonError } from '../src/application/comparison/comparison-errors';
import { filterComparisonCategories } from '../src/application/comparison/comparison-filter';
import { toComparisonCell } from '../src/application/comparison/comparison-mapper';
import { parseComparisonRequest } from '../src/application/comparison/comparison-request';
import {
  COMPARISON_CELL_GRID_CLASS,
  COMPARISON_CHECK_SLOT_CLASS,
  getComparisonValuePresentation,
  shouldShowAdvantageCheck,
} from '../src/application/comparison/comparison-value-presentation';

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

  it('aceita mais de três IDs', () => {
    expect(parseComparisonRequest('1,2,3,4')).toEqual({
      ok: true,
      vehicleIds: ['1', '2', '3', '4'],
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

    expect(toComparisonCell(binary)).toEqual({
      type: 'binary',
      displayValue: 'Sim',
      comparison: 'not-applicable',
    });
    expect(toComparisonCell(scale)).toEqual({
      type: 'scale',
      displayValue: '—',
      comparison: 'not-applicable',
    });
  });

  it('exibe false e informação ausente como hífen', () => {
    const base = {
      vehicleId,
      itemCode: createComparisonItemCode('safety.airbag'),
      type: 'binary' as const,
    };

    expect(toComparisonCell({ ...base, present: false }).displayValue).toBe('—');
    expect(toComparisonCell({ ...base, present: null }).displayValue).toBe('—');
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
      comparison: 'not-applicable',
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

    expect(toComparisonCell(value)).toEqual({
      type: 'numeric',
      displayValue: '—',
      comparison: 'not-applicable',
    });
  });
});

describe('formatação numérica da comparação', () => {
  it('formata displacement com milhar brasileiro sem alterar a escala', () => {
    expect(
      formatComparisonNumber(1500, 'cc', {
        code: 'engine.displacement',
        label: 'Displacement',
      }),
    ).toBe('1.500 cc');
  });

  it.each([
    ['engine.torque', 'Torque', 40, 'kgfm', '40,0 kgfm'],
    ['engine.power_weight', 'Power to weight', 118.666, 'cv/t', '118,7 cv/t'],
    ['engine.torque_weight', 'Torque to weight', 20.24, 'kgfm/t', '20,2 kgfm/t'],
  ] as const)('usa uma casa decimal em %s', (code, label, value, unit, expected) => {
    expect(formatComparisonNumber(value, unit, { code, label })).toBe(expected);
  });

  it.each([
    [10, '10 pol'],
    [10.5, '10,5 pol'],
    [10.25, '10,25 pol'],
    [10.256, '10,26 pol'],
  ] as const)('limita telas a duas casas para %s', (value, expected) => {
    expect(
      formatComparisonNumber(value, 'pol', {
        code: 'interior.screen_size',
        label: 'Screen size',
      }),
    ).toBe(expected);
  });

  it('omite unidade ausente ou composta apenas por espaços', () => {
    expect(formatComparisonNumber(1, '   ', { code: 'numeric.without_unit' })).toBe('1');
  });
});

describe('representação visual das células', () => {
  it('usa bolinha branca para binary true e reserva o check à direita', () => {
    const presentation = getComparisonValuePresentation(
      { type: 'binary', displayValue: 'Sim', comparison: 'not-applicable' },
      true,
    );

    expect(presentation).toEqual({
      displayValue: null,
      showPresenceDot: true,
      showAdvantageCheck: true,
    });
    expect(COMPARISON_CELL_GRID_CLASS).toContain('grid-cols-[minmax(0,1fr)_1.25rem]');
    expect(COMPARISON_CHECK_SLOT_CLASS).toContain('justify-self-end');
  });

  it('mantém o slot vazio sem desenhar traço quando não há vantagem', () => {
    const presentation = getComparisonValuePresentation(
      { type: 'numeric', displayValue: '235 cv', comparison: 'tie' },
      false,
    );

    expect(presentation).toEqual({
      displayValue: '235 cv',
      showPresenceDot: false,
      showAdvantageCheck: false,
    });
  });

  it('coloca o check no veículo presente quando a referência binary está ausente', () => {
    expect(shouldShowAdvantageCheck(0, false, 'not-applicable')).toBe(false);
    expect(shouldShowAdvantageCheck(1, false, 'disadvantage')).toBe(true);
    expect(shouldShowAdvantageCheck(1, true, 'advantage')).toBe(false);
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
          hasReferenceAdvantage: false,
          values: [],
        },
        {
          code: 'different',
          label: 'Diferente',
          equipmentGroup: 'Grupo',
          specSet: 'Set',
          hasReferenceAdvantage: true,
          values: [],
        },
      ],
    },
  ];

  it('filtra somente vantagens do veículo principal já calculadas pelo domínio', () => {
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
