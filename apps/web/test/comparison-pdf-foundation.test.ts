import type {
  ComparisonPageDataDto,
  ComparisonPageErrorDto,
  ComparisonPageResultDto,
} from '@compra-car/contracts';
import { renderToBuffer } from '@react-pdf/renderer';
import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildComparisonPdfUrl } from '../src/application/comparison/comparison-pdf-url';
import type { ComparisonPageViewModel } from '../src/application/comparison/comparison-view-model';
import {
  COMPARISON_PDF_PAGE_SIZE,
  createComparisonPdfDocument,
} from '../src/pdf/comparison/comparison-pdf-document';
import {
  COMPARISON_PDF_HEADER_FIXED,
  createComparisonPdfHeader,
} from '../src/pdf/comparison/comparison-pdf-header';
import {
  COMPARISON_PDF_ITEM_MAX_LINES,
  COMPARISON_PDF_MIN_CONTENT_FONT_SIZE,
  getComparisonPdfColumnGeometry,
  getComparisonPdfItemFontSize,
  getComparisonPdfMode,
  prepareComparisonPdf,
} from '../src/pdf/comparison/comparison-pdf-model';
import { comparisonPdfStyles } from '../src/pdf/comparison/comparison-pdf-styles';
import {
  COMPARISON_PDF_CATEGORY_PRESENCE_AHEAD,
  COMPARISON_PDF_ROW_WRAP,
} from '../src/pdf/comparison/comparison-pdf-table';
import { handleComparisonPdfRequest } from '../src/server/comparison-pdf-route';

function createComparisonData(vehicleCount: 2 | 3 | 4): ComparisonPageViewModel {
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
            hasDifference: true,
            values: binaryValues(true),
          },
          {
            code: 'safety.airbags',
            label: 'Airbags',
            equipmentGroup: 'Segurança',
            specSet: 'equipment',
            hasReferenceAdvantage: false,
            hasDifference: true,
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
            hasDifference: true,
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

function createManyRowsData(vehicleCount: 2 | 3 | 4, rowCount = 90): ComparisonPageViewModel {
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
  it('interpreta os três modos e mantém compatibilidade com highlights', () => {
    expect(getComparisonPdfMode('complete')).toBe('complete');
    expect(getComparisonPdfMode('differences')).toBe('differences');
    expect(getComparisonPdfMode('advantages')).toBe('advantages');
    expect(getComparisonPdfMode(null, 'true')).toBe('advantages');
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
    expect(url.searchParams.get('mode')).toBe('advantages');
    expect(url.searchParams.has('unrelated')).toBe(false);
  });

  it('omite modo quando nenhum estado está ativo', () => {
    const params = new URLSearchParams({ vehicles: '10,20' });
    expect(buildComparisonPdfUrl(params)).toBe('/comparar/pdf?vehicles=10%2C20');
  });

  it('transporta o modo Vantagens sem conversão semântica', () => {
    const params = new URLSearchParams({ vehicles: '10,20', mode: 'advantages' });
    expect(buildComparisonPdfUrl(params)).toBe('/comparar/pdf?vehicles=10%2C20&mode=advantages');
  });
});

