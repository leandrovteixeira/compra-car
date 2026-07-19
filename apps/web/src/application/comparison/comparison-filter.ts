import type { ComparisonCategoryPresentationDto } from '@compra-car/contracts';

export function filterComparisonCategories(
  categories: readonly ComparisonCategoryPresentationDto[],
  onlyHighlights: boolean,
): readonly ComparisonCategoryPresentationDto[] {
  if (!onlyHighlights) return categories;

  return categories.flatMap((category) => {
    const rows = category.rows.filter((row) => row.hasReferenceAdvantage);
    return rows.length > 0 ? [{ ...category, rows }] : [];
  });
}
