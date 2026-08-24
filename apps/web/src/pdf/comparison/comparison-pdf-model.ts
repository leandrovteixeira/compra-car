import type {
  ComparisonCategoryPresentationDto,
  ComparisonPageDataDto,
} from '@compra-car/contracts';

import { filterComparisonCategories } from '@/application/comparison/comparison-filter';

export interface ComparisonPdfViewModel {
  readonly title: 'Compra Car';
  readonly heading: 'Comparação de veículos';
  readonly vehicleCount: number;
  readonly vehicleNames: readonly string[];
  readonly mode: 'Comparação completa' | 'Ver vantagens';
  readonly categoryCount: number;
  readonly rowCount: number;
}

export interface PreparedComparisonPdf {
  readonly categories: readonly ComparisonCategoryPresentationDto[];
  readonly model: ComparisonPdfViewModel;
}

export function isComparisonHighlightsMode(value: string | null): boolean {
  return value === 'true';
}

export function prepareComparisonPdf(
  data: ComparisonPageDataDto,
  onlyHighlights: boolean,
): PreparedComparisonPdf {
  const categories = filterComparisonCategories(data.categories, onlyHighlights);

  return {
    categories,
    model: {
      title: 'Compra Car',
      heading: 'Comparação de veículos',
      vehicleCount: data.vehicles.length,
      vehicleNames: data.vehicles.map((vehicle) =>
        [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(' '),
      ),
      mode: onlyHighlights ? 'Ver vantagens' : 'Comparação completa',
      categoryCount: categories.length,
      rowCount: categories.reduce((total, category) => total + category.rows.length, 0),
    },
  };
}
