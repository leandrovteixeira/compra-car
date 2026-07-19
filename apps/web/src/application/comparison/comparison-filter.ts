import type { ComparisonCategoryPresentationDto } from '@compra-car/contracts';

export function filterComparisonCategories(
  categories: readonly ComparisonCategoryPresentationDto[],
  onlyDifferences: boolean,
): readonly ComparisonCategoryPresentationDto[] {
  if (!onlyDifferences) return categories;

  return categories.flatMap((category) => {
    const rows = category.rows.filter((row) => row.isDifferent);
    return rows.length > 0 ? [{ ...category, rows }] : [];
  });
}