describe('view model e documento PDF', () => {
  it.each([2, 3, 4] as const)('gera modelo e PDF válido com %s veículos', async (vehicleCount) => {
    const prepared = prepareComparisonPdf(createComparisonData(vehicleCount), 'complete');

    expect(prepared.model).toMatchObject({
      vehicleCount,
      vehicleNames:
        vehicleCount === 2
          ? ['Volvo XC40 Plus', 'Audi Q3 Plus']
          : vehicleCount === 3
            ? ['Volvo XC40 Plus', 'Audi Q3 Plus', 'BMW X1 Plus']
            : ['Volvo XC40 Plus', 'Audi Q3 Plus', 'BMW X1 Plus', 'BMW X1 Plus'],
      mode: 'Comparação completa',
      categoryCount: 2,
      rowCount: 3,
    });

    const buffer = await renderToBuffer(createComparisonPdfDocument(prepared.model));
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.byteLength).toBeGreaterThan(500);
  });

  it('aplica o filtro compartilhado antes de calcular o conteúdo do PDF', () => {
    const prepared = prepareComparisonPdf(createComparisonData(2), 'advantages');

    expect(prepared.categories).toHaveLength(1);
    expect(prepared.categories[0]?.rows.map((row) => row.code)).toEqual(['safety.abs']);
    expect(prepared.model).toMatchObject({
      mode: 'Vantagens da referência',
      categoryCount: 1,
      rowCount: 1,
    });
  });

  it('em Diferenças mantém o filtro semântico e apresenta outcomes objetivos do engine', () => {
    const data = createComparisonData(2);
    const firstCategory = data.categories[0];
    if (firstCategory === undefined) throw new Error('Fixture inválida.');
    const referenceAdvantage = { ...firstCategory.rows[0]!, hasDifference: true };
    const competitorAdvantage = { ...firstCategory.rows[1]!, hasDifference: true };
    const noObjectiveAdvantage = {
      ...firstCategory.rows[1]!,
      code: 'safety.different-without-advantage',
      hasDifference: true,
      values: firstCategory.rows[1]!.values.map((value) => ({
        ...value,
        comparison: 'tie' as const,
      })),
    };
    const equalWithPresentationFlag = {
      ...firstCategory.rows[0]!,
      code: 'safety.equal',
      hasDifference: false,
      hasReferenceAdvantage: true,
    };
    const rows = [
      referenceAdvantage,
      competitorAdvantage,
      noObjectiveAdvantage,
      equalWithPresentationFlag,
    ];
    const prepared = prepareComparisonPdf(
      { ...data, categories: [{ ...firstCategory, rows }] },
      'differences',
    );

    expect(prepared.model.mode).toBe('Somente diferenças');
    expect(prepared.categories[0]?.rows.map((row) => row.code)).toEqual([
      'safety.abs',
      'safety.airbags',
      'safety.different-without-advantage',
    ]);
    expect(
      prepared.model.categories[0]?.rows[0]?.values.map((value) => value.showAdvantageCheck),
    ).toEqual([true, false]);
    expect(
      prepared.model.categories[0]?.rows[1]?.values.map((value) => value.showAdvantageCheck),
    ).toEqual([false, true]);
    expect(
      prepared.model.categories[0]?.rows[2]?.values.map((value) => value.showAdvantageCheck),
    ).toEqual([false, false]);
  });

  it('fixa estruturalmente a regra graphite do header repetido e a faixa de categoria', () => {
    expect(COMPARISON_PDF_HEADER_FIXED).toBe(true);
    expect(comparisonPdfStyles.columnHeaderBottomRule).toMatchObject({
      backgroundColor: '#1A1D21',
      height: 1.5,
      width: '100%',
    });
    expect(comparisonPdfStyles.category).toMatchObject({
      backgroundColor: '#1A1D21',
      borderBottomColor: '#1A1D21',
      borderBottomWidth: 1,
    });
  });

  it.each(['differences', 'advantages'] as const)(
    'gera PDF válido e mensagem útil quando %s não tem linhas',
    async (mode) => {
      const data = createComparisonData(2);
      const categories = data.categories.map((category) => ({
        ...category,
        rows: category.rows.map((row) => ({
          ...row,
          hasDifference: false,
          hasReferenceAdvantage: false,
        })),
      }));
      const model = prepareComparisonPdf({ ...data, categories }, mode).model;
      const buffer = await renderToBuffer(createComparisonPdfDocument(model));

      expect(model.rowCount).toBe(0);
      expect(model.emptyMessage).toMatch(/Nenhuma/u);
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    },
  );

  it('usa retrato para dois e paisagem para três ou quatro veículos', () => {
    expect(getComparisonPdfColumnGeometry(2)).toMatchObject({ orientation: 'portrait' });
    expect(getComparisonPdfColumnGeometry(3)).toMatchObject({ orientation: 'landscape' });
    expect(getComparisonPdfColumnGeometry(4)).toMatchObject({ orientation: 'landscape' });
    expect(getComparisonPdfColumnGeometry(4).vehicleColumnWidth).toBeGreaterThan(130);
  });

  it('usa A4 com orientação adaptada à quantidade', () => {
    expect(COMPARISON_PDF_PAGE_SIZE).toBe('A4');
  });

  it('preserva ordem, referência e nomes no header fixo', () => {
    const model = prepareComparisonPdf(createComparisonData(3), 'complete').model;
    const headerText = collectText(createComparisonPdfHeader(model));

    expect(model.vehicles.map((vehicle) => vehicle.id)).toEqual(['1', '2', '3']);
    expect(model.vehicles.map((vehicle) => vehicle.isReference)).toEqual([true, false, false]);
    expect(COMPARISON_PDF_HEADER_FIXED).toBe(true);
    expect(headerText.indexOf('Volvo XC40 Plus')).toBeLessThan(headerText.indexOf('Audi Q3 Plus'));
    expect(headerText.indexOf('Audi Q3 Plus')).toBeLessThan(headerText.indexOf('BMW X1 Plus'));
    expect(headerText).toContain('Referência');
    expect(headerText).toContain('2025/2026');
  });

  it('mantém valores por veículo e reutiliza a regra existente de vantagem', () => {
    const model = prepareComparisonPdf(createComparisonData(3), 'complete').model;
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

  it('mantém fonte legível independentemente do comprimento', () => {
    const sizes = [
      getComparisonPdfItemFontSize(),
      getComparisonPdfItemFontSize(),
      getComparisonPdfItemFontSize(),
      getComparisonPdfItemFontSize(),
    ];

    expect(sizes).toEqual([9, 9, 9, 9]);
    expect(Math.min(...sizes)).toBe(COMPARISON_PDF_MIN_CONTENT_FONT_SIZE);
    expect(COMPARISON_PDF_ITEM_MAX_LINES).toBe(2);
    expect(
      prepareComparisonPdf(createComparisonData(2), 'complete').model.categories[0]?.rows[0],
    ).toHaveProperty('labelMaxLines', 2);
  });

  it.each([
    [2, 'complete', 2, 3],
    [2, 'advantages', 1, 1],
    [3, 'differences', 2, 3],
    [4, 'advantages', 1, 1],
  ] as const)(
    'renderiza o cenário %s veículos / modo=%s',
    async (vehicleCount, mode, categoryCount, rowCount) => {
      const model = prepareComparisonPdf(createComparisonData(vehicleCount), mode).model;
      const buffer = await renderToBuffer(createComparisonPdfDocument(model));

      expect(model).toMatchObject({ vehicleCount, categoryCount, rowCount });
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      expect(buffer.byteLength).toBeGreaterThan(1_000);
    },
  );

  it('pagina Diferenças sem dividir rows e protege a primeira row da categoria', async () => {
    const model = prepareComparisonPdf(createManyRowsData(3), 'differences').model;
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
      new Request('https://compra-car.test/comparar/pdf?vehicles=10%2C20&mode=advantages'),
      { loadComparison, renderPdf },
    );

    expect(loadComparison).toHaveBeenCalledWith('10,20');
    expect(renderPdf).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'Vantagens da referência' }),
    );
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
