import type {
  ComparisonPageDataDto,
  ComparisonPageErrorDto,
  ComparisonPageResultDto,
} from '@compra-car/contracts';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it, vi } from 'vitest';

import { buildComparisonPdfUrl } from '../src/application/comparison/comparison-pdf-url';
import { createComparisonPdfDocument } from '../src/pdf/comparison/comparison-pdf-document';
import {
  isComparisonHighlightsMode,
  prepareComparisonPdf,
} from '../src/pdf/comparison/comparison-pdf-model';
import { handleComparisonPdfRequest } from '../src/server/comparison-pdf-route';

function createComparisonData(vehicleCount: 2 | 3): ComparisonPageDataDto {
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
            values: [],
          },
          {
            code: 'safety.airbags',
            label: 'Airbags',
            equipmentGroup: 'Segurança',
            specSet: 'equipment',
            hasReferenceAdvantage: false,
            values: [],
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
            values: [],
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
