import type { ComparisonPageDataDto } from '@compra-car/contracts';

import { filterComparisonCategories } from '@/application/comparison/comparison-filter';
import {
  getComparisonValuePresentation,
  shouldShowAdvantageCheckForMode,
} from '@/application/comparison/comparison-value-presentation';
import {
  parseComparisonMode,
  type ComparisonMode,
  type ComparisonPageViewModel,
} from '@/application/comparison/comparison-view-model';
import { APP_NAME } from '@/config/app-identity';

export const COMPARISON_PDF_ITEM_MAX_LINES = 2;
export const COMPARISON_PDF_MIN_CONTENT_FONT_SIZE = 9;
export const COMPARISON_PDF_PAGE_MARGIN = 28;

const A4_PORTRAIT_WIDTH = 595.28;
const A4_LANDSCAPE_WIDTH = 841.89;

export interface ComparisonPdfColumnGeometry {
  readonly orientation: 'portrait' | 'landscape';
  readonly tableWidth: number;
  readonly itemColumnWidth: number;
  readonly vehicleColumnWidth: number;
}

export interface ComparisonPdfVehicleViewModel {
  readonly id: string;
  readonly brandModel: string;
  readonly version: string;
  readonly years: string;
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
  readonly title: typeof APP_NAME;
  readonly heading: 'Comparação de veículos';
  readonly vehicleCount: number;
  readonly vehicleNames: readonly string[];
  readonly vehicles: readonly ComparisonPdfVehicleViewModel[];
  readonly geometry: ComparisonPdfColumnGeometry;
  readonly comparisonMode: ComparisonMode;
  readonly mode: 'Comparação completa' | 'Somente diferenças' | 'Vantagens da referência';
  readonly generatedAt: string;
  readonly categoryCount: number;
  readonly rowCount: number;
  readonly categories: readonly ComparisonPdfCategoryViewModel[];
  readonly emptyMessage: string | null;
}

export interface PreparedComparisonPdf {
  readonly categories: ComparisonPageViewModel['categories'];
  readonly model: ComparisonPdfViewModel;
}

const MODE_LABELS: Record<ComparisonMode, ComparisonPdfViewModel['mode']> = {
  complete: 'Comparação completa',
  differences: 'Somente diferenças',
  advantages: 'Vantagens da referência',
};

export function getComparisonPdfMode(rawMode: string | null, rawHighlights?: string | null) {
  return parseComparisonMode(rawMode ?? undefined, rawHighlights ?? undefined);
}

export function getComparisonPdfColumnGeometry(vehicleCount: number): ComparisonPdfColumnGeometry {
  const orientation = vehicleCount <= 2 ? 'portrait' : 'landscape';
  const pageWidth = orientation === 'portrait' ? A4_PORTRAIT_WIDTH : A4_LANDSCAPE_WIDTH;
  const tableWidth = pageWidth - COMPARISON_PDF_PAGE_MARGIN * 2;
  const itemColumnWidth = vehicleCount <= 2 ? 225 : 250;

  return {
    orientation,
    tableWidth,
    itemColumnWidth,
    vehicleColumnWidth: (tableWidth - itemColumnWidth) / Math.max(1, vehicleCount),
  };
}

export function getComparisonPdfItemFontSize(): number {
  return COMPARISON_PDF_MIN_CONTENT_FONT_SIZE;
}

export function getComparisonPdfValueFontSize(): number {
  return COMPARISON_PDF_MIN_CONTENT_FONT_SIZE;
}

function formatGeneratedAt(generatedAt: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(generatedAt);
}

export function prepareComparisonPdf(
  data: ComparisonPageDataDto,
  mode: ComparisonMode,
  generatedAt = new Date(),
): PreparedComparisonPdf {
  const categories = filterComparisonCategories((data as ComparisonPageViewModel).categories, mode);
  const vehicles = data.vehicles.map((vehicle, index) => ({
    id: vehicle.id,
    brandModel: [vehicle.brand, vehicle.model].filter(Boolean).join(' '),
    version: vehicle.version,
    years: `${vehicle.productionYear}/${vehicle.modelYear}`,
    isReference: index === 0,
  }));
  const geometry = getComparisonPdfColumnGeometry(vehicles.length);
  const pdfCategories: readonly ComparisonPdfCategoryViewModel[] = categories.map((category) => ({
    name: category.name,
    rows: category.rows.map((row) => ({
      code: row.code,
      label: row.label,
      labelFontSize: getComparisonPdfItemFontSize(),
      labelMaxLines: COMPARISON_PDF_ITEM_MAX_LINES,
      values: row.values.map((value, index) => {
        const presentation = getComparisonValuePresentation(
          value,
          shouldShowAdvantageCheckForMode(mode, index, row.hasReferenceAdvantage, value.comparison),
        );

        return {
          vehicleId: data.vehicles[index]?.id ?? `column-${index + 1}`,
          displayValue: presentation.displayValue,
          fontSize: getComparisonPdfValueFontSize(),
          showPresenceDot: presentation.showPresenceDot,
          showAdvantageCheck: presentation.showAdvantageCheck,
        };
      }),
    })),
  }));
  const rowCount = pdfCategories.reduce((total, category) => total + category.rows.length, 0);

  return {
    categories,
    model: {
      title: APP_NAME,
      heading: 'Comparação de veículos',
      vehicleCount: vehicles.length,
      vehicleNames: vehicles.map((vehicle) =>
        [vehicle.brandModel, vehicle.version].filter(Boolean).join(' '),
      ),
      vehicles,
      geometry,
      comparisonMode: mode,
      mode: MODE_LABELS[mode],
      generatedAt: formatGeneratedAt(generatedAt),
      categoryCount: pdfCategories.length,
      rowCount,
      categories: pdfCategories,
      emptyMessage:
        rowCount === 0
          ? mode === 'differences'
            ? 'Nenhuma diferença encontrada para esta seleção.'
            : mode === 'advantages'
              ? 'Nenhuma vantagem da referência encontrada para esta seleção.'
              : 'Nenhum item comparável encontrado para esta seleção.'
          : null,
    },
  };
}
