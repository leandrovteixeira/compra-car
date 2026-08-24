import type {
  ComparisonPageDataDto,
  ComparisonPageErrorDto,
  ComparisonPageResultDto,
} from '@compra-car/contracts';
import { renderToBuffer } from '@react-pdf/renderer';
import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildComparisonPdfUrl } from '../src/application/comparison/comparison-pdf-url';
import { createComparisonPdfDocument } from '../src/pdf/comparison/comparison-pdf-document';
import {
  COMPARISON_PDF_HEADER_FIXED,
  createComparisonPdfHeader,
} from '../src/pdf/comparison/comparison-pdf-header';
import {
  COMPARISON_PDF_ITEM_MAX_LINES,
  getComparisonPdfColumnGeometry,
  getComparisonPdfItemFontSize,
  isComparisonHighlightsMode,
  prepareComparisonPdf,
} from '../src/pdf/comparison/comparison-pdf-model';
import {
  COMPARISON_PDF_CATEGORY_PRESENCE_AHEAD,
  COMPARISON_PDF_ROW_WRAP,
} from '../src/pdf/comparison/comparison-pdf-table';
import { handleComparisonPdfRequest } from '../src/server/comparison-pdf-route';

function createComparisonData(vehicleCount: 2 | 3): ComparisonPageDataDto {
  const binaryValues = (referencePresent: boolean) =>
    Array.from({ length: vehicleCount }, (_, index) => ({
      type: 'binary' as const,
      displayValue: (index === 0 ? referencePresent : !referencePresent) ? '●' : '—',
      comparison:
        index === 0
          ? ('not-applicable' as const)
          : referencePresent
            ? ('tie' as const)
            : ('disadvantage' as const),
    }));
  const numericValues = Array.from({ length: vehicleCount }, (_, index) => ({
    type: 'numeric' as const,
    displayValue: `${150 + index * 25} cv`,
    comparison: index === 0 ? ('advantage' as const) : ('disadvantage' as const),
  }));

  return {
    vehicles: Array.from({ length: vehicleCount }, (_, index) => ({
      id: String(index + 1),
      brand: index === 0 ? 'Volvo' : index === 1 ? 'Audi' : 'BMW',
      model: index === 0 ? 'XC40' : index === 1 ? 'Q3' : 'X1',
      version: 'Plus',
      modelYear: '2026',
      productionYear: '2025',
    })),
    categories: [
      {
        name: 'Segurança',
        rows: [
          {
            code: 'safety.abs',
            label: 'Freios ABS',
            equipmentGroup: 'Segurança',
            specSet: 'equipment',
            hasReferenceAdvantage: true,
            values: binaryValues(true),
          },
          {
            code: 'safety.airbags',
            label: 'Airbags',
            equipmentGroup: 'Segurança',
            specSet: 'equipment',
            hasReferenceAdvantage: false,
            values: binaryValues(false),
          },
        ],
      },
      {
        name: 'Conforto',
        rows: [
          {
            code: 'comfort.seat',
            label: 'Banco elétrico',
            equipmentGroup: 'Conforto',
            specSet: 'equipment',
            hasReferenceAdvantage: false,
            values: numericValues,
          },
        ],
      },
    ],
  };
}

function successfulResult(data: ComparisonPageDataDto): ComparisonPageResultDto {
  return { ok: true, data };
}

function failedResult(error: ComparisonPageErrorDto): ComparisonPageResultDto {
  return { ok: false, error };
}

function collectText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return collectText(node.props.children);
  return '';
}

function createManyRowsData(vehicleCount: 2 | 3, rowCount = 90): ComparisonPageDataDto {
  const base = createComparisonData(vehicleCount);
  const template = base.categories[0]?.rows[0];
  if (template === undefined) throw new Error('Fixture de comparação inválida.');

  return {
    vehicles: base.vehicles,
    categories: Array.from({ length: 3 }, (_, categoryIndex) => ({
      name: `Categoria ${categoryIndex + 1}`,
      rows: Array.from({ length: rowCount / 3 }, (_, rowIndex) => ({
        ...template,
        code: `category-${categoryIndex + 1}.item-${rowIndex + 1}`,
        label: `Item comparativo ${categoryIndex + 1}.${rowIndex + 1} com descrição técnica`,
        hasReferenceAdvantage: rowIndex % 2 === 0,
      })),
    })),
  };
}

