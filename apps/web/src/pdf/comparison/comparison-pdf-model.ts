import type {
  ComparisonCategoryPresentationDto,
  ComparisonPageDataDto,
} from '@compra-car/contracts';

import { filterComparisonHighlights } from '@/application/comparison/comparison-filter';
import {
  getComparisonValuePresentation,
  shouldShowAdvantageCheck,
} from '@/application/comparison/comparison-value-presentation';

export const COMPARISON_PDF_TABLE_WIDTH = 460;
export const COMPARISON_PDF_ITEM_COLUMN_WIDTH = 220;
export const COMPARISON_PDF_ITEM_MAX_LINES = 2;

export interface ComparisonPdfColumnGeometry {
  readonly tableWidth: 460;
  readonly itemColumnWidth: 220;
  readonly vehicleColumnWidth: number;
}

export interface ComparisonPdfVehicleViewModel {
  readonly id: string;
  readonly name: string;
  readonly isReference: boolean;
}

export interface ComparisonPdfValueViewModel {
  readonly vehicleId: string;
  readonly displayValue: string | null;
  readonly fontSize: number;
  readonly showPresenceDot: boolean;
  readonly showAdvantageCheck: boolean;
}

export interface ComparisonPdfRowViewModel {
  readonly code: string;
  readonly label: string;
  readonly labelFontSize: number;
  readonly labelMaxLines: 2;
  readonly values: readonly ComparisonPdfValueViewModel[];
}

export interface ComparisonPdfCategoryViewModel {
  readonly name: string;
  readonly rows: readonly ComparisonPdfRowViewModel[];
}

export interface ComparisonPdfViewModel {
  readonly title: 'Compra Car';
  readonly heading: 'Comparação de veículos';
  readonly vehicleCount: number;
  readonly vehicleNames: readonly string[];
  readonly vehicles: readonly ComparisonPdfVehicleViewModel[];
  readonly geometry: ComparisonPdfColumnGeometry;
  readonly mode: 'Comparação completa' | 'Ver vantagens';
  readonly categoryCount: number;
  readonly rowCount: number;
  readonly categories: readonly ComparisonPdfCategoryViewModel[];
}

export interface PreparedComparisonPdf {
  readonly categories: readonly ComparisonCategoryPresentationDto[];
  readonly model: ComparisonPdfViewModel;
}

export function isComparisonHighlightsMode(value: string | null): boolean {
  return value === 'true';
}

export function getComparisonPdfColumnGeometry(vehicleCount: number): ComparisonPdfColumnGeometry {
  return {
    tableWidth: COMPARISON_PDF_TABLE_WIDTH,
    itemColumnWidth: COMPARISON_PDF_ITEM_COLUMN_WIDTH,
    vehicleColumnWidth:
      (COMPARISON_PDF_TABLE_WIDTH - COMPARISON_PDF_ITEM_COLUMN_WIDTH) / Math.max(1, vehicleCount),
  };
}

export function getComparisonPdfItemFontSize(label: string): number {
  const length = Array.from(label).length;
  if (length <= 48) return 8.5;
  if (length <= 78) return 8;
  return 7.5;
}

export function getComparisonPdfValueFontSize(displayValue: string | null): number {
  const length = Array.from(displayValue ?? '').length;
  if (length <= 12) return 7.5;
  if (length <= 18) return 6.5;
  return 5.75;
}

export function prepareComparisonPdf(
  data: ComparisonPageDataDto,
  onlyHighlights: boolean,
): PreparedComparisonPdf {
  const categories = onlyHighlights ? filterComparisonHighlights(data.categories) : data.categories;
  const vehicles = data.vehicles.map((vehicle, index) => ({
    id: vehicle.id,
    name: [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(' '),
    isReference: index === 0,
  }));
  const pdfCategories: readonly ComparisonPdfCategoryViewModel[] = categories.map((category) => ({
    name: category.name,
    rows: category.rows.map((row) => ({
      code: row.code,
      label: row.label,
      labelFontSize: getComparisonPdfItemFontSize(row.label),
      labelMaxLines: COMPARISON_PDF_ITEM_MAX_LINES,
      values: row.values.map((value, index) => {
        const presentation = getComparisonValuePresentation(
          value,
          shouldShowAdvantageCheck(index, row.hasReferenceAdvantage, value.comparison),
        );

        return {
          vehicleId: data.vehicles[index]?.id ?? `column-${index + 1}`,
          displayValue: presentation.displayValue,
          fontSize: getComparisonPdfValueFontSize(presentation.displayValue),
          showPresenceDot: presentation.showPresenceDot,
          showAdvantageCheck: presentation.showAdvantageCheck,
        };
      }),
    })),
  }));

  return {
    categories,
    model: {
      title: 'Compra Car',
      heading: 'Comparação de veículos',
      vehicleCount: vehicles.length,
      vehicleNames: vehicles.map((vehicle) => vehicle.name),
      vehicles,
      geometry: getComparisonPdfColumnGeometry(vehicles.length),
      mode: onlyHighlights ? 'Ver vantagens' : 'Comparação completa',
      categoryCount: pdfCategories.length,
      rowCount: pdfCategories.reduce((total, category) => total + category.rows.length, 0),
      categories: pdfCategories,
    },
  };
}
