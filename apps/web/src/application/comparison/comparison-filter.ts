import type { ComparisonCategoryPresentationDto } from '@compra-car/contracts';

import type { ComparisonCategoryViewModel, ComparisonMode } from './comparison-view-model';

export function filterComparisonCategories(
  categories: readonly ComparisonCategoryViewModel[],
  mode: ComparisonMode,
): readonly ComparisonCategoryViewModel[] {
  if (mode === 'complete') return categories;

  return categories.flatMap((category) => {
    const rows = category.rows.filter((row) =>
      mode === 'differences' ? row.hasDifference : row.hasAnyAdvantage,
    );
    return rows.length > 0 ? [{ ...category, rows }] : [];
  });
}

export function filterComparisonHighlights(
  categories: readonly ComparisonCategoryPresentationDto[],
): readonly ComparisonCategoryPresentationDto[] {
  return categories.flatMap((category) => {
    const rows = category.rows.filter((row) => row.hasReferenceAdvantage);
    return rows.length > 0 ? [{ ...category, rows }] : [];
  });
}