describe('parâmetros e URL do PDF de comparação', () => {
  it('ativa vantagens somente para highlights=true', () => {
    expect(isComparisonHighlightsMode('true')).toBe(true);
    expect(isComparisonHighlightsMode(null)).toBe(false);
    expect(isComparisonHighlightsMode('false')).toBe(false);
  });

  it('preserva todos os valores de vehicles e o estado ativo', () => {
    const params = new URLSearchParams();
    params.append('vehicles', '10,20');
    params.append('vehicles', '30,40');
    params.set('highlights', 'true');
    params.set('unrelated', 'ignored');

    const url = new URL(buildComparisonPdfUrl(params), 'https://compra-car.test');
    expect(url.pathname).toBe('/comparar/pdf');
    expect(url.searchParams.getAll('vehicles')).toEqual(['10,20', '30,40']);
    expect(url.searchParams.get('highlights')).toBe('true');
    expect(url.searchParams.has('unrelated')).toBe(false);
  });

  it('omite highlights quando o modo não está ativo', () => {
    const params = new URLSearchParams({ vehicles: '10,20' });
    expect(buildComparisonPdfUrl(params)).toBe('/comparar/pdf?vehicles=10%2C20');
  });
});

describe('view model e documento PDF', () => {
  it.each([2, 3] as const)('gera modelo e PDF válido com %s veículos', async (vehicleCount) => {
    const prepared = prepareComparisonPdf(createComparisonData(vehicleCount), false);

    expect(prepared.model).toMatchObject({
      vehicleCount,
      vehicleNames:
        vehicleCount === 2
          ? ['Volvo XC40 Plus', 'Audi Q3 Plus']
          : ['Volvo XC40 Plus', 'Audi Q3 Plus', 'BMW X1 Plus'],
      mode: 'Comparação completa',
      categoryCount: 2,
      rowCount: 3,
    });

    const buffer = await renderToBuffer(createComparisonPdfDocument(prepared.model));
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.byteLength).toBeGreaterThan(500);
  });

  it('aplica o filtro compartilhado antes de calcular o conteúdo do PDF', () => {
    const prepared = prepareComparisonPdf(createComparisonData(2), true);

    expect(prepared.categories).toHaveLength(1);
    expect(prepared.categories[0]?.rows.map((row) => row.code)).toEqual(['safety.abs']);
    expect(prepared.model).toMatchObject({
      mode: 'Ver vantagens',
      categoryCount: 1,
      rowCount: 1,
    });
  });

  it('usa as geometrias aprovadas para dois e três veículos', () => {
    expect(getComparisonPdfColumnGeometry(2)).toEqual({
      tableWidth: 540,
      itemColumnWidth: 300,
      vehicleColumnWidth: 120,
    });
    expect(getComparisonPdfColumnGeometry(3)).toEqual({
      tableWidth: 540,
      itemColumnWidth: 300,
      vehicleColumnWidth: 80,
    });
  });

  it('preserva ordem, referência e nomes no header fixo', () => {
    const model = prepareComparisonPdf(createComparisonData(3), false).model;
    const headerText = collectText(createComparisonPdfHeader(model));

    expect(model.vehicles.map((vehicle) => vehicle.id)).toEqual(['1', '2', '3']);
    expect(model.vehicles.map((vehicle) => vehicle.isReference)).toEqual([true, false, false]);
    expect(COMPARISON_PDF_HEADER_FIXED).toBe(true);
    expect(headerText.indexOf('Volvo XC40 Plus')).toBeLessThan(headerText.indexOf('Audi Q3 Plus'));
    expect(headerText.indexOf('Audi Q3 Plus')).toBeLessThan(headerText.indexOf('BMW X1 Plus'));
    expect(headerText).toContain('Referência');
  });

  it('mantém valores por veículo e reutiliza a regra existente de vantagem', () => {
    const model = prepareComparisonPdf(createComparisonData(3), false).model;
    const referenceAdvantage = model.categories[0]?.rows[0];
    const comparedAdvantage = model.categories[0]?.rows[1];

    expect(referenceAdvantage?.values.map((value) => value.vehicleId)).toEqual(['1', '2', '3']);
    expect(referenceAdvantage?.values.map((value) => value.showAdvantageCheck)).toEqual([
      true,
      false,
      false,
    ]);
    expect(comparedAdvantage?.values.map((value) => value.showAdvantageCheck)).toEqual([
      false,
      true,
      true,
    ]);
    expect(referenceAdvantage?.values[0]).toMatchObject({
      displayValue: null,
      showPresenceDot: true,
    });
  });

  it('reduz a fonte por comprimento e mantém o label em uma linha', () => {
    const sizes = [
      getComparisonPdfItemFontSize('Label curto'),
      getComparisonPdfItemFontSize('M'.repeat(50)),
      getComparisonPdfItemFontSize('L'.repeat(70)),
      getComparisonPdfItemFontSize('X'.repeat(100)),
    ];

    expect(sizes).toEqual([9, 8, 7, 6.25]);
    expect(sizes).toEqual([...sizes].sort((left, right) => right - left));
    expect(COMPARISON_PDF_ITEM_MAX_LINES).toBe(1);
    expect(
      prepareComparisonPdf(createComparisonData(2), false).model.categories[0]?.rows[0],
    ).toHaveProperty('labelMaxLines', 1);
  });

  it.each([
    [2, false, 2, 3],
    [2, true, 1, 1],
    [3, false, 2, 3],
    [3, true, 1, 1],
  ] as const)(
    'renderiza o cenário manual %s veículos / highlights=%s',
    async (vehicleCount, onlyHighlights, categoryCount, rowCount) => {
      const model = prepareComparisonPdf(createComparisonData(vehicleCount), onlyHighlights).model;
      const buffer = await renderToBuffer(createComparisonPdfDocument(model));

      expect(model).toMatchObject({ vehicleCount, categoryCount, rowCount });
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(buffer.byteLength).toBeGreaterThan(1_000);
    },
  );

  it('pagina muitas rows sem dividir rows e protege a primeira row da categoria', async () => {
    const model = prepareComparisonPdf(createManyRowsData(3), false).model;
    const buffer = await renderToBuffer(createComparisonPdfDocument(model));
    const pageCount = buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;

    expect(model.rowCount).toBe(90);
    expect(COMPARISON_PDF_ROW_WRAP).toBe(false);
    expect(COMPARISON_PDF_CATEGORY_PRESENCE_AHEAD).toBeGreaterThanOrEqual(28);
    expect(pageCount).toBeGreaterThan(1);
  });
});

