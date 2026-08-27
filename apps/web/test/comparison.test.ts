import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { VehicleComparisonValue } from '@compra-car/contracts';
import { VehicleNotFoundError, createComparisonItemCode, createVehicleId } from '@compra-car/core';
import { describe, expect, it } from 'vitest';

import { formatComparisonNumber } from '../src/application/comparison/comparison-number-formatter';
import { toPublicComparisonError } from '../src/application/comparison/comparison-errors';
import { filterComparisonCategories } from '../src/application/comparison/comparison-filter';
import {
  areComparisonValuesSemanticallyEqual,
  PRESENCE_DISPLAY_VALUE,
  toComparisonCell,
} from '../src/application/comparison/comparison-mapper';
import { parseComparisonRequest } from '../src/application/comparison/comparison-request';
import {
  COMPARISON_CELL_GRID_CLASS,
  COMPARISON_CHECK_SLOT_CLASS,
  getComparisonValuePresentation,
  shouldShowAdvantageCheck,
} from '../src/application/comparison/comparison-value-presentation';
import type { ComparisonCategoryViewModel } from '../src/application/comparison/comparison-view-model';
import { parseComparisonMode } from '../src/application/comparison/comparison-view-model';

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

describe('estrutura acessivel dos modos da comparacao', () => {
  const source = (relativePath: string) => readFileSync(resolve(__dirname, relativePath), 'utf8');

  it('usa radio group, azul de selecao e tres opcoes sem attention', () => {
    const toolbar = source('../src/components/comparison-toolbar.tsx');
    expect(toolbar).toContain('role="radiogroup"');
    expect(toolbar).toContain('type="radio"');
    expect(toolbar).toContain("label: 'Completa'");
    expect(toolbar).toContain("label: 'Diferenças'");
    expect(toolbar).toContain("label: 'Vantagens'");
    expect(toolbar).toContain('bg-selection-strong');
    expect(toolbar).not.toContain('bg-attention');
  });

  it('mantem o marcador pequeno, laranja e acessivel sem pintar a celula', () => {
    const cell = source('../src/components/comparison-value-cell.tsx');
    const table = source('../src/components/comparison-table.tsx');
    expect(cell).toContain('aria-label="Vantagem"');
    expect(cell).toContain('data-advantage-marker="true"');
    expect(cell).toContain('text-attention');
    expect(table).not.toContain('bg-attention');
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
      present: true,
    };

    expect(toComparisonCell(binary)).toEqual({
      type: 'binary',
      displayValue: PRESENCE_DISPLAY_VALUE,
      comparison: 'not-applicable',
    });
    expect(toComparisonCell(scale)).toEqual({
      type: 'scale',
      displayValue: PRESENCE_DISPLAY_VALUE,
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
    expect(formatComparisonNumber(1500, 'cc', { code: 'PW_0005' })).toBe('1.500 cc');
  });

  it.each([
    ['PW_0012', 40, 'Nm', '40,0 Nm'],
    ['PW_0035', 118.666, 'kg/cv', '118,7 kg/cv'],
    ['PW_0036', 20.24, 'kg/Nm', '20,2 kg/Nm'],
  ] as const)('usa uma casa decimal em %s', (code, value, unit, expected) => {
    expect(formatComparisonNumber(value, unit, { code })).toBe(expected);
  });

  it.each([
    ['CO_0017', 5, '5,00 inch'],
    ['CO_0019', 12.3, '12,30 inch'],
  ] as const)('usa duas casas para %s', (code, value, expected) => {
    expect(formatComparisonNumber(value, 'inch', { code })).toBe(expected);
  });

  it('formata rotation max torque como inteiro com arredondamento do Intl', () => {
    expect(formatComparisonNumber(4500, 'RPM', { code: 'PW_0015' })).toBe('4.500 RPM');
    expect(formatComparisonNumber(4500.5, 'RPM', { code: 'PW_0015' })).toBe('4.501 RPM');
  });

  it.each([
    [12, '12,0 km/L'],
    [12.46, '12,5 km/L'],
  ] as const)('usa uma casa no consumo para %s', (value, expected) => {
    expect(formatComparisonNumber(value, 'km/L', { code: 'OW_0002' })).toBe(expected);
  });

  it('omite unidade ausente, composta apenas por espaços ou placeholder unit', () => {
    expect(formatComparisonNumber(1, '   ', { code: 'numeric.without_unit' })).toBe('1');
    expect(formatComparisonNumber(1, 'unit', { code: 'numeric.without_unit' })).toBe('1');
    expect(formatComparisonNumber(2, ' UNIT ', { code: 'numeric.without_unit' })).toBe('2');
  });
});

describe('representação visual das células', () => {
  it('usa bolinha branca para binary true e reserva o check à direita', () => {
    const presentation = getComparisonValuePresentation(
      { type: 'binary', displayValue: PRESENCE_DISPLAY_VALUE, comparison: 'not-applicable' },
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

  it('usa a mesma bolinha branca para scale true sem classificá-lo', () => {
    expect(
      getComparisonValuePresentation(
        { type: 'scale', displayValue: PRESENCE_DISPLAY_VALUE, comparison: 'not-applicable' },
        false,
      ),
    ).toEqual({
      displayValue: null,
      showPresenceDot: true,
      showAdvantageCheck: false,
    });
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
    expect(shouldShowAdvantageCheck(1, false, 'tie')).toBe(false);
  });
});

describe('filtro e erros públicos', () => {
  const categories: readonly ComparisonCategoryViewModel[] = [
    {
      name: 'Segurança',
      rows: [
        {
          code: 'same',
          label: 'Igual',
          equipmentGroup: 'Grupo',
          specSet: 'Set',
          hasReferenceAdvantage: false,
          hasDifference: false,
          hasAnyAdvantage: false,
          values: [],
        },
        {
          code: 'different',
          label: 'Diferente',
          equipmentGroup: 'Grupo',
          specSet: 'Set',
          hasReferenceAdvantage: true,
          hasDifference: true,
          hasAnyAdvantage: true,
          values: [],
        },
      ],
    },
  ];

  it('resolve os tres modos pela URL e preserva links antigos de highlights', () => {
    expect(parseComparisonMode(undefined)).toBe('complete');
    expect(parseComparisonMode('differences')).toBe('differences');
    expect(parseComparisonMode('advantages')).toBe('advantages');
    expect(parseComparisonMode(undefined, 'true')).toBe('advantages');
    expect(parseComparisonMode('invalid')).toBe('complete');
  });

  it('remove iguais e mantem diferentes sem julgamento no modo Diferencas', () => {
    const filtered = filterComparisonCategories(categories, 'differences');
    expect(filtered[0]?.rows.map((row) => row.code)).toEqual(['different']);
    expect(
      filterComparisonCategories(
        [{ ...categories[0]!, rows: [categories[0]!.rows[0]!] }],
        'differences',
      ),
    ).toEqual([]);
  });

  it('filtra somente vantagens do veículo principal já calculadas pelo domínio', () => {
    const filtered = filterComparisonCategories(categories, 'advantages');
    expect(filtered[0]?.rows.map((row) => row.code)).toEqual(['different']);
    expect(filterComparisonCategories(categories, 'complete')).toBe(categories);
  });

  it('compara valores brutos por semantica, nao pelas strings formatadas', () => {
    const base = {
      vehicleId: createVehicleId('1'),
      itemCode: createComparisonItemCode('PW_0005'),
      type: 'numeric' as const,
      unit: 'cc',
    };

    expect(
      areComparisonValuesSemanticallyEqual(
        { ...base, value: 5 },
        { ...base, vehicleId: createVehicleId('2'), value: 5.0, unit: ' CC ' },
      ),
    ).toBe(true);
    expect(
      areComparisonValuesSemanticallyEqual(
        { ...base, value: null },
        { ...base, vehicleId: createVehicleId('2'), value: 5 },
      ),
    ).toBe(false);
  });

  it('preserva a equivalencia existente entre false e ausencia para presenca', () => {
    const base = {
      itemCode: createComparisonItemCode('safety.abs'),
      type: 'binary' as const,
    };

    expect(
      areComparisonValuesSemanticallyEqual(
        { ...base, vehicleId: createVehicleId('1'), present: false },
        { ...base, vehicleId: createVehicleId('2'), present: null },
      ),
    ).toBe(true);
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