describe('resposta HTTP do PDF', () => {
  it('repassa parâmetros, retorna PDF e headers controlados', async () => {
    const loadComparison = vi.fn(async () => successfulResult(createComparisonData(2)));
    const renderPdf = vi.fn(async () => new TextEncoder().encode('%PDF-foundation'));

    const response = await handleComparisonPdfRequest(
      new Request('https://compra-car.test/comparar/pdf?vehicles=10%2C20&highlights=true'),
      { loadComparison, renderPdf },
    );

    expect(loadComparison).toHaveBeenCalledWith('10,20');
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({ mode: 'Ver vantagens' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('comparacao-veiculos.pdf');
  });

  it('preserva valores repetidos de vehicles para a validação existente', async () => {
    const loadComparison = vi.fn(async () =>
      failedResult({ code: 'INVALID_VEHICLE_IDS', message: 'Seleção inválida.' }),
    );

    const response = await handleComparisonPdfRequest(
      new Request('https://compra-car.test/comparar/pdf?vehicles=10&vehicles=20'),
      { loadComparison, renderPdf: vi.fn() },
    );

    expect(loadComparison).toHaveBeenCalledWith(['10', '20']);
    expect(response.status).toBe(400);
  });

  it('não expõe detalhes internos quando a renderização falha', async () => {
    const response = await handleComparisonPdfRequest(
      new Request('https://compra-car.test/comparar/pdf?vehicles=10%2C20'),
      {
        loadComparison: async () => successfulResult(createComparisonData(2)),
        renderPdf: async () => {
          throw new Error('stack SQL secret');
        },
      },
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain('PDF_GENERATION_FAILED');
    expect(body).not.toMatch(/stack|SQL|secret/i);
  });
});
